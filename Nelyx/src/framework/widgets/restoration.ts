// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Scope ownership adapted from widgets/restoration.dart at 71e4717a61786faab4c7aa39825989305ed29e8a.
import {StatefulWidget,State,InheritedWidget} from './framework.ts';import type {Widget,BuildContext,WidgetOptions} from './framework.ts';
import {RestorationBucket} from '../../services/restoration.ts';import type {RestorationManager} from '../../services/restoration.ts';
import {invariant} from '../../foundation/errors.ts';
import {tickerScheduler} from './ticker-scheduler.ts';
import {SizedBox} from './basic.ts';
import {ChangeNotifier} from '../../foundation/notifier.ts';
import {FlutterError} from '../../foundation/flutter-error.ts';
import {FlutterErrorDetails} from '../../foundation/assertions.ts';
export class UnmanagedRestorationScope extends InheritedWidget {
  readonly bucket:RestorationBucket|null;
  constructor({bucket=null,child,...options}:WidgetOptions&{readonly bucket?:RestorationBucket|null;readonly child:Widget}){super(child,options.key??null);this.bucket=bucket;}
  updateShouldNotify(old:this):boolean{return this.bucket!==old.bucket;}
}
export class RestorationScope extends StatefulWidget {
  constructor(readonly options:WidgetOptions&{readonly restorationId:string|null;readonly child:Widget}){super(options.key??null);}
  static maybeOf(context:BuildContext):RestorationBucket|null{return context.maybeDependOn(UnmanagedRestorationScope)?.bucket??null;}
  static of(context:BuildContext):RestorationBucket{const bucket=this.maybeOf(context);invariant(bucket,'missing-restoration-scope','RestorationScope.of requires an enabled restoration scope');return bucket;}
  createState():State{return new RestorationScopeState();}
}
/** Internal shared lifecycle adapter also used by Scrollable's TickerProvider State. */
export class RestorationOwner {
  private parent:RestorationBucket|null=null;private generation:unknown=null;private manager:RestorationManager|null=null;private current:RestorationBucket|null=null;private initialized=false;
  constructor(private readonly owner:object,private readonly restore:(bucket:RestorationBucket|null,initialRestore:boolean,needsRestore:boolean)=>void){}
  get bucket():RestorationBucket|null{return this.current;}
  update(context:BuildContext,id:string|null):void{
    const parent=RestorationScope.maybeOf(context),generation=parent?._restorationGeneration??null,manager=parent?._restorationManager??null,initial=!this.initialized;
    const needsRestore=initial||id!==null&&parent!==this.parent&&parent!==null&&(parent.isReplacing||manager===this.manager&&generation!==this.generation);this.initialized=true;
    if(this.parent===parent&&this.generation===generation){if(id===this.current?.restorationId)return;if(id!==null&&this.current){this.current.rename(id);return;}}
    const old=this.current;this.current=null;
    if(parent!==null&&id!==null){
      if(old!==null&&!needsRestore){old.rename(id);parent.adoptChild(old);this.current=old;}
      else this.current=parent.claimChild(id,{debugOwner:this.owner});
    }
    this.parent=parent;this.generation=generation;this.manager=manager;
    try{if(initial||this.current!==old)this.restore(this.current,initial,needsRestore);}finally{if(old!==null&&old!==this.current)old.dispose();}
  }
  dispose():void{this.current?.dispose();this.current=null;this.parent=null;}
}
class RestorationScopeState extends State<RestorationScope> {
  private readonly restoration=new RestorationOwner(this,()=>{});
  override didChangeDependencies():void{super.didChangeDependencies();this.restoration.update(this.context,this.widget.options.restorationId);}
  override didUpdateWidget(old:RestorationScope):void{super.didUpdateWidget(old);this.restoration.update(this.context,this.widget.options.restorationId);}
  build(_context:BuildContext):Widget{return new UnmanagedRestorationScope({bucket:this.restoration.bucket,child:this.widget.options.child});}
  override dispose():void{this.restoration.dispose();super.dispose();}
}
export interface RootRestorationScopeOptions extends WidgetOptions {readonly restorationId:string|null;readonly child:Widget;readonly manager?:RestorationManager}
export class RootRestorationScope extends StatefulWidget {
  constructor(readonly options:RootRestorationScopeOptions){super(options.key??null);}
  createState():State{return new RootRestorationScopeState();}
}
class RootRestorationScopeState extends State<RootRestorationScope> {
  private manager:RestorationManager|null=null;private bucket:RestorationBucket|null=null;private request=0;private waiting=false;
  private readonly changed=()=>{if(this.mounted&&this.manager)this.setState(()=>{this.bucket=this.manager!.currentRootBucket;this.waiting=false;});};
  private updateManager():void{
    const next=this.widget.options.manager??this.context.services.platformServices?.restorationManager??null;
    if(this.widget.options.restorationId!==null)invariant(next,'missing-restoration-manager','RootRestorationScope requires this application ServicesBinding or an explicit manager');
    if(next===this.manager)return;this.manager?.removeListener(this.changed);this.manager=next;this.bucket=null;this.waiting=next!==null;const request=++this.request;
    if(next){next.addListener(this.changed);void next.rootBucket.then(async bucket=>{if(this.mounted&&request===this.request){this.setState(()=>{this.bucket=bucket;this.waiting=false;});await next.flushData();}}).catch(exception=>{if(this.mounted&&request===this.request){this.setState(()=>{this.waiting=false;});FlutterError.reportError(new FlutterErrorDetails({exception,library:'widgets restoration'}));}});}
  }
  override didChangeDependencies():void{super.didChangeDependencies();this.updateManager();}
  override didUpdateWidget(old:RootRestorationScope):void{super.didUpdateWidget(old);this.updateManager();}
  build(context:BuildContext):Widget{if(this.waiting&&this.widget.options.restorationId!==null)return SizedBox.shrink();if(this.manager?.isReplacing){const manager=this.manager;tickerScheduler(context).addPostFrameCallback(()=>manager._didFinishRestoration());}return new UnmanagedRestorationScope({bucket:this.bucket,child:new RestorationScope({restorationId:this.widget.options.restorationId,child:this.widget.options.child})});}
  override dispose():void{this.request++;this.manager?.removeListener(this.changed);this.manager=null;super.dispose();}
}
/** Typed values use the existing bucket codec; registration remains owned by a State. */
export abstract class RestorableProperty<T> extends ChangeNotifier {
  abstract get value():T;abstract set value(value:T);abstract toPrimitives():unknown;abstract restore(value:unknown):void;abstract reset():void;
}
export class RestorableValue<T> extends RestorableProperty<T> {
  private current:T;
  constructor(readonly defaultValue:T,private readonly decode:(value:unknown)=>T){super();this.current=decode(defaultValue);}
  get value():T{return this.current;}set value(value:T){this.ensureAlive();const next=this.decode(value);if(Object.is(next,this.current))return;this.current=next;this.notifyListeners();}
  toPrimitives():unknown{return this.current;}restore(value:unknown):void{this.value=this.decode(value);}reset():void{this.value=this.defaultValue;}
}
export class RestorableInt extends RestorableValue<number>{constructor(value:number){super(value,item=>{invariant(typeof item==='number'&&Number.isSafeInteger(item),'invalid-restored-int','Expected safe integer restoration value');return item;});}}
export class RestorableDouble extends RestorableValue<number>{constructor(value:number){super(value,item=>{invariant(typeof item==='number'&&Number.isFinite(item),'invalid-restored-double','Expected finite restoration value');return item;});}}
export class RestorableBool extends RestorableValue<boolean>{constructor(value:boolean){super(value,item=>{invariant(typeof item==='boolean','invalid-restored-bool','Expected boolean restoration value');return item;});}}
export class RestorableString extends RestorableValue<string>{constructor(value:string){super(value,item=>{invariant(typeof item==='string'&&item.length<=1024*1024,'invalid-restored-string','Expected bounded string restoration value');return item;});}}
/** TypeScript State superclass adaptation. Properties are caller-owned and may be reused after unregister. */
export abstract class RestorationMixin<W extends StatefulWidget=StatefulWidget> extends State<W> {
  abstract get restorationId():string|null;
  abstract restoreState(oldBucket:RestorationBucket|null,initialRestore:boolean):void;
  private readonly registered=new Map<RestorableProperty<unknown>,{id:string;changed:()=>void}>();
  private restoring=false;
  private readonly restoration=new RestorationOwner(this,(bucket,initial,needsRestore)=>{if(needsRestore){this.restoring=true;try{for(const [property,{id}]of this.registered){if(bucket?.contains(id))property.restore(bucket.read(id));else property.reset();}this.restoreState(bucket,initial);}finally{this.restoring=false;}for(const [property,{id}]of this.registered)bucket?.write(id,property.toPrimitives());}});
  get bucket():RestorationBucket|null{return this.restoration.bucket;}
  registerForRestoration<T>(property:RestorableProperty<T>,restorationId:string):void{invariant(![...this.registered].some(([other,entry])=>other!==property&&entry.id===restorationId),'duplicate-restorable-property','Restoration property IDs must be unique');const previous=this.registered.get(property);if(previous){invariant(previous.id===restorationId,'restoration-property-rename','Unregister before changing a property ID');return;}if(this.bucket?.contains(restorationId))property.restore(this.bucket.read(restorationId));const changed=()=>{if(!this.restoring)this.bucket?.write(restorationId,property.toPrimitives());};property.addListener(changed);this.registered.set(property,{id:restorationId,changed});if(!this.restoring)changed();}
  unregisterFromRestoration(property:RestorableProperty<unknown>):void{const entry=this.registered.get(property);if(!entry)return;property.removeListener(entry.changed);this.registered.delete(property);this.bucket?.remove(entry.id);}
  override didChangeDependencies():void{super.didChangeDependencies();this.restoration.update(this.context,this.restorationId);}
  override didUpdateWidget(old:W):void{super.didUpdateWidget(old);this.restoration.update(this.context,this.restorationId);}
  override dispose():void{for(const [property,entry]of this.registered)property.removeListener(entry.changed);this.registered.clear();this.restoration.dispose();super.dispose();}
}
