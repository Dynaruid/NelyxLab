// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Reviewed value/delegate declarations from the pinned services/text_input.dart.
import {TextSelection} from './text-editing.ts';
import {TextRange} from '../ui/text-range.ts';
import {TextAffinity} from '../ui/text-position.ts';
import type {TextPosition} from '../ui/text-position.ts';
import {protect,checkedInteger} from '../ui/value-math.ts';
import {FoundationBuildMode} from '../foundation/constants.ts';
import {invariant} from '../foundation/errors.ts';
import {objectRuntimeType} from '../foundation/object.ts';
import {hashValues} from '../framework/painting/value-equality.ts';
export interface TextEditingValueOptions {readonly text?:string;readonly selection?:TextSelection;readonly composing?:TextRange}
function optionalJsonInteger(value:unknown):number|null{if(value===null||value===undefined)return null;if(typeof value==='bigint'){invariant(value>=BigInt(Number.MIN_SAFE_INTEGER)&&value<=BigInt(Number.MAX_SAFE_INTEGER),'unsupported-text-input-integer','Text input offsets must fit the safe-number adapter');return Number(value);}invariant(typeof value==='number','invalid-text-input-json','Expected a JSON integer');return checkedInteger(value);}
function optionalJsonString(value:unknown):string|null{invariant(value===null||value===undefined||typeof value==='string','invalid-text-input-json','Expected a JSON string');return value??null;}
function optionalJsonBoolean(value:unknown):boolean|null{invariant(value===null||value===undefined||typeof value==='boolean','invalid-text-input-json','Expected a JSON boolean');return value??null;}
/** JSON maps preserve Dart integer tokens with bigint at the existing codec boundary. */
export class TextEditingValue {
  readonly text:string;readonly selection:TextSelection;readonly composing:TextRange;
  constructor({text='',selection=TextSelection.collapsed(-1),composing=TextRange.empty}:TextEditingValueOptions={}){invariant(typeof text==='string'&&selection instanceof TextSelection&&composing instanceof TextRange,'invalid-text-editing-value','Expected text, TextSelection and TextRange');this.text=text;this.selection=selection;this.composing=composing;protect(this,['text','selection','composing']);}
  static readonly empty=new TextEditingValue();
  static fromJSON(encoded:ReadonlyMap<string,unknown>):TextEditingValue{
    const text=encoded.get('text');invariant(typeof text==='string','invalid-text-input-json','Text editing JSON requires a string text');const affinity=optionalJsonString(encoded.get('selectionAffinity')),selection=new TextSelection({baseOffset:optionalJsonInteger(encoded.get('selectionBase'))??-1,extentOffset:optionalJsonInteger(encoded.get('selectionExtent'))??-1,affinity:affinity==='TextAffinity.upstream'?TextAffinity.upstream:TextAffinity.downstream,isDirectional:optionalJsonBoolean(encoded.get('selectionIsDirectional'))??false}),composing=new TextRange({start:optionalJsonInteger(encoded.get('composingBase'))??-1,end:optionalJsonInteger(encoded.get('composingExtent'))??-1});TextEditingValue.validateRange(selection,text);TextEditingValue.validateRange(composing,text);return new TextEditingValue({text,selection,composing});
  }
  copyWith({text,selection,composing}:Partial<{readonly text:string|null;readonly selection:TextSelection|null;readonly composing:TextRange|null}>={}):TextEditingValue{return new TextEditingValue({text:text??this.text,selection:selection??this.selection,composing:composing??this.composing});}
  get isComposingRangeValid():boolean{return this.composing.isValid&&this.composing.isNormalized&&this.composing.end<=this.text.length;}
  replaced(replacementRange:TextRange,replacementString:string):TextEditingValue{
    if(!replacementRange.isValid)return this;const {start,end}=replacementRange;invariant(start>=0&&end>=start&&end<=this.text.length,'text-replacement-out-of-bounds','Replacement range is outside the text');const text=this.text.slice(0,start)+replacementString+this.text.slice(end);if(end-start===replacementString.length)return this.copyWith({text});
    const adjust=(index:number):number=>index+(index<=start&&index<end?0:replacementString.length)-(Math.max(start,Math.min(end,index))-start),selection=new TextSelection({baseOffset:adjust(this.selection.baseOffset),extentOffset:adjust(this.selection.extentOffset)}),composing=new TextRange({start:adjust(this.composing.start),end:adjust(this.composing.end)});TextEditingValue.validateRange(selection,text);TextEditingValue.validateRange(composing,text);return new TextEditingValue({text,selection,composing});
  }
  toJSON():Map<string,unknown>{TextEditingValue.validateRange(this.selection,this.text);TextEditingValue.validateRange(this.composing,this.text);return new Map<string,unknown>([['text',this.text],['selectionBase',BigInt(this.selection.baseOffset)],['selectionExtent',BigInt(this.selection.extentOffset)],['selectionAffinity','TextAffinity.'+this.selection.affinity],['selectionIsDirectional',this.selection.isDirectional],['composingBase',BigInt(this.composing.start)],['composingExtent',BigInt(this.composing.end)]]);}
  equals(other:unknown):boolean{return this===other||other instanceof TextEditingValue&&other.text===this.text&&other.selection.equals(this.selection)&&other.composing.equals(this.composing);}
  get hashCode():number{return hashValues(this.text,this.selection,this.composing);}
  toString():string{return `${objectRuntimeType(this,'TextEditingValue')}(text: \u2524${this.text}\u251C, selection: ${this.selection}, composing: ${this.composing})`;}
  private static validateRange(range:TextRange,text:string):void{if(!FoundationBuildMode.debug||range.start===-1&&range.end===-1)return;invariant(range.start>=0&&range.start<=text.length,'invalid-text-input-range',`Range start ${range.start} is out of text of length ${text.length}`);invariant(range.end>=0&&range.end<=text.length,'invalid-text-input-range',`Range end ${range.end} is out of text of length ${text.length}`);}
}
export class SelectionChangedCause {
  static readonly tap=new SelectionChangedCause(0,'tap');static readonly doubleTap=new SelectionChangedCause(1,'doubleTap');static readonly longPress=new SelectionChangedCause(2,'longPress');static readonly forcePress=new SelectionChangedCause(3,'forcePress');static readonly keyboard=new SelectionChangedCause(4,'keyboard');static readonly toolbar=new SelectionChangedCause(5,'toolbar');static readonly drag=new SelectionChangedCause(6,'drag');static readonly stylusHandwriting=new SelectionChangedCause(7,'stylusHandwriting');static readonly scribble=SelectionChangedCause.stylusHandwriting;
  static readonly values=Object.freeze([this.tap,this.doubleTap,this.longPress,this.forcePress,this.keyboard,this.toolbar,this.drag,this.stylusHandwriting]);
  private constructor(readonly index:number,readonly name:string){Object.freeze(this);}toString():string{return 'SelectionChangedCause.'+this.name;}
}
export interface TextSelectionDelegate {
  readonly textEditingValue:TextEditingValue;readonly cutEnabled:boolean;readonly copyEnabled:boolean;readonly pasteEnabled:boolean;readonly selectAllEnabled:boolean;readonly lookUpEnabled:boolean;readonly searchWebEnabled:boolean;readonly shareEnabled:boolean;readonly liveTextInputEnabled:boolean;
  userUpdateTextEditingValue(value:TextEditingValue,cause:SelectionChangedCause):void;hideToolbar(hideHandles?:boolean):void;bringIntoView(position:TextPosition):void;cutSelection(cause:SelectionChangedCause):void;pasteText(cause:SelectionChangedCause):Promise<void>;selectAll(cause:SelectionChangedCause):void;copySelection(cause:SelectionChangedCause):void;
}
type DelegateBase=abstract new (...args:any[])=>object;
type DelegateConstructor<Base extends DelegateBase>=abstract new (...args:ConstructorParameters<Base>)=>InstanceType<Base>&TextSelectionDelegate;
export function TextSelectionDelegate<Base extends DelegateBase>(Base:Base):DelegateConstructor<Base>{
  abstract class TextSelectionDelegate extends Base {
    abstract readonly textEditingValue:TextEditingValue;
    get cutEnabled():boolean{return true;}get copyEnabled():boolean{return true;}get pasteEnabled():boolean{return true;}get selectAllEnabled():boolean{return true;}get lookUpEnabled():boolean{return true;}get searchWebEnabled():boolean{return true;}get shareEnabled():boolean{return true;}get liveTextInputEnabled():boolean{return false;}
    abstract userUpdateTextEditingValue(value:TextEditingValue,cause:SelectionChangedCause):void;abstract hideToolbar(hideHandles?:boolean):void;abstract bringIntoView(position:TextPosition):void;abstract cutSelection(cause:SelectionChangedCause):void;abstract pasteText(cause:SelectionChangedCause):Promise<void>;abstract selectAll(cause:SelectionChangedCause):void;abstract copySelection(cause:SelectionChangedCause):void;
  }
  return TextSelectionDelegate as unknown as DelegateConstructor<Base>;
}
