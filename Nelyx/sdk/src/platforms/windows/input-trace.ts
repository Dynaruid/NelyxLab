// SPDX-License-Identifier: BSD-3-Clause
import type { ViewInputObservation } from '@nelyx/core/hosting/runtime';
interface InputTraceApi {
  readonly inputTraceEnabled?: boolean;
  traceInput?(
    stage: number,
    view: number,
    surface: number,
    input: number,
    a: number,
    b: number,
  ): void;
}
/** Native QPC recorder; no console output and no event references are retained. */
export function windowsInputTraceSink():
  | ((stage: number, surface: number, input: number, a?: number, b?: number) => void)
  | undefined {
  const api = (globalThis as { NelyxWindowsHost?: InputTraceApi }).NelyxWindowsHost;
  if (api?.inputTraceEnabled !== true || typeof api.traceInput !== 'function') return;
  return (stage, surface, input, a = 0, b = 0) => {
    try {
      api.traceInput!(stage, 0, surface, input, a, b);
    } catch {
      /* Observation cannot interrupt input. */
    }
  };
}
export function windowsCoreInputObserver(): ((event: ViewInputObservation) => void) | undefined {
  const trace = windowsInputTraceSink();
  if (!trace) return;
  return (event) => {
    const lag = Math.max(0, performance.now() - event.timestamp);
    if (event.stage === 'drop' || event.reason === 4)
      trace(
        17,
        event.surfaceGeneration,
        event.nativeInputSequence,
        event.reason,
        event.inputSequence,
      );
    if (event.stage !== 'drop')
      trace(
        event.stage === 'queued' ? 14 : event.stage === 'dispatch-begin' ? 15 : 16,
        event.surfaceGeneration,
        event.nativeInputSequence,
        event.inputSequence,
        event.stage === 'queued' ? event.pending : lag,
      );
  };
}
export function windowsInputKind(kind: string): number {
  return kind === 'wheel'
    ? 0
    : kind === 'panZoomStart'
      ? 1
      : kind === 'panZoomUpdate'
        ? 2
        : kind === 'panZoomEnd'
          ? 3
          : kind === 'inertiaCancel'
            ? 4
            : kind === 'down'
              ? 5
              : kind === 'move'
                ? 6
                : kind === 'up'
                  ? 7
                  : kind === 'cancel'
                    ? 8
                    : kind === 'hover'
                      ? 9
                      : kind === 'leave'
                        ? 10
                        : 255;
}
