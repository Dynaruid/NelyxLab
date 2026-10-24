// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// cupertino/form_row.dart at 71e4717a61786faab4c7aa39825989305ed29e8a.
import {StatelessWidget} from '@nelyx/core/framework/widgets/framework';
import type {BuildContext,Widget,WidgetOptions} from '@nelyx/core/framework/widgets/framework';
import {Align,Column,Flexible,Padding,Row} from '@nelyx/core/framework/widgets/basic';
import {DefaultTextStyle} from '@nelyx/core/framework/widgets/default-text-style';
import {AlignmentDirectional} from '@nelyx/core/framework/painting/alignment';
import {EdgeInsetsDirectional} from '@nelyx/core/framework/painting/edge-insets';
import type {EdgeInsetsGeometry} from '@nelyx/core/framework/painting/edge-insets';
import {TextStyle} from '@nelyx/core/framework/painting/text-style';
import {FontWeight} from '@nelyx/core/ui/typography';
import {CupertinoColors} from './colors.ts';
import {CupertinoTheme} from './theme.ts';

const defaultPadding=EdgeInsetsDirectional.fromSTEB(20,6,6,6);
export interface CupertinoFormRowOptions extends WidgetOptions {
  readonly child:Widget;readonly prefix?:Widget|null;readonly padding?:EdgeInsetsGeometry|null;
  readonly helper?:Widget|null;readonly error?:Widget|null;
}
/** Cupertino form composition on the canonical Core layout and text owners. */
export class CupertinoFormRow extends StatelessWidget {
  readonly child:Widget;readonly prefix:Widget|null;readonly padding:EdgeInsetsGeometry|null;
  readonly helper:Widget|null;readonly error:Widget|null;
  constructor({key=null,child,prefix=null,padding=null,helper=null,error=null}:CupertinoFormRowOptions){
    super(key);this.child=child;this.prefix=prefix;this.padding=padding;this.helper=helper;this.error=error;
  }
  build(context:BuildContext):Widget {
    const textStyle=CupertinoTheme.of(context).textTheme.textStyle;
    return new Padding(this.padding??defaultPadding,new Column([
      new Row([
        ...(this.prefix===null?[]:[new DefaultTextStyle(textStyle,this.prefix)]),
        new Flexible(new Align(this.child,{alignment:AlignmentDirectional.centerEnd})),
      ],{mainAxisAlignment:'spaceBetween'}),
      ...(this.helper===null?[]:[new Align(new DefaultTextStyle(textStyle,this.helper),{alignment:AlignmentDirectional.centerStart})]),
      ...(this.error===null?[]:[new Align(new DefaultTextStyle(new TextStyle({color:CupertinoColors.destructiveRed.toARGB32(),fontWeight:FontWeight.w500}),this.error),{alignment:AlignmentDirectional.centerStart})]),
    ]));
  }
}
