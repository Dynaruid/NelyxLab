// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const nelyx = path.resolve(import.meta.dirname, '..');
const engine = path.join(nelyx, 'engine');

/** Current package projections of engine-owned helpers, never another source owner. */
export function prepareEngineHelpers() {
  const sources = JSON.parse(
    fs.readFileSync(path.join(engine, 'vendor/helper-sources.json'), 'utf8'),
  ).projections;
  for (const owner of ['sdk', 'skia']) {
    const output = path.join(nelyx, owner, 'native/engine-helpers');
    const checked = (file) => {
      const absolute = path.resolve(file),
        relative = path.relative(output, absolute);
      if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative))
        throw Error('Engine helper projection escapes its package');
      let ancestor = absolute;
      while (ancestor !== nelyx) {
        if (fs.existsSync(ancestor) && fs.lstatSync(ancestor).isSymbolicLink())
          throw Error('Engine helper projection follows a symbolic link');
        ancestor = path.dirname(ancestor);
      }
      return absolute;
    };
    const wanted = new Set();
    for (const entry of sources) {
      const source = path.resolve(engine, entry.source);
      if (!source.startsWith(engine + path.sep) || !fs.statSync(source).isFile())
        throw Error('Invalid engine helper source');
      const target = checked(path.join(output, entry.source)),
        bytes = fs.readFileSync(source);
      wanted.add(target);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      if (!fs.existsSync(target) || !fs.readFileSync(target).equals(bytes))
        fs.writeFileSync(target, bytes);
    }
    const prune = (directory) => {
      for (const entry of fs.readdirSync(checked(directory), { withFileTypes: true })) {
        const file = checked(path.join(directory, entry.name));
        if (entry.isDirectory()) prune(file);
        else if (!wanted.has(file)) fs.unlinkSync(file);
      }
    };
    prune(output);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  prepareEngineHelpers();
