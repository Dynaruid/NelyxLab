// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {InheritedTheme} from './inherited-theme.ts';import {Builder} from './basic.ts';import type {Widget,BuildContext,WidgetOptions} from './framework.ts';import {IconThemeData} from './icon-theme-data.ts';import type {DiagnosticPropertiesBuilder} from '../../foundation/diagnostics.ts';
const fallback=IconThemeData.fallback();
export class IconTheme extends InheritedTheme {
  constructor(readonly data:IconThemeData,child:Widget,options:WidgetOptions={}){super(child,options.key??null);}
  private static inherited(context:BuildContext):IconThemeData{return context.maybeDependOn(IconTheme)?.data??fallback;}
  static merge({data,child,key=null}:{readonly data:IconThemeData;readonly child:Widget;readonly key?:WidgetOptions['key']}):Widget{return new Builder(context=>new IconTheme(this.inherited(context).merge(data),child,{key}));}
  static of(context:BuildContext):IconThemeData{const data=this.inherited(context).resolve(context);return data.isConcrete?data:data.copyWith({size:data.size??fallback.size,fill:data.fill??fallback.fill,weight:data.weight??fallback.weight,grade:data.grade??fallback.grade,opticalSize:data.opticalSize??fallback.opticalSize,color:data.color??fallback.color,opacity:data.opacity??fallback.opacity,shadows:data.shadows??fallback.shadows,applyTextScaling:data.applyTextScaling??fallback.applyTextScaling});}
  wrap(_context:BuildContext,child:Widget):Widget{return new IconTheme(this.data,child);}
  updateShouldNotify(old:this):boolean{return !this.data.equals(old.data);}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);this.data.debugFillProperties(properties);}
}
