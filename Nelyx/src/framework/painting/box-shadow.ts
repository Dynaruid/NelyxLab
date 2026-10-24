// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {Shadow} from '../../ui/shadow.ts';
import type {ShadowOptions} from '../../ui/shadow.ts';
import type {BlurStyle} from '../../ui/paint-effects-data.ts';
import {Paint} from '../../ui/paint.ts';
import {MaskFilter} from '../../ui/mask-filter.ts';
import {Offset} from '../../ui/offset.ts';
import {lerpArgb} from '../../ui/color-values.ts';
import {FoundationBuildMode} from '../../foundation/constants.ts';
import {debugDisableShadows} from './debug.ts';
import {hashValues} from './value-equality.ts';
export interface BoxShadowOptions extends ShadowOptions {readonly spreadRadius?:number;readonly blurStyle?:BlurStyle}
export class BoxShadow extends Shadow {
 readonly spreadRadius:number;readonly blurStyle:BlurStyle;
 constructor({spreadRadius=0,blurStyle='normal',...options}:BoxShadowOptions={}){super(options);this.spreadRadius=spreadRadius;this.blurStyle=blurStyle;}
 override toPaint():Paint{return new Paint({color:this.color,...(FoundationBuildMode.debug&&debugDisableShadows?{}:{maskFilter:MaskFilter.blur(this.blurStyle,this.blurSigma)})});}
 override scale(factor:number):BoxShadow{return new BoxShadow({color:this.color,offset:this.offset.multiply(factor),blurRadius:this.blurRadius*factor,spreadRadius:this.spreadRadius*factor,blurStyle:this.blurStyle});}
 copyWith(options:BoxShadowOptions):BoxShadow{return new BoxShadow({color:options.color??this.color,offset:options.offset??this.offset,blurRadius:options.blurRadius??this.blurRadius,spreadRadius:options.spreadRadius??this.spreadRadius,blurStyle:options.blurStyle??this.blurStyle});}
 static override lerp(a:BoxShadow|null,b:BoxShadow|null,t:number):BoxShadow|null{if(a===b)return a;if(a===null)return b!.scale(t);if(b===null)return a.scale(1-t);return new BoxShadow({color:lerpArgb(a.color,b.color,t)!,offset:Offset.lerp(a.offset,b.offset,t)!,blurRadius:a.blurRadius*(1-t)+b.blurRadius*t,spreadRadius:a.spreadRadius*(1-t)+b.spreadRadius*t,blurStyle:a.blurStyle==='normal'?b.blurStyle:a.blurStyle});}
 static override lerpList(a:readonly BoxShadow[]|null,b:readonly BoxShadow[]|null,t:number):readonly BoxShadow[]|null{if(a===b)return a;const left=a??[],right=b??[],common=Math.min(left.length,right.length),result:BoxShadow[]=[];for(let n=0;n<common;n++)result.push(BoxShadow.lerp(left[n]!,right[n]!,t)!);for(let n=common;n<left.length;n++)result.push(left[n]!.scale(1-t));for(let n=common;n<right.length;n++)result.push(right[n]!.scale(t));return result;}
 override equals(other:unknown):boolean{return this===other||other instanceof BoxShadow&&other.constructor===this.constructor&&super.equals(other)&&other.spreadRadius===this.spreadRadius&&other.blurStyle===this.blurStyle;}
 override get hashCode():number{return hashValues(this.color,this.offset,this.blurRadius,this.spreadRadius,this.blurStyle);}
 override toString():string{return `BoxShadow(0x${this.color.toString(16)}, ${this.offset}, ${this.blurRadius}, ${this.spreadRadius}, ${this.blurStyle})`;}
}
