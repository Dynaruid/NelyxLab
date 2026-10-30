// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { isTemplateInput } from './template-inputs.mjs';

/** Content identity of the package that is actually installed, including
 * native headers and emitted JS. Versions and mtimes cannot establish this. */
export function packageBuildInputs(directory) {
  directory = fs.realpathSync(directory);
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8')),
    hash = createHash('sha256');
  const add = (name, bytes, kind = 'file') => {
    hash.update(JSON.stringify([name, kind, bytes.length]) + '\n');
    hash.update(bytes);
  };
  add('package.json', Buffer.from(JSON.stringify(manifest)));
  const visit = (relative, entry) => {
    if (
      manifest.name === '@nelyx/cli' &&
      relative.startsWith('templates/') &&
      !isTemplateInput(relative)
    )
      return;
    if (
      typeof relative !== 'string' ||
      !relative ||
      path.isAbsolute(relative) ||
      relative.split(/[\\/]/).some((part) => !part || part === '..' || part === '.') ||
      /[*?]/.test(relative)
    )
      throw Error('Invalid package build input: ' + relative);
    const file = path.join(directory, relative);
    let stat = entry;
    if (!stat)
      try {
        stat = fs.lstatSync(file);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        add(relative, Buffer.alloc(0), 'missing');
        return;
      }
    if (stat.isSymbolicLink()) throw Error('Package build input is a link: ' + file);
    if (stat.isDirectory())
      for (const child of fs
        .readdirSync(file, { withFileTypes: true })
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)))
        visit(relative + '/' + child.name, child);
    else if (stat.isFile()) add(relative, fs.readFileSync(file));
    else throw Error('Package build input is not a regular file: ' + file);
  };
  if (!Array.isArray(manifest.files))
    throw Error('Nelyx package build inputs require an explicit files list: ' + manifest.name);
  for (const relative of [...manifest.files].sort()) visit(relative);
  return hash.digest('hex');
}

export function windowsSdkPackages(runner) {
  const manifest = JSON.parse(fs.readFileSync(path.join(runner, 'package.json'), 'utf8'));
  return [
    ...new Set(
      Object.keys({ ...manifest.dependencies, ...manifest.devDependencies }).filter((name) =>
        name.startsWith('@nelyx/'),
      ),
    ),
  ].sort();
}

export function windowsBuildInputs(runner) {
  const inputs = windowsSdkPackages(runner).map((name) => [
    name,
    packageBuildInputs(path.join(runner, 'node_modules', ...name.split('/'))),
  ]);
  if (!inputs.length) throw Error('Windows runner has no installed Nelyx SDK packages');
  return createHash('sha256').update(JSON.stringify(inputs)).digest('hex');
}

/** App-owned sources, assets and Windows configuration, independent of mtimes.
 * Exclude compiler/IDE outputs so a successful build remains reusable. */
export function windowsAppBuildInputs(app) {
  app = fs.realpathSync(app);
  const hash = createHash('sha256').update('nelyx.windows-app-inputs/v1\n'),
    manifest = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8')),
    assetFiles = new Set(
      (manifest.nelyx?.assets ?? []).flatMap((asset) =>
        [asset.path, asset.notice?.path].filter(Boolean).map((name) => name.replace(/^\.\//, '')),
      ),
    ),
    otherTargets = new Set(['android', 'ios', 'macos', 'linux', 'web']),
    generated = new Set(['.git', '.idea', '.bundle', 'ipch', 'Generated Files']),
    generatedFiles = new Set([
      'windows/runner/app-config.json',
      'windows/runner/tsconfig.generated.json',
      'windows/Directory.Build.targets',
    ]);
  const visit = (directory, prefix = '') => {
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      const relative = prefix + entry.name;
      if (
        !isTemplateInput(relative) ||
        generated.has(entry.name) ||
        (!prefix && otherTargets.has(entry.name)) ||
        relative === 'windows/packages' ||
        /^windows\/[^/]+\/Bundle$/.test(relative) ||
        generatedFiles.has(relative) ||
        /^windows\/[^/]+\/AutolinkedNativeModules\.g\.(?:cpp|h|props|targets)$/.test(relative)
      )
        continue;
      if (entry.isSymbolicLink()) throw Error('Windows application input is a link: ' + relative);
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file, relative + '/');
      else if (entry.isFile()) {
        if (/\.md$/i.test(relative) && !assetFiles.has(relative)) continue;
        const bytes = fs.readFileSync(file);
        hash.update(JSON.stringify([relative, bytes.length]) + '\n');
        hash.update(bytes);
      } else throw Error('Windows application input is not a regular file: ' + relative);
    }
  };
  visit(app);
  return hash.digest('hex');
}
