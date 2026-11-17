// SPDX-License-Identifier: BSD-3-Clause
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const hermesLowering = process.argv.includes('--hermes-lowering');
if (!process.argv.includes('--child')) {
  try {
    await execute(
      process.execPath,
      [import.meta.filename, '--child', ...(hermesLowering ? ['--hermes-lowering'] : [])],
      { cwd: root, timeout: 1_200_000 },
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
} else {
  const coreExports = JSON.parse(
    fs.readFileSync(path.join(root, 'Nelyx/package.json'), 'utf8'),
  ).exports;
  const result = await build({
    plugins: [
      {
        name: 'current-core-source',
        setup(builder) {
          builder.onResolve({ filter: /^@nelyx\/core\// }, ({ path: specifier }) => {
            const target = coreExports['./' + specifier.slice(12)]?.default;
            if (!target?.startsWith('./dist/') || !target.endsWith('.js'))
              throw Error('Missing current Core source export: ' + specifier);
            return {
              path: path.join(
                root,
                'Nelyx',
                target.replace('./dist/', 'src/').replace(/\.js$/, '.ts'),
              ),
            };
          });
        },
      },
    ],
    stdin: {
      resolveDir: root,
      loader: 'ts',
      contents: `
import assert from 'node:assert/strict';
import {PipelineOwner,RenderBox} from './Nelyx/src/framework/rendering/object.ts';
import {RenderProxyBox} from './Nelyx/src/framework/rendering/boxes.ts';
import {withRenderPaint} from './Nelyx/src/framework/rendering/phase.ts';
import {CircleBorder,isNonPaintingCircleBorder} from './Nelyx/src/framework/painting/circle-border.ts';
import {BorderSide} from './Nelyx/src/framework/painting/borders.ts';
import {ColorShapeDecoration,isEmptyColorShapePainter} from './Nelyx/src/framework/painting/color-shape-decoration.ts';
import {BoxPainter} from './Nelyx/src/framework/painting/decoration.ts';
import {ImageConfiguration} from './Nelyx/src/framework/painting/image-configuration.ts';
import {Color} from './Nelyx/src/ui/color.ts';
import {InkDecoration} from './packages/material/src/ink-decoration.ts';
import {MaterialInkRender} from './packages/material/src/internal/material/material-ink-owner.ts';
import {emptyInkDecoration} from './packages/material/src/internal/material/empty-ink-decoration.ts';

let transforms=0;
class Edge extends RenderProxyBox {
  applyPaintTransform(child,matrix){transforms++;super.applyPaintTransform(child,matrix);}
}
class Leaf extends RenderBox {performLayout(c){return c.smallest;}}
const controller=new MaterialInkRender({createTicker(){throw Error('Unexpected ticker');}},null,false);
let current=controller;
for(let i=0;i<24;i++){const edge=new Edge();current.child=edge;current=edge;}
const leaf=new Leaf();current.child=leaf;
const owner=new PipelineOwner({accessibilityEnabled:false});owner.setRoot(controller);owner.flushLayout({width:40,height:40});
leaf.offset={x:5,y:3};
const commands=[],canvas=new Proxy({}, {get(_target,key){return (...args)=>commands.push({op:key,args});}});
const features=[];
function ink(decoration,Type=InkDecoration){const value=new Type({controller,referenceBox:leaf,decoration,configuration:new ImageConfiguration({textDirection:'ltr'})});features.push(value);return value;}
function paint(feature){transforms=0;commands.length=0;withRenderPaint(()=>feature.paintOnMaterial(canvas));return commands;}
const cases=[];
try{
  const shape=new CircleBorder(),empty=new ColorShapeDecoration(shape,null),feature=ink(empty);
  assert(isNonPaintingCircleBorder(shape));assert(isEmptyColorShapePainter(empty.createBoxPainter()));
  assert.equal(paint(feature).length,0);assert.equal(transforms,0);
  assert.equal(controller.features.length,1);assert(!feature.debugDisposed);
  cases.push('no-fill-no-side-ink-keeps-feature-without-transform-or-canvas-work');

  feature.decoration=new ColorShapeDecoration(shape,new Color(0xff123456));
  const filled=paint(feature);assert(transforms>=24);assert(filled.some(c=>c.op==='drawCircle'&&c.args[2].color===0xff123456));
  assert(filled.some(c=>c.op==='drawCircle'&&c.args[0].x===25&&c.args[0].y===23));
  feature.decoration=empty;assert.equal(paint(feature).length,0);assert.equal(transforms,0);
  feature.decoration=new ColorShapeDecoration(new CircleBorder({side:new BorderSide({color:0xffabcdef})}),null);
  assert(paint(feature).some(c=>c.op==='drawCircle'&&c.args[2].style==='stroke'));assert(transforms>=24);
  cases.push('live-selected-fill-today-outline-and-return-to-empty');

  feature.decoration=empty;shape.side=new BorderSide({width:2});
  assert(!isNonPaintingCircleBorder(shape));assert(paint(feature).some(c=>c.op==='drawCircle'));
  shape.side=BorderSide.none;assert.equal(paint(feature).length,0);
  let reads=0;Object.defineProperty(shape,'side',{configurable:true,get(){reads++;return BorderSide.none;}});
  paint(feature);assert.equal(reads,1);assert(transforms>=24);
  Object.defineProperty(shape,'side',{configurable:true,writable:true,value:BorderSide.none});
  cases.push('mutable-side-and-own-getter-stay-live-without-extra-getter-call');

  const originalCirclePaint=Object.getOwnPropertyDescriptor(CircleBorder.prototype,'paint');
  try{let calls=0;CircleBorder.prototype.paint=function(...args){calls++;return originalCirclePaint.value.apply(this,args);};
    paint(feature);assert.equal(calls,1);assert(transforms>=24);
  }finally{Object.defineProperty(CircleBorder.prototype,'paint',originalCirclePaint);}
  const originalInkPaint=Object.getOwnPropertyDescriptor(InkDecoration.prototype,'paintFeature');
  try{let calls=0;InkDecoration.prototype.paintFeature=function(...args){calls++;return originalInkPaint.value.apply(this,args);};
    paint(feature);assert.equal(calls,1);assert(transforms>=24);
    const privateEmpty=ink(emptyInkDecoration);paint(privateEmpty);assert.equal(calls,2);
  }finally{Object.defineProperty(InkDecoration.prototype,'paintFeature',originalInkPaint);}
  cases.push('post-creation-circle-and-ink-prototype-paint-replacements');

  let customCalls=0,disposals=0;
  class CustomPainter extends BoxPainter {paint(){customCalls++;}dispose(){disposals++;super.dispose();}}
  class CustomDecoration extends ColorShapeDecoration {createBoxPainter(){return new CustomPainter();}}
  const custom=ink(new CustomDecoration(new CircleBorder(),null));paint(custom);assert.equal(customCalls,1);assert(transforms>=24);
  custom.decoration=new ColorShapeDecoration(new CircleBorder(),null);assert.equal(disposals,0);paint(custom);assert.equal(customCalls,2);
  custom.decoration=new ColorShapeDecoration(new CircleBorder({eccentricity:0.4}),null);assert.equal(disposals,1);paint(custom);assert.equal(transforms,0);
  customCalls=0;
  class CustomCircle extends CircleBorder {paint(){customCalls++;}}
  const subclass=ink(new ColorShapeDecoration(new CustomCircle(),null));paint(subclass);assert.equal(customCalls,1);assert(transforms>=24);
  class CustomInk extends InkDecoration {paintFeature(...args){customCalls++;super.paintFeature(...args);}}
  const derived=ink(empty,CustomInk);paint(derived);assert.equal(customCalls,2);assert(transforms>=24);
  cases.push('caller-painter-shape-and-ink-subclasses-and-painter-retirement');

  let getterCalls=0;Object.defineProperty(shape,'paint',{configurable:true,get(){getterCalls++;return originalCirclePaint.value;}});
  paint(feature);assert.equal(getterCalls,1);assert(transforms>=24);delete shape.paint;
  const sentinel={kind:'shape-paint-error'};shape.paint=()=>{throw sentinel;};
  assert.throws(()=>paint(feature),error=>error===sentinel);delete shape.paint;
  assert.equal(paint(feature).length,0);assert.equal(transforms,0);
  cases.push('own-paint-getter-and-original-exception-retry');

  const proxiedShape=new Proxy(new CircleBorder(),{}),proxyFeature=ink(new ColorShapeDecoration(proxiedShape,null));
  assert(!isNonPaintingCircleBorder(proxiedShape));paint(proxyFeature);assert(transforms>=24);
  const proxiedDecoration=new Proxy(new ColorShapeDecoration(new CircleBorder(),null),{}),proxyDecorationFeature=ink(proxiedDecoration);
  paint(proxyDecorationFeature);assert(transforms>=24);
  const basePainter=new ColorShapeDecoration(new CircleBorder(),null).createBoxPainter();
  assert(!isEmptyColorShapePainter(new Proxy(basePainter,{})));basePainter.dispose();
  assert(!isEmptyColorShapePainter(basePainter));
  const liveHook=Object.getOwnPropertyDescriptor(BoxPainter.prototype,'assertLive');
  try{let calls=0;BoxPainter.prototype.assertLive=function(){calls++;return liveHook.value.call(this);};paint(feature);assert.equal(calls,1);assert(transforms>=24);}
  finally{Object.defineProperty(BoxPainter.prototype,'assertLive',liveHook);}
  const base=ink(empty),proxiedInk=new Proxy(base,{});paint(proxiedInk);assert(transforms>=24);
  cases.push('proxy-receivers-do-not-acquire-construction-proof');

  const opaque=ink(new ColorShapeDecoration(new CircleBorder(),new Color(0xff445566)));opaque.isVisible=false;
  assert.equal(paint(opaque).length,0);assert(transforms>=24);opaque.isVisible=true;assert(paint(opaque).some(c=>c.op==='drawCircle'));
  const oldConfiguration=opaque.configuration;opaque.configuration=oldConfiguration.copyWith({textDirection:'rtl'});
  assert.equal(opaque.configuration.textDirection,'rtl');assert(paint(opaque).some(c=>c.op==='drawCircle'));
  cases.push('visibility-and-configuration-updates-keep-ordinary-paint');

  let removed=0;const retired=new InkDecoration({controller,referenceBox:leaf,decoration:empty,configuration:ImageConfiguration.empty,onRemoved(){removed++;}});
  assert(controller.features.includes(retired));retired.dispose();retired.dispose();assert.equal(removed,1);assert(!controller.features.includes(retired));
  cases.push('empty-feature-still-retires-and-notifies-exactly-once');
}finally{
  for(const feature of features)feature.dispose();assert.equal(controller.features.length,0);
  owner.setRoot(undefined);owner.dispose();
  const dispose=render=>{const children=[...render.children];render.setChildren([]);render.dispose();for(const child of children)dispose(child);};dispose(controller);
}
console.log('EMPTY_INK_PAINT_PASS '+JSON.stringify({cases}));
`,
    },
    bundle: true,
    loader: { '.sksl': 'text' },
    write: false,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    logLevel: 'silent',
  });
  let contents = result.outputFiles[0].text;
  if (hermesLowering) {
    const load = createRequire(import.meta.url),
      transformed = load('../sdk/tooling/metro/src/native-hermes-transformer.cjs').transform({
        src: contents,
        filename: path.join(root, 'empty-ink-paint-fixture.mjs'),
        options: {
          projectRoot: root,
          platform: 'windows',
          dev: false,
          hot: false,
          experimentalImportSupport: true,
          customTransformOptions: { nelyxTemporalRefOptimization: false },
        },
      });
    contents = load('@babel/core').transformFromAstSync(transformed.ast, contents, {
      configFile: false,
      babelrc: false,
      ast: false,
      code: true,
    }).code;
    console.log('EMPTY_INK_HERMES_LOWERING ' + JSON.stringify({ pruning: false }));
  }
  await import('data:text/javascript;base64,' + Buffer.from(contents).toString('base64')).catch(
    (error) => {
      console.error(error.message);
      const frames = error.stack
        ?.split('\n')
        .filter((line) => line.trimStart().startsWith('at '))
        .slice(0, 2);
      console.error(
        frames
          ?.map((line) =>
            line.replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g, '<fixture>'),
          )
          .join('\n'),
      );
      const location = frames?.[0]?.match(/:(\d+):\d+\)?$/);
      if (location)
        console.error(
          contents
            .split('\n')
            .slice(Number(location[1]) - 2, Number(location[1]) + 1)
            .join('\n'),
        );
      process.exitCode = 1;
    },
  );
}
