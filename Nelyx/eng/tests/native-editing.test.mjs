// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import assert from 'node:assert/strict';
import { NativeInteraction } from '../../sdk/dist/runtime/native-interaction.js';
import { TextEditingController, EditableText } from '@nelyx/core/framework/widgets/editable-text';
import { SizedBox, Column, Transform } from '@nelyx/core/framework/widgets/basic';
import { RenderTransform } from '@nelyx/core/framework/rendering/boxes';
import { TextPosition } from '@nelyx/core/ui/text-position';
import { RenderEditable } from '@nelyx/core/framework/rendering/editable';
import { engineFixture } from '../../../packages/material/tests/engine-fixture.mjs';
import { FlutterError } from '@nelyx/core/foundation/flutter-error';
import { freezeTextInputGeometry } from '@nelyx/core/ui/editing';
const timeout = 1_200_000;
FoundationPlatform.configure({ kind: 'native', operatingSystem: 'android' });

test(
  'SDK reuses captured Core geometry and recaptures reused mutable caller packets',
  { timeout },
  () => {
    const owner = { id: 'geometry-capture', generation: 1 },
      interaction = new NativeInteraction(owner, {
        commands: true,
        selectionEvents: true,
        semantics: 'native-controls',
        nativeSnapshots: true,
      });
    const binding = interaction.editing.bind(
      owner,
      {
        session: owner,
        text: '',
        selection: { anchor: 0, focus: 0 },
        composing: { status: 'none' },
        revision: 0,
        source: 'programmatic',
      },
      () => {},
      { id: 'field' },
    );
    const packet = {
      coordinates: 'view-logical',
      owner,
      viewportGeneration: 1,
      layoutEpoch: 1,
      scale: 1,
      transform: [1, 0, 0, 1, 0, 0],
      bounds: { x: 0, y: 0, width: 80, height: 20 },
      clip: { x: 0, y: 0, width: 80, height: 20 },
      caret: { x: 0, y: 0, width: 1, height: 20 },
      caretBaseline: { x: 0, y: 15 },
      selectionRects: [],
    };
    try {
      binding.updateGeometry(packet);
      const first = interaction.editorInputBounds('field');
      assert.notEqual(first, packet.bounds);
      packet.bounds.x = 12;
      packet.layoutEpoch = 2;
      binding.updateGeometry(packet);
      assert.equal(first.x, 0);
      assert.equal(
        interaction.editorInputBounds('field').x,
        12,
        'Reference reuse does not make a mutable packet current',
      );
      const captured = freezeTextInputGeometry(packet);
      assert.equal(freezeTextInputGeometry(captured), captured);
      binding.updateGeometry(captured);
      assert.equal(
        interaction.editorInputBounds('field'),
        captured.bounds,
        'The SDK must reuse validated immutable rectangle identities',
      );
      const external = Object.freeze({ ...packet, bounds: { ...packet.bounds, width: -1 } });
      assert.throws(() => binding.updateGeometry(external));
      assert.equal(interaction.editorInputBounds('field'), captured.bounds);
      binding.updateGeometry(null);
    } finally {
      binding.dispose();
      interaction.dispose();
    }
  },
);

test(
  'native carrier reattachment preserves the focus origin and marks replay as restoration',
  { timeout },
  () => {
    const owner = { id: 'focus-order', generation: 1 },
      interaction = new NativeInteraction(owner, {
        commands: true,
        selectionEvents: true,
        semantics: 'native-controls',
        nativeSnapshots: true,
      }),
      requests = [];
    const binding = interaction.editing.bind(
      owner,
      {
        session: owner,
        text: 'value',
        selection: { anchor: 5, focus: 5 },
        composing: { status: 'none' },
        revision: 0,
        source: 'programmatic',
      },
      () => {},
      { id: 'field' },
    );
    const port = {
        replace() {},
        focus(request) {
          requests.push(request);
        },
        blur() {},
      },
      token = {};
    let detach;
    try {
      binding.focus({ inputTimestamp: 41 });
      detach = interaction.attachEditor('field', token, port);
      assert.deepEqual(
        requests,
        [{ inputTimestamp: 41 }],
        'The first native delivery keeps the original request rather than marking it as a replay',
      );
      interaction.observeSnapshot(token, {
        text: 'value',
        anchor: 5,
        focus: 5,
        revision: 1,
        source: 'native',
        composingStart: -1,
        composingEnd: -1,
        focused: true,
      });
      detach();
      detach = interaction.attachEditor('field', {}, port);
      assert.deepEqual(requests.at(-1), { inputTimestamp: 41, restore: true });
      binding.focus();
      assert.equal(requests.at(-1), undefined);
      detach();
      detach = interaction.attachEditor('field', {}, port);
      assert.deepEqual(requests.at(-1), { restore: true });
      binding.blur();
      detach();
      detach = interaction.attachEditor('field', {}, port);
      assert.equal(requests.length, 4, 'Blur removes the replay intent');
    } finally {
      binding.dispose();
      detach?.();
      interaction.dispose();
    }
  },
);

test(
  'a programmatic focus requested before carrier attachment is delivered once as explicit intent',
  { timeout },
  () => {
    const owner = { id: 'first-focus', generation: 1 },
      interaction = new NativeInteraction(owner, {
        commands: true,
        selectionEvents: true,
        semantics: 'native-controls',
        nativeSnapshots: true,
      }),
      requests = [];
    const binding = interaction.editing.bind(
        owner,
        {
          session: owner,
          text: '',
          selection: { anchor: 0, focus: 0 },
          composing: { status: 'none' },
          revision: 0,
          source: 'programmatic',
        },
        () => {},
        { id: 'field' },
      ),
      port = {
        replace() {},
        focus(request) {
          requests.push(request);
        },
        blur() {},
      };
    let detach;
    try {
      binding.focus();
      detach = interaction.attachEditor('field', {}, port);
      assert.equal(requests.length, 1);
      assert.equal(
        requests[0],
        undefined,
        'An unseen explicit request must be admitted on the first native carrier',
      );
      detach();
      detach = interaction.attachEditor('field', {}, port);
      assert.deepEqual(
        requests.at(-1),
        { restore: true },
        'A later carrier replays the same admitted intent',
      );
    } finally {
      binding.dispose();
      detach?.();
      interaction.dispose();
    }
  },
);

test(
  'an observed native selection replacement preserves composition and retries only unchanged metadata races',
  { timeout },
  () => {
    const owner = { id: 'active-selection', generation: 1 },
      interaction = new NativeInteraction(owner, {
        commands: true,
        selectionEvents: true,
        semantics: 'native-controls',
        nativeSnapshots: true,
      }),
      commands = [],
      changes = [],
      token = {};
    const binding = interaction.editing.bind(
        owner,
        {
          session: owner,
          text: '한A',
          selection: { anchor: 1, focus: 1 },
          composing: { status: 'unavailable' },
          revision: 0,
          source: 'programmatic',
        },
        (value) => changes.push(value),
        { id: 'field' },
      ),
      detach = interaction.attachEditor('field', token, {
        replace(...args) {
          commands.push(args);
        },
        focus() {},
        blur() {},
      });
    const snapshot = (revision, anchor, focus, extra = {}) =>
      interaction.observeSnapshot(token, {
        revision,
        text: '한A',
        anchor,
        focus,
        composingStart: 0,
        composingEnd: 1,
        source: 'native',
        ...extra,
      });
    try {
      snapshot(1, 1, 1);
      binding.replace(
        { ...binding.read(), selection: { anchor: 1, focus: 0 }, source: 'programmatic' },
        81,
      );
      assert.deepEqual(commands.at(-1), ['한A', { start: 1, end: 0 }, 1, 81]);
      snapshot(2, 1, 0, { source: 'programmatic', request: 81 });
      assert.deepEqual(binding.read().composing, { status: 'active', start: 0, end: 1 });
      assert.equal(changes.at(-1).source, 'programmatic');
      binding.replace(
        { ...binding.read(), selection: { anchor: 0, focus: 0 }, source: 'programmatic' },
        82,
      );
      snapshot(3, 1, 0, { request: 82, rejection: 'stale' });
      assert.equal(commands.length, 3);
      assert.equal(commands.at(-1)[2], 3);
      snapshot(4, 0, 0, { request: 82, source: 'programmatic' });
      assert.deepEqual(binding.read().selection, { anchor: 0, focus: 0 });
      assert.equal(binding.read().composing.status, 'active');
      assert.throws(
        () => binding.replace({ ...binding.read(), text: 'different' }, 83),
        /composition is active/,
      );
    } finally {
      binding.dispose();
      detach();
      interaction.dispose();
    }
  },
);

test(
  'native metadata is not another edit; negative acknowledgements retain request identity and bounded retries',
  { timeout },
  async () => {
    const owner = { id: 'synchronization', generation: 1 },
      interaction = new NativeInteraction(owner, {
        commands: true,
        selectionEvents: true,
        semantics: 'native-controls',
        nativeSnapshots: true,
      }),
      changed = [],
      rejected = [],
      commands = [],
      token = {};
    const initial = {
      session: owner,
      text: 'word',
      selection: { anchor: 4, focus: 4 },
      composing: { status: 'none' },
      revision: 0,
      source: 'programmatic',
    };
    const binding = interaction.editing.bind(owner, initial, (value) => changed.push(value), {
        id: 'field',
        synchronizationRejected: (...args) => rejected.push(args),
      }),
      detach = interaction.attachEditor('field', token, {
        replace(...args) {
          commands.push(args);
        },
        replaceComposing(...args) {
          commands.push(args);
        },
        focus() {},
        blur() {},
      });
    const observe = (revision, text = 'word', extra = {}) =>
      interaction.observeSnapshot(token, {
        revision,
        text,
        anchor: text.length,
        focus: text.length,
        composingStart: -1,
        composingEnd: -1,
        source: 'native',
        ...extra,
      });
    try {
      observe(1);
      binding.replace({ ...binding.read(), text: 'Core' }, 41);
      for (let revision = 2; revision <= 5; revision++)
        observe(revision, 'word', { request: 41, rejection: 'stale' });
      assert.equal(commands.length, 4);
      assert(commands.every((command) => command[3] === 41));
      assert.deepEqual(rejected, [[41, 'retry-limit']]);
      assert.deepEqual(
        changed,
        [],
        'Unchanged rejected snapshots never overwrite accepted Core text',
      );
      binding.replace({ ...binding.read(), text: 'new Core' }, 42);
      observe(6, 'user');
      observe(7, 'user', { request: 42, rejection: 'stale' });
      assert.deepEqual(
        changed.map((value) => value.text),
        ['user'],
      );
      assert.deepEqual(rejected.at(-1), [42, 'stale']);
      binding.replace({ ...binding.read(), text: 'final', selection: { anchor: 5, focus: 5 } }, 43);
      observe(8, 'user', { request: 42, rejection: 'stale' });
      assert.equal(rejected.length, 2, 'An older receipt cannot reject the new request');
      observe(9, 'final', { request: 43, source: 'programmatic' });
      assert.equal(changed.at(-1).text, 'final');
      assert.throws(() => binding.replace(binding.read(), NaN), /synchronization request/);
      assert.throws(() => observe(10, 'final', { request: -1 }), /synchronization request/);
    } finally {
      detach();
      binding.dispose();
      interaction.dispose();
    }
  },
);

test(
  'Core synchronization survives native input races and reports failed cancellation without completing it',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController('word'),
      interaction = new NativeInteraction(f.root.context.owner, {
        commands: true,
        selectionEvents: true,
        semantics: 'native-controls',
        nativeSnapshots: true,
      }),
      commands = [],
      token = {},
      reports = [];
    const previousReport = f.root.context.reportError,
      previousFlutterError = FlutterError.onError;
    let detach;
    const observe = (revision, text, extra = {}) =>
      interaction.observeSnapshot(token, {
        revision,
        text,
        anchor: text.length,
        focus: text.length,
        composingStart: -1,
        composingEnd: -1,
        source: 'native',
        ...extra,
      });
    try {
      f.root.context.editing = interaction.editing;
      f.set(new EditableText('field', controller, 'Name'));
      detach = interaction.attachEditor('field', token, {
        replace(...args) {
          commands.push(args);
        },
        replaceComposing(...args) {
          commands.push(args);
        },
        focus() {},
        blur() {},
      });
      observe(1, 'word');
      controller.text = 'Core';
      const first = commands.at(-1)[3];
      observe(2, 'word');
      assert.equal(controller.text, 'Core', 'A metadata echo cannot roll Core back');
      observe(3, 'user');
      assert.equal(controller.text, 'user');
      observe(4, 'user', { request: first, rejection: 'stale' });
      await Promise.resolve();
      assert.equal(commands.length, 1, 'Already-current user input requires no replacement write');
      controller.text = 'next';
      const second = commands.at(-1)[3];
      observe(5, 'next', { request: second, source: 'programmatic' });
      observe(6, 'next', { composingStart: 0, composingEnd: 4 });
      let completed = 0;
      controller.clear(() => completed++);
      const cancellation = commands.at(-1)[3];
      f.root.context.reportError = (details) => reports.push(details);
      FlutterError.onError = () => {};
      observe(7, 'next', {
        request: cancellation,
        rejection: 'composing',
        composingStart: 0,
        composingEnd: 4,
      });
      assert.equal(completed, 0);
      assert.equal(controller.text, 'next');
      assert(controller.isComposing);
      assert.equal(reports.length, 1);
      assert(String(reports[0].exception).includes('synchronization rejected: composing'));
      observe(8, 'next');
      controller.clear(() => completed++);
      const recovery = commands.at(-1)[3];
      assert.notEqual(recovery, cancellation);
      assert.equal(controller.text, '');
      assert.equal(completed, 1);
      observe(9, 'next', { request: cancellation, rejection: 'stale' });
      observe(10, '', { request: recovery, source: 'programmatic' });
      assert.equal(controller.text, '');
      assert.equal(completed, 1);
      assert.equal(reports.length, 1);
      f.frame();
    } finally {
      f.root.context.reportError = previousReport;
      FlutterError.onError = previousFlutterError;
      detach?.();
      await f.close();
      interaction.dispose();
      controller.dispose();
    }
  },
);

test(
  'an observed host without cancellation preserves active composition and applies ordinary clear after commit',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController('word'),
      interaction = new NativeInteraction(f.root.context.owner, {
        commands: true,
        selectionEvents: true,
        semantics: 'native-controls',
        nativeSnapshots: true,
        compositionReplacement: false,
        geometry: 'unavailable',
      }),
      token = {},
      commands = [];
    let detach,
      completed = 0;
    try {
      f.root.context.editing = interaction.editing;
      f.set(new EditableText('field', controller, 'Name'));
      detach = interaction.attachEditor('field', token, {
        replace(...args) {
          commands.push(args);
        },
        focus() {},
        blur() {},
      });
      assert.equal(interaction.editing.capabilities.composing, 'observed');
      assert.equal(interaction.editing.capabilities.geometry, 'unavailable');
      interaction.observeSnapshot(token, {
        revision: 1,
        text: 'word',
        anchor: 4,
        focus: 4,
        composingStart: 0,
        composingEnd: 4,
        source: 'native',
      });
      assert.throws(() => controller.clear(() => completed++), /compos/i);
      assert.equal(commands.length, 0);
      assert.equal(controller.text, 'word');
      assert.throws(
        () =>
          interaction.observeSnapshot(token, {
            revision: 2,
            text: 'word',
            anchor: 4,
            focus: 4,
            composingStart: -1,
            composingEnd: -1,
            source: 'native',
            geometry: {
              width: 100,
              height: 20,
              caret: { x: 10, y: 0, width: 1, height: 20 },
              selectionRects: [],
            },
          }),
        /geometry is unavailable/,
      );
      interaction.observeSnapshot(token, {
        revision: 2,
        text: 'word',
        anchor: 4,
        focus: 4,
        composingStart: -1,
        composingEnd: -1,
        source: 'native',
      });
      controller.clear(() => completed++);
      assert.deepEqual(commands[0].slice(0, 3), ['', { start: 0, end: 0 }, 2]);
      assert(Number.isSafeInteger(commands[0][3]));
      assert.equal(controller.text, '');
      assert.equal(completed, 1, 'An ordinary Core command does not wait for OS synchronization');
      interaction.observeSnapshot(token, {
        revision: 3,
        text: '',
        anchor: 0,
        focus: 0,
        composingStart: -1,
        composingEnd: -1,
        source: 'programmatic',
      });
      assert.equal(controller.text, '');
      assert.equal(completed, 1);
    } finally {
      detach?.();
      await f.close();
      interaction.dispose();
      controller.dispose();
    }
  },
);

test(
  'Core completion can unmount and dispose its editor before OS synchronization without notifying a retired controller',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController('word'),
      interaction = new NativeInteraction(f.root.context.owner, {
        commands: true,
        selectionEvents: true,
        semantics: 'native-controls',
        nativeSnapshots: true,
      });
    f.root.context.editing = interaction.editing;
    const token = {};
    let detach,
      notifications = 0;
    try {
      f.set(new EditableText('field', controller, 'Name'));
      detach = interaction.attachEditor('field', token, {
        replace() {},
        replaceComposing() {},
        focus() {},
        blur() {},
      });
      controller.addListener(() => notifications++);
      controller.clear(() => {
        f.set(new SizedBox());
        controller.dispose();
      });
      interaction.observeSnapshot(token, {
        revision: 1,
        text: '',
        anchor: 0,
        focus: 0,
        composingStart: -1,
        composingEnd: -1,
        source: 'programmatic',
      });
      assert.equal(notifications, 0);
      assert.throws(() => controller.addListener(() => {}), /dispose/);
    } finally {
      detach?.();
      await f.close();
      interaction.dispose();
      controller.dispose();
    }
  },
);

test(
  'a replacement native port restores its live editor focus intent and retires old tokens',
  { timeout },
  async () => {
    const owner = { id: 'focus-port', generation: 1 },
      interaction = new NativeInteraction(owner, {
        commands: true,
        selectionEvents: true,
        semantics: 'native-controls',
        nativeSnapshots: true,
      });
    const binding = interaction.editing.bind(
        owner,
        {
          session: owner,
          text: '',
          selection: { anchor: 0, focus: 0 },
          composing: { status: 'none' },
          source: 'programmatic',
          revision: 0,
        },
        () => {},
        { id: 'field' },
      ),
      calls = [];
    const port = (id) => ({
        replace() {},
        replaceComposing() {},
        focus() {
          calls.push('focus ' + id);
        },
        blur() {
          calls.push('blur ' + id);
        },
      }),
      first = {},
      second = {},
      third = {};
    let detach = interaction.attachEditor('field', first, port('first'));
    try {
      binding.focus();
      assert.deepEqual(calls, ['focus first']);
      detach();
      detach = interaction.attachEditor('field', second, port('second'));
      assert.deepEqual(calls, ['focus first', 'focus second']);
      assert.equal(
        interaction.observeSnapshot(first, {
          revision: 1,
          text: '',
          anchor: 0,
          focus: 0,
          composingStart: -1,
          composingEnd: -1,
          source: 'native',
          focused: false,
        }),
        false,
      );
      binding.blur();
      detach();
      detach = interaction.attachEditor('field', third, port('third'));
      assert.deepEqual(calls, ['focus first', 'focus second', 'blur second']);
      interaction.observeSnapshot(third, {
        revision: 1,
        text: '',
        anchor: 0,
        focus: 0,
        composingStart: -1,
        composingEnd: -1,
        source: 'native',
        focused: true,
      });
      detach();
      detach = interaction.attachEditor('field', {}, port('fourth'));
      assert.equal(
        calls.at(-1),
        'focus fourth',
        'Observed user focus also survives native control replacement',
      );
    } finally {
      detach();
      binding.dispose();
      interaction.dispose();
    }
  },
);

test(
  'Core Undo/Redo/reset apply synchronously and actual native selection changes preserve current Core history',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController(),
      interaction = new NativeInteraction(f.root.context.owner, {
        commands: true,
        selectionEvents: true,
        semantics: 'native-controls',
        nativeSnapshots: true,
      }),
      commands = [];
    f.root.context.editing = interaction.editing;
    const token = {};
    let detach;
    const observe = (revision, text, anchor, focus, source = 'native') =>
      interaction.observeSnapshot(token, {
        revision,
        text,
        anchor,
        focus,
        source,
        composingStart: -1,
        composingEnd: -1,
      });
    try {
      f.set(new EditableText('field', controller, 'Name'));
      detach = interaction.attachEditor('field', token, {
        replace(...args) {
          commands.push(args);
        },
        replaceComposing(...args) {
          commands.push(args);
        },
        focus() {},
        blur() {},
      });
      observe(1, 'word', 4, 4);
      assert(controller.canUndo);
      assert(controller.undo());
      assert.equal(controller.canUndo, false);
      assert.equal(commands.length, 1);
      observe(2, 'word', 0, 4);
      assert.equal(
        controller.canUndo,
        true,
        'A superseded Undo releases its pending history owner',
      );
      assert.equal(controller.text, 'word');
      assert.deepEqual(controller.selection, { anchor: 0, focus: 4 });
      assert(controller.undo());
      observe(3, '', 0, 0, 'programmatic');
      assert.equal(controller.text, '');
      assert.equal(controller.canRedo, true);
      assert.equal(controller.canUndo, false);
      assert(controller.redo());
      observe(4, 'word', 0, 4, 'programmatic');
      assert(controller.canUndo);
      assert.deepEqual(
        controller.selection,
        { anchor: 0, focus: 4 },
        'Redo retains the actual saved directional selection',
      );
      let applied = 0;
      controller.reset('word', () => applied++);
      assert.equal(applied, 1);
      observe(5, 'word', 0, 4);
      assert.equal(applied, 1);
      assert.equal(
        controller.canUndo,
        false,
        'A native selection change cannot restore history already reset by Core',
      );
      controller.reset('word', () => applied++);
      observe(6, 'word', 4, 4, 'programmatic');
      assert.equal(applied, 2);
      assert.equal(controller.canUndo, false);
      assert.equal(controller.canRedo, false);
    } finally {
      detach?.();
      await f.close();
      interaction.dispose();
      controller.dispose();
    }
  },
);

test(
  'actual Core Next/Done ignores late unfocused geometry and follows native focus transitions',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      name = new TextEditingController(),
      email = new TextEditingController(),
      commands = [];
    const interaction = new NativeInteraction(f.root.context.owner, {
      commands: true,
      selectionEvents: true,
      semantics: 'native-controls',
      nativeSnapshots: true,
    });
    f.root.context.editing = interaction.editing;
    const nameToken = {},
      emailToken = {};
    let detachName, detachEmail;
    const observe = (token, revision, focused, action) =>
      interaction.observeSnapshot(token, {
        revision,
        text: '',
        anchor: 0,
        focus: 0,
        composingStart: -1,
        composingEnd: -1,
        source: 'native',
        focused,
        ...(action ? { action } : {}),
      });
    try {
      f.set(
        new Column([
          new EditableText('name', name, 'Name', undefined, 48, null, { action: 'next' }),
          new EditableText('email', email, 'Email', undefined, 48, null, { action: 'done' }),
        ]),
      );
      const port = (id) => ({
        replace() {},
        replaceComposing() {},
        focus() {
          commands.push(['focus', id]);
        },
        blur() {
          commands.push(['blur', id]);
        },
      });
      detachName = interaction.attachEditor('name', nameToken, port('name'));
      detachEmail = interaction.attachEditor('email', emailToken, port('email'));
      observe(nameToken, 1, true);
      observe(nameToken, 2, true, 'next');
      await Promise.resolve();
      const target = f.root.buildOwner.focus.primaryFocus;
      assert.deepEqual(commands.at(-1), ['focus', 'email']);
      observe(emailToken, 1, false);
      assert.equal(
        f.root.buildOwner.focus.primaryFocus,
        target,
        'Initial false geometry cannot reject the pending Next focus',
      );
      observe(emailToken, 2, true);
      observe(nameToken, 3, false);
      assert.equal(f.root.buildOwner.focus.primaryFocus, target);
      observe(emailToken, 3, true, 'done');
      await Promise.resolve();
      assert.notEqual(f.root.buildOwner.focus.primaryFocus, target);
      assert.deepEqual(commands.at(-1), ['blur', 'email']);
      observe(emailToken, 4, true);
      assert.notEqual(
        f.root.buildOwner.focus.primaryFocus,
        target,
        'Repeated true geometry cannot refocus the completed editor',
      );
      observe(emailToken, 5, false);
    } finally {
      detachName?.();
      detachEmail?.();
      await f.close();
      interaction.dispose();
      name.dispose();
      email.dispose();
    }
  },
);

test(
  'Core composition replacement requires a capable host and waits for its authoritative acknowledgement',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController('word'),
      commands = [];
    const interaction = new NativeInteraction(f.root.context.owner, {
      commands: true,
      selectionEvents: true,
      semantics: 'native-controls',
      nativeSnapshots: true,
    });
    f.root.context.editing = interaction.editing;
    let detach;
    const token = {},
      observe = (revision, text, composingStart = -1, rejection) =>
        interaction.observeSnapshot(token, {
          revision,
          text,
          anchor: text.length,
          focus: text.length,
          composingStart,
          composingEnd: composingStart < 0 ? -1 : text.length,
          source: revision === 3 ? 'programmatic' : 'native',
          ...(rejection ? { rejection } : {}),
        });
    try {
      f.set(new EditableText('field', controller, 'Name'));
      detach = interaction.attachEditor('field', token, {
        replace(...args) {
          commands.push(['replace', ...args]);
        },
        replaceComposing(...args) {
          commands.push(['cancel', ...args]);
        },
        focus() {},
        blur() {},
      });
      assert(observe(1, 'word', 0));
      assert(controller.isComposing);
      controller.clear();
      assert.deepEqual(commands[0].slice(0, 4), ['cancel', '', { start: 0, end: 0 }, 1]);
      assert(Number.isSafeInteger(commands[0][4]));
      assert.equal(controller.text, 'word');
      assert(controller.isComposing, 'A sent command is not an acknowledgement');
      assert(observe(2, 'word', 0, 'stale'));
      assert.equal(controller.text, 'word');
      assert(controller.isComposing);
      assert.equal(commands.length, 2);
      assert.equal(
        commands.at(-1)[3],
        2,
        'An unchanged rejected value retries with the observed revision',
      );
      controller.clear();
      assert.equal(commands.at(-1)[3], 2);
      assert(observe(3, ''));
      assert.equal(controller.text, '');
      assert.equal(controller.isComposing, false);
      f.set(new SizedBox());
      assert.equal(observe(4, 'late'), false);
      assert.equal(controller.text, '');
    } finally {
      detach?.();
      await f.close();
      interaction.dispose();
      controller.dispose();
    }
  },
);

test(
  'observed replacement retries are bounded and never overwrite intervening native text or selection',
  { timeout },
  async () => {
    const owner = { id: 'retry', generation: 1 },
      interaction = new NativeInteraction(owner, {
        commands: true,
        selectionEvents: true,
        semantics: 'native-controls',
        nativeSnapshots: true,
      }),
      commands = [],
      changed = [];
    const initial = {
      text: 'word',
      selection: { anchor: 4, focus: 4 },
      composing: { status: 'none' },
      revision: 0,
      source: 'programmatic',
      session: owner,
    };
    const binding = interaction.editing.bind(owner, initial, (value) => changed.push(value), {
        id: 'field',
      }),
      token = {};
    const detach = interaction.attachEditor('field', token, {
      replace(...args) {
        commands.push(args);
      },
      replaceComposing(...args) {
        commands.push(args);
      },
      focus() {},
      blur() {},
    });
    const observe = (
      revision,
      { text = 'word', anchor = text.length, focus = anchor, rejection = 'stale' } = {},
    ) =>
      interaction.observeSnapshot(token, {
        revision,
        text,
        anchor,
        focus,
        composingStart: -1,
        composingEnd: -1,
        source: 'native',
        rejection,
      });
    try {
      observe(1, { rejection: undefined });
      binding.replaceComposing({ ...binding.read(), text: '', selection: { anchor: 0, focus: 0 } });
      for (let revision = 2; revision <= 6; revision++) observe(revision);
      assert.equal(commands.length, 4, 'Initial command plus at most three retries');
      assert(changed.every((value) => value.text === 'word'));
      binding.replaceComposing({ ...binding.read(), text: '', selection: { anchor: 0, focus: 0 } });
      const count = commands.length;
      observe(7, { text: 'new' });
      observe(8, { text: 'new' });
      assert.equal(commands.length, count);
      assert.equal(binding.read().text, 'new');
      binding.replaceComposing({ ...binding.read(), text: '', selection: { anchor: 0, focus: 0 } });
      const selected = commands.length;
      observe(9, { text: 'new', anchor: 0, focus: 3 });
      assert.equal(commands.length, selected);
      assert.deepEqual(binding.read().selection, { anchor: 0, focus: 3 });
      binding.replaceComposing({ ...binding.read(), text: '', selection: { anchor: 0, focus: 0 } });
      detach();
      assert.equal(observe(10), false);
      assert.equal(commands.length, selected + 1);
    } finally {
      detach();
      binding.dispose();
      interaction.dispose();
    }
  },
);

test(
  'unavailable cancellation and stale/retired native commands cannot replace active composition',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController('word');
    const interaction = new NativeInteraction(f.root.context.owner, {
      commands: true,
      selectionEvents: true,
      semantics: 'native-controls',
      nativeSnapshots: true,
    });
    f.root.context.editing = interaction.editing;
    let detach;
    const token = {};
    try {
      f.set(new EditableText('field', controller, 'Name'));
      detach = interaction.attachEditor('field', token, {
        replace() {
          assert.fail('Regular replacement must not cancel composition');
        },
        focus() {},
        blur() {},
      });
      interaction.observeSnapshot(token, {
        revision: 1,
        text: 'word',
        anchor: 4,
        focus: 4,
        composingStart: 0,
        composingEnd: 4,
        source: 'native',
      });
      assert.throws(() => controller.clear(), /composition replacement unavailable/);
      assert.equal(controller.text, 'word');
      assert(controller.isComposing);
      const value = interaction.editorValue('field');
      assert.equal(
        interaction.observeSnapshot(token, {
          revision: 1,
          text: 'old',
          anchor: 3,
          focus: 3,
          composingStart: -1,
          composingEnd: -1,
          source: 'native',
        }),
        false,
      );
      assert.equal(interaction.editorValue('field'), value);
    } finally {
      detach?.();
      await f.close();
      interaction.dispose();
      controller.dispose();
    }
  },
);

test(
  'native IME bounds use the current Core document, geometry epochs and native revision; retired ports cannot query glyphs',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController('first\nsecond 😀'),
      interaction = new NativeInteraction(f.root.context.owner, {
        commands: true,
        selectionEvents: true,
        semantics: 'native-controls',
        nativeSnapshots: true,
        geometry: 'unavailable',
      }),
      token = {},
      packets = [],
      writes = [];
    let detach,
      nativeRevision = 0;
    const observe = (text = controller.text, selection = controller.selection, extra = {}) =>
      interaction.observeSnapshot(token, {
        revision: ++nativeRevision,
        text,
        anchor: selection.anchor,
        focus: selection.focus,
        composingStart: -1,
        composingEnd: -1,
        source: 'native',
        ...extra,
      });
    try {
      controller.selection = { anchor: controller.text.length, focus: 1 };
      f.root.context.editing = interaction.editing;
      f.set(
        new Transform(new EditableText('field', controller, 'Native bounds'), [1, 0, 0, 1, 0, 0]),
      );
      detach = interaction.attachEditor('field', token, {
        replace(...args) {
          writes.push(args);
        },
        focus() {},
        blur() {},
        updateGeometry(...args) {
          packets.push(args);
        },
      });
      observe();
      f.frame();
      assert(packets.length > 0);
      let [geometry, text, characters, revision, selection] = packets.at(-1);
      assert.deepEqual(selection, { anchor: controller.text.length, focus: 1 });
      assert(Object.isFrozen(selection));
      assert.equal(text, controller.text);
      assert.equal(characters, null);
      assert.equal(revision, nativeRevision);
      assert(Number.isFinite(geometry.caretBaseline.y));
      assert.equal(
        interaction.requestCharacterBounds(token, 0, controller.text.length, nativeRevision - 1),
        false,
      );
      assert(interaction.requestCharacterBounds(token, 0, controller.text.length, nativeRevision));
      assert.equal(packets.at(-1)[2].rects.length, controller.text.length);
      let ancestor;
      const visit = (element) => {
        if (element.renderObject instanceof RenderTransform) ancestor = element.renderObject;
        element.visitChildren(visit);
      };
      visit(f.root.root);
      assert(ancestor);
      const stableEpoch = packets.at(-1)[0].layoutEpoch,
        stableCount = packets.length;
      f.frame();
      assert.equal(
        packets.length,
        stableCount,
        'Unchanged frames do not send duplicate native geometry',
      );
      ancestor.matrix = [1, 0, 0, 1, 10, 0];
      assert(interaction.requestCharacterBounds(token, 0, 1, nativeRevision));
      assert.equal(packets.at(-1)[0], null);
      ancestor.matrix = [1, 0, 0, 1, 0, 0];
      f.frame();
      assert.equal(
        packets.at(-1)[0].layoutEpoch,
        stableEpoch,
        'The successful frame restores withdrawn coordinates even when geometry returns to the same epoch',
      );
      assert.equal(packets.at(-1)[2].rects.length, 1);
      const before = packets.length;
      controller.text = 'Core replacement';
      assert.equal(interaction.requestCharacterBounds(token, 0, 1, nativeRevision), true);
      assert.equal(
        packets.at(-1)[0],
        null,
        'A dirty Core layout withdraws stale native coordinates',
      );
      f.frame();
      assert(
        packets.slice(before).every((packet) => packet[0] === null),
        'An old native buffer cannot receive coordinates for the replacement document',
      );
      const command = writes.at(-1);
      observe(
        command[0],
        { anchor: command[1].start, focus: command[1].end },
        { source: 'programmatic', request: command[3] },
      );
      f.frame();
      assert.equal(packets.at(-1)[1], controller.text);
      assert.equal(
        packets.at(-1)[2],
        null,
        'A pending bounds request from an older native revision is discarded',
      );
      assert(interaction.requestCharacterBounds(token, 0, controller.text.length, nativeRevision));
      assert.equal(packets.at(-1)[2].rangeStart, 0);
      assert.equal(packets.at(-1)[2].rects.length, controller.text.length);
      assert.throws(
        () =>
          interaction.requestCharacterBounds(token, 0, controller.text.length + 1, nativeRevision),
        /UTF-16 buffer/,
      );
      detach();
      detach = undefined;
      assert.equal(interaction.requestCharacterBounds(token, 0, 1, nativeRevision), false);
      const nextToken = {},
        retry = [];
      // A replacement already in flight remains owned across a native port remount.
      const attach = interaction.attachEditor('field', nextToken, {
        replace(...args) {
          retry.push(args);
        },
        focus() {},
        blur() {},
        updateGeometry() {},
      });
      detach = attach;
      controller.text = 'in flight';
      assert.equal(retry.at(-1)[0], 'in flight');
      const request = retry.at(-1)[3];
      detach();
      detach = interaction.attachEditor(
        'field',
        {},
        {
          replace(...args) {
            retry.push(args);
          },
          focus() {},
          blur() {},
        },
      );
      assert.equal(retry.at(-1)[3], request);
      assert.equal(retry.at(-1)[2], 0);
      f.set(new SizedBox());
      assert.equal(interaction.requestCharacterBounds(nextToken, 0, 1, 0), false);
    } finally {
      detach?.();
      await f.close();
      interaction.dispose();
      controller.dispose();
    }
  },
);

test(
  'native caret and hit queries retain Core paragraph stamps, same-frame retries and current port ownership',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController('ABe\u0301👩‍🚀'),
      interaction = new NativeInteraction(f.root.context.owner, {
        commands: true,
        selectionEvents: true,
        semantics: 'native-controls',
        nativeSnapshots: true,
        geometry: 'unavailable',
      }),
      token = {},
      packets = [],
      carets = [],
      hits = [],
      events = [];
    let detach,
      revision = 0;
    const observe = () =>
      interaction.observeSnapshot(token, {
        revision: ++revision,
        text: controller.text,
        anchor: controller.selection.anchor,
        focus: controller.selection.focus,
        composingStart: -1,
        composingEnd: -1,
        source: 'native',
      });
    const port = {
      replace() {},
      focus() {},
      blur() {},
      updateGeometry(...args) {
        packets.push(args);
        events.push('geometry');
      },
      updateCaretBounds(...args) {
        carets.push(args);
        events.push('caret');
      },
      updateTextPosition(...args) {
        hits.push(args);
        events.push('hit');
      },
    };
    try {
      f.root.context.editing = interaction.editing;
      f.set(
        new Transform(new EditableText('field', controller, 'Caret and hit'), [1, 0, 0, 1, 0, 0]),
      );
      detach = interaction.attachEditor('field', token, port);
      observe();
      f.frame();
      const geometry = packets.at(-1)[0],
        epoch = geometry.layoutEpoch,
        controllerRevision = controller.revision;
      assert(interaction.requestCharacterBounds(token, 0, controller.text.length, revision, epoch));
      const glyph = packets.at(-1)[2].rects[0],
        point = { x: glyph.x + glyph.width / 2, y: glyph.y + glyph.height / 2 };
      assert(interaction.requestCharacterBounds(token, 1, 1, revision, epoch));
      assert.equal(carets.at(-1)[0].rangeStart, 1);
      assert.equal(carets.at(-1)[0].rangeEnd, 1);
      assert.equal(carets.at(-1)[0].layoutEpoch, epoch);
      assert.equal(carets.at(-1)[1], revision);
      let render, ancestor;
      const visit = (element) => {
        if (element.renderObject instanceof RenderEditable) render = element.renderObject;
        if (element.renderObject instanceof RenderTransform) ancestor = element.renderObject;
        element.visitChildren(visit);
      };
      visit(f.root.root);
      const local = render.getLocalRectForCaret(new TextPosition({ offset: 1 })),
        global = render.localToGlobal(local);
      assert.deepEqual(carets.at(-1)[0].rect, {
        x: global.x,
        y: global.y,
        width: local.width,
        height: local.height,
      });
      const query = (
        request,
        options = {},
        at = point,
        layoutEpoch = epoch,
        nativeRevision = revision,
      ) =>
        interaction.requestTextPosition(token, {
          request,
          point: at,
          options,
          layoutEpoch,
          nativeRevision,
        });
      assert(query(1));
      assert.equal(hits.at(-1)[0], 1);
      assert.equal(hits.at(-1)[1].status, 'hit');
      assert.equal(hits.at(-1)[1].position, 0);
      assert.equal(hits.at(-1)[2], revision);
      assert(query(2, { roundNearest: true }, { x: glyph.x + glyph.width - 0.01, y: point.y }));
      assert.equal(hits.at(-1)[1].position, 1);
      assert(query(3, {}, { x: -100, y: -100 }));
      assert.equal(hits.at(-1)[1].status, 'miss');
      assert(query(4, { nearest: true }, { x: -100, y: -100 }));
      assert.equal(hits.at(-1)[1].status, 'hit');
      assert.equal(query(4), false);
      assert.equal(query(5, {}, point, epoch + 1), false);
      assert.equal(query(5, {}, point, epoch, revision - 1), false);
      assert.equal(interaction.requestCharacterBounds(token, 0, 1, revision, epoch + 1), false);
      assert.throws(() => query(5, {}, { x: Infinity, y: 0 }), /native text position request/);
      assert.throws(() => query(5, { nearest: null }), /native text position request/);
      const before = hits.length;
      ancestor.matrix = [1, 0, 0, 1, 19, 0];
      assert(interaction.requestCharacterBounds(token, 1, 1, revision, epoch));
      assert(query(5));
      assert.equal(packets.at(-1)[0], null);
      assert.equal(hits.length, before);
      ancestor.matrix = [1, 0, 0, 1, 0, 0];
      events.length = 0;
      f.frame();
      assert.equal(packets.at(-1)[0].layoutEpoch, epoch);
      assert.deepEqual(
        events,
        ['geometry', 'caret', 'hit'],
        'A successful unchanged frame wakes deferred queries without relabeling their epoch',
      );
      assert.equal(hits.at(-1)[0], 5);
      ancestor.matrix = [1, 0, 0, 1, 11, 0];
      assert(query(6));
      const oldHits = hits.length,
        oldCarets = carets.length;
      assert(interaction.requestCharacterBounds(token, 1, 1, revision, epoch));
      f.frame();
      const next = packets.at(-1)[0];
      assert(next.layoutEpoch > epoch);
      assert.equal(hits.length, oldHits);
      assert.equal(
        carets.length,
        oldCarets,
        'Old caret queries cannot be relabeled with a new frame',
      );
      assert(query(7, {}, { x: point.x + 11, y: point.y }, next.layoutEpoch));
      assert.equal(hits.at(-1)[1].position, 0);
      assert.equal(
        controller.revision,
        controllerRevision,
        'Geometry never acknowledges editing content',
      );
      detach();
      const oldDetach = detach;
      detach = interaction.attachEditor('field', token, port);
      assert.equal(
        packets.at(-1)[3],
        0,
        'Even the same JS token/command object has a new native port epoch',
      );
      oldDetach();
      assert(
        interaction.requestTextPosition(token, {
          request: 1,
          point: { x: point.x + 11, y: point.y },
          options: {},
          layoutEpoch: next.layoutEpoch,
          nativeRevision: 0,
        }),
      );
      f.set(new SizedBox());
      assert.equal(
        interaction.requestTextPosition(token, {
          request: 2,
          point,
          options: {},
          layoutEpoch: next.layoutEpoch,
          nativeRevision: 0,
        }),
        false,
      );
    } finally {
      detach?.();
      await f.close();
      interaction.dispose();
      controller.dispose();
    }
  },
);

test(
  'native query replies cannot escape a reentrant Core change or a malformed UTF-16 hit',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController('A😀B'),
      interaction = new NativeInteraction(f.root.context.owner, {
        commands: true,
        selectionEvents: true,
        semantics: 'native-controls',
        nativeSnapshots: true,
      }),
      token = {},
      packets = [],
      hits = [];
    let mode = 'normal',
      detach;
    f.root.context.editing = {
      ...interaction.editing,
      bind(owner, initial, changed, options) {
        return interaction.editing.bind(owner, initial, changed, {
          ...options,
          readTextPosition(...args) {
            const value = options.readTextPosition(...args);
            if (!value) return null;
            if (mode === 'surrogate')
              return { ...value, status: 'hit', position: 2, affinity: 'downstream' };
            if (mode === 'coordinates') return { ...value, coordinates: 'control-local' };
            if (mode === 'mutate') {
              mode = 'normal';
              controller.text = 'new Core';
            }
            return value;
          },
        });
      },
    };
    try {
      f.set(new EditableText('field', controller, 'Guarded query'));
      detach = interaction.attachEditor('field', token, {
        replace() {},
        focus() {},
        blur() {},
        updateGeometry(...args) {
          packets.push(args);
        },
        updateTextPosition(...args) {
          hits.push(args);
        },
      });
      f.frame();
      const geometry = packets.at(-1)[0],
        query = (request) =>
          interaction.requestTextPosition(token, {
            request,
            point: { x: 0, y: 0 },
            options: { nearest: true },
            layoutEpoch: geometry.layoutEpoch,
            nativeRevision: 0,
          });
      mode = 'surrogate';
      assert.throws(() => query(1), /UTF-16 boundary/);
      assert.equal(hits.length, 0);
      mode = 'coordinates';
      assert(query(2));
      assert.equal(packets.at(-1)[0], null);
      assert.equal(hits.length, 0);
      mode = 'normal';
      f.frame();
      assert.equal(hits.at(-1)[0], 2);
      const before = hits.length;
      mode = 'mutate';
      assert(query(3));
      assert.equal(controller.text, 'new Core');
      assert.equal(hits.length, before, 'A Core command during the query invalidates its reply');
      assert.equal(
        packets.at(-1)[0],
        null,
        'The nested Core command keeps its coordinate withdrawal',
      );
    } finally {
      detach?.();
      await f.close();
      interaction.dispose();
      controller.dispose();
    }
  },
);

test(
  'Core commands survive an absent native port while composition cancellation still waits for an actual observation',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController('initial'),
      interaction = new NativeInteraction(f.root.context.owner, {
        commands: true,
        selectionEvents: true,
        semantics: 'native-controls',
        nativeSnapshots: true,
      }),
      commands = [];
    let detach,
      completed = 0;
    const port = {
      replace(...args) {
        commands.push({ cancel: false, args });
      },
      replaceComposing(...args) {
        commands.push({ cancel: true, args });
      },
      focus() {},
      blur() {},
    };
    const ack = (token, revision, text, extra = {}) =>
      interaction.observeSnapshot(token, {
        text,
        revision,
        anchor: text.length,
        focus: text.length,
        composingStart: -1,
        composingEnd: -1,
        source: 'programmatic',
        ...extra,
      });
    try {
      f.root.context.editing = interaction.editing;
      f.set(new EditableText('field', controller, 'Absent native port'));
      controller.replace('offscreen', { anchor: 9, focus: 9 }, () => completed++);
      assert.equal(controller.text, 'offscreen');
      assert.equal(completed, 1);
      assert.equal(interaction.editorValue('field').text, 'initial');
      assert.equal(commands.length, 0);
      f.frame();
      const first = {};
      detach = interaction.attachEditor('field', first, port);
      let command = commands.at(-1);
      assert.equal(command.args[0], 'offscreen');
      assert.equal(command.args[2], 0);
      ack(first, 1, 'offscreen', { request: command.args[3] });
      detach();
      detach = undefined;
      controller.clear(() => completed++);
      assert.equal(controller.text, '');
      assert.equal(completed, 2);
      assert.equal(interaction.editorValue('field').text, 'offscreen');
      f.frame();
      const second = {};
      detach = interaction.attachEditor('field', second, port);
      command = commands.at(-1);
      assert.equal(command.args[0], '');
      ack(second, 1, '', { request: command.args[3] });
      ack(second, 2, 'preedit', { source: 'native', composingStart: 0, composingEnd: 7 });
      assert(controller.isComposing);
      detach();
      detach = undefined;
      controller.clear(() => completed++);
      assert.equal(completed, 2);
      assert.equal(controller.text, 'preedit');
      assert(controller.isComposing);
      f.frame();
      const third = {};
      detach = interaction.attachEditor('field', third, port);
      command = commands.at(-1);
      assert(command.cancel);
      assert.equal(
        completed,
        2,
        'Mounting a new port cannot itself complete composition cancellation',
      );
      assert.equal(
        ack(second, 3, ''),
        false,
        'The retired native token cannot acknowledge the new connection',
      );
      ack(third, 1, '', { request: command.args[3] });
      assert.equal(completed, 3);
      assert.equal(controller.text, '');
      assert.equal(controller.isComposing, false);
      f.frame();
    } finally {
      detach?.();
      await f.close();
      interaction.dispose();
      controller.dispose();
    }
  },
);

test(
  'the first noncomposing native observation cannot overwrite Core edits made before native initialization',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController('word'),
      interaction = new NativeInteraction(f.root.context.owner, {
        commands: true,
        selectionEvents: true,
        semantics: 'native-controls',
        nativeSnapshots: true,
      }),
      commands = [],
      token = {};
    let detach;
    const observe = (revision, extra = {}) =>
      interaction.observeSnapshot(token, {
        revision,
        text: 'word',
        anchor: 4,
        focus: 4,
        composingStart: -1,
        composingEnd: -1,
        source: 'native',
        ...extra,
      });
    try {
      f.root.context.editing = interaction.editing;
      f.set(new EditableText('field', controller, 'Name'));
      detach = interaction.attachEditor('field', token, {
        replace(...args) {
          commands.push(args);
        },
        replaceComposing(...args) {
          commands.push(args);
        },
        focus() {},
        blur() {},
      });
      controller.selectAll();
      controller.clear();
      assert.equal(controller.text, '');
      assert.equal(
        commands.length,
        1,
        'The later Core deletion waits behind selection synchronization',
      );
      observe(1, { focused: false });
      assert.equal(
        controller.text,
        '',
        'Initial unavailable-to-none composition is capability metadata, not another native edit',
      );
      assert.deepEqual(controller.selection, { anchor: 0, focus: 0 });
      observe(2, { focused: true });
      observe(3, { request: commands[0][3], rejection: 'stale' });
      assert.equal(controller.text, '');
      const first = commands[0];
      observe(4, { source: 'programmatic', request: first[3], anchor: 0 });
      await Promise.resolve();
      assert.equal(controller.text, '');
      assert.equal(
        commands.at(-1)[0],
        '',
        'The latest Core deletion is synchronized after the earlier native acknowledgement',
      );
      const last = commands.at(-1);
      interaction.observeSnapshot(token, {
        revision: 5,
        text: '',
        anchor: 0,
        focus: 0,
        composingStart: -1,
        composingEnd: -1,
        source: 'programmatic',
        request: last[3],
      });
      assert.equal(controller.text, '');
      interaction.observeSnapshot(token, {
        revision: 6,
        text: '',
        anchor: 0,
        focus: 0,
        composingStart: 0,
        composingEnd: 0,
        source: 'native',
      });
      assert(
        controller.isComposing,
        'An actual newly active composition still reaches Core even when text and selection have not changed',
      );
      interaction.observeSnapshot(token, {
        revision: 7,
        text: '',
        anchor: 0,
        focus: 0,
        composingStart: -1,
        composingEnd: -1,
        source: 'native',
      });
      assert(!controller.isComposing, 'Actual composition completion remains observable');
    } finally {
      detach?.();
      await f.close();
      interaction.dispose();
      controller.dispose();
    }
  },
);

test(
  'retiring a focused Core editing binding blurs its live port before unmount without blurring a newer owner',
  { timeout },
  () => {
    const owner = { id: 'retire-focus', generation: 1 },
      interaction = new NativeInteraction(owner, {
        commands: true,
        nativeSnapshots: true,
        semantics: 'native-controls',
      }),
      events = [];
    const initial = {
      text: 'word',
      selection: { anchor: 4, focus: 4 },
      composing: { status: 'none' },
      revision: 0,
      session: owner,
      source: 'programmatic',
    };
    const services = interaction.acquireServices();
    let a, b, detachA, detachB;
    const bind = (id) =>
      services.editing.bind(owner, initial, () => events.push('changed-' + id), { id });
    try {
      a = bind('a');
      b = bind('b');
      const tokenA = {},
        tokenB = {};
      detachA = interaction.attachEditor('a', tokenA, {
        replace() {},
        focus() {
          events.push('focus-a');
        },
        blur() {
          events.push('blur-a');
        },
      });
      detachB = interaction.attachEditor('b', tokenB, {
        replace() {},
        focus() {
          events.push('focus-b');
        },
        blur() {
          events.push('blur-b');
          assert.equal(
            interaction.editorValue('b'),
            undefined,
            'Retirement fences callbacks before the native blur',
          );
          assert.equal(
            interaction.observeSnapshot(tokenB, {
              revision: 1,
              text: 'late',
              anchor: 4,
              focus: 4,
              composingStart: -1,
              composingEnd: -1,
              focused: false,
              source: 'native',
            }),
            false,
          );
        },
      });
      a.focus();
      b.focus();
      a.dispose();
      assert(
        !events.includes('blur-a'),
        'Retiring an old field must not steal a newer field focus',
      );
      b.dispose();
      assert.equal(
        events.filter((event) => event === 'blur-b').length,
        1,
        'The live focused endpoint must receive blur before its React ref unmounts',
      );
      b.dispose();
      assert.equal(events.filter((event) => event === 'blur-b').length, 1);
      detachA();
      detachA = undefined;
      detachB();
      detachB = undefined;
      const bad = bind('bad');
      const detachBad = interaction.attachEditor(
        'bad',
        {},
        {
          replace() {},
          focus() {},
          blur() {
            throw new Error('native blur failed');
          },
        },
      );
      bad.focus();
      assert.throws(() => bad.dispose(), /native blur failed/);
      assert.equal(
        interaction.editorValue('bad'),
        undefined,
        'A rejected native blur still retires the Core binding',
      );
      assert(!interaction.editorClients.some((client) => client.id === 'bad'));
      detachBad();
      const replacement = bind('bad');
      replacement.dispose();
    } finally {
      a?.dispose();
      b?.dispose();
      detachA?.();
      detachB?.();
      services.release();
      interaction.dispose();
    }
  },
);
