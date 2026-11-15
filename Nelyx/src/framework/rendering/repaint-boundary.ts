// SPDX-License-Identifier: BSD-3-Clause
import { RenderConstrainedBox } from './boxes.ts';
import { invariant } from '../../foundation/errors.ts';
import type { PictureRasterizer } from '../../ui/picture.ts';
import type { Image } from '../../ui/image.ts';
import { RenderObject, RenderBox } from './object.ts';
import { retainedPaintLayer } from './retained-paint.ts';

/** Recording and retirement belong to PaintingContext for every Source boundary. */
export class RenderRepaintBoundary extends RenderConstrainedBox {
  override get isRepaintBoundary(): boolean {
    return true;
  }
  toImage(options: {
    readonly rasterizer: PictureRasterizer;
    readonly pixelRatio?: number;
  }): Promise<Image> {
    this._finishPaintInvalidationBatch();
    const layer = retainedPaintLayer(this);
    invariant(
      layer,
      'unpainted-repaint-boundary',
      'RepaintBoundary must finish painting before image capture',
    );
    return layer.toImage({ x: 0, y: 0, ...this.size }, options);
  }
  toImageSync(options: {
    readonly rasterizer: PictureRasterizer;
    readonly pixelRatio?: number;
  }): Image {
    this._finishPaintInvalidationBatch();
    const layer = retainedPaintLayer(this);
    invariant(
      layer,
      'unpainted-repaint-boundary',
      'RepaintBoundary must finish painting before image capture',
    );
    return layer.toImageSync({ x: 0, y: 0, ...this.size }, options);
  }
}
RenderObject._registerPaintInvalidationBoundary(RenderRepaintBoundary.prototype);
RenderBox._registerGeometryLayoutSemantics(RenderRepaintBoundary.prototype);
