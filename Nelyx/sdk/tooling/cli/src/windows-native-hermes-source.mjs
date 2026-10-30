// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { sha256 } from './files.mjs';

// The pinned archive has no source files under these four Android output
// directories. IDE Gradle imports may populate them in an idle Windows build.
// All other additions, removals and edits still participate in source identity.
const generated = new Set([
  'android/.gradle',
  'android/build',
  'android/build-logic/.gradle',
  'android/build-logic/build',
]);
export function nativeHermesSourceTree(directory) {
  const files = [];
  const visit = (folder, prefix = '') => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const relative = prefix + entry.name;
      if (generated.has(relative) && entry.isDirectory()) continue;
      if (entry.isSymbolicLink()) throw Error('Hermes source input is a link: ' + relative);
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) visit(file, relative + '/');
      else if (entry.isFile()) files.push(relative);
      else throw Error('Hermes source input is not a regular file: ' + relative);
    }
  };
  visit(directory);
  return createHash('sha256')
    .update(JSON.stringify(files.sort().map((name) => [name, sha256(path.join(directory, name))])))
    .digest('hex');
}
