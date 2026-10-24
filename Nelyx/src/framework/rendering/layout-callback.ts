// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from Flutter rendering/object.dart at the recorded pin.
import {invariant} from '../../foundation/errors.ts';
import {RenderObject} from './object.ts';
import type {PipelineOwner} from './object.ts';
import {assertOutsideRenderPaint} from './phase.ts';
/** TypeScript mixin constructors require a single unconstrained argument tuple. */
export type RenderObjectConstructor<T extends RenderObject=RenderObject> = abstract new (...args:any[])=>T;
export interface LayoutCallbackRenderObject extends RenderObject {layoutCallback():void;runLayoutCallback():void;scheduleLayoutCallback():void}
export type LayoutCallbackConstructor<Base extends RenderObjectConstructor> = abstract new (...args:ConstructorParameters<Base>)=>InstanceType<Base>&LayoutCallbackRenderObject;
/** A real class factory applicable to box and non-box RenderObject subclasses. */
export function RenderObjectWithLayoutCallbackMixin<Base extends RenderObjectConstructor>(Base:Base):LayoutCallbackConstructor<Base>{
  abstract class LayoutCallbackRender extends Base {
    private _needsRebuild=true;
    abstract layoutCallback():void;
    runLayoutCallback():void{invariant(this.debugDoingThisLayout,'invalid-layout-callback','runLayoutCallback requires performLayout');this.invokeLayoutCallback(()=>this.layoutCallback());this._needsRebuild=false;}
    scheduleLayoutCallback():void{assertOutsideRenderPaint();invariant(!this.debugDisposed,'disposed-layout-callback','Cannot schedule a disposed layout callback');if(this._needsRebuild){invariant(this.needsLayout,'invalid-layout-callback','A pending layout callback must have dirty layout');return;}this.markNeedsLayout();this._needsRebuild=true;this.owner?.requestLayoutCallback(this);}
    override attach(owner:PipelineOwner):void{super.attach(owner);if(this._needsRebuild&&this.hasLayoutConstraints)owner.requestLayoutCallback(this);}
  }
  return LayoutCallbackRender as unknown as LayoutCallbackConstructor<Base>;
}
