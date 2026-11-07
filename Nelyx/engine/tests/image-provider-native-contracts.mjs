// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn, spawnSync } from 'node:child_process';
import { build, stop } from 'esbuild';
import { windowsCompilerEnvironment } from '../../sdk/tooling/cli/src/windows-static-hermes.mjs';
import { engineRoot, timeout } from '../tools/build.mjs';
import { imageFixture } from './app-images-probe.mjs';
import { providerHttpFixture } from './image-provider-fixture.mjs';

export function imageProviderNativeContracts() {
  test(
    'Canonical providers use actual Hermes/SkCodec/file/WinHTTP owners, share cache work, report progress and drain cancellation/redirect callbacks',
    { timeout, skip: process.platform !== 'win32' },
    async () => {
      const repo = path.resolve(engineRoot, '../..'),
        parent = fs.realpathSync(os.tmpdir()),
        directory = fs.mkdtempSync(path.join(parent, 'engine-image-providers-')),
        fixture = providerHttpFixture(),
        servers = [];
      let child;
      try {
        for (let i = 0; i < 2; ++i) {
          const server = createServer((request, response) => {
            if (!fixture.handle(request, response)) {
              response.writeHead(404);
              response.end();
            }
          });
          server.listen(0, '127.0.0.1');
          await once(server, 'listening');
          servers.push(server);
        }
        const origin = 'http://127.0.0.1:' + servers[0].address().port;
        fixture.setCrossOrigin('http://127.0.0.1:' + servers[1].address().port);
        const environment = windowsCompilerEnvironment(),
          hermes = path.join(repo, '.nelyx/windows-hermes'),
          supplier = path.join(repo, 'Nelyx/skia/vendor/inputs/windows-x64'),
          executable = path.join(directory, 'providers.exe'),
          bundle = path.join(directory, 'providers.js'),
          file = path.join(directory, 'image.png');
        fs.writeFileSync(file, Buffer.from(imageFixture.png, 'base64'));
        await build({
          stdin: {
            contents: `import {imageProviderProbe} from ${JSON.stringify(path.join(engineRoot, 'tests/image-provider-probe.mjs'))};
import {nativeAppTextBackend} from '@nelyx/core/v2';
imageProviderProbe(nativeAppTextBackend(globalThis.NelyxV2Native),new Uint8Array(${JSON.stringify([...Buffer.from(imageFixture.png, 'base64')])}),new Uint8Array(${JSON.stringify([...Buffer.from(imageFixture.gif, 'base64')])}),globalThis.__networkOrigin,${JSON.stringify(pathToFileURL(file).href)}).then(value=>{globalThis.__networkResult=JSON.stringify(value);},error=>{globalThis.__networkError=String(error)+'\\n'+error.stack;});`,
            resolveDir: repo,
          },
          outfile: bundle,
          bundle: true,
          format: 'iife',
          target: 'es2022',
          platform: 'browser',
          logLevel: 'silent',
        });
        const compiled = spawnSync(
          'cl.exe',
          [
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
            path.join(engineRoot, 'tests/windows-app-network.cpp'),
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
          ],
          {
            cwd: directory,
            env: environment,
            encoding: 'utf8',
            timeout,
            windowsHide: true,
            maxBuffer: 1024 * 1024,
          },
        );
        if (compiled.error) throw compiled.error;
        assert.equal(compiled.status, 0, compiled.stdout + compiled.stderr);
        child = spawn(executable, [bundle, origin, directory], {
          cwd: directory,
          env: {
            ...environment,
            PATH: path.join(hermes, 'build/lib') + path.delimiter + environment.PATH,
          },
          windowsHide: true,
        });
        let stdout = '',
          stderr = '';
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', (chunk) => {
          stdout += chunk;
        });
        child.stderr.on('data', (chunk) => {
          stderr += chunk;
        });
        const [code] = await once(child, 'close');
        assert.equal(code, 0, stdout + stderr + '\nHTTP calls: ' + JSON.stringify(fixture.calls));
        const result = JSON.parse(stdout);
        assert.equal(result.ledgerAfterTermination, 0);
        assert.equal(result.probe.execution.tsFallbacks, 0);
        assert.equal(result.probe.execution.backend.frames, 0);
        assert.equal(result.probe.buffers.nativeFileReads, 1);
        assert.equal(
          result.probe.buffers.nativeFileBytes,
          Buffer.from(imageFixture.png, 'base64').length,
        );
        const redirected = fixture.calls.filter((call) => call.path === '/provider/redirected');
        assert.equal(redirected.length, 2);
        assert.equal(redirected[0].headers.authorization, 'Bearer fixture');
        assert.equal(redirected[1].headers.authorization, undefined);
        assert.equal(redirected[0].headers.cookie, 'session=fixture');
        assert.equal(redirected[1].headers.cookie, undefined);
        assert.ok(fixture.calls.some((call) => call.url === '/provider/chunks?source=provider'));
        assert.ok(redirected.every((call) => call.headers['x-nelyx-image'] === 'fixture'));
        console.log(JSON.stringify({ control: 'Native-ImageProvider-ownership', ...result }));
      } finally {
        const cleanup = await Promise.allSettled([
          (async () => {
            if (child?.exitCode === null) {
              child.kill();
              await once(child, 'close');
            }
          })(),
          (async () => fixture.close())(),
          ...servers.map(async (server) => {
            server.closeAllConnections();
            await new Promise((resolve) => server.close(resolve));
          }),
        ]);
        try {
          stop();
        } finally {
          assert.equal(path.dirname(path.resolve(directory)), parent);
          assert.ok(path.basename(directory).startsWith('engine-image-providers-'));
          fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3 });
        }
        const errors = cleanup
          .filter((value) => value.status === 'rejected')
          .map((value) => value.reason);
        assert.deepEqual(errors, [], 'Image provider Native cleanup failed');
      }
    },
  );
}
