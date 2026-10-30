// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { FoundationBuildMode } from './constants.ts';
import { objectRuntimeType } from './object.ts';
const identities = new WeakMap<object, number>();
let nextIdentity = 0;
/** Supplied hashCode values retain their low20 bits; otherwise use stable host identities. */
export function shortHash(value: unknown): string {
  let hash: number;
  if (value !== null && (typeof value === 'object' || typeof value === 'function')) {
    const supplied = (value as { readonly hashCode?: unknown }).hashCode;
    if (typeof supplied === 'number') hash = supplied;
    else {
      let assigned = identities.get(value);
      if (assigned === undefined) {
        assigned = ++nextIdentity;
        identities.set(value, assigned);
      }
      hash = assigned;
    }
  } else {
    const text = typeof value + ':' + String(value);
    hash = 2166136261;
    for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  }
  return (hash & 0xfffff).toString(16).padStart(5, '0');
}
export function describeIdentity(value: unknown): string {
  return objectRuntimeType(value, '<optimized out>') + '#' + shortHash(value);
}
export function describeEnum(value: unknown): string {
  if (
    value !== null &&
    typeof value === 'object' &&
    'name' in value &&
    typeof value.name === 'string'
  )
    return value.name;
  const text = String(value),
    index = text.indexOf('.');
  if (FoundationBuildMode.debug && (index === -1 || index === text.length - 1))
    throw new Error('The provided object "' + text + '" is not an enum.');
  return text.slice(index + 1);
}
