// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2013 The Flutter Authors. All rights reserved.
// Engine ui/semantics.dart and ui/platform_dispatcher.dart at the pinned revision.
import {invariant} from '../foundation/errors.ts';
/** Source bit identities; the existing UI transport action strings stay separate. */
export class SemanticsAction {
  private constructor(readonly index:number,readonly name:string){Object.freeze(this);}
  static readonly tap=new SemanticsAction(2**0,'tap');
  static readonly longPress=new SemanticsAction(2**1,'longPress');
  static readonly scrollLeft=new SemanticsAction(2**2,'scrollLeft');
  static readonly scrollRight=new SemanticsAction(2**3,'scrollRight');
  static readonly scrollUp=new SemanticsAction(2**4,'scrollUp');
  static readonly scrollDown=new SemanticsAction(2**5,'scrollDown');
  static readonly scrollToOffset=new SemanticsAction(2**23,'scrollToOffset');
  static readonly increase=new SemanticsAction(2**6,'increase');
  static readonly decrease=new SemanticsAction(2**7,'decrease');
  static readonly showOnScreen=new SemanticsAction(2**8,'showOnScreen');
  static readonly moveCursorForwardByCharacter=new SemanticsAction(2**9,'moveCursorForwardByCharacter');
  static readonly moveCursorBackwardByCharacter=new SemanticsAction(2**10,'moveCursorBackwardByCharacter');
  static readonly setText=new SemanticsAction(2**21,'setText');
  static readonly setSelection=new SemanticsAction(2**11,'setSelection');
  static readonly copy=new SemanticsAction(2**12,'copy');
  static readonly cut=new SemanticsAction(2**13,'cut');
  static readonly paste=new SemanticsAction(2**14,'paste');
  static readonly didGainAccessibilityFocus=new SemanticsAction(2**15,'didGainAccessibilityFocus');
  static readonly didLoseAccessibilityFocus=new SemanticsAction(2**16,'didLoseAccessibilityFocus');
  static readonly customAction=new SemanticsAction(2**17,'customAction');
  static readonly dismiss=new SemanticsAction(2**18,'dismiss');
  static readonly moveCursorForwardByWord=new SemanticsAction(2**19,'moveCursorForwardByWord');
  static readonly moveCursorBackwardByWord=new SemanticsAction(2**20,'moveCursorBackwardByWord');
  static readonly focus=new SemanticsAction(2**22,'focus');
  static readonly expand=new SemanticsAction(2**24,'expand');
  static readonly collapse=new SemanticsAction(2**25,'collapse');
  static get values():readonly SemanticsAction[]{const result=[...actionsByIndex.values()];Object.seal(result);Object.defineProperty(result,'length',{writable:false});return result;}
  static fromIndex(index:number):SemanticsAction|null{return actionsByIndex.get(index)??null;}
  toString():string{return 'SemanticsAction.'+this.name;}
}
const actionsByIndex=new Map([SemanticsAction.tap,SemanticsAction.longPress,SemanticsAction.scrollLeft,SemanticsAction.scrollRight,SemanticsAction.scrollUp,SemanticsAction.scrollDown,SemanticsAction.scrollToOffset,SemanticsAction.increase,SemanticsAction.decrease,SemanticsAction.showOnScreen,SemanticsAction.moveCursorForwardByCharacter,SemanticsAction.moveCursorBackwardByCharacter,SemanticsAction.setSelection,SemanticsAction.copy,SemanticsAction.cut,SemanticsAction.paste,SemanticsAction.didGainAccessibilityFocus,SemanticsAction.didLoseAccessibilityFocus,SemanticsAction.customAction,SemanticsAction.dismiss,SemanticsAction.moveCursorForwardByWord,SemanticsAction.moveCursorBackwardByWord,SemanticsAction.setText,SemanticsAction.focus,SemanticsAction.expand,SemanticsAction.collapse].map(value=>[value.index,value] as const));
/** String IDs adapt Nelyx's existing View/node identities; numeric source IDs
 * are also accepted. arguments is intentionally not deep-frozen. */
export class SemanticsActionEvent {
  readonly type:SemanticsAction;readonly viewId:number|string;readonly nodeId:number|string;readonly arguments:unknown;
  constructor(options:{type:SemanticsAction;viewId:number|string;nodeId:number|string;arguments?:unknown}){
    invariant(options.type instanceof SemanticsAction,'invalid-semantics-action','Expected a SemanticsAction');
    for(const id of [options.viewId,options.nodeId])invariant(typeof id==='string'?id.length>0:Number.isSafeInteger(id)&&id>=0,'invalid-semantics-identity','Invalid View/node identity');
    this.type=options.type;this.viewId=options.viewId;this.nodeId=options.nodeId;this.arguments=Object.hasOwn(options,'arguments')?options.arguments:null;Object.freeze(this);
  }
  copyWith(options:{type?:SemanticsAction;viewId?:number|string;nodeId?:number|string;arguments?:unknown}={}):SemanticsActionEvent {
    return new SemanticsActionEvent({type:options.type??this.type,viewId:options.viewId??this.viewId,nodeId:options.nodeId??this.nodeId,arguments:Object.hasOwn(options,'arguments')?options.arguments:this.arguments});
  }
}
