// SPDX-License-Identifier: BSD-3-Clause
import { RendererEvents } from '@nelyx/core/hosting/renderer-events';
import type { ResourceLease } from '@nelyx/core/hosting/resources';
import type { Renderer } from '@nelyx/core/hosting/runtime';
import { isCurrent, paintFrameLimits } from '@nelyx/core/ui/frame';
import type { FrameDiagnostics } from '@nelyx/core/ui/frame';
import { frameWireVersion } from '@nelyx/core/ui/frame-wire';
import { webFrameWireVersion } from '@nelyx/core/ui/web-frame-wire';
import type {
  PaintFrame,
  RendererNotification,
  SubmitResult,
  ViewOwner,
} from '@nelyx/core/ui/types';
import { webBackingSize, webGpuResourceCacheBytes } from '@nelyx/skia-web/library';
import type {
  WebSkiaLibrary,
  WebSkiaSurfaceOptions,
  WebSurfaceMetrics,
} from '@nelyx/skia-web/library';
import type { CanvasKitManifest } from './canvaskit-manifest.ts';
import { CanvasKitIntegrityError } from './canvaskit-loader.ts';
import { prepareCanvasKit } from './canvaskit.ts';
import {
  renderProtocolVersion,
  sharedBufferBytes,
  sharedProbeReply,
  sharedProbeRequest,
  workerBackingBytes,
  workerBackingPixelLimit,
  workerResourceBytes,
} from './render-protocol.ts';
import type { RenderFailureStage, WebRenderMode, WebRenderPath } from './render-protocol.ts';
import { sharedArrayBufferConstructor } from './render-shared-memory.ts';
import { RenderWorkerPort, RenderWorkerError } from './render-worker-port.ts';
import { RenderWorkerFrames } from './render-worker-frames.ts';
import { WebRenderTelemetry } from './render-telemetry.ts';
import { readRetainedViewportLeft } from './environment.ts';
import type { DomPlatformViews } from './platform-views.ts';

interface BrowserRenderOptions extends WebSkiaSurfaceOptions {
  readonly renderMode?: WebRenderMode;
  readonly canvasViewport?: HTMLElement;
  readonly replaceCanvas?: (previous: HTMLCanvasElement) => HTMLCanvasElement;
  readonly assetsRoot: URL;
  readonly canvasKitRoot: URL;
  readonly canvasKitManifest: CanvasKitManifest;
  readonly signal?: AbortSignal;
  readonly onError?: (error: unknown) => void;
}
interface DisplaySurface {
  submitPrepared(): void;
  replace(create: NonNullable<BrowserRenderOptions['replaceCanvas']>): HTMLCanvasElement;
  publishGeneration(): void;
  closeFailedView(): void;
}

// The SDK realm shares the main Wasm instance, including with its dialog views.
// Limit additional instances and reserve the main readback cache and worker copies.
let workerReserved = false;

export class BrowserRenderer implements Renderer {
  readonly singleSubmissionPerTick = true;
  readonly capabilities: Renderer['capabilities'];
  private readonly telemetry: WebRenderTelemetry;
  private readonly lifetime = new AbortController();
  private readonly events: RendererEvents;
  private readonly surfaceOptions: WebSkiaSurfaceOptions;
  private readonly window: Window & typeof globalThis;
  private readonly directTimers = new Map<number, number>();
  private readonly directObservation: ReturnType<WebSkiaLibrary['observe']>;
  private worker: RenderWorkerFrames | undefined;
  private workerReserved = false;
  private recovery: Promise<void> | undefined;
  private displaySurface: DisplaySurface | undefined;
  private platformViews: DomPlatformViews | undefined;
  private restartAvailable = true;
  private metrics: WebSurfaceMetrics | undefined;
  private visible = true;
  private epoch = 0;
  private transferred = false;
  private direct = false;
  private closed = false;
  private closing: Promise<void> | undefined;
  private readonly abort = () => this.lifetime.abort(this.options.signal?.reason);

  constructor(
    private readonly library: WebSkiaLibrary,
    private canvas: HTMLCanvasElement,
    private readonly owner: ViewOwner,
    private readonly options: BrowserRenderOptions,
    private readonly canOpen: () => boolean,
  ) {
    this.window = canvas.ownerDocument.defaultView!;
    this.capabilities = library.capabilities;
    this.events = new RendererEvents(owner);
    this.events.subscribe((event) => {
      if (event.kind === 'retired' && event.result === 'gpu-retired') this.markFrameReady();
    });
    const requested = options.renderMode ?? 'direct';
    if (!['direct', 'auto', 'worker-transfer', 'worker-shared'].includes(requested))
      throw new Error('Unknown Web render mode');
    this.telemetry = new WebRenderTelemetry(
      requested,
      this.window.isSecureContext === true,
      this.window.crossOriginIsolated === true,
    );
    this.surfaceOptions = {
      ...(options.maxRasterScale === undefined ? {} : { maxRasterScale: options.maxRasterScale }),
      ...(options.preserveDrawingBuffer === undefined
        ? {}
        : { preserveDrawingBuffer: options.preserveDrawingBuffer }),
      ...(options.retainedBackingPixelLimit === undefined
        ? {}
        : { retainedBackingPixelLimit: options.retainedBackingPixelLimit }),
    };
    this.directObservation = library.observe((event) => {
      if (event.kind === 'retired') {
        this.telemetry.retired(event.result);
        if (event.result === 'gpu-retired') this.markFrameReady();
        const started = this.directTimers.get(event.submission);
        if (event.result === 'gpu-retired' && started !== undefined)
          this.telemetry.sample('fence', performance.now() - started);
        this.directTimers.delete(event.submission);
      } else if (event.kind === 'failed') {
        this.telemetry.failure('main-webgl2', event.reason);
      }
    });
    options.signal?.addEventListener('abort', this.abort, { once: true });
    if (options.signal?.aborted) this.abort();
  }

  get diagnostics() {
    return this.telemetry.snapshot();
  }

  async open(): Promise<HTMLCanvasElement> {
    this.checkOpening();
    if (this.telemetry.requested !== 'direct') {
      if (!this.options.replaceCanvas) {
        this.telemetry.failure(
          'canvas-ownership',
          'Display canvas replacement permission is required for worker rendering',
        );
      } else if (this.reserveWorker() && (await this.tryWorker())) {
        return this.canvas;
      }
    }
    if (this.transferred) this.replaceCanvas();
    this.openDirect();
    return this.canvas;
  }

  bindSurface(surface: DisplaySurface): void {
    this.displaySurface = surface;
  }

  bindPlatformViews(platformViews: DomPlatformViews): void {
    this.platformViews = platformViews;
  }

  releasePlatformViewCanvas(canvas: HTMLCanvasElement): void {
    if (this.direct) this.library.releaseDisplayCanvas(canvas);
    else this.worker?.releaseLayer(canvas);
  }

  private reserveWorker(): boolean {
    const { canvas, window } = this;
    const viewport = this.options.canvasViewport ?? canvas;
    const memory = (window.navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    const scale = window.devicePixelRatio || 1;
    const { width, height } = webBackingSize(
      {
        scale,
        physicalWidth: Math.round(viewport.clientWidth * scale),
        physicalHeight: Math.round(viewport.clientHeight * scale),
        physicalRasterOffsetX: this.options.canvasViewport
          ? Math.round((readRetainedViewportLeft(canvas.ownerDocument) ?? 0) * scale)
          : 0,
      },
      this.options.maxRasterScale,
    );
    if (
      workerReserved ||
      (memory !== undefined && memory < 4) ||
      width * height > workerBackingPixelLimit
    ) {
      this.telemetry.failure(
        'worker-budget',
        'Web worker memory reservation unavailable for this view',
      );
      return false;
    }
    workerReserved = this.workerReserved = true;
    this.telemetry.reservedBytes =
      this.options.canvasKitManifest.initialMemoryBytes * 2 +
      webGpuResourceCacheBytes * 2 +
      workerBackingBytes +
      workerResourceBytes * 2 +
      sharedBufferBytes;
    return true;
  }

  private releaseWorkerReservation(): void {
    if (!this.workerReserved) return;
    workerReserved = this.workerReserved = false;
    this.telemetry.reservedBytes = 0;
  }

  private checkOpening(): void {
    this.lifetime.signal.throwIfAborted();
    if (this.closed || !this.canOpen() || this.window.closed || !this.canvas.isConnected)
      throw new Error('Web surface opening cancelled');
  }

  private async tryWorker(): Promise<boolean> {
    let stage: RenderFailureStage = 'worker-script';
    let port: RenderWorkerPort | undefined;
    const signal = this.lifetime.signal;
    try {
      this.checkOpening();
      const { assetsRoot, canvasKitRoot, canvasKitManifest } = this.options;
      if (typeof this.canvas.transferControlToOffscreen !== 'function')
        throw new RenderWorkerError('canvas-transfer', 'Offscreen canvas transfer unavailable');
      const assets = await prepareCanvasKit(canvasKitRoot, canvasKitManifest);
      port = await RenderWorkerPort.open(
        this.canvas,
        assetsRoot,
        {
          owner: this.owner,
          generation: ++this.epoch,
        },
        signal,
      );
      const ready = await port.request(
        {
          kind: 'probe',
          protocol: renderProtocolVersion,
          frameWire: frameWireVersion,
          webFrameWire: webFrameWireVersion,
          root: canvasKitRoot.href,
          manifest: canvasKitManifest,
          assets,
          options: this.surfaceOptions,
        },
        'ready',
        stage,
        [],
        signal,
      );
      this.checkOpening();
      this.telemetry.workerIsolated = ready.isolated;
      const shared = await this.checkShared(port, ready.isolated);
      this.checkOpening();
      stage = 'canvas-transfer';
      const canvas = this.canvas.transferControlToOffscreen();
      this.transferred = true;
      stage = 'worker-attach';
      await port.request(
        { kind: 'attach', canvas, useShared: !!shared },
        'attached',
        stage,
        [canvas],
        signal,
      );
      this.checkOpening();
      port.post({ kind: 'visibility', visible: this.visible });
      const connection: RenderWorkerFrames = new RenderWorkerFrames(
        port,
        shared,
        this.library,
        this.events,
        this.telemetry,
        this.window.performance.timeOrigin,
        (error) => this.workerFailed(connection, error),
        () => this.displaySurface?.submitPrepared(),
      );
      this.worker = connection;
      this.library.setResourceRetirementListener((key) => this.worker?.retireResource(key));
      this.select(shared ? 'worker-shared' : 'worker-transfer');
      return true;
    } catch (error) {
      await port?.close(false);
      this.checkOpening();
      this.telemetry.failure(error instanceof RenderWorkerError ? error.stage : stage, error);
      if (error instanceof RenderWorkerError && error.integrity)
        throw new CanvasKitIntegrityError(error.message);
      if (error instanceof CanvasKitIntegrityError) throw error;
      return false;
    }
  }

  private async checkShared(
    port: RenderWorkerPort,
    workerIsolated: boolean,
  ): Promise<SharedArrayBuffer | undefined> {
    const { requested, secureContext, crossOriginIsolated } = this.telemetry;
    if (requested === 'worker-transfer') return;
    if (!secureContext || !crossOriginIsolated) {
      if (requested === 'worker-shared')
        this.telemetry.failure(
          'shared-memory',
          'The canvas document does not have secure cross-origin isolation',
        );
      return;
    }
    try {
      if (!workerIsolated) throw new Error('Render worker did not acquire cross-origin isolation');
      const SharedBuffer = sharedArrayBufferConstructor(this.window);
      const probe = new SharedBuffer(Int32Array.BYTES_PER_ELEMENT);
      const word = new Int32Array(probe);
      const buffer = new SharedBuffer(sharedBufferBytes);
      Atomics.store(word, 0, sharedProbeRequest);
      const checked = await port.request(
        { kind: 'check-shared', probe, buffer },
        'checked-shared',
        'shared-memory',
        [],
        this.lifetime.signal,
        1500,
      );
      if (!checked.shared || Atomics.load(word, 0) !== sharedProbeReply)
        throw new Error('Render worker shared memory round trip failed');
      return buffer;
    } catch (error) {
      this.telemetry.failure('shared-memory', error);
      return undefined;
    }
  }

  private select(path: WebRenderPath): void {
    this.library.setDeferredFramePictures(path === 'worker-shared');
    this.telemetry.path = path;
    this.canvas.dataset.nelyxRenderPath = path;
  }

  private markFrameReady(): void {
    if (!this.canvas.dataset.nelyxFrameReady) this.canvas.dataset.nelyxFrameReady = 'true';
  }

  private openDirect(): void {
    this.checkOpening();
    this.releaseWorkerReservation();
    this.library.setResourceRetirementListener(undefined);
    try {
      this.library.useDisplayCanvas(this.canvas);
      this.direct = true;
      this.select('direct');
    } catch (error) {
      this.telemetry.failure('main-webgl2', error);
      const stages = this.telemetry
        .snapshot()
        .failures.map(({ stage, reason }) => stage + ' (' + reason + ')');
      throw new Error('Nelyx WebGL2 initialization failed. ' + stages.join('. '), { cause: error });
    }
  }

  private replaceCanvas(): void {
    this.checkOpening();
    const create = this.options.replaceCanvas!;
    const previous = this.canvas;
    const replacement = this.displaySurface
      ? this.displaySurface.replace(create)
      : create(previous);
    if (
      replacement === previous ||
      !replacement.isConnected ||
      replacement.ownerDocument !== previous.ownerDocument
    )
      throw new Error('Invalid Web display canvas replacement');
    this.canvas = replacement;
    this.transferred = false;
  }

  private workerFailed(worker: RenderWorkerFrames, error: RenderWorkerError): void {
    if (this.worker !== worker || this.closed) return;
    this.platformViews?.invalidate(true);
    this.worker = undefined;
    this.telemetry.failure(error.stage, error);
    // Let an in-progress submit finish publishing its synchronous acceptance.
    this.recovery = Promise.resolve()
      .then(async () => {
        await worker.close(false);
        if (this.closed || this.lifetime.signal.aborted) return;
        this.replaceCanvas();
        const restart = this.restartAvailable && error.stage === 'worker-context-loss';
        if (restart) {
          this.restartAvailable = false;
          if (await this.tryWorker()) {
            this.displaySurface?.publishGeneration();
            return;
          }
          if (this.transferred) this.replaceCanvas();
        }
        this.openDirect();
        this.displaySurface?.publishGeneration();
      })
      .catch((failure) => {
        this.releaseWorkerReservation();
        if (!this.closed && !this.lifetime.signal.aborted)
          (this.options.onError ?? console.error)(failure);
      });
  }

  observe(listener: (event: RendererNotification) => void) {
    const direct = this.library.observe(listener),
      worker = this.events.subscribe(listener);
    return {
      dispose() {
        direct.dispose();
        worker.dispose();
      },
    };
  }

  updateMetrics(metrics: WebSurfaceMetrics): void {
    this.metrics = metrics;
    this.library.updateMetrics(metrics);
    const worker = this.worker;
    if (!worker) return;
    const { width, height } = webBackingSize(metrics, this.options.maxRasterScale);
    if (width * height > workerBackingPixelLimit) {
      this.workerFailed(
        worker,
        new RenderWorkerError(
          'worker-budget',
          'Resized Web backing exceeds the worker memory reservation',
        ),
      );
      return;
    }
    worker.updateMetrics(metrics);
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (!visible) this.platformViews?.invalidate(false);
    this.library.setVisible(visible);
    this.worker?.setVisible(visible);
  }

  lose(): void {
    if (this.direct) {
      this.platformViews?.invalidate(false);
      delete this.canvas.dataset.nelyxFrameReady;
      this.library.lose();
    }
  }
  restore(): void {
    if (this.direct) this.library.restore();
  }
  pollCompletedFrames(): void {
    if (this.direct) this.library.pollCompletedFrames();
  }

  canBuildFrame(): boolean {
    if (this.closed || !this.visible) return false;
    return this.direct ? this.library.canBuildFrame() : (this.worker?.canBuildFrame() ?? false);
  }

  keepPendingFrame(frame: PaintFrame): boolean {
    return this.worker?.keepPendingFrame(frame) ?? false;
  }

  submit(frame: PaintFrame, lease: ResourceLease, diagnostics?: FrameDiagnostics): SubmitResult {
    if (this.closed) return { status: 'rejected', reason: 'closed' };
    const metrics = this.metrics;
    if (!metrics || !isCurrent(frame, this.owner, metrics))
      return { status: 'rejected', reason: 'stale' };
    if (!metrics.physicalWidth || !metrics.physicalHeight)
      return { status: 'rejected', reason: 'zero-size' };
    if (!this.visible) return { status: 'rejected', reason: 'busy' };
    if (frame.estimatedBytes > paintFrameLimits.bytes)
      return { status: 'rejected', reason: 'oversize' };
    const started = performance.now();
    const platformViews = this.platformViews;
    let prepared = platformViews?.prepare(frame);
    const commit =
      platformViews &&
      (() => {
        if (this.visible && this.metrics && isCurrent(frame, this.owner, this.metrics))
          platformViews.commit(frame.token, prepared);
      });
    let result: SubmitResult;
    if (this.direct) {
      if (prepared?.layers.length) {
        try {
          result = this.library.submit(frame, lease, diagnostics, prepared);
        } catch {
          platformViews!.fail(frame, 'The foreground drawing surface could not submit the frame');
          prepared = undefined;
          result = this.library.submit(frame, lease, diagnostics);
        }
      } else result = this.library.submit(frame, lease, diagnostics);
      if (result.status === 'accepted') commit?.();
    } else
      result = this.worker?.submit(frame, lease, diagnostics, prepared, commit) ?? {
        status: 'rejected',
        reason: 'busy',
      };
    this.telemetry.sample('mainSubmit', performance.now() - started);
    if (this.direct && result.status === 'accepted') {
      this.telemetry.accepted++;
      this.directTimers.set(result.submission, performance.now());
      this.telemetry.maxPending = Math.max(this.telemetry.maxPending, this.directTimers.size);
      this.telemetry.inputSubmitted(
        frame.token,
        this.window.performance.timeOrigin,
        performance.timeOrigin + performance.now(),
      );
    }
    return result;
  }

  dispose(): Promise<void> {
    if (this.closing) return this.closing;
    this.closed = true;
    this.lifetime.abort();
    this.options.signal?.removeEventListener('abort', this.abort);
    this.events.stop();
    this.directObservation.dispose();
    const worker = this.worker;
    this.worker = undefined;
    return (this.closing = (async () => {
      try {
        await worker?.close(true);
        await this.recovery;
      } finally {
        this.library.setResourceRetirementListener(undefined);
        this.releaseWorkerReservation();
        await this.library.dispose();
        this.events.drain();
      }
    })());
  }
}
