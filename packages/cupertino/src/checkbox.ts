// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Resolved pinned API/default projection; functional build/paint share existing Core owners.
import {StatefulWidget,State} from '@nelyx/core/framework/widgets/framework';import type {BuildContext,Widget} from '@nelyx/core/framework/widgets/framework';import type {ControlInteractionOptions} from '@nelyx/core/framework/widgets/control-interaction';import {Color} from '@nelyx/core/ui/color';import type {Size} from '@nelyx/core/ui/size';import type {MouseCursor} from '@nelyx/core/services/mouse-cursor';import type {WidgetStateProperty} from '@nelyx/core/framework/widgets/widget-state';import type {FocusNode} from '@nelyx/core/framework/widgets/focus';import type {BorderSide,OutlinedBorder} from '@nelyx/core/framework/painting/borders';import {invariant} from '@nelyx/core/foundation/errors';import {coreCupertinoColor} from "./internal/colors/color-values.ts";import type {CupertinoColor} from "./internal/colors/color-values.ts";import {buildCupertinoCheckbox} from "./internal/checkbox/checkbox-build.ts";
type InteractionOptions=Pick<ControlInteractionOptions,"key"|"enabled"|"skipTraversal"|"statesController"|"onFocusChange"|"onHover"|"onHighlightChanged"|"onShowFocusHighlight"|"onShowHoverHighlight"|"shortcuts"|"actions">;
export interface CupertinoCheckboxOptions extends InteractionOptions {readonly id?:string;
  readonly value:boolean|null;
  readonly tristate?:boolean;
  readonly onChanged:((value0:boolean|null)=>void)|null;
  readonly mouseCursor?:MouseCursor|null;
  readonly activeColor?:CupertinoColor|null;
  readonly fillColor?:WidgetStateProperty<Color|null>|null;
  readonly checkColor?:CupertinoColor|null;
  readonly focusColor?:CupertinoColor|null;
  readonly focusNode?:FocusNode|null;
  readonly autofocus?:boolean;
  readonly side?:BorderSide|null;
  readonly shape?:OutlinedBorder|null;
  readonly tapTargetSize?:Size|null;
  readonly semanticLabel?:string|null;
}
export class CupertinoCheckbox extends StatefulWidget {
  readonly options:Readonly<CupertinoCheckboxOptions>;
  readonly value:boolean|null;
  readonly onChanged:((value0:boolean|null)=>void)|null;
  readonly mouseCursor:MouseCursor|null;
  readonly activeColor:Color|null;
  readonly fillColor:WidgetStateProperty<Color|null>|null;
  readonly checkColor:Color|null;
  readonly tristate:boolean;
  readonly focusColor:Color|null;
  readonly focusNode:FocusNode|null;
  readonly autofocus:boolean;
  readonly side:BorderSide|null;
  readonly shape:OutlinedBorder|null;
  readonly tapTargetSize:Size|null;
  readonly semanticLabel:string|null;
  /** @dartType double */ static readonly width=14;
  constructor(o:CupertinoCheckboxOptions){super(o.key??null);invariant(Object.keys(o).every(key=>["key","enabled","skipTraversal","statesController","onFocusChange","onHover","onHighlightChanged","onShowFocusHighlight","onShowHoverHighlight","shortcuts","actions","id","value","tristate","onChanged","mouseCursor","activeColor","fillColor","checkColor","focusColor","focusNode","autofocus","side","shape","tapTargetSize","semanticLabel"].includes(key)),'unsupported-cupertino-checkbox-option','Unknown or removed CupertinoCheckbox option');invariant(o.onChanged===null||typeof o.onChanged==='function','invalid-checkbox-callback','CupertinoCheckbox requires an explicit nullable callback');this.options=Object.freeze({...o});
    this.value=o.value;
    this.onChanged=o.onChanged;
    this.mouseCursor=o.mouseCursor??null;
    this.activeColor=o.activeColor==null?null:coreCupertinoColor(o.activeColor);
    this.fillColor=o.fillColor??null;
    this.checkColor=o.checkColor==null?null:coreCupertinoColor(o.checkColor);
    this.tristate=o.tristate??false;
    this.focusColor=o.focusColor==null?null:coreCupertinoColor(o.focusColor);
    this.focusNode=o.focusNode??null;
    this.autofocus=o.autofocus??false;
    this.side=o.side??null;
    this.shape=o.shape??null;
    this.tapTargetSize=o.tapTargetSize??null;
    this.semanticLabel=o.semanticLabel??null;
    invariant(typeof this.value==='boolean'||this.tristate&&this.value===null,'invalid-checkbox-value','Null checkbox values require tristate');
  }
  createState():State<CupertinoCheckbox>{return new CupertinoCheckboxState();}
}
class CupertinoCheckboxState extends State<CupertinoCheckbox>{build(context:BuildContext):Widget{return buildCupertinoCheckbox(this.widget,context);}}
