// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Pinned lookup_boundary.dart traversal; explicit constructor tokens preserve runtime types.
import {InheritedWidget,InheritedElement,StatefulElement,RenderObjectElement,Element} from './framework.ts';import type {Widget,State,BuildContext,WidgetOptions} from './framework.ts';import type {RenderObject} from '../rendering/object.ts';import {FoundationBuildMode} from '../../foundation/constants.ts';import {invariant} from '../../foundation/errors.ts';
type Type<T>=abstract new (...args:never[])=>T;
export class LookupBoundary extends InheritedWidget {
  constructor(child:Widget,options:WidgetOptions={}){super(child,options.key??null);}
  updateShouldNotify(_old:this):boolean{return false;}
  static visitAncestorElements(context:BuildContext,visitor:(element:Element)=>boolean):void{context.visitAncestorElements(element=>visitor(element)&&element.widget.constructor!==LookupBoundary);}
  static visitChildElements(context:BuildContext,visitor:(element:Element)=>void):void{invariant(context instanceof Element,'invalid-boundary-context','LookupBoundary child traversal requires a live Element');for(const child of context.children)if(child.widget.constructor!==LookupBoundary)visitor(child);}
  static findAncestorWidgetOfExactType<T extends Widget>(context:BuildContext,type:Type<T>):T|null{let result:T|null=null;this.visitAncestorElements(context,e=>{if(e.widget.constructor===type){result=e.widget as T;return false;}return true;});return result;}
  static findAncestorStateOfType<T extends State>(context:BuildContext,type:Type<T>):T|null{let result:T|null=null;this.visitAncestorElements(context,e=>{if(e instanceof StatefulElement&&e.stateObject instanceof type){result=e.stateObject;return false;}return true;});return result;}
  static findRootAncestorStateOfType<T extends State>(context:BuildContext,type:Type<T>):T|null{let result:T|null=null;this.visitAncestorElements(context,e=>{if(e instanceof StatefulElement&&e.stateObject instanceof type)result=e.stateObject;return true;});return result;}
  static findAncestorRenderObjectOfType<T extends RenderObject>(context:BuildContext,type:Type<T>):T|null{let result:T|null=null;this.visitAncestorElements(context,e=>{if(e instanceof RenderObjectElement&&e.renderObject instanceof type){result=e.renderObject;return false;}return true;});return result;}
  static getElementForInheritedWidgetOfExactType<T extends InheritedWidget>(context:BuildContext,type:Type<T>):InheritedElement|null{let result:InheritedElement|null=null;this.visitAncestorElements(context,e=>{if(e instanceof InheritedElement&&e.widget.constructor===type){result=e;return false;}return true;});return result;}
  static getInheritedWidgetOfExactType<T extends InheritedWidget>(context:BuildContext,type:Type<T>,_options:{readonly aspect?:unknown}={}):T|null{return this.getElementForInheritedWidgetOfExactType(context,type)?.widget as T??null;}
  static dependOnInheritedWidgetOfExactType<T extends InheritedWidget>(context:BuildContext,type:Type<T>,options:{readonly aspect?:unknown}={}):T|null{context.maybeDependOn(LookupBoundary);const candidate=this.getElementForInheritedWidgetOfExactType(context,type);return candidate?context.dependOnInheritedElement<T>(candidate,options.aspect):null;}
  private static hidden(context:BuildContext,matches:(e:Element)=>boolean):boolean{invariant(FoundationBuildMode.debug,'debug-boundary-query','Debug hiding queries require debug mode');let hidden=false,result=false;context.visitAncestorElements(e=>{if(matches(e)){result=hidden;return false;}hidden ||= e.widget.constructor===LookupBoundary;return true;});return result;}
  static debugIsHidingAncestorWidgetOfExactType<T extends Widget>(context:BuildContext,type:Type<T>):boolean{return this.hidden(context,e=>e.widget.constructor===type);}
  static debugIsHidingAncestorStateOfType<T extends State>(context:BuildContext,type:Type<T>):boolean{return this.hidden(context,e=>e instanceof StatefulElement&&e.stateObject instanceof type);}
  static debugIsHidingAncestorRenderObjectOfType<T extends RenderObject>(context:BuildContext,type:Type<T>):boolean{return this.hidden(context,e=>e instanceof RenderObjectElement&&e.renderObject instanceof type);}
}
