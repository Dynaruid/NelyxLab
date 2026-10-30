import type { CanvasKit, PictureRecorder } from 'canvaskit-wasm';

import type { SkRect } from '@nelyx/skia-native/skia/types/Rect';
import type { SkPictureRecorder } from '@nelyx/skia-native/skia/types/Picture/PictureRecorder';

import { HostObject } from './Host.ts';
import { JsiSkCanvas } from './JsiSkCanvas.ts';
import { JsiSkPicture } from './JsiSkPicture.ts';
import { JsiSkRect } from './JsiSkRect.ts';

export class JsiSkPictureRecorder
  extends HostObject<PictureRecorder, 'PictureRecorder'>
  implements SkPictureRecorder
{
  private readonly canvases = new Set<JsiSkCanvas>();
  private invalidate(): void {
    for (const canvas of this.canvases) canvas.invalidateBorrow();
    this.canvases.clear();
  }
  override [Symbol.dispose](): void {
    this.invalidate();
    super[Symbol.dispose]();
  }
  constructor(CanvasKit: CanvasKit, ref: PictureRecorder) {
    super(CanvasKit, ref, 'PictureRecorder');
  }

  beginRecording(bounds?: SkRect) {
    if (this.canvases.size) throw new Error('PictureRecorder is already recording');
    const canvas = new JsiSkCanvas(
      this.CanvasKit,
      this.ref.beginRecording(
        bounds
          ? JsiSkRect.fromValue(this.CanvasKit, bounds)
          : Float32Array.of(0, 0, 2_000_000, 2_000_000),
        // Match the native recorder's SkRTreeFactory when explicit bounds are supplied.
        bounds !== undefined,
      ),
    );
    this.canvases.add(canvas);
    return canvas;
  }

  finishRecordingAsPicture() {
    if (!this.canvases.size) throw new Error('PictureRecorder is not recording');
    const picture = this.ref.finishRecordingAsPicture();
    this.invalidate();
    return new JsiSkPicture(this.CanvasKit, picture);
  }
}
