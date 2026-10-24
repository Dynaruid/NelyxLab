// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Source overlay entry ownership/visibility with the actual bounded View theater.
import {ChangeNotifier} from '../../foundation/notifier.ts';
import {invariant} from '../../foundation/errors.ts';
import type {Key} from '../../foundation/key.ts';
import {GlobalKey} from './global-key.ts';
import {StatefulWidget,State} from './framework.ts';
import type {Widget,BuildContext} from './framework.ts';
import {TickerMode} from './ticker-mode.ts';
import {maybeTickerScheduler} from './ticker-scheduler.ts';
import type {Clip} from '../../ui/clip.ts';
import {OverlayTheater} from './internal/overlay-theater.ts';
export interface OverlayEntryOptions {readonly builder:(context:BuildContext)=>Widget;readonly opaque?:boolean;readonly maintainState?:boolean}
export class OverlayEntry extends ChangeNotifier {
  readonly builder:(context:BuildContext)=>Widget;private opaqueValue:boolean;private maintainStateValue:boolean;private disposedByOwner=false;
  /** Actual library collaboration; no process-wide overlay registry. */
  overlay:OverlayState|null=null;entryWidgetState:OverlayEntryWidgetState|null=null;readonly key=new GlobalKey<OverlayEntryWidgetState>('OverlayEntry');
  constructor({builder,opaque=false,maintainState=false}:OverlayEntryOptions){super();this.builder=builder;this.opaqueValue=opaque;this.maintainStateValue=maintainState;}
  private checkOpen():void{invariant(!this.disposedByOwner,'disposed-overlay-entry','OverlayEntry has been disposed');}
  assertUnowned():void{this.checkOpen();invariant(this.overlay===null,'owned-overlay-entry','Overlay entry is already owned');}
  get opaque():boolean{return this.opaqueValue;}
  set opaque(value:boolean){this.checkOpen();if(value!==this.opaqueValue){this.opaqueValue=value;this.overlay?.didChangeEntryOpacity();}}
  get maintainState():boolean{return this.maintainStateValue;}
  set maintainState(value:boolean){this.checkOpen();if(value!==this.maintainStateValue){invariant(this.overlay,'unowned-overlay-entry','Changing maintainState requires an inserted entry');this.maintainStateValue=value;this.overlay.didChangeEntryOpacity();}}
  get mounted():boolean{return this.entryWidgetState!==null;}
  override addListener(listener:()=>void):void{this.checkOpen();super.addListener(listener);}
  remove():void{this.checkOpen();const owner=this.overlay;invariant(owner,'unowned-overlay-entry','Remove requires an inserted entry');this.overlay=null;owner.removeEntry(this);}
  markNeedsBuild():void{this.checkOpen();this.entryWidgetState?.markEntryDirty();}
  didMount(state:OverlayEntryWidgetState):void{invariant(this.entryWidgetState===null,'duplicate-overlay-mount','An entry cannot mount twice');this.entryWidgetState=state;this.notifyListeners();}
  didUnmount(state:OverlayEntryWidgetState):void{if(this.entryWidgetState!==state)return;this.entryWidgetState=null;try{this.notifyListeners();}finally{if(this.disposedByOwner)super.dispose();}}
  override dispose():void{this.checkOpen();invariant(this.overlay===null,'inserted-overlay-dispose','Remove an entry before disposing it');this.disposedByOwner=true;if(!this.mounted)super.dispose();}
}
class OverlayEntryWidget extends StatefulWidget {
  constructor(readonly entry:OverlayEntry,readonly tickerEnabled:boolean){super(entry.key);}
  createState():State{return new OverlayEntryWidgetState();}
}
class OverlayEntryWidgetState extends State<OverlayEntryWidget> {
  private pendingDirty=false;
  override initState():void{this.widget.entry.didMount(this);}
  markEntryDirty():void{if(!this.mounted)return;const scheduler=maybeTickerScheduler(this.context);if(scheduler&&['persistent','build','layout','paint','semantics'].includes(scheduler.phase)){if(this.pendingDirty)return;this.pendingDirty=true;scheduler.addPostFrameCallback(()=>{this.pendingDirty=false;if(this.mounted&&this.context.mounted)this.setState(()=>{});},{debugLabel:'OverlayEntry.markNeedsBuild'});}else this.setState(()=>{});}
  override dispose():void{this.widget.entry.didUnmount(this);}
  build(context:BuildContext):Widget{return new TickerMode(this.widget.tickerEnabled,this.widget.entry.builder(context));}
}
export interface OverlayOptions {readonly initialEntries?:readonly OverlayEntry[];readonly clipBehavior?:Clip;readonly key?:Key|null}
export class Overlay extends StatefulWidget {
  readonly initialEntries:readonly OverlayEntry[];readonly clipBehavior:Clip;
  constructor(options:OverlayOptions={}){super(options.key??null);this.initialEntries=Object.freeze([...(options.initialEntries??[])]);this.clipBehavior=options.clipBehavior??'hardEdge';}
  createState():OverlayState{return new OverlayState();}
  static maybeOf(context:BuildContext,{rootOverlay=false}:{readonly rootOverlay?:boolean}={}):OverlayState|null{let result:OverlayState|null=null;context.visitAncestorElements(element=>{if(element.stateObject instanceof OverlayState&&element.stateObject.isActive){result=element.stateObject;return rootOverlay;}return true;});return result;}
  static of(context:BuildContext,options:{readonly rootOverlay?:boolean}={}):OverlayState{const state=this.maybeOf(context,options);invariant(state,'missing-overlay','Overlay.of requires an actual Overlay ancestor');return state;}
}
export interface OverlayInsertOptions {readonly below?:OverlayEntry|null;readonly above?:OverlayEntry|null}
export class OverlayState extends State<Overlay> {
  private readonly entries:OverlayEntry[]=[];private retiring=false;private pendingRemovalBuild=false;
  get isActive():boolean{return this.mounted&&!this.retiring&&this.context.mounted;}
  override initState():void{const entries=this.widget.initialEntries;invariant(new Set(entries).size===entries.length,'duplicate-overlay-entry','Initial entries must be distinct');for(const entry of entries)entry.assertUnowned();for(const entry of entries){entry.overlay=this;this.entries.push(entry);}}
  private insertionIndex({below=null,above=null}:OverlayInsertOptions):number{invariant(below===null||above===null,'ambiguous-overlay-insertion','Specify above or below, not both');const neighbor=below??above;if(neighbor===null)return this.entries.length;invariant(neighbor.overlay===this&&this.entries.includes(neighbor),'foreign-overlay-neighbor','Insertion neighbor must belong to this overlay');return this.entries.indexOf(neighbor)+(above===null?0:1);}
  insert(entry:OverlayEntry,options:OverlayInsertOptions={}):void{entry.assertUnowned();invariant(this.isActive&&!this.entries.includes(entry),'duplicate-overlay-entry','Entry is already owned or overlay is unmounted');const index=this.insertionIndex(options);this.setState(()=>{entry.overlay=this;this.entries.splice(index,0,entry);});}
  insertAll(entries:Iterable<OverlayEntry>,options:OverlayInsertOptions={}):void{const values=[...entries];for(const entry of values)entry.assertUnowned();invariant(this.isActive&&new Set(values).size===values.length&&values.every(entry=>!this.entries.includes(entry)),'duplicate-overlay-entry','All entries require distinct ownership');const index=this.insertionIndex(options);this.setState(()=>{for(const entry of values)entry.overlay=this;this.entries.splice(index,0,...values);});}
  removeEntry(entry:OverlayEntry):void{const index=this.entries.indexOf(entry);if(index<0)return;this.entries.splice(index,1);if(!this.isActive)return;const scheduler=maybeTickerScheduler(this.context);if(scheduler&&['persistent','build','layout','paint','semantics'].includes(scheduler.phase)){if(this.pendingRemovalBuild)return;this.pendingRemovalBuild=true;scheduler.addPostFrameCallback(()=>{this.pendingRemovalBuild=false;if(this.isActive)this.setState(()=>{});},{debugLabel:'OverlayEntry.remove'});}else this.setState(()=>{});}
  didChangeEntryOpacity():void{if(this.isActive)this.setState(()=>{});}
  debugIsVisible(entry:OverlayEntry):boolean{invariant(entry.overlay===this&&this.entries.includes(entry),'foreign-overlay-entry','Entry must belong to this overlay');for(let index=this.entries.length-1;index>=0;index--){const current=this.entries[index]!;if(current===entry)return true;if(current.opaque)return false;}return false;}
  override dispose():void{this.retiring=true;for(const entry of this.entries)if(entry.overlay===this)entry.overlay=null;this.entries.length=0;}
  build():Widget{const children:Widget[]=[];let onstage=true,onstageCount=0;for(const entry of [...this.entries].reverse()){if(onstage){onstageCount++;children.push(new OverlayEntryWidget(entry,true));if(entry.opaque)onstage=false;}else if(entry.maintainState)children.push(new OverlayEntryWidget(entry,false));}return new OverlayTheater(children.reverse(),children.length-onstageCount,this.widget.clipBehavior);}
}
