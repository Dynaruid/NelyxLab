// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Reviewed widgets/context_menu_controller.dart at the pinned Flutter revision.
import {FoundationBuildMode} from '../../foundation/constants.ts';
import {invariant} from '../../foundation/errors.ts';
import type {BuildContext,Widget} from './framework.ts';
import {Overlay,OverlayEntry} from './overlay.ts';
import {InheritedTheme} from './inherited-theme.ts';
import {Navigator} from './navigation.ts';
export class ContextMenuController {
  private static builder:((context:BuildContext)=>Widget)|null=null;
  private static shownInstance:ContextMenuController|null=null;
  private static entry:OverlayEntry|null=null;
  readonly onRemove:(()=>void)|null;
  constructor({onRemove=null}:{readonly onRemove?:(()=>void)|null}={}){this.onRemove=onRemove;}
  show({context,contextMenuBuilder,debugRequiredFor:_debugRequiredFor}:{readonly context:BuildContext;readonly contextMenuBuilder:(context:BuildContext)=>Widget;readonly debugRequiredFor?:Widget|null}):void{
    if(this.isShown){ContextMenuController.builder=contextMenuBuilder;ContextMenuController.entry?.markNeedsBuild();return;}
    ContextMenuController.removeAny();if(ContextMenuController.shownInstance!==null)return;const overlay=Overlay.of(context,{rootOverlay:true});ContextMenuController.builder=contextMenuBuilder;
    const entry=new OverlayEntry({builder:buildContext=>{let navigator:BuildContext|undefined=buildContext.widget instanceof Navigator?buildContext:undefined;if(navigator===undefined)buildContext.visitAncestorElements(element=>{if(element.widget instanceof Navigator){navigator=element;return false;}return true;});return InheritedTheme.capture(buildContext,navigator).wrap(ContextMenuController.builder!(buildContext));}});
    ContextMenuController.entry=entry;ContextMenuController.shownInstance=this;
    try{overlay.insert(entry);}catch(error){ContextMenuController.entry=null;ContextMenuController.builder=null;ContextMenuController.shownInstance=null;try{entry.dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Context menu insertion and rollback failed');}throw error;}
  }
  static removeAny():void{
    const entry=ContextMenuController.entry,shown=ContextMenuController.shownInstance;
    // Retire the old owner before application callbacks can show a replacement.
    ContextMenuController.entry=null;ContextMenuController.builder=null;ContextMenuController.shownInstance=null;
    const errors:unknown[]=[];if(entry!==null){if(entry.overlay!==null)try{entry.remove();}catch(error){errors.push(error);}try{entry.dispose();}catch(error){errors.push(error);}}try{shown?.onRemove?.();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Context menu retirement failed');
  }
  get isShown():boolean{return ContextMenuController.shownInstance===this&&ContextMenuController.entry?.overlay!=null;}
  markNeedsBuild():void{if(FoundationBuildMode.debug)invariant(this.isShown,'hidden-context-menu','Context menu must be shown before marking it dirty');ContextMenuController.entry?.markNeedsBuild();}
  remove():void{if(ContextMenuController.shownInstance===this)ContextMenuController.removeAny();}
}
