// SPDX-License-Identifier: BSD-3-Clause
// Nelyx bounded route ownership, asynchronous Back guards and serializable named stacks.
import {ChangeNotifier} from '../../foundation/notifier.ts';
import {invariant} from '../../foundation/errors.ts';
import {ValueKey} from '../../foundation/key.ts';
import type {Key} from '../../foundation/key.ts';
import {Offstage as CanonicalOffstage} from './offstage.ts';
import type {KeyEvent} from '../../ui/input.ts';
import {StatefulWidget,State,Element,InheritedWidget} from './framework.ts';
import type {Widget,BuildContext} from './framework.ts';
import {Builder} from './basic.ts';
import {OverlayTheater} from './internal/overlay-theater.ts';
import {TickerMode} from './ticker-mode.ts';
import {RestorationOwner,RestorationScope,UnmanagedRestorationScope} from './restoration.ts';
import type {FocusNode} from './focus.ts';
import {FocusScope} from './focus-scope.ts';
import type {Disposable} from '../../foundation/disposable.ts';
import {FlutterError} from '../../foundation/flutter-error.ts';
import {FlutterErrorDetails} from '../../foundation/assertions.ts';
import type {RouteTransitionPolicy} from './route-transition-policy.ts';
import {NavigationTransitions} from './navigation-transitions.ts';
import {TickerProviderStateMixin} from './ticker-provider.ts';
import {IgnorePointer,AbsorbPointer} from './pointer-blocking.ts';
import {Semantics} from './semantics.ts';
import {SizedBox} from './basic.ts';
import {RepaintBoundary} from './repaint-boundary.ts';
export class Route<_T=unknown> {
  readonly token=Symbol('route');
  readonly argumentsValue:unknown;
  constructor(readonly builder:(context:BuildContext)=>Widget,readonly name='',argumentsValue:unknown=null,private readonly routeOpaque=true){this.argumentsValue=cloneRouteValue(argumentsValue);invariant(JSON.stringify(this.argumentsValue).length<=2*1024*1024,'route-state-budget','Route arguments exceed 2 Mi UTF-16 units');}
  get opaque():boolean{return this.routeOpaque;}
  get transitionPolicy():RouteTransitionPolicy|null{return null;}
  didPop(_result:unknown):boolean{return true;}
  didComplete(_result:unknown):void{}
  didChangePrevious(_previousRoute:Route|null):void{}
  didChangeNext(_nextRoute:Route|null):void{}
  didPopNext(_nextRoute:Route):void{}
}
export interface RouteEntry {readonly token:symbol;readonly builder:(context:BuildContext)=>Widget;readonly name:string;readonly argumentsValue:unknown;readonly opaque:boolean;readonly route:Route}
interface Entry extends RouteEntry {readonly complete:(value:unknown)=>void;readonly cancel:()=>void}
export interface RouteDescriptor {readonly name:string;readonly argumentsValue:unknown}
export type RouteResolver=(settings:RouteDescriptor)=>Route|null;
export type PopGuard=()=>boolean|PromiseLike<boolean>;
export interface RouteTransition {readonly from:symbol;readonly to:symbol;readonly direction:'push'|'pop'}
class RouteVisibility extends InheritedWidget {
  constructor(child:Widget,readonly isCurrent:boolean,readonly controller:NavigatorController,readonly token:symbol,readonly opaque:boolean,readonly isInteractive=isCurrent){super(child);}
  updateShouldNotify(old:this):boolean{return this.isCurrent!==old.isCurrent||this.isInteractive!==old.isInteractive||this.controller!==old.controller||this.token!==old.token||this.opaque!==old.opaque;}
}
/** Actual selected Navigator route state; full source ModalRoute remains separate. */
export function isCurrentRoute(context:BuildContext):boolean{return context.maybeDependOn(RouteVisibility)?.isCurrent??true;}
export function routeTokenOf(context:BuildContext):symbol|null{return context.maybeDependOn(RouteVisibility)?.token??null;}
/** Opacity of the enclosing mounted entry, including a route retained during pop. */
export function routeOpacityOf(context:BuildContext):boolean|null{return context.maybeDependOn(RouteVisibility)?.opaque??null;}
export class NavigatorController extends ChangeNotifier {
  private entries:Entry[]=[];
  private disposed=false;
  private revision=0;
  private consumer:object|undefined;
  get isAttached():boolean{return !this.disposed&&this.consumer!==undefined;}
  private readonly guards=new Map<symbol,Map<PopGuard,()=>boolean>>();
  hasBlockingPopGuard(token:symbol):boolean{return [...(this.guards.get(token)?.values()??[])].some(blocks=>blocks());}
  private pendingPop:Promise<boolean>|undefined;
  private readonly transitions=new Set<(transition:RouteTransition)=>void>();
  observeTransitions(listener:(transition:RouteTransition)=>void):()=>void{this.ensureAlive();this.transitions.add(listener);return ()=>{this.transitions.delete(listener);};}
  private transition(from:symbol|undefined,to:symbol|undefined,direction:'push'|'pop'):void{if(!from||!to)return;const snapshot1=[...this.transitions];for(const listener of snapshot1)if(this.transitions.has(listener))try{listener({from,to,direction});}catch(exception){FlutterError.reportError(new FlutterErrorDetails({exception,library:'widgets library'}));}}
  get routes():readonly RouteEntry[]{return Object.freeze(this.entries.map(({token,builder,name,argumentsValue,opaque,route})=>Object.freeze({token,builder,name,argumentsValue,opaque,route})));}
  private gestureCount=0;
  get userGestureInProgress():boolean{return this.gestureCount>0;}
  didStartUserGesture():void{this.ensureAlive();this.gestureCount++;if(this.gestureCount===1)this.notifyListeners();}
  didStopUserGesture():void{this.ensureAlive();invariant(this.gestureCount>0,'unbalanced-pop-gesture','No pop gesture is in progress');this.gestureCount--;if(this.gestureCount===0)this.notifyListeners();}
  get canPop():boolean{return this.entries.length>1;}
  get handlesBack():boolean{if(this.canPop)return true;const entry=this.entries.at(-1);return entry!==undefined&&!!this.guards.get(entry.token)?.size;}
  private namedResolver:RouteResolver|undefined;
  attach(owner:object,resolver?:RouteResolver):()=>void{this.ensureAlive();invariant(!this.consumer,'navigator-in-use','NavigatorController belongs to one mounted Navigator');this.consumer=owner;this.namedResolver=resolver;let live=true;return ()=>{if(live){live=false;if(this.consumer===owner){this.consumer=undefined;this.namedResolver=undefined;if(this.gestureCount>0){this.gestureCount=0;this.notifyListeners();}}}};}
  private namedRoute(name:string,argumentsValue:unknown):Route{this.ensureAlive();invariant(this.namedResolver,'missing-route-resolver','Named navigation requires a mounted Navigator route resolver');const route=this.namedResolver({name,argumentsValue:cloneRouteValue(argumentsValue)});invariant(route,'unknown-named-route','No route for '+name);return route;}
  pushNamed<T=unknown>(name:string,argumentsValue:unknown=null):Promise<T|undefined>{return this.push<T>(this.namedRoute(name,argumentsValue));}
  pushReplacement<T=unknown,R=unknown>(route:Route<T>,result?:R):Promise<T|undefined>{
    this.ensureAlive();invariant(this.entries.length>0&&!this.entries.some(entry=>entry.token===route.token),'invalid-route','Replacement requires a distinct route and initialized Navigator');const previous=this.entries.at(-1)!,index=this.entries.length-1;
    const promise=new Promise<T|undefined>((resolve,reject)=>{this.entries[index]=this.entry(route,value=>resolve(value as T|undefined),()=>reject(new Error('Navigator disposed before route completed')));});void promise.catch(()=>{});this.revision++;this.transition(previous.token,route.token,'push');
    try{this.notifyListeners();}catch(error){const current=this.entries.findIndex(entry=>entry.token===route.token);if(current>=0){this.entries.splice(current,1)[0]!.cancel();if(!this.entries.some(entry=>entry.token===previous.token))this.entries.splice(Math.min(index,this.entries.length),0,previous);}this.revision++;throw error;}
    this.guards.delete(previous.token);previous.complete(result);return promise;
  }
  pushReplacementNamed<T=unknown,R=unknown>(name:string,{argumentsValue=null,result}:{readonly argumentsValue?:unknown;readonly result?:R}={}):Promise<T|undefined>{return this.pushReplacement<T,R>(this.namedRoute(name,argumentsValue),result);}
  popAndPushNamed<T=unknown,R=unknown>(name:string,{argumentsValue=null,result}:{readonly argumentsValue?:unknown;readonly result?:R}={}):Promise<T|undefined>{const route=this.namedRoute(name,argumentsValue);this.pop(result);return this.push<T>(route);}
  private entry(route:Route,complete:(value:unknown)=>void=()=>{},cancel:()=>void=()=>{}):Entry{return {token:route.token,builder:route.builder,name:route.name,argumentsValue:route.argumentsValue,opaque:route.opaque,route,complete:value=>{route.didComplete(value);complete(value);},cancel};}
  initialize(route:Route):void{this.ensureAlive();invariant(!this.entries.length,'navigator-initialized','Navigator already has an initial route');this.entries=[this.entry(route)];this.revision++;}
  push<T>(route:Route<T>):Promise<T|undefined>{
    invariant(!this.disposed&&this.entries.length>0&&this.entries.length<32&&!this.entries.some(entry=>entry.token===route.token),'invalid-route','Navigator closed, uninitialized, full or route reused');
    const previous=this.entries.at(-1)?.token,promise=new Promise<T|undefined>((resolve,reject)=>{this.entries.push(this.entry(route,value=>resolve(value as T|undefined),()=>reject(new Error('Navigator disposed before route completed'))));});void promise.catch(()=>{});this.revision++;this.transition(previous,route.token,'push');try{this.notifyListeners();}catch(error){const index=this.entries.findIndex(e=>e.token===route.token);if(index>=0)this.entries.splice(index,1)[0]!.cancel();this.revision++;throw error;}return promise;
  }
  pop<T>(result?:T):boolean{if(!this.canPop||this.disposed)return false;const entry=this.entries.at(-1)!;if(!entry.route.didPop(result))return false;this.entries.pop();this.revision++;this.guards.delete(entry.token);this.transition(entry.token,this.entries.at(-1)?.token,'pop');try{this.notifyListeners();}finally{entry.complete(result);}return true;}
  /** A stale/denied Back is consumed; it must never pop a replacement route or escape to a parent. */
  maybePop<T>(result?:T):Promise<boolean>{if(this.pendingPop)return this.pendingPop;if(this.disposed)return Promise.resolve(false);const entry=this.entries.at(-1),revision=this.revision,guards=entry?[...(this.guards.get(entry.token)?.keys()??[])].reverse():[];if(!entry||!this.handlesBack)return Promise.resolve(false);const operation=(async()=>{for(const guard of guards){if(!this.guards.get(entry.token)?.has(guard))continue;if(!await guard())return true;if(this.disposed||revision!==this.revision)return true;}if(this.disposed||revision!==this.revision)return true;return this.pop(result);})();this.pendingPop=operation;void operation.finally(()=>{if(this.pendingPop===operation)this.pendingPop=undefined;}).catch(()=>{});return operation;}
  registerPopGuard(token:symbol,guard:PopGuard,{blocksGesture=()=>true}:{readonly blocksGesture?:()=>boolean}={}):()=>void{this.ensureAlive();invariant(this.entries.some(e=>e.token===token),'unknown-route','Pop guard requires a live route');const guards=this.guards.get(token)??new Map<PopGuard,()=>boolean>();guards.set(guard,blocksGesture);this.guards.set(token,guards);const changed=()=>{void Promise.resolve().then(()=>{if(!this.disposed)this.notifyListeners();}).catch(exception=>FlutterError.reportError(new FlutterErrorDetails({exception,library:'widgets navigation'})));};changed();let live=true;return ()=>{if(!live)return;live=false;guards.delete(guard);if(!guards.size)this.guards.delete(token);changed();};}
  replaceStack(routes:readonly Route[],{preserveCommonPrefix=false}:{readonly preserveCommonPrefix?:boolean}={}):void{this.ensureAlive();invariant(routes.length>0&&routes.length<=32&&new Set(routes.map(r=>r.token)).size===routes.length,'invalid-route-stack','Route stack requires 1..32 distinct routes');const old=this.entries;let prefix=preserveCommonPrefix;const next=routes.map((route,index)=>{const previous=old[index];prefix=prefix&&!!previous&&previous.name===route.name&&JSON.stringify(cloneRouteValue(previous.argumentsValue))===JSON.stringify(cloneRouteValue(route.argumentsValue));return prefix?{...previous!,builder:route.builder,opaque:route.opaque}:old.find(e=>e.token===route.token)??this.entry(route);});invariant(new Set(next.map(e=>e.token)).size===next.length,'invalid-route-stack','Route prefix preservation would duplicate a route');this.entries=next;this.revision++;for(const e of old)if(!this.entries.some(next=>next.token===e.token)){this.guards.delete(e.token);e.complete(undefined);}this.notifyListeners();}
  snapshot():string{const snapshot=JSON.stringify({version:1,routes:this.entries.map(e=>({name:e.name,argumentsValue:cloneRouteValue(e.argumentsValue)}))});invariant(snapshot.length<=2*1024*1024,'route-snapshot-budget','Route snapshot exceeds 2 Mi UTF-16 units');return snapshot;}
  restore(snapshot:string,resolver:RouteResolver):void{invariant(snapshot.length<=2*1024*1024,'route-snapshot-budget','Route snapshot exceeds 2 Mi UTF-16 units');const decoded:unknown=JSON.parse(snapshot);invariant(!!decoded&&typeof decoded==='object'&&'version' in decoded&&decoded.version===1&&'routes' in decoded&&Array.isArray(decoded.routes)&&decoded.routes.length>0&&decoded.routes.length<=32,'invalid-route-snapshot','Expected route snapshot v1');const routes=decoded.routes.map((entry:unknown)=>{invariant(!!entry&&typeof entry==='object'&&'name' in entry&&typeof entry.name==='string','invalid-route-snapshot','Route needs a name');const route=resolver({name:entry.name,argumentsValue:cloneRouteValue('argumentsValue' in entry?entry.argumentsValue:null)});invariant(route,'unknown-restored-route','No route for restored name '+entry.name);return route;});this.replaceStack(routes);}
  override dispose():void{if(this.disposed)return;invariant(!this.consumer,'navigator-in-use','Unmount Navigator before disposing its controller');super.dispose();this.disposed=true;this.revision++;const entries=this.entries;this.entries=[];this.guards.clear();this.transitions.clear();for(const entry of entries)entry.cancel();}
}
/** Browser history and route restoration accept bounded JSON data, not object identities. */
export function cloneRouteValue(value:unknown,depth=0):unknown{invariant(depth<=32,'route-state-depth','Route state is too deeply nested');if(value===null||typeof value==='boolean'||typeof value==='string')return value;if(typeof value==='number'){invariant(Number.isFinite(value),'invalid-route-number','Route state numbers must be finite');return value;}if(Array.isArray(value))return Object.freeze(value.map(item=>cloneRouteValue(item,depth+1)));invariant(!!value&&typeof value==='object'&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null),'invalid-route-state','Route state must contain JSON values');const result:Record<string,unknown>=Object.create(null);for(const [key,item]of Object.entries(value))result[key]=cloneRouteValue(item,depth+1);return Object.freeze(result);}
export class Navigator extends StatefulWidget {
  constructor(readonly controller:NavigatorController,readonly initialRoute:Route,key:Key|null=null,readonly options:{readonly restorationId?:string;readonly onGenerateRoute?:RouteResolver}={}){super(key);invariant(options.restorationId===undefined||options.onGenerateRoute,'missing-route-resolver','Restorable Navigator requires a route resolver');}
  static maybeOf(context:BuildContext,{rootNavigator=false}:{readonly rootNavigator?:boolean}={}):NavigatorController|null{
    let result=context instanceof Element&&context.stateObject instanceof NavigatorState?context.stateObject.widget.controller:null;
    if(result===null||rootNavigator)context.visitAncestorElements(element=>{if(element.stateObject instanceof NavigatorState){result=element.stateObject.widget.controller;return rootNavigator;}return true;});
    return result;
  }
  static of(context:BuildContext,options:{readonly rootNavigator?:boolean}={}):NavigatorController{const controller=this.maybeOf(context,options);invariant(controller,'missing-navigator','Navigator.of requires a Navigator ancestor');return controller;}
  createState():State{return new NavigatorState();}
}
class NavigatorState extends TickerProviderStateMixin<Navigator> {
  private readonly transitionOwner=new NavigationTransitions(this,()=>{if(this.mounted){this.updateSystemBack(this.active&&(this.reversing||this.widget.controller.handlesBack));this.setState(()=>{});}},()=>this.widget.controller.userGestureInProgress,token=>this.widget.controller.canPop&&!this.widget.controller.hasBlockingPopGuard(token),exception=>FlutterError.reportError(new FlutterErrorDetails({exception,library:'widgets navigation transitions'})),()=>this.widget.controller);
  private restoring=false;
  private readonly persistence=new RestorationOwner(this,(bucket,_initial,needsRestore)=>{const snapshot=bucket?.read('routes');if(needsRestore&&snapshot!==null&&snapshot!==undefined){invariant(typeof snapshot==='string','invalid-route-snapshot','Stored route stack must be a string');this.restoring=true;try{this.widget.controller.restore(snapshot,this.widget.options.onGenerateRoute!);}finally{this.restoring=false;}}if(bucket)bucket.write('routes',this.widget.controller.snapshot());});
  private releaseController:(()=>void)|undefined;
  private active=true;
  private systemBack:Disposable|undefined;
  private updateSystemBack(handles:boolean|null):void{const services=this.context.services.platformServices;if(!services||services.isClosed)return;void services.updateBackOwner(this,handles).catch(exception=>FlutterError.reportError(new FlutterErrorDetails({exception,library:'widgets library'})));}
  private previous:readonly symbol[]=[];
  private restoration=new Map<symbol,FocusNode>();
  private pendingRestoration:{readonly token:symbol;readonly focus:FocusNode}|undefined;
  private get reversing():boolean{return this.transitionOwner.entries.at(-1)?.token!==this.widget.controller.routes.at(-1)?.token;}
  private handleBack():Promise<boolean>{return this.reversing?Promise.resolve(true):this.widget.controller.maybePop();}
  private readonly routesChanged=()=>{
    this.transitionOwner.reconcile(this.widget.controller.routes,this.context);
    if(this.context instanceof Element){const routes=this.widget.controller.routes,tokens=routes.map(entry=>entry.token),owner=this.context.owner;
      if(tokens.length>this.previous.length){this.pendingRestoration=undefined;const focus=owner.focus.primaryFocus??owner.focus.lastFocus;if(focus)this.restoration.set(tokens[tokens.length-1]!,focus);}
      else if(tokens.length<this.previous.length){const token=this.previous[this.previous.length-1]!,focus=this.restoration.get(token);this.restoration.delete(token);this.pendingRestoration=focus&&tokens.length?{token:tokens[tokens.length-1]!,focus}:undefined;}
      this.previous=tokens;
    }if(!this.restoring)this.persistence.bucket?.write('routes',this.widget.controller.snapshot());this.updateSystemBack(this.active&&(this.reversing||this.widget.controller.handlesBack));this.setState(()=>{});
  };
  private readonly back=(event:KeyEvent)=>{if(!this.active||event.kind!=='down'||event.repeat||!['Escape','BrowserBack','GoBack'].includes(event.key)||!(this.reversing||this.widget.controller.handlesBack))return false;void this.handleBack().catch(exception=>FlutterError.reportError(new FlutterErrorDetails({exception,library:'widgets library'})));return true;};
  override initState():void{try{this.releaseController=this.widget.controller.attach(this,settings=>this.widget.options.onGenerateRoute?.(settings)??null);if(!this.widget.controller.routes.length)this.widget.controller.initialize(this.widget.initialRoute);this.previous=this.widget.controller.routes.map(entry=>entry.token);this.transitionOwner.reconcile(this.widget.controller.routes,this.context,true);this.widget.controller.addListener(this.routesChanged);invariant(this.context instanceof Element,'invalid-context','Navigator requires Element');this.context.owner.keyHandlers.add(this.back);this.systemBack=this.context.services.platformServices?.addObserver({didPopRoute:()=>this.active?this.handleBack():false});this.updateSystemBack(this.widget.controller.handlesBack);}catch(error){try{this.dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Navigator initialization cleanup failed');}throw error;}}
  override didChangeDependencies():void{this.active=this.context.maybeDependOn(RouteVisibility)?.isInteractive??true;this.persistence.update(this.context,this.widget.options.restorationId??null);this.updateSystemBack(this.active&&(this.reversing||this.widget.controller.handlesBack));}
  override didUpdateWidget(old:Navigator):void{invariant(old.controller===this.widget.controller,'navigator-controller-change','Changing NavigatorController requires remount');this.persistence.update(this.context,this.widget.options.restorationId??null);}
  override dispose():void{const back=this.systemBack,release=this.releaseController;this.systemBack=undefined;this.releaseController=undefined;const errors:unknown[]=[];for(const cleanup of [()=>this.widget.controller.removeListener(this.routesChanged),()=>back?.dispose(),()=>this.updateSystemBack(null),()=>{this.restoration.clear();this.pendingRestoration=undefined;},()=>{if(this.context instanceof Element)this.context.owner.keyHandlers.delete(this.back);},()=>release?.(),()=>this.persistence.dispose(),()=>this.transitionOwner.dispose(),()=>super.dispose()])try{cleanup();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Navigator cleanup failed');}
  build():Widget{
    const routes=this.transitionOwner.entries,firstVisible=this.transitionOwner.firstVisibleIndex(),current=this.widget.controller.routes.at(-1)?.token,top=routes.at(-1)?.token;
    const pending=this.pendingRestoration;
    if(pending&&top===current&&pending.token===current&&this.context instanceof Element){this.pendingRestoration=undefined;this.context.owner.postFrame(()=>{if(this.mounted&&!this.reversing&&this.widget.controller.routes.at(-1)?.token===pending.token&&pending.focus.attached)pending.focus.requestFocus();});}
    const tree=new OverlayTheater(routes.map((entry,index)=>{
      const active=this.active&&entry.token===current,interactive=active&&entry.token===top,offstage=index<firstVisible,policy=entry.route.transitionPolicy;
      let child:Widget=offstage&&policy?.maintainState===false?new SizedBox():this.transitionOwner.page(entry);
      if(this.widget.options.restorationId!==undefined)child=new RestorationScope({restorationId:'route-'+index,child});
      const page=child;
      child=new Builder(context=>this.transitionOwner.wrap(entry,context,page,()=>{void this.widget.controller.maybePop().catch(exception=>FlutterError.reportError(new FlutterErrorDetails({exception,library:'widgets route barrier'})));}));
      // A popped route keeps paint ownership through reverse. Its absorption
      // barrier stays above the underlay while all route actions/focus retire.
      child=new IgnorePointer(new AbsorbPointer(new Semantics({excludeSemantics:!interactive,child}),{absorbing:entry.token===top&&entry.token!==current}),{ignoring:!this.active||entry.token!==top});
      // Keep route motion local. Outside Offstage, the boundary can also replace
      // its recording with an empty one when a covered route hides its snapshots.
      return new RepaintBoundary(new Offstage(new RouteVisibility(new TickerMode(policy?this.active&&!offstage:active,new FocusScope(child,{autofocus:interactive&&policy?.requestFocus!==false,canRequestFocus:interactive,descendantsAreFocusable:interactive,descendantsAreTraversable:interactive,skipTraversal:true,includeSemantics:false,traversalEdgeBehavior:policy?.traversalEdgeBehavior??null,directionalTraversalEdgeBehavior:policy?.directionalTraversalEdgeBehavior??null})),active,this.widget.controller,entry.token,entry.opaque,interactive),offstage),new SymbolKey(entry.token));
    }),firstVisible,'hardEdge');
    return this.widget.options.restorationId===undefined?tree:new UnmanagedRestorationScope({bucket:this.persistence.bucket,child:tree});
  }
}
export class PopScope extends StatefulWidget {constructor(readonly options:{readonly child:Widget;readonly canPop?:boolean;readonly onWillPop?:PopGuard;readonly key?:Key|null}){super(options.key??null);}createState():State{return new PopScopeState();}}
class PopScopeState extends State<PopScope>{private release:(()=>void)|undefined;private route:RouteVisibility|undefined;private readonly guard=()=>this.widget.options.canPop===false?false:this.widget.options.onWillPop?.()??true;override didChangeDependencies():void{const route=this.context.dependOn(RouteVisibility);if(this.route?.token===route.token&&this.route.controller===route.controller)return;this.release?.();this.route=route;this.release=route.controller.registerPopGuard(route.token,this.guard,{blocksGesture:()=>this.widget.options.canPop===false||this.widget.options.onWillPop!==undefined});}override deactivate():void{this.release?.();this.release=undefined;this.route=undefined;super.deactivate();}override dispose():void{this.release?.();super.dispose();}build():Widget{return this.widget.options.child;}}
class SymbolKey extends ValueKey<string>{constructor(readonly token:symbol){super('route',token);}}
/** Legacy navigation constructor; uses the canonical source-backed offstage renderer. */
export class Offstage extends CanonicalOffstage {constructor(child:Widget,offstage:boolean,key:Key|null=null){super(child,{offstage,key});}}
