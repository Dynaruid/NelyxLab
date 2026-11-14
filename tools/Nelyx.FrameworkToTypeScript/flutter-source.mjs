// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '../..');
const origins = JSON.parse(
  fs.readFileSync(new URL('./data/work8/manual-origins.json', import.meta.url), 'utf8'),
);
export const flutterRevision = origins.pin;
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function gitBlob(bytes) {
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}
function relativeFile(file) {
  if (
    typeof file !== 'string' ||
    !file ||
    file.includes('\\') ||
    file.includes('\0') ||
    file.startsWith('/') ||
    file.split('/').some((part) => !part || part === '.' || part === '..') ||
    /^[a-z]:/i.test(file)
  )
    throw Error('Expected a repository-relative Flutter source file');
  return file;
}
/** Read immutable Git objects. A reference checkout or its HEAD is never an oracle identity. */
export function openFlutterSource(repository) {
  repository = fs.realpathSync(repository);
  const deadline = Date.now() + 1_200_000;
  const git = (args) => {
    if (Date.now() >= deadline) throw Error('Pinned Flutter source read exceeded 20 minutes');
    const result = spawnSync('git', ['-C', repository, ...args], {
      encoding: null,
      windowsHide: true,
      timeout: Math.max(1, deadline - Date.now()),
      maxBuffer: 128 * 1024 * 1024,
    });
    if (result.error) throw result.error;
    if (result.status !== 0)
      throw Error(`Pinned Flutter Git read failed: ${result.stderr.toString().trim()}`);
    return result.stdout;
  };
  if (!/^[a-f0-9]{40}$/.test(flutterRevision)) throw Error('Invalid Flutter source revision');
  const commit = git(['rev-parse', '--verify', `${flutterRevision}^{commit}`])
    .toString()
    .trim();
  if (commit !== flutterRevision) throw Error('Flutter source commit identity differs');
  const entries = new Map();
  for (const entry of git(['ls-tree', '-rz', '--full-tree', flutterRevision])
    .toString('utf8')
    .split('\0')) {
    if (!entry) continue;
    const match = /^(\d+) (\w+) ([a-f0-9]{40})\t([\s\S]+)$/.exec(entry);
    if (!match) throw Error('Invalid pinned Flutter tree entry');
    if (match[2] === 'blob') entries.set(match[4], { mode: match[1], blob: match[3] });
  }
  const cache = new Map();
  const read = (file) => {
    relativeFile(file);
    const entry = entries.get(file);
    if (!entry || !['100644', '100755'].includes(entry.mode))
      throw Error(`Missing or linked pinned Flutter source: ${file}`);
    let bytes = cache.get(file);
    if (!bytes) {
      bytes = git(['cat-file', 'blob', entry.blob]);
      if (gitBlob(bytes) !== entry.blob) throw Error(`Flutter Git blob differs: ${file}`);
      cache.set(file, bytes);
    }
    // A caller cannot mutate the bytes cached for another conversion/oracle.
    return Buffer.from(bytes);
  };
  return Object.freeze({
    revision: flutterRevision,
    files: (prefix) =>
      Object.freeze(
        [...entries.keys()].filter((file) => file.startsWith(relativeFile(prefix) + '/')).sort(),
      ),
    blob: (file) => entries.get(relativeFile(file))?.blob,
    read,
    text: (file) => read(file).toString('utf8'),
    verifyCoverage(coverage, reference = path.join(root, 'reference/flutter-master')) {
      if (coverage.source.repository !== 'https://github.com/flutter/flutter')
        throw Error('Unexpected Flutter source repository');
      if (coverage.source.revision !== flutterRevision)
        throw Error('Coverage and manual-origin Flutter revisions differ');
      const result = {
        revision: flutterRevision,
        files: 0,
        matching: 0,
        different: [],
        missing: [],
      };
      const seen = new Set();
      for (const file of coverage.source.files) {
        if (!file.gitBlob) continue; // Pub packages have a separate source owner.
        relativeFile(file.path);
        if (seen.has(file.path)) throw Error(`Duplicate Flutter source identity: ${file.path}`);
        seen.add(file.path);
        if (entries.get(file.path)?.blob !== file.gitBlob)
          throw Error(`Coverage does not describe the pinned Git tree: ${file.path}`);
        const bytes = read(file.path);
        if (sha256(bytes) !== file.upstreamSha256)
          throw Error(`Pinned Flutter SHA-256 differs: ${file.path}`);
        result.files++;
        const local = path.join(reference, file.path);
        if (!fs.existsSync(local)) result.missing.push(file.path);
        else {
          const normalized = Buffer.from(fs.readFileSync(local, 'utf8').replaceAll('\r\n', '\n'));
          if (gitBlob(normalized) === file.gitBlob) result.matching++;
          else result.different.push(file.path);
        }
      }
      return result;
    },
  });
}
