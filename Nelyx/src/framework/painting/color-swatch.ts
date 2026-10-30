// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Functional port of painting/colors.dart at Flutter
// 71e4717a61786faab4c7aa39825989305ed29e8a on the existing Core Color/Map ABI.
import { Color } from '../../ui/color.ts';
import { DartMap } from '../../foundation/dart-collections.ts';
import {
  applyDartType,
  captureDartType,
  captureDartInterface,
  isDartType,
} from '../../foundation/dart-type-witness.ts';
import type { DartTypeWitness } from '../../foundation/dart-type-witness.ts';
import { sourceColorType } from '../../ui/color-source-adapter.ts';
import { registerDartValueSemantics } from '../../foundation/dart-value.ts';

const hostSwatchType = Symbol('Nelyx ColorSwatch');
export interface ColorSwatchOptions<K = unknown> {
  /** Generic TS arguments erase. Supply a shared token for runtime type equality. */
  readonly typeToken?: object | symbol;
  /** Explicit source representation; never inferred from a host key/value. */
  readonly keyType?: DartTypeWitness<K>;
}
export type ColorSwatchMap<K> = ReadonlyMap<K, Color> | DartMap<K, Color>;

/** get() is the TS bracket adapter. The supplied map remains live, as in Flutter.
 * DartMap preserves its explicit key policy and concurrent-iteration checks;
 * ReadonlyMap retains its host map's lookup/iteration semantics. */
export class ColorSwatch<K> extends Color {
  readonly #swatch: ColorSwatchMap<K>;
  readonly #typeToken: object | symbol;
  readonly #keyType: DartTypeWitness<K> | undefined;
  constructor(
    primary: number | bigint,
    swatch: ColorSwatchMap<K>,
    { typeToken, keyType }: ColorSwatchOptions<K> = {},
  ) {
    super(primary);
    this.#swatch = swatch;
    this.#typeToken = typeToken ?? keyType ?? hostSwatchType;
    this.#keyType = keyType;
    captureDartInterface(this, sourceColorType);
    if (keyType) {
      for (const key of this.keys)
        if (!isDartType(key, keyType))
          throw new TypeError('ColorSwatch key violates its explicit source type');
      captureDartType(
        this,
        applyDartType(ColorSwatch, 'ColorSwatch', [keyType], [sourceColorType]),
      );
    }
  }
  get(key: K): Color | null {
    return this.#swatch.get(key) ?? null;
  }
  get keys(): Iterable<K> {
    const map = this.#swatch;
    return map instanceof DartMap
      ? map.keys
      : Object.freeze({ [Symbol.iterator]: () => map.keys() });
  }
  private get size(): number {
    return this.#swatch instanceof DartMap ? this.#swatch.length : this.#swatch.size;
  }
  override equals(other: unknown): boolean {
    if (this === other) return true;
    if (
      !(other instanceof ColorSwatch) ||
      other.constructor !== this.constructor ||
      other.#typeToken !== this.#typeToken ||
      !super.equals(other) ||
      other.size !== this.size
    )
      return false;
    for (const key of this.keys) {
      const color = this.get(key)!;
      if (!color.equals(other.get(key))) return false;
    }
    return true;
  }
  // Equal swatches share Core's stable local primary hash. Source VM map identity
  // hashes are intentionally not exposed as a portable wire contract.
  override toString(): string {
    return `${this.constructor.name}(primary value: ${super.toString()})`;
  }
  static override lerp<K>(
    a: ColorSwatch<K> | null,
    b: ColorSwatch<K> | null,
    t: number,
    options: ColorSwatchOptions<K> = {},
  ): ColorSwatch<K> | null {
    if (a === b) return a;
    if ((a !== null && !(a instanceof ColorSwatch)) || (b !== null && !(b instanceof ColorSwatch)))
      throw new TypeError('ColorSwatch.lerp requires swatches');
    const source = a ?? b!,
      table: DartMap<K, Color> | Map<K, Color> =
        source.#swatch instanceof DartMap
          ? new DartMap(source.#swatch.keyPolicy, (value): value is Color => value instanceof Color)
          : new Map<K, Color>();
    // The source deliberately uses a's keys when both endpoints are present.
    // A key absent in b fades out; keys present only in b are not introduced.
    for (const key of source.keys) {
      const color = Color.lerp(a?.get(key) ?? null, b?.get(key) ?? null, t)!;
      table.set(key, color);
    }
    const keyType = options.keyType ?? source.#keyType;
    return new ColorSwatch(Color.lerp(a, b, t)!.toARGB32(), table, {
      typeToken: options.typeToken ?? source.#typeToken,
      ...(keyType ? { keyType } : {}),
    });
  }
}
registerDartValueSemantics(ColorSwatch, {
  accepts: (value: unknown): value is ColorSwatch<unknown> => value instanceof ColorSwatch,
  equals: (value, other) => value.equals(other),
  hash: (value) => value.hashCode,
  string: (value) => value.toString(),
});
