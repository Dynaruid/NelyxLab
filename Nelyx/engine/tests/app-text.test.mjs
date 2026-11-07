// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { build, stop } from 'esbuild';
import { createRequire } from 'node:module';
import { windowsCompilerEnvironment } from '../../sdk/tooling/cli/src/windows-static-hermes.mjs';
import { engineRoot, timeout } from '../tools/build.mjs';
import { canvasKitTestSupply } from './canvaskit-supply.mjs';
import { CanvasKitProvider } from '../render/canvaskit-web/provider.ts';
import { AppTextBudget, WebAppTextBackend } from '../platform/web/app-text.ts';
import { appTextQuotaBytes } from '../../runtime/engine-client/app-text.ts';
import { appTextProbe } from './app-text-probe.mjs';
import { appFontProbe } from './app-font-probe.mjs';
import { appBuffersProbe } from './app-buffers-probe.mjs';
import ts from 'typescript';

test(
  'App font and asset credits reject another owner even when both owners hold live credit',
  { timeout },
  () => {
    const make = () => {
        const budget = new AppTextBudget(appTextQuotaBytes);
        return new WebAppTextBackend(
          {
            counters: { paragraphLayouts: 0, dynamicFontLoads: 0, heapBytes: 0 },
            close: () => budget.close(),
          },
          budget,
        );
      },
      a = make(),
      b = make(),
      first = a.reserveFontBytes(65536),
      second = b.reserveFontBytes(65536),
      assetFirst = a.reserveAssetBytes(7),
      assetSecond = b.reserveAssetBytes(7);
    try {
      assert.throws(() => b.releaseFontBytes(first), /foreign/);
      assert.throws(() => a.releaseFontBytes(second), /foreign/);
      assert.equal(a.snapshot().fontBuffers, 1);
      assert.equal(b.snapshot().fontBuffers, 1);
      assert.notEqual(first, assetFirst);
      assert.throws(() => a.finishAssetLoad(first, false), /foreign/);
      assert.throws(() => a.releaseFontBytes(assetFirst), /foreign/);
      assert.throws(() => a.finishAssetLoad(assetSecond, false), /foreign/);
      assert.throws(() => b.finishAssetLoad(assetFirst, false), /foreign/);
      a.finishAssetLoad(assetFirst, true);
      assert.throws(() => a.finishAssetLoad(assetFirst, false), /delivered/);
    } finally {
      if (a.snapshot().fontBuffers) a.releaseFontBytes(first);
      if (b.snapshot().fontBuffers) b.releaseFontBytes(second);
      b.finishAssetLoad(assetSecond, false);
      a.close();
      b.close();
      assert.equal(a.snapshot().assetBuffers, 1);
      assert.equal(a.snapshot().reservedBytes, 3 * 7 + 65536);
    }
  },
);

test(
  'Both isolated SDK App entries need no Native DOM ambient declarations and Web keeps exact browser and AbortSignal types',
  { timeout },
  () => {
    const filename = path.resolve(engineRoot, '../../__nelyx_text_consumer__.mts');
    for (const target of ['windows', 'web']) {
      const code = `import {defineOriginalEngineV2App} from '@nelyx/sdk/engine-v2-original';
import {TextPainter} from '@nelyx/core/framework/painting/text-painter';
import {defineEngineV2App,createBrowserEngineV2Surface} from '@nelyx/sdk/engine-v2';
import type {EngineBrowserSurface} from '@nelyx/sdk/engine-v2';
import type {ListBuildSignal} from '@nelyx/core/v2';
export {defineOriginalEngineV2App,defineEngineV2App,TextPainter};
type Same<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
export const canvasExact:Same<Parameters<typeof createBrowserEngineV2Surface>[0],${target === 'web' ? 'HTMLCanvasElement' : 'never'}>=true;
export const rootExact:Same<Parameters<typeof createBrowserEngineV2Surface>[1]['root'],${target === 'web' ? 'URL' : 'never'}>=true;
export const workerExact:Same<Parameters<EngineBrowserSurface['createAppPort']>[0],${target === 'web' ? 'Worker|undefined' : 'undefined'}>=true;
export const portExact:Same<ReturnType<EngineBrowserSurface['createAppPort']>,${target === 'web' ? 'MessagePort' : 'never'}>=true;
export function signal(value:ListBuildSignal){const result:${target === 'web' ? 'AbortSignal | undefined' : 'undefined'}=value.nativeSignal;${target === 'web' ? "void fetch('/fixture',{signal:result});" : ''}return result;}`;
      const options = {
        strict: true,
        noEmit: true,
        skipLibCheck: false,
        types: [],
        lib: target === 'web' ? ['lib.es2022.d.ts', 'lib.dom.d.ts'] : ['lib.es2022.d.ts'],
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
      };
      const host = ts.createCompilerHost(options),
        read = host.getSourceFile.bind(host);
      host.getSourceFile = (file, language, onError, create) =>
        path.resolve(file) === filename
          ? ts.createSourceFile(file, code, language, true)
          : read(file, language, onError, create);
      const errors = ts
        .getPreEmitDiagnostics(ts.createProgram([filename], options, host))
        .filter((error) => error.category === ts.DiagnosticCategory.Error);
      assert.deepEqual(
        errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, ' ')),
        [],
        target,
      );
    }
  },
);

function linearMemoryLimits(bytes) {
  assert.deepEqual(Array.from(bytes.subarray(0, 8)), [0, 97, 115, 109, 1, 0, 0, 0]);
  let position = 8;
  const read = () => {
    let value = 0,
      shift = 0;
    for (;;) {
      const byte = bytes[position++];
      assert.ok(byte !== undefined && shift <= 28, 'Bounded Wasm section integer');
      value += (byte & 127) * 2 ** shift;
      if (!(byte & 128)) return value;
      shift += 7;
    }
  };
  while (position < bytes.length) {
    const section = bytes[position++],
      size = read(),
      end = position + size;
    assert.ok(end <= bytes.length);
    if (section === 5) {
      assert.equal(read(), 1, 'One private owned provider memory');
      assert.equal(read(), 1, 'Unshared memory with an explicit hard maximum');
      return { initial: read() * 65536, maximum: read() * 65536 };
    }
    position = end;
  }
  throw Error('Provider binary has no owned memory declaration');
}

test(
  'Canonical synchronous TextPainter uses actual App-owned C++ in Hermes and drains',
  { timeout, skip: process.platform !== 'win32' },
  async () => {
    const repo = path.resolve(engineRoot, '../..'),
      supplier = path.join(repo, 'Nelyx/skia/vendor/inputs/windows-x64'),
      parent = fs.realpathSync(os.tmpdir()),
      directory = fs.mkdtempSync(path.join(parent, 'engine-app-text-'));
    try {
      const environment = windowsCompilerEnvironment(),
        hermes = path.join(repo, '.nelyx/windows-hermes'),
        executable = path.join(directory, 'app-text.exe'),
        bundle = path.join(directory, 'probe.js');
      await build({
        stdin: {
          contents: `import {appTextProbe} from ${JSON.stringify(path.join(engineRoot, 'tests/app-text-probe.mjs'))};
import {appFontProbe} from ${JSON.stringify(path.join(engineRoot, 'tests/app-font-probe.mjs'))};
import {appAssetsProbe} from ${JSON.stringify(path.join(engineRoot, 'tests/app-assets-probe.mjs'))};
import {appBuffersProbe} from ${JSON.stringify(path.join(engineRoot, 'tests/app-buffers-probe.mjs'))};
import font from ${JSON.stringify(path.join(engineRoot, 'dist/assets/NotoSansHebrew.ttf'))};
import {nativeAppTextBackend} from '@nelyx/core/v2';
for(const version of [undefined,0,1,2,3,4,5,6,7,8,9,10,11]){let rejected=false;try{nativeAppTextBackend({appTextVersion:version,appText:globalThis.NelyxV2Native.appText});}catch{rejected=true;}if(!rejected)throw Error('Missing requested App text capability was accepted');}
const result=appTextProbe(nativeAppTextBackend(globalThis.NelyxV2Native));
result.fonts=appFontProbe(nativeAppTextBackend(globalThis.NelyxV2Native),font);
appAssetsProbe(nativeAppTextBackend(globalThis.NelyxV2Native)).then(async assets=>{result.assets=assets;result.buffers=await appBuffersProbe(nativeAppTextBackend(globalThis.NelyxV2Native),{filePath:globalThis.__bufferFilePath});globalThis.__appTextResult=JSON.stringify(result);},error=>{globalThis.__appTextError=String(error);}).catch(error=>{globalThis.__appTextError=String(error);});`,
          resolveDir: repo,
        },
        outfile: bundle,
        bundle: true,
        format: 'iife',
        target: 'es2022',
        platform: 'browser',
        logLevel: 'silent',
        loader: { '.ttf': 'binary' },
      });
      const run = (file, args) => {
        const result = spawnSync(file, args, {
          cwd: directory,
          env: {
            ...environment,
            PATH: path.join(hermes, 'build/lib') + path.delimiter + environment.PATH,
          },
          encoding: 'utf8',
          timeout,
          windowsHide: true,
          maxBuffer: 1024 * 1024,
        });
        if (result.error) throw result.error;
        assert.equal(result.status, 0, result.stdout + result.stderr);
        return result.stdout;
      };
      run('cl.exe', [
        '/nologo',
        '/std:c++20',
        '/EHsc',
        '/MD',
        '/utf-8',
        '/DNOMINMAX',
        '/DWIN32_LEAN_AND_MEAN',
        ...[
          path.join(supplier, 'headers'),
          path.join(hermes, 'source/API'),
          path.join(hermes, 'source/API/jsi'),
          path.join(hermes, 'source/public'),
          path.join(repo, 'Nelyx/skia/native/core'),
        ].map((file) => '/I' + file),
        path.join(engineRoot, 'tests/windows-app-text.cpp'),
        path.join(repo, 'Nelyx/skia/native/platforms/windows/font_services.cpp'),
        path.join(repo, 'Nelyx/skia/native/core/paragraph_queries.cpp'),
        '/Fe' + executable,
        '/link',
        path.join(engineRoot, 'dist/native/nelyx_engine_v2.lib'),
        path.join(hermes, 'build/lib/hermesvm.lib'),
        ...fs
          .readdirSync(path.join(supplier, 'libraries'))
          .filter((file) => file.endsWith('.lib'))
          .map((file) => path.join(supplier, 'libraries', file)),
        'dwrite.lib',
        'gdi32.lib',
        'user32.lib',
        'advapi32.lib',
        'ole32.lib',
        'oleaut32.lib',
        'uuid.lib',
        'uiautomationcore.lib',
      ]);
      fs.writeFileSync(path.join(directory, 'text.txt'), 'hello 한글');
      fs.writeFileSync(path.join(directory, 'data.json'), '{"value":2}');
      fs.writeFileSync(path.join(directory, '한글 data.bin'), Buffer.from([1, 2, 3]));
      fs.writeFileSync(path.join(directory, 'empty.bin'), '');
      const result = JSON.parse(
        run(executable, [bundle, path.join(engineRoot, 'dist'), directory]),
      );
      assert.equal(result.assets.callerBytesRetained, true);
      assert.equal(result.assets.execution.nativeReads, result.assets.execution.reads);
      assert.ok(result.assets.closed.assetBuffers > 0 && result.assets.closed.assetBufferBytes > 0);
      console.log('Native App assets and retained ByteData', JSON.stringify(result.assets));
      assert.equal(result.buffers.execution.copies, result.buffers.execution.nativeCopies);
      assert.equal(result.buffers.execution.creditBytes, 0);
      assert.equal(result.buffers.closed.reservedBytes, result.assets.closed.assetBufferBytes);
      assert.equal(result.buffers.execution.nativeFileReads, 4);
      console.log('Native App immutable buffers', JSON.stringify(result.buffers));
      assert.equal(result.closed.closed, true);
      assert.equal(result.closed.reservedBytes, 0);
      assert.equal(result.nativeFonts.fontLoads, 2);
      assert.ok(
        result.nativeFonts.measurements >= 6 &&
          result.nativeFonts.layouts > 0 &&
          result.nativeFonts.coreWork > 0,
      );
      assert.ok(
        result.nativeFonts.reusedParagraphs >= 2 &&
          result.nativeFonts.inkPixels > 10 &&
          result.nativeFonts.retainedInk > 10,
      );
      assert.equal(result.nativeFonts.pixelDiff, 0);
      console.log('Native Core font resources CPU pixels', JSON.stringify(result.nativeFonts));
      assert.equal(result.fonts.closed.reservedBytes, 0);
      assert.equal(result.fonts.closed.fontCatalogs, 0);
      console.log('Native App immutable font generations', JSON.stringify(result.fonts));
      assert.equal(result.nativeContent.measurements, 9);
      assert.equal(result.nativeContent.richParagraphs, 2);
      assert.ok(result.nativeContent.richInkPixels > 100);
      assert.equal(result.nativeContent.richPixelDiff, 0);
      assert.ok(result.nativeContent.shadowOutsidePixels > 10);
      assert.equal(result.nativeContent.extraParagraphs, 3);
      assert.equal(result.nativeContent.extraPixelDiff, 0);
      assert.equal(result.nativeContent.placeholderBoxes, 18);
      assert.ok(result.nativeContent.extraInkPixels > 10);
      assert.equal(result.nativeInline.measurements, 32);
      assert.ok(result.nativeInline.layouts > 0 && result.nativeInline.coreWork > 0);
      assert.ok(result.nativeInline.placeholderBoxes > 7 && result.nativeInline.hiddenChildren > 0);
      assert.equal(result.nativeInline.pixelDiff, 0);
      assert.ok(result.nativeInline.inkPixels > 100);
      assert.equal(result.nativeContent.pathPaints, 2);
      assert.ok(result.nativeContent.pathInkPixels > 100);
      assert.equal(result.nativeContent.pathColor, 0xff93a3b7);
      assert.ok(result.nativeContent.livePaintWork > 0);
      assert.equal(result.nativeContent.livePaints, 2);
      assert.ok(result.nativeContent.liveInkPixels > 100);
      assert.ok(result.nativeContent.orderedWork > 0);
      assert.equal(result.nativeContent.orderedParagraphs, 4);
      assert.equal(result.nativeContent.foregroundPaints, 2);
      assert.equal(result.nativeContent.orderedPixelDiff, 0);
      assert.ok(result.nativeContent.orderedInkPixels > 10);
      assert.ok(
        result.nativeContent.layouts > 0 &&
          result.nativeContent.paragraphs === 9 &&
          result.nativeContent.inkPixels > 10,
      );
      console.log(
        'Native Content copied paragraph CPU pixels',
        JSON.stringify(result.nativeContent),
      );
      console.log('Native App C++ text', JSON.stringify(result.execution));
      console.log('Native Core inline CPU pixels', JSON.stringify(result.nativeInline));
    } finally {
      stop();
      assert.equal(path.dirname(directory), parent);
      fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);

test(
  'Canonical synchronous TextPainter uses the owned CanvasKit heap with bounded accounting',
  { timeout },
  async () => {
    const require = createRequire(import.meta.url),
      supply = canvasKitTestSupply(),
      ck = await require(supply.js)({ wasmBinary: fs.readFileSync(supply.wasm) }),
      root = path.join(engineRoot, 'dist'),
      manifest = JSON.parse(fs.readFileSync(path.join(root, 'engine-manifest.json'))),
      fonts = manifest.fonts.map((font) => ({
        id: font.path,
        family: font.family,
        bytes: new Uint8Array(fs.readFileSync(path.join(root, font.path))),
      })),
      budget = new AppTextBudget(appTextQuotaBytes),
      provider = new CanvasKitProvider(ck, fonts, budget),
      backend = new WebAppTextBackend(provider, budget);
    assert.deepEqual(linearMemoryLimits(fs.readFileSync(supply.wasm)), {
      initial: 128 * 1024 * 1024,
      maximum: 256 * 1024 * 1024,
    });
    assert.equal(ck.HEAPU8.byteLength, 128 * 1024 * 1024);
    const bufferResult = await appBuffersProbe(backend, {
      closeBackend: false,
      transport: async (_backend, key) => {
        const data =
          key === '한글 data.bin'
            ? new Uint8Array([1, 2, 3])
            : key === 'empty.bin'
              ? new Uint8Array()
              : null;
        if (!data) throw Error('Missing fixture');
        return {
          size: data.length,
          async read() {
            return data.slice();
          },
          close() {},
        };
      },
    });
    console.log('Web App immutable buffers', JSON.stringify(bufferResult));
    const originalArray = globalThis.Uint8Array,
      transient = backend.createBuffer(new Uint8Array([1, 2, 3]));
    let reentered = false;
    try {
      globalThis.Uint8Array = class extends originalArray {
        constructor(input, ...rest) {
          if (!reentered && input instanceof originalArray && input.length === 3) {
            reentered = true;
            backend.releaseBuffer(transient.handle);
            assert.equal(backend.snapshot().immutableBuffers, 0);
            assert.equal(backend.snapshot().immutableBufferBytes, 65542);
            assert.throws(() => backend.close(), /live handles\/readers/);
            assert.throws(
              () => backend.createBuffer(new globalThis.Uint8Array(32 * 1024 * 1024)),
              /budget/,
            );
          }
          super(input, ...rest);
        }
      };
      assert.deepEqual([...backend.bufferChunk(transient.handle, 0, 3)], [1, 2, 3]);
      assert.equal(reentered, true);
    } finally {
      globalThis.Uint8Array = originalArray;
      if (!reentered) backend.releaseBuffer(transient.handle);
    }
    assert.equal(backend.snapshot().immutableBufferBytes, 0);
    const result = appTextProbe(backend);
    assert.equal(result.closed.closed, true);
    assert.equal(result.closed.paragraphs, 0);
    assert.equal(
      result.closed.reservedBytes,
      result.closed.heapBytes,
      'Committed Wasm memory remains charged after deleting paragraphs/fonts',
    );
    assert.ok(result.closed.heapBytes > 0 && result.closed.heapBytes <= 256 * 1024 * 1024);
    assert.throws(() => budget.reserve(2, 1), /closed/);
    const fontBudget = new AppTextBudget(appTextQuotaBytes),
      fontBackend = new WebAppTextBackend(new CanvasKitProvider(ck, fonts, fontBudget), fontBudget),
      fontResult = appFontProbe(
        fontBackend,
        fonts.find((font) => font.family === 'NelyxHebrew').bytes,
      );
    assert.equal(fontResult.closed.fontCatalogs, 0);
    assert.equal(fontResult.closed.reservedBytes, fontResult.closed.heapBytes);
    console.log('Web App immutable font generations', JSON.stringify(fontResult));
    const policy = new AppTextBudget(appTextQuotaBytes);
    policy.set(1, 128 * 1024 * 1024);
    const release = policy.reserve(2, 64 * 1024 * 1024),
      before = policy.bytes;
    assert.throws(() => policy.reserve(4, 1), /quota/);
    assert.equal(policy.bytes, before, 'Admission reserves future maximum heap before C++ runs');
    policy.set(1, 256 * 1024 * 1024);
    assert.throws(() => policy.set(1, 256 * 1024 * 1024 + 65536), /quota/);
    release();
    policy.close();
    console.log('Web App C++ text', JSON.stringify(result.execution));
  },
);
