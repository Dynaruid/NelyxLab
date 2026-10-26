// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {auditPackageBoundaries} from '../package-boundaries.mjs';

test('Element/focus and resource/frame owners have no runtime import cycle', {timeout: 1_200_000}, () => {
  const result=auditPackageBoundaries(path.resolve(import.meta.dirname,'../../..'));
  assert.deepEqual(result.errors,[]);
  const owners=new Set(['Nelyx/src/framework/widgets/framework.ts','Nelyx/src/framework/widgets/focus.ts','Nelyx/src/framework/widgets/focus-traversal-policy.ts','Nelyx/src/framework/widgets/tree-generic-witnesses.ts','Nelyx/src/framework/widgets/rich-text.ts','Nelyx/src/framework/widgets/widget-span.ts',...['hosting/resources','ui/frame','ui/image','ui/shader','ui/color-filter','ui/paint-effects-wire','ui/paint'].map(file=>'Nelyx/src/'+file+'.ts'),...['rendering/list-wheel-viewport','rendering/sliver-tree','widgets/list-wheel-widget','widgets/sliver-tree','widgets/scrollable-details','widgets/two-dimensional-scrollable','widgets/two-dimensional-viewport','widgets/two-dimensional-delegate','widgets/child-vicinity','widgets/widget-state'].map(file=>'Nelyx/src/framework/'+file+'.generated.ts')]);
  assert.deepEqual(result.dependencyGraph.cycles.filter(component=>component.some(file=>owners.has(file))),[]);
});

test('boundary audit accepts declared facades and rejects escaped, reverse and aggregate imports', {timeout: 1_200_000}, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nelyx-boundaries-'));
  const write = (file, text) => {fs.mkdirSync(path.dirname(path.join(root, file)), {recursive: true}); fs.writeFileSync(path.join(root, file), text);};
  try {
    const names = ['core', 'cupertino', 'material'];
    write('package.json', JSON.stringify({workspaces: names.map(n => 'packages/' + n)}));
    for (const name of names) {
      write('packages/' + name + '/package.json', JSON.stringify({name: '@nelyx/' + name, version: '1.2.3', exports: {'./value': {types: './dist/value.d.ts'}, './widgets': {types: './dist/widgets.d.ts'}}, ...(name === 'core' ? {} : {peerDependencies: {'@nelyx/core': '1.2.3'}})}));
      write('packages/' + name + '/src/value.ts', 'export class Value {}');
      write('packages/' + name + '/src/widgets.ts', "export {Value} from './value.ts';");
    }
    assert.deepEqual(auditPackageBoundaries(root).errors, []);
    write('packages/material/assets/shaders/effect.sksl', 'half4 main(float2 p) { return half4(1); }');
    write('packages/material/src/private.ts', "import shader from '../assets/shaders/effect.sksl';");
    assert.deepEqual(auditPackageBoundaries(root).errors, []);
    write('packages/material/src/private.ts', "import {shader} from '../assets/shaders/effect.sksl';");
    assert(auditPackageBoundaries(root).errors.some(e => e.startsWith('Shader asset requires a static default import:')));
    write('packages/material/src/private.ts', "import shader from '../../core/assets/shaders/effect.sksl';");
    assert(auditPackageBoundaries(root).errors.some(e => e.startsWith('Invalid shader asset import:')));
    write('packages/material/src/private.ts', "import shader from '../assets/shaders/missing.sksl';");
    assert(auditPackageBoundaries(root).errors.some(e => e.startsWith('Invalid shader asset import:')));
    write('packages/material/src/private.ts', "import {Value} from './widgets.ts';");
    assert(auditPackageBoundaries(root).errors.some(e => e.startsWith('Internal aggregate dependency:')));
    write('packages/material/src/private.ts', "import {Value} from '../../core/src/value.ts';");
    assert(auditPackageBoundaries(root).errors.some(e => e.startsWith('Relative import escapes owner')));
    write('packages/material/src/private.ts', "import {Value} from '@nelyx/sdk/private';");
    assert(auditPackageBoundaries(root).errors.some(e => e.startsWith('Material runtime dependency:')));
    write('packages/material/src/private.ts', "export type Wrapped = import('../../core/src/value.ts').Value;");
    assert(auditPackageBoundaries(root).errors.some(e => e.startsWith('Relative import escapes owner')));
    write('packages/material/src/private.ts', "export {Value} from './value.ts';");
    assert(auditPackageBoundaries(root).errors.some(e => e.startsWith('Undeclared internal reexport facade:')));
    write('packages/material/src/private.ts', "import type {Value} from './value.ts';");
    write('packages/material/src/value.ts', "import type {Value} from './private.ts'; export class Value {}");
    assert.equal(auditPackageBoundaries(root).dependencyGraph.designCycles.length, 0);
    write('packages/material/src/private.ts', "import {Value} from './value.ts';");
    write('packages/material/src/value.ts', "import './private.ts'; export class Value {}");
    assert.equal(auditPackageBoundaries(root).dependencyGraph.designCycles.length, 1);
    assert.equal(auditPackageBoundaries(root).status, 'FAIL');
    write('packages/material/src/private.ts', 'export const value = 1;');
    const manifestFile = path.join(root, 'packages/material/package.json');
    const manifest = JSON.parse(fs.readFileSync(manifestFile));
    manifest.exports['./value'].default = './dist/private.js';
    fs.writeFileSync(manifestFile, JSON.stringify(manifest));
    assert(auditPackageBoundaries(root).errors.some(e => e.startsWith('Declaration/runtime owner mismatch:')));
    manifest.exports['./value'] = {types: './dist/../../core/src/value.d.ts'};
    fs.writeFileSync(manifestFile, JSON.stringify(manifest));
    assert(auditPackageBoundaries(root).errors.some(e => e.startsWith('Published target escapes its owner:')));
  } finally {
    assert(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep + 'nelyx-boundaries-'));
    fs.rmSync(root, {recursive: true, force: true});
  }
});

test('external color utility is restricted to pinned pure calculations in its two internal adapters', {timeout: 1_200_000}, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nelyx-color-boundaries-'));
  const write = (file, data) => {const target = path.join(root, file); fs.mkdirSync(path.dirname(target), {recursive: true}); fs.writeFileSync(target, typeof data === 'string' ? data : JSON.stringify(data));};
  try {
    write('package.json', {workspaces: ['packages/core', 'packages/material']});
    write('packages/core/package.json', {name: '@nelyx/core', version: '1.0.0', exports: {}});
    write('packages/core/src/value.ts', 'export class Value {}');
    const manifest = {name: '@nelyx/material', version: '1.0.0', exports: {}, peerDependencies: {'@nelyx/core': '1.0.0'}, dependencies: {'@material/material-color-utilities': '0.3.0'}};
    write('packages/material/package.json', manifest);
    write('node_modules/@material/material-color-utilities/package.json', {name: '@material/material-color-utilities', version: '0.3.0', exports: {'.': {types: './index.d.ts', import: './index.js'}}});
    write('node_modules/@material/material-color-utilities/index.js', 'export class Hct {}');
    write('node_modules/@material/material-color-utilities/index.d.ts', 'export declare class Hct {}');
    const adapter = 'packages/material/src/internal/color-scheme/dynamic-scheme.ts';
    write(adapter, "import {Hct} from '@material/material-color-utilities';");
    assert.deepEqual(auditPackageBoundaries(root).errors, []);
    write(adapter, "import {applyTheme} from '@material/material-color-utilities';");
    assert(auditPackageBoundaries(root).errors.some(e => e.startsWith('Color utility import must name approved pure calculations:')));
    write(adapter, "import {Hct} from '@material/material-color-utilities';");
    manifest.dependencies['@material/material-color-utilities'] = '^0.3.0'; write('packages/material/package.json', manifest);
    assert(auditPackageBoundaries(root).errors.some(e => e.startsWith('Unqualified pure color utility pin')));
    manifest.dependencies['@material/material-color-utilities'] = '0.3.0'; write('packages/material/package.json', manifest);
    write('packages/material/src/widget.ts', "import {Hct} from '@material/material-color-utilities';");
    assert(auditPackageBoundaries(root).errors.some(e => e.startsWith('Material runtime dependency:')));
  } finally {
    assert(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep + 'nelyx-color-boundaries-'));
    fs.rmSync(root, {recursive: true, force: true});
  }
});
