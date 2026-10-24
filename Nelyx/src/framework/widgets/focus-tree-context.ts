// SPDX-License-Identifier: BSD-3-Clause
import type {BuildContext} from './framework.ts';
import type {FocusNode} from './focus.ts';
const markers=new WeakMap<object,FocusNode>();
export function markFocusScope(widget:object,node:FocusNode):void{markers.set(widget,node);}
export function findFocusAncestor(context:BuildContext):FocusNode|null{let result:FocusNode|null=null;context.visitAncestorElements(element=>{const marker=markers.get(element.widget);if(!marker)return true;result=marker;return false;});return result;}
