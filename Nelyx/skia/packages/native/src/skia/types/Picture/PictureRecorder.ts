import type {SkCanvas} from "../Drawing.ts";
import type {SkJSIInstance} from '../JsiInstance.ts';
import type {SkRect} from '../Rect.ts';

import type {SkPicture} from "../Drawing.ts";

export interface SkPictureRecorder extends SkJSIInstance<"PictureRecorder"> {
  /**
   * Returns a canvas on which to draw. When done drawing, call finishRecordingAsPicture()
   *
   * @param bounds - a rect to cull the results.
   */
  beginRecording(bounds?: SkRect): SkCanvas;

  /**
   * Returns the captured draw commands as a picture and invalidates the canvas returned earlier.
   */
  finishRecordingAsPicture(): SkPicture;
}
