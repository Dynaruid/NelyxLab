// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from dart:ui MaskFilter.
import {freezeMaskFilter} from './paint-effects-data.ts';
import type {BlurStyle,MaskFilterSnapshot} from './paint-effects-data.ts';
import {blurStyles} from './paint-effects-data.ts';
import {hashDoubles,fixed} from './value-math.ts';
export class MaskFilter {
 private constructor(private readonly _style:BlurStyle,private readonly _sigma:number){}
 static blur(style:BlurStyle,sigma:number):MaskFilter{freezeMaskFilter({style,sigma});return new MaskFilter(style,sigma);}
 snapshot():MaskFilterSnapshot{return freezeMaskFilter({style:this._style,sigma:this._sigma});}
 equals(other:unknown):boolean{return other instanceof MaskFilter&&other._style===this._style&&other._sigma===this._sigma;}
 get hashCode():number{return hashDoubles([blurStyles.indexOf(this._style),this._sigma]);}
 toString():string{return `MaskFilter.blur(BlurStyle.${this._style}, ${fixed(this._sigma)})`;}
}
