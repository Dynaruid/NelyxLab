// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import test from 'node:test';
import { freezeEditorStyle } from '@nelyx/core/hosting/editor-style';
import { freezeSemantics } from '@nelyx/core/framework/semantics/semantics';
import { nativeEditorStyle } from '../../sdk/dist/backends/editor-style.js';
const timeout = 1_200_000;
const style = {
  fontFamilies: ['App "Text"', 'Fallback'],
  fontSize: 20,
  fontWeight: 500,
  fontStyle: 'italic',
  lineHeight: 30,
  letterSpacing: 0.5,
  wordSpacing: 0,
  color: 0xff112233,
  backgroundColor: 0,
  cursorColor: 0xff445566,
  selectionColor: 0x80445566,
  textAlign: 'end',
  textDirection: 'rtl',
};
test(
  'editor styles are validated, frozen and transported independently of mutable caller input',
  { timeout },
  () => {
    const caller = { ...style, fontFamilies: [...style.fontFamilies] },
      node = {
        id: 'editor',
        role: 'text-field',
        name: 'Name',
        enabled: true,
        bounds: { x: 0, y: 0, width: 160, height: 30 },
        editorStyle: caller,
      };
    const [snapshot] = freezeSemantics([node]);
    caller.fontFamilies[0] = 'Changed';
    caller.fontSize = 5;
    assert.equal(snapshot.editorStyle.fontFamilies[0], 'App "Text"');
    assert.equal(snapshot.editorStyle.fontSize, 20);
    assert(Object.isFrozen(snapshot.editorStyle));
    assert(Object.isFrozen(snapshot.editorStyle.fontFamilies));
    for (const patch of [
      { fontSize: 0 },
      { lineHeight: Infinity },
      { fontFamilies: ['bad\nfont'] },
      { fontWeight: 99 },
      { color: -1 },
      { textAlign: 'auto' },
      { textDirection: 'auto' },
    ])
      assert.throws(() => freezeEditorStyle({ ...style, ...patch }), /Editor|Invalid/);
    assert.throws(() => freezeSemantics([{ ...node, role: 'button' }]), /Only text fields/);
  },
);
test(
  'remaining native projections retain scaled metrics and direction for transitional carriers',
  { timeout },
  () => {
    const native = nativeEditorStyle(style);
    assert.equal(native.fontSize, 20);
    assert.equal(native.lineHeight, 30);
    assert.equal(native.textAlign, 'left');
    assert.equal(native.includeFontPadding, false);
    assert.equal(native.padding, 0);
    assert.equal(nativeEditorStyle(style, true).textAlignVertical, 'top');
    assert.throws(() => nativeEditorStyle({ ...style, wordSpacing: 1 }), /unavailable/);
  },
);
