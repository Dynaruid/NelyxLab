// SPDX-License-Identifier: BSD-3-Clause
import { RenderSemanticsAnnotations } from '@nelyx/core/framework/rendering/semantics-annotations';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CustomSemanticsAction,
  SemanticsConfiguration,
  SemanticsProperties,
} from '@nelyx/core/framework/semantics/semantics';
import { SemanticsAction } from '@nelyx/core/ui/semantics-action';
import { FoundationBuildMode } from '@nelyx/core/foundation/constants';
const timeout = 1_200_000;

test(
  'configuration defaults, sealed owners and copied annotations remain independent',
  { timeout },
  () => {
    const first = new SemanticsConfiguration(),
      untouched = new SemanticsConfiguration();
    Object.seal(first);
    first.label = 'First';
    first.textDirection = 'ltr';
    first.scrollPosition = -0;
    first.indexInParent = -0;
    const copy = first.copy();
    first.label = 'Changed';
    first.scrollPosition = 9;
    assert.equal(copy.label, 'First');
    assert(Object.is(copy.scrollPosition, -0));
    assert(Object.is(copy.indexInParent, -0));
    assert.equal(untouched.label, '');
    assert.equal(untouched.hasBeenAnnotated, false);
    assert.equal(untouched.scrollPosition, null);
    const destination = new SemanticsConfiguration();
    Object.preventExtensions(destination);
    destination.absorb(copy);
    assert.equal(destination.label, 'First');
    copy.label = 'Other';
    assert.equal(destination.label, 'First');
    const frozen = Object.freeze(new SemanticsConfiguration());
    assert.throws(() => {
      frozen.isSemanticBoundary = false;
    }, TypeError);
    assert.throws(() => {
      frozen.label = 'Blocked';
    }, TypeError);
    assert.equal(frozen.label, '');
    assert.equal(frozen.hasBeenAnnotated, false);
  },
);

test(
  'frozen annotation owners reject late changes without altering copies or action snapshots',
  { timeout },
  () => {
    const config = new SemanticsConfiguration(),
      calls = [];
    config.label = 'Original';
    config.onTap = () => calls.push('original');
    const copied = config.copy();
    Object.freeze(config);
    assert.throws(() => {
      config.label = 'Blocked';
    }, TypeError);
    assert.equal(config.label, 'Original');
    assert.throws(() => {
      config.onTap = () => calls.push('replacement');
    }, TypeError);
    config.onTap();
    config.getActionHandler(SemanticsAction.tap)(null);
    copied.getActionHandler(SemanticsAction.tap)(null);
    assert.deepEqual(calls, ['original', 'replacement', 'original']);
    assert.equal(copied.label, 'Original');
    const empty = new SemanticsConfiguration();
    empty.label = 'Fresh';
    assert.equal(empty.label, 'Fresh');
  },
);

test(
  'semantics callbacks preserve identity, replacement, failed assignment and handler snapshots',
  { timeout },
  () => {
    const config = new SemanticsConfiguration(),
      calls = [],
      original = () => calls.push('original'),
      replacement = () => calls.push('replacement');
    assert.equal(config.onTap, null);
    assert.equal(config.hasBeenAnnotated, false);
    config.onTap = original;
    const handler = config.getActionHandler(SemanticsAction.tap);
    assert.equal(config.onTap, original);
    assert.equal(config.hasBeenAnnotated, true);
    const copied = config.copy(),
      absorbed = new SemanticsConfiguration();
    absorbed.absorb(config);
    config.onTap = replacement;
    assert.throws(() => {
      config.onTap = null;
    }, /cannot be null/);
    assert.equal(config.onTap, replacement);
    handler(null);
    copied.getActionHandler(SemanticsAction.tap)(null);
    absorbed.getActionHandler(SemanticsAction.tap)(null);
    config.getActionHandler(SemanticsAction.tap)(null);
    assert.deepEqual(calls, ['original', 'original', 'original', 'replacement']);
    assert.equal(copied.onTap, null);
    assert.equal(
      absorbed.onTap,
      null,
      'Merging action handlers does not assign source callback properties',
    );
    const empty = new SemanticsConfiguration();
    assert.throws(() => {
      empty.onLongPress = null;
    }, /cannot be null/);
    assert.equal(empty.hasBeenAnnotated, false);
    assert.equal(empty.getActionHandler(SemanticsAction.longPress), null);
  },
);

test(
  'text and scroll action adapters validate arguments before invoking the original callback',
  { timeout },
  () => {
    const mode = FoundationBuildMode.mode;
    FoundationBuildMode.mode = 'release';
    try {
      const config = new SemanticsConfiguration(),
        calls = [];
      const reveal = (value) => calls.push(['reveal', value]),
        offset = (value) => calls.push(['offset', value.dx, value.dy]);
      const selection = (value) => calls.push(['selection', value.baseOffset, value.extentOffset]),
        text = (value) => calls.push(['text', value]);
      config.onShowOnScreen = reveal;
      config.onScrollToOffset = offset;
      config.onSetSelection = selection;
      config.onSetText = text;
      for (const [property, callback] of [
        ['onShowOnScreen', reveal],
        ['onScrollToOffset', offset],
        ['onSetSelection', selection],
        ['onSetText', text],
      ])
        assert.equal(config[property], callback);
      const show = config.getActionHandler(SemanticsAction.showOnScreen),
        scroll = config.getActionHandler(SemanticsAction.scrollToOffset),
        select = config.getActionHandler(SemanticsAction.setSelection),
        setText = config.getActionHandler(SemanticsAction.setText);
      show(null);
      show({ start: 1, end: 3, alignToTop: false });
      scroll(new Float64Array([4, 8]));
      select(
        new Map([
          ['base', 3],
          ['extent', 1],
        ]),
      );
      setText('A😀');
      assert.deepEqual(calls, [
        ['reveal', undefined],
        ['reveal', { start: 1, end: 3, alignToTop: false }],
        ['offset', 4, 8],
        ['selection', 3, 1],
        ['text', 'A😀'],
      ]);
      assert(Object.isFrozen(calls[1][1]));
      for (const invalid of [
        { start: 3, end: 1, alignToTop: true },
        { start: 0, end: 1, alignToTop: 1 },
      ])
        assert.throws(() => show(invalid), /ordered UTF-16 range/);
      assert.throws(() => scroll([1, 2]), /Float64Array/);
      assert.throws(
        () =>
          select(
            new Map([
              ['base', 0.5],
              ['extent', 1],
            ]),
          ),
        /integers/,
      );
      assert.throws(() => setText(1), /string/);
      assert.equal(calls.length, 5);
      const failure = new Error('callback failure');
      config.onSetText = () => {
        throw failure;
      };
      assert.throws(
        () => config.getActionHandler(SemanticsAction.setText)('text'),
        (error) => error === failure,
      );
      config.onScrollToOffset = null;
      assert.equal(config.onScrollToOffset, null);
      assert.throws(
        () => config.getActionHandler(SemanticsAction.scrollToOffset)([]),
        /Float64Array/,
      );
      assert.throws(
        () => config.getActionHandler(SemanticsAction.scrollToOffset)(new Float64Array([1, 2])),
        /cannot be null/,
      );
    } finally {
      FoundationBuildMode.mode = mode;
    }
  },
);

test(
  'cursor actions keep independent handlers and debug validation without sharing callback state',
  { timeout },
  () => {
    const mode = FoundationBuildMode.mode;
    FoundationBuildMode.mode = 'debug';
    try {
      const a = new SemanticsConfiguration(),
        b = new SemanticsConfiguration(),
        calls = [];
      const character = (value) => calls.push(['character', value]),
        word = (value) => calls.push(['word', value]);
      a.onMoveCursorForwardByCharacter = character;
      a.onMoveCursorForwardByWord = word;
      a.getActionHandler(SemanticsAction.moveCursorForwardByCharacter)(false);
      a.getActionHandler(SemanticsAction.moveCursorForwardByWord)(true);
      assert.deepEqual(calls, [
        ['character', false],
        ['word', true],
      ]);
      assert.equal(b.onMoveCursorForwardByCharacter, null);
      assert.equal(b.getActionHandler(SemanticsAction.moveCursorForwardByWord), null);
      assert.throws(() => {
        a.onMoveCursorBackwardByCharacter = null;
      }, /cannot be null/);
      assert.equal(a.getActionHandler(SemanticsAction.moveCursorBackwardByCharacter), null);
      assert.throws(
        () => a.getActionHandler(SemanticsAction.moveCursorForwardByWord)(0),
        /boolean/,
      );
      a.onTap = () => calls.push(['tap']);
      assert.throws(() => a.getActionHandler(SemanticsAction.tap)(1), /no arguments/);
    } finally {
      FoundationBuildMode.mode = mode;
    }
  },
);

test(
  'JavaScript callback values and frozen-configuration failures retain their existing behavior',
  { timeout },
  () => {
    const config = new SemanticsConfiguration();
    config.onTap = undefined;
    assert.equal(
      config.onTap,
      undefined,
      'A supplied undefined callback is distinct from an unassigned callback',
    );
    assert.throws(() => config.getActionHandler(SemanticsAction.tap)(null), TypeError);
    assert.equal(config.copy().onTap, null);
    const calls = [],
      original = () => calls.push('original'),
      replacement = () => calls.push('replacement'),
      frozen = new SemanticsConfiguration();
    frozen.onTap = original;
    Object.freeze(frozen);
    assert.throws(() => {
      frozen.onTap = replacement;
    }, TypeError);
    assert.equal(frozen.onTap, original);
    // Registration precedes the protected fields: a failed setter still has
    // the established handler replacement, while its callback getter is intact.
    frozen.getActionHandler(SemanticsAction.tap)(null);
    assert.deepEqual(calls, ['replacement']);
    const empty = Object.freeze(new SemanticsConfiguration());
    assert.equal(empty.onLongPress, null);
    assert.throws(() => {
      empty.onLongPress = undefined;
    }, TypeError);
    assert.equal(empty.onLongPress, null);
    assert.throws(() => empty.getActionHandler(SemanticsAction.longPress)(null), TypeError);
  },
);

test(
  'custom action maps retain live getter identity, supplied aliases and independent copied entries',
  { timeout },
  () => {
    const config = new SemanticsConfiguration(),
      other = new SemanticsConfiguration(),
      action = new CustomSemanticsAction({ label: 'Custom map' }),
      calls = [];
    const first = () => calls.push('first'),
      second = () => calls.push('second'),
      view = config.customSemanticsActions;
    assert.equal(config.customSemanticsActions, view);
    assert.notEqual(other.customSemanticsActions, view);
    view.set(action, first);
    assert.equal(config.hasBeenAnnotated, false);
    assert.equal(
      config.getActionHandler(SemanticsAction.customAction),
      null,
      'Reading or mutating the map alone does not register a handler',
    );
    const copied = config.copy();
    assert.notEqual(copied.customSemanticsActions, view);
    assert.equal(copied.customSemanticsActions.get(action), first);
    view.set(action, second);
    assert.equal(copied.customSemanticsActions.get(action), first);
    const supplied = new Map([[action, first]]);
    config.customSemanticsActions = supplied;
    assert.equal(config.customSemanticsActions, supplied);
    const registeredCopy = config.copy(),
      id = CustomSemanticsAction.getIdentifier(action);
    supplied.set(action, second);
    config.getActionHandler(SemanticsAction.customAction)(id);
    registeredCopy.getActionHandler(SemanticsAction.customAction)(id);
    assert.deepEqual(
      calls,
      ['second', 'second'],
      'Copied dispatch keeps the existing source handler receiver',
    );
    assert.equal(registeredCopy.customSemanticsActions.get(action), first);
    const frozen = Object.freeze(new SemanticsConfiguration()),
      frozenView = frozen.customSemanticsActions;
    assert.equal(frozen.customSemanticsActions, frozenView);
    frozenView.set(action, first);
    assert.equal(frozen.copy().customSemanticsActions.get(action), first);
    assert.throws(() => {
      frozen.onLongPress = first;
    }, TypeError);
    frozen.getActionHandler(SemanticsAction.longPress)(null);
    assert.deepEqual(calls, ['second', 'second', 'first']);
  },
);

test(
  'absorbing custom actions preserves destination map identity and equal action keys while filtering blocked handlers',
  { timeout },
  () => {
    const parent = new SemanticsConfiguration(),
      child = new SemanticsConfiguration(),
      first = new CustomSemanticsAction({ label: 'Equal custom' }),
      equal = new CustomSemanticsAction({ label: 'Equal custom' }),
      calls = [];
    const retained = parent.customSemanticsActions;
    retained.set(first, () => calls.push('parent'));
    child.customSemanticsActions = new Map([[equal, () => calls.push('child')]]);
    child.onTap = () => calls.push('tap');
    child.onDidGainAccessibilityFocus = () => calls.push('accessibility');
    child.isBlockingUserActions = true;
    parent.absorb(child);
    assert.equal(parent.customSemanticsActions, retained);
    assert.deepEqual([...retained.keys()], [first]);
    retained.get(first)();
    assert.equal(parent.getActionHandler(SemanticsAction.tap), null);
    assert.equal(parent.getActionHandler(SemanticsAction.customAction), null);
    parent.getActionHandler(SemanticsAction.didGainAccessibilityFocus)(null);
    assert.deepEqual(calls, ['child', 'accessibility']);
  },
);

test(
  'annotation handlers stay stable and read current properties with their original receiver and arguments',
  { timeout },
  () => {
    const names = [
        'onTap',
        'onLongPress',
        'onDismiss',
        'onScrollLeft',
        'onScrollRight',
        'onScrollUp',
        'onScrollDown',
        'onIncrease',
        'onDecrease',
        'onCopy',
        'onCut',
        'onPaste',
        'onMoveCursorForwardByCharacter',
        'onMoveCursorBackwardByCharacter',
        'onMoveCursorForwardByWord',
        'onMoveCursorBackwardByWord',
        'onSetSelection',
        'onSetText',
        'onDidGainAccessibilityFocus',
        'onDidLoseAccessibilityFocus',
        'onFocus',
        'onExpand',
        'onCollapse',
      ],
      calls = [];
    for (const name of names) {
      const properties = (version) =>
          new SemanticsProperties({
            [name]: function (...args) {
              calls.push({ name, version, receiver: this, args });
            },
          }),
        render = new RenderSemanticsAnnotations({ properties: properties(1) }),
        first = new SemanticsConfiguration();
      // Keep the existing port's word-setter bookkeeping: its callback getter is
      // the character field, while action dispatch remains word-specific.
      const field = name.endsWith('ByWord') ? name.replace('ByWord', 'ByCharacter') : name;
      try {
        render.describeSemanticsConfiguration(first);
        const wrapper = first[field];
        assert.equal(typeof wrapper, 'function', name);
        render.properties = properties(2);
        const second = new SemanticsConfiguration();
        render.describeSemanticsConfiguration(second);
        assert.equal(second[field], wrapper, name);
        const args = name.startsWith('onMoveCursor')
          ? [true]
          : name === 'onSetText'
            ? ['updated']
            : name === 'onSetSelection'
              ? [{ baseOffset: 1, extentOffset: 2 }]
              : [];
        wrapper(...args);
        assert.deepEqual(calls.at(-1), { name, version: 2, receiver: render.properties, args });
        render.properties = new SemanticsProperties();
        const empty = new SemanticsConfiguration();
        render.describeSemanticsConfiguration(empty);
        const before = calls.length;
        assert.equal(empty[field], null);
        wrapper(...args);
        assert.equal(
          calls.length,
          before,
          'Removed callbacks do not remain captured by an old configuration',
        );
      } finally {
        render.dispose();
      }
    }
  },
);
