// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileTree, sha256 } from '@nelyx/tooling-contracts/node-files';
import { ensureDirectory } from './publication.mjs';

export function fingerprint(input) {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

export function hashTree(directory, accept = () => true) {
  return fileTree(directory)
    .filter(accept)
    .map((name) => [name, sha256(path.join(directory, name))]);
}

export function readBuildState(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) return;
    throw error;
  }
}

export function writeBuildState(file, data) {
  const directory = ensureDirectory(path.dirname(file));
  const bytes = JSON.stringify(data) + '\n';
  const previous = fs.lstatSync(file, { throwIfNoEntry: false });
  if (previous && (!previous.isFile() || previous.isSymbolicLink()))
    throw Error('Expected an ordinary build state file: ' + file);
  if (previous && fs.readFileSync(file, 'utf8') === bytes) return;
  const temporary = path.join(directory, '.build-state-' + randomUUID());
  try {
    fs.writeFileSync(temporary, bytes, { flag: 'wx' });
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

export function buildStage(stage, started, result) {
  process.stderr.write(
    '[nelyx:build] ' +
      JSON.stringify({
        stage,
        milliseconds: Math.round(performance.now() - started),
        ...result,
      }) +
      '\n',
  );
}
