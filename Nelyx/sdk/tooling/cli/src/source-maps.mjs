// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
/** Keep the composed Hermes map and source text self-contained in its package. */
export function copyHermesMap(source, directory) {
  const map = JSON.parse(fs.readFileSync(source, 'utf8'));
  if (
    map.version !== 3 ||
    !Array.isArray(map.sources) ||
    !map.sources.length ||
    map.sources.length > 2048 ||
    !Array.isArray(map.sourcesContent) ||
    map.sourcesContent.length !== map.sources.length ||
    map.sourcesContent.some((value) => typeof value !== 'string')
  )
    throw new Error('Complete composed Hermes source map required');
  delete map.sourceRoot;
  map.file = 'application';
  map.sources = map.sources.map((_, index) => `source-maps/sources/${index}.js`);
  for (let index = 0; index < map.sources.length; ++index) {
    const file = path.join(directory, map.sources[index]);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, map.sourcesContent[index], { flag: 'wx' });
  }
  fs.writeFileSync(path.join(directory, 'application.js.map'), JSON.stringify(map), { flag: 'wx' });
  return { modules: map.sources.length };
}
export function verifyHermesMap(directory, records) {
  const map = JSON.parse(fs.readFileSync(path.join(directory, 'application.js.map'), 'utf8'));
  if (
    !records.some((record) => record.path === 'application.js.map' && record.type === 'file') ||
    map.version !== 3 ||
    map.sourceRoot !== undefined ||
    !Array.isArray(map.sources) ||
    !map.sources.length ||
    map.sources.length > 2048 ||
    !Array.isArray(map.sourcesContent) ||
    map.sources.length !== map.sourcesContent.length
  )
    throw new Error('Native package source map missing or incomplete');
  for (let index = 0; index < map.sources.length; ++index) {
    const name = `source-maps/sources/${index}.js`;
    if (
      map.sources[index] !== name ||
      typeof map.sourcesContent[index] !== 'string' ||
      !records.some((record) => record.path === name && record.type === 'file') ||
      fs.readFileSync(path.join(directory, name), 'utf8') !== map.sourcesContent[index]
    )
      throw new Error('Native package source map escaped or changed');
  }
  return { modules: map.sources.length };
}
