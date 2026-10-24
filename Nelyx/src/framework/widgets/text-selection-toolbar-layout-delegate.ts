// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {SingleChildLayoutDelegate} from '../rendering/custom-layout.ts';
import {BoxConstraints} from '../rendering/constraints.ts';
import {Offset} from '../../ui/offset.ts';
import type {Size} from '../../ui/geometry.ts';
export class TextSelectionToolbarLayoutDelegate extends SingleChildLayoutDelegate {
  readonly anchorAbove:Offset;readonly anchorBelow:Offset;readonly fitsAbove:boolean|null;
  constructor({anchorAbove,anchorBelow,fitsAbove=null}:{readonly anchorAbove:Offset;readonly anchorBelow:Offset;readonly fitsAbove?:boolean|null}){super();this.anchorAbove=anchorAbove;this.anchorBelow=anchorBelow;this.fitsAbove=fitsAbove;}
  static centerOn(position:number,width:number,max:number):number{if(position-width/2<0)return 0;if(position+width/2>max)return max-width;return position-width/2;}
  override getConstraintsForChild(constraints:BoxConstraints):BoxConstraints{return constraints.loosen();}
  override getPositionForChild(size:Size,childSize:Size):Offset{const above=this.fitsAbove??this.anchorAbove.dy>=childSize.height,anchor=above?this.anchorAbove:this.anchorBelow;return new Offset(TextSelectionToolbarLayoutDelegate.centerOn(anchor.dx,childSize.width,size.width),above?Math.max(0,anchor.dy-childSize.height):anchor.dy);}
  override shouldRelayout(old:SingleChildLayoutDelegate):boolean{return !(old instanceof TextSelectionToolbarLayoutDelegate)||!old.anchorAbove.equals(this.anchorAbove)||!old.anchorBelow.equals(this.anchorBelow)||old.fitsAbove!==this.fitsAbove;}
}
