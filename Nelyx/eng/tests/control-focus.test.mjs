// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import test from 'node:test';
import {ControlInteraction} from '@nelyx/core/framework/widgets/control-interaction';
import {AppFocus} from '@nelyx/core/framework/widgets/app-focus';
import {FocusNode} from '@nelyx/core/framework/widgets/focus';
import {Align, SizedBox} from '@nelyx/core/framework/widgets/basic';
import {fixture} from '../../../packages/material/tests/root-fixture.mjs';
import {FoundationPlatform} from '@nelyx/core/foundation/platform';

FoundationPlatform.configure({kind: 'web', operatingSystem: 'windows'});

test('semantic focus selects the actual control for Enter/Space and rejects replaced, disabled and retired focus actions', {timeout: 1_200_000}, async () => {
  const f = fixture(), first = new FocusNode(), second = new FocusNode(), events = [];
  const wrap = (focusNode, enabled = true) => new AppFocus(new Align(new ControlInteraction(() => new SizedBox(50, 30), {
    focusNode, enabled, onPressed: enabled ? () => events.push('activate') : null,
    semantics: {transportId: 'control', button: true, label: 'Control', onFocus: () => events.push('focus')},
  })));
  const control = () => f.root.nodes.find(node => node.id === 'control');
  const press = key => {
    const code = key === ' ' ? 'Space' : 'Enter';
    for (const kind of ['down', 'up']) f.root.key({kind, key, code, shift: false, control: false, alt: false, meta: false, repeat: false});
    f.frame();
  };
  try {
    f.set(wrap(first));
    const stale = control().actions.focus;
    stale(); await Promise.resolve(); f.frame();
    assert(first.hasFocus); assert.equal(control().focused, true);
    press('Enter'); press(' ');
    assert.deepEqual(events, ['focus', 'activate', 'activate']);
    f.set(wrap(second));
    stale(); await Promise.resolve(); f.frame();
    assert.equal(second.hasFocus, false); assert.equal(events.length, 3);
    const current = control().actions.focus;
    current(); await Promise.resolve(); f.frame(); assert(second.hasFocus); press('Enter');
    assert.deepEqual(events, ['focus', 'activate', 'activate', 'focus', 'activate']);
    f.set(wrap(second, false));
    assert.equal(control().actions?.focus, undefined);
    current(); press('Enter'); assert.equal(events.length, 5);
    f.set(new SizedBox());
    current(); stale(); assert.equal(events.length, 5);
    assert.equal(f.root.scheduler.transientCallbackCount, 0);
    first.addListener(() => {}); second.addListener(() => {});
  } finally {f.close(); first.dispose(); second.dispose();}
});
