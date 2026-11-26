// SPDX-License-Identifier: BSD-3-Clause
import type {
  ApplicationDefinition,
  DialogWindowHost,
  DialogWindowOptions,
} from '@nelyx/core/hosting/runtime';
import { finishOwnedDisposal } from '../../runtime/owned-disposal.ts';
import type { WebApplication, WebApplicationOptions } from './application.ts';
import { replaceOwnedCanvas } from './owned-canvas.ts';

export function webDialogWindows(
  definition: ApplicationDefinition,
  options: WebApplicationOptions,
  openApplication: (
    definition: ApplicationDefinition,
    options: WebApplicationOptions,
  ) => Promise<WebApplication>,
): DialogWindowHost {
  const document = options.canvas.ownerDocument;
  const parent = document.defaultView!;
  let surface = options.canvas.parentElement;
  while (surface && !surface.contains(options.input)) surface = surface.parentElement;
  const requests = new Map<() => Promise<void>, Window>();
  let stopped = false;
  let restoreFocus: HTMLElement | undefined;
  let wasInert = false;

  return {
    open<T>({
      title,
      requestFocus,
      locale,
      textDirection,
      createApplication,
    }: DialogWindowOptions<T>) {
      if (stopped || !surface?.isConnected || parent.closed) return null;
      const active = requests.size === 0 ? document.activeElement : null;
      let popup: Window | null;
      try {
        popup = parent.open('', '_blank', 'popup,width=560,height=480');
      } catch {
        return null;
      }
      if (!popup) return null;
      const child = popup.document;
      child.title = title;
      child.documentElement.lang = locale ?? document.documentElement.lang;
      child.documentElement.dir = textDirection ?? document.documentElement.dir;
      child.body.style.cssText = 'margin:0;overflow:hidden';
      const container = child.createElement('div');
      container.style.cssText = 'position:relative;width:100vw;height:100dvh;overflow:hidden';
      let canvas = child.createElement('canvas');
      const controller = new AbortController();
      canvas.style.cssText = 'display:block;width:100%;height:100%';
      canvas.setAttribute('aria-hidden', 'true');
      const input = child.createElement('input');
      const button = child.createElement('button');
      for (const control of [input, button])
        control.style.cssText = 'position:absolute;display:none';
      container.append(canvas, input, button);
      child.body.append(container);
      if (requests.size === 0) {
        restoreFocus = active && 'focus' in active ? (active as HTMLElement) : undefined;
        wasInert = surface.inert;
        surface.inert = true;
      }
      let resolve!: (value: T | undefined) => void, reject!: (error: unknown) => void;
      const result = new Promise<T | undefined>((success, failure) => {
        resolve = success;
        reject = failure;
      });
      let closing: Promise<void> | undefined;
      const finish = (value?: T, failure?: { readonly error: unknown }): Promise<void> =>
        (closing ??= Promise.resolve().then(async () => {
          controller.abort();
          popup.removeEventListener('pagehide', closeFromHost);
          try {
            const application = await opening.catch((error) => {
              if (controller.signal.aborted && error === controller.signal.reason) return undefined;
              throw error;
            });
            if (application) await finishOwnedDisposal(() => application.dispose());
            if (failure) throw failure.error;
            resolve(value);
          } catch (error) {
            reject(error);
            throw error;
          } finally {
            requests.delete(stop);
            if (!popup.closed) popup.close();
            if (requests.size === 0 && surface) {
              surface.inert = wasInert;
              if (!stopped && !parent.closed) {
                parent.focus();
                if (restoreFocus?.isConnected) restoreFocus.focus({ preventScroll: true });
              }
              restoreFocus = undefined;
            } else if (!stopped) {
              [...requests.values()].at(-1)?.focus();
            }
          }
        }));
      const stop = () => finish();
      const closeFromHost = () => {
        void stop().catch(() => {});
      };
      requests.set(stop, popup);
      popup.addEventListener('pagehide', closeFromHost);
      const opening = Promise.resolve().then(async () => {
        if (popup.closed || closing) return undefined;
        const applicationDefinition = createApplication((value) => {
          void finish(value).catch(() => {});
        });
        const application = await openApplication(
          {
            ...applicationDefinition,
            assets: applicationDefinition.assets ?? definition.assets ?? [],
            ...(definition.accessibilityEnabled === false ? { accessibilityEnabled: false } : {}),
          },
          {
            canvas,
            canvasViewport: container,
            localeBoundary: container,
            ownsDocument: true,
            signal: controller.signal,
            replaceCanvas(previous) {
              if (closing || popup.closed || previous !== canvas)
                throw new Error('Web dialog is closing');
              return (canvas = replaceOwnedCanvas(previous));
            },
            input,
            button,
            manifest: options.manifest,
            assetsRoot: options.assetsRoot,
            canvasKitRoot: options.canvasKitRoot,
            canvasKitManifest: options.canvasKitManifest,
            enableDialogWindows: true,
            deviceNamespace: options.deviceNamespace ?? definition.id,
            ...(options.backend ? { backend: options.backend } : {}),
            ...(options.profile ? { profile: options.profile } : {}),
            ...(options.renderMode ? { renderMode: options.renderMode } : {}),
            ...(options.preserveDrawingBuffer === undefined
              ? {}
              : { preserveDrawingBuffer: options.preserveDrawingBuffer }),
            ...(options.maxRasterScale === undefined
              ? {}
              : { maxRasterScale: options.maxRasterScale }),
            onError: (error) => {
              void finish(undefined, { error }).catch(() => {});
            },
          },
        );
        if (!closing) {
          application.view.requestFrame();
          if (requestFocus && !popup.closed) {
            popup.focus();
            canvas.focus({ preventScroll: true });
          }
        }
        return application;
      });
      void opening.then(
        (application) => {
          if (!application) closeFromHost();
        },
        (error) => {
          void finish(undefined, { error }).catch(() => {});
        },
      );
      return result;
    },
    stop() {
      stopped = true;
    },
    async dispose() {
      stopped = true;
      const results = await Promise.allSettled([...requests.keys()].map((close) => close()));
      const errors = results.flatMap((result) =>
        result.status === 'rejected' ? [result.reason] : [],
      );
      if (errors.length) throw new AggregateError(errors, 'Dialog windows failed to close');
    },
  };
}
