// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { resolveTypeScriptCompiler } from '../sdk/tooling/contracts/src/typescript-compiler.cjs';
import { verifyPackageSourceInputs } from './package-source-inputs.mjs';
import { verifyEngineV2Supply } from '../sdk/tooling/cli/src/engine-v2-runner.mjs';
const root = path.resolve(import.meta.dirname, '../..');
const parent = path.join(root, '.nelyx');
fs.mkdirSync(parent, { recursive: true });
const temporary = fs.mkdtempSync(path.join(parent, 'w10-installed-'));
const checked = fs.realpathSync(temporary);
if (!checked.startsWith(fs.realpathSync(parent) + path.sep))
  throw Error('Consumer escaped its owner');
function run(command, args, cwd = temporary) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 1_200_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error || result.status)
    throw Error(`${command}: ${result.error ?? result.status}\n${result.stdout}${result.stderr}`);
  return result.stdout;
}
function npm(args, cwd) {
  return process.platform === 'win32'
    ? run('cmd.exe', ['/d', '/c', 'npm.cmd', ...args], cwd)
    : run('npm', args, cwd);
}
function cleanup() {
  if (fs.existsSync(temporary) && fs.realpathSync(temporary) !== checked)
    throw Error('Consumer cleanup target changed');
  fs.rmSync(checked, { recursive: true, force: true });
}
try {
  verifyPackageSourceInputs(path.join(root, 'Nelyx'));
  verifyEngineV2Supply(path.join(root, 'Nelyx/engine/dist'), 'web');
  const packed = JSON.parse(
    npm(
      [
        'pack',
        '--workspace',
        '@nelyx/core',
        '--ignore-scripts',
        '--json',
        '--pack-destination',
        temporary,
      ],
      root,
    ),
  );
  const archive = path.join(temporary, packed[0].filename);
  fs.writeFileSync(
    path.join(temporary, 'package.json'),
    JSON.stringify({
      private: true,
      type: 'module',
      dependencies: { '@nelyx/core': 'file:' + archive },
    }),
  );
  npm([
    'install',
    '--offline',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    '--package-lock=false',
  ]);
  const installed = path.join(temporary, 'node_modules/@nelyx/core');
  if (
    fs.lstatSync(installed).isSymbolicLink() ||
    !fs.realpathSync(installed).startsWith(checked + path.sep)
  )
    throw Error('Consumer resolved a repository package link');
  const factoryUrl = pathToFileURL(
    path.join(root, 'Nelyx/engine/dist/single-worker/engine.mjs'),
  ).href;
  fs.writeFileSync(
    path.join(temporary, 'consumer.mts'),
    `
    import { EngineClient, WidgetHost, GlobalKey, Box, commands, protocol, createWasmTransport } from '@nelyx/core/v2';
    const moduleUrl:string=${JSON.stringify(factoryUrl)};
    const factory=(await import(moduleUrl)).default;
    const client=await EngineClient.connect(createWasmTransport(await factory()));
    try {
      const view=await client.openView(1);
      const writer=new WidgetHost(view,{pollEvents:false});
      const reference=new GlobalKey();
      await writer.mount(new Box([],{color:1,key:reference}));
      const handle=reference.currentNode!;
      await view.commit([commands.paint(handle,2),commands.paint(handle,3)]);
      const state=await view.inspectState();
      if(state.transactionCost.nodeClones!==1n || state.transactionCost.childLists!==0n || state.transactionCost.fullValidations!==0n)
        throw Error('Installed consumer did not use the shared transaction implementation');
      const snapshot=await view.request(protocol.opcodes.layoutSnapshot);
      if(snapshot.status!==protocol.statuses.notFound && snapshot.status!==protocol.statuses.ok)throw Error('Installed observation failed');
      await writer.close();await view.close();await client.close();
      console.log('Installed Core: strict declarations, package-only imports, scene commit, shared transaction and clean close PASS.');
    } finally { await client.abort(); }
  `,
  );
  run(process.execPath, [
    resolveTypeScriptCompiler(root, '@typescript/native').entry,
    'consumer.mts',
    '--strict',
    '--skipLibCheck',
    '--module',
    'NodeNext',
    '--moduleResolution',
    'NodeNext',
    '--target',
    'ES2022',
    '--outDir',
    'out',
  ]);
  console.log(run(process.execPath, [path.join(temporary, 'out/consumer.mjs')]).trim());
} finally {
  cleanup();
}
