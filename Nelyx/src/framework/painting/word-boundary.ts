// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {TextBoundary} from '../../services/text-boundary.ts';
import {TextPosition} from '../../ui/text-position.ts';
import type {TextRange} from '../../ui/text-range.ts';
import {protect} from '../../ui/value-math.ts';
import {FoundationBuildMode} from '../../foundation/constants.ts';
import {invariant} from '../../foundation/errors.ts';
import {isWordSpaceOrPunctuation} from '../../foundation/word-boundary-data.ts';
/** ICU word boundaries with the source movement rule that skips spaces/punctuation. */
export class WordBoundary extends TextBoundary {
  private movement:TextBoundary|undefined;
  private constructor(private readonly text:string,private readonly paragraph:(position:TextPosition)=>TextRange){super();protect(this,['text','paragraph']);}
  /** @internal Source library-private constructor, with an exact paragraph receiver. */
  static _fromParagraph(text:string,paragraph:(position:TextPosition)=>TextRange):WordBoundary{return new WordBoundary(text,paragraph);}
  override getTextBoundaryAt(position:number):TextRange{return this.paragraph(new TextPosition({offset:Math.max(position,0)}));}
  private static codePointFromSurrogates(high:number,low:number):number{
    if(FoundationBuildMode.debug)invariant((high&0xfc00)===0xd800&&(low&0xfc00)===0xdc00,'invalid-word-surrogates','Word boundary expects a surrogate pair');
    return (high<<10)+low+0x10000-(0xd800<<10)-0xdc00;
  }
  private codePointAt(index:number):number|null{
    if(index<0||index>=this.text.length)return null;
    const unit=this.text.charCodeAt(index);
    switch(unit&0xfc00){
      case 0xd800:invariant(index+1<this.text.length,'missing-word-surrogate','Word boundary expects a following code unit');return WordBoundary.codePointFromSurrogates(unit,this.text.charCodeAt(index+1));
      case 0xdc00:invariant(index>0,'missing-word-surrogate','Word boundary expects a preceding code unit');return WordBoundary.codePointFromSurrogates(this.text.charCodeAt(index-1),unit);
      default:return unit;
    }
  }
  /** @internal Shared source-library private helper used by TextPainter caret metrics. */
  static _isNewline(codePoint:number):boolean{return codePoint===0xa||codePoint===0x85||codePoint===0xb||codePoint===0xc||codePoint===0x2028||codePoint===0x2029;}
  private skipSpacesAndPunctuations(offset:number,forward:boolean):boolean{
    const inner=this.codePointAt(forward?offset-1:offset),outerIndex=forward?offset:offset-1,outer=outerIndex<0||outerIndex>=this.text.length?null:this.text.charCodeAt(outerIndex);
    return inner===null||outer===null||WordBoundary._isNewline(inner)||WordBoundary._isNewline(outer)||!isWordSpaceOrPunctuation(inner);
  }
  get moveByWordBoundary():TextBoundary{return this.movement??=new UntilTextBoundary(this,(offset,forward)=>this.skipSpacesAndPunctuations(offset,forward));}
}
/** Source recursion is traversed iteratively; paragraph boundary values are unchanged. */
class UntilTextBoundary extends TextBoundary {
  constructor(private readonly boundary:TextBoundary,private readonly predicate:(offset:number,forward:boolean)=>boolean){super();}
  override getLeadingTextBoundaryAt(position:number):number|null{
    while(position>=0){const offset=this.boundary.getLeadingTextBoundaryAt(position);if(offset===null||this.predicate(offset,false))return offset;position=offset-1;}return null;
  }
  override getTrailingTextBoundaryAt(position:number):number|null{
    while(true){const offset=this.boundary.getTrailingTextBoundaryAt(Math.max(position,0));if(offset===null||this.predicate(offset,true))return offset;position=offset;}
  }
}
