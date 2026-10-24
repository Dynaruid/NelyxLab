// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Finite color/shape-only ShapeDecoration receiver shared by design compositions; full image/gradient/shadow APIs remain separate.
import {Decoration,BoxPainter} from './decoration.ts';import type {ImageConfiguration} from './image-configuration.ts';import type {ShapeBorder} from './borders.ts';import type {EdgeInsetsGeometry} from './edge-insets.ts';import {valueEquals,hashValues} from './value-equality.ts';import type {Canvas} from '../../ui/canvas.ts';import {Color} from '../../ui/color.ts';import {Paint} from '../../ui/paint.ts';import {Rect} from '../../ui/rect.ts';import type {Offset} from '../../ui/geometry.ts';import {invariant} from '../../foundation/errors.ts';
import {OutlinedBorder} from './borders.ts';
export class ColorShapeDecoration extends Decoration {
  constructor(readonly shape:ShapeBorder,readonly color:Color|null){super();}
  override get padding():EdgeInsetsGeometry{return this.shape.dimensions;}
  equals(other:unknown):boolean{return other instanceof ColorShapeDecoration&&valueEquals(this.shape,other.shape)&&valueEquals(this.color,other.color);}get hashCode():number{return hashValues(this.shape,this.color);}
  override getClipPath(rect:Rect,textDirection:'ltr'|'rtl'):import('../../ui/path.ts').Path{return this.shape.getOuterPath(rect,{textDirection});}
  override createBoxPainter(onChanged:(()=>void)|null=null):BoxPainter{return new ColorShapePainter(this,onChanged);}
}
class ColorShapePainter extends BoxPainter {
  constructor(private readonly decoration:ColorShapeDecoration,onChanged:(()=>void)|null){super(onChanged);}
  paint(canvas:Canvas,offset:Offset,configuration:ImageConfiguration):void{this.assertLive();const size=configuration.size;invariant(size!==null,'missing-color-shape-size','Color/shape decoration requires actual paint size');const rect=Rect.fromLTWH(offset.x,offset.y,size.width,size.height),options={textDirection:configuration.textDirection},d=this.decoration;if(d.color!==null){const paint=new Paint({color:d.color.toARGB32()});if(d.shape.preferPaintInterior){const shape=d.shape,adjusted=shape instanceof OutlinedBorder&&shape.side.color>>>24===255&&shape.side.style==='solid'?rect.deflate(shape.side.strokeInset/2):rect;shape.paintInterior(canvas,adjusted,paint,options);}else canvas.drawPath(d.shape.getOuterPath(rect,options),paint);}d.shape.paint(canvas,rect,options);}
}
