// SPDX-License-Identifier: BSD-3-Clause
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';

const root = path.resolve(import.meta.dirname, '../..');
if (!process.argv.includes('--child')) {
  await execute(process.execPath, [import.meta.filename, '--child'], {
    cwd: root,
    timeout: 1_200_000,
  });
} else {
  const packages = {
    core: 'Nelyx',
    material: 'packages/material',
    cupertino: 'packages/cupertino',
  };
  const sources = new Map();
  for (const [name, base] of Object.entries(packages)) {
    const manifest = JSON.parse(readFileSync(path.join(root, base, 'package.json'), 'utf8'));
    for (const [key, entry] of Object.entries(manifest.exports)) {
      const file = entry.default;
      if (file?.startsWith('./dist/') && file.endsWith('.js'))
        sources.set(
          '@nelyx/' + name + key.slice(1),
          path.resolve(root, base, file.replace('./dist/', './src/').replace(/\.js$/, '.ts')),
        );
    }
  }
  const bundle = await build({
    entryPoints: [path.join(import.meta.dirname, 'calendar-interaction-fixture.mjs')],
    bundle: true,
    metafile: true,
    write: false,
    logLevel: 'silent',
    format: 'esm',
    platform: 'node',
    target: 'node24',
    loader: { '.sksl': 'text' },
    plugins: [
      {
        name: 'working-tree-source',
        setup(builder) {
          builder.onResolve({ filter: /^@nelyx\// }, (args) => {
            const file = sources.get(args.path);
            if (!file) throw Error('Missing Source mapping: ' + args.path);
            return { path: file };
          });
        },
      },
    ],
  });
  if (
    Object.keys(bundle.metafile.inputs).some((file) =>
      /(?:^|\/)(?:Nelyx|packages\/(?:material|cupertino))\/dist\//.test(file),
    )
  )
    throw Error('Calendar fixture resolved a compiled package instead of working-tree Source');
  try {
    await import(
      'data:text/javascript;base64,' +
        Buffer.from(
          bundle.outputFiles[0].text + '\n//# sourceURL=calendar-interaction-source.mjs',
        ).toString('base64')
    );
  } catch (error) {
    console.error(error.stack ?? error);
    process.exitCode = 1;
  }
}
