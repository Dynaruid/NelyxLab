import { invariant } from '../foundation/errors.ts';
import { sameOwner } from "./frame.ts";
import type { TextEditingValue, ViewOwner,EditingGeometry,TextInputGeometry } from "./types.ts";
import {freezeTextRect} from './text.ts';
import {captureTransform} from './geometry.ts';
export function freezeTextInputGeometry(geometry:TextInputGeometry):TextInputGeometry {
  invariant(geometry.nativeSurfaceGeneration===undefined||(Number.isSafeInteger(geometry.nativeSurfaceGeneration)&&geometry.nativeSurfaceGeneration>=0),'invalid-text-input-geometry','Invalid native surface generation');
  invariant(geometry.coordinates==='view-logical'&&!!geometry.owner.id&&Number.isSafeInteger(geometry.owner.generation)&&geometry.owner.generation>=0&&Number.isSafeInteger(geometry.viewportGeneration)&&geometry.viewportGeneration>=0&&Number.isSafeInteger(geometry.layoutEpoch)&&geometry.layoutEpoch>=0&&Number.isFinite(geometry.scale)&&geometry.scale>0,'invalid-text-input-geometry','Invalid Core input geometry owner, epoch or coordinate space');
  invariant(geometry.selectionRects.length<=4096,'text-input-geometry-budget','Core selection geometry exceeds the editing text budget');
  invariant(Number.isFinite(geometry.caretBaseline.x)&&Number.isFinite(geometry.caretBaseline.y),'invalid-text-input-geometry','Core caret baseline must be finite');
  return Object.freeze({...geometry,owner:Object.freeze({...geometry.owner}),transform:captureTransform(geometry.transform),bounds:freezeTextRect(geometry.bounds),clip:freezeTextRect(geometry.clip),caret:freezeTextRect(geometry.caret),caretBaseline:Object.freeze({...geometry.caretBaseline}),selectionRects:Object.freeze(geometry.selectionRects.map(freezeTextRect))});
}
export function freezeEditingGeometry(geometry:EditingGeometry):EditingGeometry {
  if(geometry.status==='unavailable')return Object.freeze({status:'unavailable'});
  invariant(geometry.status==='observed'&&geometry.coordinates==='control-local'&&Number.isSafeInteger(geometry.nativeRevision)&&geometry.nativeRevision>=0,'invalid-editing-geometry','Invalid native geometry revision/space');
  invariant(Number.isFinite(geometry.width)&&geometry.width>=0&&Number.isFinite(geometry.height)&&geometry.height>=0&&geometry.selectionRects.length<=256,'invalid-editing-geometry','Invalid control size or selection budget');
  return Object.freeze({...geometry,caret:freezeTextRect(geometry.caret),selectionRects:Object.freeze(geometry.selectionRects.map(freezeTextRect))});
}
function offset(text: string, index: number): void {
  invariant(Number.isInteger(index) && index >= 0 && index <= text.length, "invalid-text-offset", "offset outside UTF-16 text");
  if (index > 0 && index < text.length) invariant(!(text.charCodeAt(index - 1) >= 0xd800 && text.charCodeAt(index - 1) <= 0xdbff && text.charCodeAt(index) >= 0xdc00 && text.charCodeAt(index) <= 0xdfff), "invalid-text-offset", "offset splits surrogate pair");
}
export function validateEditingContent(value:Pick<TextEditingValue,'text'|'selection'|'composing'>):void {
  invariant(typeof value.text==='string' && value.text.length<=4096 && !value.text.includes('\0'),'invalid-text','native editing text budget or NUL');
  for(let i=0;i<value.text.length;i++){const code=value.text.charCodeAt(i);if(code>=0xd800 && code<=0xdbff){const next=value.text.charCodeAt(++i);invariant(next>=0xdc00 && next<=0xdfff,'invalid-text','unpaired surrogate');}else invariant(code<0xdc00 || code>0xdfff,'invalid-text','unpaired surrogate');}
  offset(value.text, value.selection.anchor); offset(value.text, value.selection.focus);
  if (value.composing.status === "active") { offset(value.text, value.composing.start); offset(value.text, value.composing.end); invariant(value.composing.end >= value.composing.start, "invalid-composition", "reversed composing range"); }
}
export function freezeEditing(value: TextEditingValue): TextEditingValue {
  validateEditingContent(value);
  invariant(Number.isSafeInteger(value.revision) && value.revision >= 0, "invalid-revision", "revision must be nonnegative");
  return Object.freeze({...value, session: Object.freeze({...value.session}), selection: Object.freeze({...value.selection}), composing: Object.freeze({...value.composing})});
}
export class EditingSession {
  private closed = false;
  private current: TextEditingValue;
  constructor(readonly owner: ViewOwner, value: TextEditingValue) { invariant(sameOwner(owner, value.session), "stale-edit", "wrong session");this.owner=Object.freeze({...owner}); this.current = freezeEditing(value); }
  get value(): TextEditingValue { return this.current; }
  update(value: TextEditingValue): boolean {
    if (this.closed || !sameOwner(this.owner, value.session) || value.revision <= this.current.revision) return false;
    this.current = freezeEditing(value); return true;
  }
  dispose(): void { this.closed = true; }
}
/** RN's public events have an event counter for text, but none for selection.
 * Composing and selection direction are unavailable through that interface.
 * This bridge never writes a value back to the native editor on observation.
 */
export class PublicNativeEditingSession {
  readonly capabilities = Object.freeze({composing:false,selectionDirection:false,selectionEventRevision:false});
  private nativeEventCount=-1;
  private closed=false;
  private session:EditingSession;
  constructor(readonly owner:ViewOwner,text:string|TextEditingValue) {
    this.owner=Object.freeze({...owner});
    const initial=typeof text==='string'?{text,selection:{anchor:text.length,focus:text.length},composing:{status:'unavailable' as const},revision:0,session:owner,source:'native' as const}:text;
    invariant(initial.composing.status==='unavailable','invalid-composition','public native events cannot observe composition');
    this.session=new EditingSession(owner,initial);
  }
  get value():TextEditingValue{return this.session.value;}
  /** A remounted native control restarts its counter while logical session revisions continue. */
  beginNativeEpoch():void {invariant(!this.closed,'closed-editing-session','Native epoch after editor disposal');this.nativeEventCount=-1;}
  nativeText(text:string,eventCount:number):boolean {
    invariant(Number.isSafeInteger(eventCount) && eventCount>=0,'invalid-revision','invalid native event count');
    if(this.closed || eventCount<=this.nativeEventCount)return false;
    const boundary=(index:number)=>{let result=Math.min(index,text.length);if(result>0 && result<text.length && text.charCodeAt(result-1)>=0xd800 && text.charCodeAt(result-1)<=0xdbff && text.charCodeAt(result)>=0xdc00 && text.charCodeAt(result)<=0xdfff)result--;return result;};
    const selection={anchor:boundary(this.value.selection.anchor),focus:boundary(this.value.selection.focus)};
    const accepted=this.session.update({...this.value,text,selection,revision:this.value.revision+1,source:'native'});
    if(accepted)this.nativeEventCount=eventCount;return accepted;
  }
  nativeSelection(start:number,end:number):boolean {
    if(this.closed)return false;
    // These are ordered endpoints, not recovered anchor/focus direction. A
    // selection event may race a text event; reject an out-of-snapshot offset.
    try{offset(this.value.text,start);offset(this.value.text,end);}catch{return false;}
    if(start>end || (this.value.selection.anchor===start && this.value.selection.focus===end))return false;
    return this.session.update({...this.value,selection:{anchor:start,focus:end},revision:this.value.revision+1,source:'native'});
  }
  programmatic(text:string,selection:TextEditingValue['selection']={anchor:text.length,focus:text.length}):boolean {
    return this.replace({...this.value,text,selection,revision:this.value.revision+1,source:'programmatic'});
  }
  replace(value:TextEditingValue):boolean {
    if(this.closed)return false;
    invariant(value.composing.status==='unavailable','invalid-composition','public native events cannot replace composition');
    return this.session.update({...value,source:'programmatic'});
  }
  dispose():void{this.closed=true;this.session.dispose();}
}
/** Converts a UTF-8 byte cluster boundary, rejecting interior bytes. No runtime encoder required. */
export function utf8ToUtf16(text: string, byteIndex: number): number {
  invariant(Number.isInteger(byteIndex) && byteIndex >= 0, "invalid-text-offset", "invalid UTF-8 index");
  let bytes = 0, units = 0;
  for (const scalar of text) {
    if (bytes === byteIndex) return units;
    const code = scalar.codePointAt(0)!; bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4; units += scalar.length;
  }
  invariant(bytes === byteIndex, "invalid-text-offset", "UTF-8 offset splits scalar or is outside text"); return units;
}
