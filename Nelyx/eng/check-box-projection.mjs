// SPDX-License-Identifier: BSD-3-Clause
import { build } from 'esbuild';
const watchdog = setTimeout(() => {
  throw Error('Box projection checks exceeded 20 minutes');
}, 1_200_000);
try {
  const result = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: 'ts',
      contents: `
      import assert from 'node:assert/strict';
      import {RenderProxyBox,RenderConstrainedBox,RenderPadding,RenderAlign,RenderPositionedBox,RenderFlex,RenderStack,RenderClip,RenderTransform,FlexParentData,StackParentData} from '@nelyx/core/framework/rendering/boxes';
      import {BoxConstraints} from '@nelyx/core/framework/rendering/constraints';
      import {nativeBoxDataConfiguration} from '@nelyx/core/framework/rendering/object';
      import {EdgeInsetsDirectional} from '@nelyx/core/framework/painting/edge-insets';
      import {originalBoxConfiguration,parentLayout,parentLayoutFields} from './Nelyx/runtime/app/layout.ts';
      import {SceneNode,SceneReference,SceneWriter,boxRenderBindingConfiguration} from './Nelyx/runtime/engine-client/scene.ts';
      const fail=reason=>{throw Error(reason)},renders=[
        new RenderProxyBox(),new RenderConstrainedBox(new BoxConstraints(13,51,7)),
        new RenderPadding(EdgeInsetsDirectional.fromSTEB(3,4,5,6),undefined,'rtl'),
        new RenderPositionedBox(0.25,-0.5,true),new RenderAlign(-0.5,0.75),new RenderFlex('horizontal'),
        new RenderStack({textDirection:'rtl'}),new RenderClip(),new RenderTransform([1,0,0,1,9,13]),
      ];
      let comparisons=0;
      for(const render of renders) {
        for(const mode of ['plain','flex','positioned']) {
          if(mode==='flex'){const data=new FlexParentData();data.flex=2;data.fit='tight';render.parentData=data;}
          else if(mode==='positioned'){const data=new StackParentData();data.left=3;data.top=7;data.width=41;render.parentData=data;}
          else render.parentData=undefined;
          const source=nativeBoxDataConfiguration(render,fail),reference=originalBoxConfiguration(render,fail)!;
          assert(source,'Canonical module did not opt into direct data: '+render.constructor.name);
          const direct:any=new SceneWriter({}, {pollEvents:false,retainedScene:true}),oracle:any=new SceneWriter({}, {pollEvents:false,retainedScene:true});
          direct.nextSlot=oracle.nextSlot=70;
          const desired=direct.records(boxRenderBindingConfiguration(new SceneReference(),[],source,parentLayoutFields(render,source.layout) as any,{index:3,key:19n}));
          const expected=oracle.records(new SceneNode(new SceneReference(),reference.kind,[],{...parentLayout(render,reference.options),listItem:{index:3,key:19n}}));
          assert.deepEqual(direct.diff(desired),oracle.diff(expected),render.constructor.name+'/'+mode);
          assert.equal([...desired.values()][0].configInputs.size,0);
          comparisons++;
        }
      }
      class CustomPadding extends RenderPadding {}
      assert.equal(nativeBoxDataConfiguration(new CustomPadding({left:1,top:1,right:1,bottom:1}),fail),undefined,'Custom subclass inherited direct capability');
      console.log('Box module projection: '+comparisons+' reference wire comparisons, RTL, constraints, flex/positioned parent fields and custom subclass rejection PASS');
    `,
    },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    target: 'node24',
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
