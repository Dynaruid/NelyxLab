// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import test from 'node:test';
import {transformSync} from '@babel/core';
import {Widget} from '@nelyx/core/framework/widgets/framework';
import {Align, SizedBox} from '@nelyx/core/framework/widgets/basic';
import {Directionality,MediaQuery} from '@nelyx/core/framework/widgets/app-data';
import {FoundationPlatform} from '@nelyx/core/foundation/platform';
import {fixture} from './root-fixture.mjs';

test('RN Babel loads the actual split TS graph and dispatches source controls on canonical Core', {timeout: 1_200_000}, () => {
  const root = path.resolve(import.meta.dirname, '../../..');
  const cache = new Map();
  const preset = createRequire(import.meta.url).resolve('@react-native/babel-preset');
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    assert(file.startsWith(path.join(root, 'packages') + path.sep));
    const module = {exports: {}};
    cache.set(file, module);
    const code = transformSync(fs.readFileSync(file, 'utf8'), {filename: file, presets: [[preset, {disableImportExportTransform: false}]], configFile: false, babelrc: false}).code;
    const nativeRequire = createRequire(file);
    const require = specifier => specifier.startsWith('.') && specifier.endsWith('.sksl')
      ? {__esModule: true, default: fs.readFileSync(path.resolve(path.dirname(file), specifier), 'utf8')}
      : specifier.startsWith('.') && specifier.endsWith('.ts') ? load(path.resolve(path.dirname(file), specifier)) : nativeRequire(specifier);
    new Function('require', 'module', 'exports', code)(require, module, module.exports);
    return module.exports;
  }
  const material = load(path.join(root, 'packages/material/src/widgets.ts'));
  const cupertino = load(path.join(root, 'packages/cupertino/src/widgets.ts'));
  assert.equal(material.Switch, load(path.join(root, 'packages/material/src/switch.ts')).Switch);
  assert.equal(cupertino.CupertinoSwitch, load(path.join(root, 'packages/cupertino/src/switch.ts')).CupertinoSwitch);
  assert(Widget.prototype.isPrototypeOf(material.Switch.prototype));
  assert(Widget.prototype.isPrototypeOf(cupertino.CupertinoSwitch.prototype));
  FoundationPlatform.configure({kind: 'native', operatingSystem: 'windows'});
  const f = fixture(), changes = [];
  try {
    for (const [Switch, id] of [[material.Switch, 'material-source'], [cupertino.CupertinoSwitch, 'cupertino-source']]) {
      const commands = f.set(new Directionality('ltr',new MediaQuery({width:240,height:160,scale:1,textScale:1,safeArea:{left:0,top:0,right:0,bottom:0},keyboardInset:0},new Align(new Switch({id, value: false, onChanged: value => changes.push([id, value])})))));
      assert(commands.length > 1);
      f.tap(id);
    }
    assert.deepEqual(changes, [['material-source', true], ['cupertino-source', true]]);
    f.set(new SizedBox(1, 1));
    assert.equal(f.root.scheduler.transientCallbackCount, 0);
    assert(cache.size > 20, 'Execute the transitive source graph, including generated/data helpers');
  } finally {f.close();}
});
