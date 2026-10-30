// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LengthLimitingTextInputFormatter,
  PredicateTextInputFormatter,
  TextInputFormatter,
  TextEditingDelta,
  snapshotEditingContent,
} from '@nelyx/core/services/input-formatters';
import { EditableText, TextEditingController } from '@nelyx/core/framework/widgets/editable-text';
import { SelectionChangedCause, TextEditingValue } from '@nelyx/core/services/text-input';
import { TextSelection } from '@nelyx/core/services/text-editing';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { EditingSession } from '@nelyx/core/ui/editing';
import { SizedBox } from '@nelyx/core/framework/widgets/basic';
import { engineFixture } from '../../../packages/material/tests/engine-fixture.mjs';

const timeout = 1_200_000;
FoundationPlatform.configure({ kind: 'web', operatingSystem: 'windows' });
const content = (
  text,
  selection = { anchor: text.length, focus: text.length },
  composing = { status: 'none' },
) => snapshotEditingContent({ text, selection, composing });
function observedInput(f) {
  const records = [];
  f.root.context.editing = {
    capabilities: { indexUnit: 'utf16', composing: 'observed', selectionDirection: 'observed' },
    bind(owner, initial, changed) {
      const session = new EditingSession(owner, initial),
        publish = (value, source) => {
          assert(
            session.update({
              ...session.value,
              ...value,
              source,
              revision: session.value.revision + 1,
            }),
          );
          changed(session.value);
        };
      const record = {
        replacements: [],
        disposed: false,
        readGeometry: undefined,
        native: (value) => publish(value, 'native'),
        get value() {
          return session.value;
        },
      };
      records.push(record);
      return {
        read: () => session.value,
        readGeometry: () => {
          record.readGeometry?.();
          return { status: 'unavailable' };
        },
        replace: (value) => {
          record.replacements.push(value);
          publish(value, 'programmatic');
        },
        get isComposing() {
          return session.value.composing.status === 'active';
        },
        focus() {},
        blur() {},
        dispose() {
          record.disposed = true;
          session.dispose();
        },
      };
    },
  };
  return records;
}
const editor = (controller, options = {}, key = null) =>
  new EditableText('formatter', controller, 'Formatter', undefined, 48, key, options);

test(
  'length limits retain whole extended graphemes and UTF-16 directional selection',
  { timeout },
  () => {
    // Explicit independent Unicode examples: decomposed accent, emoji sequences,
    // regional indicators, Hangul jamo, CRLF and enclosing keycap.
    const clusters = ['e\u0301', '👨‍👩‍👧‍👦', '🇰🇷', '👍🏽', '\u1100\u1161\u11a8', '\r\n', '1\ufe0f\u20e3'];
    const formatter = new LengthLimitingTextInputFormatter(1);
    for (const cluster of clusters) {
      const next = content(cluster + 'x');
      const actual = formatter.formatEditUpdate(content(''), next);
      assert.equal(actual.text, cluster);
      assert.deepEqual(actual.selection, { anchor: cluster.length, focus: cluster.length });
      assert(Object.isFrozen(actual));
      assert.equal(
        formatter.formatEditUpdate(actual, actual),
        actual,
        'Unchanged edits keep their identity',
      );
    }
    const next = content('e\u0301x', { anchor: 3, focus: 0 });
    assert.deepEqual(formatter.formatEditUpdate(content(''), next).selection, {
      anchor: 2,
      focus: 0,
    });
    assert.equal(
      new LengthLimitingTextInputFormatter(0).formatEditUpdate(content(''), next).text,
      '',
    );
    const all = content(clusters.join(''));
    assert.equal(
      new LengthLimitingTextInputFormatter(clusters.length).formatEditUpdate(content(''), all),
      all,
    );
    for (const invalid of [-1, 0.5, NaN, Infinity])
      assert.throws(() => new LengthLimitingTextInputFormatter(invalid));
  },
);

test('length limits leave active composition untouched and apply on commit', { timeout }, () => {
  const formatter = new LengthLimitingTextInputFormatter(1);
  const active = content('각e\u0301', undefined, { status: 'active', start: 0, end: 5 });
  assert.equal(formatter.formatEditUpdate(content(''), active), active);
  const committed = formatter.formatEditUpdate(active, content(active.text));
  assert.equal(committed.text, '각');
  assert.deepEqual(committed.selection, { anchor: 3, focus: 3 });
});

test(
  'actual EditableText commits one grapheme through delta/undo/redo and retires its host binding',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController(),
      edits = [];
    let host;
    f.root.context.editing = {
      capabilities: { indexUnit: 'utf16', composing: 'observed', selectionDirection: 'observed' },
      bind(owner, initial, changed) {
        const session = new EditingSession(owner, initial);
        let disposed = false;
        const replace = (value) => {
          assert(!disposed);
          assert(session.update({ ...value, revision: session.value.revision + 1 }));
          changed(session.value);
        };
        host = {
          replace,
          get disposed() {
            return disposed;
          },
          native: (text, composing = { status: 'none' }) =>
            replace({
              ...session.value,
              text,
              selection: { anchor: text.length, focus: text.length },
              composing,
              source: 'native',
            }),
        };
        return {
          read: () => session.value,
          replace,
          get isComposing() {
            return session.value.composing.status === 'active';
          },
          focus() {},
          blur() {},
          dispose() {
            assert(!disposed);
            disposed = true;
            session.dispose();
          },
        };
      },
    };
    try {
      f.set(
        new EditableText('grapheme', controller, 'Name', undefined, 48, null, {
          inputFormatters: [new LengthLimitingTextInputFormatter(1)],
          onChanged: (text) => edits.push(text),
        }),
      );
      host.native('e\u0301x', { status: 'active', start: 0, end: 3 });
      assert.equal(controller.text, 'e\u0301x');
      assert.equal(controller.canUndo, false);
      host.native('e\u0301x');
      assert.equal(controller.text, 'e\u0301');
      assert.equal(edits.at(-1), 'e\u0301');
      assert(controller.undo());
      assert.equal(controller.text, '');
      assert(controller.redo());
      assert.equal(controller.text, 'e\u0301');
      controller.applyDelta(
        new TextEditingDelta({
          oldText: 'e\u0301',
          start: 0,
          end: 2,
          text: '🇰🇷',
          selection: { anchor: 4, focus: 4 },
        }),
      );
      assert.equal(controller.text, '🇰🇷');
      assert(controller.undo());
      assert.equal(controller.text, 'e\u0301');
      f.set(new SizedBox());
      assert.equal(host.disposed, true);
      assert.equal(f.root.scheduler.transientCallbackCount, 0);
      controller.addListener(() => {}); // The caller retains its controller.
    } finally {
      await f.close();
      controller.dispose();
    }
  },
);

test(
  'native selection/range observations skip formatters and actual composition completion formats once',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController('AB'),
      records = observedInput(f),
      calls = [];
    const formatter = TextInputFormatter.withFunction((old, next) => {
      calls.push([old, next]);
      return next;
    });
    try {
      f.set(editor(controller, { inputFormatters: [formatter] }));
      records[0].native(content('AB', { anchor: 1, focus: 1 }));
      assert.equal(calls.length, 0);
      records[0].native(
        content('한AB', { anchor: 1, focus: 1 }, { status: 'active', start: 0, end: 1 }),
      );
      records[0].native(
        content('한AB', { anchor: 2, focus: 1 }, { status: 'active', start: 0, end: 2 }),
      );
      assert.equal(calls.length, 0, 'Observed active composition is not rewritten');
      records[0].native(content('한AB', { anchor: 2, focus: 1 }));
      assert.equal(calls.length, 1);
      assert.equal(
        calls[0][0].text,
        'AB',
        'The nonvisual transport retains its pre-composition validation base',
      );
      assert.equal(calls[0][1].text, '한AB');
      records[0].native(content('한AB', { anchor: 0, focus: 0 }));
      assert.equal(calls.length, 1);
      assert.equal(records[0].replacements.length, 0);
    } finally {
      await f.close();
      controller.dispose();
    }
  },
);

test(
  'native and public formatter failures report once and apply the unformatted input atomically',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController('old'),
      records = observedInput(f),
      key = new GlobalKey('formatter error'),
      changes = [],
      reports = [],
      owner = f.root.buildOwner,
      report = owner.reportError;
    owner.reportError = (details) => reports.push(details);
    const upper = TextInputFormatter.withFunction((_old, next) => ({
        ...next,
        text: next.text.toUpperCase(),
      })),
      fail = TextInputFormatter.withFunction(() => {
        throw Error('formatter failure');
      });
    try {
      f.set(
        editor(
          controller,
          { inputFormatters: [upper, fail], onChanged: (text) => changes.push(text) },
          key,
        ),
      );
      assert.doesNotThrow(() => records[0].native(content('native')));
      assert.equal(controller.text, 'native');
      assert.equal(records[0].replacements.length, 0);
      assert.equal(reports.length, 1);
      assert.match(reports[0].exception.message, /formatter failure/);
      key.currentState.userUpdateTextEditingValue(
        new TextEditingValue({ text: 'public', selection: TextSelection.collapsed(6) }),
        SelectionChangedCause.keyboard,
      );
      assert.equal(controller.text, 'public');
      assert.deepEqual(changes, ['native', 'public']);
      assert.equal(reports.length, 2);
      assert.equal(records[0].replacements.at(-1).text, 'public');
    } finally {
      owner.reportError = report;
      await f.close();
      controller.dispose();
    }
  },
);

test(
  'a reentrant native formatter cannot overwrite a newer Core command or call later formatters',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController('old'),
      records = observedInput(f),
      changes = [];
    let later = 0;
    const edit = TextInputFormatter.withFunction((_old, next) => {
        controller.text = 'newer';
        return { ...next, text: 'stale' };
      }),
      after = TextInputFormatter.withFunction((_old, next) => {
        later++;
        return next;
      });
    try {
      f.set(
        editor(controller, {
          inputFormatters: [edit, after],
          onChanged: (text) => changes.push(text),
        }),
      );
      records[0].native(content('incoming'));
      assert.equal(controller.text, 'newer');
      assert.equal(records[0].value.text, 'newer');
      assert.equal(later, 0);
      assert.deepEqual(changes, []);
      assert(records[0].replacements.every((value) => value.text === 'newer'));
    } finally {
      await f.close();
      controller.dispose();
    }
  },
);

test(
  'a native formatter can replace and dispose its logical controller without receiving the stale input',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController('old'),
      replacement = new TextEditingController('replacement'),
      records = observedInput(f);
    let retired = false,
      later = 0;
    const replace = TextInputFormatter.withFunction((_old, next) => {
        f.set(editor(replacement));
        controller.dispose();
        retired = true;
        return next;
      }),
      after = TextInputFormatter.withFunction((_old, next) => {
        later++;
        return next;
      });
    try {
      f.set(editor(controller, { inputFormatters: [replace, after] }));
      assert.doesNotThrow(() => records[0].native(content('incoming')));
      assert.equal(replacement.text, 'replacement');
      assert.equal(records[0].disposed, true);
      assert.equal(records.length, 2);
      assert.equal(records[1].replacements.length, 0);
      assert.equal(later, 0);
    } finally {
      await f.close();
      if (!retired) controller.dispose();
      replacement.dispose();
    }
  },
);

test(
  'formatter rejection preserves observed availability and invented active composition is reported instead of accepted',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController('old'),
      records = observedInput(f),
      reports = [],
      owner = f.root.buildOwner,
      report = owner.reportError;
    owner.reportError = (details) => reports.push(details);
    try {
      f.set(
        editor(controller, {
          inputFormatters: [new PredicateTextInputFormatter((text) => text !== 'bad')],
        }),
      );
      records[0].native(content('bad'));
      assert.equal(controller.text, 'old');
      assert.deepEqual(
        controller.composing,
        { status: 'none' },
        'Rejecting text cannot downgrade the actual observed OS capability to unavailable',
      );
      assert.equal(reports.length, 0);
      f.set(
        editor(controller, {
          inputFormatters: [
            TextInputFormatter.withFunction((_old, next) => ({
              ...next,
              composing: { status: 'active', start: 0, end: 1 },
            })),
          ],
        }),
      );
      records[0].native(content('new'));
      assert.equal(controller.text, 'new');
      assert.equal(controller.isComposing, false);
      assert.equal(reports.length, 1);
      assert.match(reports[0].exception.message, /cannot create an observed OS composition/);
    } finally {
      owner.reportError = report;
      await f.close();
      controller.dispose();
    }
  },
);

test(
  'a reentrant host geometry read cannot let an older native event overwrite the newer document',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      controller = new TextEditingController('old'),
      records = observedInput(f),
      changes = [];
    try {
      f.set(editor(controller, { onChanged: (text) => changes.push(text) }));
      records[0].readGeometry = () => {
        records[0].readGeometry = undefined;
        controller.text = 'geometry observer';
      };
      records[0].native(content('incoming'));
      assert.equal(controller.text, 'geometry observer');
      assert.equal(records[0].value.text, 'geometry observer');
      assert.deepEqual(changes, []);
    } finally {
      await f.close();
      controller.dispose();
    }
  },
);
