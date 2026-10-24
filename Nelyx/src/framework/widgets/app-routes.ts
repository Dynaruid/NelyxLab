// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Navigator default initial-route generation on Core's immutable Route ABI.
import {invariant} from '../../foundation/errors.ts';
import {Route} from './navigation.ts';
import type {RouteResolver} from './navigation.ts';
export function defaultGenerateInitialRoutes(name:string,resolve:RouteResolver,fallback:RouteResolver=resolve):readonly Route[] {
  const result:(Route|null)[]=[];
  if(name.startsWith('/')&&name.length>1){result.push(resolve({name:'/',argumentsValue:null}));let routeName='';for(const part of name.slice(1).split('/')){routeName+='/'+part;result.push(resolve({name:routeName,argumentsValue:null}));}if(result.at(-1)===null)result.length=0;}
  else if(name!=='/')result.push(resolve({name,argumentsValue:null}));
  const routes=result.filter((route):route is Route=>route!==null);
  if(!routes.length){const route=fallback({name:'/',argumentsValue:null});invariant(route,'missing-initial-route','No route could be generated for the initial route or /');routes.push(route);}
  invariant(routes.length<=32,'invalid-route-stack','Initial route stack exceeds the Core route budget');return Object.freeze(routes);
}
