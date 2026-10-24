// SPDX-License-Identifier: BSD-3-Clause
// Nelyx latest-request-wins routing. Parsing is pure; only the winning result may mutate navigation.
import {ChangeNotifier} from '../../foundation/notifier.ts';
import {invariant} from '../../foundation/errors.ts';
import type {Disposable} from '../../foundation/disposable.ts';
import {SystemNavigator} from '../../services/system-navigator.ts';
import {MethodChannel} from '../../services/platform-channel.ts';
import {JSONMethodCodec} from '../../services/message-codecs.ts';
import {MissingPluginException} from '../../services/message-codec.ts';
import {ObjectKey} from '../../foundation/key.ts';
import type {ServicesBinding} from '../../services/binding.ts';
import {StatefulWidget,State,Element} from './framework.ts';
import type {Widget,BuildContext,WidgetOptions} from './framework.ts';
import {Navigator,NavigatorController,Route,cloneRouteValue,isCurrentRoute} from './navigation.ts';

function fromCodec(value:unknown,depth=0):unknown{invariant(depth<=32,'route-state-depth','Route state is too deeply nested');if(value instanceof Map){const out:Record<string,unknown>=Object.create(null);for(const [key,item]of value){invariant(typeof key==='string','invalid-route-state','Route state map keys must be strings');out[key]=fromCodec(item,depth+1);}return out;}if(Array.isArray(value))return value.map(item=>fromCodec(item,depth+1));return value;}
function freezeData(value:unknown):unknown{if(value&&typeof value==='object'){for(const item of Object.values(value))freezeData(item);Object.freeze(value);}return value;}
export class RouteInformation {
  readonly uri:string;readonly state:unknown;
  constructor({uri,state=null}:{readonly uri:string;readonly state?:unknown}){invariant(typeof uri==='string'&&uri.length>0&&uri.length<=8192,'invalid-route-uri','Route URI must contain 1..8192 characters');this.uri=uri;this.state=freezeData(cloneRouteValue(fromCodec(state)));invariant(JSON.stringify(this.state).length<=2*1024*1024,'route-state-budget','Route state exceeds budget');Object.freeze(this);}
}
export class RouteInformationProvider extends ChangeNotifier {
  private current:RouteInformation;
  constructor(initial:RouteInformation){super();this.current=initial;}
  get value():RouteInformation{return this.current;}
  /** False means a native host supplied no URI; retain the delegate/restored fallback. */
  get hasRouteInformation():boolean{return true;}
  setValue(value:RouteInformation):void{this.ensureAlive();this.current=value;this.notifyListeners();}
  async routerReportsNewRouteInformation(value:RouteInformation,{replace=false}:{readonly replace?:boolean}={}):Promise<void>{void replace;this.ensureAlive();this.current=value;}
}
export class PlatformRouteInformationProvider extends RouteInformationProvider {
  private observer:Disposable;
  private epoch=0;
  private live=true;private available:boolean;
  override get hasRouteInformation():boolean{return this.available;}
  readonly ready:Promise<void>;
  constructor(readonly services:ServicesBinding,initial?:RouteInformation){
    super(initial??new RouteInformation({uri:'/'}));this.available=initial!==undefined;this.observer=services.addObserver({didPushRoute:uri=>{this.epoch++;this.setValue(new RouteInformation({uri}));return true;},didPushRouteInformation:information=>{this.epoch++;this.setValue(new RouteInformation(information));return true;}});
    const epoch=this.epoch;this.ready=new MethodChannel('flutter/navigation',new JSONMethodCodec(),services.defaultBinaryMessenger).invokeMethod('getRouteInformation').then(value=>{if(!this.live||epoch!==this.epoch||value===null)return;invariant(value instanceof Map&&typeof value.get('uri')==='string','invalid-route-information','Initial route response requires URI');this.setValue(new RouteInformation({uri:value.get('uri'),state:value.get('state')??null}));},error=>{if(!(error instanceof MissingPluginException))throw error;});void this.ready.catch(()=>{});
  }
  override setValue(value:RouteInformation):void{this.epoch++;this.available=true;super.setValue(value);}
  override async routerReportsNewRouteInformation(value:RouteInformation,{replace=false}:{readonly replace?:boolean}={}):Promise<void>{this.ensureAlive();const epoch=++this.epoch;await SystemNavigator.routeInformationUpdated({uri:value.uri,state:value.state,replace},this.services.defaultBinaryMessenger);if(this.live&&epoch===this.epoch){this.available=true;await super.routerReportsNewRouteInformation(value,{replace});}}
  override dispose():void{if(!this.live)return;this.live=false;this.epoch++;this.observer.dispose();super.dispose();}
}
export abstract class RouteInformationParser<T> {abstract parseRouteInformation(information:RouteInformation):T|PromiseLike<T>;abstract restoreRouteInformation(configuration:T):RouteInformation;}
export abstract class RouterDelegate<T> extends ChangeNotifier {get handlesBack():boolean{return true;}get reportAsReplacement():boolean{return false;}abstract get currentConfiguration():T;abstract setNewRoutePath(configuration:T):void;abstract build(context:BuildContext):Widget;abstract popRoute():boolean|PromiseLike<boolean>;}
export interface RouterOptions<T> extends WidgetOptions {readonly routeInformationProvider:RouteInformationProvider;readonly routeInformationParser:RouteInformationParser<T>;readonly routerDelegate:RouterDelegate<T>;readonly onError:(error:unknown)=>void}
export class Router<T> extends StatefulWidget {constructor(readonly options:RouterOptions<T>){super(options.key??null);}createState():State{return new RouterState<T>();}}
class RouterState<T> extends State<Router<T>> {
  private generation=0;private live=true;private applying=false;private report=Promise.resolve();
  private observer:Disposable|undefined;private active=true;
  private readonly routeChanged=()=>{const generation=++this.generation,{routeInformationProvider:provider,routeInformationParser:parser,routerDelegate:delegate,onError}=this.widget.options;void Promise.resolve().then(()=>parser.parseRouteInformation(provider.value)).then(configuration=>{if(!this.live||generation!==this.generation)return;this.applying=true;try{delegate.setNewRoutePath(configuration);this.invalidate();}finally{this.applying=false;}},error=>{if(this.live&&generation===this.generation)onError(error);}).catch(error=>{if(this.live&&generation===this.generation)onError(error);});};
  private invalidate():void{if(!this.mounted||!this.live)return;const context=this.context;if(context instanceof Element&&context.owner.building)context.owner.postFrame(()=>{if(this.mounted&&this.live)this.setState(()=>{});});else this.setState(()=>{});}
  private readonly delegateChanged=()=>{this.invalidate();this.updateBack();if(this.applying||this.context instanceof Element&&this.context.owner.building)return;const {routeInformationProvider:provider,routeInformationParser:parser,routerDelegate:delegate,onError}=this.widget.options;let info:RouteInformation;try{info=parser.restoreRouteInformation(delegate.currentConfiguration);}catch(error){onError(error);return;}const replace=delegate.reportAsReplacement;if(info.uri===provider.value.uri&&JSON.stringify(info.state)===JSON.stringify(provider.value.state))return;const generation=++this.generation;this.report=this.report.catch(()=>{}).then(async()=>{if(!this.live||generation!==this.generation)return;await provider.routerReportsNewRouteInformation(info,{replace});}).catch(error=>{if(this.live)onError(error);});};
  private updateBack():void{const services=this.context.services.platformServices;if(services&&!services.isClosed)void services.updateBackOwner(this,this.live?this.active&&this.widget.options.routerDelegate.handlesBack:null).catch(this.widget.options.onError);}
  private connect():void{this.widget.options.routeInformationProvider.addListener(this.routeChanged);this.widget.options.routerDelegate.addListener(this.delegateChanged);if(this.widget.options.routeInformationProvider.hasRouteInformation)this.routeChanged();}
  private disconnect(old:Router<T>):void{this.generation++;old.options.routeInformationProvider.removeListener(this.routeChanged);old.options.routerDelegate.removeListener(this.delegateChanged);}
  override initState():void{this.connect();this.observer=this.context.services.platformServices?.addObserver({didPopRoute:()=>this.active?this.widget.options.routerDelegate.popRoute():false});this.updateBack();}
  override didChangeDependencies():void{this.active=isCurrentRoute(this.context);this.updateBack();}
  override didUpdateWidget(old:Router<T>):void{if(old.options.routeInformationProvider!==this.widget.options.routeInformationProvider||old.options.routeInformationParser!==this.widget.options.routeInformationParser||old.options.routerDelegate!==this.widget.options.routerDelegate){this.disconnect(old);this.connect();}}
  override dispose():void{this.live=false;this.observer?.dispose();this.updateBack();this.disconnect(this.widget);super.dispose();}
  build(context:BuildContext):Widget{return this.widget.options.routerDelegate.build(context);}
}
/** Small named-stack adapter; custom delegates can preserve richer application configurations. */
export class NavigatorRouterDelegate extends RouterDelegate<readonly RouteInformation[]> {
  private applying=false;
  private length=0;private replacement=false;private signature='';
  private readonly changed=()=>{this.replacement=this.navigator.routes.length<this.length;this.length=this.navigator.routes.length;const signature=this.navigator.snapshot(),changed=signature!==this.signature;this.signature=signature;if(!this.applying&&changed)this.notifyListeners();};
  constructor(readonly navigator:NavigatorController,readonly resolve:(information:RouteInformation)=>Route,readonly initialRoute:Route,readonly options:{readonly restorationId?:string}={}){super();if(!navigator.routes.length)navigator.initialize(initialRoute);this.length=navigator.routes.length;this.signature=navigator.snapshot();navigator.addListener(this.changed);}
  override get handlesBack():boolean{return this.navigator.handlesBack;}
  override get reportAsReplacement():boolean{return this.replacement;}
  get currentConfiguration():readonly RouteInformation[]{return this.navigator.routes.map(route=>new RouteInformation({uri:route.name||'/',state:route.argumentsValue}));}
  setNewRoutePath(configuration:readonly RouteInformation[]):void{const routes=configuration.map(info=>this.resolve(info));this.applying=true;try{this.navigator.replaceStack(routes,{preserveCommonPrefix:true});}finally{this.applying=false;}}
  build(_context:BuildContext):Widget{return new Navigator(this.navigator,this.initialRoute,new ObjectKey(this.navigator),{...this.options,onGenerateRoute:settings=>this.resolve(new RouteInformation({uri:settings.name,state:settings.argumentsValue}))});}
  popRoute():Promise<boolean>{return this.navigator.maybePop();}
  override dispose():void{this.navigator.removeListener(this.changed);super.dispose();}
}
