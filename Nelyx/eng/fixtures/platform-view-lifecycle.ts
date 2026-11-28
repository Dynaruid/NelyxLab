// SPDX-License-Identifier: BSD-3-Clause
import { createElement, useEffect } from 'react';
import { defineApp } from '@nelyx/sdk/app';
import {
  readWebApplicationDiagnostics,
  registerApplication,
} from '@nelyx/sdk/frontend/dom/application';
import { ApplicationSurface } from '@nelyx/sdk/frontend/dom/surface';
import { ColoredBox, Positioned, SizedBox, Stack } from '@nelyx/core/framework/widgets/basic';
import { State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import { IgnorePointer } from '@nelyx/core/framework/widgets/pointer-blocking';
import { PlatformView } from '@nelyx/core/framework/widgets/platform-view';
import type { CanvasKitManifest } from '../../sdk/src/backends/browser/canvaskit-manifest.ts';
import type { WebSurfaceProps } from '@nelyx/sdk/frontend/dom/surface';

const type = 'test.lifecycle-editor';
const ping = 'nelyx-lifecycle-test-ping';
const base = new URL('/', location.href);
const runtime = new URL('runtime/', base);
const renderMode = new URL(location.href).searchParams.has('worker') ? 'worker-transfer' : 'direct';
const manifest = (await (
  await fetch(new URL('native-manifest.json', runtime))
).json()) as CanvasKitManifest;
const workers: Worker[] = [];
const replies: { kind: string; sequence?: number; previous?: number }[] = [];
const originalWorker = window.Worker;
window.Worker = class extends originalWorker {
  constructor(url: string | URL, options?: WorkerOptions) {
    super(url, options);
    if (options?.name === 'nelyx-renderer') {
      workers.push(this);
      this.addEventListener('message', ({ data }) => {
        if (data?.lifecycleTest) replies.push(data);
      });
    }
  }
};

interface Counters {
  effects: number;
  cleanups: number;
  created: number;
  disposed: number;
  pings: number;
}
const counters: Record<string, Counters> = {};
const errors: string[] = [];
let mounting: ReturnType<typeof registerApplication> | undefined;
let move: ((y: number) => void) | undefined;

class EditorScene extends StatefulWidget {
  override createState(): State<EditorScene> {
    return new EditorSceneState();
  }
}

class EditorSceneState extends State<EditorScene> {
  private top = 24;

  override initState(): void {
    move = (top) =>
      this.setState(() => {
        this.top = top;
      });
  }

  override build() {
    return new SizedBox(
      400,
      320,
      new Stack([
        new Positioned(new PlatformView({ viewType: type }), {
          top: this.top,
          left: 24,
          width: 240,
          height: 88,
        }),
        new Positioned(new IgnorePointer(new ColoredBox({ color: 0x807c64c4 })), {
          top: this.top + 8,
          left: 40,
          width: 102,
          height: 32,
        }),
      ]),
    );
  }

  override dispose(): void {
    move = undefined;
  }
}

const definition = defineApp({
  id: 'test.platform-view-lifetime',
  createRoot: () => new EditorScene(),
});

function options(tag: string): WebSurfaceProps['options'] {
  return {
    manifest: [],
    assetsRoot: base,
    canvasKitRoot: runtime,
    canvasKitManifest: manifest,
    renderMode,
    initializePlatformServices: false,
    platformViews: {
      [type]: {
        create({ document, signal }) {
          const count = counters[tag]!;
          count.created++;
          const element = document.createElement('textarea');
          element.dataset.owner = tag;
          element.value = tag;
          document.defaultView!.addEventListener(
            ping,
            () => {
              count.pings++;
            },
            { signal },
          );
          return {
            element,
            dispose() {
              count.disposed++;
            },
          };
        },
      },
    },
  };
}

function start(tag: string): void {
  if (mounting) throw new Error('Close the current test root before mounting again');
  const count = (counters[tag] = { effects: 0, cleanups: 0, created: 0, disposed: 0, pings: 0 });
  const props = {
    options: options(tag),
    definition,
    onError: (error: unknown) => {
      errors.push(String(error));
    },
  };
  mounting = registerApplication(
    'PlatformViewLifecycle',
    function TestSurface() {
      useEffect(() => {
        count.effects++;
        return () => {
          count.cleanups++;
        };
      }, []);
      return createElement(ApplicationSurface, props);
    },
    document.querySelector<HTMLElement>('#root')!,
  );
}

Object.assign(window, {
  lifecycleTest: {
    start,
    async close() {
      await mounting!.close();
      mounting = undefined;
    },
    ping: () => window.dispatchEvent(new Event(ping)),
    counts: () => counters,
    errors: () => errors,
    liveApplications: () => readWebApplicationDiagnostics().length,
    move: (y: number) => move!(y),
    workers: () => workers.length,
    replies: () => replies,
    sendToWorker: (kind: string) => workers.at(-1)!.postMessage({ kind }),
  },
});
