// SPDX-License-Identifier: BSD-3-Clause
import { Diagnosticable } from '../../foundation/diagnosticable.ts';
import type { DiagnosticableValue } from '../../foundation/diagnosticable.ts';
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { shortHash } from '../../foundation/diagnostics-identity.ts';
import {
  applyDartType,
  describeDartType,
  runtimeDartType,
} from '../../foundation/dart-type-witness.ts';
import { DartSymbol } from '../../foundation/dart-symbol.ts';

/** Exact host for the selected Mapper's Diagnosticable mixin. Required Object
 * overrides are abstract contracts fulfilled by the complete generated class. */
export abstract class WidgetStateDiagnosticableBase extends Diagnosticable(class {}) {
  abstract equals(other: {}): boolean;
  abstract get hashCode(): number;
  abstract noSuchMethod(invocation: unknown): never;
  override toStringShort(): string {
    const name = FoundationBuildMode.debug
      ? describeDartType(runtimeDartType(this))
      : '<optimized out>';
    return name + '#' + shortHash(this);
  }
}

export const widgetStateDiagnosticableType = applyDartType<DiagnosticableValue>(
  WidgetStateDiagnosticableBase,
  'Diagnosticable',
  [],
  [],
);

export type WidgetStateTypeError = TypeError;
export function isWidgetStateTypeError(value: unknown): value is TypeError {
  return value instanceof TypeError;
}
export function castWidgetStateTypeError(value: unknown): TypeError {
  if (!isWidgetStateTypeError(value)) throw new TypeError('Expected the host source TypeError');
  return value;
}
/** Message-only ArgumentError entry used by the unchanged Mapper.resolve body. */
export class WidgetStateArgumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArgumentError';
  }
  override toString(): string {
    return 'Invalid argument(s): ' + this.message;
  }
}

/** Member-name projection consumed by the Mapper's original noSuchMethod body.
 * This does not implement general invocation dispatch or argument reflection. */
export class WidgetStateInvocation {
  readonly #memberName: DartSymbol;
  constructor(memberName: DartSymbol) {
    if (!DartSymbol.is(memberName)) throw new TypeError('Expected a represented Dart Symbol');
    this.#memberName = memberName;
    Object.freeze(this);
  }
  static is(value: unknown): value is WidgetStateInvocation {
    return value !== null && typeof value === 'object' && #memberName in value;
  }
  get memberName(): DartSymbol {
    return this.#memberName;
  }
}
export function widgetStateInvocationMemberName(value: WidgetStateInvocation): DartSymbol {
  if (!WidgetStateInvocation.is(value))
    throw new TypeError('Expected the source invocation member-name boundary');
  return value.memberName;
}
