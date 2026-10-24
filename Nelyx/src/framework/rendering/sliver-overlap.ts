// SPDX-License-Identifier: BSD-3-Clause
// Nelyx View-scoped overlap transport; transient replacement writers are checked at layout.
import {ChangeNotifier} from '../../foundation/notifier.ts';
import {invariant} from '../../foundation/errors.ts';
import {RenderSliver,SliverGeometry} from './sliver.ts';
import type {SliverConstraints} from './sliver.ts';
import {RenderProxySliver} from './proxy-sliver.ts';
import type {PipelineOwner} from './object.ts';
export class SliverOverlapAbsorberHandle extends ChangeNotifier {
  private retired=false;private ownerValue:PipelineOwner|undefined;private layout:number|null=null;private scroll:number|null=null;
  private readonly writers=new Map<object,PipelineOwner|undefined>();private readonly readers=new Map<object,PipelineOwner>();
  get layoutExtent():number|null{this.ensureAlive();return this.layout;}get scrollExtent():number|null{this.ensureAlive();return this.scroll;}
  get debugStats(){return Object.freeze({writers:this.writers.size,readers:this.readers.size,disposed:this.retired});}
  private bind(owner:PipelineOwner|undefined):void{this.ensureAlive();if(owner){invariant(this.ownerValue===undefined||this.ownerValue===owner,'foreign-overlap-view','An overlap handle belongs to one live View pipeline');this.ownerValue=owner;}}
  /** @internal */ _addWriter(writer:object,owner:PipelineOwner|undefined):void{this.bind(owner);const previous=this.writers.get(writer);invariant(!this.writers.has(writer)||previous===undefined&&owner!==undefined,'duplicate-overlap-writer','Writer already registered');this.writers.set(writer,owner);}
  /** @internal */ _removeWriter(writer:object):void{invariant(this.writers.delete(writer),'missing-overlap-writer','Writer was not registered');if(this.writers.size===0){const changed=this.layout!==null||this.scroll!==null;this.layout=null;this.scroll=null;if(this.readers.size===0)this.ownerValue=undefined;if(changed)this.notifyListeners();}}
  /** @internal */ _addReader(reader:object,owner:PipelineOwner):void{this.bind(owner);invariant(!this.readers.has(reader),'duplicate-overlap-reader','Reader already registered');this.readers.set(reader,owner);}
  /** @internal */ _removeReader(reader:object):void{invariant(this.readers.delete(reader),'missing-overlap-reader','Reader was not registered');if(this.readers.size===0&&this.writers.size===0)this.ownerValue=undefined;}
  /** @internal */ _write(writer:object,layout:number,scroll:number):void{this.ensureAlive();invariant(this.writers.size===1&&this.writers.has(writer)&&this.writers.get(writer)===this.ownerValue,'ambiguous-overlap-writer','Overlap layout requires exactly one producer in this View');invariant(Number.isFinite(layout)&&layout>=0&&Number.isFinite(scroll)&&scroll>=layout,'invalid-overlap-extents','Overlap extents must be finite and ordered');if(this.layout===layout&&this.scroll===scroll)return;this.layout=layout;this.scroll=scroll;this.notifyListeners();}
  override dispose():void{if(this.retired)return;invariant(this.writers.size===0&&this.readers.size===0&&!this.hasListeners,'live-overlap-handle','Unmount producers/readers and remove listeners before disposing overlap handle');super.dispose();this.retired=true;this.ownerValue=undefined;this.layout=null;this.scroll=null;}
}
export class RenderSliverOverlapAbsorber extends RenderProxySliver {
  private writing=false;private current:SliverOverlapAbsorberHandle;
  constructor({handle,sliver=null}:{readonly handle:SliverOverlapAbsorberHandle;readonly sliver?:RenderSliver|null}){invariant(handle instanceof SliverOverlapAbsorberHandle,'invalid-overlap-handle','An overlap handle is required');super(sliver);this.current=handle;}
  get handle():SliverOverlapAbsorberHandle{return this.current;}
  set handle(value:SliverOverlapAbsorberHandle){this.assertCanMutateLayoutProperty();invariant(value instanceof SliverOverlapAbsorberHandle,'invalid-overlap-handle','An overlap handle is required');if(this.current===value)return;if(this.writing)value._addWriter(this,this.owner);const old=this.current;this.current=value;if(this.writing)old._removeWriter(this);this.markNeedsLayout();}
  private claim():void{if(!this.writing){this.current._addWriter(this,this.owner);this.writing=true;}}
  override attach(owner:PipelineOwner):void{const attached=this.attached;super.attach(owner);if(attached)return;try{if(this.writing)this.current._addWriter(this,owner);else this.claim();}catch(error){try{super.detach();}catch(cleanup){throw new AggregateError([error,cleanup],'Overlap producer attachment rollback failed');}throw error;}}
  override detach():void{try{super.detach();}finally{if(!this.attached&&this.writing){this.writing=false;this.current._removeWriter(this);}}}
  protected override performLayout(constraints:SliverConstraints):void{this.claim();const child=this.child;if(!child){this.geometry=SliverGeometry.zero;this.current._write(this,0,0);return;}child.layout(constraints,{parentUsesSize:true});const geometry=child.geometry!;if(geometry.scrollOffsetCorrection!==null){this.geometry=geometry;return;}const overlap=geometry.maxScrollObstructionExtent;invariant(overlap<=geometry.scrollExtent,'invalid-overlap-obstruction','Overlap obstruction exceeds its producer scroll extent');this.geometry=geometry.copyWith({scrollExtent:geometry.scrollExtent-overlap,layoutExtent:Math.max(0,geometry.paintExtent-overlap),maxScrollObstructionExtent:0});this.current._write(this,overlap,overlap);}
  override dispose():void{try{super.dispose();}finally{if(this.debugDisposed&&this.writing){this.writing=false;this.current._removeWriter(this);}}}
}
export class RenderSliverOverlapInjector extends RenderSliver {
  private observing=false;private current:SliverOverlapAbsorberHandle;private readonly changed=()=>{if(this.attached&&!this.debugDisposed)this.markNeedsLayout();};
  constructor({handle}:{readonly handle:SliverOverlapAbsorberHandle}){super();invariant(handle instanceof SliverOverlapAbsorberHandle,'invalid-overlap-handle','An overlap handle is required');this.current=handle;}
  protected override get childCountLimit():number{return 0;}
  get handle():SliverOverlapAbsorberHandle{return this.current;}
  private listen(value:SliverOverlapAbsorberHandle):void{invariant(this.owner,'unattached-overlap-reader','Reader requires its View pipeline');value._addReader(this,this.owner);try{value.addListener(this.changed);}catch(error){value._removeReader(this);throw error;}}
  private unlisten(value:SliverOverlapAbsorberHandle):void{try{value.removeListener(this.changed);}finally{value._removeReader(this);}}
  set handle(value:SliverOverlapAbsorberHandle){this.assertCanMutateLayoutProperty();invariant(value instanceof SliverOverlapAbsorberHandle,'invalid-overlap-handle','An overlap handle is required');if(value===this.current)return;if(this.observing)this.listen(value);const old=this.current;this.current=value;if(this.observing)this.unlisten(old);this.markNeedsLayout();}
  override attach(owner:PipelineOwner):void{const attached=this.attached;super.attach(owner);if(attached)return;try{this.listen(this.current);this.observing=true;}catch(error){try{super.detach();}catch(cleanup){throw new AggregateError([error,cleanup],'Overlap reader attachment rollback failed');}throw error;}}
  override detach():void{const observing=this.observing;this.observing=false;try{if(observing)this.unlisten(this.current);}finally{super.detach();}}
  protected override performLayout(constraints:SliverConstraints):void{const layout=this.current.layoutExtent,scroll=this.current.scrollExtent;invariant(layout!==null&&scroll!==null,'unlaid-overlap-producer','Layout the owning overlap producer before its injector');const painted=this.calculatePaintOffset(constraints,{from:0,to:layout});this.geometry=new SliverGeometry({scrollExtent:scroll,paintExtent:painted,maxPaintExtent:layout,maxScrollObstructionExtent:layout,cacheExtent:this.calculateCacheOffset(constraints,{from:0,to:layout}),hasVisualOverflow:constraints.scrollOffset>0||painted<layout});}
}
