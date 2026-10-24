// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from the pinned dart:ui/window.dart AccessibilityFeatures declaration.
import {checkedInteger,protect} from './value-math.ts';

export class AccessibilityFeatures {
  private constructor(private readonly index:number){protect(this,['index']);}
  /** Embedding entry for the engine bitfield; Dart exposes a private constructor. */
  static fromBits(value:number):AccessibilityFeatures{return new AccessibilityFeatures(checkedInteger(value));}
  get accessibleNavigation():boolean{return (this.index&1)!==0;}
  get invertColors():boolean{return (this.index&2)!==0;}
  get disableAnimations():boolean{return (this.index&4)!==0;}
  get boldText():boolean{return (this.index&8)!==0;}
  get reduceMotion():boolean{return (this.index&16)!==0;}
  get highContrast():boolean{return (this.index&32)!==0;}
  get onOffSwitchLabels():boolean{return (this.index&64)!==0;}
  get supportsAnnounce():boolean{return (this.index&128)===0;}
  get autoPlayAnimatedImages():boolean{return (this.index&256)===0;}
  get autoPlayVideos():boolean{return (this.index&512)===0;}
  get deterministicCursor():boolean{return (this.index&1024)!==0;}
  equals(other:unknown):boolean{return other instanceof AccessibilityFeatures&&other.constructor===this.constructor&&other.index===this.index;}
  /** Stable local integer hash; the Dart VM hash value is not a wire ABI. */
  get hashCode():number{return this.index;}
  toString():string{
    const features:string[]=[];
    for(const name of ['accessibleNavigation','invertColors','disableAnimations','boldText','reduceMotion','highContrast','onOffSwitchLabels','supportsAnnounce','autoPlayAnimatedImages','autoPlayVideos','deterministicCursor'] as const)if(this[name])features.push(name);
    return 'AccessibilityFeatures['+features.join(', ')+']';
  }
}
