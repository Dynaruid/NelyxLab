import path from 'node:path';
import { createRequire } from 'node:module';
import { buildWeb } from '@nelyx/metro/web-build';
import { configureRunner } from '@nelyx/cli/runner-configuration';
const app = path.resolve(import.meta.dirname, '../..'),
  require = createRequire(import.meta.url);
await configureRunner({ app, target: 'web' });
const config = await require('./metro.config.cjs');
const result = await buildWeb({
  config,
  entry: 'main.ts',
  outputDirectory: path.resolve(process.argv[2] ?? path.join(app, '.nelyx/web')),
  assetsDirectory: path.join(app, 'assets'),
  runtimeDirectory: process.env.NELYX_WEB_RUNTIME_ROOT,
});
console.log(
  JSON.stringify({ result: 'PASS-scoped', scope: 'Metro-Ganesh-WebGL2-static-build', ...result }),
);
