// SPDX-License-Identifier: BSD-3-Clause
import { ViewRuntime } from '@nelyx/core/hosting/runtime';
export function installNativeUiaFocusProbe(ComponentsGallery: any) {
  const api = (globalThis as any).NelyxNativeHost,
    pump = ViewRuntime.prototype.pump;
  let view: any;
  ViewRuntime.prototype.pump = function () {
    view = this;
    ViewRuntime.prototype.pump = pump;
    return pump.call(this);
  };
  const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  async function until(test: () => boolean, message: string) {
    const deadline = api.now() + 10000;
    while (!test()) {
      if (api.now() > deadline) throw Error(message);
      await delay(32);
    }
  }
  void (async () => {
    await until(() => view?.status === 'open', 'Focus probe application did not start');
    api.diagnosticWindow('restore');
    let state: any;
    await until(() => {
      const pending = [view.controller.root];
      while (pending.length) {
        const element = pending.pop();
        if (element.widget instanceof ComponentsGallery) {
          state = element.state;
          return true;
        }
        pending.push(...element.children);
      }
      return false;
    }, 'Material gallery State missing');
    state.select('text');
    let editor: any;
    await until(() => {
      editor = view.controller.nodes.find(
        (node: any) => node.id === 'field-filled' && node.focusable && node.actions?.focus,
      );
      return !!editor;
    }, 'Focusable product editor did not materialize');
    editor.actions.focus();
    const expected = editor.id;
    await until(() => {
      const state = api.diagnosticState();
      return (
        state.foreground &&
        state.windowFocused &&
        state.providerFocusId === expected &&
        state.focusedIds.includes(expected)
      );
    }, 'Native provider focus disagrees with Core: ' + expected);
    const automationId = editor.semanticsIdentifier ?? editor.id;
    api.log(
      'NELYX_NATIVE_UIA_READY ' +
        JSON.stringify({ automationId, nodeId: expected, state: api.diagnosticState() }),
    );
    let samples = 0;
    const timer = setInterval(() => {
      api.log('NELYX_NATIVE_UIA_STATE ' + JSON.stringify(api.diagnosticState()));
      if (++samples === 30) clearInterval(timer);
    }, 200);
  })().catch((error) =>
    api.fail(error instanceof Error ? (error.stack ?? error.message) : String(error)),
  );
}
