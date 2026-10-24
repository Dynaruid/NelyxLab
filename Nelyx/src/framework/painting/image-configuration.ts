// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Selected ImageConfiguration from painting/image_provider.dart. Bundle/Locale
// remain host values until their source classes and image resolution are ported.
import type {Size as SizeInput} from '../../ui/geometry.ts';
import {Size} from '../../ui/size.ts';
import type {TargetPlatform} from '../../foundation/platform.ts';
import {hashValues,valueEquals} from './value-equality.ts';
import type {AssetBundle} from '../../services/asset-bundle.ts';
import type {ImageService} from '../../hosting/images.ts';
export interface ImageConfigurationOptions {readonly images?:ImageService|null;readonly bundle?:AssetBundle|null;readonly devicePixelRatio?:number|null;readonly locale?:string|null;readonly textDirection?:'ltr'|'rtl'|null;readonly size?:SizeInput|null;readonly platform?:TargetPlatform|null}
export class ImageConfiguration {
  static readonly empty=new ImageConfiguration();
  readonly images:ImageService|null;readonly bundle:AssetBundle|null;readonly devicePixelRatio:number|null;readonly locale:string|null;readonly textDirection:'ltr'|'rtl'|null;readonly size:Size|null;readonly platform:TargetPlatform|null;
  constructor({images=null,bundle=null,devicePixelRatio=null,locale=null,textDirection=null,size=null,platform=null}:ImageConfigurationOptions={}){this.images=images;this.bundle=bundle;this.devicePixelRatio=devicePixelRatio;this.locale=locale;this.textDirection=textDirection;this.size=size===null?null:size instanceof Size?size:new Size(size.width,size.height);this.platform=platform;}
  copyWith(value:ImageConfigurationOptions={}):ImageConfiguration{return new ImageConfiguration({images:value.images??this.images,bundle:value.bundle??this.bundle,devicePixelRatio:value.devicePixelRatio??this.devicePixelRatio,locale:value.locale??this.locale,textDirection:value.textDirection??this.textDirection,size:value.size??this.size,platform:value.platform??this.platform});}
  equals(other:unknown):boolean{return other instanceof ImageConfiguration&&other.constructor===this.constructor&&other.images===this.images&&valueEquals(other.bundle,this.bundle)&&other.devicePixelRatio===this.devicePixelRatio&&other.locale===this.locale&&other.textDirection===this.textDirection&&valueEquals(other.size,this.size)&&other.platform===this.platform;}
  get hashCode():number{return hashValues(this.bundle,this.devicePixelRatio,this.locale,this.size,this.platform);}
  toString():string{return `ImageConfiguration(${Object.entries(this).filter(([,value])=>value!==null).map(([name,value])=>`${name}: ${value}`).join(', ')})`;}
}
