// SPDX-License-Identifier: BSD-3-Clause
import { Widget, protocol as p, drainEngineOwners, fontCatalogBytes } from '@nelyx/core/v2';
import type { AppTextBackend, FontCatalogInput } from '@nelyx/core/v2';
import { OriginalWidgetHost } from '@nelyx/core/v2/original';
import { withNativeRenderConfiguration } from '@nelyx/core/framework/rendering/object';
import type { Widget as OriginalWidget } from '@nelyx/core/framework/widgets/framework';
import type { ViewControllerContext } from '@nelyx/core/hosting/runtime';
import { registerEngineV2WidgetHost } from './engine-v2-app.ts';
import { bindFontLoader } from '@nelyx/core/services/font-loader';
import type { Disposable } from '@nelyx/core/foundation/disposable';
import type { EngineV2App, EngineV2AppContext } from './engine-v2-app.ts';
export type { EngineV2AppContext } from './engine-v2-app.ts';
export interface OriginalEngineV2AppContext extends EngineV2AppContext {
  /** Explicit v2 bridge control; Source FontLoader/system-font APIs are separate. */
  readonly fonts: {
    replace(catalog: FontCatalogInput | null): Promise<number>;
    cancel(): void;
    recover(): Promise<number | undefined>;
  };
}
export interface OriginalEngineV2App {
  readonly requiredCapabilities?: number;
  readonly services?: ViewControllerContext;
  /** Loaded after App quota admission and before the first Source mount. */
  readonly fontCatalog?: (
    context: EngineV2AppContext,
  ) => FontCatalogInput | Promise<FontCatalogInput>;
  build(context: OriginalEngineV2AppContext): OriginalWidget | Promise<OriginalWidget>;
  ready?(context: OriginalEngineV2AppContext): void | Promise<void>;
  dispose?(): void | Promise<void>;
}
class OriginalRoot extends Widget {
  constructor(
    readonly original: OriginalWidget,
    readonly context: EngineV2AppContext,
  ) {
    super();
  }
}
/** Explicit partial bridge. Original imports retain canonical Element/State identity. */
export function defineOriginalEngineV2App(definition: OriginalEngineV2App): EngineV2App {
  if (definition.services && definition.fontCatalog)
    throw Error('Explicit App services own their font loading');
  const hosts = new WeakMap<EngineV2AppContext['view'], OriginalWidgetHost>(),
    preparers = new WeakMap<
      EngineV2AppContext['view'],
      (context: EngineV2AppContext) => Promise<OriginalWidgetHost>
    >(),
    contexts = new WeakMap<EngineV2AppContext, OriginalEngineV2AppContext>();
  const owned = (context: EngineV2AppContext) => {
    if (definition.services) throw Error('Explicit App services own their fonts');
    const host = hosts.get(context.view);
    if (!host) throw Error('Original App font owner has not been prepared');
    return host;
  };
  const appContext = (context: EngineV2AppContext): OriginalEngineV2AppContext => {
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
      p.capabilities.canonicalSlider |
      p.capabilities.layerLinks |
      p.capabilities.paintPrograms |
      p.capabilities.fontResources |
      (definition.requiredCapabilities ?? 0),
    async build(context) {
      const prepare = preparers.get(context.view);
      if (!prepare) throw Error('Original App startup owner is unavailable');
      await prepare(context);
      return new OriginalRoot(
        await withNativeRenderConfiguration(
          () => definition.build(appContext(context)),
          (operation) => {
            throw Error(
              'Original App cannot execute synchronous TS ' +
                operation +
                ' during native configuration',
            );
          },
        ),
        context,
      );
    },
    ready(context) {
      return definition.ready?.(appContext(context));
    },
    dispose() {
      return definition.dispose?.();
    },
  };
  return registerEngineV2WidgetHost(app, (view, onError, onExecution, text, images) => {
    let host: OriginalWidgetHost | undefined;
    let backend: AppTextBackend | undefined;
    let fontBinding: Disposable | undefined;
    let preparing: Promise<OriginalWidgetHost> | undefined;
    const prepare = (context: EngineV2AppContext): Promise<OriginalWidgetHost> => {
      if (!preparing)
        preparing = (async () => {
          // The common bootstrap installs cleanup before invoking build().
          // Admit the App backend before user FontLoader/build callbacks run.
          if (!definition.services) {
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
              : { appText: backend!, appImages: images, ownsAppText: false }),
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
    preparers.set(view, prepare);
    const mounted = () => {
      if (!host) throw Error('Original App host has not mounted');
      return host;
    };
    return {
      async mount(root) {
        if (!(root instanceof OriginalRoot) || root.context.view !== view)
          throw Error('Original App root identity mismatch');
        return (await prepare(root.context)).mount(root.original);
      },
      close: async () => {
        try {
          await drainEngineOwners('Original App paragraph cleanup failed', [
            () => fontBinding?.dispose(),
            () => (host ? host.close() : backend?.close()),
          ]);
        } finally {
          hosts.delete(view);
          preparers.delete(view);
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
