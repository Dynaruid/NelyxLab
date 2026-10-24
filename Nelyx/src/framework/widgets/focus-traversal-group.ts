// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from FocusTraversalGroup in widgets/focus_traversal.dart.
import {invariant} from '../../foundation/errors.ts';
import {DiagnosticsProperty} from '../../foundation/diagnostics.ts';
import type {DiagnosticPropertiesBuilder} from '../../foundation/diagnostics.ts';
import {StatefulWidget,State,Element} from './framework.ts';
import type {BuildContext,Widget,WidgetOptions} from './framework.ts';
import {FocusNode} from './focus.ts';
import {Focus} from './focus-scope.ts';
import {FocusTraversalPolicy,ReadingOrderTraversalPolicy} from './focus-traversal-policy.ts';
import {markTraversalGroup,unmarkTraversalGroup,traversalGroupNode,traversalGroupData} from './focus-traversal-context.ts';
import type {TraversalGroupData} from './focus-traversal-context.ts';
export interface FocusTraversalGroupOptions extends WidgetOptions {readonly policy?:FocusTraversalPolicy;readonly descendantsAreFocusable?:boolean;readonly descendantsAreTraversable?:boolean;readonly onFocusNodeCreated?:(node:FocusNode)=>void;readonly parentNode?:FocusNode|null}
export class FocusTraversalGroup extends StatefulWidget {
  readonly policy:FocusTraversalPolicy;readonly descendantsAreFocusable:boolean;readonly descendantsAreTraversable:boolean;readonly onFocusNodeCreated:((node:FocusNode)=>void)|undefined;readonly parentNode:FocusNode|null;
  constructor(readonly child:Widget,{policy=new ReadingOrderTraversalPolicy(),descendantsAreFocusable=true,descendantsAreTraversable=true,onFocusNodeCreated,parentNode=null,key=null}:FocusTraversalGroupOptions={}){super(key);invariant(policy instanceof FocusTraversalPolicy,'invalid-focus-policy','FocusTraversalGroup requires a policy');invariant(typeof descendantsAreFocusable==='boolean'&&typeof descendantsAreTraversable==='boolean','invalid-focus-flags','Traversal group flags must be boolean');this.policy=policy;this.descendantsAreFocusable=descendantsAreFocusable;this.descendantsAreTraversable=descendantsAreTraversable;this.onFocusNodeCreated=onFocusNodeCreated;this.parentNode=parentNode;}
  static maybeOfNode(node:FocusNode):FocusTraversalPolicy|null{const group=traversalGroupNode(node);return group?traversalGroupData(group)!.policy:null;}
  static maybeOf(context:BuildContext):FocusTraversalPolicy|null{const node=Focus.maybeOf(context,{scopeOk:true,createDependency:false});return node?this.maybeOfNode(node):null;}
  static of(context:BuildContext):FocusTraversalPolicy{const policy=this.maybeOf(context);invariant(policy,'missing-focus-traversal-group','No FocusTraversalGroup ancestor found');return policy;}
  createState():State{return new FocusTraversalGroupState();}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new DiagnosticsProperty('policy',this.policy));}
}
class FocusTraversalGroupState extends State<FocusTraversalGroup> {
  private node!:FocusNode;private data!:TraversalGroupData;
  private readonly focusChanged=()=>{if(!this.data.lastRequestedFocus||!(this.context instanceof Element))return;const primary=this.context.owner.focus.primaryFocus;if(primary!==this.data.lastRequestedFocus){for(let scope=primary?.nearestScope;scope;scope=scope.enclosingScope)this.widget.policy.invalidateScopeData(scope);this.data.lastRequestedFocus=null;}};
  override initState():void{super.initState();invariant(this.context instanceof Element,'invalid-focus-context','Traversal groups require an Element');this.node=new FocusNode({debugLabel:'FocusTraversalGroup'});this.data={policy:this.widget.policy,lastRequestedFocus:null};markTraversalGroup(this.node,this.data);this.context.owner.focus.addListener(this.focusChanged);this.widget.onFocusNodeCreated?.(this.node);}
  override didUpdateWidget(old:FocusTraversalGroup):void{if(old.policy!==this.widget.policy){const scopes=new Set([this.node.nearestScope,...this.node.descendants.map(node=>node.nearestScope)]);for(const scope of scopes)if(scope){old.policy.invalidateScopeData(scope);this.widget.policy.invalidateScopeData(scope);}this.data.policy=this.widget.policy;this.data.lastRequestedFocus=null;}}
  build():Widget{return new Focus(this.widget.child,{focusNode:this.node,parentNode:this.widget.parentNode,canRequestFocus:false,skipTraversal:true,includeSemantics:false,descendantsAreFocusable:this.widget.descendantsAreFocusable,descendantsAreTraversable:this.widget.descendantsAreTraversable});}
  override dispose():void{if(this.context instanceof Element)this.context.owner.focus.removeListener(this.focusChanged);const scopes=new Set([this.node.nearestScope,...this.node.descendants.map(node=>node.nearestScope)]);for(const scope of scopes)if(scope)this.widget.policy.invalidateScopeData(scope);this.node.dispose();unmarkTraversalGroup(this.node);super.dispose();}
}
