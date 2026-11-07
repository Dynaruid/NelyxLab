import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { buildWeb } from '@nelyx/metro/web-build';
import { configureRunner } from '@nelyx/cli/runner-configuration';
const app = path.resolve(import.meta.dirname, '../..'),
  require = createRequire(import.meta.url);
await configureRunner({ app, target: 'web' });
const config = await require('./metro.config.cjs');
const output = path.resolve(process.argv[2] ?? path.join(app, '.nelyx/web'));
const ownedOutput = path.join(app, '.nelyx/web');
const clean = () => {
  if (output !== ownedOutput || path.dirname(output) !== path.join(app, '.nelyx')) return;
  if (fs.existsSync(output)) {
    if (
      fs.lstatSync(output).isSymbolicLink() ||
      fs.realpathSync(path.dirname(output)) !== path.dirname(output)
    )
      throw Error('Web output owner differs');
    fs.rmSync(output, { recursive: true, force: true });
  }
};
clean();
let result;
try {
  result = await buildWeb({
    config,
    entry: 'main.ts',
    outputDirectory: output,
    assetsDirectory: path.join(app, 'assets'),
    runtimeDirectory: process.env.NELYX_WEB_RUNTIME_ROOT,
  });
} catch (error) {
  clean();
  throw error;
}
console.log(
  JSON.stringify({ result: 'PASS-scoped', scope: 'Metro-Ganesh-WebGL2-static-build', ...result }),
);
