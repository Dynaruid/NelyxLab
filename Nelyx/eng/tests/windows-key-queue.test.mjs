// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { WindowsKeyQueue } from '../../sdk/dist/platforms/windows/key-queue.js';
import { nativeInputProps } from '../../sdk/dist/backends/react-native/input.js';
const timeout = 1_200_000,
  turn = () => new Promise((resolve) => setImmediate(resolve));
const defer = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const key = (sequence, extra = {}) => ({
  nativeEvent: {
    protocol: 1,
    sequence,
    viewGeneration: 7,
    kind: 'down',
    keyCode: 65,
    scanCode: 30,
    characterCodePoint: 97,
    modifiers: 0,
    repeat: false,
    repeatCount: 1,
    focusEpoch: 5,
    dead: false,
    capsLock: false,
    numLock: false,
    scrollLock: false,
    ...extra,
  },
});
function fixture(dispatch = () => false, before = async () => {}, after = async () => {}) {
  const calls = [],
    errors = [];
  let generation = 7;
  const view = {
    dispatchKey(event) {
      calls.push(event);
      return dispatch(event);
    },
    dispatchKeyboardFocusGained() {
      calls.push('focus');
    },
    dispatchKeyboardFocusLost() {
      calls.push('blur');
    },
  };
  const queue = new WindowsKeyQueue(
      view,
      () => generation,
      before,
      after,
      (error) => errors.push(error),
    ),
    props = nativeInputProps(
      'windows',
      () => view,
      undefined,
      () => generation,
    );
  return {
    queue,
    props,
    view,
    calls,
    errors,
    set generation(value) {
      generation = value;
    },
  };
}
test(
  'rapid Core shortcut, native text and following deletion are serialized through editing fences',
  { timeout },
  async () => {
    let text = 'seed',
      selection = [4, 4],
      receipt = Promise.resolve();
    const pending = [],
      observed = [],
      steps = [];
    const f = fixture(
      (event) => {
        steps.push(event.windows.keyCode);
        if (event.control && event.windows.keyCode === 65) {
          const next = defer();
          pending.push(() => {
            selection = [0, text.length];
            next.resolve();
          });
          receipt = next.promise;
          return true;
        }
        if (event.windows.keyCode === 8) {
          const next = defer();
          pending.push(() => {
            text = text.slice(0, selection[0] - 1) + text.slice(selection[1]);
            selection = [selection[0] - 1, selection[0] - 1];
            next.resolve();
          });
          receipt = next.promise;
          return true;
        }
        return false;
      },
      () => receipt,
      async (handled, value) => {
        await receipt;
        if (!handled && value !== null) {
          const next = defer();
          observed.push(() => {
            text = text.slice(0, selection[0]) + value + text.slice(selection[1]);
            selection = [selection[0] + value.length, selection[0] + value.length];
            next.resolve();
          });
          await next.promise;
        }
      },
    );
    try {
      f.props.onWindowsKey(key(1, { modifiers: 8, characterCodePoint: 1 }));
      f.props.onWindowsKey(key(2));
      f.props.onWindowsKey(key(3, { keyCode: 8, scanCode: 14, characterCodePoint: 0 }));
      await turn();
      assert.deepEqual(steps, [65]);
      pending.shift()();
      await turn();
      assert.deepEqual(steps, [65, 65]);
      assert.equal(text, 'seed');
      assert.equal(observed.length, 1);
      observed.shift()();
      await turn();
      assert.deepEqual(steps, [65, 65, 8]);
      assert.equal(text, 'a');
      pending.shift()();
      await turn();
      assert.equal(text, '');
      assert.deepEqual(f.errors, []);
    } finally {
      f.queue.dispose();
    }
  },
);
test(
  'queued packets snapshot pooled payloads, preserve focus/key order and stop at the native generation fence',
  { timeout },
  async () => {
    const gate = defer(),
      after = [];
    const f = fixture(
      () => false,
      () => gate.promise,
      async (...args) => {
        after.push(args);
      },
    );
    try {
      f.props.onWindowsKeyboardFocus({
        nativeEvent: { protocol: 1, sequence: 1, viewGeneration: 7, focused: true },
      });
      const packet = key(2);
      f.props.onWindowsKey(packet);
      packet.nativeEvent.characterCodePoint = 122;
      f.props.onWindowsKey(key(3, { kind: 'up', characterCodePoint: 0 }));
      gate.resolve();
      await turn();
      assert.equal(f.calls[0], 'focus');
      assert.equal(f.calls[1].character, 'a');
      assert.equal(f.calls[2].kind, 'up');
      assert.deepEqual(after, [
        [true, null],
        [false, 'a', 5],
        [false, null],
      ]);
      f.props.onWindowsKey(key(4));
      f.generation = 8;
      await turn();
      assert.equal(f.calls.length, 3);
      assert.deepEqual(f.errors, []);
    } finally {
      f.queue.dispose();
    }
  },
);
test(
  'only observed printable non-system characters reach native text, including AltGr and repeat counts',
  { timeout },
  async () => {
    const text = [],
      f = fixture(
        () => false,
        async () => {},
        async (handled, value) => {
          if (!handled && value !== null) text.push(value);
        },
      );
    try {
      let sequence = 0;
      for (const fields of [
        { dead: true },
        { characterCodePoint: 13 },
        { characterCodePoint: 0x7f },
        { modifiers: 64 },
        { modifiers: 1536 },
        { modifiers: 72, characterCodePoint: 0x20ac },
        { repeat: true, repeatCount: 3, characterCodePoint: 0x1f600 },
      ])
        f.props.onWindowsKey(key(++sequence, fields));
      await turn();
      assert.deepEqual(text, ['€', '😀😀😀']);
      assert.deepEqual(f.errors, []);
    } finally {
      f.queue.dispose();
    }
  },
);
test(
  'a retired queue releases its unique route and cannot write after a pending key fence',
  { timeout },
  async () => {
    const gate = defer(),
      after = [],
      f = fixture(
        () => false,
        () => gate.promise,
        async (...args) => after.push(args),
      );
    assert.throws(
      () =>
        new WindowsKeyQueue(
          f.view,
          () => 7,
          async () => {},
          async () => {},
          () => {},
        ),
      /already owned/,
    );
    f.props.onWindowsKey(key(1));
    f.queue.dispose();
    f.props.onWindowsKey(key(2));
    gate.resolve();
    await turn();
    assert.deepEqual(f.calls, []);
    assert.deepEqual(after, []);
    assert.deepEqual(f.errors, []);
    const replacement = new WindowsKeyQueue(
      f.view,
      () => 7,
      async () => {},
      async () => {},
      (error) => f.errors.push(error),
    );
    try {
      f.props.onWindowsKey(key(3));
      await turn();
      assert.equal(f.calls.length, 1);
      assert.deepEqual(f.errors, []);
    } finally {
      replacement.dispose();
    }
  },
);
test(
  'invalid packets fail once before Core dispatch and cannot become printable text',
  { timeout },
  async () => {
    const after = [],
      f = fixture(
        () => false,
        async () => {},
        async (...args) => after.push(args),
      );
    try {
      f.props.onWindowsKey(key(1, { repeatCount: 65536 }));
      f.props.onWindowsKey(key(2));
      await turn();
      assert.equal(f.errors.length, 1);
      assert.deepEqual(f.calls, []);
      assert.deepEqual(after, []);
    } finally {
      f.queue.dispose();
    }
  },
);
test(
  'a blocked native editing fence cannot accumulate an unbounded key queue',
  { timeout },
  async () => {
    const gate = defer(),
      f = fixture(
        () => false,
        () => gate.promise,
      );
    try {
      for (let sequence = 1; sequence <= 258; sequence++) f.props.onWindowsKey(key(sequence));
      assert.equal(f.errors.length, 1);
      assert.match(String(f.errors[0]), /capacity/);
      gate.resolve();
      await turn();
      assert.deepEqual(f.calls, []);
    } finally {
      f.queue.dispose();
    }
  },
);
test(
  'standalone text shares the native sequence and editing fence without a synthetic key',
  { timeout },
  async () => {
    const gate = defer(),
      written = [],
      f = fixture(
        () => false,
        async () => {},
        async (handled, text, epoch) => {
          if (text !== null) {
            written.push([text, epoch]);
            await gate.promise;
          }
        },
      );
    try {
      const packet = {
        nativeEvent: {
          protocol: 1,
          sequence: 1,
          viewGeneration: 7,
          characterCodePoint: 0x1f600,
          repeatCount: 2,
          focusEpoch: 9,
        },
      };
      f.props.onWindowsText(packet);
      packet.nativeEvent.characterCodePoint = 97;
      f.props.onWindowsKey(key(2, { kind: 'up', characterCodePoint: 0 }));
      await turn();
      assert.deepEqual(written, [['😀😀', 9]]);
      assert.deepEqual(f.calls, []);
      gate.resolve();
      await turn();
      assert.equal(f.calls.length, 1);
      assert.equal(f.calls[0].kind, 'up');
      f.props.onWindowsText({ nativeEvent: { ...packet.nativeEvent, sequence: 1 } });
      await turn();
      assert.equal(written.length, 1);
      assert.deepEqual(f.errors, []);
    } finally {
      f.queue.dispose();
    }
  },
);
test(
  'unowned text and a printable key without TSF character proof cannot write',
  { timeout },
  async () => {
    for (const standalone of [false, true]) {
      const text = [],
        f = fixture(
          () => false,
          async () => {},
          async (handled, value) => text.push(value),
        );
      try {
        if (standalone)
          f.props.onWindowsText({
            nativeEvent: {
              protocol: 1,
              sequence: 1,
              viewGeneration: 7,
              characterCodePoint: 97,
              repeatCount: 1,
              focusEpoch: 0,
            },
          });
        else f.props.onWindowsKey(key(1, { focusEpoch: 0 }));
        await turn();
        assert.equal(f.errors.length, 1);
        assert.deepEqual(text, []);
      } finally {
        f.queue.dispose();
      }
    }
  },
);
