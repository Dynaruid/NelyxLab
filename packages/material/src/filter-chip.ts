// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Resolved API projection from the assessed full pinned source IR; functional build/State/render owners are explicit.
import {StatefulWidget,StatelessWidget,Widget} from '@nelyx/core/framework/widgets/framework';import type {WidgetOptions,State,BuildContext} from '@nelyx/core/framework/widgets/framework';
import type {TextStyle} from '@nelyx/core/framework/painting/text-style';import type {EdgeInsetsGeometry} from '@nelyx/core/framework/painting/edge-insets';import type {BorderSide,OutlinedBorder,ShapeBorder} from '@nelyx/core/framework/painting/borders';import {CircleBorder} from '@nelyx/core/framework/painting/circle-border';import type {Clip} from '@nelyx/core/ui/clip';import type {FocusNode} from '@nelyx/core/framework/widgets/focus';import type {Color} from '@nelyx/core/ui/color';import type {WidgetStateProperty} from '@nelyx/core/framework/widgets/widget-state';import type {VisualDensity,MaterialTapTargetSize} from './theme-data.ts';import type {IconThemeData} from '@nelyx/core/framework/widgets/icon-theme-data';import type {BoxConstraints} from '@nelyx/core/framework/rendering/constraints';import type {ChipAnimationStyle} from './chip-animation-style.ts';import type {MouseCursor} from '@nelyx/core/services/mouse-cursor';import type {ChipThemeData} from './chip-theme.ts';import {ChipTheme} from './chip-theme.ts';import {Icon} from '@nelyx/core/framework/widgets/icon';import {Icons} from './icons.ts';import {chipDefaultsM3} from "./internal/chip/chip-defaults.ts";import {invariant} from '@nelyx/core/foundation/errors';
import {RawChip} from './raw-chip.ts';
export interface FilterChipOptions extends WidgetOptions {
  readonly avatar?:Widget|null;
  readonly label:Widget;
  readonly labelStyle?:TextStyle|null;
  readonly labelPadding?:EdgeInsetsGeometry|null;
  readonly selected?:boolean;
  readonly onSelected:((value0:boolean)=>void)|null;
  readonly deleteIcon?:Widget|null;
  readonly onDeleted?:(()=>void)|null;
  readonly deleteIconColor?:Color|null;
  readonly deleteButtonTooltipMessage?:string|null;
  /** @dartType double? */ readonly pressElevation?:number|null;
  readonly disabledColor?:Color|null;
  readonly selectedColor?:Color|null;
  readonly tooltip?:string|null;
  readonly side?:BorderSide|null;
  readonly shape?:OutlinedBorder|null;
  readonly clipBehavior?:Clip;
  readonly focusNode?:FocusNode|null;
  readonly autofocus?:boolean;
  readonly color?:WidgetStateProperty<Color|null>|null;
  readonly backgroundColor?:Color|null;
  readonly padding?:EdgeInsetsGeometry|null;
  readonly visualDensity?:VisualDensity|null;
  readonly materialTapTargetSize?:MaterialTapTargetSize|null;
  /** @dartType double? */ readonly elevation?:number|null;
  readonly shadowColor?:Color|null;
  readonly surfaceTintColor?:Color|null;
  readonly iconTheme?:IconThemeData|null;
  readonly selectedShadowColor?:Color|null;
  readonly showCheckmark?:boolean|null;
  readonly checkmarkColor?:Color|null;
  readonly avatarBorder?:ShapeBorder;
  readonly avatarBoxConstraints?:BoxConstraints|null;
  readonly deleteIconBoxConstraints?:BoxConstraints|null;
  readonly chipAnimationStyle?:ChipAnimationStyle|null;
  readonly mouseCursor?:MouseCursor|null;
}
export class FilterChip extends StatelessWidget {
  readonly avatar:Widget|null;
  readonly label:Widget;
  readonly labelStyle:TextStyle|null;
  readonly labelPadding:EdgeInsetsGeometry|null;
  readonly selected:boolean;
  readonly onSelected:((value0:boolean)=>void)|null;
  readonly deleteIcon:Widget|null;
  readonly onDeleted:(()=>void)|null;
  readonly deleteIconColor:Color|null;
  readonly deleteButtonTooltipMessage:string|null;
  /** @dartType double? */ readonly pressElevation:number|null;
  readonly disabledColor:Color|null;
  readonly selectedColor:Color|null;
  readonly tooltip:string|null;
  readonly side:BorderSide|null;
  readonly shape:OutlinedBorder|null;
  readonly clipBehavior:Clip;
  readonly focusNode:FocusNode|null;
  readonly autofocus:boolean;
  readonly color:WidgetStateProperty<Color|null>|null;
  readonly backgroundColor:Color|null;
  readonly padding:EdgeInsetsGeometry|null;
  readonly visualDensity:VisualDensity|null;
  readonly materialTapTargetSize:MaterialTapTargetSize|null;
  /** @dartType double? */ readonly elevation:number|null;
  readonly shadowColor:Color|null;
  readonly surfaceTintColor:Color|null;
  readonly selectedShadowColor:Color|null;
  readonly showCheckmark:boolean|null;
  readonly checkmarkColor:Color|null;
  readonly avatarBorder:ShapeBorder;
  readonly iconTheme:IconThemeData|null;
  readonly avatarBoxConstraints:BoxConstraints|null;
  readonly deleteIconBoxConstraints:BoxConstraints|null;
  readonly chipAnimationStyle:ChipAnimationStyle|null;
  readonly mouseCursor:MouseCursor|null;
  private elevatedVariant=false;
  get isEnabled():boolean{return this.onSelected!==null;}
  /**
 * @dartParam pressElevation double?
 * @dartParam elevation double?
   */
  constructor(o:FilterChipOptions){super(o.key??null);invariant(o.label instanceof Widget,'invalid-chip-label','Chip requires an owning Widget label');
    this.avatar=o.avatar??null;
    this.label=o.label;
    this.labelStyle=o.labelStyle??null;
    this.labelPadding=o.labelPadding??null;
    this.selected=o.selected??false;
    this.onSelected=o.onSelected;
    this.deleteIcon=o.deleteIcon??null;
    this.onDeleted=o.onDeleted??null;
    this.deleteIconColor=o.deleteIconColor??null;
    this.deleteButtonTooltipMessage=o.deleteButtonTooltipMessage??null;
    this.pressElevation=o.pressElevation??null;
    this.disabledColor=o.disabledColor??null;
    this.selectedColor=o.selectedColor??null;
    this.tooltip=o.tooltip??null;
    this.side=o.side??null;
    this.shape=o.shape??null;
    this.clipBehavior=o.clipBehavior??'none';
    this.focusNode=o.focusNode??null;
    this.autofocus=o.autofocus??false;
    this.color=o.color??null;
    this.backgroundColor=o.backgroundColor??null;
    this.padding=o.padding??null;
    this.visualDensity=o.visualDensity??null;
    this.materialTapTargetSize=o.materialTapTargetSize??null;
    this.elevation=o.elevation??null;
    this.shadowColor=o.shadowColor??null;
    this.surfaceTintColor=o.surfaceTintColor??null;
    this.selectedShadowColor=o.selectedShadowColor??null;
    this.showCheckmark=o.showCheckmark??null;
    this.checkmarkColor=o.checkmarkColor??null;
    this.avatarBorder=o.avatarBorder??new CircleBorder();
    this.iconTheme=o.iconTheme??null;
    this.avatarBoxConstraints=o.avatarBoxConstraints??null;
    this.deleteIconBoxConstraints=o.deleteIconBoxConstraints??null;
    this.chipAnimationStyle=o.chipAnimationStyle??null;
    this.mouseCursor=o.mouseCursor??null;
    invariant(this.elevation===null||this.elevation>=0,'invalid-chip-elevation','Chip elevation must be nonnegative');
    invariant(this.pressElevation===null||this.pressElevation>=0,'invalid-chip-elevation','Chip elevation must be nonnegative');
  }
  /**
 * @dartParam pressElevation double?
 * @dartParam elevation double?
   */
  static elevated(o:FilterChipOptions):FilterChip{const result=new FilterChip(o);result.elevatedVariant=true;return result;}
  build(context:BuildContext):Widget{return new RawChip({avatar:this.avatar,label:this.label,labelStyle:this.labelStyle,labelPadding:this.labelPadding,selected:this.selected,onSelected:this.onSelected,onDeleted:this.onDeleted,deleteIconColor:this.deleteIconColor,deleteButtonTooltipMessage:this.deleteButtonTooltipMessage,pressElevation:this.pressElevation,disabledColor:this.disabledColor,selectedColor:this.selectedColor,tooltip:this.tooltip,side:this.side,shape:this.shape,clipBehavior:this.clipBehavior,focusNode:this.focusNode,autofocus:this.autofocus,color:this.color,backgroundColor:this.backgroundColor,padding:this.padding,visualDensity:this.visualDensity,materialTapTargetSize:this.materialTapTargetSize,elevation:this.elevation,shadowColor:this.shadowColor,surfaceTintColor:this.surfaceTintColor,selectedShadowColor:this.selectedShadowColor,showCheckmark:this.showCheckmark,checkmarkColor:this.checkmarkColor,avatarBorder:this.avatarBorder,iconTheme:this.iconTheme,avatarBoxConstraints:this.avatarBoxConstraints,deleteIconBoxConstraints:this.deleteIconBoxConstraints,chipAnimationStyle:this.chipAnimationStyle,mouseCursor:this.mouseCursor,defaultProperties:chipDefaultsM3(context,'FilterChip',this.isEnabled,this.selected,this.elevatedVariant),isEnabled:this.isEnabled,deleteIcon:this.deleteIcon??new Icon(Icons.clear,{size:18})});}
}
