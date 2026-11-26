import { finishOwnedDisposal } from '../../runtime/owned-disposal.ts';
import type { ApplicationDefinition } from '@nelyx/core/hosting/runtime';
import type { CSSProperties } from 'react';
import { useEffect, useRef } from 'react';
import { openApplication, ownWebSurface } from './application.ts';
import type { WebApplication, WebApplicationOptions } from './application.ts';
import { replaceOwnedCanvas } from './owned-canvas.ts';
export interface WebSurfaceProps {
  readonly definition: ApplicationDefinition;
  readonly options: Omit<
    WebApplicationOptions,
    'canvas' | 'canvasViewport' | 'input' | 'button' | 'replaceCanvas' | 'signal' | 'localeBoundary'
  >;
  readonly style?: CSSProperties;
  readonly onReady?: (application: WebApplication) => void;
  readonly onError?: (error: unknown) => void;
}
/** StrictMode serializes each canvas's start and drain. */
export function ApplicationSurface(properties: WebSurfaceProps) {
  const container = useRef<HTMLDivElement>(null),
    input = useRef<HTMLInputElement>(null),
    button = useRef<HTMLButtonElement>(null),
    drain = useRef(Promise.resolve());
  useEffect(() => {
    const parent = container.current!,
      lifetime = ownWebSurface(parent),
      controller = new AbortController();
    let target = parent.ownerDocument.createElement('canvas'),
      alive = true,
      application: WebApplication | undefined;
    target.style.cssText = 'width:100%;height:100%;display:block';
    target.setAttribute('aria-hidden', 'true');
    const previous = drain.current;
    // A disposed WebGL context cannot be reused on its old DOM canvas. Each
    // effect owns a fresh child, published only after the previous owner drains.
    const opened = previous.then(async () => {
      if (!alive) return;
      parent.appendChild(target);
      application = await openApplication(properties.definition, {
        ...properties.options,
        canvas: target,
        canvasViewport: parent,
        localeBoundary: input.current!.parentElement!,
        signal: controller.signal,
        replaceCanvas(previous) {
          if (!alive || previous !== target) throw new Error('Web surface is closing');
          return (target = replaceOwnedCanvas(previous));
        },
        input: input.current!,
        button: button.current!,
        ...(properties.onError ? { onError: properties.onError } : {}),
      });
      if (!alive) {
        await finishOwnedDisposal(() => application!.dispose());
        return;
      }
      application.view.requestFrame();
      properties.onReady?.(application);
    });
    void opened.catch((error) => {
      if (alive) properties.onError?.(error);
    });
    return () => {
      alive = false;
      controller.abort();
      const closed = previous.then(async () => {
        try {
          await opened;
        } catch (error) {
          if (error instanceof AggregateError) throw error;
        }
        await finishOwnedDisposal(() => application?.dispose());
        target.remove();
      });
      drain.current = closed;
      void closed.then(
        () => lifetime.complete(),
        (error) => {
          lifetime.complete({ error, retained: { application, target } });
          properties.onError?.(error);
        },
      );
    };
  }, [properties.definition, properties.options]);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        position: 'relative',
        minWidth: 0,
        minHeight: 0,
        width: 480,
        height: 640,
        ...properties.style,
      }}
    >
      <div
        ref={container}
        style={{ width: '100%', height: '100%', position: 'relative', overflow: 'clip' }}
      />
      <input
        ref={input}
        style={{ position: 'absolute', display: 'none', fontSize: 22, color: '#e8eef8' }}
      />
      <button ref={button} style={{ position: 'absolute', display: 'none', fontSize: 22 }} />
    </div>
  );
}
