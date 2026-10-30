import { installBrowserSystemColors } from './system-colors.ts';
import { installAutofillMessages } from '../../runtime/autofill.ts';
// SPDX-License-Identifier: BSD-3-Clause
import { PluginPlatformMessagePort } from '../../runtime/plugin-port.ts';
import { installOsServices } from '../../runtime/os-services.ts';
import {
  MethodCall,
  PlatformException,
  MissingPluginException,
} from '@nelyx/core/services/message-codec';
import { JSONMethodCodec, StandardMethodCodec } from '@nelyx/core/services/message-codecs';
import { BrowserMouseCursor } from './mouse-cursor.ts';
import { installBrowserAccessibility } from './accessibility.ts';
import type { BrowserSelectionContextMenu } from './selection-context-menu.ts';
/** Browser services run on the DOM owner, including secure-context permission errors. */
export function createBrowserPlatformMessages(
  view: Window = window,
  cursorTarget?: HTMLElement | BrowserMouseCursor,
  selectionContextMenu?: BrowserSelectionContextMenu,
  accessibility?: { readonly hostElement: HTMLElement; readonly viewId: number },
  restoration?: { readonly key: string },
  accessibilityEnabled = true,
): PluginPlatformMessagePort {
  const port = new PluginPlatformMessagePort(),
    doc = view.document,
    navigator = view.navigator;
  installAutofillMessages(port, 'web');
  const dark = view.matchMedia('(prefers-color-scheme: dark)'),
    reducedMotion = accessibilityEnabled
      ? view.matchMedia('(prefers-reduced-motion: reduce)')
      : undefined,
    forcedColors = accessibilityEnabled ? view.matchMedia('(forced-colors: active)') : undefined,
    codec = new JSONMethodCodec();
  if (restoration) {
    if (!restoration.key || restoration.key.length > 256)
      throw new TypeError('Restoration storage requires a bounded application key');
    const key = 'nelyx.restoration.v1:' + restoration.key,
      limit = 4 * 1024 * 1024;
    port.registerMethod('flutter/restoration', new StandardMethodCodec(), (call) => {
      if (call.method === 'get') {
        const stored = view.sessionStorage.getItem(key);
        if (stored === null)
          return new Map<string, unknown>([
            ['enabled', true],
            ['data', null],
          ]);
        if (stored.length > Math.ceil(limit / 3) * 4)
          throw new PlatformException({
            code: 'restoration-budget',
            message: 'Stored restoration data exceeds 4 MiB',
          });
        const raw = view.atob(stored),
          data = Uint8Array.from(raw, (c) => c.charCodeAt(0));
        return new Map<string, unknown>([
          ['enabled', true],
          ['data', data],
        ]);
      }
      if (call.method === 'put') {
        const data = call.arguments;
        if (!(data instanceof Uint8Array) || data.length > limit)
          throw new PlatformException({
            code: 'restoration-budget',
            message: 'Restoration data requires at most 4 MiB',
          });
        let raw = '';
        for (let offset = 0; offset < data.length; offset += 8192)
          raw += String.fromCharCode(...data.subarray(offset, offset + 8192));
        view.sessionStorage.setItem(key, view.btoa(raw));
        return null;
      }
      throw new MissingPluginException();
    });
  }
  if (accessibilityEnabled && accessibility) {
    if (accessibility.hostElement.ownerDocument !== doc)
      throw new Error('Accessibility host must belong to the actual View document');
    installBrowserAccessibility(port, accessibility.hostElement, accessibility.viewId);
  }
  if (cursorTarget) {
    const cursor =
      cursorTarget instanceof BrowserMouseCursor
        ? cursorTarget
        : new BrowserMouseCursor(cursorTarget);
    if (cursor.canvas.ownerDocument !== doc)
      throw new Error('Cursor target must belong to the actual browser View document');
    port.registerMethod('flutter/mousecursor', new StandardMethodCodec(), (call, { signal }) => {
      if (call.method !== 'activateSystemCursor') throw new MissingPluginException();
      const args = call.arguments;
      if (
        !(args instanceof Map) ||
        !Number.isSafeInteger(args.get('device')) ||
        typeof args.get('kind') !== 'string'
      )
        throw new PlatformException({
          code: 'invalid-arguments',
          message: 'Invalid system cursor device or kind',
        });
      if (!signal.aborted) cursor.activate(args.get('kind') as string);
      return null;
    });
    port.own(cursor);
  }
  if (selectionContextMenu)
    port.registerMethod('flutter/contextmenu', codec, (call, { signal }) => {
      if (call.method !== 'enableContextMenu' && call.method !== 'disableContextMenu')
        throw new MissingPluginException();
      if (!signal.aborted) selectionContextMenu.setEnabled(call.method === 'enableContextMenu');
      return null;
    });
  const owner = 'nelyx-history-' + Math.random().toString(36).slice(2);
  let singleEntry = false;
  const clipboard = navigator.clipboard;
  const permissionError = (error: unknown): never => {
    throw new PlatformException({
      code:
        error instanceof Error && error.name === 'NotAllowedError'
          ? 'permission-denied'
          : 'platform-error',
      message: String(error),
    });
  };
  const readText =
    clipboard && typeof clipboard.readText === 'function'
      ? async () => {
          try {
            return await clipboard.readText();
          } catch (error) {
            return permissionError(error);
          }
        }
      : undefined;
  const writeText =
    clipboard && typeof clipboard.writeText === 'function'
      ? async (text: string) => {
          try {
            await clipboard.writeText(text);
          } catch (error) {
            permissionError(error);
          }
        }
      : undefined;
  const popstate = () => {
    const state = view.history.state;
    void port
      .emit(
        'flutter/navigation',
        codec.encodeMethodCall(
          new MethodCall(
            'pushRouteInformation',
            new Map<string, unknown>([
              ['uri', view.location.href],
              ['state', state?.nelyxOwner === owner ? state.value : null],
            ]),
          ),
        ),
      )
      .catch(() => {});
  };
  installOsServices(port, {
    playSystemSound() {
      /* The pinned Web engine has no default system sounds. */
    },
    vibrateHapticFeedback(type) {
      const duration =
        type === 'HapticFeedbackType.lightImpact' || type === 'HapticFeedbackType.selectionClick'
          ? 10
          : type === 'HapticFeedbackType.mediumImpact' ||
              type === 'HapticFeedbackType.successNotification' ||
              type === 'HapticFeedbackType.warningNotification'
            ? 20
            : type === 'HapticFeedbackType.heavyImpact' ||
                type === 'HapticFeedbackType.errorNotification'
              ? 30
              : 50;
      navigator.vibrate?.(duration);
    },
    readEnvironment() {
      const locales = [...navigator.languages];
      return {
        locales: locales.length ? locales : null,
        localeSource: locales.length ? 'native' : 'unavailable',
        localeObservation: locales.length ? 'event' : 'unavailable',
        brightness: dark.matches ? 'dark' : 'light',
        lifecycle: doc.hidden ? 'hidden' : doc.hasFocus() ? 'resumed' : 'inactive',
        textScale: null,
        ...(accessibilityEnabled
          ? {
              accessibility: {
                features: (reducedMotion!.matches ? 4 | 16 : 0) | (forcedColors!.matches ? 32 : 0),
                supportedFeatures: 4 | 16 | 32,
                semanticsEnabled: null,
                source: 'browser' as const,
                observation: 'event' as const,
              },
            }
          : {}),
        capabilities: {
          clipboardRead: readText ? 'permission-required' : 'unavailable',
          clipboardWrite: writeText ? 'permission-required' : 'unavailable',
          navigation: 'available',
        },
      };
    },
    observe(changed, _pressure, _failed, fontsChanged) {
      const registered: [EventTarget, string, EventListener][] = [];
      let live = true;
      const update = () => {
          if (live) changed();
        },
        fontUpdate = () => {
          if (live) fontsChanged();
        };
      const dispose = () => {
        live = false;
        const errors: unknown[] = [];
        for (const [target, event, callback] of registered.splice(0))
          try {
            target.removeEventListener(event, callback);
          } catch (error) {
            errors.push(error);
          }
        if (errors.length)
          throw new AggregateError(errors, 'Browser services observer cleanup failed');
      };
      try {
        const events: readonly (readonly [EventTarget, string])[] = [
          [view, 'languagechange'],
          [view, 'focus'],
          [view, 'blur'],
          [doc, 'visibilitychange'],
          [view, 'pageshow'],
          [view, 'pagehide'],
          [dark, 'change'],
          ...(reducedMotion && forcedColors
            ? ([
                [reducedMotion, 'change'],
                [forcedColors, 'change'],
              ] as const)
            : []),
        ];
        for (const [target, event] of events) {
          registered.push([target, event, update]);
          target.addEventListener(event, update);
        }
        if (doc.fonts) {
          registered.push([doc.fonts, 'loadingdone', fontUpdate]);
          doc.fonts.addEventListener('loadingdone', fontUpdate);
        }
        return { dispose };
      } catch (error) {
        try {
          dispose();
        } catch (cleanup) {
          throw new AggregateError(
            [error, cleanup],
            'Browser services observer initialization failed',
          );
        }
        throw error;
      }
    },
    ...(readText ? { readText, hasStrings: async () => (await readText()).length > 0 } : {}),
    ...(writeText ? { writeText } : {}),
    pop() {
      view.history.back();
    },
    navigation(method, args) {
      if (method === 'getRouteInformation') {
        const state = view.history.state;
        return new Map<string, unknown>([
          ['uri', view.location.href],
          ['state', state?.nelyxOwner === owner ? state.value : null],
        ]);
      }
      if (method === 'selectSingleEntryHistory') {
        singleEntry = true;
        return null;
      }
      if (method === 'selectMultiEntryHistory') {
        singleEntry = false;
        return null;
      }
      if (method !== 'routeInformationUpdated') throw new MissingPluginException();
      if (
        !(args instanceof Map) ||
        typeof args.get('uri') !== 'string' ||
        typeof args.get('replace') !== 'boolean'
      )
        throw new PlatformException({
          code: 'invalid-arguments',
          message: 'Invalid route information',
        });
      const uri = new URL(args.get('uri'), view.location.href);
      if (uri.origin !== view.location.origin)
        throw new PlatformException({
          code: 'invalid-arguments',
          message: 'Route URI must keep the application origin',
        });
      const state = { nelyxOwner: owner, value: args.get('state') ?? null };
      if (singleEntry || args.get('replace')) view.history.replaceState(state, '', uri);
      else view.history.pushState(state, '', uri);
      return null;
    },
  });
  port.onListening((channel, listening) => {
    if (channel === 'flutter/navigation') {
      if (listening) view.addEventListener('popstate', popstate);
      else view.removeEventListener('popstate', popstate);
    }
  });
  port.own({
    dispose() {
      view.removeEventListener('popstate', popstate);
    },
  });
  port.own(installBrowserSystemColors(view));
  return port;
}
