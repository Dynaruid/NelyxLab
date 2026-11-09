// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** One current candidate asset set; originals and notices stay owned by each sample. */
export function prepareOriginalSample(name) {
  if (!['nelyx-testbed-app-2', 'nelyx-demo-app'].includes(name))
    throw Error('Unknown original sample');
  const app = path.join(import.meta.dirname, name),
    candidate = path.join(app, 'engine-v2');
  const legacy = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8')).nelyx;
  const settings = JSON.parse(fs.readFileSync(path.join(candidate, 'nelyx.json'), 'utf8'));
  for (const [key, relative] of Object.entries(settings.assets)) {
    const asset = legacy.assets.find((entry) => entry.id === key);
    if (!asset) throw Error('Candidate asset has no original sample owner: ' + key);
    const source = fs.realpathSync(path.resolve(app, asset.path)),
      target = path.resolve(candidate, relative);
    if (
      !source.startsWith(app + path.sep) ||
      !target.startsWith(candidate + path.sep + 'assets' + path.sep)
    )
      throw Error('Sample asset path escapes its owner');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (source !== target) fs.copyFileSync(source, target);
    if (asset.notice?.path) {
      const notice = fs.realpathSync(path.resolve(app, asset.notice.path));
      if (!notice.startsWith(app + path.sep)) throw Error('Sample notice path escapes its owner');
      fs.copyFileSync(notice, target + '.LICENSE.txt');
    }
  }
  return candidate;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  prepareOriginalSample(process.argv[2]);
