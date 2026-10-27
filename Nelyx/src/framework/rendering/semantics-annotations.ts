// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from pinned rendering/proxy_box.dart.
import {RenderProxyBox} from './boxes.ts';
import {SemanticsAnnotationsMixin} from './object.ts';
import type {RenderBox,RenderObject} from './object.ts';
import type {SemanticsProperties,SemanticsConfiguration} from '../semantics/semantics.ts';
import type {Locale} from '../../ui/locale.ts';
import {DiagnosticsProperty} from '../../foundation/diagnostics.ts';
import type {DiagnosticPropertiesBuilder} from '../../foundation/diagnostics.ts';

export interface RenderSemanticsAnnotationsOptions {
  readonly child?:RenderBox;readonly properties:SemanticsProperties;
  readonly container?:boolean;readonly explicitChildNodes?:boolean;readonly excludeSemantics?:boolean;readonly blockUserActions?:boolean;
  readonly localeForSubtree?:Locale|null;readonly textDirection?:'ltr'|'rtl'|null;
}
export class RenderSemanticsAnnotations extends SemanticsAnnotationsMixin(RenderProxyBox) {
  protected override markNeedsPaintAfterLayout():void{
    if(this.hasStaticLayoutSemantics(RenderSemanticsAnnotations.prototype,RenderSemanticsAnnotations.prototype.describeSemanticsConfiguration))this.markNeedsPaintAfterGeometryLayout();
    else super.markNeedsPaintAfterLayout();
  }
  constructor({child,properties,container=false,explicitChildNodes=false,excludeSemantics=false,blockUserActions=false,localeForSubtree=null,textDirection=null}:RenderSemanticsAnnotationsOptions){
    super(child);this.initSemanticsAnnotations({properties,container,explicitChildNodes,excludeSemantics,blockUserActions,localeForSubtree,textDirection});
  }
}
export class RenderBlockSemantics extends RenderProxyBox {
  protected override markNeedsPaintAfterLayout():void{
    if(this.hasStaticLayoutSemantics(RenderBlockSemantics.prototype,RenderBlockSemantics.prototype.describeSemanticsConfiguration))this.markNeedsPaintAfterGeometryLayout();
    else super.markNeedsPaintAfterLayout();
  }
  private _blocking:boolean;
  constructor({child,blocking=true}:{readonly child?:RenderBox;readonly blocking?:boolean}={}){super(child);this._blocking=blocking;}
  get blocking():boolean{return this._blocking;}
  set blocking(value:boolean){if(value===this._blocking)return;this._blocking=value;this.markNeedsSemanticsUpdate();}
  override describeSemanticsConfiguration(config:SemanticsConfiguration):void{super.describeSemanticsConfiguration(config);config.isBlockingSemanticsOfPreviouslyPaintedNodes=this.blocking;}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new DiagnosticsProperty('blocking',this.blocking));}
}
export class RenderMergeSemantics extends RenderProxyBox {
  protected override markNeedsPaintAfterLayout():void{
    if(this.hasStaticLayoutSemantics(RenderMergeSemantics.prototype,RenderMergeSemantics.prototype.describeSemanticsConfiguration))this.markNeedsPaintAfterGeometryLayout();
    else super.markNeedsPaintAfterLayout();
  }
  constructor({child}:{readonly child?:RenderBox}={}){super(child);}
  override describeSemanticsConfiguration(config:SemanticsConfiguration):void{super.describeSemanticsConfiguration(config);config.isSemanticBoundary=true;config.isMergingSemanticsOfDescendants=true;}
}
export class RenderExcludeSemantics extends RenderProxyBox {
  private _excluding:boolean;
  constructor({child,excluding=true}:{readonly child?:RenderBox;readonly excluding?:boolean}={}){super(child);this._excluding=excluding;}
  get excluding():boolean{return this._excluding;}
  set excluding(value:boolean){if(value===this._excluding)return;this._excluding=value;this.markNeedsSemanticsUpdate();}
  override visitChildrenForSemantics(visitor:(child:RenderObject)=>void):void{if(!this.excluding)super.visitChildrenForSemantics(visitor);}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new DiagnosticsProperty('excluding',this.excluding));}
}
RenderProxyBox._registerGeometryLayoutSemantics(RenderExcludeSemantics.prototype);
