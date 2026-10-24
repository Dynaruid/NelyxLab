// SPDX-License-Identifier: BSD-3-Clause
// Own package contact for the Navigator-owned route controller and its lifetime.
import type {RouteTransitionBinding} from './route-transition-policy.ts';
const bindings=new WeakMap<object,RouteTransitionBinding>();
export function bindPageRouteTransition(route:object,binding:RouteTransitionBinding|null):void{
    if(binding===null)bindings.delete(route);else bindings.set(route,binding);
}
export function pageRouteTransitionBinding(route:object):RouteTransitionBinding|null{return bindings.get(route)??null;}
