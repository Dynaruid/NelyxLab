// SPDX-License-Identifier: BSD-3-Clause
import type { PlatformId } from '@nelyx/core/hosting/platform';
import { matchesVersion } from './compatibility.ts';

export interface ProviderCohort {
  readonly id: string;
  readonly react: string;
  readonly framework: 'react-dom';
  readonly frameworkVersion: string;
  readonly engine: 'browser';
  readonly reactNative: null;
  readonly nativeReactNative: null;
  readonly frameworkRevision: null;
  readonly engineVersion: null;
  readonly engineRevision: null;
  readonly bytecodeVersion: null;
}
export interface ProviderCohortEnvironment {
  readonly cohort?: string;
  readonly reactVersion?: string;
  readonly reactDomVersion?: string;
}

export function validateCohort(value: unknown, target: PlatformId): ProviderCohort {
  if (target !== 'web' || !value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Use the Web React DOM cohort and supply a PWA runner');
  const input = value as Record<string, unknown>;
  const nullable = [
    'reactNative',
    'nativeReactNative',
    'frameworkRevision',
    'engineVersion',
    'engineRevision',
    'bytecodeVersion',
  ];
  const keys = ['id', 'react', 'framework', 'frameworkVersion', 'engine', ...nullable];
  if (
    Object.keys(input).some((key) => !keys.includes(key)) ||
    typeof input.id !== 'string' ||
    !/^[a-z0-9][a-z0-9.-]*$/.test(input.id) ||
    input.framework !== 'react-dom' ||
    input.engine !== 'browser' ||
    nullable.some((key) => input[key] !== null)
  )
    throw new Error('Invalid provider React DOM cohort');
  for (const key of ['react', 'frameworkVersion']) {
    const version = input[key];
    if (typeof version !== 'string' || !matchesVersion(version, version))
      throw new Error('Invalid cohort ' + key);
  }
  return Object.freeze({ ...input }) as unknown as ProviderCohort;
}
