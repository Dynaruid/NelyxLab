// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Finite Color/property multiple-interface bridge on canonical Core values.
import { widgetStateDiagnosticableType } from './widget-state-diagnostic-source-adapter.ts';
import { DartMapHash } from '../../foundation/dart-map-equality.ts';
import { Color } from '../../ui/color.ts';
import { sourceColorType, constSourceColor } from '../../ui/color-source-adapter.ts';
import {
  SourceWidgetStateProperty as Property,
  SourceWidgetStateMapper,
  SourceWidgetState,
  SourceWidgetStatesConstraint,
} from './widget-state.generated.ts';
import { constEmptyWidgetStateSet } from './widget-state-full-collections.ts';
import type { DartSet, DartMap } from '../../foundation/dart-collections.ts';
import {
  applyDartType,
  captureDartType,
  captureDartInterface,
  isDartType,
} from '../../foundation/dart-type-witness.ts';
import { FlutterError } from '../../foundation/flutter-error.ts';
import { registerDartValueSemantics } from '../../foundation/dart-value.ts';
const propertyType = applyDartType<Property<Color>>(
  Property,
  'WidgetStateProperty',
  [sourceColorType],
  [],
);
const mapperType = applyDartType<SourceWidgetStateMapper<Color>>(
  SourceWidgetStateMapper,
  'WidgetStateMapper',
  [sourceColorType],
  [propertyType, widgetStateDiagnosticableType],
);
function admitted(color: unknown): Color {
  if (!(color instanceof Color))
    throw new TypeError('WidgetStateColor resolver must return the owning Core Color');
  if (!isDartType(color, sourceColorType)) captureDartInterface(color, sourceColorType);
  return color;
}
export abstract class WidgetStateColor extends Color implements Property<Color> {
  /** @dartParam defaultValue int */
  constructor(defaultValue: number) {
    super(defaultValue);
    captureDartType(this, stateColorType);
  }
  abstract resolve(states: DartSet<SourceWidgetState>): Color;
  static resolveWith(callback: (states: DartSet<SourceWidgetState>) => Color): WidgetStateColor {
    return new ResolvedColor(callback);
  }
  static fromMap(map: DartMap<SourceWidgetStatesConstraint, Color>): WidgetStateColor {
    const target = new MappedColor(map),
      blocked = new Set<PropertyKey>([
        'a',
        'r',
        'g',
        'b',
        'colorSpace',
        'alpha',
        'red',
        'green',
        'blue',
        'opacity',
        'value',
        'toARGB32',
        'withValues',
        'withAlpha',
        'withRed',
        'withGreen',
        'withBlue',
        'withOpacity',
        'computeLuminance',
      ]);
    const proxy = new Proxy(target, {
      get(object, key, receiver) {
        if (blocked.has(key))
          throw new FlutterError(
            'There was an attempt to access the "' +
              String(key) +
              '" field of a WidgetStateMapper<Color> object. WidgetStateProperty objects should only be used in places that document their support.',
          );
        return Reflect.get(object, key, receiver);
      },
    });
    captureDartType(proxy, stateColorType);
    captureDartType(proxy, mappedColorType);
    return proxy;
  }
  static get transparent(): WidgetStateColor {
    return transparent;
  }
}
const stateColorType = applyDartType<WidgetStateColor>(
  WidgetStateColor,
  'WidgetStateColor',
  [],
  [sourceColorType, propertyType],
);
class ResolvedColor extends WidgetStateColor {
  constructor(private readonly callback: (states: DartSet<SourceWidgetState>) => Color) {
    super(admitted(callback(constEmptyWidgetStateSet())).value);
  }
  resolve(states: DartSet<SourceWidgetState>): Color {
    return admitted(this.callback(states));
  }
}
class TransparentColor extends WidgetStateColor {
  constructor() {
    super(0);
  }
  resolve(_states: DartSet<SourceWidgetState>): Color {
    return constSourceColor(Color, 0);
  }
}
class MappedColor extends WidgetStateColor {
  readonly mapper: SourceWidgetStateMapper<Color>;
  constructor(private readonly map: DartMap<SourceWidgetStatesConstraint, Color>) {
    super(0);
    this.mapper = new SourceWidgetStateMapper(sourceColorType, map);
    /* Bridge the generated mapper-owned storage and source supertype without copying its algorithm. */ Object.defineProperties(
      this,
      Object.getOwnPropertyDescriptors(this.mapper),
    );
    captureDartType(this, mappedColorType);
  }
  resolve(states: DartSet<SourceWidgetState>): Color {
    return admitted(this.mapper.resolve(states));
  }
  override equals(other: unknown): boolean {
    return other !== null && other !== undefined && this.mapper.equals(other as {});
  }
  override get hashCode(): number {
    return new DartMapHash<Color>(admitted).hash(this.map);
  }
  override toString(): string {
    return this.mapper.toString();
  }
}
const mappedColorType = applyDartType<MappedColor>(
    MappedColor,
    '_WidgetStateColorMapper',
    [],
    [stateColorType, mapperType],
  ),
  transparent = new TransparentColor();
registerDartValueSemantics(WidgetStateColor, {
  accepts: (v: unknown): v is WidgetStateColor => v instanceof WidgetStateColor,
  equals: (v, o) => v.equals(o),
  hash: (v) => v.hashCode,
  string: (v) => v.toString(),
});
