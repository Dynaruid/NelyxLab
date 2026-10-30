// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const timeout = 1_200_000;

test(
  'paragraph fragments and both paragraph APIs initialize in either fresh import order',
  { timeout },
  () => {
    for (const first of ['paragraph-fragment', 'boxes']) {
      const script = `import assert from 'node:assert/strict';
   await import('./Nelyx/dist/framework/rendering/${first}.js');
   const owner=await import('./Nelyx/dist/framework/rendering/boxes.js'),api=await import('./Nelyx/dist/framework/rendering/paragraph.js'),fragment=await import('./Nelyx/dist/framework/rendering/paragraph-fragment.js');
   assert(api.RenderParagraph.prototype instanceof owner.RenderParagraph);assert.equal(typeof fragment.SelectableParagraphFragment,'function');
   console.log('PASS-scoped: canonical paragraph owners initialized');`;
      const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
        cwd: fileURLToPath(new URL('../../../', import.meta.url)),
        encoding: 'utf8',
        timeout,
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      });
      assert.ifError(result.error);
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.match(result.stdout, /PASS-scoped/);
    }
  },
);

test(
  'WidgetSpan-only imports expose the actual RichText ancestor before any separate RichText import',
  { timeout },
  () => {
    const began = Date.now();
    for (const first of ['widget-span', 'rich-text']) {
      const script = `import assert from 'node:assert/strict';
   const initial=await import('./Nelyx/dist/framework/widgets/${first}.js'),{Widget}=await import('./Nelyx/dist/framework/widgets/framework.js'),{TextScaler}=await import('./Nelyx/dist/framework/painting/text-scaler.js');
   class Child extends Widget{createElement(){throw Error('Extraction must not mount the child');}}\n   const WidgetSpan=initial.WidgetSpan,span=new WidgetSpan(new Child()),children=WidgetSpan.extractFromInlineSpan(span,TextScaler.noScaling);assert.equal(children.length,1);
   const ancestor=children[0].debugTypicalAncestorWidgetClass,owner=await import('./Nelyx/dist/framework/widgets/rich-text.js'),api=await import('./Nelyx/dist/framework/widgets/widget-span.js');
   assert.equal(ancestor,owner.RichText);assert.equal(api.WidgetSpan,owner.WidgetSpan);assert.equal(span.constructor,api.WidgetSpan);assert.equal(children[0].span,span);assert.equal(children[0].debugTypicalAncestorWidgetClass,ancestor);
   console.log('PASS-scoped: inline declaration owner and public class identity');`;
      const r = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
        cwd: fileURLToPath(new URL('../../../', import.meta.url)),
        encoding: 'utf8',
        timeout: timeout - (Date.now() - began),
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      });
      assert.equal(r.error, undefined);
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.match(r.stdout, /PASS-scoped/);
    }
  },
);

test(
  'tree owners initialize before either public consumer and keep witnessed values with one declaring class',
  { timeout },
  () => {
    const files = [
        'tree-generic-witnesses',
        'sliver-tree.generated',
        'tree-sliver',
        'sliver-tree',
        'tree-view',
      ],
      began = Date.now();
    for (const reverse of [false, true]) {
      const script = `import assert from 'node:assert/strict';
   const modules=new Map();for(const file of ${JSON.stringify(reverse ? [...files].reverse() : files)})modules.set(file,await import('./Nelyx/dist/framework/widgets/'+file+'.js'));
   const owner=modules.get('sliver-tree.generated'),api=modules.get('sliver-tree'),{dartStringType,dartBoolType,isDartType,castDartType}=await import('./Nelyx/dist/foundation/dart-type-witness.js'),{createDartList}=await import('./Nelyx/dist/foundation/dart-mutable-list.js'),{dartValueString,dartValueHash}=await import('./Nelyx/dist/foundation/dart-value.js');
   assert.equal(api.TreeSliverNode,owner.SourceTreeSliverNode);assert.equal(api.TreeSliverController,owner.SourceTreeSliverController);
   const nodeType=owner.treeNodeType(dartStringType),leaf=new api.TreeSliverNode(dartStringType,'leaf'),root=new api.TreeSliverNode(dartStringType,'root',{children:createDartList(nodeType,[leaf]),expanded:true});
   assert.equal(root.children[0],leaf);assert.equal(root.isExpanded,true);assert.equal(castDartType(leaf,nodeType),leaf);assert.equal(isDartType(leaf,owner.treeNodeType(dartBoolType)),false);assert.throws(()=>castDartType({content:'leaf'},nodeType));
   assert.equal(owner.treeObjectEquals(leaf,leaf),true);assert.equal(owner.treeObjectEquals(leaf,new api.TreeSliverNode(dartStringType,'leaf')),false);assert.equal(dartValueString(leaf),leaf.toString());assert.equal(dartValueHash(leaf),dartValueHash(leaf));
   const controller=new api.TreeSliverController();assert.equal(dartValueString(controller),"Instance of 'TreeSliverController'");
   const widget=new api.TreeSliver(dartStringType,{tree:createDartList(nodeType,[root]),controller});assert(isDartType(widget,owner.treeWidgetType(dartStringType)));assert(widget.createState() instanceof owner.SourceTreeSliverState);
   const map=owner.treeNodeAnimationMap(nodeType);assert(map.keyPolicy.accepts(leaf));assert.equal(map.keyPolicy.validQuery({}),false);assert.throws(()=>map.keyPolicy.accepts({}));
   console.log('PASS-scoped: fresh tree owners and witnessed identity');`;
      const r = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
        cwd: fileURLToPath(new URL('../../../', import.meta.url)),
        encoding: 'utf8',
        timeout: timeout - (Date.now() - began),
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      });
      assert.equal(r.error, undefined);
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.match(r.stdout, /PASS-scoped/);
    }
  },
);

test(
  'adopted scroll owners initialize in both fresh import orders and retain live nominal class checks',
  { timeout },
  () => {
    const specs = [
      ['rendering/list-wheel-viewport', 'SourceListWheelParentData', 'castWheelParentData'],
      ['rendering/sliver-tree', 'SourceTreeSliverNodeParentData', 'castTreeParentData'],
      ['widgets/list-wheel-widget', 'SourceListWheelElement', 'castSourceListWheelElement'],
      ['widgets/scrollable-details', 'SourceScrollableDetails', 'castSourceScrollableDetails'],
      [
        'widgets/two-dimensional-scrollable',
        'SourceVerticalOuterDimension',
        'castSourceVerticalOuterDimension',
      ],
      [
        'widgets/two-dimensional-viewport',
        'SourceTwoDimensionalViewportParentData',
        'castSourceTwoDimensionalViewportParentData',
      ],
      [
        'widgets/two-dimensional-delegate',
        'SourceTwoDimensionalChildListDelegate',
        'castTwoDimensionalChildListDelegate',
      ],
      ['widgets/child-vicinity', 'ChildVicinity', 'castChildVicinity'],
    ];
    const began = Date.now();
    for (const reverse of [false, true]) {
      const script = `import assert from 'node:assert/strict';
   const specs=${JSON.stringify(specs)},modules=new Map();
   for(const [file]of ${reverse ? '[...specs].reverse()' : 'specs'})modules.set(file,await import('./Nelyx/dist/framework/'+file+'.generated.js'));
   for(const [file,name,cast]of specs){
    const module=modules.get(file),type=module[name],value=Object.create(type.prototype);assert.equal(module[cast](value),value);assert.throws(()=>module[cast]({}));
    let prototypes=0;const proxy=new Proxy(value,{getPrototypeOf(target){prototypes++;return Reflect.getPrototypeOf(target);}});assert.equal(module[cast](proxy),proxy);assert(prototypes>0);
   }
   const vicinity=modules.get('widgets/child-vicinity'),type=vicinity.ChildVicinity,sentinel={},descriptor=Object.getOwnPropertyDescriptor(type,Symbol.hasInstance);
   try{
    Object.defineProperty(type,Symbol.hasInstance,{configurable:true,value:function(value){assert.equal(this,type);return value===sentinel;}});assert.equal(vicinity.castChildVicinity(sentinel),sentinel);
    for(const failure of [undefined,null,0]){Object.defineProperty(type,Symbol.hasInstance,{configurable:true,value:function(){assert.equal(this,type);throw failure;}});let caught=false;try{vicinity.castChildVicinity(sentinel);}catch(error){caught=true;assert.equal(error,failure);}assert(caught);}
   }finally{if(descriptor)Object.defineProperty(type,Symbol.hasInstance,descriptor);else delete type[Symbol.hasInstance];}
   const scrollable=modules.get('widgets/two-dimensional-scrollable'),scope=Object.create(scrollable.SourceTwoDimensionalScrollableScope.prototype);assert.equal(scrollable.dependOnSourceTwoAxis({maybeDependOn(type){assert.equal(type,scrollable.SourceTwoDimensionalScrollableScope);return scope;}}),scope);
   const states=await import('./Nelyx/dist/framework/widgets/widget-state.js'),source=await import('./Nelyx/dist/framework/widgets/widget-state.generated.js'),set=states.emptyWidgetStateSet();assert.equal(states.emptyWidgetStateSet,source.emptyWidgetStateSet);set.add(states.WidgetState.selected);assert(set.contains(source.SourceWidgetState.selected));assert.equal(set.contains(states.WidgetState.disabled),false);
   console.log('PASS-scoped: fresh owner imports and nominal identity');`;
      const r = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
        cwd: fileURLToPath(new URL('../../../', import.meta.url)),
        encoding: 'utf8',
        timeout: timeout - (Date.now() - began),
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      });
      assert.equal(r.error, undefined);
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.match(r.stdout, /PASS-scoped/);
    }
  },
);
