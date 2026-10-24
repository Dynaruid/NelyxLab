// SPDX-License-Identifier: BSD-3-Clause
// Application composition is per View; no process-global navigator, locale or restoration owner.
import {StatefulWidget,State} from './framework.ts';
import type {Widget,WidgetOptions,BuildContext} from './framework.ts';
import {MediaQuery,Localizations,Directionality,AppTheme,darkAppTheme,lightAppTheme,mediaFromView} from './app-data.ts';
import type {AppThemeData} from './app-data.ts';
import {Navigator,NavigatorController,Route} from './navigation.ts';
import type {RouteDescriptor,RouteResolver} from './navigation.ts';
import {Overlay,OverlayEntry} from './overlay.ts';
import {RootRestorationScope} from './restoration.ts';
import type {RestorationManager} from '../../services/restoration.ts';
import type {Disposable} from '../../foundation/disposable.ts';
import {invariant} from '../../foundation/errors.ts';
import {Builder} from './basic.ts';
import {GlobalKey} from './global-key.ts';

import {resolveAppLocale} from './app-locales.ts';
export {resolveLocale,resolveAppLocale,localeDirection,canonicalLocaleTag} from './app-locales.ts';
export type {LocaleListResolutionCallback,LocaleResolutionCallback} from './app-locales.ts';
import type {LocaleListResolutionCallback,LocaleResolutionCallback} from './app-locales.ts';
import {localeDirection} from './app-locales.ts';
import {defaultGenerateInitialRoutes} from './app-routes.ts';
export {defaultGenerateInitialRoutes} from './app-routes.ts';
import {Router,NavigatorRouterDelegate} from './router.ts';
import type {RouterOptions} from './router.ts';

export interface WidgetsAppOptions extends WidgetOptions {
  /** Design package route factory over the existing Core Navigator and JSON route settings. */
  readonly pageRouteBuilder?:(settings:RouteDescriptor,builder:(context:BuildContext)=>Widget)=>Route;
  readonly home?:Widget;readonly child?:Widget;readonly navigatorController?:NavigatorController;readonly initialRoute?:Route|string;
  readonly routes?:Readonly<Record<string,(context:BuildContext)=>Widget>>;
  readonly onUnknownRoute?:RouteResolver;readonly onGenerateInitialRoutes?:(name:string)=>readonly Route[];
  readonly locale?:string;readonly supportedLocales?:readonly string[];readonly messages?:Readonly<Record<string,Readonly<Record<string,string>>>>;
  readonly theme?:AppThemeData;readonly builder?:(context:BuildContext,child:Widget)=>Widget;
  readonly restorationScopeId?:string;readonly restorationManager?:RestorationManager;
  readonly navigatorRestorationId?:string;readonly onGenerateRoute?:RouteResolver;
  readonly localeListResolutionCallback?:LocaleListResolutionCallback;readonly localeResolutionCallback?:LocaleResolutionCallback;
}
export class WidgetsApp extends StatefulWidget {
  constructor(readonly options:WidgetsAppOptions){super(options.key??null);const routed=!!(options.home||options.initialRoute||options.routes||options.onGenerateRoute);invariant(!!options.child!==routed,'invalid-app-content','Choose child or home/routes/initialRoute');invariant(!(options.home&&options.routes&&Object.hasOwn(options.routes,'/')),'duplicate-home-route','home and routes[/] cannot both be provided');invariant(options.child===undefined||options.navigatorRestorationId===undefined,'invalid-app-restoration','A custom child owns its own Navigator restoration');}
  static router<T>({routerConfig,...options}:Omit<WidgetsAppOptions,'child'|'home'|'routes'|'initialRoute'|'navigatorController'|'navigatorRestorationId'|'onGenerateRoute'|'onUnknownRoute'|'onGenerateInitialRoutes'>&{readonly routerConfig:RouterOptions<T>}):WidgetsApp{return new WidgetsApp({...options,child:new Router(routerConfig)});}
  createState():State{return new WidgetsAppState();}
}
/** The App builder receives the actual routing Widget, preserving controller identity. */
export function appNavigatorController(child:Widget):NavigatorController|null{return child instanceof Navigator?child.controller:child instanceof Router&&child.options.routerDelegate instanceof NavigatorRouterDelegate?child.options.routerDelegate.navigator:null;}
class WidgetsAppState extends State<WidgetsApp>{
  private readonly navigatorKeys=new WeakMap<NavigatorController,GlobalKey>();
  private keyFor(controller:NavigatorController):GlobalKey{let key=this.navigatorKeys.get(controller);if(!key)this.navigatorKeys.set(controller,key=new GlobalKey());return key;}
  private ownedNavigator:NavigatorController|undefined;private observer:Disposable|undefined;private readonly entry=new OverlayEntry({builder:context=>this.content(context)});
  // The entry owns content invalidation. Metrics rebuild the ambient media, but
  // must not recreate the unchanged Overlay and rebuild every entry as a side effect.
  private overlay=new Overlay({initialEntries:[this.entry]});
  override initState():void{this.observer=this.context.services.platformServices?.addObserver({didChangeEnvironment:()=>{if(this.mounted)this.setState(()=>{});}});}
  private route:RouteResolver=settings=>{const o=this.widget.options,builder=settings.name==='/'&&o.home?()=>this.widget.options.home!:o.routes&&Object.hasOwn(o.routes,settings.name)?o.routes[settings.name]:undefined;return builder?(o.pageRouteBuilder?.(settings,builder)??new Route(builder,settings.name,settings.argumentsValue)):o.onGenerateRoute?.(settings)??null;};
  private requiredRoute:RouteResolver=settings=>{const route=this.route(settings)??this.widget.options.onUnknownRoute?.(settings);invariant(route,'unknown-app-route','No route for '+settings.name);return route;};
  private content(context:BuildContext):Widget{const o=this.widget.options;let child=o.child;if(!child){const controller=o.navigatorController??(this.ownedNavigator??=new NavigatorController());if(!controller.routes.length){const initial=o.initialRoute instanceof Route?[o.initialRoute]:o.onGenerateInitialRoutes?.(o.initialRoute??'/')??defaultGenerateInitialRoutes(o.initialRoute??'/',this.route,this.requiredRoute);invariant(initial.length>0&&initial.length<=32,'invalid-route-stack','Initial routes require 1..32 entries');controller.replaceStack(initial);}child=new Navigator(controller,controller.routes.length?new Route(controller.routes[0]!.builder,controller.routes[0]!.name,controller.routes[0]!.argumentsValue):this.requiredRoute({name:'/',argumentsValue:null})!,this.keyFor(controller),{...(o.navigatorRestorationId!==undefined?{restorationId:o.navigatorRestorationId}:{}),onGenerateRoute:this.requiredRoute});}return o.builder?.(context,child)??child;}
  override didUpdateWidget():void{this.overlay=new Overlay({initialEntries:[this.entry]});}
  build():Widget{const o=this.widget.options,services=this.context.services.platformServices,supported=o.supportedLocales??['en'],locale=resolveAppLocale(o.locale?[o.locale]:services?.environment?.locales??null,supported,o.localeListResolutionCallback,o.localeResolutionCallback),theme=o.theme??(services?.environment?.brightness==='light'?lightAppTheme:darkAppTheme);let child:Widget=this.overlay;if(o.restorationScopeId!==undefined)child=new RootRestorationScope({restorationId:o.restorationScopeId,child,...(o.restorationManager?{manager:o.restorationManager}:{})});return new MediaQuery(mediaFromView(this.context),new AppTheme(theme,new Localizations(locale,o.messages??{},supported[0]!,new Directionality(localeDirection(locale),new Builder(()=>child)))));}
  override dispose():void{this.observer?.dispose();this.entry.dispose();this.ownedNavigator?.dispose();super.dispose();}
}
