// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn, spawnSync } from 'node:child_process';
import { build, stop } from 'esbuild';
import { windowsCompilerEnvironment } from '../../sdk/tooling/cli/src/windows-static-hermes.mjs';
import { engineRoot, timeout } from '../tools/build.mjs';
import { networkAssetFixture, networkAssetProbe } from './network-assets-fixture.mjs';

test(
  'Canonical network assets run actual asynchronous WinHTTP in Hermes, retain callback credit and drain',
  { timeout, skip: process.platform !== 'win32' },
  async () => {
    const repo = path.resolve(engineRoot, '../..'),
      parent = fs.realpathSync(os.tmpdir()),
      directory = fs.mkdtempSync(path.join(parent, 'engine-app-network-'));
    const fixture = networkAssetFixture();
    let server, child;
    try {
      const environment = windowsCompilerEnvironment(),
        hermes = path.join(repo, '.nelyx/windows-hermes'),
        supplier = path.join(repo, 'Nelyx/skia/vendor/inputs/windows-x64'),
        executable = path.join(directory, 'network.exe'),
        bundle = path.join(directory, 'network.js');
      await build({
        stdin: {
          contents: `import {appNetworkProbe} from ${JSON.stringify(path.join(engineRoot, 'tests/app-network-probe.mjs'))};\n${networkAssetProbe.toString()}\nappNetworkProbe(globalThis.NelyxV2Native,globalThis.__networkOrigin,networkAssetProbe).then(value=>{globalThis.__networkResult=JSON.stringify(value);},error=>{globalThis.__networkError=String(error)+'\\n'+error.stack;});`,
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
      server = createServer((request, response) => {
        if (!fixture.handle(request, response)) {
          response.writeHead(404);
          response.end();
        }
      });
      server.listen(0, '127.0.0.1');
      await once(server, 'listening');
      child = spawn(executable, [bundle, 'http://127.0.0.1:' + server.address().port], {
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
      assert.equal(code, 0, stdout + stderr);
      const result = JSON.parse(stdout);
      assert.equal(result.ledgerAfterTermination, 0);
      assert.equal(result.probe.checkpoint.requests, 16);
      assert.equal(result.probe.checkpoint.bytes, 89);
      assert.equal(result.probe.execution.networkCreditBytes, 0);
      assert.equal(result.probe.closed.reservedBytes, 917762);
      assert.equal(result.probe.closed.networkBuffers, 0);
      assert.ok(fixture.calls.some((call) => call.name === '/network/stall'));
      assert.ok(fixture.calls.every((call) => call.method === 'GET'));
      console.log(JSON.stringify({ control: 'Native-Source-NetworkAssetBundle', ...result }));
    } finally {
      if (child?.exitCode === null) {
        child.kill();
        await once(child, 'close');
      }
      fixture.close();
      if (server) {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
      }
      stop();
      assert.equal(path.dirname(path.resolve(directory)), parent);
      assert.ok(path.basename(directory).startsWith('engine-app-network-'));
      fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);
