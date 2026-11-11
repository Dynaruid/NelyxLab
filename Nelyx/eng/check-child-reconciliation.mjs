// SPDX-License-Identifier: BSD-3-Clause
import { build } from 'esbuild';
const watchdog = setTimeout(() => {
  throw Error('Child reconciliation checks exceeded 20 minutes');
}, 1200000);
try {
  const bundle = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: 'ts',
      contents: `
import assert from 'node:assert/strict';
import {Widget,Element,BuildOwner,IndexedSlot} from './Nelyx/src/framework/widgets/framework.ts';
import {LocalKey} from './Nelyx/src/foundation/key.ts';
import {GlobalKey} from './Nelyx/src/framework/widgets/global-key.ts';
let hashes=0;const updates=[];
class CollisionKey extends LocalKey {
  constructor(readonly value:string){super();}
  get hashCode(){++hashes;return 0;}
  equals(other){return other instanceof CollisionKey&&other.value===this.value;}
}
class Item extends Widget {
  constructor(readonly value:string,key:any=null,readonly children:Widget[]=[],readonly fail=false){super(key);}
  createElement(){return new ItemElement(this);}
}
class ItemElement extends Element {
  protected build(){return (this.widget as Item).children;}
  protected slotForChild(index,previous){return new IndexedSlot(index,previous);}
  update(widget){updates.push(widget.value);if(widget.fail)throw Error('update failed');super.update(widget);}
  replace(widgets){this.children=this.reconcile(this.children,widgets);this.owner.parentRebuilt(this);}
}
const owner=new BuildOwner({} as any,()=>{});
const root=new Item('root').createElement();root.mount(undefined,owner);owner.flushBuild();
const keyed=(name)=>new Item(name,new CollisionKey(name));
const flush=()=>{owner.flushBuild();owner.finalizeTree();};
try {
  root.replace(['a','b','c','d'].map(keyed));flush();
  const original=[...root.children];hashes=0;updates.length=0;
  root.replace(['a','b','c','d'].map(keyed));
  assert.equal(hashes,7,'Stable siblings built an old-key search index beyond duplicate preflight');
  assert.deepEqual(updates,['a','b','c','d'],'Stable updates skipped/reordered a callback');
  assert.deepEqual(root.children,original);flush();
  root.replace(['a','d','b','e'].map(keyed));flush();
  assert.equal(root.children[0],original[0]);assert.equal(root.children[1],original[3]);
  assert.equal(root.children[2],original[1]);assert(!original[2].mounted);
  for(let i=0;i<root.children.length;++i){const slot=root.children[i].slot as IndexedSlot;
    assert.equal(slot.index,i);assert.equal(slot.value,root.children[i-1]);}
  const stable=[...root.children];updates.length=0;
  assert.throws(()=>root.replace(['a','a'].map(keyed)),/Duplicate sibling key/);
  assert.deepEqual(updates,[],'Duplicate preflight changed a child before rejecting');
  assert.deepEqual(root.children,stable);
  root.replace(['a','d'].map(keyed));flush();assert.equal(root.children[1],original[3]);
  root.replace(['a','d','f'].map(keyed));flush();assert.equal(root.children[1],original[3]);
  // A failed later child must not unmount previously retained prefix children.
  assert.throws(()=>root.replace([keyed('a'),new Item('d',new CollisionKey('d'),[],true)]),/update failed/);
  assert(original[0].mounted&&original[3].mounted);flush();
  // The same keyed instance moves between parents in one frame. The source
  // parent can be rebuilt after the destination has already retaken its child.
  const global=new GlobalKey('moving');
  root.replace([new Item('left',new CollisionKey('left'),[new Item('moving',global)]),new Item('right',new CollisionKey('right'))]);flush();
  const left=root.children[0] as ItemElement,right=root.children[1] as ItemElement,moving=global.currentElement;
  right.replace([new Item('moving',global)]);left.replace([]);flush();
  assert.equal(global.currentElement,moving);assert.equal(moving.parent,right);
  root.replace([]);flush();assert.equal(global.currentElement,undefined);
  // Unkeyed positional updates retain their existing element semantics.
  root.replace([new Item('one'),new Item('two')]);flush();const unkeyed=[...root.children];
  root.replace([new Item('changed'),new Item('two')]);flush();assert.deepEqual(root.children,unkeyed);
  console.log('Child reconciliation: stable-prefix allocation bound, colliding keys, order/slots, duplicate preflight, failure retention, GlobalKey retake and positional identity PASS.');
} finally {root.unmount();owner.dispose();}
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
    'data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].contents).toString('base64')
  );
} catch (error) {
  console.error(
    error.message,
    error.errors?.map((item) => item.message),
  );
  process.exitCode = 1;
} finally {
  clearTimeout(watchdog);
}
