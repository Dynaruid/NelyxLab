// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter gestures/pointer_router.dart; concrete source events preserve global/local coordinates.
import type {PointerEvent} from './events.ts';
import {captureTransform} from '../../ui/geometry.ts';
import type {TransformMatrix} from '../../ui/geometry.ts';
import {invariant,exceptionStack} from '../../foundation/errors.ts';
import {FlutterError} from '../../foundation/flutter-error.ts';
import {FlutterErrorDetails} from '../../foundation/assertions.ts';
import {ErrorDescription} from '../../foundation/diagnostics.ts';

export type PointerRoute=(event:PointerEvent)=>void;
/** Routes concrete PointerEvents; global position is retained by transformed events. */
export class PointerRouter {
  private readonly routeMap=new Map<number,Map<PointerRoute,TransformMatrix|null>>();
  private readonly globalRoutes=new Map<PointerRoute,TransformMatrix|null>();
  addRoute(pointer:number,route:PointerRoute,matrix:TransformMatrix|null=null):void {
    invariant(Number.isSafeInteger(pointer),'invalid-pointer','Pointer identity must be a safe integer');
    let routes=this.routeMap.get(pointer);invariant(!routes?.has(route),'duplicate-pointer-route','Pointer route is already registered');
    const captured=matrix===null?null:captureTransform(matrix);if(!routes){routes=new Map();this.routeMap.set(pointer,routes);}routes.set(route,captured);
  }
  removeRoute(pointer:number,route:PointerRoute):void {
    const routes=this.routeMap.get(pointer);invariant(routes&&routes.has(route),'missing-pointer-route','Pointer route is not registered');routes.delete(route);if(!routes.size)this.routeMap.delete(pointer);
  }
  addGlobalRoute(route:PointerRoute,matrix:TransformMatrix|null=null):void {invariant(!this.globalRoutes.has(route),'duplicate-global-pointer-route','Global pointer route is already registered');this.globalRoutes.set(route,matrix===null?null:captureTransform(matrix));}
  removeGlobalRoute(route:PointerRoute):void {invariant(this.globalRoutes.has(route),'missing-global-pointer-route','Global pointer route is not registered');this.globalRoutes.delete(route);}
  /** Available in all modes, an explicit adaptation of the source debug getter. */
  get debugGlobalRouteCount():number{return this.globalRoutes.size;}
  route(event:PointerEvent):void {
    const routes=this.routeMap.get(event.pointer),globals=new Map(this.globalRoutes);
    if(routes)this.dispatchRoutes(event,routes,new Map(routes));
    this.dispatchRoutes(event,this.globalRoutes,globals);
  }
  private dispatchRoutes(event:PointerEvent,current:Map<PointerRoute,TransformMatrix|null>,snapshot:Map<PointerRoute,TransformMatrix|null>):void {
    for(const [route,matrix]of snapshot)if(current.has(route))try{
      route(event.transformed(matrix));
    }catch(exception){FlutterError.reportError(new FlutterErrorDetails({exception,stack:exceptionStack(exception),library:'gesture library',context:new ErrorDescription('while routing a pointer event')}));}
  }
}
