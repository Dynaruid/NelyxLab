// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from Flutter widgets/indexed_stack.dart at the recorded pin.
import {invariant} from '../../foundation/errors.ts';
import type {Clip} from '../../ui/clip.ts';
import {AlignmentGeometry,AlignmentDirectional} from '../painting/alignment.ts';
import {RenderIndexedStack} from '../rendering/indexed-stack.ts';
import type {RenderStack} from '../rendering/boxes.ts';
import type {StackFit} from '../rendering/boxes.ts';
import {StatelessWidget,MultiChildRenderObjectElement} from './framework.ts';
import type {Widget,WidgetOptions,BuildContext,Element} from './framework.ts';
import {Stack} from './basic.ts';
import {Directionality} from './app-data.ts';
import {ExcludeFocus} from './focus-scope.ts';
import {_VisibilityScope} from './visibility-scope.ts';
export interface IndexedStackOptions extends WidgetOptions {readonly alignment?:AlignmentGeometry;readonly textDirection?:'ltr'|'rtl'|null;readonly clipBehavior?:Clip;readonly sizing?:StackFit;readonly index?:number|null}
export class IndexedStack extends StatelessWidget {
  readonly children:readonly Widget[];readonly alignment:AlignmentGeometry;readonly textDirection:'ltr'|'rtl'|null;readonly clipBehavior:Clip;readonly sizing:StackFit;readonly index:number|null;
  constructor(children:readonly Widget[]=[],{key=null,alignment=AlignmentDirectional.topStart,textDirection=null,clipBehavior='hardEdge',sizing='loose',index=0}:IndexedStackOptions={}){super(key);invariant(alignment instanceof AlignmentGeometry,'invalid-stack-alignment','AlignmentGeometry is required');invariant(textDirection===null||textDirection==='ltr'||textDirection==='rtl','invalid-text-direction','Unknown stack text direction');invariant(['loose','expand','passthrough'].includes(sizing),'invalid-stack-fit','Unknown StackFit');invariant(['none','hardEdge','antiAlias','antiAliasWithSaveLayer'].includes(clipBehavior),'invalid-clip','Unknown clip');invariant(index===null||Number.isSafeInteger(index),'invalid-indexed-stack-index','Index must be an integer or null');this.children=Object.freeze([...children]);this.alignment=alignment;this.textDirection=textDirection;this.clipBehavior=clipBehavior;this.sizing=sizing;this.index=index;}
  build(_context?:BuildContext):Widget{return new _RawIndexedStack(this.children.map((child,i)=>new _VisibilityScope(i===this.index,new ExcludeFocus(child,{excluding:i!==this.index}))),this);}
}
class _RawIndexedStack extends Stack {
  readonly index:number|null;readonly textDirection:'ltr'|'rtl'|null;
  constructor(children:readonly Widget[],options:IndexedStack){super(children,{alignment:options.alignment,clipBehavior:options.clipBehavior,fit:options.sizing});invariant(options.index===null||options.index===0&&!children.length||options.index>=0&&options.index<children.length,'invalid-indexed-stack-index','Index must be null or within the range of children');this.index=options.index;this.textDirection=options.textDirection;}
  private direction(context:BuildContext):'ltr'|'rtl'|null{const direction=this.textDirection??context.maybeDependOn(Directionality)?.direction??null;invariant(!(this.alignment instanceof AlignmentDirectional)||direction!==null,'missing-directionality','Directional IndexedStack alignment requires Directionality or an explicit textDirection');return direction;}
  override createRenderObject(context:BuildContext):RenderIndexedStack{return new RenderIndexedStack({index:this.index,fit:this.fit,clipBehavior:this.clipBehavior,alignment:this.alignment,textDirection:this.direction(context)});}
  override updateRenderObject(context:BuildContext,render:RenderStack):void{invariant(render instanceof RenderIndexedStack,'invalid-indexed-stack-render','IndexedStack requires RenderIndexedStack');render.index=this.index;render.fit=this.fit;render.clipBehavior=this.clipBehavior;render.alignment=this.alignment;render.textDirection=this.direction(context);}
  override createElement():MultiChildRenderObjectElement{return new _IndexedStackElement(this);}
}
class _IndexedStackElement extends MultiChildRenderObjectElement {
  debugVisitOnstageChildren(visitor:(element:Element)=>void):void{const index=(this.widget as _RawIndexedStack).index;if(index!==null&&this.children.length)visitor(this.children[index]!);}
}
