// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {TextRange} from '../ui/text-range.ts';
import {TextPosition} from '../ui/text-position.ts';
import {TextLayoutMetrics} from './text-layout-metrics.ts';
import {graphemeBoundaries} from '../foundation/grapheme-boundaries.ts';
import {checkedInteger} from '../ui/value-math.ts';
export abstract class TextBoundary {
  getLeadingTextBoundaryAt(position:number):number|null{checkedInteger(position);if(position<0)return null;const start=this.getTextBoundaryAt(position).start;return start>=0?start:null;}
  getTrailingTextBoundaryAt(position:number):number|null{checkedInteger(position);const end=this.getTextBoundaryAt(Math.max(0,position)).end;return end>=0?end:null;}
  getTextBoundaryAt(position:number):TextRange{return new TextRange({start:this.getLeadingTextBoundaryAt(position)??-1,end:this.getTrailingTextBoundaryAt(position)??-1});}
}
export class CharacterBoundary extends TextBoundary {
  private offsets:readonly number[]|undefined;
  constructor(private readonly text:string){super();}
  private boundaryAt(position:number,ceil:boolean):number{
    const offsets=this.offsets??=graphemeBoundaries(this.text);let low=0,high=offsets.length;
    while(low<high){const middle=(low+high)>>>1;if(offsets[middle]!<position)low=middle+1;else high=middle;}
    return offsets[low]===position||ceil?offsets[low]!:offsets[low-1]!;
  }
  override getLeadingTextBoundaryAt(position:number):number|null{checkedInteger(position);return position<0?null:this.boundaryAt(Math.min(position,this.text.length),false);}
  override getTrailingTextBoundaryAt(position:number):number|null{checkedInteger(position);return position>=this.text.length?null:this.boundaryAt(Math.max(0,position+1),true);}
  override getTextBoundaryAt(position:number):TextRange{checkedInteger(position);return new TextRange({start:position<0?-1:this.getLeadingTextBoundaryAt(position)??-1,end:position>=this.text.length?-1:this.getTrailingTextBoundaryAt(position)??-1});}
}
export class LineBoundary extends TextBoundary {
  constructor(private readonly textLayout:TextLayoutMetrics){super();}
  override getTextBoundaryAt(position:number):TextRange{return this.textLayout.getLineAtOffset(new TextPosition({offset:Math.max(position,0)}));}
}
export class ParagraphBoundary extends TextBoundary {
  constructor(private readonly text:string){super();}
  override getLeadingTextBoundaryAt(position:number):number|null{
    checkedInteger(position);const text=this.text;
    if(position<0||!text.length)return null;if(position>=text.length)return text.length;if(position===0)return 0;
    let index=position;
    if(index>1&&text.charCodeAt(index)===0xa&&text.charCodeAt(index-1)===0xd)index-=2;
    else if(TextLayoutMetrics.isLineTerminator(text.charCodeAt(index)))index--;
    while(index>0){if(TextLayoutMetrics.isLineTerminator(text.charCodeAt(index)))return index+1;index--;}
    return Math.max(index,0);
  }
  override getTrailingTextBoundaryAt(position:number):number|null{
    checkedInteger(position);const text=this.text;if(position>=text.length||!text.length)return null;if(position<0)return 0;
    let index=position;while(!TextLayoutMetrics.isLineTerminator(text.charCodeAt(index))){index++;if(index===text.length)return index;}
    return index<text.length-1&&text.charCodeAt(index)===0xd&&text.charCodeAt(index+1)===0xa?index+2:index+1;
  }
}
export class DocumentBoundary extends TextBoundary {
  constructor(private readonly text:string){super();}
  override getLeadingTextBoundaryAt(position:number):number|null{checkedInteger(position);return position<0?null:0;}
  override getTrailingTextBoundaryAt(position:number):number|null{checkedInteger(position);return position>=this.text.length?null:this.text.length;}
}
