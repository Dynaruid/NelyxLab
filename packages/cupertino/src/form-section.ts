// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// cupertino/form_section.dart at 71e4717a61786faab4c7aa39825989305ed29e8a.
import {StatelessWidget} from '@nelyx/core/framework/widgets/framework';
import type {BuildContext,Widget,WidgetOptions} from '@nelyx/core/framework/widgets/framework';
import {DefaultTextStyle} from '@nelyx/core/framework/widgets/default-text-style';
import {EdgeInsets,EdgeInsetsDirectional} from '@nelyx/core/framework/painting/edge-insets';
import type {EdgeInsetsGeometry} from '@nelyx/core/framework/painting/edge-insets';
import type {BoxDecoration} from '@nelyx/core/framework/painting/box-decoration';
import {TextStyle} from '@nelyx/core/framework/painting/text-style';
import type {Color} from '@nelyx/core/ui/color';
import type {Clip} from '@nelyx/core/ui/clip';
import {invariant} from '@nelyx/core/foundation/errors';
import {CupertinoColors} from './colors.ts';
import {CupertinoListSection} from './list-section.ts';

const insetMargin=EdgeInsetsDirectional.fromSTEB(20,0,20,10);
export interface CupertinoFormSectionOptions extends WidgetOptions {
  readonly children:readonly Widget[];readonly header?:Widget|null;readonly footer?:Widget|null;
  readonly margin?:EdgeInsetsGeometry;readonly backgroundColor?:Color;readonly decoration?:BoxDecoration|null;readonly clipBehavior?:Clip;
}
/** Form-specific typography and margins; CupertinoListSection owns row painting. */
export class CupertinoFormSection extends StatelessWidget {
  readonly children:readonly Widget[];readonly header:Widget|null;readonly footer:Widget|null;
  readonly margin:EdgeInsetsGeometry;readonly backgroundColor:Color;readonly decoration:BoxDecoration|null;readonly clipBehavior:Clip;
  private inset=false;
  constructor({key=null,children,header=null,footer=null,margin=EdgeInsets.zero,backgroundColor=CupertinoColors.systemGroupedBackground,decoration=null,clipBehavior='none'}:CupertinoFormSectionOptions){
    super(key);invariant(children.length>0,'empty-cupertino-form-section','CupertinoFormSection requires nonempty children');
    this.children=Object.freeze([...children]);this.header=header;this.footer=footer;this.margin=margin;this.backgroundColor=backgroundColor;this.decoration=decoration;this.clipBehavior=clipBehavior;
  }
  static insetGrouped(options:CupertinoFormSectionOptions):CupertinoFormSection {
    const section=new CupertinoFormSection({...options,margin:options.margin??insetMargin});section.inset=true;return section;
  }
  build(context:BuildContext):Widget {
    const style=new TextStyle({fontSize:13,color:CupertinoColors.secondaryLabel.resolveFrom(context).toARGB32()});
    const options={children:this.children,header:this.header===null?null:new DefaultTextStyle(style,this.header),footer:this.footer===null?null:new DefaultTextStyle(style,this.footer),margin:this.margin,backgroundColor:this.backgroundColor,decoration:this.decoration,clipBehavior:this.clipBehavior,hasLeading:false};
    return this.inset?CupertinoListSection.insetGrouped(options):new CupertinoListSection(options);
  }
}
