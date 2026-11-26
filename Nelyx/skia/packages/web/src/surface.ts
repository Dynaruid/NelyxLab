// SPDX-License-Identifier: BSD-3-Clause
import type {
  Canvas,
  CanvasKit,
  GrDirectContext,
  Surface,
  WebGLContextHandle,
} from 'canvaskit-wasm';
import type { FrameDiagnostics } from '@nelyx/core/ui/frame';
import type { PaintFrame, ViewMetrics } from '@nelyx/core/ui/types';

export type WebSkiaCanvas = HTMLCanvasElement | OffscreenCanvas;
export interface WebSkiaSurfaceOptions {
  /** Set false for full-frame rendering without drawing-buffer reads after presentation. */
  readonly preserveDrawingBuffer?: boolean;
  /** Optional backing scale limit. Layout and input continue to use the View's metrics. */
  readonly maxRasterScale?: number;
  /** Enables capacity reuse for a display that clips pixels to its independent viewport. */
  readonly retainedBackingPixelLimit?: number;
}

export const webGpuResourceCacheBytes = 48 * 1024 * 1024;
export function webBackingSize(
  metrics: Pick<ViewMetrics, 'scale' | 'physicalWidth' | 'physicalHeight'>,
  maxRasterScale = Infinity,
) {
  const scale = Math.min(metrics.scale, maxRasterScale),
    ratio = scale / metrics.scale;
  return {
    scale,
    width: Math.max(1, Math.round(metrics.physicalWidth * ratio)),
    height: Math.max(1, Math.round(metrics.physicalHeight * ratio)),
  };
}

/** Owns one Ganesh context, its drawing buffer and the fences issued against it. */
export class WebSkiaSurface {
  private context: GrDirectContext | undefined;
  private surface: Surface | undefined;
  private handle: WebGLContextHandle | undefined;
  private gl: WebGL2RenderingContext | undefined;
  private backingScale: number | undefined;
  private backingLimit: { width: number; height: number } | undefined;

  constructor(
    private readonly ck: CanvasKit,
    private readonly canvas: WebSkiaCanvas,
    private readonly options: WebSkiaSurfaceOptions,
  ) {}

  prepare(): GrDirectContext {
    if (this.context) return this.context;
    const handle = this.ck.GetWebGLContext(this.canvas, {
      majorVersion: 2,
      alpha: 1,
      antialias: 0,
      stencil: 8,
      preserveDrawingBuffer: this.options.preserveDrawingBuffer === false ? 0 : 1,
    });
    if (!handle) throw new Error('CanvasKit WebGL2 creation failed');
    let context: GrDirectContext | null = null;
    try {
      const gl = this.canvas.getContext('webgl2') as WebGL2RenderingContext | null;
      if (!gl || gl.isContextLost()) throw new Error('WebGL2 fence API unavailable');
      context = this.ck.MakeWebGLContext(handle);
      if (!context) throw new Error('CanvasKit GPU context failed');
      context.setResourceCacheLimitBytes(webGpuResourceCacheBytes);
      if (this.options.retainedBackingPixelLimit) {
        const viewport = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array;
        const limit = Math.min(
          gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
          gl.getParameter(gl.MAX_TEXTURE_SIZE),
        );
        this.backingLimit = {
          width: Math.min(limit, viewport[0]!),
          height: Math.min(limit, viewport[1]!),
        };
      }
      this.gl = gl;
      this.handle = handle;
      this.context = context;
      return context;
    } catch (error) {
      try {
        context?.delete();
      } finally {
        this.ck.deleteContext(handle);
      }
      throw error;
    }
  }

  private chooseBacking(width: number, height: number, scale: number) {
    const limit = this.backingLimit;
    if (!limit || !this.surface || this.backingScale !== scale) return { width, height };
    const current = this.canvas;
    // Give back an oversized buffer once the view needs less than half of it.
    const budget = Math.min(this.options.retainedBackingPixelLimit!, width * height * 2);
    if (width <= current.width && height <= current.height) {
      return current.width * current.height <= budget
        ? { width: current.width, height: current.height }
        : { width, height };
    }
    // Reserve a little room on the growing axes to avoid an allocation per drag step.
    const nextWidth =
      width > current.width ? Math.max(width, Math.ceil(current.width * 1.25)) : width;
    const nextHeight =
      height > current.height ? Math.max(height, Math.ceil(current.height * 1.25)) : height;
    return nextWidth <= limit.width &&
      nextHeight <= limit.height &&
      nextWidth * nextHeight <= budget
      ? { width: nextWidth, height: nextHeight }
      : { width, height };
  }

  submit(
    frame: PaintFrame,
    replay: (canvas: Canvas, scale: number) => void,
    diagnostics: FrameDiagnostics | undefined,
  ): WebGLSync {
    const { width, height, scale } = webBackingSize(
      frame.token.metrics,
      this.options.maxRasterScale,
    );
    const backing = this.chooseBacking(width, height, scale);
    if (
      !this.surface ||
      this.canvas.width !== backing.width ||
      this.canvas.height !== backing.height
    ) {
      // Resize clears the drawing buffer. Install and draw the new frame in one turn.
      this.surface?.delete();
      this.surface = undefined;
      // Shrink first when the axes move in opposite directions.
      if (backing.width < this.canvas.width) this.canvas.width = backing.width;
      if (backing.height < this.canvas.height) this.canvas.height = backing.height;
      if (this.canvas.width !== backing.width) this.canvas.width = backing.width;
      if (this.canvas.height !== backing.height) this.canvas.height = backing.height;
      const surface = this.ck.MakeOnScreenGLSurface(
        this.prepare(),
        backing.width,
        backing.height,
        this.ck.ColorSpace.SRGB,
      );
      if (!surface) throw new Error('CanvasKit GPU surface failed');
      this.surface = surface;
    }
    this.backingScale = scale;
    const gl = this.gl!;
    const replayStarted = diagnostics?.now();
    const canvas = this.surface.getCanvas();
    if (backing.width === width && backing.height === height) {
      replay(canvas, scale);
    } else {
      canvas.clear(this.ck.TRANSPARENT);
      canvas.save();
      try {
        canvas.clipRect(this.ck.LTRBRect(0, 0, width, height), this.ck.ClipOp.Intersect, false);
        replay(canvas, scale);
      } finally {
        canvas.restore();
      }
    }
    const flushStarted = diagnostics?.record(frame.token, 'native-replay', replayStarted!);
    this.surface.flush();
    const fenceStarted = diagnostics?.record(frame.token, 'native-submit', flushStarted!);
    const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (!fence) throw new Error('WebGL fence creation failed');
    gl.flush();
    diagnostics?.record(frame.token, 'gpu-fence-enqueue', fenceStarted!);
    return fence;
  }

  poll(fence: WebGLSync, started: number): 'signaled' | 'waiting' | 'failed' | 'timeout' {
    const gl = this.gl!,
      status = gl.clientWaitSync(fence, 0, 0);
    if (status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED) return 'signaled';
    if (status === gl.WAIT_FAILED) return 'failed';
    return performance.now() - started > 5000 ? 'timeout' : 'waiting';
  }

  release(fence: WebGLSync): void {
    this.gl?.deleteSync(fence);
  }

  finish(): void {
    this.gl?.finish();
  }

  reset(abandon: boolean, close = false): void {
    const gl = this.gl;
    this.surface?.delete();
    this.surface = undefined;
    if (this.context) {
      if (abandon) this.context.releaseResourcesAndAbandonContext();
      this.context.delete();
      this.context = undefined;
    }
    if (this.handle !== undefined) {
      this.ck.deleteContext(this.handle);
      this.handle = undefined;
    }
    this.gl = undefined;
    this.backingLimit = undefined;
    this.backingScale = undefined;
    if (close && gl && !gl.isContextLost()) gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
