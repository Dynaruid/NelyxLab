import type {SkImage} from "../Drawing.ts";
import type {SkCanvas} from "../Drawing.ts";
import type {SkJSIInstance} from '../JsiInstance.ts';
import type {SkRect} from '../Rect.ts';

export interface SkSurface extends SkJSIInstance<"Surface"> {
  /** Checked owner GPU drain; throws rather than releasing unconfirmed work. */
  nelyxRetire():void;
  /** Returns Canvas that draws into the surface. Subsequent calls return the
     same Canvas. Canvas returned is managed and owned by Surface, and is
     deleted when Surface is deleted.
     Disposing the surface invalidates all borrowed canvases immediately.
     The native surface permits at most 64 live canvas wrappers.

      @return  drawing Canvas for Surface

      example: https://fiddle.skia.org/c/@Surface_getCanvas
  */
  getCanvas(): SkCanvas;

  /** Returns Image capturing Surface contents. Subsequent drawing to
     Surface contents are not captured.

      @param bounds A rectangle specifying the subset of the surface that
   is of interest.
      @return  Image initialized with Surface contents

      example: https://fiddle.skia.org/c/@Surface_makeImageSnapshot
  */
  makeImageSnapshot(bounds?: SkRect, outputImage?: SkImage): SkImage;

  /**
   * Make sure any queued draws are sent to the screen or the GPU.
   * @param sync - When true, block until the GPU has finished executing the
   * submitted work. Use this before a consumer on a different command queue
   * reads the texture this surface draws into (see
   * `Skia.Surface.MakeFromGPUTexture`). Defaults to false.
   */
  flush(sync?: boolean): void;

  /**
   * Returns the possibly scaled width of the surface.
   */
  width(): number;

  /**
   * Returns the possibly scaled height of the surface.
   */
  height(): number;
}
