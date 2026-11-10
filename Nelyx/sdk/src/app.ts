// SPDX-License-Identifier: BSD-3-Clause
import { protocol as p, drainEngineOwners, fontCatalogBytes } from '@nelyx/core/engine';
import type { AppTextBackend, FontCatalogInput } from '@nelyx/core/engine';
import { OriginalWidgetHost } from '@nelyx/core/internal/runtime/app';
import { withNativeRenderConfiguration } from '@nelyx/core/framework/rendering/object';
import type { Widget as OriginalWidget } from '@nelyx/core/framework/widgets/framework';
import type { ViewControllerContext } from '@nelyx/core/hosting/runtime';
import { launchAppSession } from './runtime/app-session.ts';
import type { EngineV2AppContext } from './runtime/app-session.ts';
import { bindFontLoader } from '@nelyx/core/services/font-loader';
import type { Disposable } from '@nelyx/core/foundation/disposable';
import { createAppServices } from './runtime/app-services.ts';

export type { EngineV2AppContext as AppServiceContext } from './runtime/app-session.ts';
export interface AppContext extends EngineV2AppContext {
  /** Explicit v2 bridge control; Source FontLoader/system-font APIs are separate. */
  readonly fonts: {
    replace(catalog: FontCatalogInput | null): Promise<number>;
    cancel(): void;
    recover(): Promise<number | undefined>;
  };
}
export interface AppDefinition {
  readonly requiredCapabilities?: number;
  readonly services?: ViewControllerContext;
  /** Loaded after App quota admission and before the first Source mount. */
  readonly fontCatalog?: (
    context: EngineV2AppContext,
  ) => FontCatalogInput | Promise<FontCatalogInput>;
  build(context: AppContext): OriginalWidget | Promise<OriginalWidget>;
  ready?(context: AppContext): void | Promise<void>;
  dispose?(): void | Promise<void>;
}
export type App = AppDefinition;
export function defineApp(definition: AppDefinition): App {
  if (definition.services && definition.fontCatalog)
    throw Error('Explicit App services own their font loading');
  return definition;
}
export function launchApp(definition: AppDefinition): void {
  if (definition.services && definition.fontCatalog)
    throw Error('Explicit App services own their font loading');
  const hosts = new WeakMap<EngineV2AppContext['view'], OriginalWidgetHost>(),
    contexts = new WeakMap<EngineV2AppContext, AppContext>();
  const owned = (context: EngineV2AppContext) => {
    if (definition.services) throw Error('Explicit App services own their fonts');
    const host = hosts.get(context.view);
    if (!host) throw Error('Original App font owner has not been prepared');
    return host;
  };
  const appContext = (context: EngineV2AppContext): AppContext => {
    let value = contexts.get(context);
    if (!value) {
      value = Object.freeze({
        ...context,
        fonts: Object.freeze({
          replace: (catalog: FontCatalogInput | null) => {
            try {
              return owned(context).updateFontCatalog(
                catalog === null ? null : fontCatalogBytes(catalog),
              );
            } catch (error) {
              return Promise.reject(error);
            }
          },
          cancel: () => hosts.get(context.view)?.cancelFontUpdate(),
          recover: () => {
            try {
              return owned(context).recoverFontUpdate();
            } catch (error) {
              return Promise.reject(error);
            }
          },
        }),
      });
      contexts.set(context, value);
    }
    return value;
  };
  const app = {
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
      p.capabilities.canonicalSlider |
      p.capabilities.layerLinks |
      p.capabilities.paintPrograms |
      p.capabilities.fontResources |
      (definition.requiredCapabilities ?? 0),
    async build(context: EngineV2AppContext) {
      return withNativeRenderConfiguration(
        () => definition.build(appContext(context)),
        (operation) => {
          throw Error(
            'App cannot execute synchronous TS ' + operation + ' during native configuration',
          );
        },
      );
    },
    ready(context: EngineV2AppContext) {
      return definition.ready?.(appContext(context));
    },
    dispose() {
      return definition.dispose?.();
    },
  };
  launchAppSession(app, (view, onError, onExecution, text, images) => {
    let host: OriginalWidgetHost | undefined;
    let backend: AppTextBackend | undefined;
    let fontBinding: Disposable | undefined;
    let preparing: Promise<OriginalWidgetHost> | undefined;
    let services: ReturnType<typeof createAppServices> | undefined;
    const prepare = (context: EngineV2AppContext): Promise<OriginalWidgetHost> => {
      if (!preparing)
        preparing = (async () => {
          // The common bootstrap installs cleanup before invoking build().
          // Admit the App backend before user FontLoader/build callbacks run.
          if (!definition.services) {
            services = createAppServices(onError, view.owner.view);
            backend = await text();
            if (backend.images?.snapshot().version !== 2)
              throw Error('Required App image scene service version 2 is unavailable');
            if (backend.networkVersion !== 2)
              throw Error('Required App HTTP header service version 2 is unavailable');
          }
          host = new OriginalWidgetHost(view, {
            onError,
            onExecution,
            ...(definition.services
              ? { services: definition.services }
              : {
                  appText: backend!,
                  appImages: images,
                  ownsAppText: false,
                  binaryMessenger: services!.binaryMessenger,
                  platformView: services!.platformView,
                  dispatchNativeKey: services!.dispatchNativeKey,
                  semanticsEvent: (node, type) => services!.semanticsEvent(node, type),
                }),
          });
          hosts.set(view, host);
          if (!definition.services)
            fontBinding = bindFontLoader({
              loadFont: (bytes, family) => host!.loadFont(bytes, family),
            });
          if (definition.fontCatalog) {
            const catalog = await definition.fontCatalog(context);
            await host.updateFontCatalog(fontCatalogBytes(catalog));
          }
          return host;
        })();
      return preparing;
    };
    const mounted = () => {
      if (!host) throw Error('Original App host has not mounted');
      return host;
    };
    return {
      diagnostics: () => host?.diagnostics() ?? {},
      prepare: async (context) => {
        await prepare(context);
      },
      mount: (root: OriginalWidget) => mounted().mount(root),
      close: async () => {
        try {
          await drainEngineOwners('Original App paragraph cleanup failed', [
            () => services?.stop(),
            () => fontBinding?.dispose(),
            () => (host ? host.close() : backend?.close()),
            () => services?.close(),
          ]);
        } finally {
          hosts.delete(view);
        }
      },
      get counters() {
        return mounted().counters;
      },
      get execution() {
        return mounted().execution;
      },
    };
  });
}
