// SPDX-License-Identifier: BSD-3-Clause
import { build } from 'esbuild';
import path from 'node:path';
import { elementConstructionFixture } from './element-construction-fixture.mjs';
import { verifyPackageSourceInputs } from './package-source-inputs.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const watchdog = setTimeout(() => {
  throw Error('Element construction checks exceeded 20 minutes');
}, 1_200_000);
try {
  verifyPackageSourceInputs(path.join(root, 'Nelyx'));
  const result = await build({
    stdin: {
      resolveDir: root,
      loader: 'ts',
      contents: `
        import {BuildOwner,ComponentElement,StatefulElement,ProxyElement,InheritedElement,State,StatelessWidget,StatefulWidget,InheritedWidget} from '@nelyx/core/framework/widgets/framework';
        import {SizedBox} from '@nelyx/core/framework/widgets/basic';
        ${elementConstructionFixture()}
        console.log('Element construction: 30 arity/superclass/new.target cases, descriptors, opaque arguments, iterator isolation, exceptions and real State lifecycle PASS.');
      `,
    },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    tsconfigRaw: { compilerOptions: { useDefineForClassFields: true } },
    alias: { '@nelyx/core': path.join(root, 'Nelyx/dist') },
    logLevel: 'silent',
  });
  await import(
    'data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].contents).toString('base64')
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  clearTimeout(watchdog);
}
