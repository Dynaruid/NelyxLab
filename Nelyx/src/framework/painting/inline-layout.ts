// SPDX-License-Identifier: BSD-3-Clause
import {TextStyle} from './text-style.ts';import {TextScaler} from './text-scaler.ts';
import type {InlineSpan} from './inline-span.ts';import {PlaceholderSpan} from './placeholder-span.ts';
import type {TextRun,TextPlaceholder} from '../../ui/text-styles.ts';
import {invariant} from '../../foundation/errors.ts';
import {ParagraphBuilder} from '../../ui/paragraph-builder.ts';
import {ParagraphStyle} from '../../ui/paragraph-style.ts';
import type {PlaceholderDimensions} from './placeholder-dimensions.ts';
export interface InlinePlaceholder {readonly span:PlaceholderSpan;readonly style:TextStyle;readonly offset:number}
export interface InlineLayout {readonly text:string;readonly runs:readonly TextRun[];readonly placeholders:readonly TextPlaceholder[]}
export function collectInlinePlaceholders(span:InlineSpan,parent:TextStyle=new TextStyle()):readonly InlinePlaceholder[]{let offset=0,count=0;const result:InlinePlaceholder[]=[],seen=new Set<InlineSpan>();const visit=(node:InlineSpan,style:TextStyle,depth:number)=>{invariant(!seen.has(node)&&depth<128&&++count<=256,'inline-span-budget','Cyclic/oversize InlineSpan tree');seen.add(node);const resolved=style.merge(node.style);if(node instanceof PlaceholderSpan){result.push(Object.freeze({span:node,style:resolved,offset}));offset++;}else{offset+=node._plainTextContent({includeSemanticsLabels:false}).length;node.visitDirectChildren(child=>{visit(child,resolved,depth+1);return true;});}seen.delete(node);};visit(span,parent,0);invariant(result.length<=64,'inline-placeholder-budget','Too many WidgetSpans');return Object.freeze(result);}
export function compileInlineSpan(span:InlineSpan,parent:TextStyle,scaler:TextScaler,dimensions:readonly PlaceholderDimensions[]):InlineLayout{
  // Validate cycles/count before invoking custom source build methods.
  const placeholders=collectInlinePlaceholders(span,parent);invariant(placeholders.length===dimensions.length,'placeholder-count','Inline child count differs from placeholder dimensions');
  const builder=new ParagraphBuilder(new ParagraphStyle());
  try{builder.pushStyle(parent.getTextStyle({textScaler:scaler}));span.build(builder,{textScaler:scaler,dimensions});builder.pop();const paragraph=builder.build();try{const {text,runs,placeholders}=paragraph._textSnapshot();return Object.freeze({text,runs,placeholders});}finally{paragraph.dispose();}}
  finally{builder.dispose();}
}
