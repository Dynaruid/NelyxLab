// SPDX-License-Identifier: BSD-3-Clause
import {
  appServiceTextUnits,
  validateAppServiceText,
  appServiceMethods,
  appServiceReadsText,
} from '../../runtime/app-service-protocol.ts';
import type { AppServiceMethod } from '../../runtime/app-service-protocol.ts';
type BrowserAppWorker =
  typeof globalThis extends Record<'Worker', { prototype: infer Instance }> ? Instance : never;

/** DOM clipboard ownership stays on the Main owner, outside the App worker. */
export function bindBrowserAppServices(app: BrowserAppWorker) {
  const pending = new Set<Promise<void>>();
  let tooltip: HTMLElement | undefined;
  let stopped = false,
    bytes = 0,
    sequence = 0;
  const receive = (event: MessageEvent) => {
    const value = event.data as {
      kind?: string;
      id?: number;
      method?: AppServiceMethod;
      text?: unknown;
    };
    if (value.kind === 'app-services-stop') {
      stopped = true;
      tooltip?.remove();
      tooltip = undefined;
      return;
    }
    if (value.kind !== 'app-service') return;
    const id = value.id;
    const reply = (text: string, error?: string) =>
      app.postMessage({ kind: 'app-service-result', id, text, ...(error ? { error } : {}) });
    let held: number;
    try {
      if (
        typeof id !== 'number' ||
        !Number.isInteger(id) ||
        !id ||
        id <= sequence ||
        id > 0xffff_ffff
      )
        throw new Error('Invalid App OS service identity');
      sequence = id;
      validateAppServiceText(value.text);
      if (
        !appServiceMethods.includes(value.method as AppServiceMethod) ||
        (appServiceReadsText(value.method!) && value.text)
      )
        throw new Error('Unsupported App OS service request');
      held =
        value.text.length * 2 + (appServiceReadsText(value.method!) ? appServiceTextUnits * 2 : 0);
      if (stopped || pending.size >= 32 || bytes + held > 1024 * 1024)
        throw new Error('Browser App OS service mailbox is full or closed');
    } catch (error) {
      reply('', String(error).slice(0, 1024));
      return;
    }
    bytes += held;
    const task = (async () => {
      try {
        if (stopped) throw new Error('Browser App OS service is stopped');
        if (value.method === 'accessibility-tooltip') {
          if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.setAttribute('role', 'status');
            tooltip.setAttribute('aria-live', 'polite');
            tooltip.setAttribute('aria-atomic', 'true');
            Object.assign(tooltip.style, {
              position: 'fixed',
              width: '1px',
              height: '1px',
              overflow: 'hidden',
              clipPath: 'inset(50%)',
            });
            document.body.append(tooltip);
          }
          tooltip.replaceChildren(document.createTextNode(value.text as string));
          reply('');
          return;
        }
        // The original browser accessibility handler ignores these empty
        // node-feedback events. DOM live announcements are a separate service.
        if (value.method?.startsWith('semantics-')) {
          if (!/^[1-9][0-9]{0,19}$/.test(value.text as string))
            throw new Error('Invalid native semantics event identity');
          reply('');
          return;
        }
        if (value.method === 'system-sound' || value.method === 'haptic-feedback')
          throw new Error('Browser system feedback is unavailable');
        if (!navigator.clipboard) throw new Error('Browser clipboard is unavailable');
        if (value.method === 'clipboard-write') {
          await navigator.clipboard.writeText(value.text as string);
          reply('');
        } else {
          const text = await navigator.clipboard.readText();
          validateAppServiceText(text);
          reply(value.method === 'clipboard-has-strings' ? (text.length ? '1' : '0') : text);
        }
      } catch (error) {
        reply('', String(error).slice(0, 1024));
      }
    })().finally(() => {
      bytes -= held;
      pending.delete(task);
    });
    pending.add(task);
  };
  app.addEventListener('message', receive);
  return {
    async close() {
      stopped = true;
      await Promise.all(pending);
      app.removeEventListener('message', receive);
      tooltip?.remove();
      tooltip = undefined;
      if (pending.size || bytes) throw new Error('Browser App OS service bytes have not retired');
    },
    get execution() {
      return { pending: pending.size, bytes, stopped };
    },
  };
}
