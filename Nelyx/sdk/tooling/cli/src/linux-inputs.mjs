// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { sha256, relativeFile, localFile, fileTree } from './files.mjs';
export function verifyLinuxInputs({ runner, input }) {
  runner = path.resolve(runner);
  if (path.basename(runner) !== 'runner' || path.basename(path.dirname(runner)) !== 'linux')
    throw new Error('Linux native inputs require their owning linux/runner');
  input = fs.realpathSync(input);
  const root = path.dirname(input),
    manifest = JSON.parse(fs.readFileSync(input, 'utf8'));
  if (
    manifest.schema !== 'nelyx.linux-native-inputs/v1' ||
    manifest.architecture !== 'x86_64' ||
    manifest.profile !== 'linux-x64-graphite-text-probe' ||
    manifest.reactNative !== '0.81.6' ||
    manifest.rnlRevision !== '9412cf605c7cc77f920916401926ff9a9873ecd3' ||
    manifest.hermesRevision !== 'e0fc67142ec0763c6b6153ca2bf96df815539782' ||
    manifest.qualification !== 'notVerified'
  )
    throw new Error('Pinned x86_64 Linux m153/RNL/RN/Hermes native inputs required');
  if (
    !Array.isArray(manifest.files) ||
    !manifest.files.length ||
    manifest.files.length > 8192 ||
    !Array.isArray(manifest.libraries) ||
    manifest.libraries.length !== 5 ||
    new Set(manifest.libraries).size !== 5
  )
    throw new Error('Incomplete Linux native input inventory');
  const names = new Set();
  let bytes = 0;
  for (const record of manifest.files) {
    const name = relativeFile(record.file),
      key = name.toLowerCase();
    if (
      names.has(key) ||
      !Number.isSafeInteger(record.bytes) ||
      record.bytes < 0 ||
      !/^[a-f0-9]{64}$/.test(record.sha256)
    )
      throw new Error('Invalid Linux native input inventory');
    names.add(key);
    const file = localFile(root, name);
    if (
      !fs.statSync(file).isFile() ||
      fs.statSync(file).size !== record.bytes ||
      sha256(file) !== record.sha256
    )
      throw new Error('Linux native input hash/size changed: ' + name);
    bytes += record.bytes;
    if (bytes > 1024 * 1024 * 1024) throw new Error('Linux native inputs exceed 1GiB');
  }
  const actual = fileTree(root).filter((file) => file !== path.basename(input));
  if (
    actual.length !== manifest.files.length ||
    actual.some((file) => !names.has(file.toLowerCase()))
  )
    throw new Error('Unlisted Linux native input file');
  for (const file of [...manifest.libraries, manifest.sdk, manifest.modules])
    if (!names.has(relativeFile(file).toLowerCase()))
      throw new Error('Unlisted Linux library/recipe');
  const headers = localFile(root, manifest.headers);
  if (!fs.statSync(headers).isDirectory() || !fileTree(headers).length)
    throw new Error('Linux native headers missing');
  const runtime = localFile(runner, 'node_modules/@lucid-softworks/react-native-linux'),
    provenance = JSON.parse(fs.readFileSync(localFile(runtime, 'UPSTREAM.json'), 'utf8'));
  if (
    provenance.commit !== manifest.rnlRevision ||
    provenance.hermesCommit !== manifest.hermesRevision
  )
    throw new Error('Installed RNL native source cohort differs');
  if (
    /(?:["'])\/(?:cache|modules|inputs)\//.test(
      fs.readFileSync(localFile(root, manifest.sdk), 'utf8') +
        fs.readFileSync(localFile(root, manifest.modules), 'utf8'),
    )
  )
    throw new Error('Linux native recipe contains a private producer path');
  return { input, root, manifest, sha256: sha256(input), files: manifest.files.length, bytes };
}
export function prepareLinuxInputs({ app, runner, input }) {
  app = fs.realpathSync(app);
  if (path.resolve(runner) !== path.join(app, 'linux/runner'))
    throw new Error('Linux input preparation outside app runner');
  const verified = verifyLinuxInputs({ runner, input }),
    base = path.join(app, '.nelyx/linux-native'),
    destination = path.join(base, verified.sha256);
  fs.mkdirSync(base, { recursive: true });
  if (fs.realpathSync(base) !== base) throw new Error('Linux native input cache symlink');
  if (!fs.existsSync(destination)) {
    const stage = fs.mkdtempSync(path.join(base, '.prepare-'));
    for (const record of verified.manifest.files) {
      const target = path.join(stage, record.file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(localFile(verified.root, record.file), target);
    }
    fs.copyFileSync(verified.input, path.join(stage, 'inputs.json'));
    verifyLinuxInputs({ runner, input: path.join(stage, 'inputs.json') });
    fs.renameSync(stage, destination);
  }
  const prepared = verifyLinuxInputs({ runner, input: path.join(destination, 'inputs.json') });
  if (prepared.sha256 !== verified.sha256)
    throw new Error('Prepared Linux native manifest changed');
  const locator = path.join(app, '.nelyx/linux/native-inputs.json');
  fs.mkdirSync(path.dirname(locator), { recursive: true });
  fs.writeFileSync(
    locator,
    JSON.stringify(
      { schema: 'nelyx.linux-prepared/v1', input: prepared.input, sha256: prepared.sha256 },
      null,
      2,
    ) + '\n',
  );
  return {
    schema: 'nelyx.linux-prepared/v1',
    input: prepared.input,
    sha256: prepared.sha256,
    files: prepared.files,
    bytes: prepared.bytes,
  };
}
