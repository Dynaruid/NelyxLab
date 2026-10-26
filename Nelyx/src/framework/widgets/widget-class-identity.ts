// SPDX-License-Identifier: BSD-3-Clause
// Nominal checks need the canonical classes, but focus ownership and traversal
// must not import the higher-level Element implementation just to identify it.
import type {Element} from './framework.ts';
import type {FocusScopeNode} from './focus.ts';
import {invariant} from '../../foundation/errors.ts';

let elementType:typeof Element|undefined;
let scopeType:typeof FocusScopeNode|undefined;
/** @internal Each declaring module supplies its class once. These two immutable
 * bindings are type witnesses, never a registry of live Elements/FocusNodes. */
export function initializeElementType(value:typeof Element):void{
  invariant(elementType===undefined||elementType===value,'element-type-already-initialized','The canonical Element class cannot be replaced');elementType=value;
}
export function initializeFocusScopeType(value:typeof FocusScopeNode):void{
  invariant(scopeType===undefined||scopeType===value,'focus-scope-type-already-initialized','The canonical FocusScopeNode class cannot be replaced');scopeType=value;
}
/** Keep instanceof itself live, including Proxy prototype checks and a public
 * class Symbol.hasInstance override with its original receiver. */
export function isElementContext(value:unknown):value is Element{return elementType!==undefined&&value instanceof elementType;}
export function isFocusScopeNode(value:unknown):value is FocusScopeNode{return scopeType!==undefined&&value instanceof scopeType;}
