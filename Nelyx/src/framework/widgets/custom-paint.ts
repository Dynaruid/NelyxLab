// SPDX-License-Identifier: BSD-3-Clause
import { invariant } from '../../foundation/errors.ts';
import type { Size } from '../../ui/geometry.ts';
import { RenderCustomPaint } from '../rendering/custom-paint.ts';
import type { CustomPainter } from '../rendering/custom-paint.ts';
import type { RenderObject } from '../rendering/object.ts';
import { SingleChildRenderObjectWidget } from './framework.ts';
import type { BuildContext, Widget, WidgetOptions } from './framework.ts';
export interface CustomPaintOptions extends WidgetOptions {
  readonly painter?: CustomPainter | null;
  readonly foregroundPainter?: CustomPainter | null;
  readonly size?: Size;
}
export class CustomPaint extends SingleChildRenderObjectWidget {
  readonly painter: CustomPainter | null;
  readonly foregroundPainter: CustomPainter | null;
  readonly size: Size;
  constructor(child: Widget | undefined = undefined, options: CustomPaintOptions = {}) {
    super(child, options);
    invariant(
      Object.keys(options).every((key) =>
        ['key', 'painter', 'foregroundPainter', 'size'].includes(key),
      ),
      'unsupported-custom-paint-option',
      'Raster cache hints and unknown options are not implemented',
    );
    this.painter = options.painter ?? null;
    this.foregroundPainter = options.foregroundPainter ?? null;
    const size = options.size ?? { width: 0, height: 0 };
    this.size = Object.freeze({ width: size.width, height: size.height });
  }
  createRenderObject(_context: BuildContext): RenderCustomPaint {
    return new RenderCustomPaint({
      painter: this.painter,
      foregroundPainter: this.foregroundPainter,
      preferredSize: this.size,
    });
  }
  updateRenderObject(_context: BuildContext, render: RenderObject): void {
    invariant(
      render instanceof RenderCustomPaint,
      'invalid-custom-paint-render',
      'CustomPaint requires RenderCustomPaint',
    );
    render.painter = this.painter;
    render.foregroundPainter = this.foregroundPainter;
    render.preferredSize = this.size;
  }
  override didUnmountRenderObject(render: RenderObject): void {
    invariant(
      render instanceof RenderCustomPaint,
      'invalid-custom-paint-render',
      'CustomPaint requires RenderCustomPaint',
    );
    render.painter = null;
    render.foregroundPainter = null;
  }
}
