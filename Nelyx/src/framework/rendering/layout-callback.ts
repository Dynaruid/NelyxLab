// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from Flutter rendering/object.dart at the recorded pin.
import { invariant } from '../../foundation/errors.ts';
import { RenderObject, isNativeRenderObject } from './object.ts';
import type { PipelineOwner } from './object.ts';
import { assertOutsideRenderPaint } from './phase.ts';
/** TypeScript mixin constructors require a single unconstrained argument tuple. */
export type RenderObjectConstructor<T extends RenderObject = RenderObject> = abstract new (
  ...args: any[]
) => T;
export interface LayoutCallbackRenderObject extends RenderObject {
  layoutCallback(): void;
  runLayoutCallback(): void;
  scheduleLayoutCallback(): void;
  /** @internal Builds configuration with Content-supplied input, without TS layout. */
  _runNativeLayoutCallback(callback: () => void): void;
}
const nativeSchedules = new WeakMap<RenderObject, () => void>();
/** @internal Only canonical configuration factories register this scheduling path. */
export function registerNativeLayoutCallback(render: RenderObject, scheduled: () => void): void {
  invariant(
    !nativeSchedules.has(render),
    'duplicate-native-layout-callback',
    'Callback is already registered',
  );
  nativeSchedules.set(render, scheduled);
}
export type LayoutCallbackConstructor<Base extends RenderObjectConstructor> = abstract new (
  ...args: ConstructorParameters<Base>
) => InstanceType<Base> & LayoutCallbackRenderObject;
/** A real class factory applicable to box and non-box RenderObject subclasses. */
export function RenderObjectWithLayoutCallbackMixin<Base extends RenderObjectConstructor>(
  Base: Base,
): LayoutCallbackConstructor<Base> {
  abstract class LayoutCallbackRender extends Base {
    private _needsRebuild = true;
    abstract layoutCallback(): void;
    runLayoutCallback(): void {
      invariant(
        this.debugDoingThisLayout,
        'invalid-layout-callback',
        'runLayoutCallback requires performLayout',
      );
      this.invokeLayoutCallback(() => this.layoutCallback());
      this._needsRebuild = false;
    }
    _runNativeLayoutCallback(callback: () => void): void {
      invariant(
        isNativeRenderObject(this) && nativeSchedules.has(this) && !this.debugDisposed,
        'invalid-native-layout-callback',
        'Native configuration callback requires its canonical owner',
      );
      callback();
      this._needsRebuild = false;
    }
    scheduleLayoutCallback(): void {
      assertOutsideRenderPaint();
      invariant(
        !this.debugDisposed,
        'disposed-layout-callback',
        'Cannot schedule a disposed layout callback',
      );
      if (this._needsRebuild) {
        invariant(
          this.needsLayout,
          'invalid-layout-callback',
          'A pending layout callback must have dirty layout',
        );
        return;
      }
      this.markNeedsLayout();
      this._needsRebuild = true;
      if (isNativeRenderObject(this)) {
        const scheduled = nativeSchedules.get(this);
        invariant(
          scheduled,
          'missing-native-layout-callback',
          'Native callback configuration is not registered',
        );
        scheduled();
      } else this.owner?.requestLayoutCallback(this);
    }
    override attach(owner: PipelineOwner): void {
      super.attach(owner);
      if (this._needsRebuild && this.hasLayoutConstraints) owner.requestLayoutCallback(this);
    }
  }
  return LayoutCallbackRender as unknown as LayoutCallbackConstructor<Base>;
}
