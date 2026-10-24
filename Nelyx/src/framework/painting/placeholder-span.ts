// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {InlineSpan,InlineSpanSemanticsInformation} from './inline-span.ts';
import type {PlainTextOptions} from './inline-span.ts';
import type {TextStyle} from './text-style.ts';
import type {PlaceholderAlignment,TextBaseline} from '../../ui/typography.ts';
import {invariant} from '../../foundation/errors.ts';
import {protect} from '../../ui/value-math.ts';
import type {DiagnosticPropertiesBuilder} from '../../foundation/diagnostics.ts';
import {EnumProperty} from '../../foundation/diagnostic-properties.ts';
export abstract class PlaceholderSpan extends InlineSpan {
  static readonly placeholderCodeUnit=0xfffc;
  constructor(readonly alignment:PlaceholderAlignment='bottom',readonly baseline:TextBaseline|null=null,style:TextStyle|null=null){super(style);invariant(!['baseline','aboveBaseline','belowBaseline'].includes(alignment)||baseline!==null,'missing-placeholder-baseline','Baseline alignment requires a text baseline');protect(this,['alignment','baseline']);}
  visitDirectChildren(_visitor:(span:InlineSpan)=>boolean):boolean{return true;}
  protected ownPlainText({includePlaceholders=true}:PlainTextOptions):string{return includePlaceholders?'\ufffc':'';}
  computeSemanticsInformation(collector:InlineSpanSemanticsInformation[]):void{collector.push(InlineSpanSemanticsInformation.placeholder);}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new EnumProperty('alignment',this.alignment,{defaultValue:null}));properties.add(new EnumProperty('baseline',this.baseline,{defaultValue:null}));}
}
