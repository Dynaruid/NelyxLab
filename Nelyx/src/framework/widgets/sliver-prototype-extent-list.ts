// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {SliverMultiBoxAdaptorWidget,SliverMultiBoxAdaptorElement} from './sliver.ts';
import {SliverChildBuilderDelegate,SliverChildListDelegate} from './scroll-delegate.ts';
import type {SliverChildDelegate,SliverChildBuilderDelegateOptions,SliverChildDelegateOptions,NullableIndexedWidgetBuilder} from './scroll-delegate.ts';
import type {BuildContext,Element,Widget} from './framework.ts';
import type {Key} from '../../foundation/key.ts';
import {RenderObject,RenderBox} from '../rendering/object.ts';
import {RenderSliverFixedExtentBoxAdaptor} from '../rendering/sliver-fixed-extent-list.ts';
import type {SliverConstraints} from '../rendering/sliver.ts';
import {Axis} from '../painting/basic-types.ts';
import {invariant} from '../../foundation/errors.ts';
import {protect} from '../../ui/value-math.ts';

export class SliverPrototypeExtentList extends SliverMultiBoxAdaptorWidget {
  readonly prototypeItem:Widget;
  constructor({prototypeItem,delegate,key=null}:{readonly prototypeItem:Widget;readonly delegate:SliverChildDelegate;readonly key?:Key|null}){super({delegate,key});this.prototypeItem=prototypeItem;protect(this,['prototypeItem']);}
  static builder({prototypeItem,itemBuilder,itemCount=null,key=null,...options}:Omit<SliverChildBuilderDelegateOptions,'childCount'>&{readonly prototypeItem:Widget;readonly itemBuilder:NullableIndexedWidgetBuilder;readonly itemCount?:number|null;readonly key?:Key|null}):SliverPrototypeExtentList{return new SliverPrototypeExtentList({key,prototypeItem,delegate:new SliverChildBuilderDelegate(itemBuilder,{...options,childCount:itemCount})});}
  static list({prototypeItem,children,key=null,...options}:SliverChildDelegateOptions&{readonly prototypeItem:Widget;readonly children:readonly Widget[];readonly key?:Key|null}):SliverPrototypeExtentList{return new SliverPrototypeExtentList({key,prototypeItem,delegate:new SliverChildListDelegate(children,options)});}
  override createElement():SliverMultiBoxAdaptorElement{return new _SliverPrototypeExtentListElement(this);}
  createRenderObject(context:BuildContext):RenderSliverFixedExtentBoxAdaptor{invariant(context instanceof _SliverPrototypeExtentListElement,'invalid-prototype-context','Prototype sliver requires its actual child Element');return new _RenderSliverPrototypeExtentList(context);}
}
class _SliverPrototypeExtentListElement extends SliverMultiBoxAdaptorElement {
  private _prototype:Element|undefined;
  private static readonly _prototypeSlot=Symbol('SliverPrototypeExtentList.prototype');
  private buildingPrototype=false;
  override get renderObject():_RenderSliverPrototypeExtentList{return super.renderObject as _RenderSliverPrototypeExtentList;}
  protected override get additionalChildren():readonly Element[]{return this._prototype?[this._prototype]:[];}
  protected override slotForChild(index:number,previous:Element|undefined):unknown{return this.buildingPrototype?_SliverPrototypeExtentListElement._prototypeSlot:super.slotForChild(index,previous);}
  protected override performRebuild():void{
    super.performRebuild();this.buildingPrototype=true;
    try{this._prototype=this.reconcile(this._prototype?[this._prototype]:[],[(this.widget as SliverPrototypeExtentList).prototypeItem])[0];}finally{this.buildingPrototype=false;}
  }
  override insertRenderObjectChild(child:RenderObject,slot:unknown):void{if(slot===_SliverPrototypeExtentListElement._prototypeSlot){invariant(child instanceof RenderBox,'invalid-prototype-child','Prototype must render a box subtree');this.renderObject.child=child;}else super.insertRenderObjectChild(child,slot);}
  override didAdoptChild(child:RenderBox):void{if(child!==this.renderObject.child)super.didAdoptChild(child);}
  override moveRenderObjectChild(child:RenderObject,oldSlot:unknown,newSlot:unknown):void{invariant(newSlot!==_SliverPrototypeExtentListElement._prototypeSlot,'moved-prototype-child','The sole prototype slot cannot move');super.moveRenderObjectChild(child,oldSlot,newSlot);}
  override removeRenderObjectChild(child:RenderObject,slot:unknown):void{if(child===this.renderObject.child)this.renderObject.child=null;else super.removeRenderObjectChild(child,slot);}
  override forgetChild(child:Element):void{if(child===this._prototype)this._prototype=undefined;super.forgetChild(child);}
  override visitChildren(visitor:(child:Element)=>void):void{if(this._prototype?.parent===this)visitor(this._prototype);super.visitChildren(visitor);}
  override unmount():void{try{super.unmount();}finally{this._prototype=undefined;}}
}
/** The original private renderer lives in this Widget source library. Its
 * offstage box is a genuine auxiliary entry in base ownership, never active
 * list/paint/hit/semantics data. Base attach/detach see it exactly once. */
class _RenderSliverPrototypeExtentList extends RenderSliverFixedExtentBoxAdaptor {
  private _child:RenderBox|null=null;
  constructor(childManager:_SliverPrototypeExtentListElement){super({childManager});}
  get child():RenderBox|null{return this._child;}
  set child(value:RenderBox|null){
    if(value===this._child)return;this.assertCanMutateLayoutProperty();const previous=this._child;this._child=null;
    if(previous)RenderObject.prototype.remove.call(this,previous);
    this._child=value;
    if(value)try{RenderObject.prototype.insert.call(this,value);}catch(error){if(value.parent!==this)this._child=null;throw error;}
    this.markNeedsLayout();
  }
  override remove(child:RenderObject):void{try{super.remove(child);}finally{if(child===this._child&&child.parent!==this)this._child=null;}}
  protected override performLayout(constraints:SliverConstraints):void{
    // Queued builds must admit/update the prototype before its first measure.
    this.childManager.didStartLayout();invariant(this.child!==null,'missing-prototype-child','Prototype must be built before list layout');this.child.layout(constraints.asBoxConstraints(),{parentUsesSize:true});super.performLayout(constraints);
  }
  override visitChildren(visitor:(child:RenderObject)=>void):void{if(this._child)visitor(this._child);super.visitChildren(visitor);}
  get itemExtent():number{invariant(this.child!==null&&this.child.hasSize,'unlaid-prototype-child','Prototype must be measured before item extent is read');return this.constraints.axis===Axis.vertical?this.child.size.height:this.child.size.width;}
  override dispose():void{try{super.dispose();}finally{if(this.debugDisposed)this._child=null;}}
}
