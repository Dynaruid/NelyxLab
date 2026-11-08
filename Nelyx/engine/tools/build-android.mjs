// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { engineRoot, sourceIdentity, run, renameEngineDirectory } from './build.mjs';
import { protocol as p } from '../../runtime/engine-client/schema.ts';

export const androidPins = JSON.parse(
  fs.readFileSync(path.join(engineRoot, 'platform/android/suppliers.json')),
);
function removeStaging(directory) {
  if (
    path.dirname(directory) !== path.join(engineRoot, '.cache') ||
    !path.basename(directory).startsWith('engine-android-') ||
    fs.lstatSync(directory).isSymbolicLink()
  )
    throw Error('Unexpected Android staging cleanup');
  fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3 });
}
const repository = path.resolve(engineRoot, '../..');
const sha256 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function verifyLoadAlignment(file) {
  const bytes = fs.readFileSync(file);
  if (bytes.length < 64 || bytes.readUInt32BE(0) !== 0x7f454c46 || bytes[4] !== 2 || bytes[5] !== 1)
    throw Error('Expected an ELF64 little-endian Android library: ' + file);
  const offset = Number(bytes.readBigUInt64LE(32)),
    size = bytes.readUInt16LE(54),
    count = bytes.readUInt16LE(56);
  let loads = 0;
  if (
    !Number.isSafeInteger(offset) ||
    size < 56 ||
    count > 1024 ||
    offset + size * count > bytes.length
  )
    throw Error('Malformed Android ELF program headers');
  for (let i = 0; i < count; ++i) {
    const at = offset + i * size;
    if (bytes.readUInt32LE(at) !== 1) continue;
    ++loads;
    const alignment = bytes.readBigUInt64LE(at + 48);
    if (
      alignment < 16384n ||
      bytes.readBigUInt64LE(at + 8) % 16384n !== bytes.readBigUInt64LE(at + 16) % 16384n
    )
      throw Error('Android library does not admit 16 KiB pages: ' + file);
  }
  if (!loads) throw Error('Android library has no LOAD segments: ' + file);
}
const files = (directory, prefix = '') =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isSymbolicLink()) throw Error('Android supply contains a symbolic link');
    const name = path.posix.join(prefix, entry.name);
    return entry.isDirectory() ? files(path.join(directory, entry.name), name) : [name];
  });
export function androidSdk(directory) {
  const root = path.resolve(
    directory ??
      process.env.ANDROID_HOME ??
      process.env.ANDROID_SDK_ROOT ??
      path.join(os.homedir(), 'AppData/Local/Android/Sdk'),
  );
  for (const name of [
    `ndk/${androidPins.ndk}/build/cmake/android.toolchain.cmake`,
    `platforms/android-${androidPins.compileSdk}/android.jar`,
    `build-tools/${androidPins.buildTools}/source.properties`,
    'platform-tools/source.properties',
  ])
    if (!fs.existsSync(path.join(root, name))) throw Error('Android toolchain missing: ' + name);
  return root;
}
async function archiveSupplier(cache, name, pin, prefixes) {
  const directory = path.join(cache, name + '-' + pin.version);
  const marker = path.join(directory, 'supplier.json');
  if (fs.existsSync(marker)) {
    const manifest = JSON.parse(fs.readFileSync(marker));
    if (manifest.archiveSha256 !== pin.sha256) throw Error(name + ' supplier identity differs');
    for (const file of manifest.files)
      if (sha256(path.join(directory, file.path)) !== file.sha256)
        throw Error(name + ' supplier damaged: ' + file.path);
    return directory;
  }
  fs.mkdirSync(directory, { recursive: true });
  const archive = path.join(directory, 'supplier.aar');
  try {
    if (!fs.existsSync(archive)) {
      const response = await fetch(pin.url);
      if (!response.ok) throw Error('Hermes download failed: ' + response.status);
      fs.writeFileSync(archive, new Uint8Array(await response.arrayBuffer()));
    }
    if (sha256(archive) !== pin.sha256) throw Error(name + ' archive SHA-256 differs');
    run('python', [
      '-c',
      `import zipfile,pathlib,sys,json\nroot=pathlib.Path(sys.argv[2]).resolve()\nprefixes=json.loads(sys.argv[3])\nwith zipfile.ZipFile(sys.argv[1]) as z:\n for e in z.infolist():\n  if e.is_dir() or not any(e.filename.startswith(p) for p in prefixes): continue\n  target=(root/e.filename).resolve()\n  if root not in target.parents: raise ValueError('Archive leaves supplier root')\n  target.parent.mkdir(parents=True,exist_ok=True)\n  target.write_bytes(z.read(e))`,
      archive,
      directory,
      JSON.stringify(prefixes),
    ]);
  } finally {
    fs.rmSync(archive, { force: true });
  }
  fs.writeFileSync(
    marker,
    JSON.stringify(
      {
        archiveSha256: pin.sha256,
        files: files(directory)
          .filter((name) => name !== 'supplier.json')
          .map((name) => ({ path: name, sha256: sha256(path.join(directory, name)) })),
      },
      null,
      2,
    ) + '\n',
  );
  return directory;
}
export async function buildAndroidSupply({ sdk, abis = androidPins.abis, skiaPackage } = {}) {
  if (
    !abis.length ||
    new Set(abis).size !== abis.length ||
    abis.some((abi) => !androidPins.abis.includes(abi))
  )
    throw Error('Android ABI must select arm64-v8a and/or x86_64');
  const sdkRoot = androidSdk(sdk),
    cache = path.join(repository, '.nelyx/android-v2');
  run(process.execPath, [path.join(engineRoot, 'tools/generate-schema.mjs'), '--check']);
  fs.mkdirSync(cache, { recursive: true });
  const hermes = await archiveSupplier(
    path.join(cache, 'suppliers'),
    'hermes',
    androidPins.hermes,
    [
      'prefab/modules/hermesvm/include/',
      'jni/arm64-v8a/libhermesvm.so',
      'jni/x86_64/libhermesvm.so',
    ],
  );
  const fbjni = await archiveSupplier(path.join(cache, 'suppliers'), 'fbjni', androidPins.fbjni, [
    'jni/arm64-v8a/libfbjni.so',
    'jni/x86_64/libfbjni.so',
  ]);
  const require = createRequire(path.join(repository, 'package.json'));
  let skiaRoot;
  if (skiaPackage) skiaRoot = fs.realpathSync(skiaPackage);
  else {
    const candidates = [
      repository,
      path.join(repository, 'sample/nelyx-testbed-app-2/android/runner'),
    ];
    for (const candidate of candidates) {
      try {
        skiaRoot = path.dirname(
          require.resolve('react-native-skia-graphite-android/package.json', {
            paths: [candidate],
          }),
        );
        break;
      } catch {}
    }
  }
  if (
    !skiaRoot ||
    JSON.parse(fs.readFileSync(path.join(skiaRoot, 'package.json'))).version !== androidPins.skia ||
    fs.readFileSync(path.join(skiaRoot, 'libs/.dawn-version'), 'utf8').trim() !== androidPins.dawn
  )
    throw Error(
      'Pinned Android Skia/Dawn supplier missing; install react-native-skia-graphite-android@' +
        androidPins.skia,
    );
  const headers = path.join(repository, 'Nelyx/skia/packages/rn/generated/sdk');
  const headerPin = JSON.parse(
    fs.readFileSync(path.join(repository, 'Nelyx/skia/vendor/artifacts.lock.json')),
  ).artifacts.find((entry) => entry.id === 'rn-graphite-154.1-sdk');
  const headerIdentity = createHash('sha256')
    .update(
      files(headers)
        .sort()
        .map((name) => name + '\0' + sha256(path.join(headers, name)) + '\n')
        .join(''),
    )
    .digest('hex');
  if (!headerPin || headerIdentity !== headerPin.treeSha256)
    throw Error('Android Skia/Dawn header tree differs from the pinned supplier');
  const jsi = path.join(
    path.dirname(require.resolve('react-native/package.json')),
    'ReactCommon/jsi',
  );
  const source = sourceIdentity();
  const parent = engineRoot,
    staged = fs.mkdtempSync(path.join(parent, '.cache/engine-android-')),
    supply = path.join(staged, 'supply'),
    final = path.join(parent, 'dist-android'),
    backup = path.join(staged, 'previous');
  fs.mkdirSync(supply);
  try {
    const copy = (from, name) => {
      const target = path.join(supply, name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(from, target);
    };
    const supplierFiles = [];
    for (const abi of abis) {
      for (const [name, expected] of Object.entries(androidPins.skiaLibraries[abi]))
        if (sha256(path.join(skiaRoot, 'libs', abi, name)) !== expected)
          throw Error('Pinned Android Skia/Dawn library differs: ' + abi + '/' + name);
      const output = path.join(cache, 'build-' + abi);
      run('cmake', [
        '-S',
        engineRoot,
        '-B',
        output,
        '-G',
        'Ninja',
        '-DCMAKE_BUILD_TYPE=Release',
        '-DNELYX_ENGINE_ANDROID_HOST=ON',
        '-DANDROID_ABI=' + abi,
        '-DANDROID_PLATFORM=android-' + androidPins.minSdk,
        '-DANDROID_STL=c++_shared',
        '-DCMAKE_TOOLCHAIN_FILE=' +
          path.join(sdkRoot, `ndk/${androidPins.ndk}/build/cmake/android.toolchain.cmake`),
        '-DNELYX_ANDROID_SKIA_LIBS=' + path.join(skiaRoot, 'libs'),
        '-DNELYX_SKIA_HEADERS=' + path.join(headers, 'skia'),
        '-DNELYX_DAWN_HEADERS=' + path.join(headers, 'dawn/include'),
        '-DNELYX_ANDROID_HERMES=' + hermes,
        '-DNELYX_JSI_ROOT=' + jsi,
        '-DNELYX_ANDROID_SOURCE_SHA=' + source,
      ]);
      run('cmake', ['--build', output, '--parallel', '2']);
      copy(
        path.join(output, 'libnelyx_engine_android.so'),
        `jni/${abi}/libnelyx_engine_android.so`,
      );
      copy(path.join(output, 'libjsi.so'), `jni/${abi}/libjsi.so`);
      copy(path.join(hermes, `jni/${abi}/libhermesvm.so`), `jni/${abi}/libhermesvm.so`);
      copy(path.join(fbjni, `jni/${abi}/libfbjni.so`), `jni/${abi}/libfbjni.so`);
      copy(path.join(skiaRoot, `libs/${abi}/libwebgpu_dawn.so`), `jni/${abi}/libwebgpu_dawn.so`);
      const triple = abi === 'arm64-v8a' ? 'aarch64-linux-android' : 'x86_64-linux-android';
      copy(
        path.join(
          sdkRoot,
          `ndk/${androidPins.ndk}/toolchains/llvm/prebuilt/${process.platform === 'win32' ? 'windows-x86_64' : 'linux-x86_64'}/sysroot/usr/lib/${triple}/libc++_shared.so`,
        ),
        `jni/${abi}/libc++_shared.so`,
      );
      for (const name of [
        'libskia.a',
        'libskparagraph.a',
        'libskshaper.a',
        'libskunicode_icu.a',
        'libskunicode_core.a',
        'libwebgpu_dawn.so',
      ])
        supplierFiles.push({ abi, name, sha256: sha256(path.join(skiaRoot, 'libs', abi, name)) });
      for (const name of files(path.join(supply, 'jni', abi)))
        verifyLoadAlignment(path.join(supply, 'jni', abi, name));
      console.log('Engine v2 Android compiled: ' + abi);
    }
    copy(
      path.join(repository, 'Nelyx/sdk/tooling/cli/templates/nelyx-app/assets/NotoSansKR.ttf'),
      'assets/font.ttf',
    );
    copy(
      path.join(repository, 'Nelyx/sdk/tooling/cli/templates/nelyx-app/assets/NotoSansKR-OFL.txt'),
      'assets/OFL.txt',
    );
    for (const name of [
      'NotoNaskhArabic-Regular.ttf',
      'NotoNaskhArabic-Regular.ttf.LICENSE.txt',
      'NotoSansHebrew.ttf',
      'NotoSansHebrew-OFL.txt',
      'NotoColorEmoji.ttf',
      'NotoColorEmoji.ttf.LICENSE.txt',
    ])
      copy(
        path.join(repository, 'Nelyx/sdk/tooling/cli/templates/nelyx-app/assets', name),
        'assets/' + name,
      );
    // Android uses the system ICU provider. Preserve a declared, zero-byte data asset
    // so the common provider accounts for exactly the bytes it actually retains.
    fs.writeFileSync(path.join(supply, 'assets/icudtl.dat'), '');
    const project = path.join(engineRoot, 'platform/android/project');
    for (const name of files(project)) copy(path.join(project, name), 'project/' + name);
    copy(
      path.join(
        repository,
        'Nelyx/sdk/tooling/cli/templates/nelyx-app/android/gradle/wrapper/gradle-wrapper.jar',
      ),
      'project/gradle/wrapper/gradle-wrapper.jar',
    );
    const input = path.join(repository, 'Nelyx/engine/platform/android/shared');
    for (const name of files(input))
      copy(path.join(input, name), 'project/app/src/main/java/' + name);
    copy(path.join(repository, 'Nelyx/LICENSE.md'), 'LICENSE.md');
    for (const name of files(path.join(engineRoot, 'platform/android/licenses')))
      copy(path.join(engineRoot, 'platform/android/licenses', name), 'licenses/' + name);
    copy(
      path.join(repository, 'Nelyx/skia/packages/rn/licenses/skia-BSD-3-Clause.txt'),
      'licenses/Skia-BSD-3-Clause.txt',
    );
    copy(path.join(repository, 'Nelyx/licenses/react-native-LICENSE'), 'licenses/JSI-MIT.txt');
    if (sourceIdentity() !== source)
      throw Error('Android sources changed during the build; rebuild the current source');
    const manifest = {
      schema: 'nelyx.engine.v2.supply/1',
      qualification: 'host-integration-candidate',
      abi: { major: p.abiMajor, schema: p.schema },
      sourceSha256: source,
      profiles: {
        android: {
          host: 'android-standalone',
          os: 'android',
          abis,
          contentIndependent: true,
          renderer: 'Skia-Graphite-Dawn-Vulkan',
          reactNative: false,
        },
      },
      toolchains: androidPins,
      suppliers: {
        hermes: androidPins.hermes,
        skia: androidPins.skia,
        dawn: androidPins.dawn,
        files: supplierFiles,
      },
      appText: { version: 12, quotaBytes: 320 * 1024 * 1024 },
      appServices: {
        version: 2,
        methods: [
          'clipboard-read',
          'clipboard-write',
          'clipboard-has-strings',
          'semantics-tap',
          'semantics-longPress',
          'semantics-focus',
          'system-sound',
          'haptic-feedback',
        ],
        maximumTextUnits: 65536,
        maximumPending: 32,
      },
      files: files(supply)
        .sort()
        .map((name) => ({ path: name, sha256: sha256(path.join(supply, name)) })),
    };
    fs.writeFileSync(
      path.join(supply, 'engine-manifest.json'),
      JSON.stringify(manifest, null, 2) + '\n',
    );
    if (fs.existsSync(final)) await renameEngineDirectory(final, backup);
    try {
      await renameEngineDirectory(supply, final);
    } catch (error) {
      if (fs.existsSync(backup)) await renameEngineDirectory(backup, final);
      throw error;
    }
    return { directory: final, sourceSha256: source, abis };
  } finally {
    removeStaging(staged);
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  console.log(
    JSON.stringify(
      await buildAndroidSupply({
        abis: process.argv.includes('--emulator-only') ? ['x86_64'] : androidPins.abis,
      }),
      null,
      2,
    ),
  );
