// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {Offset} from '../../ui/offset.ts';
import {Rect} from '../../ui/rect.ts';
import {clampDouble} from '../../ui/math.ts';
import {protect} from '../../ui/value-math.ts';
import type {RenderBox} from '../rendering/object.ts';
import type {TextSelectionPoint} from '../rendering/editable.ts';
export class TextSelectionToolbarAnchors {
  readonly primaryAnchor:Offset;readonly secondaryAnchor:Offset|null;
  constructor({primaryAnchor,secondaryAnchor=null}:{readonly primaryAnchor:Offset;readonly secondaryAnchor?:Offset|null}){this.primaryAnchor=primaryAnchor;this.secondaryAnchor=secondaryAnchor;protect(this,['primaryAnchor','secondaryAnchor']);}
  private static readonly zeroAnchor=new TextSelectionToolbarAnchors({primaryAnchor:Offset.zero});
  static fromSelection({renderBox,startGlyphHeight,endGlyphHeight,selectionEndpoints}:{readonly renderBox:RenderBox;readonly startGlyphHeight:number;readonly endGlyphHeight:number;readonly selectionEndpoints:readonly TextSelectionPoint[]}):TextSelectionToolbarAnchors{
    const rect=TextSelectionToolbarAnchors.getSelectionRect(renderBox,startGlyphHeight,endGlyphHeight,selectionEndpoints);if(rect.equals(Rect.zero))return TextSelectionToolbarAnchors.zeroAnchor;const editing=TextSelectionToolbarAnchors.editingRegion(renderBox);return new TextSelectionToolbarAnchors({primaryAnchor:new Offset(rect.left+rect.width/2,clampDouble(rect.top,editing.top,editing.bottom)),secondaryAnchor:new Offset(rect.left+rect.width/2,clampDouble(rect.bottom,editing.top,editing.bottom))});
  }
  private static editingRegion(box:RenderBox):Rect{return Rect.fromPoints(box.localToGlobal(Offset.zero),box.localToGlobal({x:box.size.width,y:box.size.height}));}
  static getSelectionRect(renderBox:RenderBox,startGlyphHeight:number,endGlyphHeight:number,selectionEndpoints:readonly TextSelectionPoint[]):Rect{
    const editing=TextSelectionToolbarAnchors.editingRegion(renderBox);if([editing.left,editing.top,editing.right,editing.bottom].some(Number.isNaN))return Rect.zero;
    const first=selectionEndpoints[0]!,last=selectionEndpoints[selectionEndpoints.length-1]!,multiline=last.point.dy-first.point.dy>endGlyphHeight/2;return Rect.fromLTRB(multiline?editing.left:editing.left+first.point.dx,editing.top+first.point.dy-startGlyphHeight,multiline?editing.right:editing.left+last.point.dx,editing.top+last.point.dy);
  }
}
