// SPDX-License-Identifier: BSD-3-Clause
import { build } from 'esbuild';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';

if (!process.argv.includes('--child')) {
  await execute(process.execPath, [import.meta.filename, '--child'], {
    cwd: process.cwd(),
    timeout: 1_200_000,
  });
} else {
  const result = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: 'ts',
      contents: `
import assert from 'node:assert/strict';
import {PipelineOwner,RenderBox} from './Nelyx/src/framework/rendering/object.ts';
import {RenderBlockSemantics} from './Nelyx/src/framework/rendering/semantics-annotations.ts';
import {RenderFractionalTranslation} from './Nelyx/src/framework/rendering/fractional-translation.ts';
import {BoxConstraints} from './Nelyx/src/framework/rendering/constraints.ts';
import {semanticsFor,pipelineSemantics} from './Nelyx/src/framework/rendering/semantics-pipeline.ts';
import {SemanticsNode} from './Nelyx/src/framework/semantics/semantics.ts';
import {Offset} from './Nelyx/src/ui/offset.ts';
import {Rect} from './Nelyx/src/ui/rect.ts';
import {FoundationBuildMode} from './Nelyx/src/foundation/constants.ts';

class Box extends RenderBox {
  constructor(readonly label='',readonly boundary=false,children=[],readonly clip=false){super();this.setChildren(children);}
  performLayout(constraints){for(const child of this.children)child.layout(BoxConstraints.tight({width:80,height:60}));return constraints.constrain({width:80,height:60});}
  describeSemanticsConfiguration(config){super.describeSemanticsConfiguration(config);if(this.label){config.label=this.label;config.textDirection='ltr';}config.isSemanticBoundary=this.boundary;}
  describeApproximatePaintClip(){return this.clip?Rect.fromLTWH(0,0,this.size.width,this.size.height):null;}
  change(){this.markNeedsSemanticsUpdate();}
}
class AssemblyBox extends Box {
  assembleSemanticsNode(node,config,children){super.assembleSemanticsNode(node,config,children);}
}
class TransparentBox extends Box {
  describeSemanticsConfiguration(config){RenderBox.prototype.describeSemanticsConfiguration.call(this,config);}
}
class FocusedBox extends Box {
  focused=false;
  describeSemanticsConfiguration(config){
    super.describeSemanticsConfiguration(config);config.isFocusable=true;config.isFocused=this.focused;
  }
}
function fixture(root){
  const owner=new PipelineOwner();owner.setRoot(root);owner.enableSemantics({onSemanticsUpdate(){}});
  return {owner,frame(){owner.flushLayout({width:120,height:80});owner.flushSemantics();},close(){
    owner.disableSemantics();owner.setRoot(undefined);owner.dispose();
    const dispose=render=>{const children=[...render.children];render.setChildren([]);render.dispose();children.forEach(dispose);};dispose(root);
    assert.equal(pipelineSemantics(owner).transportSources.size,0,'Retired render objects survived in transport');
  }};
}
const previousMode=FoundationBuildMode.mode;
let cases=0;
try {
  for(const mode of ['release','debug']){
    FoundationBuildMode.mode=mode;
    for(const Root of [Box,AssemblyBox]){
      const leaf=new FocusedBox('moving date',true),wrapper=new TransparentBox('',false,[leaf]);
      const root=new Root('',true,[wrapper],true),current=fixture(root);
      const update=SemanticsNode.prototype.updateWith;
      let commits=0;
      SemanticsNode.prototype.updateWith=function(config){commits++;return update.call(this,config);};
      try {
        current.frame();
        const parent=semanticsFor(root).cachedSemanticsNode,node=semanticsFor(leaf).cachedSemanticsNode;
        assert.equal(semanticsFor(wrapper).parentData,semanticsFor(leaf).parentData,'Transparent wrapper allocated new inherited semantics');
        commits=0;
        leaf.layoutOffset=new Offset(12,0);current.frame();
        assert.equal(commits,Root===Box?0:1,'Offset-only layout did not preserve the assembly contract');
        assert.equal(node.transform.storage[12],12);
        assert.equal(node.parent,parent);

        leaf.focused=true;leaf.change();leaf.layoutOffset=new Offset(14,0);current.frame();
        assert.equal(node.getSemanticsData().flagsCollection.isFocused.toBoolOrNull(),true,'Mixed configuration and geometry lost focus');
        leaf.layoutOffset=new Offset(200,0);current.frame();
        assert.equal(node.parent,null,'Clipped node stayed in the published tree');
        leaf.layoutOffset=new Offset(9,0);current.frame();
        assert.equal(semanticsFor(leaf).cachedSemanticsNode,node);
        assert.equal(node.parent,parent,'Unclipped node did not rejoin with its original identity');
        cases++;
      } finally {SemanticsNode.prototype.updateWith=update;current.close();}
    }
    for(const ancestorTarget of [false,true]){
      const leaf=new Box('clipped date',true),root=new Box('',true,[leaf],true),current=fixture(root);
      try {
        current.frame();const originalNode=semanticsFor(leaf).cachedSemanticsNode;
        leaf.layoutOffset={x:200,y:0};current.frame();
        assert.equal(semanticsFor(leaf).geometry.isVisible,false);
        // Exercise the queue boundary from the crash: a cached ancestor loses
        // geometry while only a configuration/assembly target remains queued.
        // The invisible descendant also adds its parent as an assembly target.
        semanticsFor(root).markGeometryDirty();
        pipelineSemantics(current.owner).dirty.add(ancestorTarget?root:leaf);
        assert.equal(pipelineSemantics(current.owner).geometryDirty.size,0);
        current.frame();
        assert(semanticsFor(root).geometry,'Assembly did not restore current ancestor geometry');
        assert.equal(semanticsFor(leaf).cachedSemanticsNode,originalNode,'Geometry recovery replaced a stable node');
        leaf.layoutOffset={x:0,y:0};current.frame();
        assert.equal(semanticsFor(leaf).geometry.isVisible,true);
        assert.equal(semanticsFor(leaf).cachedSemanticsNode,originalNode);
        assert(current.owner.semanticsOwner.rootSemanticsNode.childrenCount>0,'Unclipped date did not return to the published tree');
        cases++;
      } finally {current.close();}
    }
    for(const boundary of [true,false])for(const intermediate of [true,false])for(const order of ['before','after']){
      const leaf=new Box('background',boundary),inner=intermediate?new Box('',false,[leaf]):leaf;
      const motion=new RenderFractionalTranslation({translation:Offset.zero,child:inner});
      const dialog=new Box('date dialog',true),block=new RenderBlockSemantics({blocking:false,child:dialog}),root=new Box('',true,[motion,block]);
      const current=fixture(root);
      try {
        current.frame();
        for(const visible of [true,false,true]){
          const move=()=>{motion.translation=new Offset(visible?0.25:0.5,0);leaf.layoutOffset={x:visible?5:10,y:0};};
          if(order==='before')move();
          block.blocking=visible;leaf.change();
          if(order==='after')move();
          current.frame();
          assert(semanticsFor(dialog).geometry,'The visible dialog lost its geometry');
        }
        cases++;
      }finally{current.close();}
    }
  }
} finally {FoundationBuildMode.mode=previousMode;}
console.log('SEMANTICS_GEOMETRY PASS '+JSON.stringify({cases,coverage:['retained-offset-only-assembly','custom-assembly','mixed-focus-and-motion','inherited-data-reuse','missing-ancestor-geometry','invisible-child-parent-assembly','configuration-only-root-target','stable-node-identity','clip-return','modal-blocking-with-background-motion','debug-and-release','transport-retirement']}));
`,
    },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    logLevel: 'silent',
  });
  try {
    await import(
      'data:text/javascript;base64,' +
        Buffer.from(result.outputFiles[0].contents).toString('base64')
    );
  } catch (error) {
    console.error(
      String(error.stack).replace(
        /data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,
        'semantics-geometry-fixture',
      ),
    );
    process.exitCode = 1;
  }
}
