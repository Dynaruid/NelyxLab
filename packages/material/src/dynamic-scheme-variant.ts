// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Canonical enum order/index resolved from pinned color_scheme.dart.
import { invariant } from '@nelyx/core/foundation/errors';
const variantToken = Symbol('DynamicSchemeVariant');
type VariantName =
  | 'tonalSpot'
  | 'fidelity'
  | 'monochrome'
  | 'neutral'
  | 'vibrant'
  | 'expressive'
  | 'content'
  | 'rainbow'
  | 'fruitSalad';
export class DynamicSchemeVariant {
  /** @dartType int */ readonly index: number;
  /** @dartParam index int */
  private constructor(
    index: number,
    readonly name: VariantName,
    token: typeof variantToken,
  ) {
    invariant(
      token === variantToken,
      'invalid-enum-construction',
      'DynamicSchemeVariant values cannot be constructed',
    );
    this.index = index;
    Object.freeze(this);
  }
  static readonly tonalSpot = new DynamicSchemeVariant(0, 'tonalSpot', variantToken);
  static readonly fidelity = new DynamicSchemeVariant(1, 'fidelity', variantToken);
  static readonly monochrome = new DynamicSchemeVariant(2, 'monochrome', variantToken);
  static readonly neutral = new DynamicSchemeVariant(3, 'neutral', variantToken);
  static readonly vibrant = new DynamicSchemeVariant(4, 'vibrant', variantToken);
  static readonly expressive = new DynamicSchemeVariant(5, 'expressive', variantToken);
  static readonly content = new DynamicSchemeVariant(6, 'content', variantToken);
  static readonly rainbow = new DynamicSchemeVariant(7, 'rainbow', variantToken);
  static readonly fruitSalad = new DynamicSchemeVariant(8, 'fruitSalad', variantToken);
  static readonly values: readonly DynamicSchemeVariant[] = Object.freeze([
    DynamicSchemeVariant.tonalSpot,
    DynamicSchemeVariant.fidelity,
    DynamicSchemeVariant.monochrome,
    DynamicSchemeVariant.neutral,
    DynamicSchemeVariant.vibrant,
    DynamicSchemeVariant.expressive,
    DynamicSchemeVariant.content,
    DynamicSchemeVariant.rainbow,
    DynamicSchemeVariant.fruitSalad,
  ]);
  toString(): string {
    return 'DynamicSchemeVariant.' + this.name;
  }
}
Object.freeze(DynamicSchemeVariant.prototype);
Object.freeze(DynamicSchemeVariant);
