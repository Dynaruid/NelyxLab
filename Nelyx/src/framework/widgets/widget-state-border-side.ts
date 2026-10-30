// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Finite multiple-interface bridge for pinned WidgetStateBorderSide and its factories.
import { BorderSide } from '../painting/borders.ts';
import {
  SourceWidgetStateProperty as Property,
  SourceWidgetStateMapper,
  SourceWidgetState,
  SourceWidgetStatesConstraint,
} from './widget-state.generated.ts';
import type { DartSet, DartMap } from '../../foundation/dart-collections.ts';
import {
  applyDartType,
  captureDartType,
  captureDartInterface,
  nullableDartType,
  isDartType,
} from '../../foundation/dart-type-witness.ts';
import { FlutterError } from '../../foundation/flutter-error.ts';
import { registerDartValueSemantics } from '../../foundation/dart-value.ts';
export const sourceBorderSideType = applyDartType<BorderSide>(BorderSide, 'BorderSide', [], []),
  nullableSourceBorderSideType = nullableDartType(sourceBorderSideType);
const propertyType = applyDartType<Property<BorderSide | null>>(
  Property,
  'WidgetStateProperty',
  [nullableSourceBorderSideType],
  [],
);
export function captureSourceBorderSide(value: BorderSide): BorderSide {
  if (!(value instanceof BorderSide)) throw new TypeError('Expected the owning Core BorderSide');
  if (!isDartType(value, sourceBorderSideType)) captureDartInterface(value, sourceBorderSideType);
  return value;
}
function admitted(value: BorderSide | null): BorderSide | null {
  return value === null ? null : captureSourceBorderSide(value);
}
export abstract class WidgetStateBorderSide
  extends BorderSide
  implements Property<BorderSide | null>
{
  constructor() {
    super();
    captureDartType(this, stateSideType);
  }
  abstract resolve(states: DartSet<SourceWidgetState>): BorderSide | null;
  static resolveWith(
    callback: (states: DartSet<SourceWidgetState>) => BorderSide | null,
  ): WidgetStateBorderSide {
    return new ResolvedSide(callback);
  }
  static fromMap(
    map: DartMap<SourceWidgetStatesConstraint, BorderSide | null>,
  ): WidgetStateBorderSide {
    const target = new MappedSide(map),
      blocked = new Set<PropertyKey>([
        'color',
        'width',
        'style',
        'strokeAlign',
        'strokeInset',
        'strokeOutset',
        'strokeOffset',
        'copyWith',
        'scale',
        'toPaint',
        'empty',
      ]);
    const proxy = new Proxy(target, {
      get(object, key, receiver) {
        if (blocked.has(key))
          throw new FlutterError(
            'There was an attempt to access the "' +
              String(key) +
              '" field of a WidgetStateMapper<BorderSide?> object. WidgetStateProperty objects should only be used in places that document their support.',
          );
        return Reflect.get(object, key, receiver);
      },
    });
    captureDartType(proxy, stateSideType);
    captureDartType(proxy, mappedSideType);
    return proxy;
  }
  static lerp(
    a: Property<BorderSide | null> | null,
    b: Property<BorderSide | null> | null,
    t: number,
  ): Property<BorderSide | null> | null;
  static override lerp(a: BorderSide, b: BorderSide, t: number): BorderSide;
  static override lerp(
    a: Property<BorderSide | null> | BorderSide | null,
    b: Property<BorderSide | null> | BorderSide | null,
    t: number,
  ): Property<BorderSide | null> | BorderSide | null {
    if (a !== null && b !== null && (!('resolve' in a) || !('resolve' in b)))
      return BorderSide.lerp(a as BorderSide, b as BorderSide, t);
    return a === null && b === null
      ? null
      : a === b
        ? a
        : new LerpedSides(
            a as Property<BorderSide | null> | null,
            b as Property<BorderSide | null> | null,
            t,
          );
  }
}
const stateSideType = applyDartType<WidgetStateBorderSide>(
  WidgetStateBorderSide,
  'WidgetStateBorderSide',
  [],
  [sourceBorderSideType, propertyType],
);
class ResolvedSide extends WidgetStateBorderSide {
  constructor(
    private readonly callback: (states: DartSet<SourceWidgetState>) => BorderSide | null,
  ) {
    super();
  }
  resolve(states: DartSet<SourceWidgetState>): BorderSide | null {
    return admitted(this.callback(states));
  }
}
class MappedSide extends WidgetStateBorderSide {
  readonly mapper: SourceWidgetStateMapper<BorderSide | null>;
  constructor(map: DartMap<SourceWidgetStatesConstraint, BorderSide | null>) {
    super();
    this.mapper = new SourceWidgetStateMapper(nullableSourceBorderSideType, map);
    captureDartType(this, mappedSideType);
  }
  resolve(states: DartSet<SourceWidgetState>): BorderSide | null {
    return admitted(this.mapper.resolve(states));
  }
  override equals(other: unknown): boolean {
    return other instanceof MappedSide && this.mapper.equals(other.mapper);
  }
  override get hashCode(): number {
    return this.mapper.hashCode;
  }
  override toString(): string {
    return this.mapper.toString();
  }
}
const mappedSideType = applyDartType<MappedSide>(
  MappedSide,
  '_WidgetBorderSideMapper',
  [],
  [stateSideType],
);
class LerpedSides extends Property<BorderSide | null> {
  constructor(
    readonly a: Property<BorderSide | null> | null,
    readonly b: Property<BorderSide | null> | null,
    readonly t: number,
  ) {
    super(nullableSourceBorderSideType);
  }
  resolve(states: DartSet<SourceWidgetState>): BorderSide | null {
    const a = this.a?.resolve(states) ?? null,
      b = this.b?.resolve(states) ?? null;
    if (a === null && b === null) return null;
    return captureSourceBorderSide(
      BorderSide.lerp(
        a ?? new BorderSide({ width: 0, color: b!.color & 0xffffff }),
        b ?? new BorderSide({ width: 0, color: a!.color & 0xffffff }),
        this.t,
      ),
    );
  }
}
captureSourceBorderSide(BorderSide.none);
registerDartValueSemantics(BorderSide, {
  accepts: (value: unknown): value is BorderSide =>
    value instanceof BorderSide && Object.getPrototypeOf(value) === BorderSide.prototype,
  equals: (value, other) => value.equals(other),
  hash: (value) => value.hashCode,
  string: (value) => value.toString(),
});
registerDartValueSemantics(WidgetStateBorderSide, {
  accepts: (value: unknown): value is WidgetStateBorderSide =>
    value instanceof WidgetStateBorderSide,
  equals: (value, other) => value.equals(other),
  hash: (value) => value.hashCode,
  string: (value) => value.toString(),
});
