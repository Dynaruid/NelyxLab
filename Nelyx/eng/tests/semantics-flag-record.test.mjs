// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SemanticsFlags,
  CheckedState,
  Tristate,
  SemanticsFlag,
  semanticsFlagWord,
  updateSemanticsFlagWord,
  mergeSemanticsFlagWords,
  semanticsFlagWordsConflict,
  readSemanticsFlagWord,
  semanticsFlagsFromWord,
} from '@nelyx/core/ui/semantics';
import {
  SemanticsConfiguration,
  SemanticsNode,
  AccessibilityFocusBlockType,
} from '@nelyx/core/framework/semantics/semantics';

const timeout = 1_200_000;
const fields = Object.keys(SemanticsFlags.none);
const publish = (config) => {
  const node = new SemanticsNode();
  node.updateWith({ config });
  return node;
};

test(
  'each configuration captures the current default flags once before later annotation changes',
  { timeout },
  () => {
    const descriptor = Object.getOwnPropertyDescriptor(SemanticsFlags, 'none'),
      first = new SemanticsFlags({ isImage: true }),
      second = new SemanticsFlags({ isButton: true });
    let reads = 0;
    try {
      Object.defineProperty(SemanticsFlags, 'none', {
        configurable: true,
        get() {
          return ++reads === 1 ? first : second;
        },
      });
      const config = new SemanticsConfiguration();
      assert.equal(reads, 1);
      config.label = 'Captured';
      assert.equal(config.isImage, true);
      assert.equal(config.isButton, false);
      assert.equal(reads, 1);
      const later = new SemanticsConfiguration();
      assert.equal(reads, 2);
      later.tooltip = 'Later';
      assert.equal(later.isButton, true);
      assert.equal(later.isImage, false);
      assert.equal(config.isImage, true);
    } finally {
      Object.defineProperty(SemanticsFlags, 'none', descriptor);
    }
  },
);

test(
  'packed flags retain all public fields, enum states and the highest boolean bit',
  { timeout },
  () => {
    const none = semanticsFlagWord(SemanticsFlags.none);
    assert.equal(none, 0);
    assert.equal(fields.length, 24);
    for (const [index, name] of fields.entries()) {
      const states =
        index === 0 ? CheckedState.values : index < 7 ? Tristate.values : [false, true];
      for (const state of states) {
        const expected = new SemanticsFlags({ [name]: state });
        const word = updateSemanticsFlagWord(none, name, state),
          actual = semanticsFlagsFromWord(word);
        assert.notEqual(word, null);
        assert.equal(readSemanticsFlagWord(word, name), state);
        assert(actual instanceof SemanticsFlags);
        assert(Object.isFrozen(actual));
        assert.deepEqual(Object.keys(actual), fields);
        assert.deepEqual(actual, expected);
        assert.equal(actual.equals(expected), true);
        assert.equal(actual.hashCode, expected.hashCode);
        assert.equal(JSON.stringify(actual), JSON.stringify(expected));
        assert.equal(semanticsFlagWord(actual), word);
        for (const key of fields)
          assert.deepEqual(
            Object.getOwnPropertyDescriptor(actual, key),
            Object.getOwnPropertyDescriptor(expected, key),
          );
      }
    }
    assert.equal(updateSemanticsFlagWord(none, 'isKeyboardKey', true), 2 ** 30);
    const all = Object.fromEntries(
      fields.map((name, index) => [
        name,
        index === 0 ? CheckedState.mixed : index < 7 ? Tristate.isFalse : true,
      ]),
    );
    const combined = new SemanticsFlags(all),
      copy = semanticsFlagsFromWord(semanticsFlagWord(combined));
    assert.deepEqual(copy, combined);
    assert.throws(() => {
      copy.isButton = false;
    }, TypeError);
    assert.equal(updateSemanticsFlagWord(none, 'isButton', null), null);
    assert.equal(
      updateSemanticsFlagWord(none, 'isEnabled', Object.create(Tristate.prototype)),
      null,
    );
    for (const invalid of [-1, 2 ** 31, NaN, 0.5])
      assert.throws(() => semanticsFlagsFromWord(invalid), /31 bits/);
    assert.throws(() => semanticsFlagsFromWord(3 << 2), /Invalid packed semantics state/);
  },
);

test(
  'configuration publication, copy and absorb preserve immutable snapshots and legacy flags',
  { timeout },
  () => {
    const config = new SemanticsConfiguration();
    config.isButton = true;
    config.isChecked = false;
    config.isSelected = true;
    config.isEnabled = false;
    config.isToggled = true;
    config.isExpanded = true;
    config.isRequired = true;
    config.isKeyboardKey = true;
    const first = publish(config),
      snapshot = first.flagsCollection,
      again = publish(config);
    assert.equal(again.flagsCollection, snapshot);
    assert(first.hasFlag(SemanticsFlag.hasCheckedState));
    assert.equal(first.hasFlag(SemanticsFlag.isChecked), false);
    assert(first.hasFlag(SemanticsFlag.isSelected));
    assert(first.hasFlag(SemanticsFlag.hasEnabledState));
    assert.equal(first.hasFlag(SemanticsFlag.isEnabled), false);
    assert(first.hasFlag(SemanticsFlag.isToggled));
    assert(first.hasFlag(SemanticsFlag.isExpanded));
    assert(first.hasFlag(SemanticsFlag.isRequired));
    assert(first.hasFlag(SemanticsFlag.isKeyboardKey));
    const copied = config.copy();
    assert.equal(publish(copied).flagsCollection, snapshot);
    config.isButton = true;
    const sameValue = publish(config).flagsCollection;
    assert.notEqual(sameValue, snapshot);
    assert(sameValue.equals(snapshot));
    config.isButton = false;
    config.isChecked = true;
    assert.equal(snapshot.isButton, true);
    assert.equal(snapshot.isChecked, CheckedState.isFalse);
    assert.equal(publish(copied).flagsCollection, snapshot);
    const absorbed = new SemanticsConfiguration();
    absorbed.isImage = true;
    absorbed.absorb(copied);
    const merged = publish(absorbed).flagsCollection;
    assert(merged.isImage);
    assert(merged.isButton);
    copied.isSelected = false;
    assert.equal(merged.isSelected, Tristate.isTrue);
  },
);

test(
  'checked, focus and focus-block transitions retain the original conditional setters',
  { timeout },
  () => {
    const config = new SemanticsConfiguration();
    config.isChecked = true;
    const first = publish(config).flagsCollection;
    config.isChecked = null;
    config.isCheckStateMixed = false;
    assert.equal(publish(config).flagsCollection, first);
    config.isCheckStateMixed = true;
    assert.equal(config.isCheckStateMixed, true);
    assert.equal(publish(config).flagsCollection.isChecked, CheckedState.mixed);
    config.isFocusable = true;
    assert.equal(config.isFocused, false);
    assert.equal(config.isFocusable, true);
    config.isFocused = true;
    config.isFocusable = true;
    assert.equal(config.isFocused, true);
    config.isFocusable = false;
    assert.equal(config.isFocused, null);
    assert.equal(config.isFocusable, false);
    config.accessibilityFocusBlockType = AccessibilityFocusBlockType.blocked;
    assert.equal(publish(config).flagsCollection.isAccessibilityFocusBlocked, true);
    config.accessibilityFocusBlockType = AccessibilityFocusBlockType.none;
    assert.equal(publish(config).flagsCollection.isAccessibilityFocusBlocked, false);
    config.isImage = true;
    config.isImage = null;
    assert.equal(config.isImage, true, 'copyWith ignores nullish flag values');
    const before = publish(config).flagsCollection;
    assert.throws(() => {
      config.isImage = 'invalid';
    }, /typed state values/);
    assert.equal(publish(config).flagsCollection, before);
  },
);

test(
  'subclass and Proxy flag sources keep virtual copyWith receivers and observable property reads',
  { timeout },
  () => {
    const saved = SemanticsFlags.none,
      calls = [];
    class CustomFlags extends SemanticsFlags {
      copyWith(options) {
        calls.push(['copy', this, options]);
        return super.copyWith(options);
      }
    }
    const custom = new CustomFlags({ isImage: true });
    assert.equal(semanticsFlagWord(custom), null);
    try {
      SemanticsFlags.none = custom;
      const config = new SemanticsConfiguration();
      config.isButton = true;
      assert.equal(calls.length, 1);
      assert.equal(calls[0][1], custom);
      assert.deepEqual(calls[0][2], { isButton: true });
      assert.equal(publish(config).flagsCollection.isImage, true);
      const reads = [],
        proxy = new Proxy(saved, {
          get(target, name, receiver) {
            reads.push(name);
            return Reflect.get(target, name, receiver);
          },
        });
      assert.equal(semanticsFlagWord(proxy), null);
      SemanticsFlags.none = proxy;
      const proxied = new SemanticsConfiguration();
      assert.equal(proxied.isImage, false);
      assert.deepEqual(reads, ['isImage']);
      reads.length = 0;
      proxied.isButton = true;
      assert.equal(reads[0], 'copyWith');
      assert(reads.includes('isImage'));
      assert.equal(proxied.isButton, true);
    } finally {
      SemanticsFlags.none = saved;
    }
  },
);

test(
  'record merge and conflicts match independent public values across combined state pairs',
  { timeout },
  () => {
    for (let left = 0; left < 4; left++)
      for (let right = 0; right < 4; right++) {
        const options = (state, other) =>
          Object.fromEntries(
            fields.map((name, index) => [
              name,
              index === 0
                ? CheckedState.values[state]
                : index < 7
                  ? Tristate.values[(state + index) % 3]
                  : (state + other + index) % 2 === 0,
            ]),
          );
        const a = new SemanticsFlags(options(left, 0)),
          b = new SemanticsFlags(options(right, 1));
        const aw = semanticsFlagWord(a),
          bw = semanticsFlagWord(b),
          merged = semanticsFlagsFromWord(mergeSemanticsFlagWords(aw, bw));
        assert.deepEqual(merged, a.merge(b));
        assert.equal(semanticsFlagWordsConflict(aw, bw), a.hasConflictingFlags(b));
      }
    const conflicts = [
      [{}, {}, false],
      [{ isButton: true }, { isImage: true }, false],
      [{ isButton: true }, { isButton: true }, true],
      [{ isKeyboardKey: true }, { isKeyboardKey: true }, true],
      [{ isAccessibilityFocusBlocked: true }, { isAccessibilityFocusBlocked: true }, false],
      [{ isAccessibilityFocusBlocked: true }, {}, true],
      [{ isSelected: Tristate.isTrue }, { isSelected: Tristate.isFalse }, true],
      [{ isChecked: CheckedState.mixed }, {}, false],
    ];
    for (const [left, right, expected] of conflicts) {
      const a = new SemanticsFlags(left),
        b = new SemanticsFlags(right);
      assert.equal(a.hasConflictingFlags(b), expected);
      assert.equal(
        semanticsFlagWordsConflict(semanticsFlagWord(a), semanticsFlagWord(b)),
        expected,
      );
    }
  },
);

test(
  'canonical configuration operations own state while public value methods remain virtual',
  { timeout },
  () => {
    const methods = ['copyWith', 'merge', 'hasConflictingFlags'],
      descriptors = methods.map((name) =>
        Object.getOwnPropertyDescriptor(SemanticsFlags.prototype, name),
      );
    const config = new SemanticsConfiguration();
    config.isImage = true;
    const previous = publish(config).flagsCollection;
    const calls = [],
      child = new SemanticsConfiguration();
    child.isSelected = true;
    try {
      for (const name of methods)
        Object.defineProperty(SemanticsFlags.prototype, name, {
          configurable: true,
          get() {
            calls.push(['get', name, this]);
            return function () {
              throw new Error('public ' + name);
            };
          },
        });
      config.isButton = true;
      assert(config.isCompatibleWith(child));
      config.absorb(child);
      assert.equal(config.isImage, true);
      assert.equal(config.isButton, true);
      assert.equal(config.isSelected, true);
      assert.deepEqual(
        calls,
        [],
        'No virtual value projection is needed for canonical annotation operations',
      );
      for (const name of methods)
        assert.throws(() => previous[name](SemanticsFlags.none), new RegExp('public ' + name));
      assert.deepEqual(
        calls.map((call) => [call[0], call[1]]),
        methods.map((name) => ['get', name]),
      );
      assert(calls.every((call) => call[2] === previous));
      assert.equal(previous.isButton, false);
    } finally {
      for (let i = 0; i < methods.length; i++)
        Object.defineProperty(SemanticsFlags.prototype, methods[i], descriptors[i]);
    }
    class CustomConfiguration extends SemanticsConfiguration {
      absorb(other) {
        super.absorb(other);
        this.isKeyboardKey = true;
      }
    }
    const custom = new CustomConfiguration();
    custom.absorb(child);
    assert.equal(custom.isSelected, true);
    assert.equal(custom.isKeyboardKey, true, 'The configuration extension point remains public');
  },
);

test(
  'public constructor and copyWith still read external options in source field order',
  { timeout },
  () => {
    const reads = [],
      options = new Proxy(
        { isImage: true, isChecked: CheckedState.mixed },
        {
          get(target, name, receiver) {
            reads.push(name);
            return Reflect.get(target, name, receiver);
          },
        },
      );
    const direct = new SemanticsFlags(options);
    assert.deepEqual(
      reads,
      fields.flatMap((name) =>
        name === 'isImage' || name === 'isChecked' ? [name, name] : [name],
      ),
    );
    reads.length = 0;
    const copied = direct.copyWith(options);
    assert.deepEqual(reads, fields);
    assert.equal(copied.isImage, true);
    assert.equal(copied.isChecked, CheckedState.mixed);
  },
);
