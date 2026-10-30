// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { WindowsInputView } from '../../sdk/dist/platforms/windows/input-view.js';
import { NativeInteraction } from '../../sdk/dist/runtime/native-interaction.js';
import {
  windowsSurfaceEnvelope,
  windowsInputSurfaceId,
} from '../../sdk/dist/backends/react-native/windows-surface-envelope.js';
const timeout = 1_200_000;
test(
  'Windows input admits only the static SDK native envelope and preserves its exact Core owner identity',
  { timeout },
  () => {
    assert.equal(
      windowsSurfaceEnvelope({
        flex: 1,
        position: 'relative',
        paddingTop: 12,
        backgroundColor: '#fff',
      }),
      'nelyx:input-envelope:v1:visible',
    );
    assert.equal(
      windowsSurfaceEnvelope({ width: 120, height: 60, overflow: 'hidden' }),
      'nelyx:input-envelope:v1:clip',
    );
    assert.equal(
      windowsSurfaceEnvelope({ display: 'none', overflow: 'hidden' }),
      'nelyx:input-envelope:v1:hidden',
    );
    for (const style of [
      { transform: [] },
      { transform: 'identity' },
      { transformOrigin: 'center' },
      { borderRadius: 8 },
      { opacity: 0 },
      { overflow: 'scroll' },
      { filter: 'blur(1px)' },
      { unknownNativeEffect: true },
    ])
      assert.equal(
        windowsSurfaceEnvelope(style),
        undefined,
        'An unknown native effect cannot receive a layout-only mapping proof',
      );
    assert.equal(
      windowsInputSurfaceId({ id: 'field:한국어', generation: 7 }),
      'nelyx:input-skia:v1:7:field:한국어',
    );
  },
);
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
async function until(predicate) {
  for (let attempt = 0; attempt < 12 && !predicate(); attempt++)
    await new Promise((resolve) => setImmediate(resolve));
  assert(predicate(), 'Expected native lifecycle operation');
}
function fixture() {
  const owner = { id: 'windows-view', generation: 1 },
    interaction = new NativeInteraction(owner, {
      commands: true,
      selectionEvents: true,
      semantics: 'native-controls',
      nativeSnapshots: true,
      geometry: 'unavailable',
    }),
    calls = [],
    reports = [],
    events = new Set(),
    bindings = new Map();
  let next = 0,
    connectWait,
    openWait,
    configureWait,
    closeWait,
    disconnectWait;
  const module = {
    getInputProtocol: () => 3,
    insertText: async () => ({ status: 'unavailable', revision: 0 }),
    async connect(surface, value) {
      assert.equal(surface, 97);
      assert.deepEqual(value, owner);
      calls.push(['connect']);
      return connectWait ? await connectWait.promise : ++next;
    },
    async openClient(...args) {
      calls.push(['open', ...args]);
      return openWait ? await openWait.promise : true;
    },
    async configureClient(...args) {
      calls.push(['configure', ...args]);
      return configureWait ? await configureWait.promise : true;
    },
    async command(...args) {
      calls.push(['command', ...args]);
      return true;
    },
    async closeClient(...args) {
      calls.push(['close', ...args]);
      return closeWait ? await closeWait.promise : true;
    },
    async disconnect(...args) {
      calls.push(['disconnect', ...args]);
      return disconnectWait ? await disconnectWait.promise : true;
    },
  };
  function bind(
    id,
    {
      text = id,
      readOnly = false,
      obscureText = false,
      keyboardType = 'text',
      multiline = false,
    } = {},
  ) {
    const state = { enabled: true, focusable: true },
      changes = [],
      binding = interaction.editing.bind(
        owner,
        {
          session: owner,
          text,
          selection: { anchor: text.length, focus: 0 },
          revision: 0,
          source: 'programmatic',
          composing: { status: 'none' },
        },
        (value) => changes.push(value),
        {
          id,
          configuration: { readOnly, obscureText, keyboardType, multiline },
          readInputState: () => ({ ...state, label: id }),
        },
      );
    const entry = { binding, state, changes };
    bindings.set(id, entry);
    return entry;
  }
  return {
    interaction,
    calls,
    reports,
    events,
    module,
    bind,
    set connectWait(value) {
      connectWait = value;
    },
    set openWait(value) {
      openWait = value;
    },
    set configureWait(value) {
      configureWait = value;
    },
    set closeWait(value) {
      closeWait = value;
    },
    set disconnectWait(value) {
      disconnectWait = value;
    },
    start: () =>
      new WindowsInputView(
        interaction,
        module,
        {
          addListener(name, callback) {
            assert.equal(name, 'nelyxWindowsInput');
            events.add(callback);
            return { remove: () => events.delete(callback) };
          },
        },
        97,
        (error) => reports.push(error),
      ),
    async close() {
      for (const entry of bindings.values()) entry.binding.dispose();
      interaction.dispose();
    },
  };
}

test(
  'Windows View clients follow Core bindings and configure before delivering queued focus',
  { timeout },
  async () => {
    const f = fixture(),
      first = f.bind('first', { readOnly: true, keyboardType: 'email' });
    f.bind('second', { obscureText: true });
    first.binding.focus();
    const view = f.start();
    try {
      await view.ready;
      assert.equal(f.calls.filter((call) => call[0] === 'open').length, 2);
      assert.deepEqual(f.calls.find((call) => call[0] === 'configure').slice(3), [
        true,
        true,
        false,
        5,
      ]);
      assert.deepEqual(f.calls.findLast((call) => call[0] === 'configure').slice(3), [
        true,
        false,
        false,
        31,
      ]);
      const focus = f.calls.findIndex((call) => call[0] === 'command' && call[3] === 'focus'),
        configure = f.calls.findIndex((call) => call[0] === 'configure');
      assert(
        focus > configure,
        'OS configuration completes before a pending Core focus reaches the port',
      );
      assert.equal(f.reports.length, 0);
    } finally {
      await view.dispose();
      await f.close();
    }
  },
);
test(
  'a Windows keyboard lease requires the same immutable Core View owner and generation',
  { timeout },
  async () => {
    const f = fixture(),
      input = f.start();
    try {
      await input.ready;
      for (const owner of [
        { id: 'foreign', generation: 1 },
        { ...f.interaction.owner, generation: 2 },
      ])
        assert.throws(() => input.bindKeyboard({ owner }, () => 1), /Foreign Core View/);
      const view = {
        owner: f.interaction.owner,
        dispatchKey: () => false,
        dispatchKeyboardFocusGained() {},
        dispatchKeyboardFocusLost() {},
      };
      input.bindKeyboard(view, () => 1);
      assert.throws(() => input.bindKeyboard(view, () => 1), /owner unavailable/);
      assert.deepEqual(f.reports, []);
    } finally {
      await input.dispose();
      await f.close();
    }
  },
);

test(
  'removing or clipping semantics does not close an existing nonvisual Core input client',
  { timeout },
  async () => {
    const f = fixture();
    f.bind('field');
    const view = f.start();
    let semantics;
    try {
      await view.ready;
      semantics = f.interaction.semantics.bind([], () => {});
      await new Promise((resolve) => setImmediate(resolve));
      semantics.dispose();
      semantics = undefined;
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(f.calls.filter((call) => call[0] === 'open').length, 1);
      assert.equal(f.calls.filter((call) => call[0] === 'close').length, 0);
      assert.equal(f.reports.length, 0);
    } finally {
      semantics?.dispose();
      await view.dispose();
      await f.close();
    }
  },
);

test(
  'a reused editor id waits for native retirement before opening its replacement generation',
  { timeout },
  async () => {
    const f = fixture(),
      first = f.bind('field'),
      view = f.start();
    try {
      await view.ready;
      const close = deferred();
      f.closeWait = close;
      first.binding.dispose();
      f.bind('field', { text: 'replacement' });
      await until(() => f.calls.some((call) => call[0] === 'close'));
      assert.equal(f.calls.filter((call) => call[0] === 'open').length, 1);
      close.resolve(true);
      await until(() => f.calls.filter((call) => call[0] === 'open').length === 2);
      assert.equal(f.calls.findLast((call) => call[0] === 'open')[3].text, 'replacement');
      assert.equal(f.reports.length, 0);
    } finally {
      await view.dispose();
      await f.close();
    }
  },
);

test(
  'a Core client removed during native open never attaches focus and closes only that client',
  { timeout },
  async () => {
    const f = fixture(),
      field = f.bind('field'),
      open = deferred();
    f.openWait = open;
    const view = f.start();
    try {
      await until(() => f.calls.some((call) => call[0] === 'open'));
      field.binding.focus();
      field.binding.dispose();
      open.resolve(true);
      await view.ready;
      await until(() => f.calls.some((call) => call[0] === 'close'));
      assert.equal(f.calls.filter((call) => call[0] === 'close').length, 1);
      assert(!f.calls.some((call) => call[0] === 'command' && call[3] === 'focus'));
      assert.equal(f.reports.length, 0);
    } finally {
      await view.dispose();
      await f.close();
    }
  },
);

test(
  'live Core enablement changes configure the same native client without recreating its document',
  { timeout },
  async () => {
    const f = fixture(),
      field = f.bind('field', { keyboardType: 'phone' }),
      view = f.start();
    try {
      await view.ready;
      field.state.enabled = false;
      field.binding.updateGeometry(null);
      await until(() => f.calls.filter((call) => call[0] === 'configure').length === 2);
      assert.deepEqual(f.calls.findLast((call) => call[0] === 'configure').slice(3), [
        false,
        false,
        false,
        32,
      ]);
      assert.equal(f.calls.filter((call) => call[0] === 'open').length, 1);
      field.state.enabled = true;
      field.state.focusable = false;
      field.binding.updateGeometry(null);
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(
        f.calls.filter((call) => call[0] === 'configure').length,
        2,
        'The effective OS enablement is unchanged',
      );
      assert.equal(f.reports.length, 0);
    } finally {
      await view.dispose();
      await f.close();
    }
  },
);

test(
  'replacing a Core binding during initial configuration cannot attach the old writable port',
  { timeout },
  async () => {
    const f = fixture(),
      first = f.bind('field'),
      configure = deferred();
    f.configureWait = configure;
    first.binding.focus();
    const view = f.start();
    try {
      await until(() => f.calls.some((call) => call[0] === 'configure'));
      const old = f.calls.find((call) => call[0] === 'open')[2];
      first.binding.dispose();
      const replacement = f.bind('field', { text: 'readonly replacement', readOnly: true });
      replacement.binding.focus();
      configure.resolve(true);
      await view.ready;
      await until(() => f.calls.filter((call) => call[0] === 'open').length === 2);
      assert(
        !f.calls.some((call) => call[0] === 'command' && call[2] === old && call[3] === 'focus'),
      );
      assert(f.calls.some((call) => call[0] === 'close' && call[2] === old));
      assert.equal(f.calls.findLast((call) => call[0] === 'configure')[4], true);
      assert.equal(f.reports.length, 0);
    } finally {
      await view.dispose();
      await f.close();
    }
  },
);

test(
  'View disposal fences ingress immediately and waits for a native open and disconnect',
  { timeout },
  async () => {
    const f = fixture(),
      field = f.bind('field'),
      open = deferred();
    f.openWait = open;
    const view = f.start();
    try {
      await until(() => f.calls.some((call) => call[0] === 'open'));
      const disconnect = deferred();
      f.disconnectWait = disconnect;
      let retired = false;
      const closing = view.dispose().then(() => {
        retired = true;
      });
      assert.equal(f.events.size, 0);
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(retired, false);
      open.resolve(true);
      disconnect.resolve(true);
      await closing;
      await view.ready;
      assert.equal(retired, true);
      assert.equal(f.calls.filter((call) => call[0] === 'configure').length, 0);
      assert.equal(f.calls.filter((call) => call[0] === 'command').length, 0);
      assert.equal(field.changes.length, 0);
      assert.equal(f.reports.length, 0);
    } finally {
      await view.dispose();
      await f.close();
    }
  },
);

test(
  'a View retired while connecting waits for that native service and never opens a field',
  { timeout },
  async () => {
    const f = fixture();
    f.bind('field');
    const connect = deferred(),
      disconnect = deferred();
    f.connectWait = connect;
    f.disconnectWait = disconnect;
    const view = f.start();
    try {
      let retired = false;
      const closing = view.dispose().then(() => {
        retired = true;
      });
      connect.resolve(21);
      await until(() => f.calls.some((call) => call[0] === 'disconnect'));
      assert.equal(retired, false);
      assert(!f.calls.some((call) => call[0] === 'open'));
      disconnect.resolve(true);
      await closing;
      await view.ready;
      assert.equal(f.reports.length, 0);
    } finally {
      await view.dispose();
      await f.close();
    }
  },
);

test(
  'an initial native configuration failure reports once and cannot deliver pending focus',
  { timeout },
  async () => {
    const f = fixture(),
      field = f.bind('field');
    field.binding.focus();
    const configure = deferred();
    f.configureWait = configure;
    const view = f.start();
    try {
      await until(() => f.calls.some((call) => call[0] === 'configure'));
      configure.resolve(false);
      await assert.rejects(view.ready, /initial input configuration rejected/);
      await until(() => f.calls.some((call) => call[0] === 'disconnect'));
      assert.equal(f.reports.length, 1);
      assert(!f.calls.some((call) => call[0] === 'command' && call[3] === 'focus'));
    } finally {
      await view
        .dispose()
        .catch((error) => assert.match(String(error), /initial input configuration rejected/));
      await f.close();
    }
  },
);

test(
  'a failed native connection reports once, releases its reservation and leaves no retirement work',
  { timeout },
  async () => {
    const f = fixture();
    f.bind('field');
    const connect = deferred();
    f.connectWait = connect;
    const view = f.start();
    try {
      connect.reject(new Error('Native connect failed'));
      await assert.rejects(view.ready, /Native connect failed/);
      await view.dispose();
      assert.equal(f.reports.length, 1);
      assert.equal(f.calls.filter((call) => call[0] === 'disconnect').length, 0);
      f.connectWait = undefined;
      const replacement = f.start();
      try {
        await replacement.ready;
        assert.equal(f.calls.filter((call) => call[0] === 'open').length, 1);
      } finally {
        await replacement.dispose();
      }
    } finally {
      await view.dispose();
      await f.close();
    }
  },
);
