// SPDX-License-Identifier: BSD-3-Clause
import type { Declaration } from './body-ir.ts';

const durationId = 'dart:core::Duration:CLASS';
const durationConstructor = 'dart:core::Duration.Duration.new:CONSTRUCTOR';
const wholeMilliseconds: ReadonlyMap<string, number> = new Map([
  ['days', 86_400_000],
  ['hours', 3_600_000],
  ['minutes', 60_000],
  ['seconds', 1_000],
  ['milliseconds', 1],
]);

export function wholeMillisecondDurationConstants(declarations: readonly Declaration[]): boolean {
  return (
    declarations.length > 0 &&
    declarations.every((declaration) => {
      if (declaration.kind !== 'constant') return false;
      const { value } = declaration;
      if (
        declaration.type !== 'Duration' ||
        value.kind !== 'construct' ||
        value.name !== 'Duration' ||
        !value.const ||
        value.constructor !== null ||
        value.reference?.id !== durationConstructor
      )
        return false;
      const type = declaration.resolvedType ?? value.constructedType;
      if (type?.kind !== 'interface' || type.nullable || type.reference.id !== durationId)
        return false;
      const names = new Set<string>();
      let magnitude = 0;
      for (const { name, value: argument } of value.args) {
        if (name === null || names.has(name)) return false;
        const factor = wholeMilliseconds.get(name);
        if (
          factor === undefined ||
          argument.kind !== 'literal' ||
          argument.type !== 'int' ||
          typeof argument.value !== 'number' ||
          !Number.isSafeInteger(argument.value)
        )
          return false;
        names.add(name);
        magnitude += Math.abs(argument.value) * factor;
        if (!Number.isSafeInteger(magnitude * 1000)) return false;
      }
      return true;
    })
  );
}
