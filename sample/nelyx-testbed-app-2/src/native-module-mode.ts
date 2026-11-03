// SPDX-License-Identifier: BSD-3-Clause
export type NativeModuleMode =
  | 'all'
  | 'retained'
  | 'snapshot'
  | 'path'
  | 'paint'
  | 'composition'
  | 'semantics'
  | 'backing'
  | 'text'
  | 'layout'
  | 'frame'
  | 'ts';

export function nativeModuleLabel(mode?: NativeModuleMode): string {
  return mode ? ' · ' + (mode === 'ts' ? 'TS' : 'C++ ' + mode) : '';
}
