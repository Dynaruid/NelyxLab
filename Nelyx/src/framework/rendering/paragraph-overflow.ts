// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Shared box/rich paragraph adapter for the pinned rendering/paragraph.dart wrapping and overflow policy.
import type {TextLayout,TextLayoutInput} from '../../ui/types.ts';
import type {Size} from '../../ui/geometry.ts';
import {textLimits} from '../../ui/text.ts';
import {Paint} from '../../ui/paint.ts';
import {Gradient} from '../../ui/shader.ts';import type {Shader} from '../../ui/shader.ts';
import {Offset} from '../../ui/offset.ts';
import type {PaintingContext} from '../painting/context.ts';
import type {TextPainter,TextOverflow,TextWidthBasis} from '../painting/text-painter.ts';
export interface ParagraphLayoutOptions {readonly softWrap?:boolean;readonly overflow?:TextOverflow;readonly textWidthBasis?:TextWidthBasis}
export function paragraphLayoutWidth(maxWidth:number,options:ParagraphLayoutOptions):number{return options.softWrap===false&&options.overflow!=='ellipsis'?textLimits.width:Math.min(maxWidth,textLimits.width);}
export function paragraphContentWidth(geometry:{readonly maxIntrinsicWidth:number;readonly longestLine:number},options:ParagraphLayoutOptions):number{return options.textWidthBasis==='longestLine'?geometry.longestLine:geometry.maxIntrinsicWidth;}
export function paragraphHasOverflow(paragraph:TextLayout|undefined,size:Size,contentWidth?:number):boolean{return !!paragraph&&(paragraph.overflow||paragraph.height>size.height||(contentWidth===undefined?paragraph.longestLine>size.width+.01:contentWidth>size.width));}
export function paintParagraphOverflow(context:PaintingContext,paragraph:TextLayout,size:Size,options:ParagraphLayoutOptions,input:Omit<TextLayoutInput,'width'>,painter:TextPainter,paint:()=>void,contentWidth?:number,overflowShader?:Shader):void {
  if(!paragraphHasOverflow(paragraph,size,contentWidth)||options.overflow==='visible'){paint();return;}
  const bounds={x:0,y:0,...size},fade=options.overflow==='fade';
  if(fade)context.saveLayer(bounds,new Paint());else context.save();
  try{
    context.clipRect(bounds);paint();
    if(fade){
      if(overflowShader){context.drawRect(bounds,new Paint({blendMode:'modulate',shader:overflowShader}));return;}
      // Root-span style is used for the ellipsis probe; inline runs and placeholders belong to the original body.
      const {runs:_runs,placeholders:_placeholders,...base}=input;
      const geometry=painter.measure({...base,text:'\u2026',maxLines:1,ellipsis:'',width:textLimits.width});
      const horizontal=contentWidth===undefined?paragraph.longestLine>size.width+.01:contentWidth>size.width;
      const start=horizontal?new Offset(input.direction==='rtl'?geometry.maxIntrinsicWidth:size.width-geometry.maxIntrinsicWidth,0):new Offset(0,size.height-geometry.height/2);
      const end=horizontal?new Offset(input.direction==='rtl'?0:size.width,0):new Offset(0,size.height);
      context.drawRect(bounds,new Paint({blendMode:'modulate',shader:Gradient.linear(start,end,[0xffffffff,0x00ffffff])}));
    }
  }finally{context.restore();}
}
