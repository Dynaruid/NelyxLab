import { assertParagraphOwnership } from './engine-fixture.mjs';
// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { CheckboxListTile } from '../dist/checkbox-list-tile.js';
import { RadioListTile } from '../dist/radio-list-tile.js';
import { SwitchListTile } from '../dist/switch-list-tile.js';
import { Checkbox } from '@nelyx/material/checkbox';
import { Radio } from '@nelyx/material/radio';
import { Switch } from '@nelyx/material/switch';
import { Theme } from '@nelyx/material/theme';
import { ThemeData, VisualDensity } from '@nelyx/material/theme-data';
import { Material } from '@nelyx/material/material';
import { ListTile, ListTileControlAffinity } from '@nelyx/material/list-tile';
import { ListTileTheme, ListTileThemeData } from '@nelyx/material/list-tile-theme';
import { SizedBox, Align, Column } from '@nelyx/core/framework/widgets/basic';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { RadioGroup, RadioGroupRegistry } from '@nelyx/core/framework/widgets/radio-group';
import { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { WidgetStatesController } from '@nelyx/core/framework/widgets/widget-state';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { Shortcuts, SingleActivator } from '@nelyx/core/framework/widgets/shortcuts';
import { ActivateIntent } from '@nelyx/core/framework/widgets/actions';
import { LogicalKeyboardKey } from '@nelyx/core/services/keyboard-key';
import { CustomPaint } from '@nelyx/core/framework/widgets/custom-paint';
import { Offset } from '@nelyx/core/ui/offset';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { fixture } from './root-fixture.mjs';
import { CupertinoCheckbox } from '@nelyx/cupertino/checkbox';
import { CupertinoRadio } from '@nelyx/cupertino/radio';
import { Tristate } from '@nelyx/core/ui/semantics';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import '@nelyx/core/foundation/constants';
import { listTileDefaults } from '../dist/internal/list/list-tile-build.js';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { Text } from '@nelyx/core/framework/widgets/basic';
import { GestureDetector } from '@nelyx/core/framework/widgets/gesture-detector';
import { WebSkiaLibrary } from '@nelyx/skia-web/library';
import { AssetBundle } from '@nelyx/core/services/asset-bundle';
import { DefaultAssetBundle } from '@nelyx/core/framework/widgets/default-asset-bundle';
class NoAssets extends AssetBundle {
  async load(key) {
    throw Error('Primitive tile checks declare no asset: ' + key);
  }
}
const bundle = new NoAssets();
const timeout = 1_200_000;
FoundationPlatform.configure({ kind: 'native', operatingSystem: 'windows' });
test(
  'tile defaults preserve role getter order and a replaced copyWith accessor',
  { timeout },
  () => {
    const original = Theme.of,
      descriptor = Object.getOwnPropertyDescriptor(TextStyle.prototype, 'copyWith'),
      trace = [];
    let reads = 0;
    const styles = {
        bodyLarge: new TextStyle(),
        bodyMedium: new TextStyle(),
        labelSmall: new TextStyle(),
      },
      text = {},
      colors = {
        get onSurface() {
          trace.push('surface');
          return 0xff123456;
        },
        get onSurfaceVariant() {
          trace.push('variant');
          return 0xffabcdef;
        },
        get primary() {
          trace.push('primary');
          return 0xff112233;
        },
      };
    for (const name of Object.keys(styles))
      Object.defineProperty(text, name, {
        get() {
          trace.push(name);
          return styles[name];
        },
      });
    Theme.of = () => ({ textTheme: text, colorScheme: colors });
    try {
      Object.defineProperty(TextStyle.prototype, 'copyWith', {
        configurable: true,
        get() {
          reads++;
          return descriptor.value;
        },
      });
      for (let i = 0; i < 2; i++) {
        trace.length = 0;
        listTileDefaults(null, 0);
        assert.deepEqual(trace, [
          'bodyLarge',
          'surface',
          'bodyMedium',
          'variant',
          'labelSmall',
          'variant',
          'primary',
          'variant',
        ]);
      }
      assert.equal(reads, 6);
    } finally {
      Object.defineProperty(TextStyle.prototype, 'copyWith', descriptor);
      Theme.of = original;
    }
  },
);
test(
  'stable tile themes refresh live values and continue calling style hooks after repeated projections',
  { timeout },
  () => {
    const saved = Theme.of,
      descriptor = Object.getOwnPropertyDescriptor(TextStyle.prototype, 'copyWith'),
      trace = [],
      values = { surface: 0xff123456, variant: 0xffabcdef, primary: 0xff112233 };
    const styles = {
        bodyLarge: new TextStyle({ fontSize: 18 }),
        bodyMedium: new TextStyle({ fontSize: 14 }),
        labelSmall: new TextStyle({ fontSize: 12 }),
      },
      text = {};
    let fail = false,
      calls = 0;
    for (const name of Object.keys(styles))
      Object.defineProperty(text, name, {
        get() {
          trace.push(name);
          return styles[name];
        },
      });
    const colors = {
      get onSurface() {
        trace.push('surface');
        return values.surface;
      },
      get onSurfaceVariant() {
        trace.push('variant');
        return values.variant;
      },
      get primary() {
        trace.push('primary');
        if (fail) throw null;
        return values.primary;
      },
    };
    const theme = { textTheme: text, colorScheme: colors };
    Theme.of = () => theme;
    const order = [
      'bodyLarge',
      'surface',
      'bodyMedium',
      'variant',
      'labelSmall',
      'variant',
      'primary',
      'variant',
    ];
    try {
      let first;
      for (let i = 0; i < 2; i++) {
        trace.length = 0;
        const value = listTileDefaults(null, 0);
        first ??= value;
        assert.deepEqual(trace, order);
        assert.equal(value.titleTextStyle.fontSize, 18);
        assert.equal(value.selectedColor.toARGB32(), values.primary);
      }
      values.primary = 0xff445566;
      values.variant = 0xff778899;
      styles.bodyLarge = new TextStyle({ fontSize: 22 });
      const changed = listTileDefaults(null, 0);
      assert.equal(changed.titleTextStyle.fontSize, 22);
      assert.equal(changed.selectedColor.toARGB32(), values.primary);
      assert.equal(changed.iconColor.toARGB32(), values.variant);
      assert.equal(first.titleTextStyle.fontSize, 18);
      assert.equal(first.selectedColor.toARGB32(), 0xff112233);
      assert.equal(first.iconColor.toARGB32(), 0xffabcdef);
      const custom = new TextStyle({ fontSize: 31 });
      Object.defineProperty(TextStyle.prototype, 'copyWith', {
        configurable: true,
        get() {
          trace.push('copy-get');
          return function () {
            calls++;
            assert(Object.values(styles).includes(this));
            return custom;
          };
        },
      });
      for (let i = 0; i < 3; i++) {
        trace.length = 0;
        const value = listTileDefaults(null, 0);
        assert.equal(value.titleTextStyle, custom);
        assert.equal(trace.filter((value) => value === 'copy-get').length, 3);
      }
      assert.equal(calls, 9);
      fail = true;
      trace.length = 0;
      assert.throws(
        () => listTileDefaults(null, 0),
        (error) => error === null,
      );
      assert.equal(trace.at(-1), 'primary');
    } finally {
      Object.defineProperty(TextStyle.prototype, 'copyWith', descriptor);
      Theme.of = saved;
    }
  },
);
function elements(f, test) {
  const result = [],
    walk = (e) => {
      if (test(e)) result.push(e);
      e.visitChildren(walk);
    };
  walk(f.root.root);
  return result;
}
const one = (f, type) => elements(f, (e) => e.widget instanceof type)[0].widget;
const title = () => new SizedBox(60, 16),
  secondary = () => new SizedBox(12, 12);
const wrap = (tile, { rtl = false, platform = 'windows', affinity = null } = {}) =>
  new DefaultAssetBundle(
    bundle,
    new MediaQuery(
      {
        width: 240,
        height: 160,
        scale: 1,
        textScale: 1,
        safeArea: { left: 0, top: 0, right: 0, bottom: 0 },
        keyboardInset: 0,
      },
      new Shortcuts({
        shortcuts: new Map([[new SingleActivator(LogicalKeyboardKey.space), new ActivateIntent()]]),
        child: new Theme(
          new ThemeData({ platform }),
          new Directionality(
            rtl ? 'rtl' : 'ltr',
            new Material({
              child: new Align(
                new SizedBox(
                  220,
                  undefined,
                  new ListTileTheme(new ListTileThemeData({ controlAffinity: affinity }), tile),
                ),
              ),
            }),
          ),
        ),
      }),
    ),
  );
class Registry extends RadioGroupRegistry {
  clients = new Set();
  groupValue = 0;
  changes = [];
  onChanged = (value) => this.changes.push(value);
  registerClient(client) {
    this.clients.add(client);
  }
  unregisterClient(client) {
    this.clients.delete(client);
  }
}
function tapPaint(f) {
  const e = elements(
      f,
      (e) =>
        e.widget instanceof CustomPaint &&
        ['CheckboxPainter', 'RadioPainter', 'SwitchPainter'].includes(
          e.widget.painter?.constructor.name,
        ),
    ).at(-1),
    r = e.renderObject,
    p = r.localToGlobal(Offset.zero),
    s = r.size;
  f.root.pointer({
    kind: 'down',
    x: p.x + s.width / 2,
    y: p.y + s.height / 2,
    pointer: 20,
    device: 'mouse',
    buttons: 1,
    timestamp: 0,
    viewportGeneration: 1,
  });
  f.frame();
  f.root.pointer({
    kind: 'up',
    x: p.x + s.width / 2,
    y: p.y + s.height / 2,
    pointer: 20,
    device: 'mouse',
    buttons: 0,
    timestamp: 0,
    viewportGeneration: 1,
  });
  f.frame();
}

test(
  'three toggle tile API defaults, controlled guards and removed deprecated options',
  { timeout },
  () => {
    assert.throws(() => new CheckboxListTile({ value: null, onChanged: null }), /tristate/);
    assert.throws(() => new SwitchListTile({ value: false }), /explicit nullable callback/);
    assert.throws(
      () => new SwitchListTile({ value: false, onChanged: null, activeColor: null }),
      /deprecated/,
    );
    assert.throws(() => new RadioListTile({ value: 1, onChanged() {} }), /deprecated/);
    for (const Type of [CheckboxListTile, RadioListTile, SwitchListTile])
      assert.throws(
        () => new Type({ value: false, onChanged: null, isThreeLine: true }),
        /subtitle|deprecated/,
      );
    assert.equal(new CheckboxListTile({ value: false, onChanged: null }).checkboxScaleFactor, 1);
    assert.equal(new RadioListTile({ value: 1 }).radioScaleFactor, 1);
    assert.equal(new SwitchListTile({ value: false, onChanged: null }).applyCupertinoTheme, false);
    assert.equal(
      SwitchListTile.adaptive({ value: false, onChanged: null }).applyCupertinoTheme,
      null,
    );
  },
);

test(
  'actual ListTile default/theme/explicit affinity and RTL build retain source selected policy',
  { timeout },
  () => {
    const f = fixture();
    try {
      for (const [Type, Control, leading] of [
        [CheckboxListTile, Checkbox, false],
        [RadioListTile, Radio, true],
        [SwitchListTile, Switch, false],
      ]) {
        const registry = new Registry(),
          options = () => ({
            value: Type === RadioListTile ? 1 : false,
            ...(Type === RadioListTile ? { groupRegistry: registry } : { onChanged() {} }),
            title: title(),
            secondary: secondary(),
            selected: true,
            id: 'tile',
          });
        f.set(wrap(new Type(options())));
        let tile = one(f, ListTile);
        assert.equal(tile.selected, true);
        assert.equal(elements(f, (e) => e.widget instanceof Control).length, 1);
        assert.equal((leading ? tile.leading : tile.trailing).constructor.name, 'ExcludeFocus');
        f.set(wrap(new Type(options()), { rtl: true, affinity: ListTileControlAffinity.leading }));
        tile = one(f, ListTile);
        assert.equal(tile.leading.constructor.name, 'ExcludeFocus');
        f.set(wrap(new Type({ ...options(), controlAffinity: ListTileControlAffinity.trailing })));
        assert.equal(one(f, ListTile).trailing.constructor.name, 'ExcludeFocus');
      }
      f.set(new SizedBox(1, 1));
      assert.equal(f.root.scheduler.transientCallbackCount, 0);
    } finally {
      f.close();
    }
  },
);

test(
  'checkbox tile label and actual embedded pointer each call once, tristate remains controlled',
  { timeout },
  () => {
    const f = fixture(),
      changes = [];
    const tile = (value) =>
      new CheckboxListTile({
        value,
        tristate: true,
        onChanged: (next) => changes.push(next),
        title: title(),
        id: 'check-tile',
      });
    try {
      f.set(wrap(tile(false)));
      f.tap('check-tile');
      assert.deepEqual(changes, [true]);
      tapPaint(f);
      assert.deepEqual(changes, [true, true]);
      f.set(wrap(tile(true)));
      f.tap('check-tile');
      assert.equal(changes.at(-1), null);
      f.set(wrap(tile(null)));
      f.tap('check-tile');
      assert.equal(changes.at(-1), false);
      f.set(
        wrap(
          new CheckboxListTile({
            value: false,
            onChanged: (next) => changes.push(next),
            enabled: false,
            title: title(),
            id: 'check-tile',
          }),
        ),
      );
      f.tap('check-tile');
      assert.equal(changes.length, 4);
    } finally {
      f.close();
    }
  },
);

test(
  'switch tile label and embedded pointer share controlled callback without duplicate activation',
  { timeout },
  () => {
    const f = fixture(),
      changes = [],
      focus = new FocusNode(),
      states = new WidgetStatesController();
    const tile = (value, onChanged = (next) => changes.push(next)) =>
      new SwitchListTile({
        value,
        onChanged,
        title: title(),
        id: 'switch-tile',
        focusNode: focus,
        statesController: states,
      });
    try {
      f.set(wrap(tile(false)));
      f.tap('switch-tile');
      assert.deepEqual(changes, [true]);
      tapPaint(f);
      assert.deepEqual(changes, [true, true]);
      focus.requestFocus();
      f.frame();
      const event = (kind) => ({
        kind,
        key: ' ',
        code: 'Space',
        shift: false,
        control: false,
        alt: false,
        meta: false,
        repeat: false,
      });
      assert.equal(f.root.key(event('down')), true);
      f.root.key(event('up'));
      assert.deepEqual(changes, [true, true, true]);
      const stale = f.root.nodes.find(
        (n) => n.semanticsIdentifier === 'switch-tile' && n.activate,
      ).activate;
      assert.equal(typeof stale, 'function');
      f.set(wrap(tile(true, null)));
      stale();
      f.tap('switch-tile');
      assert.equal(changes.length, 3);
      f.set(new SizedBox(1, 1));
      focus.addListener(() => {});
      states.addListener(() => {});
      assert.equal(f.root.scheduler.transientCallbackCount, 0);
    } finally {
      f.close();
      focus.dispose();
      states.dispose();
    }
  },
);

test(
  'radio tile registers one outer client, owns label keyboard focus and hides the embedded registry',
  { timeout },
  () => {
    const f = fixture(),
      registry = new Registry(),
      focus = new FocusNode(),
      key = new GlobalKey('radio-tile');
    const tile = (enabled = true) =>
      new RadioListTile({
        value: 1,
        groupRegistry: registry,
        toggleable: true,
        enabled,
        focusNode: focus,
        key,
        title: title(),
        id: 'radio-tile',
      });
    try {
      f.set(wrap(new Column([tile(), new SizedBox(1, 1)])));
      assert.equal(registry.clients.size, 1);
      assert.equal([...registry.clients][0].focusNode, focus);
      f.tap('radio-tile');
      tapPaint(f);
      assert.deepEqual(registry.changes, [1, 1]);
      registry.groupValue = 1;
      f.set(wrap(new Column([tile(), new SizedBox(1, 1)])));
      f.tap('radio-tile');
      assert.equal(registry.changes.at(-1), null);
      const same = key.currentContext,
        client = [...registry.clients][0];
      f.set(wrap(new Column([new SizedBox(1, 1), tile()]), { rtl: true }));
      assert.equal(key.currentContext, same);
      assert.equal([...registry.clients][0], client);
      const stale = f.root.nodes.find(
        (n) => n.semanticsIdentifier === 'radio-tile' && n.activate,
      ).activate;
      assert.equal(typeof stale, 'function');
      f.set(wrap(new Column([new SizedBox(1, 1), tile(false)])));
      stale();
      f.tap('radio-tile');
      assert.equal(registry.changes.length, 3);
      f.set(new SizedBox(1, 1));
      stale();
      assert.equal(registry.clients.size, 0);
      assert.equal(registry.changes.length, 3);
      focus.addListener(() => {});
    } finally {
      f.close();
      focus.dispose();
    }
  },
);

test(
  'typed RadioGroup arrow navigation uses tile clients and skips disabled tiles',
  { timeout },
  () => {
    const f = fixture(),
      token = Symbol('tile-type'),
      focus = new FocusNode(),
      changes = [];
    try {
      const tiles = [1, 2, 3].map(
        (value) =>
          new RadioListTile({
            value,
            groupToken: token,
            enabled: value !== 2,
            ...(value === 1 ? { focusNode: focus } : {}),
            title: title(),
            id: 'radio-' + value,
          }),
      );
      f.set(
        wrap(
          new RadioGroup({
            typeToken: token,
            groupValue: 1,
            onChanged: (value) => changes.push(value),
            child: new Column(tiles),
          }),
        ),
      );
      focus.requestFocus();
      f.frame();
      const event = (kind) => ({
        kind,
        key: 'ArrowDown',
        code: 'ArrowDown',
        shift: false,
        control: false,
        alt: false,
        meta: false,
        repeat: false,
      });
      assert.equal(f.root.key(event('down')), true);
      f.root.key(event('up'));
      assert.deepEqual(changes, [3]);
      f.set(new SizedBox(1, 1));
      assert.equal(f.root.scheduler.transientCallbackCount, 0);
    } finally {
      f.close();
      focus.dispose();
    }
  },
);

test(
  'adaptive tiles evaluate the source platform path, scaling and one merged accessible control',
  { timeout },
  () => {
    const f = fixture(),
      registry = new Registry();
    try {
      f.set(
        wrap(
          CheckboxListTile.adaptive({
            value: false,
            onChanged() {},
            title: title(),
            checkboxScaleFactor: 1.5,
            id: 'adaptive',
          }),
          { platform: 'iOS', rtl: true },
        ),
      );
      assert.equal(elements(f, (e) => e.widget instanceof CupertinoCheckbox).length, 1);
      assert.equal(f.root.nodes.filter((n) => n.checked !== undefined).length, 1);
      f.set(
        wrap(
          RadioListTile.adaptive({
            value: 1,
            groupRegistry: registry,
            title: title(),
            radioScaleFactor: 1.25,
            useCupertinoCheckmarkStyle: true,
            id: 'adaptive',
          }),
          { platform: 'iOS' },
        ),
      );
      assert.equal(one(f, CupertinoRadio).useCheckmarkStyle, true);
      assert.equal(registry.clients.size, 1);
      assert.equal(f.root.nodes.filter((n) => n.checked !== undefined).length, 1);
      f.set(
        wrap(
          SwitchListTile.adaptive({
            value: false,
            onChanged() {},
            title: title(),
            applyCupertinoTheme: true,
            id: 'adaptive',
          }),
          { platform: 'macOS' },
        ),
      );
      assert.equal(one(f, Switch).applyCupertinoTheme, true);
      assert.equal(registry.clients.size, 0);
      const sourceFlags = f.root.nodes.map(
        (n) =>
          f.root.pipeline.semanticsOwner.getSemanticsNode(n.sourceNodeId).getSemanticsData()
            .flagsCollection,
      );
      assert.equal(sourceFlags.filter((flags) => flags.isToggled !== Tristate.none).length, 1);
      f.set(new SizedBox(1, 1));
      assert.equal(f.root.scheduler.transientCallbackCount, 0);
    } finally {
      f.close();
    }
  },
);

test(
  'actual paragraph baselines, two/three-line density, RTL slots and nested title actions use the live ListTile',
  { timeout },
  async () => {
    const require = createRequire(import.meta.url),
      runtime = new URL('../generated/runtime/', import.meta.resolve('@nelyx/skia-web/library'));
    const ck = await require(fileURLToPath(new URL('canvaskit.js', runtime)))({
      wasmBinary: fs.readFileSync(new URL('canvaskit.wasm', runtime)),
    });
    assert.equal(ck.nelyxParagraphApiVersion(), 1);
    const f = fixture(),
      context = f.root.context,
      library = new WebSkiaLibrary(ck, null, context.owner),
      surface = ck.MakeSurface(240, 160);
    library.bind(context.resources);
    context.text = library;
    const bytes = fs.readFileSync(
      new URL(
        '../../../Nelyx/sdk/tooling/cli/templates/nelyx-app/assets/RobotoSlab-VariableFont_wght.ttf',
        import.meta.url,
      ),
    );
    const font = library.decode(
      {
        id: 'tile-test-text',
        kind: 'font',
        fontFamily: 'RobotoSlab',
        sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      },
      bytes,
    );
    context.resources.register(font.descriptor, font.retire);
    context.defaultFont = font.descriptor;
    context.assets.set('tile-test-text', font.descriptor);
    const render = () =>
      elements(f, (e) => e.renderObject?.constructor.name === 'RenderListTile')[0].renderObject;
    const tapRender = (r) => {
      const p = r.localToGlobal({ x: r.size.width / 2, y: r.size.height / 2 });
      for (const kind of ['down', 'up']) {
        f.root.pointer({
          kind,
          x: p.x,
          y: p.y,
          pointer: 30,
          device: 'mouse',
          buttons: kind === 'down' ? 1 : 0,
          timestamp: 0,
          viewportGeneration: 1,
        });
        f.frame();
      }
    };
    try {
      for (const [Type, radio] of [
        [CheckboxListTile, false],
        [RadioListTile, true],
        [SwitchListTile, false],
      ]) {
        const registry = new Registry(),
          options = {
            value: radio ? 1 : false,
            ...(radio ? { groupRegistry: registry } : { onChanged() {} }),
            visualDensity: VisualDensity.standard,
            title: new Text('Title'),
            subtitle: new Text('Subtitle'),
            secondary: secondary(),
            id: 'text-tile',
          };
        let commands = f.set(wrap(new Type(options))),
          r = render();
        assert.equal(r.size.height, 72);
        assert(r.title.getDistanceToBaseline('alphabetic', { onlyReal: true }) > 0);
        assert(r.subtitle.getDistanceToBaseline('alphabetic', { onlyReal: true }) > 0);
        commands = f.set(
          wrap(
            new Type({ ...options, isThreeLine: true, subtitle: new Text('Line one\nLine two') }),
            { rtl: true },
          ),
        );
        r = render();
        assert.equal(r.size.height, 88);
        assert.equal(r.title.layoutOffset.x > 0, true);
        library.replay(surface.getCanvas(), { commands });
        surface.flush();
        assert.equal(
          [...library.paragraphs.values()].some((e) => e.layout.unresolvedGlyphs > 0),
          false,
        );
        f.set(wrap(new Type({ ...options, dense: true })));
        assert.equal(render().size.height, 64);
      }
      let nested = 0,
        toggled = 0;
      f.set(
        wrap(
          new CheckboxListTile({
            value: false,
            onChanged() {
              toggled++;
            },
            title: new GestureDetector(new Text('Nested action'), {
              onTap() {
                nested++;
              },
            }),
            id: 'nested-tile',
          }),
        ),
      );
      tapRender(render().title);
      assert.equal(nested, 1);
      assert.equal(toggled, 0, 'The inner recognizer wins the pointer arena once');
      const action = f.root.nodes.find((n) => n.activate && n.checked !== undefined).activate;
      action();
      assert.equal(toggled, 1, 'Merged semantic action uses the label control');
      f.set(new SizedBox(1, 1));
      assertParagraphOwnership({ library });
      assert.equal(f.root.scheduler.transientCallbackCount, 0);
    } finally {
      surface.delete();
      f.close();
      await library.dispose();
      assert.equal(library.fonts.size, 0);
    }
  },
);
