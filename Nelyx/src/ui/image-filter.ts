// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from dart:ui ImageFilter; native descriptions are recorded values.
import {freezeImageFilter} from './paint-effects-data.ts';
import type {ImageFilterSnapshot,TileMode,FilterQuality} from './paint-effects-data.ts';
import type {Rect} from './types.ts';
class UnsupportedError extends Error{constructor(message:string){super(message);this.name='UnsupportedError';}}
export abstract class ImageFilter {
 protected constructor(){}
 abstract snapshot():ImageFilterSnapshot;
 static blur({sigmaX=0,sigmaY=0,tileMode=null,bounds=null}:{readonly sigmaX?:number;readonly sigmaY?:number;readonly tileMode?:TileMode|null;readonly bounds?:Rect|null}={}):ImageFilter{return new ValueImageFilter({kind:'blur',sigmaX,sigmaY,tileMode,bounds});}
 static dilate({radiusX=0,radiusY=0}:{readonly radiusX?:number;readonly radiusY?:number}={}):ImageFilter{return new ValueImageFilter({kind:'dilate',radiusX,radiusY});}
 static erode({radiusX=0,radiusY=0}:{readonly radiusX?:number;readonly radiusY?:number}={}):ImageFilter{return new ValueImageFilter({kind:'erode',radiusX,radiusY});}
 static matrix(matrix4:ArrayLike<number>,{filterQuality='medium'}:{readonly filterQuality?:FilterQuality}={}):ImageFilter{return new ValueImageFilter({kind:'matrix',matrix:Array.from(matrix4),filterQuality});}
 static compose({outer,inner}:{readonly outer:ImageFilter;readonly inner:ImageFilter}):ImageFilter{return new ComposeImageFilter(outer,inner);}
 static get isShaderFilterSupported():boolean{return false;}
 static shader(_shader:unknown,_options:{readonly filterQuality?:FilterQuality}={}):never{throw new UnsupportedError('ImageFilter.shader only supported with Impeller rendering engine.');}
 get debugShortDescription():string{return this.snapshot().kind;}
}
class ValueImageFilter extends ImageFilter {
 private readonly description:ImageFilterSnapshot;
 constructor(value:ImageFilterSnapshot){super();this.description=freezeImageFilter(value);}
 snapshot():ImageFilterSnapshot{return this.description;}
}
/** Source native composition is lazy and retained after its first conversion. */
class ComposeImageFilter extends ImageFilter {
 private nativeDescription:ImageFilterSnapshot|undefined;
 constructor(private readonly outer:ImageFilter,private readonly inner:ImageFilter){super();}
 snapshot():ImageFilterSnapshot{return this.nativeDescription??=freezeImageFilter({kind:'compose',outer:this.outer.snapshot(),inner:this.inner.snapshot()});}
}
