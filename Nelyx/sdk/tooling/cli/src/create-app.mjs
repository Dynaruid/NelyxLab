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
  {
    name = 'NelyxApp',
    designs = ['material', 'cupertino'],
    packages,
    target: buildTarget = 'both',
    staticWeb = false,
    noBackend = false,
  } = {},
) {
  if (!/^[A-Z][A-Za-z0-9]*$/.test(name))
    throw new Error('App name must start with an uppercase letter and contain letters/digits');
  if (
    !Array.isArray(designs) ||
    new Set(designs).size !== designs.length ||
    designs.some((name) => !['material', 'cupertino'].includes(name))
  )
    throw new Error('Designs must select material, cupertino, both, or none');
  if (
    !['web', 'tauri', 'both'].includes(buildTarget) ||
    (staticWeb && buildTarget === 'tauri') ||
    (noBackend && buildTarget !== 'web')
  )
    throw new Error(
      'Select web, tauri or both. --no-backend requires web and --static requires a web target',
    );
  const target = path.resolve(destination);
  const existing = fs.lstatSync(target, { throwIfNoEntry: false });
  if (existing && (!existing.isDirectory() || fs.readdirSync(target).length))
    throw new Error('Destination must be an empty ordinary directory');
  const parent = ensureDirectory(path.dirname(target));
  const stage = fs.mkdtempSync(path.join(parent, '.nelyx-create-'));
  try {
    populateApp(stage, name, designs, packages, { target: buildTarget, staticWeb, noBackend });
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

function populateApp(destination, name, designs, packages, { target, staticWeb, noBackend }) {
  fs.cpSync(template, destination, {
    recursive: true,
    filter(source) {
      const relative = path.relative(template, source);
      const top = relative.split(path.sep)[0];
      if (
        top &&
        ![
          'assets',
          'src',
          'backend',
          'README.md',
          'README.ko.md',
          'tsconfig.json',
          'index.html',
          'vite.config.ts',
          'gitignore.template',
        ].includes(top)
      )
        return false;
      if (
        !isTemplateInput(relative) ||
        ['package.json.template', 'assets/manifest.json'].includes(relative.replaceAll('\\', '/'))
      )
        return false;
      if (noBackend && top === 'backend') return false;
      if (designs.length < 2 && relative.startsWith('src' + path.sep))
        return ['index.ts', 'app-surface.tsx', 'style.css'].includes(path.basename(relative));
      return true;
    },
  });
  const manifest = read(path.join(template, 'package.json.template'));
  const { pwa } = manifest.nelyx.targets.web;
  const { tauri } = manifest.nelyx.targets;
  manifest.name = name.toLowerCase();
  const web = target !== 'tauri';
  const native = target !== 'web';
  if (noBackend) delete manifest.nelyx.backend;
  manifest.nelyx = defineConfig({
    ...manifest.nelyx,
    name,
    displayName: name,
    targets: {
      ...(web
        ? {
            web: staticWeb
              ? {}
              : { pwa: { ...pwa, id: '/apps/' + manifest.name, shortName: name } },
          }
        : {}),
      ...(native
        ? { tauri: { ...tauri, identifier: 'dev.nelyx.' + manifest.name + '.tauri' } }
        : {}),
    },
  });
  if (!web) delete manifest.dependencies['@nelyx/backend-wasm'];
  if (!native) {
    delete manifest.dependencies['@nelyx/backend-tauri'];
    delete manifest.devDependencies['@tauri-apps/cli'];
  }
  for (const script of Object.keys(manifest.scripts)) {
    if ((!web && script.endsWith(':web')) || (!native && script.endsWith(':tauri')))
      delete manifest.scripts[script];
  }
  for (const design of ['material', 'cupertino']) {
    if (!designs.includes(design)) delete manifest.dependencies['@nelyx/' + design];
  }
  verifyAppAssets(destination, manifest.nelyx.assets);
  write(path.join(destination, 'package.json'), manifest);
  fs.renameSync(path.join(destination, 'gitignore.template'), path.join(destination, '.gitignore'));
  if (!noBackend) {
    const file = path.join(destination, 'backend/Cargo.toml');
    fs.writeFileSync(
      file,
      fs.readFileSync(file, 'utf8').replace('nelyx-starter-backend', manifest.name + '-backend'),
    );
    const locks = path.join(destination, 'backend/locks');
    // prepare writes each enabled target's final host lock here.
    fs.mkdirSync(locks);
  }
  const sourceRoot = path.join(destination, 'src');
  if (designs.length < 2) {
    if (path.dirname(sourceRoot) !== destination || fs.lstatSync(sourceRoot).isSymbolicLink())
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

export function main(state = createApplicationState()) {
  return { state, definition: defineApplication(state) };
}
`,
    );
  }
  if (packages) supplyRunner({ app: destination, packages });
}
