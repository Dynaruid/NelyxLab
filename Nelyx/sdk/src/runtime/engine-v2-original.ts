// SPDX-License-Identifier: BSD-3-Clause
import { Widget, protocol as p } from '@nelyx/core/v2';
import { OriginalWidgetHost } from '@nelyx/core/v2/original';
import { withNativeRenderConfiguration } from '@nelyx/core/framework/rendering/object';
import type { Widget as OriginalWidget } from '@nelyx/core/framework/widgets/framework';
import type { ViewControllerContext } from '@nelyx/core/hosting/runtime';
import { registerEngineV2WidgetHost } from './engine-v2-app.ts';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { BrowserPlatformEnvironment } from '../backends/browser/platform.ts';
import type { EngineV2App, EngineV2AppContext } from './engine-v2-app.ts';
// Platform selection is realm-wide in the canonical foundation, as in the original SDK.
const nativePlatform = (globalThis as unknown as { NelyxV2Native?: { operatingSystem?: string } })
  .NelyxV2Native;
if (nativePlatform?.operatingSystem)
  FoundationPlatform.configure({ kind: 'native', operatingSystem: nativePlatform.operatingSystem });
else if (typeof navigator !== 'undefined')
  FoundationPlatform.configure(new BrowserPlatformEnvironment(navigator));
export type { EngineV2AppContext } from './engine-v2-app.ts';
export interface OriginalEngineV2App {
  readonly requiredCapabilities?: number;
  readonly services?: ViewControllerContext;
  build(context: EngineV2AppContext): OriginalWidget | Promise<OriginalWidget>;
  ready?(context: EngineV2AppContext): void | Promise<void>;
  dispose?(): void | Promise<void>;
}
class OriginalRoot extends Widget {
  constructor(readonly original: OriginalWidget) {
    super();
  }
}
/** Explicit partial bridge. Original imports retain canonical Element/State identity. */
export function defineOriginalEngineV2App(definition: OriginalEngineV2App): EngineV2App {
  const app: EngineV2App = {
    requiredCapabilities:
      p.capabilities.paragraphLayout |
      p.capabilities.paragraphStyles |
      p.capabilities.graphics |
      p.capabilities.clipStyles |
      p.capabilities.canonicalHitTest |
      p.capabilities.gestureDetails |
      p.capabilities.canonicalControls |
      p.capabilities.appFrameClock |
      p.capabilities.canonicalMaterial |
      p.capabilities.canonicalSelection |
      p.capabilities.canonicalFocus |
      p.capabilities.canonicalSwitch |
      (definition.requiredCapabilities ?? 0),
    async build(context) {
      return new OriginalRoot(
        await withNativeRenderConfiguration(
          () => definition.build(context),
          (operation) => {
            throw Error(
              'Original App cannot execute synchronous TS ' +
                operation +
                ' during native configuration',
            );
          },
        ),
      );
    },
    ready(context) {
      return definition.ready?.(context);
    },
    dispose() {
      return definition.dispose?.();
    },
  };
  return registerEngineV2WidgetHost(app, (view, onError, onExecution) => {
    let host: OriginalWidgetHost | undefined;
    const mounted = () => {
      if (!host) throw Error('Original App host has not mounted');
      return host;
    };
    return {
      mount(root) {
        if (!(root instanceof OriginalRoot)) throw Error('Original App root identity mismatch');
        // Construction may invoke App service getters. Enter only after the
        // common bootstrap has installed its startup/close cleanup owner.
        host = new OriginalWidgetHost(view, {
          onError,
          onExecution,
          ...(definition.services ? { services: definition.services } : {}),
        });
        return host.mount(root.original);
      },
      close: () => host?.close() ?? Promise.resolve(),
      get counters() {
        return mounted().counters;
      },
      get execution() {
        return mounted().execution;
      },
    };
  });
}
