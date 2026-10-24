// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2013 The Flutter Authors. All rights reserved.
import type {Rect} from './rect.ts';
import type {TextRange} from './text-range.ts';
import {protect,hashDoubles} from './value-math.ts';
export class GlyphInfo {
  constructor(readonly graphemeClusterLayoutBounds:Rect,readonly graphemeClusterCodeUnitRange:TextRange,readonly writingDirection:'ltr'|'rtl'){protect(this,['graphemeClusterLayoutBounds','graphemeClusterCodeUnitRange','writingDirection']);}
  equals(other:unknown):boolean{return this===other||other instanceof GlyphInfo&&this.graphemeClusterLayoutBounds.equals(other.graphemeClusterLayoutBounds)&&this.graphemeClusterCodeUnitRange.equals(other.graphemeClusterCodeUnitRange)&&this.writingDirection===other.writingDirection;}
  get hashCode():number{return hashDoubles([this.graphemeClusterLayoutBounds.hashCode,this.graphemeClusterCodeUnitRange.hashCode,this.writingDirection==='ltr'?1:0]);}
  toString():string{return `Glyph(${this.graphemeClusterLayoutBounds}, textRange: ${this.graphemeClusterCodeUnitRange}, direction: TextDirection.${this.writingDirection})`;}
}
