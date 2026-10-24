// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {CustomClipper} from './clip.ts';import {ShapeBorder} from '../painting/borders.ts';import {valueEquals} from '../painting/value-equality.ts';import {Rect} from '../../ui/rect.ts';import type {Size} from '../../ui/geometry.ts';import type {Path} from '../../ui/path.ts';
export class ShapeBorderClipper extends CustomClipper<Path> {
  readonly shape:ShapeBorder;readonly textDirection:'ltr'|'rtl'|null;
  constructor({shape,textDirection=null}:{readonly shape:ShapeBorder;readonly textDirection?:'ltr'|'rtl'|null}){super();this.shape=shape;this.textDirection=textDirection;}
  getClip(size:Size):Path{return this.shape.getOuterPath(Rect.fromLTWH(0,0,size.width,size.height),{textDirection:this.textDirection});}
  shouldReclip(old:CustomClipper<Path>):boolean{return !(old instanceof ShapeBorderClipper)||!valueEquals(this.shape,old.shape)||this.textDirection!==old.textDirection;}
}
