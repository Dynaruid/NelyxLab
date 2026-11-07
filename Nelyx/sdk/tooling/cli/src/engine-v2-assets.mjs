// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
export function applicationAssetKey(key) {
  if (
    typeof key !== 'string' ||
    !key ||
    Buffer.byteLength(key, 'utf8') > 1024 ||
    /[\\:*?"<>|]/.test(key) ||
    key.split('/').some((part) => !part || part === '.' || part === '..' || /[. ]$/.test(part))
  )
    throw Error('Invalid application asset name: ' + key);
  for (let at = 0; at < key.length; ++at)
    if (key.charCodeAt(at) < 32 || key.charCodeAt(at) === 127)
      throw Error('Invalid application asset name');
  if (Buffer.from(key, 'utf8').toString('utf8') !== key)
    throw Error('Invalid application asset UTF-8 name');
}
/** The canonical codec serializes the pin's asset -> [{asset,dpr}] catalog. */
export function writeAssetManifests(directory, keys, MessageCodec) {
  const groups = new Map(),
    catalog = new Map();
  for (const key of keys) {
    const match = /^(.*\/)?([0-9]+(?:\.[0-9]+)?)x\/([^/]+)$/.exec(key),
      main = match ? (match[1] ?? '') + match[3] : key,
      dpr = match ? Number(match[2]) : 1;
    if (!Number.isFinite(dpr) || dpr <= 0) throw Error('Invalid asset resolution directory');
    const variants = groups.get(main) ?? [];
    variants.push({ key, dpr });
    groups.set(main, variants);
  }
  for (const [main, variants] of groups) {
    variants.sort((a, b) => a.dpr - b.dpr);
    const values = variants.map(
      ({ key, dpr }) =>
        new Map([
          ['asset', key],
          ['dpr', dpr],
        ]),
    );
    catalog.set(main, values);
    variants.forEach(({ key }, i) => {
      if (key !== main) catalog.set(key, [values[i]]);
    });
  }
  const message = new MessageCodec().encodeMessage(catalog),
    binary = Buffer.from(message.buffer, message.byteOffset, message.byteLength);
  if (binary.length > 1024 * 1024) throw Error('Asset manifest metadata budget exceeded');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'AssetManifest.bin'), binary);
  fs.writeFileSync(
    path.join(directory, 'AssetManifest.bin.json'),
    JSON.stringify(binary.toString('base64')),
  );
  const entries = [...keys, 'AssetManifest.bin', 'AssetManifest.bin.json'].map((key) => {
    const file = path.join(directory, key);
    return {
      key,
      size: fs.statSync(file).size,
      sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
    };
  });
  const index = JSON.stringify({ schema: 'nelyx.assets.v2/1', assets: entries });
  if (Buffer.byteLength(index, 'utf8') > 512 * 1024)
    throw Error('Asset index metadata budget exceeded');
  fs.writeFileSync(path.join(directory, '../asset-index.json'), index);
}
