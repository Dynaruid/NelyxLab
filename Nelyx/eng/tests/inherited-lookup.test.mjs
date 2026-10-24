// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {InheritedWidget} from '@nelyx/core/framework/widgets/framework';
import {Builder, Row, SizedBox} from '@nelyx/core/framework/widgets/basic';
import {GlobalKey} from '@nelyx/core/framework/widgets/global-key';
import {ValueKey} from '@nelyx/core/foundation/key';
import {fixture} from '../../../packages/material/tests/root-fixture.mjs';

const timeout = 1_200_000;
class DataScope extends InheritedWidget {
  constructor(value, child, key = null) {super(child, key); this.value = value;}
  updateShouldNotify(old) {return old.value !== this.value;}
}
class OtherScope extends DataScope {}
class DynamicScope extends DataScope {
  constructor(token, child) {super('dynamic', child); this.token = token;}
  get typeToken() {return this.token;}
}
function deep(child, count = 24) {
  for (let i = 0; i < count; i++) {const next = child; child = new Builder(() => next);}
  return child;
}

test('repeated nearest inherited reads and dependencies do not walk intermediate parents', {timeout}, () => {
  const f = fixture(); let context, observed, reads = 0;
  try {
    f.set(new DataScope('value', deep(new Builder(value => {context = value; return new SizedBox();}))));
    const parent = context.parent.parent, original = Object.getOwnPropertyDescriptor(parent, 'parent');
    Object.defineProperty(parent, 'parent', {configurable: true, get() {reads++; return original.value;}, set() {throw new Error('Unexpected reparent during lookup');}});
    try {
      for (let i = 0; i < 10; i++) {
        observed = context.getElementForInheritedWidgetOfExactType(DataScope);
        assert.equal(context.dependOn(DataScope).value, 'value');
        assert.equal(context.getElementForInheritedWidgetOfExactType(OtherScope), undefined);
      }
      assert.equal(reads, 0, 'Exact inherited queries must not traverse the same intermediate chain on every read');
    } finally {Object.defineProperty(parent, 'parent', original);}
    assert.equal(observed.dependents.get(context), null);
  } finally {f.close();}
});

test('nearest shadowing, current widget values and explicit outer dependencies retain their contracts', {timeout}, () => {
  const f = fixture(); let context;
  const leaf = new Builder(value => {context = value; return new SizedBox();});
  try {
    f.set(new DataScope('outer', new DataScope('inner', leaf)));
    const inner = context.getElementForInheritedWidgetOfExactType(DataScope);
    const outer = inner.getElementForInheritedWidgetOfExactType(DataScope);
    assert.equal(inner.widget.value, 'inner'); assert.equal(outer.widget.value, 'outer');
    assert.equal(outer.getElementForInheritedWidgetOfExactType(DataScope), undefined, 'Lookup remains ancestor-only even on an InheritedElement');
    assert.equal(context.dependOnInheritedElement(outer, 'explicit').value, 'outer');
    assert.deepEqual([...outer.dependents.get(context)], ['explicit']);
    f.set(new DataScope('new outer', new DataScope('new inner', leaf)));
    assert.equal(context.getElementForInheritedWidgetOfExactType(DataScope), inner);
    assert.equal(context.dependOn(DataScope).value, 'new inner');
    assert.equal(context.dependOnInheritedElement(outer).value, 'new outer');
  } finally {f.close();}
});

test('a GlobalKey move refreshes inherited scope and retires old dependencies', {timeout}, () => {
  const f = fixture(), key = new GlobalKey('moving-inherited-reader'), seen = []; let context;
  const leaf = new Builder(value => {context = value; seen.push(value.dependOn(DataScope).value); return new SizedBox();}, {key});
  const tree = right => new Row([
    new DataScope('left', right ? new SizedBox() : deep(leaf), new ValueKey('left')),
    new DataScope('right', right ? deep(leaf) : new SizedBox(), new ValueKey('right')),
  ]);
  try {
    f.set(tree(false)); const original = key.currentElement, old = context.getElementForInheritedWidgetOfExactType(DataScope);
    assert.equal(seen.at(-1), 'left');
    f.set(tree(true)); assert.equal(key.currentElement, original); assert.equal(context, original);
    assert.equal(context.dependOn(DataScope).value, 'right'); assert.equal(seen.at(-1), 'right');
    assert(!old.dependents.has(context), 'The previous scope must not retain the moved dependent');
    f.set(tree(false)); assert.equal(key.currentElement, original); assert.equal(context.dependOn(DataScope).value, 'left');
    f.set(new SizedBox()); assert.equal(key.currentElement, undefined);
    assert.throws(() => context.getElementForInheritedWidgetOfExactType(DataScope), {code: 'inactive-context'});
    assert.throws(() => context.dependOnInheritedElement(old), {code: 'invalid-inherited-element'});
  } finally {f.close();}
});

test('inherited dependencies reject sibling, self and other View owners', {timeout}, () => {
  const a = fixture(), b = fixture(); let context, sibling, foreign;
  try {
    a.set(new Row([new DataScope('one', new Builder(value => {context = value; return new SizedBox();})), new DataScope('sibling', new Builder(value => {sibling = value.getElementForInheritedWidgetOfExactType(DataScope); return new SizedBox();}))]));
    b.set(new DataScope('foreign', new Builder(value => {foreign = value.getElementForInheritedWidgetOfExactType(DataScope); return new SizedBox();})));
    assert.throws(() => context.dependOnInheritedElement(sibling), {code: 'invalid-inherited-element'});
    assert.throws(() => context.dependOnInheritedElement(foreign), {code: 'invalid-inherited-element'});
    assert.throws(() => sibling.dependOnInheritedElement(sibling), {code: 'invalid-inherited-element'});
    assert.equal(sibling.dependents.has(context), false); assert.equal(foreign.dependents.has(context), false);
  } finally {a.close(); b.close();}
});

test('custom inherited type getters and instance tokens remain live without a rebuild', {timeout}, () => {
  for (const own of [false, true]) {
    const f = fixture(); let context;
    const scope = own ? new DataScope('instance', deep(new Builder(value => {context = value; return new SizedBox();}))) : new DynamicScope(DataScope, deep(new Builder(value => {context = value; return new SizedBox();})));
    if (own) Object.defineProperty(scope, 'typeToken', {value: DataScope, writable: true, configurable: true});
    try {
      f.set(scope); const original = context.getElementForInheritedWidgetOfExactType(DataScope); assert(original);
      if (own) scope.typeToken = OtherScope; else scope.token = OtherScope;
      assert.equal(context.getElementForInheritedWidgetOfExactType(DataScope), undefined);
      assert.equal(context.getElementForInheritedWidgetOfExactType(OtherScope), original);
    } finally {f.close();}
  }
});

test('compatible canonical and custom type replacement refreshes retained descendant queries', {timeout}, () => {
  const f = fixture(); let context;
  const leaf = deep(new Builder(value => {context = value; return new SizedBox();}));
  try {
    f.set(new DataScope('canonical', leaf)); const original = context.getElementForInheritedWidgetOfExactType(DataScope);
    const dynamic = new DynamicScope(DataScope, leaf); f.set(dynamic);
    assert.equal(context.getElementForInheritedWidgetOfExactType(DataScope), original);
    dynamic.token = OtherScope;
    assert.equal(context.getElementForInheritedWidgetOfExactType(DataScope), undefined);
    assert.equal(context.getElementForInheritedWidgetOfExactType(OtherScope), original);
    // Restore the runtime token to make the next canonical widget compatible.
    dynamic.token = DataScope; f.set(new DataScope('canonical again', leaf));
    assert.equal(context.getElementForInheritedWidgetOfExactType(DataScope), original);
    assert.equal(context.dependOn(DataScope).value, 'canonical again');
  } finally {f.close();}
});
