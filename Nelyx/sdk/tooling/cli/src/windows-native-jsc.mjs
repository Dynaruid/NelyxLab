// SPDX-License-Identifier: BSD-3-Clause
// A direct JSI source supplier. No RNW host, RN binary or copied SDK tree.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { spawnSync } from 'node:child_process';
import { execute } from './commands.mjs';
import { sha256, fileTree, localFile, verifyInventory } from './files.mjs';
import { windowsCompilerEnvironment } from './windows-static-hermes.mjs';
import { windowsJscPin, windowsJscApiHeaderHashes } from './windows-jsc.mjs';
import { patchNativeJscAdapter } from './native-jsc-adapter.mjs';

export const nativeJscRuntimeHashes = Object.freeze({
  'JavaScriptCore.dll': windowsJscPin.runtimeSha256,
  'icuin77.dll': '87f8f8461e00da9e9e43f1d261099936540aa72974ce0a067e8aceac77b12d87',
  'icuuc77.dll': 'b7254d938250102a3588fa2361b1ae29cfe8795dca453d305c9ffd426e2efd6e',
  'icudt77.dll': 'ece83c41345ba922e5c11aabe566df5ce2086f0bcd4a82f975de1bb08ee0fb05',
});
const adapterBase = 'https://raw.githubusercontent.com/facebook/react-native/v0.83.10/';
const sourcePins = {
  'source/JSCRuntime.original.cpp': [
    adapterBase + 'packages/react-native/ReactCommon/jsc/JSCRuntime.cpp',
    'd8452ac0199fd9d7098b3b50c5d42ef042d562054febb4bbc2edf2e6c1e5b165',
  ],
  'include/jsc/JSCRuntime.h': [
    adapterBase + 'packages/react-native/ReactCommon/jsc/JSCRuntime.h',
    'e5700d645fe3f5a4c73ea21548f250fcc0bacb4178cbba023edd00fb83d2c74b',
  ],
  'licenses/RN-JSC-LICENSE': [
    adapterBase + 'LICENSE',
    'da6d3703ed11cbe42bd212c725957c98da23cbff1998c05fa4b3d976d1a58e93',
  ],
  'licenses/JSC-COPYING.LIB': [
    `https://raw.githubusercontent.com/WebKit/WebKit/${windowsJscPin.revision}/Source/JavaScriptCore/COPYING.LIB`,
    '5094ecb9c9dcd0eadc34f3c11511d9b5535063032bc150164ecd1a5d5a445547',
  ],
  'licenses/ICU-LICENSE': [
    'https://raw.githubusercontent.com/unicode-org/icu/release-77-1/LICENSE',
    '451167c55c0fa447cc2d5632714f5e3c567fe4f1e1badefab2c1333852198aca',
  ],
};
const producerHash = () => {
  const hash = createHash('sha256');
  for (const name of ['windows-native-jsc.mjs', 'native-jsc-adapter.mjs', 'windows-jsc.mjs'])
    hash.update(fs.readFileSync(new URL(name, import.meta.url)));
  return hash.digest('hex');
};
function removeTemporary(directory, parent) {
  if (
    path.dirname(fs.realpathSync(directory)) !== fs.realpathSync(parent) ||
    fs.lstatSync(directory).isSymbolicLink()
  )
    throw Error('Direct JSC preparation cleanup owner differs');
  fs.rmSync(directory, { recursive: true, force: true });
}
export function verifyNativeJsc(directory, { embedded = false } = {}) {
  directory = fs.realpathSync(directory);
  const manifest = JSON.parse(fs.readFileSync(localFile(directory, 'jsc-engine.json'), 'utf8'));
  if (
    manifest.schema !== 'nelyx.windows-native-jsc/v1' ||
    manifest.version !== windowsJscPin.version ||
    manifest.revision !== windowsJscPin.revision ||
    manifest.archiveSha256 !== windowsJscPin.archiveSha256 ||
    manifest.architecture !== 'x64' ||
    manifest.crt !== 'MD' ||
    manifest.adapter !== 'react-native-0.83.10-source' ||
    (embedded
      ? !/^[a-f0-9]{64}$/.test(manifest.producerSha256)
      : manifest.producerSha256 !== producerHash()) ||
    manifest.qualification !== 'notVerified'
  )
    throw Error('Direct JSC supplier identity differs');
  if (!embedded) verifyInventory(directory, manifest.files, ['jsc-engine.json']);
  for (const [name, hash] of Object.entries(nativeJscRuntimeHashes))
    if (sha256(localFile(directory, name)) !== hash)
      throw Error('Pinned direct JSC runtime differs: ' + name);
  if (!embedded)
    for (const [name, hash] of Object.entries(windowsJscApiHeaderHashes))
      if (sha256(localFile(directory, 'include/JavaScriptCore/' + name)) !== hash)
        throw Error('Pinned JSC API header differs');
  for (const [name, [, hash]] of Object.entries(sourcePins).filter(
    ([name]) => !embedded || name.startsWith('licenses/'),
  ))
    if (sha256(localFile(directory, name)) !== hash)
      throw Error('Pinned JSC source/license differs: ' + name);
  if (!embedded) {
    const original = fs.readFileSync(
      localFile(directory, 'source/JSCRuntime.original.cpp'),
      'utf8',
    );
    if (
      fs.readFileSync(localFile(directory, 'source/JSCRuntime.cpp'), 'utf8') !==
      patchNativeJscAdapter(original)
    )
      throw Error('Direct JSC adapter differs from the pinned source patch');
  }
  for (const name of [
    ...(!embedded ? ['JavaScriptCore.lib'] : []),
    'licenses/JSC-API-LICENSE',
    'licenses/JSC-SOURCE.txt',
  ])
    localFile(directory, name);
  if (
    sha256(localFile(directory, 'licenses/JSC-API-LICENSE')) !==
    windowsJscApiHeaderHashes['JSBase.h']
  )
    throw Error('Direct JSC API license differs');
  if (embedded) {
    for (const name of [
      ...Object.keys(nativeJscRuntimeHashes),
      ...Object.keys(sourcePins).filter((name) => name.startsWith('licenses/')),
      'licenses/JSC-API-LICENSE',
      'licenses/JSC-SOURCE.txt',
    ]) {
      const record = manifest.files?.find((file) => file.path === name);
      const file = localFile(directory, name);
      if (!record || record.sha256 !== sha256(file) || record.bytes !== fs.statSync(file).size)
        throw Error('Packaged JSC supplier file differs from its source inventory: ' + name);
    }
  }
  return { directory, manifest, sha256: sha256(path.join(directory, 'jsc-engine.json')) };
}

export async function prepareNativeJsc({ directory, signal }) {
  if (process.platform !== 'win32' || process.arch !== 'x64')
    throw Error('Direct JSC requires Windows x64');
  directory = path.resolve(directory);
  const parent = path.dirname(directory);
  fs.mkdirSync(parent, { recursive: true });
  if (fs.realpathSync(parent) !== parent) throw Error('Direct JSC supplier parent must be plain');
  if (fs.existsSync(directory)) {
    if (fs.lstatSync(directory).isSymbolicLink() || fs.realpathSync(directory) !== directory)
      throw Error('Direct JSC supplier cannot be a link');
    try {
      return verifyNativeJsc(directory);
    } catch (error) {
      const identity = path.join(directory, 'jsc-engine.json');
      if (
        !fs.existsSync(identity) ||
        JSON.parse(fs.readFileSync(identity, 'utf8')).schema !== 'nelyx.windows-native-jsc/v1'
      )
        throw error;
      // Only a supplier created by this owner may be replaced. Verify its
      // complete previous inventory before rebuilding for new producer source.
      const old = JSON.parse(fs.readFileSync(identity, 'utf8'));
      verifyInventory(directory, old.files, ['jsc-engine.json']);
    }
  }
  const lock = directory + '.lock';
  if (fs.existsSync(lock)) {
    if (fs.lstatSync(lock).isSymbolicLink())
      throw Error('Direct JSC supplier lock cannot be a link');
    const owner = Number(fs.readFileSync(lock, 'utf8'));
    if (!Number.isSafeInteger(owner) || owner <= 0)
      throw Error('Direct JSC supplier lock is incomplete');
    let alive = true;
    try {
      process.kill(owner, 0);
    } catch (error) {
      if (error.code === 'ESRCH') alive = false;
      else throw error;
    }
    if (alive) throw Error('Direct JSC supplier is already in use by process ' + owner);
    fs.unlinkSync(lock);
  }
  const handle = fs.openSync(lock, 'wx');
  fs.writeFileSync(handle, String(process.pid));
  let temporary;
  const deadline = Date.now() + 1_200_000;
  const controller = new AbortController(),
    abort = () => controller.abort(Error('Direct JSC preparation interrupted'));
  const timer = setTimeout(abort, 1_200_000);
  const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  process.once('SIGINT', abort);
  process.once('SIGTERM', abort);
  const remaining = () => {
    combined.throwIfAborted();
    return Math.max(1, deadline - Date.now());
  };
  try {
    temporary = fs.mkdtempSync(path.join(parent, '.native-jsc-'));
    const producerSha256 = producerHash();
    const env = windowsCompilerEnvironment(),
      stage = path.join(temporary, 'supplier');
    fs.mkdirSync(stage);
    const download = async (url, file, hash) => {
      const response = await fetch(url, {
        signal: AbortSignal.any([combined, AbortSignal.timeout(Math.min(120000, remaining()))]),
      });
      if (!response.ok || !response.body)
        throw Error('Direct JSC supplier download failed: ' + response.status);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(file, { flags: 'wx' }), {
        signal: combined,
      });
      if (sha256(file) !== hash)
        throw Error('Direct JSC supplier download hash differs: ' + path.basename(file));
    };
    const archive = path.join(temporary, 'webkit.zip');
    console.log('NELYX_DIRECT_JSC_ARCHIVE');
    await download(windowsJscPin.url, archive, windowsJscPin.archiveSha256);
    // Extract only the four runtime images from the verified archive.
    await execute(
      'pwsh.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip=[IO.Compression.ZipFile]::OpenRead($env:NELYX_JSC_ARCHIVE); try { foreach($name in @('JavaScriptCore.dll','icuin77.dll','icuuc77.dll','icudt77.dll')) { $entry=@($zip.Entries|Where-Object FullName -eq $name); if($entry.Count -ne 1){throw 'Ambiguous JSC archive image'}; [IO.Compression.ZipFileExtensions]::ExtractToFile($entry[0],[IO.Path]::Combine($env:NELYX_JSC_STAGE,$name),$false) } } finally { $zip.Dispose() }",
      ],
      {
        env: { ...env, NELYX_JSC_ARCHIVE: archive, NELYX_JSC_STAGE: stage },
        signal: combined,
        timeout: remaining(),
      },
    );
    for (const [name, hash] of Object.entries(nativeJscRuntimeHashes))
      if (sha256(path.join(stage, name)) !== hash)
        throw Error('Direct JSC archive runtime differs: ' + name);
    await Promise.all([
      ...Object.entries(windowsJscApiHeaderHashes).map(([name, hash]) =>
        download(
          `https://raw.githubusercontent.com/WebKit/WebKit/${windowsJscPin.revision}/Source/JavaScriptCore/API/${name}`,
          path.join(stage, 'include/JavaScriptCore', name),
          hash,
        ),
      ),
      ...Object.entries(sourcePins).map(([name, [url, hash]]) =>
        download(url, path.join(stage, name), hash),
      ),
    ]);
    fs.writeFileSync(
      path.join(stage, 'source/JSCRuntime.cpp'),
      patchNativeJscAdapter(
        fs.readFileSync(path.join(stage, 'source/JSCRuntime.original.cpp'), 'utf8'),
      ),
    );
    fs.copyFileSync(
      path.join(stage, 'include/JavaScriptCore/JSBase.h'),
      path.join(stage, 'licenses/JSC-API-LICENSE'),
    );
    const dumped = spawnSync('dumpbin.exe', ['/exports', path.join(stage, 'JavaScriptCore.dll')], {
      env,
      encoding: 'utf8',
      windowsHide: true,
      timeout: remaining(),
    });
    if (dumped.error) throw dumped.error;
    if (dumped.status) throw Error('Cannot inspect direct JSC exports');
    const symbols = [
      ...dumped.stdout.matchAll(/^\s+\d+\s+[A-F0-9]+\s+[A-F0-9]+\s+(JS\w+)\s*$/gm),
    ].map((m) => m[1]);
    for (const required of [
      'JSLock',
      'JSUnlock',
      'JSGlobalContextSetUnhandledRejectionCallback',
      'JSGlobalContextSetEvalEnabled',
    ])
      if (!symbols.includes(required))
        throw Error('Required direct JSC export missing: ' + required);
    if (symbols.length < 80 || !dumped.stdout.includes('?canUseAssembler@VM@JSC@@SA_NXZ'))
      throw Error('Pinned direct JSC admission exports missing');
    const definition = path.join(temporary, 'JavaScriptCore.def');
    fs.writeFileSync(
      definition,
      'LIBRARY JavaScriptCore.dll\nEXPORTS\n' +
        symbols.join('\n') +
        '\nkJSClassDefinitionEmpty DATA\n',
    );
    await execute(
      'lib.exe',
      [
        '/NOLOGO',
        '/MACHINE:X64',
        '/DEF:' + definition,
        '/OUT:' + path.join(stage, 'JavaScriptCore.lib'),
      ],
      { env, signal: combined, timeout: remaining() },
    );
    for (const extension of ['.exp']) {
      const generated = path.join(stage, 'JavaScriptCore' + extension);
      if (fs.existsSync(generated)) fs.unlinkSync(generated);
    }
    fs.writeFileSync(
      path.join(stage, 'licenses/JSC-SOURCE.txt'),
      `JavaScriptCore: WebKit ${windowsJscPin.revision}\nBinary: ${windowsJscPin.url}\nArchive SHA-256: ${windowsJscPin.archiveSha256}\nSource: https://github.com/WebKit/WebKit/tree/${windowsJscPin.revision}\nPlaywright patches/build: https://github.com/microsoft/playwright/tree/v${windowsJscPin.playwright}/browser_patches/webkit\nICU 77.1: https://github.com/unicode-org/icu/tree/release-77-1\nJSI adapter source only: https://github.com/facebook/react-native/tree/v0.83.10/packages/react-native/ReactCommon/jsc\nJavaScriptCore.dll remains a replaceable shared library under its upstream licenses. No RNW/RN runtime is linked.\n`,
    );
    const files = fileTree(stage).map((name) => ({
      path: name,
      bytes: fs.statSync(path.join(stage, name)).size,
      sha256: sha256(path.join(stage, name)),
    }));
    fs.writeFileSync(
      path.join(stage, 'jsc-engine.json'),
      JSON.stringify(
        {
          schema: 'nelyx.windows-native-jsc/v1',
          version: windowsJscPin.version,
          revision: windowsJscPin.revision,
          archiveSha256: windowsJscPin.archiveSha256,
          architecture: 'x64',
          crt: 'MD',
          adapter: 'react-native-0.83.10-source',
          producerSha256,
          qualification: 'notVerified',
          files,
        },
        null,
        2,
      ) + '\n',
    );
    if (producerHash() !== producerSha256)
      throw Error('Direct JSC producer source changed during preparation');
    verifyNativeJsc(stage);
    const previous = path.join(temporary, 'previous');
    if (fs.existsSync(directory)) fs.renameSync(directory, previous);
    try {
      fs.renameSync(stage, directory);
    } catch (error) {
      if (fs.existsSync(previous)) fs.renameSync(previous, directory);
      throw error;
    }
    return verifyNativeJsc(directory);
  } finally {
    clearTimeout(timer);
    controller.abort();
    process.removeListener('SIGINT', abort);
    process.removeListener('SIGTERM', abort);
    fs.closeSync(handle);
    fs.unlinkSync(lock);
    if (temporary) removeTemporary(temporary, parent);
  }
}
