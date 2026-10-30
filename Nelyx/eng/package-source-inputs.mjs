// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
const inside = (root, file) => {
  const relative = path.relative(root, file);
  return (
    relative === '' ||
    (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))
  );
};

/** Reject a package built from older source before publishing its archive to a
 * runner. Raw .mjs packages need no emit; this checks the captured TS inputs of
 * emitted JS, not compiler reproducibility or native/image qualification. */
export function verifyPackageSourceInputs(directory) {
  const root = fs.realpathSync(directory),
    manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')),
    dist = path.join(root, 'dist');
  const fail = (message) => {
    throw Error('Rebuild ' + manifest.name + ' before supply: ' + message);
  };
  if (!fs.existsSync(dist)) {
    if (
      /"(?:\.\/)?dist(?:\/|")/.test(
        JSON.stringify([manifest.exports, manifest.main, manifest.types]),
      )
    )
      fail('dist is absent');
    return { package: manifest.name, modules: 0, scope: 'source-only-package' };
  }
  let modules = 0;
  const visit = (folder) => {
    for (const item of fs.readdirSync(folder, { withFileTypes: true })) {
      const file = path.join(folder, item.name);
      if (item.isSymbolicLink()) fail('emitted input is a link: ' + path.relative(root, file));
      if (item.isDirectory()) {
        visit(file);
        continue;
      }
      if (!item.name.endsWith('.js')) continue;
      const mapFile = file + '.map';
      if (!fs.existsSync(mapFile)) fail('source map absent: ' + path.relative(root, file));
      if (!inside(root, fs.realpathSync(mapFile)))
        fail('source map escapes its package: ' + path.relative(root, file));
      const map = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
      if (
        map.version !== 3 ||
        map.sourceRoot ||
        map.sources?.length !== 1 ||
        map.sourcesContent?.length !== 1 ||
        typeof map.sources[0] !== 'string' ||
        typeof map.sourcesContent[0] !== 'string'
      )
        fail('single captured implementation source required: ' + path.relative(root, mapFile));
      const source = path.resolve(path.dirname(file), map.sources[0]);
      if (
        !inside(root, source) ||
        !/(?<!\.d)\.tsx?$/.test(source) ||
        !fs.existsSync(source) ||
        !inside(root, fs.realpathSync(source))
      )
        fail('source escapes its package or is absent: ' + path.relative(root, file));
      if (fs.readFileSync(source, 'utf8') !== map.sourcesContent[0])
        fail('source differs from emitted map: ' + path.relative(root, file));
      modules++;
    }
  };
  if (!inside(root, fs.realpathSync(dist))) fail('dist escapes its package');
  visit(dist);
  if (!modules) fail('dist has no emitted implementation');
  return { package: manifest.name, modules, scope: 'current-source-map-inputs' };
}
