// SPDX-License-Identifier: BSD-3-Clause
import {ChangeNotifier} from '../../foundation/notifier.ts';
import {invariant} from '../../foundation/errors.ts';
import {validateEditingContent} from '../../ui/editing.ts';
import type {TextSelection} from '../../ui/types.ts';
import type {KeyEvent} from '../../ui/input.ts';
/** App-owned selection for a read-only body. One mounted text host at a time. */
export class TextSelectionController extends ChangeNotifier {
  private body:string;
  private range:TextSelection;
  private host:object|undefined;
  constructor(text:string,selection:TextSelection={anchor:0,focus:0}){super();validateEditingContent({text,selection,composing:{status:'none'}});this.body=text;this.range=Object.freeze({...selection});}
  get text():string{return this.body;}
  set text(value:string){this.ensureAlive();validateEditingContent({text:value,selection:{anchor:0,focus:0},composing:{status:'none'}});if(value===this.body)return;this.body=value;this.range=Object.freeze({anchor:0,focus:0});this.notifyListeners();}
  get selection():TextSelection{return this.range;}
  set selection(value:TextSelection){this.ensureAlive();validateEditingContent({text:this.body,selection:value,composing:{status:'none'}});if(value.anchor===this.range.anchor&&value.focus===this.range.focus)return;this.range=Object.freeze({...value});this.notifyListeners();}
  get selectedText():string{return this.body.slice(Math.min(this.range.anchor,this.range.focus),Math.max(this.range.anchor,this.range.focus));}
  selectAll():void{this.selection={anchor:0,focus:this.body.length};}
  clear():void{this.selection={anchor:0,focus:0};}
  async copy(clipboard:{writeText(text:string):Promise<void>}):Promise<void>{this.ensureAlive();const text=this.selectedText;if(text)await clipboard.writeText(text);}
  /** @internal Host attachment protects one body's geometry and pointer selection. */
  attach(host:object):()=>void{this.ensureAlive();invariant(!this.host,'selection-controller-attached','Selection controller already has a text host');this.host=host;return ()=>{if(this.host===host)this.host=undefined;};}
  /** Dispatch through the mounted paragraph so movement uses current shaping. */
  handleKey(event:KeyEvent):boolean{this.ensureAlive();const host=this.host as {handleSelectionKey?:(event:KeyEvent)=>boolean}|undefined;return host?.handleSelectionKey?.(event)??false;}
  override dispose():void{invariant(!this.host,'selection-controller-attached','Unmount the selectable body before disposing its controller');super.dispose();}
}
