// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {Widget,StatefulWidget,ErrorWidget} from './framework.ts';
import type {BuildContext,State} from './framework.ts';
import {AutomaticKeepAlive,AutomaticKeepAliveClientMixin} from './automatic-keep-alive.ts';
import {IndexedSemantics,KeyedSubtree} from './basic.ts';
import {RepaintBoundary} from './repaint-boundary.ts';
import {SelectionContainer,SelectionRegistrarScope} from './selection-container.ts';
import type {SelectionRegistrar,Selectable} from '../rendering/selection.ts';
import {Key,LocalKey,ValueKey,KeyMap,sameKey} from '../../foundation/key.ts';
import {describeIdentity} from '../../foundation/diagnostics-identity.ts';
import {invariant,exceptionStack} from '../../foundation/errors.ts';
import {FlutterError} from '../../foundation/flutter-error.ts';
import {FlutterErrorDetails} from '../../foundation/assertions.ts';
import {ErrorDescription} from '../../foundation/diagnostics.ts';
import {protect} from '../../ui/value-math.ts';

export type NullableIndexedWidgetBuilder=(context:BuildContext,index:number)=>Widget|null;
export type SemanticIndexCallback=(widget:Widget,localIndex:number)=>number|null;
export type ChildIndexGetter=(key:Key)=>number|null;
const _kDefaultSemanticIndexCallback:SemanticIndexCallback=(_widget,index)=>index;
export abstract class SliverChildDelegate {
  abstract build(context:BuildContext,index:number):Widget|null;
  get estimatedChildCount():number|null{return null;}
  estimateMaxScrollOffset(_firstIndex:number,_lastIndex:number,_leadingScrollOffset:number,_trailingScrollOffset:number):number|null{return null;}
  didFinishLayout(_firstIndex:number,_lastIndex:number):void{}
  abstract shouldRebuild(oldDelegate:SliverChildDelegate):boolean;
  findIndexByKey(_key:Key):number|null{return null;}
  toString():string{const description:string[]=[];this.debugFillDescription(description);return `${describeIdentity(this)}(${description.join(', ')})`;}
  protected debugFillDescription(description:string[]):void{try{const children=this.estimatedChildCount;if(children!==null)description.push('estimated child count: '+children);}catch(error){description.push('estimated child count: EXCEPTION ('+(error instanceof Error?error.constructor.name:'Object')+')');}}
}
class _SaltedValueKey extends ValueKey<Key> {constructor(value:Key){super(value,Key,sameKey,value=>value.hashCode);}}
export interface SliverChildDelegateOptions {readonly addAutomaticKeepAlives?:boolean;readonly addRepaintBoundaries?:boolean;readonly addSemanticIndexes?:boolean;readonly semanticIndexCallback?:SemanticIndexCallback;readonly semanticIndexOffset?:number}
type DecorationOptions={readonly addAutomaticKeepAlives:boolean;readonly addRepaintBoundaries:boolean;readonly addSemanticIndexes:boolean;readonly semanticIndexCallback:SemanticIndexCallback;readonly semanticIndexOffset:number};
function decorateChild(child:Widget,index:number,options:DecorationOptions):Widget{
  const key=child.key!==null?new _SaltedValueKey(child.key):null;
  if(options.addRepaintBoundaries)child=new RepaintBoundary(child);
  if(options.addSemanticIndexes){const semanticIndex=options.semanticIndexCallback(child,index);if(semanticIndex!==null)child=new IndexedSemantics({index:semanticIndex+options.semanticIndexOffset,child});}
  if(options.addAutomaticKeepAlives)child=new AutomaticKeepAlive({child:new _SelectionKeepAlive(child)});
  return new KeyedSubtree({key,child});
}
export interface SliverChildBuilderDelegateOptions extends SliverChildDelegateOptions {readonly findChildIndexCallback?:ChildIndexGetter|null;readonly childCount?:number|null}
export class SliverChildBuilderDelegate extends SliverChildDelegate implements DecorationOptions {
  readonly builder:NullableIndexedWidgetBuilder;readonly findChildIndexCallback:ChildIndexGetter|null;readonly childCount:number|null;
  readonly addAutomaticKeepAlives:boolean;readonly addRepaintBoundaries:boolean;readonly addSemanticIndexes:boolean;readonly semanticIndexCallback:SemanticIndexCallback;readonly semanticIndexOffset:number;
  constructor(builder:NullableIndexedWidgetBuilder,{findChildIndexCallback=null,childCount=null,addAutomaticKeepAlives=true,addRepaintBoundaries=true,addSemanticIndexes=true,semanticIndexCallback=_kDefaultSemanticIndexCallback,semanticIndexOffset=0}:SliverChildBuilderDelegateOptions={}){super();this.builder=builder;this.findChildIndexCallback=findChildIndexCallback;this.childCount=childCount;this.addAutomaticKeepAlives=addAutomaticKeepAlives;this.addRepaintBoundaries=addRepaintBoundaries;this.addSemanticIndexes=addSemanticIndexes;this.semanticIndexCallback=semanticIndexCallback;this.semanticIndexOffset=semanticIndexOffset;protect(this,['builder','findChildIndexCallback','childCount','addAutomaticKeepAlives','addRepaintBoundaries','addSemanticIndexes','semanticIndexCallback','semanticIndexOffset']);}
  override findIndexByKey(key:Key):number|null{return this.findChildIndexCallback===null?null:this.findChildIndexCallback(key instanceof _SaltedValueKey?key.value:key);}
  build(context:BuildContext,index:number):Widget|null{
    if(index<0||this.childCount!==null&&index>=this.childCount)return null;let child:Widget|null;
    try{child=this.builder(context,index);invariant(child===null||child instanceof Widget,'invalid-sliver-child-builder','Sliver builder must return a Widget or null');}catch(exception){child=_createErrorWidget(exception);}
    if(child===null)return null;return decorateChild(child,index,this);
  }
  get estimatedChildCount():number|null{return this.childCount;}
  shouldRebuild(oldDelegate:SliverChildDelegate):boolean{invariant(oldDelegate instanceof SliverChildBuilderDelegate,'invalid-covariant-sliver-delegate','Builder shouldRebuild requires a builder delegate');return true;}
}
export class SliverChildListDelegate extends SliverChildDelegate implements DecorationOptions {
  readonly children:readonly Widget[];private readonly _childrenIdentity:readonly Widget[];
  readonly addAutomaticKeepAlives:boolean;readonly addRepaintBoundaries:boolean;readonly addSemanticIndexes:boolean;readonly semanticIndexCallback:SemanticIndexCallback;readonly semanticIndexOffset:number;
  private _keyToIndex:KeyMap<number>|null=new KeyMap();private keySearchCursor=0;
  constructor(children:readonly Widget[],{addAutomaticKeepAlives=true,addRepaintBoundaries=true,addSemanticIndexes=true,semanticIndexCallback=_kDefaultSemanticIndexCallback,semanticIndexOffset=0}:SliverChildDelegateOptions={}){super();this._childrenIdentity=children;this.children=Object.freeze([...children]);this.addAutomaticKeepAlives=addAutomaticKeepAlives;this.addRepaintBoundaries=addRepaintBoundaries;this.addSemanticIndexes=addSemanticIndexes;this.semanticIndexCallback=semanticIndexCallback;this.semanticIndexOffset=semanticIndexOffset;protect(this,['children','addAutomaticKeepAlives','addRepaintBoundaries','addSemanticIndexes','semanticIndexCallback','semanticIndexOffset']);}
  static fixed(children:readonly Widget[],options:SliverChildDelegateOptions={}):SliverChildListDelegate{const delegate=new SliverChildListDelegate(children,options);delegate._keyToIndex=null;return delegate;}
  private _findChildIndex(key:Key):number|null{
    if(this._keyToIndex===null)return null;if(this._keyToIndex.has(key))return this._keyToIndex.get(key)!;
    let index=this.keySearchCursor;while(index<this.children.length){const child=this.children[index]!;if(child.key!==null)this._keyToIndex.set(child.key,index);if(sameKey(child.key,key)){this.keySearchCursor=index+1;return index;}index++;}this.keySearchCursor=index;return null;
  }
  override findIndexByKey(key:Key):number|null{return this._findChildIndex(key instanceof _SaltedValueKey?key.value:key);}
  build(_context:BuildContext,index:number):Widget|null{if(index<0||index>=this.children.length)return null;return decorateChild(this.children[index]!,index,this);}
  get estimatedChildCount():number{return this.children.length;}
  shouldRebuild(oldDelegate:SliverChildDelegate):boolean{invariant(oldDelegate instanceof SliverChildListDelegate,'invalid-covariant-sliver-delegate','List shouldRebuild requires a list delegate');return this._childrenIdentity!==oldDelegate._childrenIdentity;}
}
/** Independent lazy boundaries, not Widget ancestors or shared Form owners. */
export interface SliverChildGroupItem {readonly key:Key;readonly builder:(context:BuildContext)=>Widget}
export interface SliverChildGroup {readonly key:Key;readonly children:readonly SliverChildGroupItem[]}
class _GroupedChildKey extends LocalKey {
  constructor(readonly group:Key,readonly item:Key){super();}
  equals(other:Key):boolean{return other instanceof _GroupedChildKey&&sameKey(this.group,other.group)&&sameKey(this.item,other.item);}
  override get hashCode():unknown{return this.item.hashCode;}
}
/** Flatten descriptors only. Each visible child is built by the canonical
 * sliver owner, with equality-preserving keys namespaced by its group. */
export class SliverChildGroupedDelegate extends SliverChildDelegate {
  readonly groups:readonly SliverChildGroup[];
  private readonly delegate:SliverChildBuilderDelegate;
  private readonly indices=new KeyMap<number>();
  private readonly starts=new KeyMap<number>();
  constructor(groups:readonly SliverChildGroup[],options:SliverChildDelegateOptions={}){
    super();const flat:Array<{readonly key:_GroupedChildKey;readonly builder:(context:BuildContext)=>Widget}>=[];
    this.groups=Object.freeze(groups.map(group=>{
      invariant(group.key instanceof Key&&!this.starts.has(group.key),'duplicate-sliver-group','Groups require distinct logical keys');this.starts.set(group.key,flat.length);
      const keys=new KeyMap<boolean>();const children=Object.freeze(group.children.map(item=>{
        invariant(item.key instanceof Key&&!keys.has(item.key),'duplicate-sliver-group-item','Children require distinct keys within their group');keys.set(item.key,true);
        invariant(typeof item.builder==='function'&&flat.length<4096,'invalid-sliver-group-item','Grouped delegates require builders and at most 4096 children');
        const key=new _GroupedChildKey(group.key,item.key);this.indices.set(key,flat.length);flat.push({key,builder:item.builder});return Object.freeze({key:item.key,builder:item.builder});
      }));return Object.freeze({key:group.key,children});
    }));
    this.delegate=new SliverChildBuilderDelegate((context,index)=>{const item=flat[index]!,child=item.builder(context);invariant(child instanceof Widget,'invalid-sliver-group-builder','A grouped child builder must return a Widget');return new KeyedSubtree({key:item.key,child});},{...options,childCount:flat.length,findChildIndexCallback:key=>this.indices.get(key)??null});
    protect(this,['groups','delegate']);
  }
  firstIndexOfGroup(key:Key):number|null{return this.starts.get(key)??null;}
  indexOfChild(group:Key,item:Key):number|null{return this.indices.get(new _GroupedChildKey(group,item))??null;}
  override findIndexByKey(key:Key):number|null{return this.delegate.findIndexByKey(key);}
  build(context:BuildContext,index:number):Widget|null{return this.delegate.build(context,index);}
  get estimatedChildCount():number{return this.delegate.estimatedChildCount!;}
  shouldRebuild(oldDelegate:SliverChildDelegate):boolean{invariant(oldDelegate instanceof SliverChildGroupedDelegate,'invalid-covariant-sliver-delegate','Grouped shouldRebuild requires a grouped delegate');return this!==oldDelegate;}
}
class _SelectionKeepAlive extends StatefulWidget {
  readonly child:Widget;
  constructor(child:Widget){super();this.child=child;protect(this,['child']);}
  createState():State<_SelectionKeepAlive>{return new _SelectionKeepAliveState();}
}
class _SelectionKeepAliveState extends AutomaticKeepAliveClientMixin<_SelectionKeepAlive> implements SelectionRegistrar {
  private _selectablesWithSelections:Set<Selectable>|null=null;
  private _selectableAttachments:Map<Selectable,()=>void>|null=null;
  private _registrar:SelectionRegistrar|null=null;
  private _wantKeepAlive=false;
  protected get wantKeepAlive():boolean{return this._wantKeepAlive;}
  private setWantKeepAlive(value:boolean):void{if(this._wantKeepAlive!==value){this._wantKeepAlive=value;this.updateKeepAlive();}}
  private listensTo(selectable:Selectable):()=>void{return ()=>this._updateSelectablesWithSelections(selectable,selectable.value.hasSelection);}
  private _updateSelectablesWithSelections(selectable:Selectable,add:boolean):void{if(add){invariant(selectable.value.hasSelection,'missing-selection-keep-alive','A selected keep-alive client must actually have selection');this._selectablesWithSelections??=new Set();this._selectablesWithSelections.add(selectable);}else this._selectablesWithSelections?.delete(selectable);this.setWantKeepAlive((this._selectablesWithSelections?.size??0)>0);}
  override didChangeDependencies():void{
    super.didChangeDependencies();const newRegistrar=SelectionContainer.maybeOf(this.context);
    if(this._registrar!==newRegistrar){const previous=this._registrar,errors:unknown[]=[];if(previous!==null)for(const selectable of this._selectableAttachments?.keys()??[])try{previous.remove(selectable);}catch(error){errors.push(error);}this._registrar=newRegistrar;if(newRegistrar!==null)for(const selectable of this._selectableAttachments?.keys()??[])try{newRegistrar.add(selectable);}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Selection keep-alive registrar transfer failed');}
  }
  add(selectable:Selectable):void{
    invariant(this._registrar!==null&&!this._selectableAttachments?.has(selectable),'invalid-selection-keep-alive-registration','Selectable needs one live parent registrar');
    const attachment=this.listensTo(selectable);selectable.addListener(attachment);this._selectableAttachments??=new Map();this._selectableAttachments.set(selectable,attachment);
    try{this._registrar.add(selectable);}catch(error){this._selectableAttachments.delete(selectable);selectable.removeListener(attachment);throw error;}
    if(selectable.value.hasSelection)this._updateSelectablesWithSelections(selectable,true);
  }
  remove(selectable:Selectable):void{
    if(this._selectableAttachments===null)return;const attachment=this._selectableAttachments.get(selectable);invariant(attachment!==undefined,'unknown-selection-keep-alive-client','Selectable must be registered before removal');this._selectableAttachments.delete(selectable);const errors:unknown[]=[];
    for(const release of [()=>selectable.removeListener(attachment),()=>this._registrar?.remove(selectable),()=>this._updateSelectablesWithSelections(selectable,false)])try{release();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Selection keep-alive client release failed');
  }
  override dispose():void{
    const errors:unknown[]=[];for(const [selectable,attachment]of this._selectableAttachments??[])for(const release of [()=>this._registrar?.remove(selectable),()=>selectable.removeListener(attachment)])try{release();}catch(error){errors.push(error);}this._selectableAttachments=null;this._selectablesWithSelections=null;this._registrar=null;try{super.dispose();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Selection keep-alive release failed');
  }
  override build(context:BuildContext):Widget{super.build(context);return this._registrar===null?this.widget.child:new SelectionRegistrarScope({registrar:this,child:this.widget.child});}
}
function _createErrorWidget(exception:unknown):Widget{const details=new FlutterErrorDetails({exception,stack:exceptionStack(exception),library:'widgets library',context:new ErrorDescription('building')});FlutterError.reportError(details);const widget=ErrorWidget.builder(details);invariant(widget instanceof Widget,'invalid-error-widget','ErrorWidget.builder must return a Widget');return widget;}
