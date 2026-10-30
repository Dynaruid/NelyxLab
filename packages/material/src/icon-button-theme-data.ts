// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { Diagnosticable } from '@nelyx/core/foundation/diagnosticable';
import { DiagnosticsProperty } from '@nelyx/core/foundation/diagnostics';
import type { DiagnosticPropertiesBuilder } from '@nelyx/core/foundation/diagnostics';
import { valueEquals, valueHash } from '@nelyx/core/framework/painting/value-equality';
import { ButtonStyle } from './button-style.ts';

export class IconButtonThemeData extends Diagnosticable(class {}) {
  readonly style: ButtonStyle | null;
  constructor({
    style = null,
  }: {
    readonly style?: ButtonStyle | null;
  } = {}) {
    super();
    this.style = style;
    if (new.target === IconButtonThemeData) Object.freeze(this);
  }
  /** @dartParam t double */ static lerp(
    a: IconButtonThemeData | null,
    b: IconButtonThemeData | null,
    t: number,
  ): IconButtonThemeData | null {
    return a === b
      ? a
      : new IconButtonThemeData({ style: ButtonStyle.lerp(a?.style ?? null, b?.style ?? null, t) });
  }
  equals(other: unknown): boolean {
    return (
      this === other ||
      (other instanceof IconButtonThemeData &&
        other.constructor === this.constructor &&
        valueEquals(this.style, other.style))
    );
  }
  /** @dartReturn int */ get hashCode(): number {
    return valueHash(this.style);
  }
  override debugFillProperties(p: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(p);
    p.add(
      new DiagnosticsProperty('style', this.style, { defaultValue: null, typeName: 'ButtonStyle' }),
    );
  }
}
