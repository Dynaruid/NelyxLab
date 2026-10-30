// SPDX-License-Identifier: BSD-3-Clause
// Nelyx shader-mask composition uses the existing retained canvas scope and wire.
import { invariant } from '../../foundation/errors.ts';
import { Shader } from '../../ui/shader.ts';
import { Paint, blendModes } from '../../ui/paint.ts';
import type { BlendMode } from '../../ui/paint.ts';
import type { Rect } from '../../ui/types.ts';
import { RenderProxyBox } from './boxes.ts';
import type { RenderBox, RenderObject } from './object.ts';
import type { PaintingContext } from '../painting/context.ts';

/** Returns a borrowed shader in child-local coordinates. Its owner may dispose
 * it after paint; recorded commands retain their own image resource references. */
export type ShaderCallback = (bounds: Rect) => Shader;
export class RenderShaderMask extends RenderProxyBox {
  private callback: ShaderCallback;
  private mode: BlendMode;
  constructor({
    shaderCallback,
    blendMode = 'modulate',
    child,
  }: {
    readonly shaderCallback: ShaderCallback;
    readonly blendMode?: BlendMode;
    readonly child?: RenderBox<RenderObject>;
  }) {
    super();
    invariant(
      typeof shaderCallback === 'function',
      'invalid-shader-callback',
      'Shader mask requires a callback',
    );
    invariant(blendModes.includes(blendMode), 'invalid-blend-mode', 'Unknown blend mode');
    this.callback = shaderCallback;
    this.mode = blendMode;
    if (child) this.child = child;
  }
  get shaderCallback(): ShaderCallback {
    return this.callback;
  }
  set shaderCallback(value: ShaderCallback) {
    this.assertCanMutateLayoutProperty();
    invariant(
      typeof value === 'function',
      'invalid-shader-callback',
      'Shader mask requires a callback',
    );
    if (value !== this.callback) {
      this.callback = value;
      this.markNeedsPaint();
    }
  }
  get blendMode(): BlendMode {
    return this.mode;
  }
  set blendMode(value: BlendMode) {
    this.assertCanMutateLayoutProperty();
    invariant(blendModes.includes(value), 'invalid-blend-mode', 'Unknown blend mode');
    if (value !== this.mode) {
      this.mode = value;
      this.markNeedsPaint();
    }
  }
  override paint(context: PaintingContext): void {
    if (!this.child) return;
    const bounds = Object.freeze({ x: 0, y: 0, width: this.size.width, height: this.size.height }),
      shader = this.callback(bounds);
    invariant(
      shader instanceof Shader && !shader.debugDisposed,
      'invalid-mask-shader',
      'Shader callback must return a live Shader',
    );
    const mask = new Paint({ shader, blendMode: this.mode }),
      mark = context.commands.length;
    try {
      context.saveLayer(this.paintBounds, new Paint());
      super.paint(context);
      context.drawRect(bounds, mask);
      context.restore();
    } catch (error) {
      try {
        context.rollback(mark);
      } catch (cleanup) {
        throw new AggregateError([error, cleanup], 'Shader mask paint and rollback failed');
      }
      throw error;
    }
  }
}
