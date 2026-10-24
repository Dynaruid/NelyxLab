// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {StatelessWidget,RenderObjectWidget,MultiChildRenderObjectElement} from './framework.ts';import type {Widget,BuildContext} from './framework.ts';import type {TextOptions} from './basic.ts';
import type {InlineSpan} from '../painting/inline-span.ts';import {collectInlinePlaceholders} from '../painting/inline-layout.ts';import {WidgetSpan} from './widget-span.ts';import {resolveTextInput} from './text-input.ts';
import {RenderParagraph,RenderRichParagraph} from '../rendering/paragraph.ts';import type {RichParagraphConfiguration} from '../rendering/paragraph.ts';import type {RenderBox} from '../rendering/object.ts';import {invariant} from '../../foundation/errors.ts';
import type {SelectionRegistrar} from '../rendering/selection.ts';import {FoundationBuildMode} from '../../foundation/constants.ts';
import {TextSpan} from '../painting/text-span.ts';
export interface RichTextOptions extends TextOptions {readonly selectionRegistrar?:SelectionRegistrar|null;readonly selectionColor?:number|null}
export class RichText extends StatelessWidget {
  constructor(readonly text:InlineSpan,readonly options:RichTextOptions={}){super(options.key??null);if(FoundationBuildMode.debug)invariant(options.selectionRegistrar==null||options.selectionColor!=null,'missing-selection-color','Selectable RichText requires selectionColor');}
  build(context:BuildContext):Widget{const resolved=resolveTextInput(context,this.text.toPlainText({includeSemanticsLabels:false}),this.options,{inheritDefaultStyle:false,defaultFontSize:14}),placeholders=collectInlinePlaceholders(this.text,resolved.style);const children=WidgetSpan.extractFromInlineSpan(new TextSpan({style:resolved.style,children:[this.text]}),resolved.scaler);invariant(children.length===placeholders.length,'unsupported-placeholder-span','RichText only lays out WidgetSpan placeholders');return new RichParagraphWidget({span:this.text,style:resolved.style,scaler:resolved.scaler,placeholders,input:resolved.input,paragraphOptions:resolved.paragraphOptions,painterOptions:resolved.painterOptions},children,this.options.selectionRegistrar??null,this.options.selectionColor??null);}
}
let sequence=0;
class RichParagraphWidget extends RenderObjectWidget {
  constructor(readonly config:RichParagraphConfiguration,readonly childWidgets:readonly Widget[],readonly registrar:SelectionRegistrar|null,readonly selectionColor:number|null){super();}
  override createElement():MultiChildRenderObjectElement{return new MultiChildRenderObjectElement(this);}
  createRenderObject(context:BuildContext):RenderBox{const render=RenderParagraph._fromConfiguration(this.config,{text:context.services.text,resources:context.services.resources,font:this.config.input.font,scale:this.config.input.scale});render.registrar=this.registrar;render.selectionColor=this.selectionColor;render.semantics={id:'rich-text-'+ ++sequence,role:'group',name:this.config.span.toPlainText().replaceAll('\ufffc',' '),enabled:true};return render;}
  updateRenderObject(_context:BuildContext,object:RenderBox):void{
    const render=object as RenderRichParagraph;
    // createRenderObject already applied this private, resolved configuration.
    // A later RichText build creates a new configuration and still updates it.
    if(render.config!==this.config)render.config=this.config;
    if(render instanceof RenderParagraph)render.devicePixelRatio=this.config.input.scale;
    render.registrar=this.registrar;render.selectionColor=this.selectionColor;
    const name=this.config.span.toPlainText().replaceAll('\ufffc',' ');
    if(render.semantics!.name!==name)render.semantics={...render.semantics!,name};
  }
}
