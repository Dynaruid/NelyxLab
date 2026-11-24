// SPDX-License-Identifier: BSD-3-Clause
import { isAppUrl } from './local-url.ts';
import { sameRenderSession } from './render-protocol.ts';
import type {
  RenderCommand,
  RenderFailureStage,
  RenderReply,
  RenderSession,
} from './render-protocol.ts';

export class RenderWorkerError extends Error {
  constructor(
    readonly stage: RenderFailureStage,
    reason: string,
    readonly integrity = false,
  ) {
    super(reason);
  }
}

export class RenderWorkerPort {
  private exchange:
    | {
        readonly kind: RenderReply['kind'];
        accept(response: RenderReply): void;
        reject(error: unknown): void;
      }
    | undefined;
  private stopped = false;
  private stage: RenderFailureStage = 'worker-script';
  private onReply: ((message: RenderReply) => void) | undefined;
  private onFailure: ((error: RenderWorkerError) => void) | undefined;

  static async open(
    canvas: HTMLCanvasElement,
    root: URL,
    session: RenderSession,
    signal: AbortSignal,
  ): Promise<RenderWorkerPort> {
    const view = canvas.ownerDocument.defaultView!;
    if (typeof view.Worker !== 'function')
      throw new RenderWorkerError('worker-script', 'Dedicated workers unavailable');
    const { default: href } = await import('./renderer-worker.js?worker&url');
    signal.throwIfAborted();
    const url = new URL(href, root);
    if (!isAppUrl(url, root))
      throw new RenderWorkerError('worker-script', 'Render worker URL escaped the app root');
    return new RenderWorkerPort(
      new view.Worker(url.href, { type: 'module', name: 'nelyx-renderer' }),
      session,
    );
  }

  private constructor(
    private readonly worker: Worker,
    private readonly session: RenderSession,
  ) {
    worker.onmessage = this.message;
    worker.onerror = (event) => {
      event.preventDefault();
      this.fail(
        new RenderWorkerError(this.stage, event.message || 'Dedicated render worker failed'),
      );
    };
    worker.onmessageerror = () =>
      this.fail(new RenderWorkerError(this.stage, 'Cannot read render worker message'));
  }

  post(command: RenderCommand, transfer: Transferable[] = []): void {
    if (this.stopped) throw new Error('Web renderer worker is closed');
    this.worker.postMessage({ ...this.session, ...command }, transfer);
  }

  request<K extends RenderReply['kind']>(
    command: RenderCommand,
    kind: K,
    stage: RenderFailureStage,
    transfer: Transferable[] = [],
    signal?: AbortSignal,
    timeoutMs = 12000,
  ): Promise<RenderReply & { kind: K }> {
    if (this.exchange) throw new Error('Web render worker request already pending');
    signal?.throwIfAborted();
    this.stage = stage;
    return new Promise((resolve, reject) => {
      const clear = () => {
        this.exchange = undefined;
        clearTimeout(timer);
        signal?.removeEventListener('abort', aborted);
      };
      const aborted = () => {
        clear();
        reject(signal?.reason);
      };
      const failed = (error: unknown) => {
        clear();
        reject(error);
      };
      const timer = setTimeout(
        () => failed(new RenderWorkerError(this.stage, 'Web render worker response timed out')),
        timeoutMs,
      );
      this.exchange = {
        kind,
        reject: failed,
        accept: (response) => {
          if (response.kind !== kind) {
            failed(new RenderWorkerError(this.stage, 'Unexpected render worker response'));
            return;
          }
          clear();
          resolve(response as RenderReply & { kind: K });
        },
      };
      signal?.addEventListener('abort', aborted, { once: true });
      try {
        this.post(command, transfer);
      } catch (error) {
        failed(error);
      }
    });
  }

  watch(
    onReply: (message: RenderReply) => void,
    onFailure: (error: RenderWorkerError) => void,
  ): void {
    this.stage = 'worker-frame';
    this.onReply = onReply;
    this.onFailure = onFailure;
  }

  private readonly message = ({ data }: MessageEvent<RenderReply>): void => {
    if (this.stopped || !data?.owner || !sameRenderSession(this.session, data)) return;
    if (data.kind === 'stage') {
      this.stage = data.stage;
    } else if (data.kind === 'fault') {
      this.fail(new RenderWorkerError(data.stage, data.reason, data.integrity));
    } else if (data.kind === 'checked-shared' && this.exchange?.kind !== 'checked-shared') {
      return;
    } else if (this.exchange) {
      // A graceful close can receive acknowledgements from previously queued work.
      if (data.kind === 'closed' || !this.closing) this.exchange.accept(data);
    } else {
      this.onReply?.(data);
    }
  };

  private fail(error: RenderWorkerError): void {
    if (this.exchange) this.exchange.reject(error);
    else this.onFailure?.(error);
  }

  private closing: Promise<void> | undefined;
  close(graceful: boolean): Promise<void> {
    return (this.closing ??= (async () => {
      this.onReply = undefined;
      this.onFailure = undefined;
      try {
        if (graceful)
          await this.request({ kind: 'close' }, 'closed', 'worker-frame', [], undefined, 2500);
      } catch {
        // Termination also retires a worker which cannot acknowledge its drain.
      } finally {
        this.stopped = true;
        this.worker.onmessage = null;
        this.worker.onerror = null;
        this.worker.onmessageerror = null;
        this.worker.terminate();
      }
    })());
  }
}
