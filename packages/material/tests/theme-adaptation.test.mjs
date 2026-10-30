// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { Adaptation } from '../dist/adaptation.js';
import { ThemeExtension } from '../dist/theme-extension.js';
import { ThemeData, MaterialTapTargetSize } from '@nelyx/material/theme-data';
import { Theme } from '@nelyx/material/theme';
import { Switch } from '@nelyx/material/switch';
import { SwitchTheme, SwitchThemeData } from '@nelyx/material/switch-theme';
import { CheckboxThemeData } from '@nelyx/material/checkbox-theme';
import { WidgetStateProperty } from '@nelyx/core/framework/widgets/widget-state';
import {
  nullableDartType,
  dartDoubleType,
  dartIntType,
  dartNumType,
  dartStringType,
  dartTypeIdentity,
  applyDartType,
} from '@nelyx/core/foundation/dart-type-witness';
import { DartDouble } from '@nelyx/core/foundation/dart-numeric';
import { sourceColorType, captureSourceColor } from '@nelyx/core/ui/color-source';
import { Color } from '@nelyx/core/ui/color';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { Align, SizedBox, Builder } from '@nelyx/core/framework/widgets/basic';
import { Directionality } from '@nelyx/core/framework/widgets/app-data';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { SwitchPainter } from '@nelyx/core/internal/framework/widgets/switch-painter';
import { switchEnvironment } from '../dist/internal/switch/switch-values.js';
import { fixture } from './root-fixture.mjs';
const timeout = 1_200_000;
FoundationPlatform.configure({ kind: 'native', operatingSystem: 'windows' });
const property = (value) =>
  WidgetStateProperty.resolveWith(nullableDartType(sourceColorType), () => new Color(value));
function elements(f, predicate) {
  const found = [],
    visit = (e) => {
      if (predicate(e)) found.push(e);
      e.visitChildren(visit);
    };
  visit(f.root.root);
  return found;
}
const painter = (f) =>
  elements(f, (e) => e.widget.painter instanceof SwitchPainter)[0].widget.painter;

test(
  'typed adaptations use exact class/witness keys, duplicate last-wins and source null-retaining copy maps',
  { timeout },
  () => {
    const identity = new Adaptation(SwitchThemeData),
      original = new SwitchThemeData();
    assert.equal(identity.type, SwitchThemeData);
    assert.equal(identity.adapt(ThemeData.light(), original), original);
    const first = new Adaptation(SwitchThemeData),
      last = new Adaptation(SwitchThemeData),
      array = [first, last],
      data = new ThemeData({ adaptations: array });
    array.pop();
    assert.equal(data.getAdaptation(SwitchThemeData), last);
    assert.equal(data.getAdaptation(CheckboxThemeData), null);
    const copy = data.copyWith();
    assert.equal(copy.adaptationMap, data.adaptationMap);
    assert.equal(data.copyWith({ adaptations: null }).adaptationMap, data.adaptationMap);
    assert.equal(data.copyWith({ adaptations: [] }).adaptationMap.size, 0);
    const boxed = new Adaptation(dartDoubleType),
      number = DartDouble.fromSource(2),
      numeric = new ThemeData({ adaptations: [boxed] });
    assert.equal(numeric.getAdaptation(dartDoubleType).adapt(numeric, number), number);
    assert.throws(() => boxed.adapt(numeric, 2), /source value provenance/);
    assert.throws(() => new Adaptation({}), /Unknown source type witness/);
    assert.throws(
      () => new ThemeData({ adaptations: [{ type: SwitchThemeData, adapt: () => original }] }),
      /canonical Adaptation/,
    );
    data.adaptationMap.set(CheckboxThemeData, last);
    assert.throws(() => data.getAdaptation(CheckboxThemeData), /key does not match/);
    data.adaptationMap.delete(CheckboxThemeData);
    class DifferentKey extends Adaptation {
      constructor() {
        super(SwitchThemeData);
      }
      get type() {
        return CheckboxThemeData;
      }
    }
    const different = new DifferentKey(),
      malformed = new ThemeData({ adaptations: [different] });
    assert.throws(() => malformed.getAdaptation(CheckboxThemeData), /key does not match/);
    assert.equal(
      different.adapt(data, original),
      original,
      'The overridable getter does not change captured generic T',
    );
    const sourceColor = new Adaptation(sourceColorType),
      colorTheme = new ThemeData({ adaptations: [new Adaptation(Color), sourceColor] });
    assert.equal(colorTheme.adaptationMap.size, 1);
    assert.equal(colorTheme.getAdaptation(Color), sourceColor);
    assert.equal(colorTheme.getAdaptation(sourceColorType), sourceColor);
    assert.equal(sourceColor.type, Color);
    const color = captureSourceColor(
      Color.from({ alpha: 1, red: 0.123456, green: 0.234567, blue: 0.345678 }),
    );
    assert.equal(sourceColor.adapt(colorTheme, color), color);
    class Generic {}
    const int = applyDartType(Generic, 'ThemeTestGeneric', [dartIntType], []),
      double = applyDartType(Generic, 'ThemeTestGeneric', [dartDoubleType], []);
    assert.notEqual(dartTypeIdentity(int), dartTypeIdentity(double));
    assert.notEqual(dartTypeIdentity(nullableDartType(sourceColorType)), Color);
    assert.equal(dartTypeIdentity(dartDoubleType), dartDoubleType);
    class Specialized extends SwitchThemeData {}
    class Covariant extends Adaptation {
      constructor() {
        super(Specialized);
      }
      get type() {
        return SwitchThemeData;
      }
      adapt(_theme, value) {
        return value;
      }
    }
    const covariant = new Covariant(),
      specialized = new Specialized(),
      covariantTheme = new ThemeData({ adaptations: [covariant] });
    assert.equal(covariantTheme.getAdaptation(SwitchThemeData), covariant);
    const tearOff = covariant.adapt;
    assert.equal(tearOff(data, specialized), specialized);
    assert.throws(() => tearOff(data, original), /runtime type/);
    const numTheme = new ThemeData();
    numTheme.adaptationMap.set(dartNumType, boxed);
    assert.equal(numTheme.getAdaptation(dartNumType), boxed);
    assert.equal(numTheme.getAdaptation(dartNumType).adapt(numTheme, number), number);
    class RawNumeric extends Adaptation {
      constructor() {
        super(dartDoubleType);
      }
      adapt() {
        return 2;
      }
    }
    assert.throws(() => new RawNumeric().adapt(data, number), /source value provenance/);
    const nullable = new Adaptation(nullableDartType(sourceColorType));
    assert.equal(nullable.adapt(data, null), null);
    assert.throws(() => new ThemeData({ adaptations: [nullable] }), /non-nullable T/);
    assert.throws(() => data.adaptationMap.set(Color, nullable), /non-nullable T/);
    colorTheme.adaptationMap.set(sourceColorType, sourceColor);
    assert.equal(colorTheme.adaptationMap.get(sourceColorType), sourceColor);
    assert.equal(colorTheme.adaptationMap.size, 1);
    assert.equal(colorTheme.adaptationMap.get({}), undefined);
  },
);

class Palette extends ThemeExtension {
  constructor(color) {
    super(Palette);
    this.color = color;
    Object.freeze(this);
  }
  copyWith({ color = this.color } = {}) {
    return new Palette(color);
  }
  lerp(other, t) {
    return new Palette(other === null ? this.color : Color.lerp(this.color, other.color, t));
  }
}
class OtherPalette extends ThemeExtension {
  constructor(color) {
    super(OtherPalette);
    this.color = color;
    Object.freeze(this);
  }
  copyWith() {
    return new OtherPalette(this.color);
  }
  lerp(other, t) {
    return new OtherPalette(other === null ? this.color : Color.lerp(this.color, other.color, t));
  }
}
test(
  'self-typed extensions snapshot input, distinguish same-shaped classes and expose source unmodifiable maps',
  { timeout },
  () => {
    const a = new Palette(new Color(0xff000000)),
      b = new Palette(new Color(0xffffffff)),
      other = new OtherPalette(new Color(0xff123456)),
      values = [a, other, b],
      data = new ThemeData({ extensions: values });
    values.length = 0;
    assert.equal(data.extension(Palette), b);
    assert.equal(data.extension(OtherPalette), other);
    assert.equal(data.extensions.size, 2);
    assert.equal(ThemeData.light().extension(Palette), null);
    assert.equal(
      data.extension(dartStringType),
      null,
      'Source extension<T> permits arbitrary T for an absent typed lookup',
    );
    assert.equal(typeof data.extensions.set, 'undefined');
    assert.throws(() => Map.prototype.set.call(data.extensions, Palette, a), TypeError);
    assert.deepEqual([...data.extensions.keys()], [Palette, OtherPalette]);
    let visited = 0;
    data.extensions.forEach((value, key, map) => {
      assert.equal(map, data.extensions);
      assert.equal(map.get(key), value);
      visited++;
    });
    assert.equal(visited, 2);
    assert.equal(data.copyWith().extensions, data.extensions);
    assert.equal(data.copyWith({ extensions: null }).extensions, data.extensions);
    assert.equal(data.copyWith({ extensions: [] }).extensions.size, 0);
    assert.equal(a.copyWith({ color: b.color }).color, b.color);
    assert.equal(a.lerp(b, 0.5).color.toARGB32(), 0xff808080);
    assert.throws(
      () => new ThemeData({ extensions: [{ type: Palette, copyWith() {}, lerp() {} }] }),
      /canonical ThemeExtension/,
    );
    class WrongExtensionKey extends Palette {
      get type() {
        return OtherPalette;
      }
    }
    const wrong = new ThemeData({ extensions: [new WrongExtensionKey(a.color)] });
    assert.throws(
      () => wrong.extension(OtherPalette),
      /runtime type/,
      'Source cast fails at typed lookup, after map construction',
    );
  },
);

test(
  'every adaptive Switch platform uses custom nearest-component adaptation for source size and paint stages',
  { timeout },
  () => {
    const f = fixture(),
      calls = [],
      local = new SwitchThemeData({ trackColor: property(0xff112233) });
    class Custom extends Adaptation {
      constructor() {
        super(SwitchThemeData);
      }
      adapt(theme, defaults) {
        calls.push({ theme, defaults });
        return defaults.copyWith({
          trackColor: property(0xff00aa00),
          padding: EdgeInsets.all(6),
          materialTapTargetSize: MaterialTapTargetSize.padded,
        });
      }
    }
    const custom = new Custom(),
      wrap = (widget, platform, adaptations) =>
        new Theme(
          new ThemeData({ platform, adaptations }),
          new SwitchTheme(local, new Directionality('ltr', new Align(widget))),
        );
    try {
      let same;
      for (const platform of ['windows', 'android', 'fuchsia', 'linux', 'iOS', 'macOS']) {
        const before = calls.length;
        f.set(
          wrap(Switch.adaptive({ value: true, onChanged() {}, id: 'custom' }), platform, [custom]),
        );
        const p = painter(f);
        same ??= p;
        assert.equal(p, same);
        assert.equal(p.options.activeTrackColor.toARGB32(), 0xff00aa00);
        assert.equal(p.options.config.isCupertino, ['iOS', 'macOS'].includes(platform));
        const node = f.root.nodes.find((n) => n.id === 'custom');
        assert.equal(node.bounds.width, 64);
        assert.equal(node.bounds.height, 68);
        assert.equal(
          calls.length - before,
          2,
          'Outer size and internal paint each adapt the original nearest theme',
        );
        assert.equal(calls.at(-1).defaults, local);
        assert.equal(calls.at(-1).theme.platform, platform);
      }
      const before = calls.length;
      f.set(wrap(new Switch({ value: true, onChanged() {}, id: 'custom' }), 'iOS', [custom]));
      assert.equal(calls.length, before);
      assert.equal(painter(f).options.activeTrackColor.toARGB32(), 0xff112233);
      f.set(wrap(Switch.adaptive({ value: true, onChanged() {}, id: 'custom' }), 'iOS', []));
      assert.equal(painter(f).options.activeTrackColor.toARGB32(), 0xff34c759);
      assert.equal(f.root.nodes.find((n) => n.id === 'custom').bounds.width, 60);
      f.set(new SizedBox(1, 1));
      assert.equal(f.root.scheduler.transientCallbackCount, 0);
    } finally {
      f.close();
    }
  },
);

test(
  'widget fields precede adapted defaults and invalid adaptation returns fail at the real typed boundary',
  { timeout },
  () => {
    const f = fixture();
    class Custom extends Adaptation {
      constructor() {
        super(SwitchThemeData);
      }
      adapt() {
        return new SwitchThemeData({
          trackColor: property(0xffabcdef),
          padding: EdgeInsets.all(10),
          materialTapTargetSize: MaterialTapTargetSize.padded,
        });
      }
    }
    try {
      f.set(
        new Theme(
          new ThemeData({ platform: 'windows', adaptations: [new Custom()] }),
          new Directionality(
            'ltr',
            new Align(
              Switch.adaptive({
                value: true,
                onChanged() {},
                id: 'override',
                activeTrackColor: new Color(0xff010203),
                padding: EdgeInsets.all(1),
                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
              }),
            ),
          ),
        ),
      );
      assert.equal(painter(f).options.activeTrackColor.toARGB32(), 0xff010203);
      assert.equal(f.root.nodes.find((n) => n.id === 'override').bounds.width, 54);
      assert.equal(f.root.nodes.find((n) => n.id === 'override').bounds.height, 42);
      class Invalid extends Adaptation {
        constructor() {
          super(SwitchThemeData);
        }
        adapt() {
          return {};
        }
      }
      f.set(
        new Theme(
          new ThemeData({ adaptations: [new Invalid()] }),
          new Builder((context) => {
            assert.throws(
              () =>
                switchEnvironment(
                  Switch.adaptive({ value: false, onChanged: null }),
                  context,
                  true,
                ),
              /runtime type/,
            );
            return new SizedBox(1, 1);
          }),
        ),
      );
      assert.equal(f.root.scheduler.transientCallbackCount, 0);
    } finally {
      f.close();
    }
  },
);
