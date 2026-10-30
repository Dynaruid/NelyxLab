import type { CanvasKit, Surface } from 'canvaskit-wasm';

import type { SkCanvas } from '@nelyx/skia-native/skia/types/Drawing';
import type { SkImage } from '@nelyx/skia-native/skia/types/Drawing';
import type { SkRect } from '@nelyx/skia-native/skia/types/Rect';
import type { SkSurface } from '@nelyx/skia-native/skia/types/Surface/Surface';

import { HostObject } from './Host.ts';
import { JsiSkCanvas } from './JsiSkCanvas.ts';
import { JsiSkImage } from './JsiSkImage.ts';
import { JsiSkRect } from './JsiSkRect.ts';

export class JsiSkSurface extends HostObject<Surface, 'Surface'> implements SkSurface {
  private readonly canvases = new Set<WeakRef<JsiSkCanvas>>();
  constructor(CanvasKit: CanvasKit, ref: Surface) {
    super(CanvasKit, ref, 'Surface');
  }

  [Symbol.dispose]() {
    for (const reference of this.canvases) reference.deref()?.invalidateBorrow();
    this.canvases.clear();
    this.ref.dispose();
  }

  nelyxRetire(): void {
    this.ref.flush();
    const image = this.ref.makeImageSnapshot();
    try {
      const pixels = image.readPixels(0, 0, {
        width: 1,
        height: 1,
        colorType: this.CanvasKit.ColorType.RGBA_8888,
        alphaType: this.CanvasKit.AlphaType.Premul,
        colorSpace: this.CanvasKit.ColorSpace.SRGB,
      });
      if (!pixels) throw new Error('Surface GPU completion unconfirmed');
    } finally {
      image.delete();
    }
  }
  flush(_sync?: boolean) {
    // CanvasKit has no separate CPU sync; flush() is sufficient on the web backend.
    this.ref.flush();
  }

  width() {
    return this.ref.width();
  }

  height() {
    return this.ref.height();
  }

  getCanvas(): SkCanvas {
    for (const reference of this.canvases) if (!reference.deref()) this.canvases.delete(reference);
    if (this.canvases.size >= 64) throw new Error('Surface live canvas alias budget exceeds64');
    const canvas = new JsiSkCanvas(this.CanvasKit, this.ref.getCanvas());
    this.canvases.add(new WeakRef(canvas));
    return canvas;
  }

  makeImageSnapshot(bounds?: SkRect, outputImage?: JsiSkImage): SkImage {
    const image = this.ref.makeImageSnapshot(
      bounds ? Array.from(JsiSkRect.fromValue(this.CanvasKit, bounds)) : undefined,
    );
    if (outputImage) {
      outputImage.ref = image;
    }
    return new JsiSkImage(this.CanvasKit, image);
  }
}
