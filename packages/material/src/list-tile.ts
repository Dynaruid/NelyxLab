// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Finite API projection from pinned resolved IR; behavior is an explicit functional port.
import {StatelessWidget,Widget} from '@nelyx/core/framework/widgets/framework';import type {BuildContext,WidgetOptions} from '@nelyx/core/framework/widgets/framework';import {Text} from '@nelyx/core/framework/widgets/basic';import {Color} from '@nelyx/core/ui/color';import {TextStyle} from '@nelyx/core/framework/painting/text-style';import {ShapeBorder} from '@nelyx/core/framework/painting/borders';import {EdgeInsetsGeometry} from '@nelyx/core/framework/painting/edge-insets';import type {MouseCursor} from '@nelyx/core/services/mouse-cursor';import type {FocusNode} from '@nelyx/core/framework/widgets/focus';import type {WidgetStatesController,WidgetStateProperty} from '@nelyx/core/framework/widgets/widget-state';import type {VisualDensity} from './theme-data.ts';import {ListTileStyle,ListTileControlAffinity,ListTileTitleAlignment} from "./generated/list/list-tile-types.ts";
import {invariant} from '@nelyx/core/foundation/errors';import {buildListTile,divideListTiles,listTileDiagnostics} from "./internal/list/list-tile-build.ts";import type {DiagnosticPropertiesBuilder} from '@nelyx/core/foundation/diagnostics';
export {ListTileStyle,ListTileControlAffinity,ListTileTitleAlignment} from "./generated/list/list-tile-types.ts";
export interface ListTileOptions extends WidgetOptions {readonly id?:string;
  readonly leading?:Widget|null;
  readonly title?:Widget|null;
  readonly subtitle?:Widget|null;
  readonly trailing?:Widget|null;
  readonly isThreeLine?:boolean|null;
  readonly dense?:boolean|null;
  readonly visualDensity?:VisualDensity|null;
  readonly shape?:ShapeBorder|null;
  readonly style?:ListTileStyle|null;
  readonly selectedColor?:Color|null;
  readonly iconColor?:Color|null;
  readonly textColor?:Color|null;
  readonly titleTextStyle?:TextStyle|null;
  readonly subtitleTextStyle?:TextStyle|null;
  readonly leadingAndTrailingTextStyle?:TextStyle|null;
  readonly contentPadding?:EdgeInsetsGeometry|null;
  readonly enabled?:boolean;
  readonly onTap?:(()=>void)|null;
  readonly onLongPress?:(()=>void)|null;
  readonly onFocusChange?:((value0:boolean)=>void)|null;
  readonly mouseCursor?:MouseCursor|null;
  readonly selected?:boolean;
  readonly focusColor?:Color|null;
  readonly hoverColor?:Color|null;
  readonly splashColor?:Color|null;
  readonly focusNode?:FocusNode|null;
  readonly autofocus?:boolean;
  readonly tileColor?:Color|null;
  readonly selectedTileColor?:Color|null;
  readonly enableFeedback?:boolean|null;
  /** @dartType double? */ readonly horizontalTitleGap?:number|null;
  /** @dartType double? */ readonly minVerticalPadding?:number|null;
  /** @dartType double? */ readonly minLeadingWidth?:number|null;
  /** @dartType double? */ readonly minTileHeight?:number|null;
  readonly titleAlignment?:ListTileTitleAlignment|null;
  readonly internalAddSemanticForOnTap?:boolean;
  readonly statesController?:WidgetStatesController|null;
}
export class ListTile extends StatelessWidget {
  readonly id:string|undefined;
  readonly leading:Widget|null;
  readonly title:Widget|null;
  readonly subtitle:Widget|null;
  readonly trailing:Widget|null;
  readonly isThreeLine:boolean|null;
  readonly dense:boolean|null;
  readonly visualDensity:VisualDensity|null;
  readonly shape:ShapeBorder|null;
  readonly selectedColor:Color|null;
  readonly iconColor:Color|null;
  readonly textColor:Color|null;
  readonly titleTextStyle:TextStyle|null;
  readonly subtitleTextStyle:TextStyle|null;
  readonly leadingAndTrailingTextStyle:TextStyle|null;
  readonly style:ListTileStyle|null;
  readonly contentPadding:EdgeInsetsGeometry|null;
  readonly enabled:boolean;
  readonly onTap:(()=>void)|null;
  readonly onLongPress:(()=>void)|null;
  readonly onFocusChange:((value0:boolean)=>void)|null;
  readonly mouseCursor:MouseCursor|null;
  readonly selected:boolean;
  readonly focusColor:Color|null;
  readonly hoverColor:Color|null;
  readonly splashColor:Color|null;
  readonly focusNode:FocusNode|null;
  readonly autofocus:boolean;
  readonly tileColor:Color|null;
  readonly selectedTileColor:Color|null;
  readonly enableFeedback:boolean|null;
  /** @dartType double? */ readonly horizontalTitleGap:number|null;
  /** @dartType double? */ readonly minVerticalPadding:number|null;
  /** @dartType double? */ readonly minLeadingWidth:number|null;
  /** @dartType double? */ readonly minTileHeight:number|null;
  readonly titleAlignment:ListTileTitleAlignment|null;
  readonly internalAddSemanticForOnTap:boolean;
  readonly statesController:WidgetStatesController|null;
  /**
 * @dartParam horizontalTitleGap double?
 * @dartParam minVerticalPadding double?
 * @dartParam minLeadingWidth double?
 * @dartParam minTileHeight double?
   */
  constructor(o?:ListTileOptions);
  constructor(id:string,title:string,onPressed:()=>void,leading?:Widget);
  constructor(first:ListTileOptions|string={},title?:string,onPressed?:()=>void,leading?:Widget){const o:ListTileOptions=typeof first==='string'?{id:first,title:new Text(title??''),onTap:onPressed??null,leading:leading??null}:first;super(o.key??null);this.id=o.id;
    this.leading=o.leading??null;
    this.title=o.title??null;
    this.subtitle=o.subtitle??null;
    this.trailing=o.trailing??null;
    this.isThreeLine=o.isThreeLine??null;
    this.dense=o.dense??null;
    this.visualDensity=o.visualDensity??null;
    this.shape=o.shape??null;
    this.selectedColor=o.selectedColor??null;
    this.iconColor=o.iconColor??null;
    this.textColor=o.textColor??null;
    this.titleTextStyle=o.titleTextStyle??null;
    this.subtitleTextStyle=o.subtitleTextStyle??null;
    this.leadingAndTrailingTextStyle=o.leadingAndTrailingTextStyle??null;
    this.style=o.style??null;
    this.contentPadding=o.contentPadding??null;
    this.enabled=o.enabled??true;
    this.onTap=o.onTap??null;
    this.onLongPress=o.onLongPress??null;
    this.onFocusChange=o.onFocusChange??null;
    this.mouseCursor=o.mouseCursor??null;
    this.selected=o.selected??false;
    this.focusColor=o.focusColor??null;
    this.hoverColor=o.hoverColor??null;
    this.splashColor=o.splashColor??null;
    this.focusNode=o.focusNode??null;
    this.autofocus=o.autofocus??false;
    this.tileColor=o.tileColor??null;
    this.selectedTileColor=o.selectedTileColor??null;
    this.enableFeedback=o.enableFeedback??null;
    this.horizontalTitleGap=o.horizontalTitleGap??null;
    this.minVerticalPadding=o.minVerticalPadding??null;
    this.minLeadingWidth=o.minLeadingWidth??null;
    this.minTileHeight=o.minTileHeight??null;
    this.titleAlignment=o.titleAlignment??null;
    this.internalAddSemanticForOnTap=o.internalAddSemanticForOnTap??true;
    this.statesController=o.statesController??null;
    invariant(this.isThreeLine!==true||this.subtitle!==null,'invalid-three-line-tile','A three-line ListTile requires a subtitle');
  }
  build(context:BuildContext):Widget{return buildListTile(this,context);}
  static divideTiles(o:{readonly context?:BuildContext|null;readonly tiles:Iterable<Widget>;readonly color?:Color|null}):Iterable<Widget>{return divideListTiles(o);}
  override debugFillProperties(p:DiagnosticPropertiesBuilder):void{super.debugFillProperties(p);listTileDiagnostics(this,p);}
}
