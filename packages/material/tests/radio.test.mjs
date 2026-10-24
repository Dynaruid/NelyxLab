// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import test from 'node:test';
import { Radio } from '@nelyx/material/radio';
import { RadioTheme, RadioThemeData } from '@nelyx/material/radio-theme';
import { Theme } from '@nelyx/material/theme';
import { ThemeData, MaterialTapTargetSize, VisualDensity } from '@nelyx/material/theme-data';
import { RadioGroupRegistry, RadioGroup } from '@nelyx/core/framework/widgets/radio-group';
import { ControlInteraction } from '@nelyx/core/framework/widgets/control-interaction';
import { Align, SizedBox, Builder, Row } from '@nelyx/core/framework/widgets/basic';
import { Directionality } from '@nelyx/core/framework/widgets/app-data';
import { Color } from '@nelyx/core/ui/color';
import { WidgetState, WidgetStateProperty, WidgetStatesController } from '@nelyx/core/framework/widgets/widget-state';
import { emptyWidgetStateSet } from '@nelyx/core/internal/framework/widgets/widget-state-full-collections';
import { sourceColorType } from '@nelyx/core/ui/color-source';
import { nullableDartType, dartDoubleType } from '@nelyx/core/foundation/dart-type-witness';
import { DartDouble } from '@nelyx/core/foundation/dart-numeric';
import { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { Shortcuts, SingleActivator } from '@nelyx/core/framework/widgets/shortcuts';
import { ActivateIntent } from '@nelyx/core/framework/widgets/actions';
import { LogicalKeyboardKey } from '@nelyx/core/services/keyboard-key';
import { BorderSide } from '@nelyx/core/framework/painting/borders';
import { WidgetStateBorderSide } from '@nelyx/core/framework/widgets/widget-state-border-side';
import { SystemMouseCursors } from '@nelyx/core/services/mouse-cursor';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { resolveRadioPaint, resolveRadioCursor } from '../dist/internal/radio/radio-build.js';
import { RadioPainter } from '../dist/internal/radio/radio-painter.js';
import { CupertinoRadio } from '@nelyx/cupertino/radio';
import { radioDefaultsM3 } from '../dist/internal/toggle/toggle-defaults.js';
import { fixture } from './root-fixture.mjs';

const timeout = 1_200_000;
FoundationPlatform.configure({kind: 'native', operatingSystem: 'windows'});
const property = callback => WidgetStateProperty.resolveWith(nullableDartType(sourceColorType), callback);
const color = argb => new Color(argb);
function defaults(f) {
  let result;
  const theme = new ThemeData({platform: 'windows'});
  f.set(new Theme(theme, new Builder(context => {result = radioDefaultsM3(context); return new SizedBox(1, 1);}))); 
  return {result, theme};
}

test('Radio M3 independent color/default/side resolution preserves caller states and numeric type', {timeout}, () => {
  const f = fixture();
  try {
    const {result: d, theme} = defaults(f), states = emptyWidgetStateSet();
    states.add(WidgetState.hovered);
    const p = resolveRadioPaint({value: 1}, new RadioThemeData(), d, states, false);
    assert.equal(p.activeColor.toARGB32(), theme.colorScheme.primary);
    assert.equal(p.inactiveColor.toARGB32(), theme.colorScheme.onSurface);
    assert.equal(p.innerRadius, 4.5);
    assert.equal(p.activeSide.width, 2);
    assert.equal(p.activeSide.strokeAlign, 0);
    assert.deepEqual([...states], [WidgetState.hovered]);
    const side = new BorderSide({width: 5, color: 0xff010203});
    const custom = resolveRadioPaint({value: 1, side, activeColor: color(0xff112233), backgroundColor: property(s => color(s.contains(WidgetState.selected) ? 0xff102030 : 0xff405060)), innerRadius: WidgetStateProperty.resolveWith(nullableDartType(dartDoubleType), () => DartDouble.fromSource(6))}, new RadioThemeData({fillColor: property(() => color(0xff334455))}), d, states, false);
    assert.equal(custom.activeColor.toARGB32(), 0xff112233);
    assert.equal(custom.inactiveColor.toARGB32(), 0xff334455);
    assert.equal(custom.activeSide.width, 2, 'Plain side applies to the inactive state only');
    assert.equal(custom.inactiveSide, side);
    assert.equal(custom.activeBackgroundColor.toARGB32(), 0xff102030);
    assert.equal(custom.inactiveBackgroundColor.toARGB32(), 0xff405060);
    assert.equal(custom.innerRadius, 6);
    const stateSide = WidgetStateBorderSide.resolveWith(s => new BorderSide({width: s.contains(WidgetState.selected) ? 3 : 4}));
    const resolved = resolveRadioPaint({value: 1, side: stateSide}, new RadioThemeData(), d, states, false);
    assert.equal(resolved.activeSide.width, 3); assert.equal(resolved.inactiveSide.width, 4);
    states.add(WidgetState.disabled);
    assert.equal(resolveRadioPaint({value: 1, activeColor: color(0xff112233)}, new RadioThemeData(), d, states, false).activeColor.toARGB32(), color(theme.colorScheme.onSurface).withOpacity(.38).toARGB32());
    assert.equal(resolveRadioCursor({value: 1}, new RadioThemeData(), states), SystemMouseCursors.basic);
    assert.equal(resolveRadioCursor({value: 1, mouseCursor: SystemMouseCursors.text}, new RadioThemeData(), states), SystemMouseCursors.text);
    assert.throws(() => resolveRadioPaint({value: 1, innerRadius: {resolve: () => 6}}, new RadioThemeData(), d, states, false), /DartDouble provenance/);
    const widget = new Radio({value: 1});
    assert.equal(widget.value, 1); assert.equal(widget.enabled, null); assert.equal(widget.toggleable, false);
    assert.equal(widget.innerRadius, null); assert.equal(widget.autofocus, false);
  } finally {f.close();}
});

test('typed Radio keyboard/semantic activation and keyed motion relocation retain the same live client', {timeout}, () => {
  const f = fixture(), token = Symbol('typed'), focus = new FocusNode(), key = new GlobalKey('moving-radio'), changes = [];
  const radio = () => new Radio({key, id: 'moving', value: 1, groupToken: token, focusNode: focus});
  const wrap = (value, moved) => new Shortcuts({shortcuts: new Map([[new SingleActivator(LogicalKeyboardKey.space), new ActivateIntent()]]), child: new Theme(new ThemeData({platform: 'windows'}), new Directionality('ltr', new RadioGroup({typeToken: token, groupValue: value, onChanged: next => changes.push(next), child: new Row(moved ? [new SizedBox(2, 2), radio()] : [radio(), new SizedBox(2, 2)])})))});
  try {
    f.set(wrap(0, false)); focus.requestFocus(); f.frame();
    const keyEvent = kind => ({kind, key: ' ', code: 'Space', shift: false, control: false, alt: false, meta: false, repeat: false});
    assert.equal(f.root.key(keyEvent('down')), true);
    f.root.key(keyEvent('up'));
    assert.deepEqual(changes, [1]);
    const previousElement = key.currentContext;
    f.set(wrap(1, false)); f.advance(70); f.set(wrap(1, true));
    assert.equal(key.currentContext, previousElement);
    f.advance(250);
    f.root.nodes.find(n => n.id === 'moving').activate();
    assert.deepEqual(changes, [1], 'Selected non-toggleable radio does not dispatch');
    f.set(new SizedBox(1, 1)); assert.equal(f.root.scheduler.transientCallbackCount, 0);
    focus.addListener(() => {});
  } finally {f.close(); focus.dispose();}
});

test('shared RawRadio visual owner preserves existing Cupertino registry and input lifecycle', {timeout}, () => {
  const f = fixture(), token = Symbol('cupertino'), changes = [];
  try {
    f.set(new Directionality('ltr', new Align(new RadioGroup({typeToken: token, groupValue: 'a', onChanged: value => changes.push(value), child: new CupertinoRadio({id: 'cupertino-radio', value: 'b', groupToken: token})}))));
    f.tap('cupertino-radio'); assert.deepEqual(changes, ['b']);
    f.set(new SizedBox(1, 1)); assert.equal(f.root.scheduler.transientCallbackCount, 0);
  } finally {f.close();}
});

test('Radio paint matches pinned 8px outer radius, 4.5px dot and selected background/side interpolation', {timeout}, () => {
  const f = fixture();
  try {
    const {result: d} = defaults(f), values = resolveRadioPaint({value: 1}, new RadioThemeData(), d, emptyWidgetStateSet(), false);
    const circles = [], canvas = {drawCircle(center, radius, paint) {circles.push({center, radius, paint});}};
    const motion = {previousValue: false, reaction: 0, reactionFocusFade: 0, reactionHoverFade: 0, downPosition: null};
    new RadioPainter({...values, ...motion, position: .5, isFocused: false, isHovered: false}).paint(canvas, {width: 48, height: 48});
    assert.deepEqual(circles.map(c => c.radius), [8, 8, 2.25]);
    assert(circles.every(c => c.center.dx === 24 && c.center.dy === 24));
    assert.equal(circles[1].paint.strokeWidth, 2);
    assert.equal(circles[1].paint.style, 'stroke');
  } finally {f.close();}
});

test('real Radio Root keeps one input owner, controlled motion, stale callback safety and borrowed owner lifetime', {timeout}, () => {
  class Registry extends RadioGroupRegistry {
    groupValue = 0; clients = new Set(); changes = [];
    onChanged = value => this.changes.push(value);
    registerClient(client) {this.clients.add(client);}
    unregisterClient(client) {this.clients.delete(client);}
  }
  const registry = new Registry(), f = fixture(), focus = new FocusNode(), controller = new WidgetStatesController(), key = new GlobalKey('radio');
  const wrap = (enabled = true) => new Theme(new ThemeData({platform: 'windows'}), new Directionality('ltr', new Align(new Radio({key, value: 1, id: 'radio', groupRegistry: registry, focusNode: focus, statesController: controller, enabled, toggleable: true}))));
  const painters = () => {const result = []; const visit = element => {if(element.widget?.painter instanceof RadioPainter)result.push(element.widget.painter); element.visitChildren(visit);};visit(f.root.root);return result;};
  try {
    f.set(wrap());
    assert.equal(registry.clients.size, 1);
    let inputs = 0; const visit = element => {if (element.widget instanceof ControlInteraction) inputs++; element.visitChildren(visit);}; visit(f.root.root);
    assert.equal(inputs, 1);
    const stale = f.root.nodes.find(n => n.id === 'radio').activate;
    f.tap('radio'); assert.deepEqual(registry.changes, [1]);
    assert.equal(painters()[0].options.position, 0, 'Owner must rebuild to change selection');
    registry.groupValue = 1; f.set(wrap()); f.advance(80);
    assert(painters()[0].options.position > 0 && painters()[0].options.position < 1);
    f.advance(200); assert.equal(painters()[0].options.position, 1);
    f.tap('radio'); assert.deepEqual(registry.changes, [1, null]);
    f.set(wrap(false)); stale?.(); f.tap('radio'); assert.deepEqual(registry.changes, [1, null]);
    f.set(new SizedBox(1, 1)); stale?.(); assert.equal(registry.clients.size, 0);
    assert.equal(f.root.scheduler.transientCallbackCount, 0);
    focus.addListener(() => {}); controller.addListener(() => {});
  } finally {f.close(); focus.dispose(); controller.dispose();}
});

test('Radio defaults disable missing group and typed nearest groups preserve hit size/theme updates', {timeout}, () => {
  const f = fixture(), token = Symbol('number'), changes = [], key = new GlobalKey('typed-radio');
  const wrap = (compact, groupValue = 0) => new Theme(new ThemeData({platform: 'windows'}), new RadioTheme(new RadioThemeData({materialTapTargetSize: compact ? MaterialTapTargetSize.shrinkWrap : MaterialTapTargetSize.padded, visualDensity: compact ? new VisualDensity({horizontal: -2, vertical: -2}) : VisualDensity.standard}), new Directionality('rtl', new Align(new RadioGroup({typeToken: token, groupValue, onChanged: value => changes.push(value), child: new Radio({key, groupToken: token, value: 1, id: 'typed'})})))));
  try {
    f.set(new Align(new Radio({value: 1, id: 'disabled'})));
    assert.equal(f.root.nodes.find(n => n.id === 'disabled').enabled, false);
    f.tap('disabled');
    f.set(wrap(false)); assert.equal(f.root.nodes.find(n => n.id === 'typed').bounds.width, 48);
    f.tap('typed'); assert.deepEqual(changes, [1]);
    f.set(wrap(true, 1)); assert.equal(f.root.nodes.find(n => n.id === 'typed').bounds.width, 32);
    assert.throws(() => new Radio({value: 1, groupValue: 0}), /typed RadioGroup/);
    assert.throws(() => new Radio({value: 1, splashRadius: -1}), /finite and nonnegative/);
    f.set(new SizedBox(1, 1)); assert.equal(f.root.scheduler.transientCallbackCount, 0);
  } finally {f.close();}
});
