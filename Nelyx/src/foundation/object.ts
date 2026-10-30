// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { FoundationBuildMode } from './constants.ts';
/** Runtime labels are host JavaScript labels; Dart reified type ABI is not implied. */
export function objectRuntimeType(value: unknown, optimizedValue: string): string {
  if (!FoundationBuildMode.debug) return optimizedValue;
  if (value === null) return 'Null';
  if (value === undefined) return 'Undefined';
  if (typeof value === 'string') return 'String';
  if (typeof value === 'boolean') return 'bool';
  if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'double';
  return (
    (Object.getPrototypeOf(Object(value)) as { constructor?: { name?: string } } | null)
      ?.constructor?.name ?? typeof value
  );
}
