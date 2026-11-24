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

  submit(
    frame: PaintFrame,
    replay: (canvas: Canvas, scale: number) => void,
    diagnostics: FrameDiagnostics | undefined,
  ): WebGLSync {
    const { width, height, scale } = webBackingSize(
      frame.token.metrics,
      this.options.maxRasterScale,
    );
    if (!this.surface || this.canvas.width !== width || this.canvas.height !== height) {
      // Resize clears the drawing buffer. Install and draw the new frame in one turn.
      this.surface?.delete();
      this.surface = undefined;
      if (this.canvas.width !== width) this.canvas.width = width;
      if (this.canvas.height !== height) this.canvas.height = height;
      const surface = this.ck.MakeOnScreenGLSurface(
        this.prepare(),
        width,
        height,
        this.ck.ColorSpace.SRGB,
      );
      if (!surface) throw new Error('CanvasKit GPU surface failed');
      this.surface = surface;
    }
    const gl = this.gl!;
    const replayStarted = diagnostics?.now();
    replay(this.surface.getCanvas(), scale);
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
    if (close && gl && !gl.isContextLost()) gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
