// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../../..');
const timeout = 1_200_000;
const hash = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    timeout,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return result.stdout;
}
const npm = (args, cwd) =>
  process.platform === 'win32'
    ? run('cmd.exe', ['/d', '/c', 'npm.cmd', ...args], cwd)
    : run('npm', args, cwd);

test(
  'current design archives install independently with canonical identity, types, maps, assets and OverflowBar scaling',
  { timeout },
  () => {
    const disk = fs.statfsSync(os.tmpdir(), { bigint: true });
    assert(
      disk.bavail * disk.bsize >= 20n * 1024n ** 3n,
      'Independent installation requires 20 GiB free',
    );
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nelyx-design-delivery-'));
    try {
      const archives = [];
      const inputs = [
        'Nelyx',
        'packages/cupertino',
        'packages/material',
        'node_modules/@material/material-color-utilities',
      ];
      const packages = inputs.map((input) => {
        const source = path.join(root, input);
        const manifest = JSON.parse(fs.readFileSync(path.join(source, 'package.json')));
        const [packed] = JSON.parse(
          npm(
            ['pack', source, '--pack-destination', directory, '--ignore-scripts', '--json'],
            directory,
          ),
        );
        archives.push(path.join(directory, packed.filename));
        if (manifest.name === '@nelyx/material')
          assert(
            packed.files.some((file) => file.path === 'assets/shaders/ink_sparkle.sksl'),
            'Material must supply its canonical SkSL asset',
          );
        return { source, manifest, packed };
      });
      fs.writeFileSync(
        path.join(directory, 'package.json'),
        JSON.stringify({ private: true, type: 'module' }),
      );
      npm(
        [
          'install',
          ...archives,
          '--offline',
          '--ignore-scripts',
          '--no-audit',
          '--no-fund',
          '--package-lock=false',
        ],
        directory,
      );
      for (const { source, manifest, packed } of packages) {
        const installed = path.join(directory, 'node_modules', manifest.name);
        assert(!fs.lstatSync(installed).isSymbolicLink(), 'Use archive bytes, not workspace links');
        for (const file of packed.files) {
          const original = path.join(source, file.path),
            actual = path.join(installed, file.path);
          assert.equal(hash(actual), hash(original), manifest.name + '/' + file.path);
        }
        if (!manifest.name.startsWith('@nelyx/')) continue;
        for (const entry of Object.values(manifest.exports)) {
          for (const target of typeof entry === 'string' ? [entry] : Object.values(entry))
            assert(fs.existsSync(path.join(installed, target)), 'Missing public export ' + target);
        }
        const visit = (folder) => {
          for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
            const file = path.join(folder, entry.name);
            if (entry.isDirectory()) visit(file);
            else if (file.endsWith('.map')) {
              const map = JSON.parse(fs.readFileSync(file));
              assert.equal(map.version, 3);
              if (map.sourcesContent) assert.equal(map.sources.length, map.sourcesContent.length);
              else assert(file.endsWith('.d.ts.map'), 'JavaScript maps must include source text');
              map.sources.forEach((source, index) => {
                const original = path.resolve(path.dirname(file), source);
                assert(
                  original.startsWith(installed + path.sep),
                  'Map must reference installed source',
                );
                assert(fs.existsSync(original), 'Map source must be supplied in the archive');
                if (map.sourcesContent)
                  assert.equal(
                    createHash('sha256').update(map.sourcesContent[index]).digest('hex'),
                    hash(original),
                    'Source map content differs from installed source: ' +
                      manifest.name +
                      '/' +
                      path.relative(installed, original),
                  );
              });
            }
          }
        };
        visit(path.join(installed, 'dist'));
        assert(fs.existsSync(path.join(installed, 'LICENSE.md')));
        assert(fs.readdirSync(path.join(installed, 'licenses')).length > 0);
      }
      fs.copyFileSync(
        path.join(root, 'packages/material/tests/root-fixture.mjs'),
        path.join(directory, 'root-fixture.mjs'),
      );
      fs.writeFileSync(
        path.join(directory, 'icons.mjs'),
        `
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
const loaded = [];
registerHooks({load(url, context, next) { loaded.push(url); return next(url, context); }});
const {Icons} = await import('@nelyx/material/icons');
const {CupertinoIcons} = await import('@nelyx/cupertino/icons');
const {IconData} = await import('@nelyx/core/framework/widgets/icon-data');
assert(Icons.add instanceof IconData); assert(CupertinoIcons.add instanceof IconData);
assert(loaded.filter(url => /\\/@nelyx\\/(material|cupertino)\\/dist\\//.test(url)).every(url => /\\/(?:generated\\/icons\\/)?icons\\.js$/.test(url)));
assert(!loaded.some(url => /\\/framework\\/(rendering|widgets)\\/(?!icon-data\\.js)/.test(url)), 'Icon data must not load Widget/render owners');
`,
      );
      run(process.execPath, ['icons.mjs'], directory);
      fs.writeFileSync(
        path.join(directory, 'consumer.mjs'),
        `
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {Widget} from '@nelyx/core/framework/widgets/framework';
import {OverflowBar, OverflowBarAlignment} from '@nelyx/core/framework/widgets/overflow-bar';
import {MediaQuery, Directionality} from '@nelyx/core/framework/widgets/app-data';
import {FoundationPlatform} from '@nelyx/core/foundation/platform';
import {SizedBox, Center, ColoredBox, Builder} from '@nelyx/core/framework/widgets/basic';
import {fixture} from './root-fixture.mjs';
import * as material from '@nelyx/material/widgets';
import * as cupertino from '@nelyx/cupertino/widgets';
const require = createRequire(import.meta.url);
FoundationPlatform.configure({kind: 'native', operatingSystem: 'windows'});
for (const [name, aggregate] of [['material', material], ['cupertino', cupertino]]) {
  const manifest = JSON.parse(fs.readFileSync('node_modules/@nelyx/' + name + '/package.json'));
  assert.equal(createRequire(require.resolve('@nelyx/' + name + '/widgets')).resolve('@nelyx/core/framework/widgets/framework'), require.resolve('@nelyx/core/framework/widgets/framework'));
  for (const [subpath, entry] of Object.entries(manifest.exports).filter(([key, entry]) => !key.startsWith('./internal/') && typeof entry !== 'string')) {
    const module = await import('@nelyx/' + name + subpath.slice(1));
    for (const [key, value] of Object.entries(module)) if (key in aggregate) assert.equal(value, aggregate[key], name + subpath + ':' + key);
  }
  const meta = await import('@nelyx/' + name + '/icon-assets');
  const font = Object.values(meta)[0];
  assert.equal(font.packageSource.package, '@nelyx/' + name);
  const hash = file => createHash('sha256').update(fs.readFileSync('node_modules/@nelyx/' + name + '/' + file)).digest('hex');
  assert.equal(hash(font.packageSource.path), font.sha256);
  assert.equal(hash(font.packageSource.noticePath), font.notice.sha256);
}
assert(Widget.prototype.isPrototypeOf(material.Scaffold.prototype));
assert(Widget.prototype.isPrototypeOf(cupertino.CupertinoPageScaffold.prototype));
assert.equal(OverflowBarAlignment.start, 'start');
const f = fixture();
try {
  const observed = [];
  for (const width of [160, 40]) {
    f.set(new Directionality('ltr', new Center(new SizedBox(width, undefined, new OverflowBar({spacing: 8, overflowSpacing: 4, children: [0xffff0000, 0xff00ff00].map(color => new ColoredBox({color, child: new SizedBox(50, 20)}))})))));
    const commands = f.frame();
    assert(commands.some(command => command.op === 'drawRect'));
    let render;
    const visit = element => {if (element.widget instanceof OverflowBar) render = element.renderObject; element.visitChildren(visit);}; visit(f.root.root);
    observed.push([render.size.width, render.size.height]);
  }
  assert.deepEqual(observed, [[160, 20], [40, 44]]);
  const shaderSource = fs.readFileSync('node_modules/@nelyx/material/assets/shaders/ink_sparkle.sksl', 'utf8');
  const installedInk = new material.Material({
    child: new material.InkWell({id: 'installed-shader', onTap() {}, enableFeedback: false,
      splashFactory: material.InkSparkle.constantTurbulenceSeedSplashFactory, child: new SizedBox(160, 100)}),
  });
  f.set(new Directionality('ltr', new material.Theme(new material.ThemeData({platform: 'windows'}), installedInk)));
  f.tap('installed-shader');
  const shader = f.advance(100).find(command => command.paint?.shader?.kind === 'runtime')?.paint.shader;
  assert(shader, 'Installed InkSparkle must use the packaged shader');
  assert.equal(shader.source, shaderSource);
  assert.equal(shader.uniforms.length, 28);
  f.set(new SizedBox());
  f.set(new MediaQuery({width: 240, height: 160, scale: 1, textScale: 3, safeArea: {left: 0, top: 0, right: 0, bottom: 0}, keyboardInset: 22}, MediaQuery.withClampedTextScaling({maxScaleFactor: 1.5, child: new Builder(context => {assert.equal(MediaQuery.textScalerOf(context).scale(20), 30); assert.equal(MediaQuery.of(context).keyboardInset, 22); return new SizedBox();})})));
} finally {f.close();}
`,
      );
      run(process.execPath, ['consumer.mjs'], directory);
      fs.writeFileSync(
        path.join(directory, 'consumer.ts'),
        `
import {OverflowBar, type OverflowBarOptions} from '@nelyx/core/framework/widgets/overflow-bar';
import {MediaQuery} from '@nelyx/core/framework/widgets/app-data';
import {FilledButton} from '@nelyx/material/filled-button';
import {FilledButton as AggregateButton} from '@nelyx/material/widgets';
import {InputDecoration} from '@nelyx/material/input-decoration';
import {InputDecorator} from '@nelyx/material/input-decorator';
import {TextField, type TextFieldOptions} from '@nelyx/material/text-field';
import {TextFormField} from '@nelyx/material/text-form-field';
import {WidgetStateTextStyle} from '@nelyx/core/framework/widgets/widget-state-text-style';
import {TextStyle} from '@nelyx/core/framework/painting/text-style';
import {TextAlignVertical} from '@nelyx/core/framework/painting/text-align-vertical';
import {TextSelection} from '@nelyx/core/services/text-editing';
import type {EditableTextOptions,EditableTextState} from '@nelyx/core/framework/widgets/editable-text';
import type {RenderEditable} from '@nelyx/core/framework/rendering/editable';
import {CupertinoButton} from '@nelyx/cupertino/button';
import {CupertinoTextField,OverlayVisibilityMode} from '@nelyx/cupertino/text-field';
import {CupertinoTextFormFieldRow} from '@nelyx/cupertino/text-form-field-row';
import {Widget} from '@nelyx/core/framework/widgets/framework';
const options: OverflowBarOptions = {spacing: 8, children: []};
const bar: Widget = new OverflowBar(options);
const same: typeof FilledButton = AggregateButton;
const cupertino: Widget = new CupertinoButton('consumer-button', 'Button', () => {});
MediaQuery.withClampedTextScaling({child: bar, maxScaleFactor: 2});
void same; void cupertino;
const decoration = new InputDecoration({labelText: 'Name', filled: true});
const fieldOptions: TextFieldOptions = {id: 'name', decoration, minLines: 2, maxLines: 4, onEditingComplete() {}, textAlignVertical: TextAlignVertical.center, style: WidgetStateTextStyle.resolveWith(() => new TextStyle({fontSize: 16}))};
const coreEditing: EditableTextOptions = {cursorWidth: 2, cursorHeight: 24, contextMenuBuilder: TextField.defaultContextMenuBuilder};
const geometry = (state: EditableTextState) => {const render: RenderEditable = state.renderEditable; return render.getBoxesForSelection(new TextSelection({baseOffset: 0, extentOffset: 0}));};
void coreEditing; void geometry;
const input: Widget = new TextField(fieldOptions);
const formInput: Widget = new TextFormField({...fieldOptions, initialValue: 'Ada', validator: value => value ? null : 'Required'});
const decorated: Widget = new InputDecorator({decoration, child: input});
void formInput; void decorated;
const formRow: import('@nelyx/cupertino/form-row').CupertinoFormRowOptions = {child: input, padding: null};
const formSection: import('@nelyx/cupertino/form-section').CupertinoFormSectionOptions = {children: [input]};
void formRow; void formSection;
const cupertinoInput: Widget = new CupertinoTextField({id: 'message', placeholder: 'Message', clearButtonMode: OverlayVisibilityMode.editing, minLines: 1, maxLines: 3});
const cupertinoForm: Widget = new CupertinoTextFormFieldRow({id: 'contact', initialValue: 'Ada', onFieldSubmitted(value) {value.toUpperCase();}, validator: value => value ? null : 'Required'});
void cupertinoInput; void cupertinoForm;
`,
      );
      fs.writeFileSync(
        path.join(directory, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            strict: true,
            noEmit: true,
            module: 'NodeNext',
            target: 'ES2022',
            types: [],
          },
          files: ['consumer.ts'],
        }),
      );
      run(
        process.execPath,
        [path.join(root, 'node_modules/@typescript/native/bin/tsc'), '-p', 'tsconfig.json'],
        directory,
      );
      const declarations = fs.readFileSync(
        path.join(directory, 'node_modules/@nelyx/core/dist/framework/widgets/overflow-bar.d.ts'),
        'utf8',
      );
      assert(declarations.includes('@dartType double'));
      assert(declarations.includes('@dartParam spacing double'));
    } finally {
      assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
      assert(path.basename(directory).startsWith('nelyx-design-delivery-'));
      assert(!fs.lstatSync(directory).isSymbolicLink());
      fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
  },
);
