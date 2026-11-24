// SPDX-License-Identifier: BSD-3-Clause
import { PlatformException } from '@nelyx/core/services/message-codec';
import type { DeviceSubscription } from '../devices.ts';

type Cleanup = () => void | Promise<void>;

export function deviceError(code: string, message: string): PlatformException {
  return new PlatformException({ code, message });
}

export function deviceOperationError(error: unknown): PlatformException {
  if (error instanceof PlatformException) return error;
  const value = error as { name?: unknown; code?: unknown; message?: unknown } | null;
  const message = typeof value?.message === 'string' ? value.message : String(error);
  if (typeof value?.code === 'string' && typeof value.message === 'string' && /^[a-z]+(?:-[a-z]+)+$/.test(value.code))
    return deviceError(value.code, message);
  const name = value?.name ?? value?.code;
  if (name === 'TimeoutError' || /timed? out|timeout/i.test(message)) return deviceError('timeout', message);
  if (name === 'AbortError' || /\bcancell?ed\b/i.test(message)) return deviceError('cancelled', message);
  if (name === 'NotAllowedError' || name === 'SecurityError' || /permission|not authori[sz]ed|denied/i.test(message))
    return deviceError('permission-denied', message);
  if (name === 'NotSupportedError' || /\bunsupported\b|not supported/i.test(message))
    return deviceError('unsupported', message);
  if (name === 'NotFoundError' || name === 'NotReadableError' ||
      /location (?:services? (?:are )?(?:disabled|not enabled)|(?:is )?unavailable)|empty location array/i.test(message))
    return deviceError('unavailable', message);
  return deviceError('platform-error', message);
}

export function throwIfCancelled(signal: AbortSignal): void {
  if (signal.aborted) throw deviceError('cancelled', 'Device operation was cancelled');
}

/** Owns platform handles and events for one mounted view. */
export class DeviceScope {
  private readonly controller = new AbortController();
  private readonly cleanups = new Set<Cleanup>();
  private closing?: Promise<void>;
  get signal(): AbortSignal {
    return this.controller.signal;
  }

  async run<T>(action: () => T | PromiseLike<T>): Promise<T> {
    throwIfCancelled(this.signal);
    try {
      const result = await action();
      throwIfCancelled(this.signal);
      return result;
    } catch (error) {
      throwIfCancelled(this.signal);
      throw deviceOperationError(error);
    }
  }

  cancelWith<T>(user: AbortSignal | undefined, action: (signal: AbortSignal) => Promise<T>): Promise<T> {
    return this.run(async () => {
      if (!user) return action(this.signal);
      throwIfCancelled(user);
      const combined = new AbortController();
      const abort = () => combined.abort();
      this.signal.addEventListener('abort', abort, { once: true });
      user.addEventListener('abort', abort, { once: true });
      try {
        const result = await action(combined.signal);
        throwIfCancelled(combined.signal);
        return result;
      } finally {
        this.signal.removeEventListener('abort', abort);
        user.removeEventListener('abort', abort);
      }
    });
  }

  own(cleanup: Cleanup): DeviceSubscription {
    let retirement: Promise<void> | undefined;
    const dispose = () => {
      this.cleanups.delete(dispose);
      return (retirement ??= Promise.resolve().then(cleanup));
    };
    if (this.signal.aborted) void dispose().catch((error: unknown) => console.error(error));
    else this.cleanups.add(dispose);
    return { dispose };
  }

  stop(): void {
    this.controller.abort();
  }

  dispose(): Promise<void> {
    this.stop();
    return (this.closing ??= (async () => {
      const results = await Promise.allSettled([...this.cleanups].map((dispose) => dispose()));
      const errors = results.flatMap((result) => result.status === 'rejected' ? [result.reason] : []);
      if (errors.length) throw new AggregateError(errors, 'Device services disposal failed');
    })());
  }
}

export function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(deviceError('cancelled', 'Device operation was cancelled'));
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    void promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}
