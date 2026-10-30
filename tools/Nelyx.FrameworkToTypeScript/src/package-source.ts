// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { ModuleRecipe } from './body-ir.ts';
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
function inside(root: string, file: string) {
  const relative = path.relative(root, file);
  return (
    relative !== '' &&
    !relative.startsWith('..' + path.sep) &&
    relative !== '..' &&
    !path.isAbsolute(relative)
  );
}
/** Filesystem/pin admission. The Dart frontend separately proves resolved
 * library membership; a previously validated fingerprint can only be reused
 * while all Dart sources in this external package remain unchanged. */
export function resolvePackageSource(repository: string, module: ModuleRecipe) {
  const tool = path.join(repository, 'tools/Nelyx.FrameworkToTypeScript/dart'),
    pin = module.packagePin;
  if (
    !pin ||
    typeof pin.name !== 'string' ||
    typeof pin.version !== 'string' ||
    !/^[a-f0-9]{64}$/.test(pin.archiveSha256)
  )
    throw new Error('External source requires an exact locked package pin');
  const lock = Bun.YAML.parse(fs.readFileSync(path.join(tool, 'pubspec.lock'), 'utf8')) as any,
    locked = lock?.packages?.[pin.name];
  if (
    locked?.source !== 'hosted' ||
    locked.version !== pin.version ||
    locked.description?.name !== pin.name ||
    locked.description?.sha256 !== pin.archiveSha256
  )
    throw new Error('External package pin differs from tool lock');
  const configFile = path.join(tool, '.dart_tool/package_config.json'),
    config = JSON.parse(fs.readFileSync(configFile, 'utf8')),
    matches = config.packages.filter((p: any) => p.name === pin.name);
  if (matches.length !== 1) throw new Error('External package root is missing or ambiguous');
  const configured = matches[0];
  const packageRoot = fs.realpathSync(
      fileURLToPath(new URL(configured.rootUri, pathToFileURL(configFile))),
    ),
    libraryRoot = path.resolve(packageRoot, configured.packageUri);
  if (!inside(packageRoot, libraryRoot))
    throw new Error('External package library root escapes package');
  function checked(file: string) {
    if (!inside(libraryRoot, file)) throw new Error('External source escapes package library');
    let cursor = packageRoot;
    for (const part of path.relative(packageRoot, file).split(path.sep)) {
      cursor = path.join(cursor, part);
      if (fs.lstatSync(cursor).isSymbolicLink()) throw new Error('External linked source rejected');
    }
    const actual = fs.realpathSync(file);
    if (!inside(libraryRoot, actual))
      throw new Error('External linked source escapes package library');
    return file;
  }
  function sourcePath(uri: string) {
    if (
      typeof uri !== 'string' ||
      !uri.startsWith('package:' + pin!.name + '/') ||
      /[?#\\]/.test(uri)
    )
      throw new Error('External source URI escapes package');
    const relative = uri.slice(('package:' + pin!.name + '/').length);
    const segments = relative.split('/');
    if (
      !segments.length ||
      segments.some((s) => !s || s === '.' || s === '..' || decodeURIComponent(s) !== s) ||
      path.isAbsolute(relative)
    )
      throw new Error('External source URI escapes package');
    return checked(path.resolve(libraryRoot, ...segments));
  }
  if (!module.library || !module.librarySha256)
    throw new Error('External source requires a pinned owning library');
  const file = sourcePath(module.source),
    libraryFile = sourcePath(module.library),
    content = fs.readFileSync(file, 'utf8'),
    library = fs.readFileSync(libraryFile, 'utf8');
  if (sha(content.replaceAll('\r\n', '\n')) !== module.sha256)
    throw new Error('Pinned source bytes drifted: ' + module.source);
  if (sha(library.replaceAll('\r\n', '\n')) !== module.librarySha256)
    throw new Error('External owning library hash mismatch');
  const manifestFile = path.join(packageRoot, 'pubspec.yaml'),
    manifestBytes = fs.readFileSync(manifestFile),
    manifest = Bun.YAML.parse(manifestBytes.toString()) as any;
  if (manifest?.name !== pin.name || manifest.version !== pin.version)
    throw new Error('External package manifest differs from lock');
  const sources: Record<string, string> = {};
  function walk(folder: string) {
    for (const entry of fs
      .readdirSync(folder, { withFileTypes: true })
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      const file = path.join(folder, entry.name);
      if (entry.isSymbolicLink()) throw new Error('External linked source rejected');
      if (entry.isDirectory()) walk(file);
      else if (entry.name.endsWith('.dart')) {
        checked(file);
        sources[path.relative(libraryRoot, file).replaceAll('\\', '/')] = sha(
          fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n'),
        );
      }
    }
  }
  walk(libraryRoot);
  return {
    file,
    libraryFile,
    content,
    identity: {
      source: module.source,
      sha256: module.sha256,
      packagePin: pin,
      library: module.library,
      librarySha256: module.librarySha256,
      manifestSha256: sha(manifestBytes),
      languageVersion: configured.languageVersion,
      packageUri: configured.packageUri,
      dartSources: sources,
    },
  };
}
