// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { engineRoot, sourceIdentity } from './build.mjs';
import { prepareRepositoryAppPackages } from '../../eng/prepare-app-packages.mjs';

export function createHostServer(directory = path.join(engineRoot, 'dist')) {
  const root = fs.realpathSync(directory);
  return http.createServer((request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost'),
        isolated = url.pathname.startsWith('/isolated/');
      if (!isolated && !url.pathname.startsWith('/plain/')) {
        response.writeHead(302, { location: '/isolated/' + url.search });
        response.end();
        return;
      }
      const relative = decodeURIComponent(url.pathname.slice(isolated ? 10 : 7)) || 'index.html';
      const target = path.resolve(root, relative),
        file = fs.realpathSync(target);
      if (!file.startsWith(root + path.sep) || !fs.statSync(file).isFile())
        throw new Error('Invalid asset path');
      const mime =
        {
          '.html': 'text/html; charset=utf-8',
          '.js': 'application/javascript',
          '.mjs': 'application/javascript',
          '.json': 'application/json',
          '.wasm': 'application/wasm',
          '.ttf': 'font/ttf',
          '.webp': 'image/webp',
        }[path.extname(file)] ?? 'application/octet-stream';
      response.writeHead(200, {
        'Content-Type': mime,
        'Cache-Control': 'no-store',
        'Cross-Origin-Resource-Policy': 'same-origin',
        ...(isolated
          ? {
              'Cross-Origin-Opener-Policy': 'same-origin',
              'Cross-Origin-Embedder-Policy': 'require-corp',
            }
          : {}),
      });
      fs.createReadStream(file).pipe(response);
    } catch {
      response.writeHead(404);
      response.end('Asset unavailable');
    }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const supply = path.join(engineRoot, 'dist');
  if (
    JSON.parse(fs.readFileSync(path.join(supply, 'engine-manifest.json'))).sourceSha256 !==
    sourceIdentity()
  )
    throw Error('Engine v2 supply is stale; run npm.cmd run build:engine-v2');
  prepareRepositoryAppPackages();
  const { buildEngineV2Application, createEngineV2Server, verifyEngineV2Application } =
    await import('../../sdk/tooling/cli/src/engine-v2-runner.mjs');
  const app = path.resolve(engineRoot, '../../sample/nelyx-testbed-app-2/engine-v2');
  const built = await buildEngineV2Application({ app, target: 'web' });
  const server = createEngineV2Server(verifyEngineV2Application(built.directory, 'web'));
  const port = Number(process.env.PORT ?? 8192);
  server.listen(port, '127.0.0.1', () =>
    console.log(
      `Engine v2: http://127.0.0.1:${port}/isolated/ (threaded auto), /plain/ (single-worker auto)`,
    ),
  );
}
