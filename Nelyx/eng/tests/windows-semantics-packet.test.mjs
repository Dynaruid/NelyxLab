// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  windowsSemanticsPacket,
  performWindowsSemanticsAction,
} from '../../sdk/dist/platforms/windows/semantics-packet.js';
import { NativeInteraction } from '../../sdk/dist/runtime/native-interaction.js';
import { WindowsSemanticsActions } from '../../sdk/dist/backends/react-native/windows-semantics-actions.js';
const timeout = 1_200_000,
  owner = { id: 'Core View', generation: 1 },
  surface = { surfaceId: 42, nativeSurfaceGeneration: 3, viewportGeneration: 2 };
const field = () => ({
  id: 'field',
  sourceNodeId: 7,
  role: 'text-field',
  name: 'Core',
  bounds: { x: 1, y: 2, width: 100, height: 30 },
  enabled: true,
  focusable: true,
  focused: false,
  textInputRevision: 11,
  textRevision: 4,
  textInputGeneration: 5,
  value: 'A😀B',
  textSelection: { anchor: 1, focus: 3 },
  textNavigation: { characters: [0, 1, 3, 4] },
  actions: { focus() {} },
  textActions: { setText() {}, setSelection() {} },
});
const geometry = {
  coordinates: 'view-logical',
  owner,
  viewportGeneration: 2,
  nativeSurfaceGeneration: 3,
  layoutEpoch: 8,
  scale: 1,
  transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  bounds: { x: 1, y: 2, width: 100, height: 30 },
  clip: { x: 1, y: 2, width: 100, height: 30 },
  caret: { x: 5, y: 2, width: 1, height: 20 },
  caretBaseline: { x: 5, y: 18 },
  selectionRects: [],
};
const paragraph = {
  resource: { id: 'paragraph', generation: 1 },
  reference: { protocol: 'native-paragraph-v1', token: 9 },
  paintOffset: { x: -10, y: 0 },
};

test(
  'Windows absolute range values stay typed and use only the current enabled Core control',
  { timeout },
  () => {
    const interaction = new NativeInteraction(owner, {
        commands: true,
        selectionEvents: true,
        semantics: 'native-controls',
      }),
      calls = [];
    const slider = (value = 25) => ({
        id: 'slider',
        sourceNodeId: 9,
        role: 'group',
        name: 'Level',
        bounds: { x: 0, y: 0, width: 100, height: 30 },
        enabled: true,
        isSlider: true,
        value: value + '%',
        numericRange: { min: -100, max: 100, value, smallChange: 5 },
        rangeActions: { setValue: (value) => calls.push(value) },
      }),
      binding = interaction.semantics.bind([slider()]);
    try {
      const node = interaction.node('slider', 'group'),
        packet = windowsSemanticsPacket(node, owner, surface, interaction.snapshot()),
        event = {
          protocol: 1,
          id: 'slider',
          source: 9,
          commit: packet.commit,
          kind: 'set-range-value',
          value: 37.5,
        };
      assert.deepEqual(packet.range, {
        min: -100,
        max: 100,
        value: 25,
        smallChange: 5,
        readOnly: false,
      });
      assert(Object.isFrozen(packet.range));
      assert(packet.isSlider);
      assert(performWindowsSemanticsAction(interaction, node, packet, event));
      assert.deepEqual(calls, [37.5]);
      assert.equal(
        interaction.node('slider', 'group').numericRange.value,
        25,
        'Queued requests cannot invent an accepted Core value',
      );
      for (const changed of [
        { value: NaN },
        { value: Infinity },
        { value: 101 },
        { value: -101 },
        { value: '25' },
        { source: 10 },
        { commit: packet.commit + 1 },
      ])
        assert.equal(
          performWindowsSemanticsAction(interaction, node, packet, { ...event, ...changed }),
          false,
        );
      binding.update([slider()]);
      assert(
        performWindowsSemanticsAction(interaction, node, packet, event),
        'Paint-only callback refresh must keep the same current range usable',
      );
      calls.pop();
      binding.update([slider(50)]);
      assert.equal(
        performWindowsSemanticsAction(interaction, node, packet, event),
        false,
        'An older range snapshot cannot acquire the updated value or callback',
      );
      for (const change of [{ enabled: false }, { rangeActions: undefined }]) {
        binding.update([{ ...slider(), ...change }]);
        const current = interaction.node('slider', 'group'),
          currentPacket = windowsSemanticsPacket(current, owner, surface, interaction.snapshot());
        assert.equal(
          performWindowsSemanticsAction(interaction, current, currentPacket, {
            ...event,
            commit: currentPacket.commit,
          }),
          false,
        );
      }
      assert.deepEqual(calls, [37.5]);
    } finally {
      binding.dispose();
      interaction.dispose();
    }
  },
);

test(
  'range dispatch is synchronous, single use and revoked by observer reentrancy',
  { timeout },
  () => {
    for (const mode of ['once', 'replace', 'defer']) {
      const interaction = new NativeInteraction(owner, {
          commands: true,
          selectionEvents: true,
          semantics: 'native-controls',
        }),
        calls = [];
      let saved, binding;
      const node = () => ({
        id: 'range',
        role: 'group',
        name: 'Range',
        bounds: { x: 0, y: 0, width: 30, height: 20 },
        enabled: true,
        numericRange: { min: 0, max: 10, value: 2 },
        rangeActions: { setValue: (value) => calls.push(value) },
      });
      binding = interaction.semantics.bind([node()], {
        dispatchAction() {},
        dispatchRangeAction(_id, action, perform) {
          assert(Object.isFrozen(action));
          saved = perform;
          if (mode === 'replace') binding.update([node()]);
          if (mode !== 'defer') {
            perform();
            perform();
          }
        },
      });
      try {
        assert.equal(
          interaction.performRangeAction('range', { kind: 'set-range-value', value: 7 }),
          mode === 'once',
        );
        saved();
        assert.deepEqual(calls, mode === 'once' ? [7] : []);
      } finally {
        binding.dispose();
        interaction.dispose();
      }
    }
  },
);

test(
  'Windows range reveal is typed, readonly-safe and fenced by the current Core snapshot',
  { timeout },
  () => {
    const interaction = new NativeInteraction(owner, {
        commands: true,
        selectionEvents: true,
        semantics: 'native-controls',
      }),
      calls = [];
    const source = {
        ...field(),
        readOnly: true,
        textActions: { scrollRange: (start, end, top) => calls.push([start, end, top]) },
      },
      binding = interaction.semantics.bind([source]);
    try {
      const node = interaction.node('field', 'text-field'),
        packet = windowsSemanticsPacket(node, owner, surface, interaction.snapshot()),
        event = {
          protocol: 1,
          id: 'field',
          source: 7,
          commit: packet.commit,
          kind: 'scroll-range',
          revision: 11,
          generation: 5,
          start: 1,
          end: 3,
          alignToTop: false,
        };
      assert(performWindowsSemanticsAction(interaction, node, packet, event));
      assert.deepEqual(calls, [[1, 3, false]]);
      for (const changed of [
        { start: 2 },
        { start: 3, end: 1 },
        { alignToTop: 1 },
        { generation: 6 },
        { revision: 12 },
        { commit: packet.commit + 1 },
      ])
        assert.equal(
          performWindowsSemanticsAction(interaction, node, packet, { ...event, ...changed }),
          false,
        );
      binding.update([{ ...source, obscured: true, textNavigation: undefined }]);
      const secure = interaction.node('field', 'text-field'),
        hidden = windowsSemanticsPacket(secure, owner, surface, interaction.snapshot());
      assert.equal(
        performWindowsSemanticsAction(interaction, secure, hidden, {
          ...event,
          commit: hidden.commit,
          start: 0,
          end: 0,
        }),
        false,
      );
      assert.equal(calls.length, 1);
    } finally {
      binding.dispose();
      interaction.dispose();
    }
  },
);

test(
  'Windows Invoke dispatches one stamped Core action and rejects replaced or disabled sources',
  { timeout },
  () => {
    const interaction = new NativeInteraction(owner, {
        commands: true,
        selectionEvents: true,
        semantics: 'native-controls',
      }),
      calls = [];
    const button = (enabled = true) => ({
      id: 'button',
      sourceNodeId: 8,
      role: 'button',
      name: 'Action',
      bounds: { x: 0, y: 0, width: 30, height: 20 },
      enabled,
      actions: { activate: () => calls.push('activated') },
    });
    const binding = interaction.semantics.bind([button()]);
    try {
      const node = interaction.node('button', 'button'),
        packet = windowsSemanticsPacket(node, owner, surface, interaction.snapshot()),
        event = { protocol: 1, id: 'button', source: 8, commit: packet.commit, kind: 'activate' };
      assert.equal(packet.canActivate, true);
      assert(performWindowsSemanticsAction(interaction, node, packet, event));
      assert.deepEqual(calls, ['activated']);
      binding.update([button(false)]);
      assert.equal(performWindowsSemanticsAction(interaction, node, packet, event), false);
      const disabled = interaction.node('button', 'button'),
        current = windowsSemanticsPacket(disabled, owner, surface, interaction.snapshot());
      assert.equal(
        performWindowsSemanticsAction(interaction, disabled, current, {
          ...event,
          commit: current.commit,
        }),
        false,
      );
      assert.equal(calls.length, 1);
    } finally {
      binding.dispose();
      interaction.dispose();
    }
  },
);

test(
  'Windows semantics copies Core identities/revisions, withdraws mismatched frames and never sends password bodies or unit tables',
  { timeout },
  () => {
    const node = { ...field(), textInputGeometry: geometry, textParagraph: paragraph },
      packet = windowsSemanticsPacket(node, owner, surface, 6);
    assert.equal(packet.text.textRevision, 4);
    assert.equal(packet.text.revision, 11);
    assert.equal(packet.text.geometry, geometry);
    assert.equal(packet.text.paragraph, paragraph);
    assert.deepEqual(
      packet.text.navigation,
      { characters: [0, 1, 3, 4], words: [], lines: [] },
      'Absent Core units remain unsupported rather than invented document partitions',
    );
    assert(
      Object.isFrozen(packet) && Object.isFrozen(packet.owner) && Object.isFrozen(packet.bounds),
    );
    for (const changed of [
      { ...surface, nativeSurfaceGeneration: 4 },
      { ...surface, viewportGeneration: 3 },
    ]) {
      const stale = windowsSemanticsPacket(node, owner, changed, 7);
      assert.equal(stale.text.geometry, null);
      assert.equal(stale.text.paragraph, null);
      assert.equal(stale.text.value, 'A😀B');
    }
    const secure = windowsSemanticsPacket(
      { ...node, obscured: true, value: 'secret🔑' },
      owner,
      surface,
      8,
    );
    assert.equal(secure.text.value, '');
    assert.equal(secure.text.anchor, 0);
    assert.equal(secure.text.focus, 0);
    assert.equal(secure.text.navigation, null);
    assert.equal(secure.text.paragraph, null);
    assert(!JSON.stringify(secure).includes('secret'));
    for (const prop of ['textInputRevision', 'textRevision', 'textInputGeneration', 'sourceNodeId'])
      assert.throws(
        () => windowsSemanticsPacket({ ...node, [prop]: undefined }, owner, surface, 1),
        /required/,
      );
    const label = windowsSemanticsPacket(
      {
        ...field(),
        role: 'text',
        textRevision: undefined,
        textInputRevision: undefined,
        textInputGeneration: undefined,
      },
      owner,
      surface,
      0,
    );
    assert.equal(label.text, null);
  },
);
test(
  'Windows native action stamps cannot acquire a newer snapshot, editing owner or listener',
  { timeout },
  () => {
    const interaction = new NativeInteraction(owner, {
        commands: true,
        selectionEvents: true,
        semantics: 'native-controls',
      }),
      calls = [];
    let binding;
    const publish = (generation = 5) => ({
      ...field(),
      textInputGeneration: generation,
      actions: { focus: () => calls.push('focus') },
      textActions: {
        setText: (text) => calls.push(text),
        setSelection: (value) => calls.push(value),
      },
    });
    try {
      binding = interaction.semantics.bind([publish()]);
      const node = interaction.node('field', 'text-field'),
        packet = windowsSemanticsPacket(node, owner, surface, interaction.snapshot()),
        event = {
          protocol: 1,
          id: 'field',
          source: 7,
          commit: packet.commit,
          kind: 'set-text',
          revision: 11,
          generation: 5,
          text: 'Core',
        };
      assert(performWindowsSemanticsAction(interaction, node, packet, event));
      assert.deepEqual(calls, ['Core']);
      assert(
        performWindowsSemanticsAction(interaction, node, packet, {
          ...event,
          kind: 'set-selection',
          anchor: 3,
          focus: 1,
        }),
      );
      assert.deepEqual(calls[1], { anchor: 3, focus: 1 });
      assert(performWindowsSemanticsAction(interaction, node, packet, { ...event, kind: 'focus' }));
      assert.equal(calls[2], 'focus');
      for (const bad of [
        { ...event, commit: packet.commit + 1 },
        { ...event, source: 8 },
        { ...event, generation: 6 },
        { ...event, revision: 12 },
        { ...event, kind: 'set-selection', anchor: 2, focus: 3 },
        { ...event, text: 'bad\0text' },
      ])
        assert.equal(performWindowsSemanticsAction(interaction, node, packet, bad), false);
      binding.update([publish(6)]);
      assert.equal(performWindowsSemanticsAction(interaction, node, packet, event), false);
      assert.equal(calls.length, 3);
      binding.dispose();
      assert.equal(
        performWindowsSemanticsAction(interaction, node, packet, { ...event, kind: 'focus' }),
        false,
      );
    } finally {
      binding?.dispose();
      interaction.dispose();
    }
  },
);

test(
  'committed Windows action history preserves typed text/range checks across queued geometry updates',
  { timeout },
  () => {
    const interaction = new NativeInteraction(owner, {
        commands: true,
        selectionEvents: true,
        semantics: 'native-controls',
      }),
      queue = new WindowsSemanticsActions(),
      calls = [];
    const publishField = (y, changes = {}) => ({
      ...field(),
      bounds: { x: 1, y, width: 100, height: 30 },
      textActions: { setText: (text) => calls.push(text) },
      ...changes,
    });
    const binding = interaction.semantics.bind([publishField(0)]),
      publish = () => {
        const node = interaction.semanticNodes[0],
          packet = windowsSemanticsPacket(node, owner, surface, interaction.snapshot());
        queue.publish(interaction, node, packet);
        return packet;
      };
    try {
      const first = publish(),
        event = {
          protocol: 1,
          id: 'field',
          source: 7,
          commit: first.commit,
          kind: 'set-text',
          revision: 11,
          generation: 5,
          text: 'queued',
        };
      binding.update([publishField(10)]);
      publish();
      assert(queue.perform(event));
      assert.deepEqual(calls, ['queued']);
      binding.update([publishField(20, { textInputRevision: 12 })]);
      publish();
      assert.equal(
        queue.perform(event),
        false,
        'A matching commit cannot acquire a newer editing revision',
      );
      const slider = (y, value = 2) => ({
        id: 'slider',
        sourceNodeId: 9,
        role: 'group',
        name: 'Range',
        bounds: { x: 0, y, width: 100, height: 30 },
        enabled: true,
        numericRange: { min: 0, max: 10, value },
        rangeActions: { setValue: (value) => calls.push(value) },
      });
      binding.update([slider(0)]);
      const range = publish(),
        request = {
          protocol: 1,
          id: 'slider',
          source: 9,
          commit: range.commit,
          kind: 'set-range-value',
          value: 7,
        };
      binding.update([slider(10)]);
      publish();
      assert(queue.perform(request));
      assert.deepEqual(calls, ['queued', 7]);
      binding.update([slider(20, 3)]);
      publish();
      assert.equal(
        queue.perform(request),
        false,
        'An older native range cannot acquire a changed Core value',
      );
    } finally {
      queue.clear();
      binding.dispose();
      interaction.dispose();
    }
  },
);

test(
  'Windows action history retires privacy/capability transitions, replaced sources and backing generations',
  { timeout },
  () => {
    for (const change of [
      { enabled: false },
      { focusable: false },
      { readOnly: true },
      { obscured: true, textNavigation: undefined },
      { sourceNodeId: 8 },
      { textInputGeneration: 6 },
    ]) {
      const interaction = new NativeInteraction(owner, {
          commands: true,
          selectionEvents: true,
          semantics: 'native-controls',
        }),
        queue = new WindowsSemanticsActions(),
        calls = [];
      const node = (extra) => ({
          ...field(),
          actions: { focus: () => calls.push('focus') },
          ...extra,
        }),
        binding = interaction.semantics.bind([node()]);
      const publish = (where = surface) => {
        const current = interaction.semanticNodes[0],
          packet = windowsSemanticsPacket(current, owner, where, interaction.snapshot());
        queue.publish(interaction, current, packet);
        return packet;
      };
      try {
        const first = publish(),
          event = { protocol: 1, id: 'field', source: 7, commit: first.commit, kind: 'focus' };
        binding.update([node(change)]);
        publish();
        assert.equal(queue.perform(event), false);
        binding.update([node()]);
        publish();
        assert.equal(
          queue.perform(event),
          false,
          'Returning to the old capability must not revive its retired receipt',
        );
        const before = publish();
        interaction.surfaceChanged();
        const newer = publish({ ...surface, nativeSurfaceGeneration: 4 });
        assert.equal(queue.perform({ ...event, commit: before.commit }), false);
        assert(queue.perform({ ...event, commit: newer.commit }));
        assert.deepEqual(calls, ['focus']);
        binding.dispose();
        assert.equal(queue.perform({ ...event, commit: newer.commit }), false);
      } finally {
        queue.clear();
        binding.dispose();
        interaction.dispose();
      }
    }
  },
);

test(
  'Windows focus history has a finite published-commit window and rejects unknown or forged receipts',
  { timeout },
  () => {
    const interaction = new NativeInteraction(owner, {
        commands: true,
        selectionEvents: true,
        semantics: 'native-controls',
      }),
      queue = new WindowsSemanticsActions(),
      calls = [];
    const node = (y) => ({
        ...field(),
        bounds: { ...field().bounds, y },
        actions: { focus: () => calls.push(y) },
      }),
      binding = interaction.semantics.bind([node(0)]);
    const publish = () => {
      const current = interaction.semanticNodes[0],
        packet = windowsSemanticsPacket(current, owner, surface, interaction.snapshot());
      queue.publish(interaction, current, packet);
      return packet;
    };
    try {
      const first = publish(),
        event = { protocol: 1, id: 'field', source: 7, commit: first.commit, kind: 'focus' };
      for (let i = 1; i < 16; i++) {
        binding.update([node(i)]);
        publish();
      }
      assert(queue.perform(event));
      assert.deepEqual(calls, [15]);
      binding.update([node(16)]);
      const latest = publish();
      assert.equal(queue.perform(event), false);
      assert(queue.perform({ ...event, commit: latest.commit }));
      assert.deepEqual(calls, [15, 16]);
      for (const change of [
        { commit: latest.commit + 1 },
        { source: 8 },
        { id: 'other' },
        { protocol: 2 },
        { kind: 'unknown' },
      ])
        assert.equal(queue.perform({ ...event, commit: latest.commit, ...change }), false);
      queue.clear();
      assert.equal(queue.perform({ ...event, commit: latest.commit }), false);
    } finally {
      queue.clear();
      binding.dispose();
      interaction.dispose();
    }
  },
);
