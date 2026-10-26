// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// The Icon owns its glyph, fixed box, centering and semantics as one render
// primitive. There is no user Widget/State boundary inside this composition.
import {RenderProxyBox} from './boxes.ts';
import {RenderParagraph} from './paragraph.ts';
import type {RichParagraphConfiguration} from './paragraph.ts';
import type {RenderObject,TextBaseline} from './object.ts';
import {BoxConstraints} from './constraints.ts';
import type {ParagraphContext} from '../../ui/paragraph.ts';
import type {Size} from '../../ui/geometry.ts';
import {multiply} from '../../ui/geometry.ts';
import type {PaintingContext} from '../painting/context.ts';
import type {SemanticsConfiguration} from '../semantics/semantics.ts';

export interface IconGlyphConfiguration {
  readonly size:number;
  readonly mirror:boolean;
  readonly label:string|null;
  readonly labelDirection:'ltr'|'rtl'|null;
  readonly paragraph:RichParagraphConfiguration;
}

/** @internal One private paragraph; its lifetime follows this render owner. */
export class RenderIconGlyph extends RenderProxyBox {
  private readonly paragraph:RenderParagraph;
  private additional:BoxConstraints;
  constructor(private configuration:IconGlyphConfiguration,context:ParagraphContext){
    const additional=BoxConstraints.tightFor(configuration.size,configuration.size);
    additional.debugAssertIsValid();
    const paragraph=RenderParagraph._fromConfiguration(configuration.paragraph,context);
    super(paragraph);this.paragraph=paragraph;this.additional=additional;
  }
  configure(value:IconGlyphConfiguration):void{
    if(value===this.configuration)return;
    this.assertCanMutateLayoutProperty();
    const old=this.configuration;
    if(value.size!==old.size){const additional=BoxConstraints.tightFor(value.size,value.size);additional.debugAssertIsValid();this.additional=additional;this.markNeedsLayout();}
    this.paragraph.config=value.paragraph;
    this.paragraph.devicePixelRatio=value.paragraph.scale;
    if(value.mirror!==old.mirror)this.markNeedsPaint();
    if(value.label!==old.label||value.labelDirection!==old.labelDirection)this.markNeedsSemanticsUpdate();
    this.configuration=value;
  }
  protected override computeMinIntrinsicWidth(_height:number):number{return this.additional.minWidth;}
  protected override computeMaxIntrinsicWidth(_height:number):number{return this.additional.minWidth;}
  protected override computeMinIntrinsicHeight(_width:number):number{return this.additional.minHeight;}
  protected override computeMaxIntrinsicHeight(_width:number):number{return this.additional.minHeight;}
  protected override computeDryLayout(constraints:BoxConstraints):Size{return this.additional.enforce(constraints).smallest;}
  protected override computeDryBaseline(constraints:BoxConstraints,baseline:TextBaseline):number|null{
    const box=this.additional.enforce(constraints),inner=box.loosen(),value=this.paragraph.getDryBaseline(inner,baseline);
    return value===null?null:value+(box.minHeight-this.paragraph.getDryLayout(inner).height)/2;
  }
  protected override computeDistanceToActualBaseline(baseline:TextBaseline):number|null{
    const value=this.paragraph.getDistanceToActualBaseline(baseline);
    return value===null?null:value+this.paragraph.layoutOffset.y;
  }
  protected override performLayout(constraints:BoxConstraints):Size{
    const box=this.additional.enforce(constraints),size=box.smallest;
    this.paragraph.layout(box.loosen(),{parentUsesSize:true});
    this.paragraph.layoutOffset={x:(size.width-this.paragraph.size.width)/2,y:(size.height-this.paragraph.size.height)/2};
    return size;
  }
  // Mirroring affects glyph paint only. Hit tests and baseline/semantics retain
  // the same geometry as Transform.scale(transformHitTests:false).
  override paint(context:PaintingContext):void{
    if(this.configuration.mirror)context.paintChild(this.paragraph,multiply(this.childTransform(this.paragraph),[-1,0,0,1,this.paragraph.size.width,0]));
    else this.paintChild(context,this.paragraph);
  }
  override visitChildrenForSemantics(_visitor:(child:RenderObject)=>void):void{}
  override describeSemanticsConfiguration(config:SemanticsConfiguration):void{
    super.describeSemanticsConfiguration(config);
    if(this.configuration.label!==null){config.label=this.configuration.label;config.textDirection=this.configuration.labelDirection;}
  }
  override dispose():void{
    if(this.debugDisposed)return;
    let errors:unknown[]|undefined;
    try{super.dispose();}catch(error){(errors??=[]).push(error);}
    if(this.debugDisposed)try{this.paragraph.dispose();}catch(error){(errors??=[]).push(error);}
    if(errors?.length===1)throw errors[0];
    if(errors)throw new AggregateError(errors,'Icon glyph retirement failed');
  }
}
