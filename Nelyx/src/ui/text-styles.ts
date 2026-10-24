// SPDX-License-Identifier: BSD-3-Clause
import type {Offset} from './geometry.ts';
import type {PaintSnapshot} from './paint.ts';
import type {TextAlign,FontStyle,TextLeadingDistribution,TextDecorationStyle,PlaceholderAlignment,TextBaseline} from './typography.ts';
export interface TextRunStyle {
  readonly color?:number;readonly backgroundColor?:number;readonly fontFamilies?:readonly string[];readonly fontSize?:number;readonly fontWeight?:number;readonly fontStyle?:FontStyle;
  readonly letterSpacing?:number;readonly wordSpacing?:number;readonly height?:number;readonly leadingDistribution?:TextLeadingDistribution;readonly locale?:string;
  readonly decoration?:number;readonly decorationColor?:number;readonly decorationThickness?:number;readonly decorationStyle?:TextDecorationStyle;
  readonly fontFeatures?:readonly {readonly name:string;readonly value:number}[];readonly fontVariations?:readonly {readonly axis:string;readonly value:number}[];
  readonly shadows?:readonly {readonly color:number;readonly offset:Offset;readonly blurSigma:number}[];
  readonly textBaseline?:TextBaseline;readonly foreground?:PaintSnapshot;readonly background?:PaintSnapshot;
}
export interface TextRun {readonly start:number;readonly end:number;readonly style:TextRunStyle}
export interface TextPlaceholder {readonly offset:number;readonly width:number;readonly height:number;readonly alignment:PlaceholderAlignment;readonly baseline:TextBaseline;readonly baselineOffset:number}
export interface TextStrutStyle {readonly fontFamilies?:readonly string[];readonly fontSize?:number;readonly fontWeight?:number;readonly fontStyle?:FontStyle;readonly height?:number;readonly leading?:number;readonly leadingDistribution?:TextLeadingDistribution;readonly forceStrutHeight?:boolean}
export interface ParagraphOptions {readonly textAlign?:TextAlign;readonly style?:TextRunStyle;readonly runs?:readonly TextRun[];readonly placeholders?:readonly TextPlaceholder[];readonly strutStyle?:TextStrutStyle;readonly textHeightBehavior?:{readonly applyHeightToFirstAscent:boolean;readonly applyHeightToLastDescent:boolean;readonly leadingDistribution:TextLeadingDistribution}}
