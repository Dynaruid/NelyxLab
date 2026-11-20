// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { verifyAppAssets } from '@nelyx/tooling-contracts/app-assets';
import { defineConfig } from '@nelyx/sdk/runtime/config';
import { supplyRunner } from './supply-runner.mjs';
import { isTemplateInput } from './template-inputs.mjs';
import { ensureDirectory, removeDirectory } from './publication.mjs';

const template = path.resolve(import.meta.dirname, '../templates/nelyx-app');
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');

export function createApp(
  destination,
  { name = 'NelyxApp', designs = ['material', 'cupertino'], packages } = {},
) {
  if (!/^[A-Z][A-Za-z0-9]*$/.test(name))
    throw new Error('App name must start with an uppercase letter and contain letters/digits');
  if (
    !Array.isArray(designs) ||
    new Set(designs).size !== designs.length ||
    designs.some((name) => !['material', 'cupertino'].includes(name))
  )
    throw new Error('Designs must select material, cupertino, both, or none');
  const target = path.resolve(destination);
  const existing = fs.lstatSync(target, { throwIfNoEntry: false });
  if (existing && (!existing.isDirectory() || fs.readdirSync(target).length))
    throw new Error('Destination must be an empty ordinary directory');
  const parent = ensureDirectory(path.dirname(target));
  const stage = fs.mkdtempSync(path.join(parent, '.nelyx-create-'));
  try {
    populateApp(stage, name, designs, packages);
    if (existing) fs.rmdirSync(target);
    try {
      fs.renameSync(stage, target);
    } catch (error) {
      if (existing && !fs.existsSync(target)) fs.mkdirSync(target);
      throw error;
    }
    return target;
  } finally {
    removeDirectory(stage, parent);
  }
}

function populateApp(target, name, designs, packages) {
  fs.cpSync(template, target, {
    recursive: true,
    filter(source) {
      const relative = path.relative(template, source);
      const top = relative.split(path.sep)[0];
      if (
        top &&
        !['assets', 'src', 'web', 'README.md', 'README.ko.md', 'tsconfig.json'].includes(top)
      )
        return false;
      if (
        !isTemplateInput(relative) ||
        ['package.json.template', 'assets/manifest.json'].includes(relative.replaceAll('\\', '/'))
      )
        return false;
      if (designs.length < 2 && relative.startsWith('src' + path.sep))
        return relative === path.join('src', 'index.ts');
      return true;
    },
  });
  const manifest = read(path.join(template, 'package.json.template'));
  const { pwa } = manifest.nelyx;
  manifest.name = name.toLowerCase();
  manifest.nelyx = defineConfig({
    ...manifest.nelyx,
    name,
    displayName: name,
    pwa: { ...pwa, id: '/apps/' + name.toLowerCase(), shortName: name },
  });
  verifyAppAssets(target, manifest.nelyx.assets);
  write(path.join(target, 'package.json'), manifest);

  const runnerFile = path.join(target, 'web/runner/package.json');
  const runner = read(runnerFile);
  runner.name = manifest.name + '-web-runner';
  for (const design of ['material', 'cupertino']) {
    if (!designs.includes(design)) delete runner.dependencies['@nelyx/' + design];
  }
  write(runnerFile, runner);
  const sourceRoot = path.join(target, 'src');
  if (designs.length < 2) {
    if (path.dirname(sourceRoot) !== target || fs.lstatSync(sourceRoot).isSymbolicLink())
      throw new Error('Generated source owner differs');
    const design = designs[0];
    const importDesign =
      design === 'material'
        ? "import {MaterialApp,Scaffold} from '@nelyx/material/widgets';\n"
        : design === 'cupertino'
          ? "import {CupertinoTheme,CupertinoPageScaffold} from '@nelyx/cupertino/widgets';\n"
          : '';
    const body =
      design === 'material'
        ? 'new MaterialApp({home:new Scaffold({body:new Text(state.initialText)})})'
        : design === 'cupertino'
          ? "new CupertinoTheme(new CupertinoPageScaffold('Nelyx',new Text(state.initialText)))"
          : 'new DecoratedBox(new Padding(allInsets(24),new Text(state.initialText,{color:0xffe5e7eb})),0xff101827)';
    fs.writeFileSync(
      path.join(sourceRoot, 'app.ts'),
      `// SPDX-License-Identifier: BSD-3-Clause
import type { ApplicationDefinition } from '@nelyx/core/hosting/runtime';
import { defineApp } from '@nelyx/sdk/app';
import { Text, DecoratedBox, Padding } from '@nelyx/core/framework/widgets/basic';
import { Directionality } from '@nelyx/core/framework/widgets/app-data';
import { allInsets } from '@nelyx/core/ui/geometry';
${importDesign}
export interface ApplicationState { readonly initialText: string }

export function createApplicationState(): ApplicationState {
  return { initialText: 'Hello Nelyx' };
}

export function defineApplication(state: ApplicationState): ApplicationDefinition {
  return defineApp({
    id: 'nelyx.generated',
    defaultFont: 'sample-font',
    createRoot: () => new Directionality('ltr', ${body}),
  });
}
`,
    );
  }
  const entry = path.join(sourceRoot, 'index.ts');
  fs.writeFileSync(
    entry,
    fs.readFileSync(entry, 'utf8').replace("'NelyxTestbed'", JSON.stringify(name)),
  );

  if (packages) supplyRunner({ app: target, packages });
}
