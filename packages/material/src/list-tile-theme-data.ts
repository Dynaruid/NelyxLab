// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Finite API projection from pinned resolved IR; behavior is an explicit functional port.
import {StatelessWidget,Widget} from '@nelyx/core/framework/widgets/framework';import type {BuildContext,WidgetOptions} from '@nelyx/core/framework/widgets/framework';import {Text} from '@nelyx/core/framework/widgets/basic';import {Color} from '@nelyx/core/ui/color';import {TextStyle} from '@nelyx/core/framework/painting/text-style';import {ShapeBorder} from '@nelyx/core/framework/painting/borders';import {EdgeInsetsGeometry} from '@nelyx/core/framework/painting/edge-insets';import type {MouseCursor} from '@nelyx/core/services/mouse-cursor';import type {FocusNode} from '@nelyx/core/framework/widgets/focus';import type {WidgetStatesController,WidgetStateProperty} from '@nelyx/core/framework/widgets/widget-state';import type {VisualDensity} from './theme-data.ts';import {ListTileStyle,ListTileControlAffinity,ListTileTitleAlignment} from "./generated/list/list-tile-types.ts";
import {Diagnosticable} from '@nelyx/core/foundation/diagnosticable';import {DiagnosticsProperty} from '@nelyx/core/foundation/diagnostics';import type {DiagnosticPropertiesBuilder} from '@nelyx/core/foundation/diagnostics';import {ColorProperty} from '@nelyx/core/framework/painting/color-property';import {DoubleProperty,EnumProperty} from '@nelyx/core/foundation/diagnostic-properties';import {valueEquals,hashValues} from '@nelyx/core/framework/painting/value-equality';
export interface ListTileThemeDataOptions {
  readonly dense?:boolean|null;
  readonly shape?:ShapeBorder|null;
  readonly style?:ListTileStyle|null;
  readonly selectedColor?:Color|null;
  readonly iconColor?:Color|null;
  readonly textColor?:Color|null;
  readonly titleTextStyle?:TextStyle|null;
  readonly subtitleTextStyle?:TextStyle|null;
  readonly leadingAndTrailingTextStyle?:TextStyle|null;
  readonly contentPadding?:EdgeInsetsGeometry|null;
  readonly tileColor?:Color|null;
  readonly selectedTileColor?:Color|null;
  /** @dartType double? */ readonly horizontalTitleGap?:number|null;
  /** @dartType double? */ readonly minVerticalPadding?:number|null;
  /** @dartType double? */ readonly minLeadingWidth?:number|null;
  readonly enableFeedback?:boolean|null;
  readonly mouseCursor?:WidgetStateProperty<MouseCursor|null>|null;
  readonly visualDensity?:VisualDensity|null;
  /** @dartType double? */ readonly minTileHeight?:number|null;
  readonly titleAlignment?:ListTileTitleAlignment|null;
  readonly controlAffinity?:ListTileControlAffinity|null;
  readonly isThreeLine?:boolean|null;
}
export class ListTileThemeData extends Diagnosticable(class {}) {
  readonly dense:boolean|null;
  readonly shape:ShapeBorder|null;
  readonly style:ListTileStyle|null;
  readonly selectedColor:Color|null;
  readonly iconColor:Color|null;
  readonly textColor:Color|null;
  readonly titleTextStyle:TextStyle|null;
  readonly subtitleTextStyle:TextStyle|null;
  readonly leadingAndTrailingTextStyle:TextStyle|null;
  readonly contentPadding:EdgeInsetsGeometry|null;
  readonly tileColor:Color|null;
  readonly selectedTileColor:Color|null;
  /** @dartType double? */ readonly horizontalTitleGap:number|null;
  /** @dartType double? */ readonly minVerticalPadding:number|null;
  /** @dartType double? */ readonly minLeadingWidth:number|null;
  /** @dartType double? */ readonly minTileHeight:number|null;
  readonly enableFeedback:boolean|null;
  readonly mouseCursor:WidgetStateProperty<MouseCursor|null>|null;
  readonly visualDensity:VisualDensity|null;
  readonly titleAlignment:ListTileTitleAlignment|null;
  readonly controlAffinity:ListTileControlAffinity|null;
  readonly isThreeLine:boolean|null;
  /**
 * @dartParam horizontalTitleGap double?
 * @dartParam minVerticalPadding double?
 * @dartParam minLeadingWidth double?
 * @dartParam minTileHeight double?
   */
  constructor(o:ListTileThemeDataOptions={}){super();
    this.dense=o.dense??null;
    this.shape=o.shape??null;
    this.style=o.style??null;
    this.selectedColor=o.selectedColor??null;
    this.iconColor=o.iconColor??null;
    this.textColor=o.textColor??null;
    this.titleTextStyle=o.titleTextStyle??null;
    this.subtitleTextStyle=o.subtitleTextStyle??null;
    this.leadingAndTrailingTextStyle=o.leadingAndTrailingTextStyle??null;
    this.contentPadding=o.contentPadding??null;
    this.tileColor=o.tileColor??null;
    this.selectedTileColor=o.selectedTileColor??null;
    this.horizontalTitleGap=o.horizontalTitleGap??null;
    this.minVerticalPadding=o.minVerticalPadding??null;
    this.minLeadingWidth=o.minLeadingWidth??null;
    this.minTileHeight=o.minTileHeight??null;
    this.enableFeedback=o.enableFeedback??null;
    this.mouseCursor=o.mouseCursor??null;
    this.visualDensity=o.visualDensity??null;
    this.titleAlignment=o.titleAlignment??null;
    this.controlAffinity=o.controlAffinity??null;
    this.isThreeLine=o.isThreeLine??null;
    if(new.target===ListTileThemeData)Object.freeze(this);
  }
  /**
 * @dartParam horizontalTitleGap double?
 * @dartParam minVerticalPadding double?
 * @dartParam minLeadingWidth double?
 * @dartParam minTileHeight double?
   */
  copyWith(o:ListTileThemeDataOptions={}):ListTileThemeData{return new ListTileThemeData({dense:o.dense??this.dense,shape:o.shape??this.shape,style:o.style??this.style,selectedColor:o.selectedColor??this.selectedColor,iconColor:o.iconColor??this.iconColor,textColor:o.textColor??this.textColor,titleTextStyle:o.titleTextStyle??this.titleTextStyle,subtitleTextStyle:o.subtitleTextStyle??this.subtitleTextStyle,leadingAndTrailingTextStyle:o.leadingAndTrailingTextStyle??this.leadingAndTrailingTextStyle,contentPadding:o.contentPadding??this.contentPadding,tileColor:o.tileColor??this.tileColor,selectedTileColor:o.selectedTileColor??this.selectedTileColor,horizontalTitleGap:o.horizontalTitleGap??this.horizontalTitleGap,minVerticalPadding:o.minVerticalPadding??this.minVerticalPadding,minLeadingWidth:o.minLeadingWidth??this.minLeadingWidth,minTileHeight:o.minTileHeight??this.minTileHeight,enableFeedback:o.enableFeedback??this.enableFeedback,mouseCursor:o.mouseCursor??this.mouseCursor,visualDensity:o.visualDensity??this.visualDensity,titleAlignment:o.titleAlignment??this.titleAlignment,controlAffinity:o.controlAffinity??this.controlAffinity,isThreeLine:o.isThreeLine??this.isThreeLine});}
  /** @dartParam t double */
  static lerp(a:ListTileThemeData|null,b:ListTileThemeData|null,t:number):ListTileThemeData|null{if(a===b)return a;const number=(x:number|null,y:number|null):number|null=>x===y?x:(x??0)*(1-t)+(y??0)*t;return new ListTileThemeData({dense:t<.5?a?.dense??null:b?.dense??null,shape:ShapeBorder.lerp(a?.shape??null,b?.shape??null,t),style:t<.5?a?.style??null:b?.style??null,selectedColor:Color.lerp(a?.selectedColor??null,b?.selectedColor??null,t),iconColor:Color.lerp(a?.iconColor??null,b?.iconColor??null,t),textColor:Color.lerp(a?.textColor??null,b?.textColor??null,t),titleTextStyle:TextStyle.lerp(a?.titleTextStyle??null,b?.titleTextStyle??null,t),subtitleTextStyle:TextStyle.lerp(a?.subtitleTextStyle??null,b?.subtitleTextStyle??null,t),leadingAndTrailingTextStyle:TextStyle.lerp(a?.leadingAndTrailingTextStyle??null,b?.leadingAndTrailingTextStyle??null,t),contentPadding:EdgeInsetsGeometry.lerp(a?.contentPadding??null,b?.contentPadding??null,t),tileColor:Color.lerp(a?.tileColor??null,b?.tileColor??null,t),selectedTileColor:Color.lerp(a?.selectedTileColor??null,b?.selectedTileColor??null,t),horizontalTitleGap:number(a?.horizontalTitleGap??null,b?.horizontalTitleGap??null),minVerticalPadding:number(a?.minVerticalPadding??null,b?.minVerticalPadding??null),minLeadingWidth:number(a?.minLeadingWidth??null,b?.minLeadingWidth??null),minTileHeight:number(a?.minTileHeight??null,b?.minTileHeight??null),enableFeedback:t<.5?a?.enableFeedback??null:b?.enableFeedback??null,mouseCursor:t<.5?a?.mouseCursor??null:b?.mouseCursor??null,visualDensity:t<.5?a?.visualDensity??null:b?.visualDensity??null,titleAlignment:t<.5?a?.titleAlignment??null:b?.titleAlignment??null,controlAffinity:t<.5?a?.controlAffinity??null:b?.controlAffinity??null,isThreeLine:t<.5?a?.isThreeLine??null:b?.isThreeLine??null});}
  equals(other:unknown):boolean{return this===other||other instanceof ListTileThemeData&&other.constructor===this.constructor&&valueEquals(this.dense,other.dense)&&valueEquals(this.shape,other.shape)&&valueEquals(this.style,other.style)&&valueEquals(this.selectedColor,other.selectedColor)&&valueEquals(this.iconColor,other.iconColor)&&valueEquals(this.textColor,other.textColor)&&valueEquals(this.titleTextStyle,other.titleTextStyle)&&valueEquals(this.subtitleTextStyle,other.subtitleTextStyle)&&valueEquals(this.leadingAndTrailingTextStyle,other.leadingAndTrailingTextStyle)&&valueEquals(this.contentPadding,other.contentPadding)&&valueEquals(this.tileColor,other.tileColor)&&valueEquals(this.selectedTileColor,other.selectedTileColor)&&valueEquals(this.horizontalTitleGap,other.horizontalTitleGap)&&valueEquals(this.minVerticalPadding,other.minVerticalPadding)&&valueEquals(this.minLeadingWidth,other.minLeadingWidth)&&valueEquals(this.minTileHeight,other.minTileHeight)&&valueEquals(this.enableFeedback,other.enableFeedback)&&valueEquals(this.mouseCursor,other.mouseCursor)&&valueEquals(this.visualDensity,other.visualDensity)&&valueEquals(this.titleAlignment,other.titleAlignment)&&valueEquals(this.controlAffinity,other.controlAffinity)&&valueEquals(this.isThreeLine,other.isThreeLine);}
  /** @dartReturn int */ get hashCode():number{return hashValues(this.dense,this.shape,this.style,this.selectedColor,this.iconColor,this.textColor,this.titleTextStyle,this.subtitleTextStyle,this.leadingAndTrailingTextStyle,this.contentPadding,this.tileColor,this.selectedTileColor,this.horizontalTitleGap,this.minVerticalPadding,this.minLeadingWidth,this.minTileHeight,this.enableFeedback,this.mouseCursor,this.visualDensity,this.titleAlignment,this.controlAffinity,this.isThreeLine);}
  override debugFillProperties(p:DiagnosticPropertiesBuilder):void{super.debugFillProperties(p);
    p.add(new DiagnosticsProperty("dense",this.dense,{defaultValue:null,typeName:"bool"}));
    p.add(new DiagnosticsProperty("shape",this.shape,{defaultValue:null,typeName:"ShapeBorder"}));
    p.add(new EnumProperty("style",this.style,{defaultValue:null,typeName:'ListTileStyle'}));
    p.add(new ColorProperty("selectedColor",this.selectedColor,{defaultValue:null}));
    p.add(new ColorProperty("iconColor",this.iconColor,{defaultValue:null}));
    p.add(new ColorProperty("textColor",this.textColor,{defaultValue:null}));
    p.add(new DiagnosticsProperty("titleTextStyle",this.titleTextStyle,{defaultValue:null,typeName:"TextStyle"}));
    p.add(new DiagnosticsProperty("subtitleTextStyle",this.subtitleTextStyle,{defaultValue:null,typeName:"TextStyle"}));
    p.add(new DiagnosticsProperty("leadingAndTrailingTextStyle",this.leadingAndTrailingTextStyle,{defaultValue:null,typeName:"TextStyle"}));
    p.add(new DiagnosticsProperty("contentPadding",this.contentPadding,{defaultValue:null,typeName:"EdgeInsetsGeometry"}));
    p.add(new ColorProperty("tileColor",this.tileColor,{defaultValue:null}));
    p.add(new ColorProperty("selectedTileColor",this.selectedTileColor,{defaultValue:null}));
    p.add(new DoubleProperty("horizontalTitleGap",this.horizontalTitleGap,{defaultValue:null}));
    p.add(new DoubleProperty("minVerticalPadding",this.minVerticalPadding,{defaultValue:null}));
    p.add(new DoubleProperty("minLeadingWidth",this.minLeadingWidth,{defaultValue:null}));
    p.add(new DoubleProperty("minTileHeight",this.minTileHeight,{defaultValue:null}));
    p.add(new DiagnosticsProperty("enableFeedback",this.enableFeedback,{defaultValue:null,typeName:"bool"}));
    p.add(new DiagnosticsProperty("mouseCursor",this.mouseCursor,{defaultValue:null,typeName:"WidgetStateProperty<MouseCursor?>"}));
    p.add(new DiagnosticsProperty("visualDensity",this.visualDensity,{defaultValue:null,typeName:"VisualDensity"}));
    p.add(new DiagnosticsProperty("titleAlignment",this.titleAlignment,{defaultValue:null,typeName:"ListTileTitleAlignment"}));
    p.add(new DiagnosticsProperty("controlAffinity",this.controlAffinity,{defaultValue:null,typeName:"ListTileControlAffinity"}));
    p.add(new DiagnosticsProperty("isThreeLine",this.isThreeLine,{defaultValue:null,typeName:"bool"}));
  }
}
