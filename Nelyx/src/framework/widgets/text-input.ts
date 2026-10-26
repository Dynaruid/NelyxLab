// SPDX-License-Identifier: BSD-3-Clause
import type {BuildContext} from './framework.ts';import type {TextOptions} from './basic.ts';
import type {ResourceId} from '../../ui/types.ts';import {invariant} from '../../foundation/errors.ts';
import {Directionality,Localizations,MediaQuery,AppTheme} from './app-data.ts';import {DefaultTextStyle} from './default-text-style.ts';
import {TextStyle,copyCapturedTextStyle} from '../painting/text-style.ts';import {TextScaler} from '../painting/text-scaler.ts';
import {TextHeightBehavior,isOwnedTypographyValue} from '../../ui/typography.ts';
import {markCapturedTextRecord} from '../../ui/text-input-data.ts';
import type {TextPainterOptions} from '../painting/text-painter.ts';import {Locale} from '../../ui/locale.ts';
import type {ParagraphLayoutOptions} from '../rendering/paragraph-overflow.ts';
export function resolveTextConfiguration(context:BuildContext,options:TextOptions,{inheritDefaultStyle=true,defaultFontSize=18}:{readonly inheritDefaultStyle?:boolean;readonly defaultFontSize?:number}={}):{font:ResourceId;scale:number;style:TextStyle;scaler:TextScaler;paragraphOptions:ParagraphLayoutOptions;painterOptions:TextPainterOptions}{
  const font=options.font??(options.fontId!==undefined?context.services.assets.get(options.fontId):context.services.defaultFont);invariant(font,'missing-font','Text requires an application font');invariant(!options.textScaler||options.textScale===undefined,'ambiguous-text-scale','Choose textScaler or textScale');
  const defaults=inheritDefaultStyle?DefaultTextStyle.of(context):null,merged=(defaults?.style??new TextStyle()).merge(options.style),size=options.fontSize??merged.fontSize??defaultFontSize,locale=options.locale??merged.locale??context.maybeDependOn(Localizations)?.locale??'en',color=options.color??merged.color??(inheritDefaultStyle?context.maybeDependOn(AppTheme)?.data.foreground??0xffe8eef8:0xff000000),scaler=options.textScaler??(options.textScale!==undefined?TextScaler.linear(options.textScale):inheritDefaultStyle?context.maybeDependOn(MediaQuery)?.data.textScaler??TextScaler.linear(context.maybeDependOn(MediaQuery)?.data.textScale??1):TextScaler.noScaling),style=copyCapturedTextStyle(merged,merged.copyWith,{fontSize:size,locale,color}),behavior=options.textHeightBehavior??defaults?.options.textHeightBehavior??(style.leadingDistribution?new TextHeightBehavior({leadingDistribution:style.leadingDistribution}):undefined);
  const overflow=options.overflow??style.overflow??defaults?.overflow??'clip',paragraphOptions={softWrap:options.softWrap??defaults?.softWrap??true,overflow,textWidthBasis:options.textWidthBasis??defaults?.textWidthBasis??'parent'};
  const sourceMaxLines=options.maxLines??defaults?.options.maxLines??null,painterOptions:TextPainterOptions={textAlign:options.textAlign??defaults?.options.textAlign??'start',textDirection:options.direction??context.maybeDependOn(Directionality)?.direction??'ltr',textScaler:scaler,maxLines:sourceMaxLines,ellipsis:overflow==='ellipsis'?options.ellipsis??'\u2026':options.ellipsis??null,locale:new Locale(locale),strutStyle:options.strutStyle??null,textWidthBasis:paragraphOptions.textWidthBasis,textHeightBehavior:behavior??null};
  // Only this local literal has a locally created locale and no borrowed strut
  // preparation. External configurations retain their constructor/update calls.
  if(painterOptions.strutStyle===null&&isOwnedTypographyValue(behavior??null)&&!('toJSON' in TextHeightBehavior.prototype)&&!('toJSON' in Locale.prototype)){Object.freeze(painterOptions.locale);Object.freeze(painterOptions);markCapturedTextRecord(painterOptions);}
  return {font,scale:context.services.readMetrics().scale,style,scaler,paragraphOptions,painterOptions};
}
