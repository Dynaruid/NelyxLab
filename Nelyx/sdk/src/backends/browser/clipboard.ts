// SPDX-License-Identifier: BSD-3-Clause
import { PlatformException } from '@nelyx/core/services/message-codec';
import type { PlatformEnvironment } from '@nelyx/core/services/binding';
import type { ClipboardServiceHost } from '../../runtime/clipboard-service.ts';
import { BrowserPlatformEnvironment } from '../../frontend/dom/environment.ts';
import { deviceFailure } from '../backend-contract.ts';

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
type ClipboardPermissionName = 'clipboard-read' | 'clipboard-write';
export interface ClipboardPermission {
  readonly state: Permission;
  subscribe(listener: () => void): () => void;
}
export interface ClipboardIO {
  readText?(): Promise<string>;
  writeText?(text: string): Promise<void>;
  queryPermission?(name: ClipboardPermissionName): Promise<ClipboardPermission | undefined>;
  dispose?(): void;
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

function domClipboard(view: Window): ClipboardIO {
  const { navigator } = view;
  const clipboard = view.isSecureContext ? navigator.clipboard : undefined;
  return {
    ...(typeof clipboard?.readText === 'function' ? { readText: () => clipboard.readText() } : {}),
    ...(typeof clipboard?.writeText === 'function'
      ? { writeText: (text: string) => clipboard.writeText(text) }
      : {}),
    async queryPermission(name) {
      const status = await navigator.permissions?.query({ name: name as PermissionName });
      if (!status) return;
      return {
        get state() {
          return status.state;
        },
        subscribe(listener) {
          status.addEventListener('change', listener);
          return () => status.removeEventListener('change', listener);
        },
      };
    },
  };
}

export function createClipboard(
  view: Window,
  decide: (input: ClipboardInput) => ClipboardPolicy | Promise<ClipboardPolicy> = domPolicy,
  options?: { readonly host?: ClipboardInput['host']; readonly io?: ClipboardIO },
  signal?: AbortSignal,
): ClipboardBinding {
  const os = new BrowserPlatformEnvironment(view.navigator).operatingSystem;
  const host = options?.host ?? (os === 'android' || os === 'iOS' ? 'browser-mobile' : 'browser');
  const native = host === 'native-desktop' || host === 'native-mobile';
  const mobile = host === 'browser-mobile' || host === 'native-mobile';
  const clipboard = options?.io ?? domClipboard(view);
  const input: ClipboardInput = {
    host,
    readApi: typeof clipboard.readText === 'function',
    writeApi: typeof clipboard.writeText === 'function',
    readPermission: native ? 'granted' : 'unavailable',
    writePermission: native ? 'granted' : 'unavailable',
  };
  const listeners = new Set<() => void>();
  const detach: (() => void)[] = [];
  const browserOperations = new Set<() => void>();
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
  function completion<T>(result: T | Promise<T>): Promise<T> {
    if (native) return Promise.resolve(result);
    // The browser may leave a clipboard prompt pending after its window closes.
    return new Promise((resolve, reject) => {
      const cancel = () => reject(new PlatformException({ code: 'disposed' }));
      if (live) browserOperations.add(cancel);
      else cancel();
      void Promise.resolve(result).then(
        (value) => {
          browserOperations.delete(cancel);
          resolve(value);
        },
        (error) => {
          browserOperations.delete(cancel);
          reject(error);
        },
      );
    });
  }
  async function queryPermission(name: ClipboardPermissionName) {
    try {
      return await completion(clipboard.queryPermission?.(name));
    } catch {
      // Some browsers expose Permissions but do not recognize the clipboard names.
      return undefined;
    }
  }
  async function observe(name: ClipboardPermissionName, key: 'readPermission' | 'writePermission') {
    const status = await queryPermission(name);
    if (!live || !status) return;
    const changed = () => {
      input[key] = status.state;
      void refresh().catch(report);
    };
    detach.push(status.subscribe(changed));
    changed();
  }
  function dispose() {
    if (!live) return;
    live = false;
    revision++;
    signal?.removeEventListener('abort', dispose);
    for (const cancel of browserOperations) cancel();
    browserOperations.clear();
    for (const remove of detach.splice(0)) remove();
    listeners.clear();
    clipboard.dispose?.();
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
  function requireLive() {
    if (!live) throw new PlatformException({ code: 'disposed' });
  }
  function requireApi(api: boolean) {
    requireLive();
    if (!api) throw new PlatformException({ code: 'unsupported' });
  }
  const readText = async () => {
    requireApi(input.readApi);
    // Enter the browser API within the original user activation.
    try {
      const text = await completion(clipboard.readText!());
      requireLive();
      if (typeof text !== 'string') throw new TypeError('Invalid clipboard text response');
      return text;
    } catch (error) {
      requireLive();
      throw deviceFailure(error);
    }
  };
  return {
    readText,
    async writeText(text) {
      requireApi(input.writeApi);
      try {
        await completion(clipboard.writeText!(text));
      } catch (error) {
        requireLive();
        throw deviceFailure(error);
      }
      requireLive();
    },
    async hasStrings() {
      requireLive();
      // A freshly opened menu can run before the Permissions change event reaches the widget.
      const permission =
        !native && input.readApi ? await queryPermission('clipboard-read') : undefined;
      requireLive();
      const current = await completion(
        decide({
          ...input,
          readPermission: native ? input.readPermission : (permission?.state ?? 'unavailable'),
        }),
      );
      requireLive();
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
