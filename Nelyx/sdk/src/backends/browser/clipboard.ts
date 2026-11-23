// SPDX-License-Identifier: BSD-3-Clause
import { PlatformException } from '@nelyx/core/services/message-codec';
import type { PlatformEnvironment } from '@nelyx/core/services/binding';
import type { ClipboardServiceHost } from '../../runtime/clipboard-service.ts';
import { BrowserPlatformEnvironment } from '../../frontend/dom/environment.ts';

type Permission = PermissionState | 'unavailable';
type Preflight = 'read' | 'permission-required' | 'permission-denied' | 'unsupported';
export interface ClipboardInput {
  host: 'browser' | 'browser-mobile' | 'native-desktop' | 'native-mobile';
  readApi: boolean;
  writeApi: boolean;
  readPermission: Permission;
  writePermission: Permission;
}
export interface ClipboardPolicy {
  read: boolean;
  write: boolean;
  preflight: Preflight;
}
export interface NativeClipboard {
  readonly mobile: boolean;
  readText?(): Promise<string>;
  writeText?(text: string): Promise<void>;
}
export interface ClipboardBinding extends ClipboardServiceHost {
  readCapabilities(): Pick<PlatformEnvironment['capabilities'], 'clipboardRead' | 'clipboardWrite'>;
  subscribe(listener: () => void): () => void;
  dispose(): void;
}

function domPolicy(input: ClipboardInput): ClipboardPolicy {
  const read = input.readApi && input.readPermission !== 'denied';
  return {
    read,
    write: input.writeApi && input.writePermission !== 'denied',
    preflight: !input.readApi
      ? 'unsupported'
      : !read
        ? 'permission-denied'
        : input.host === 'native-desktop' ||
            (input.host === 'browser' && input.readPermission === 'granted')
          ? 'read'
          : 'permission-required',
  };
}

export function createClipboard(
  view: Window,
  decide: (input: ClipboardInput) => ClipboardPolicy | Promise<ClipboardPolicy> = domPolicy,
  native?: NativeClipboard,
  signal?: AbortSignal,
): ClipboardBinding {
  const clipboard = native ?? view.navigator.clipboard;
  const os = new BrowserPlatformEnvironment(view.navigator).operatingSystem;
  const mobile = native?.mobile ?? (os === 'android' || os === 'iOS');
  const input: ClipboardInput = {
    host: native
      ? mobile
        ? 'native-mobile'
        : 'native-desktop'
      : mobile
        ? 'browser-mobile'
        : 'browser',
    readApi: typeof clipboard?.readText === 'function',
    writeApi: typeof clipboard?.writeText === 'function',
    readPermission: native ? 'granted' : 'unavailable',
    writePermission: native ? 'granted' : 'unavailable',
  };
  const listeners = new Set<() => void>();
  const detach: (() => void)[] = [];
  let state = domPolicy(input);
  let revision = 0;
  let live = true;
  const refresh = async () => {
    const current = ++revision;
    const result = await decide({ ...input });
    if (!live || signal?.aborted || current !== revision) return;
    state = result;
    for (const listener of listeners) listener();
  };
  const report = (error: unknown) => {
    if (live && !signal?.aborted) console.error('Nelyx clipboard capabilities', error);
  };
  function queryPermission(name: 'clipboard-read' | 'clipboard-write') {
    return view.navigator.permissions
      ?.query({ name: name as PermissionName })
      .catch(() => undefined);
  }
  async function observe(
    name: 'clipboard-read' | 'clipboard-write',
    key: 'readPermission' | 'writePermission',
  ) {
    const status = await queryPermission(name);
    if (!live || !status) return;
    const changed = () => {
      input[key] = status.state;
      void refresh().catch(report);
    };
    status.addEventListener('change', changed);
    detach.push(() => status.removeEventListener('change', changed));
    changed();
  }
  function dispose() {
    live = false;
    revision++;
    signal?.removeEventListener('abort', dispose);
    for (const remove of detach.splice(0)) remove();
    listeners.clear();
  }
  signal?.addEventListener('abort', dispose, { once: true });
  if (signal?.aborted) dispose();
  else {
    if (!native && input.readApi) void observe('clipboard-read', 'readPermission').catch(report);
    if (!native && input.writeApi) void observe('clipboard-write', 'writePermission').catch(report);
    void refresh().catch(report);
  }
  const permissions = (
    api: boolean,
    permission: Permission,
    allowed: boolean,
    mobileRead = false,
  ): PlatformEnvironment['capabilities']['clipboardRead'] =>
    !api
      ? 'unavailable'
      : allowed && permission === 'granted' && !mobileRead
        ? 'available'
        : 'permission-required';
  function requireApi(api: boolean) {
    if (!live) throw new PlatformException({ code: 'disposed' });
    if (!api) throw new PlatformException({ code: 'unsupported' });
  }
  function accessError(error: unknown): never {
    if (error instanceof PlatformException) throw error;
    const message = String(error);
    throw new PlatformException({
      code: /notallowederror|not allowed|permission denied|forbidden/i.test(message)
        ? 'permission-denied'
        : /not supported|not implemented/i.test(message)
          ? 'unsupported'
          : 'platform-error',
      message,
    });
  }
  const readText = async () => {
    requireApi(input.readApi);
    // Enter the browser API within the original user activation.
    try {
      return await clipboard!.readText!();
    } catch (error) {
      if (native && /clipboard is empty|clipboard contents were not available/i.test(String(error)))
        return '';
      return accessError(error);
    }
  };
  return {
    readText,
    async writeText(text) {
      requireApi(input.writeApi);
      try {
        await clipboard!.writeText!(text);
      } catch (error) {
        accessError(error);
      }
    },
    async hasStrings() {
      if (!live) throw new PlatformException({ code: 'disposed' });
      // A freshly opened menu can run before the Permissions change event reaches the widget.
      const permission =
        !native && input.readApi ? await queryPermission('clipboard-read') : undefined;
      if (!live) throw new PlatformException({ code: 'disposed' });
      const current = await decide({
        ...input,
        readPermission: permission?.state ?? input.readPermission,
      });
      if (current.preflight !== 'read') throw new PlatformException({ code: current.preflight });
      return (await readText()).length > 0;
    },
    readCapabilities() {
      return {
        clipboardRead: permissions(input.readApi, input.readPermission, state.read, mobile),
        clipboardWrite: permissions(input.writeApi, input.writePermission, state.write),
      };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose,
  };
}
