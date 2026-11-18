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
import {Widget,Element,BuildOwner,IndexedSlot,LeafRenderObjectWidget,MultiChildRenderObjectWidget,State,StatefulWidget} from './Nelyx/src/framework/widgets/framework.ts';
import {LocalKey} from './Nelyx/src/foundation/key.ts';
import {GlobalKey} from './Nelyx/src/framework/widgets/global-key.ts';
import {AxisDirection} from './Nelyx/src/framework/painting/basic-types.ts';
import {GrowthDirection,SliverConstraints} from './Nelyx/src/framework/rendering/sliver.ts';
import {BoxConstraints} from './Nelyx/src/framework/rendering/constraints.ts';
import {RenderBox,PipelineOwner} from './Nelyx/src/framework/rendering/object.ts';
import {SliverFixedExtentList,SliverGrid} from './Nelyx/src/framework/widgets/sliver.ts';
import {SliverGridDelegate,SliverGridRegularTileLayout} from './Nelyx/src/framework/rendering/sliver-grid.ts';
import {SliverChildDelegate} from './Nelyx/src/framework/widgets/scroll-delegate.ts';
import {ScrollDirection} from './Nelyx/src/framework/rendering/viewport-offset.ts';
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
function checkSuffix() {
  const events = [];
  class Box extends RenderBox { performLayout(c) { return c.smallest; } }
  class Leaf extends LeafRenderObjectWidget { createRenderObject() { return new Box(); } }
  class Group extends MultiChildRenderObjectWidget { createRenderObject() { return new Box(); } }
  class Entry extends StatefulWidget {
    constructor(readonly name, key = null, readonly updated?) { super(key); }
    createState() { return new EntryState(); }
  }
  class Tail extends Entry {}
  class EntryState extends State {
    initState() { events.push('mount '+this.widget.name); }
    didUpdateWidget() { events.push('update '+this.widget.name); this.widget.updated?.(); }
    deactivate() { events.push('retire '+this.widget.name); }
    build() { return new Leaf(); }
  }
  const a = new CollisionKey('a'), b = new CollisionKey('b'), fresh = new GlobalKey('fresh');
  const owner = new BuildOwner({} as any,()=>{});
  const root = new Group([]).createElement(), destination = new Item('destination').createElement();
  root.mount(undefined,owner); destination.mount(undefined,owner); owner.flushBuild();
  const replace = widgets => { root.children = root.reconcile(root.children,widgets); owner.parentRebuilt(root); };
  const settle = () => { owner.flushBuild(); owner.finalizeTree(); };
  const order = () => {
    assert.deepEqual(root.renderObject.children,root.children.flatMap(c => c.renderObjects));
    root.children.forEach((child,i) => { assert.equal(child.slot.index,i); assert.equal(child.slot.value,root.children[i-1]); });
  };
  try {
    replace([new Entry('A',a),new Entry('old'),new Entry('B',b),new Tail('T'),new Tail('U')]); settle();
    const [A,old,B,T,U] = root.children.map(c => c.stateObject);
    events.length = 0;
    replace([new Entry('B',b),new Entry('new'),new Entry('A',a),new Entry('insert'),new Tail('T'),new Tail('U')]); settle();
    assert.deepEqual(events,['retire old','update B','mount new','update A','mount insert','update T','update U']);
    const stateAt = i => root.children[i].stateObject;
    assert.equal(stateAt(0),B); assert.equal(stateAt(2),A); assert.equal(stateAt(4),T); assert.equal(stateAt(5),U);
    assert(!old.mounted); order();
    replace([new Entry('B',b),new Tail('T'),new Tail('U')]); settle();
    assert.equal(stateAt(1),T); assert.equal(stateAt(2),U); order();
    // An aborted insertion and suffix update must leave only surviving children,
    // in the old order, including renders, with no speculative key reservation.
    const before = [...root.children];
    replace([new Entry('A',a),...before.map(c => c.widget)]); settle();
    const original = [...root.children]; let aborted;
    const fail = () => { aborted = fresh.currentElement; throw Error('suffix failed'); };
    assert.throws(() => replace([new Entry('B',b),new Leaf(fresh),new Entry('A',a),new Tail('T',null,fail),new Tail('U')]),/suffix failed/);
    assert(aborted && !aborted.mounted); assert.equal(fresh.currentElement,undefined);
    assert(!owner.reservations.has(fresh)); assert.deepEqual(root.children,original); order();
    replace([new Entry('B',b),new Entry('A',a),new Tail('T'),new Tail('U')]); settle(); order();
    // During a middle callback the destination can take a scanned suffix.
    // Processing that GlobalKey again must go through retake, not stale reuse.
    const g = new GlobalKey('suffix-retake'), tail = new Tail('G',g);
    replace([new Entry('A',a),new Entry('B',b),tail]); settle();
    const moving = g.currentElement;
    replace([new Entry('B',b,() => destination.replace([tail])),new Entry('A',a),tail]);
    destination.replace([]); settle(); order();
    assert.equal(g.currentElement,moving); assert.equal(moving.parent,root);
    // A lazy singleton can hold a stale pointer to the identical widget.
    const reclaimed = destination.reconcileSingleChild(moving,tail);
    assert.equal(reclaimed,moving); assert.equal(reclaimed.parent,destination);
    assert(owner.reservations.get(g).parents.has(destination));
    destination.children = [reclaimed]; replace([]); settle();
    replace([tail,new Entry('A',a),new Entry('B',b)]); destination.replace([]); settle();
    replace([tail,new Entry('B',b,() => destination.replace([tail])),new Entry('A',a)]);
    settle(); order();
    assert.equal(g.currentElement.parent,destination);
    assert.deepEqual(root.children.map(c => c.widget.name),['B','A']);
    destination.replace([]); settle();
  } finally { root.unmount(); destination.unmount(); owner.dispose(); }
}
function checkSliverStream() {
  const owner = new BuildOwner({} as any,()=>{});
  const starts = [], finishes = [];
  let failAt = 3, boxLayouts = 0, predecessorVisits = 0, applied = 0, remapping = false;
  class RowBox extends RenderBox {
    performLayout(constraints) { ++boxLayouts; return constraints.smallest; }
  }
  class Row extends LeafRenderObjectWidget {
    createRenderObject() { return new RowBox(); }
  }
  class Rows extends SliverChildDelegate {
    constructor(readonly rows) { super(); }
    get estimatedChildCount() { return this.rows.length; }
    shouldRebuild() { return true; }
    findIndexByKey(key) { const i = this.rows.findIndex(row => row.key === key); return i < 0 ? null : i; }
    build(context, index) {
      const slots = [];
      context.visitChildren(child => slots.push(child.slot));
      if (!remapping) assert.deepEqual(slots, context.children.map(child => child.slot));
      starts.push({index, slots});
      if (index === failAt) { failAt = -1; throw Error('stream delegate failed'); }
      return this.rows[index] ?? null;
    }
    didFinishLayout(first, last) { finishes.push([first,last]); }
  }
  const global = new GlobalKey('stream-retake');
  const rows = Array.from({length:20},(_,i) => new Row(i===5 ? global : new CollisionKey(String(i))));
  const widget = (values) => new SliverFixedExtentList({ itemExtent:10, delegate:new Rows(values) });
  const element = widget(rows).createElement();
  element.mount(undefined,owner);
  const render = element.renderObject;
  const destination = new Item('retake-destination').createElement();
  destination.mount(undefined,owner);
  const pipeline = new PipelineOwner({accessibilityEnabled:false});
  pipeline.setRoot(render);
  const originalPredecessor = element.precedingBox;
  element.precedingBox = function (...args) {
    predecessorVisits += render.childCount;
    return originalPredecessor.apply(this,args);
  };
  const originalValidation = BoxConstraints.prototype.debugAssertIsValid;
  const boxInputs = new Set();
  BoxConstraints.prototype.debugAssertIsValid = function (...args) {
    if (args[0]?.isAppliedConstraint) {
      ++applied;
      boxInputs.add(this);
    }
    return originalValidation.apply(this,args);
  };
  const constraints = new SliverConstraints({
    axisDirection:AxisDirection.down, crossAxisDirection:AxisDirection.right,
    growthDirection:GrowthDirection.forward, userScrollDirection:ScrollDirection.idle,
    scrollOffset:0, precedingScrollExtent:0, overlap:0, remainingPaintExtent:60,
    crossAxisExtent:80, viewportMainAxisExtent:60, remainingCacheExtent:60, cacheOrigin:0,
  });
  try {
    assert.throws(() => render.layout(constraints), /stream delegate failed/);
    const projection = element.children;
    assert.deepEqual(projection.map(child => child.slot),[0,1,2]);
    render.layout(constraints);
    assert.deepEqual(starts.slice(0,4).map(({slots}) => slots),[[],[0],[0,1],[0,1,2]]);
    assert.deepEqual(finishes.at(-1),[0,5]);
    assert.equal(element.children,projection,'Tail growth rebuilt the Element projection');
    assert.equal(predecessorVisits,0,'Streaming insertion searched the active chain');
    const firstBox = render.firstChild;
    applied = 0;
    const before = boxLayouts;
    render.layout(constraints.copyWith({scrollOffset:1,remainingCacheExtent:59}));
    assert.equal(applied,0,'Offset-only layout revisited clean boxes');
    assert.equal(boxLayouts,before);
    assert.equal(render.geometry.paintExtent,59);
    pipeline.requestLayoutCallback(firstBox);
    render.layout(constraints.copyWith({scrollOffset:1.5,remainingCacheExtent:58.5}));
    assert(applied >= 6,'A queued layout callback was bypassed');
    pipeline.flushLayout();
    applied = 0;
    firstBox.markNeedsLayout();
    render.layout(constraints.copyWith({scrollOffset:2,remainingCacheExtent:58}));
    assert.equal(boxLayouts,before+1,'Dirty layout was skipped');
    assert(applied >= 6);
    const normalLayout = firstBox.layout;
    let customBoxCalls = 0;
    firstBox.layout = function (...args) { ++customBoxCalls; return normalLayout.apply(this,args); };
    render.layout(constraints.copyWith({scrollOffset:3,remainingCacheExtent:57}));
    assert.equal(customBoxCalls,1,'Custom box layout was bypassed');
    delete firstBox.layout;
    render.layout(constraints.copyWith({crossAxisExtent:90,crossAxisDirection:AxisDirection.left}));
    assert.equal(firstBox.size.width,90);
    const retiredRow = element.children[1];
    firstBox.parentData.keepAlive = true;
    render.layout(constraints.copyWith({scrollOffset:90}));
    assert.equal(render.indexOf(render.firstChild),9);
    assert.equal(firstBox.parentData.keptAlive,true);
    assert(!retiredRow.mounted,'An ordinary off-cache row stayed mounted');
    render.layout(constraints);
    assert.equal(render.firstChild,firstBox,'Keep-alive return replaced the box');
    assert.equal(firstBox.parentData.keptAlive,false);
    assert.notEqual(element.children[1],retiredRow,'Reverse scroll reused a retired row');
    const left = element.children[1], right = element.children[3];
    const reordered = [...rows];
    [reordered[1],reordered[3]] = [reordered[3],reordered[1]];
    remapping = true;
    element.update(widget(reordered));
    render.layout(constraints);
    remapping = false;
    assert.equal(element.children[1],right);
    assert.equal(element.children[3],left);
    assert.deepEqual(element.children.map(child=>child.slot),[0,1,2,3,4,5]);
    const moved = global.currentElement;
    destination.replace([rows[5]]);
    assert.equal(global.currentElement,moved);
    assert.deepEqual(element.children.map(child=>child.slot),[0,1,2,3,4]);
    reordered[5] = new Row(new CollisionKey('replacement'));
    element.update(widget(reordered));
    render.layout(constraints);
    owner.finalizeTree();
    assert.equal(global.currentElement.parent,destination);
    assert.deepEqual(element.children.map(child=>child.slot),[0,1,2,3,4,5]);
    render.layout(constraints.copyWith({scrollOffset:190}));
    assert.equal(render.indexOf(render.lastChild),19);
    assert.equal(render.geometry.scrollExtent,200);
    assert(starts.some(({index})=>index===20),'Past-end query was skipped');
    firstBox.parentData.keepAlive = false;

    // A user delegate may change the regular placement without changing its
    // identity. Its layout callback must still run at every real sliver layout.
    let delegateCalls = 0, reversed = false, rowExtent = 30, custom = false, customCalls = 0;
    class CustomTiles extends SliverGridRegularTileLayout {
      getGeometryForChildIndex(index) { ++customCalls; return super.getGeometryForChildIndex(index); }
    }
    class DynamicGrid extends SliverGridDelegate {
      getLayout() {
        ++delegateCalls;
        const Tiles = custom ? CustomTiles : SliverGridRegularTileLayout;
        return new Tiles({crossAxisCount:2,mainAxisStride:30,crossAxisStride:40,
          childMainAxisExtent:rowExtent,childCrossAxisExtent:40,reverseCrossAxis:reversed});
      }
      shouldRelayout() { return false; }
    }
    const gridRows = new Rows(Array.from({length:8}, () => new Row()));
    const gridElement = new SliverGrid({delegate:gridRows,gridDelegate:new DynamicGrid()}).createElement();
    gridElement.mount(undefined,owner);
    pipeline.setRoot(gridElement.renderObject);
    const grid = gridElement.renderObject;
    try {
      boxInputs.clear();
      grid.layout(constraints);
      assert.equal(boxInputs.size,1,'Cold regular tiles did not share their box constraints');
      assert(Object.isFrozen(boxInputs.values().next().value));
      applied = 0;
      grid.layout(constraints.copyWith({scrollOffset:1,remainingCacheExtent:59}));
      // The layout and the widget's total-extent estimate both query the delegate.
      assert.equal(delegateCalls,4);
      assert.equal(applied,0,'Equal regular tiles revisited clean boxes');
      assert.equal(grid.geometry.paintExtent,59);
      reversed = true;
      rowExtent = 24;
      grid.layout(constraints.copyWith({scrollOffset:2,remainingCacheExtent:58}));
      assert.equal(grid.firstChild.parentData.crossAxisOffset,40);
      assert.equal(grid.firstChild.size.height,24);
      assert.equal(grid.geometry.paintExtent,52);
      custom = true;
      boxInputs.clear();
      grid.layout(constraints);
      assert.equal(boxInputs.size,4,'Custom tiles changed their per-child constraint contract');
      const previous = customCalls;
      grid.layout(constraints.copyWith({scrollOffset:1,remainingCacheExtent:59}));
      assert(customCalls >= previous+4,'Custom tile geometry was bypassed');
    } finally {
      pipeline.setRoot(undefined);
      gridElement.unmount();
    }
    console.log('SLIVER_STREAM_PASS '+JSON.stringify({
      coldInsertionPredecessorVisits:0,offsetOnlyBoxLayouts:0,offsetOnlyConstraintValidations:0,
      coldGridBoxConstraints:1,equalGridConstraintValidations:0,gridDelegateCalls:delegateCalls,
    }));
  } finally {
    BoxConstraints.prototype.debugAssertIsValid = originalValidation;
    pipeline.setRoot(undefined);
    pipeline.dispose();
    element.unmount();
    destination.unmount();
    owner.dispose();
  }
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
  checkSuffix();
  checkSliverStream();
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
