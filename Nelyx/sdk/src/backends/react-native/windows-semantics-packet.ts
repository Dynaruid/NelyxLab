// SPDX-License-Identifier: BSD-3-Clause
import type {SemanticsNode,ViewOwner} from '@nelyx/core/ui/types';
import type {ReactNativeInteraction} from './interaction.ts';
export interface WindowsSemanticsSurface {readonly nativeReactTag:number;readonly nativeSurfaceGeneration:number;readonly viewportGeneration:number}
export interface WindowsSemanticsAction {readonly protocol:1;readonly id:string;readonly source:number;readonly commit:number;readonly kind:'focus'|'activate'|'set-range-value'|'set-text'|'set-selection'|'scroll-range';readonly value?:number;readonly revision?:number;readonly generation?:number;readonly text?:string;readonly anchor?:number;readonly focus?:number;readonly start?:number;readonly end?:number;readonly alignToTop?:boolean}
const counter=(value:unknown,zero=false):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=(zero?0:1);
/** Explicit redaction happens before RN receives any native props. */
export function windowsSemanticsPacket(node:SemanticsNode,owner:ViewOwner,surface:WindowsSemanticsSurface,commit:number){
  if(!counter(commit,true)||!counter(node.sourceNodeId,true)||!counter(surface.nativeReactTag)||!counter(surface.nativeSurfaceGeneration)||!counter(surface.viewportGeneration,true))throw new Error('Current Core source identity and Windows Skia surface metrics are required');
  const input=node.role==='text-field';if(input&&(!counter(node.textInputRevision,true)||!counter(node.textRevision,true)||!counter(node.textInputGeneration)))throw new Error('Current Core editing/content/owner revisions are required for Windows semantics');
  const geometry=node.textInputGeometry,matching=geometry&&geometry.owner.id===owner.id&&geometry.owner.generation===owner.generation&&geometry.viewportGeneration===surface.viewportGeneration&&geometry.nativeSurfaceGeneration===surface.nativeSurfaceGeneration;
  return Object.freeze({protocol:1 as const,commit,source:node.sourceNodeId,id:node.id,role:node.role,owner:Object.freeze({...owner}),surface:surface.nativeReactTag,surfaceGeneration:surface.nativeSurfaceGeneration,viewport:surface.viewportGeneration,bounds:Object.freeze({...node.bounds}),enabled:node.enabled,focusable:node.focusable===true&&!!node.actions?.focus,focused:node.focused===true,canActivate:!!(node.actions?.activate??node.activate),
    isSlider:node.isSlider===true,range:!input&&node.numericRange?Object.freeze({...node.numericRange,readOnly:!node.rangeActions?.setValue}):null,
    text:input?Object.freeze({revision:node.textInputRevision!,textRevision:node.textRevision!,generation:node.textInputGeneration!,value:node.obscured?'':node.value??'',anchor:node.obscured?0:node.textSelection?.anchor??0,focus:node.obscured?0:node.textSelection?.focus??0,readOnly:node.readOnly===true,obscured:node.obscured===true,selectionEnabled:!!node.textActions?.setSelection,navigation:node.obscured||!node.textNavigation?null:{characters:node.textNavigation.characters,words:node.textNavigation.words??[],lines:node.textNavigation.lines??[]},geometry:matching?geometry:null,paragraph:node.obscured||!matching?null:node.textParagraph??null}):null});
}
export type WindowsSemanticsPacket=ReturnType<typeof windowsSemanticsPacket>;
/** A native event must match a published packet and its live Core control. */
export function performWindowsSemanticsAction(interaction:ReactNativeInteraction,node:SemanticsNode,packet:WindowsSemanticsPacket,event:WindowsSemanticsAction):boolean{
  if(!event||event.protocol!==1||event.id!==packet.id||event.source!==packet.source||event.commit!==packet.commit||!interaction.isLiveNodeSnapshot(node))return false;
  const current=interaction.node(node.id,node.role);if(!current)return false;
  if(event.kind==='focus')return current.focusable===true&&interaction.performAction(node.id,'focus');
  if(event.kind==='activate')return packet.canActivate&&interaction.performAction(node.id,'activate');
  if(event.kind==='set-range-value')return !!packet.range&&!packet.range.readOnly&&typeof event.value==='number'&&interaction.performRangeAction(node.id,{kind:'set-range-value',value:event.value},node);
  if(!packet.text||event.revision!==packet.text.revision||event.generation!==packet.text.generation)return false;
  if(current.role!=='text-field'||current.textInputRevision!==packet.text.revision||current.textRevision!==packet.text.textRevision||current.textInputGeneration!==packet.text.generation||(current.readOnly===true)!==packet.text.readOnly||(current.obscured===true)!==packet.text.obscured||!packet.text.obscured&&(current.value??'')!==packet.text.value)return false;
  if(event.kind==='set-text')return typeof event.text==='string'&&interaction.performTextAction(node.id,{kind:'set-text',text:event.text},event.revision,event.generation);
  if(event.kind==='set-selection')return counter(event.anchor,true)&&counter(event.focus,true)&&interaction.performTextAction(node.id,{kind:'set-selection',anchor:event.anchor,focus:event.focus},event.revision,event.generation);
  if(event.kind==='scroll-range')return !packet.text.obscured&&counter(event.start,true)&&counter(event.end,true)&&typeof event.alignToTop==='boolean'&&interaction.performTextAction(node.id,{kind:'scroll-range',start:event.start,end:event.end,alignToTop:event.alignToTop},event.revision,event.generation);
  return false;
}
