// SPDX-License-Identifier: BSD-3-Clause
import type { Disposable } from '../foundation/disposable.ts';
import { FlutterError } from '../foundation/flutter-error.ts';
import type { ImmutableBuffer } from './immutable-buffer.ts';

/** @internal Copied chunks are only for bounded engine transport consumers. */
export interface ImmutableBufferLease extends Disposable {
  readonly length: number;
  read(offset: number, length: number): Uint8Array;
}
export interface ImmutableBufferValue extends Disposable {
  readonly length: number;
  retain(): ImmutableBufferLease;
}
export interface ImmutableBufferLoader {
  create(bytes: Uint8Array): ImmutableBufferValue;
  loadAsset(key: string): Promise<ImmutableBufferValue>;
  loadFile(path: string): Promise<ImmutableBufferValue>;
}
let backend: ImmutableBufferLoader | null = null;
let required = false;
let canonical: typeof ImmutableBuffer | undefined;
let wrap: ((value: ImmutableBufferValue) => ImmutableBuffer) | undefined;
const bindings = new Set<object>();
const values = new WeakMap<object, ImmutableBufferValue>();
export function registerImmutableBufferFactory(
  type: typeof ImmutableBuffer,
  factory: typeof wrap,
): void {
  if (wrap || !factory) throw new FlutterError('ImmutableBuffer factory already registered');
  wrap = factory;
  canonical = type;
  required = true;
}
/** Importing the canonical API declares its synchronous copy requirement before build. */
export function immutableBufferBackendRequired(): boolean {
  return required;
}
export function bindImmutableBufferLoader(value: ImmutableBufferLoader): Disposable {
  if (backend && backend !== value)
    throw new FlutterError('A different ImmutableBuffer owner already owns this realm');
  backend = value;
  const binding = {};
  bindings.add(binding);
  return {
    dispose() {
      if (!bindings.delete(binding)) return;
      if (!bindings.size) backend = null;
    },
  };
}
export function currentImmutableBufferLoader(): ImmutableBufferLoader {
  if (!backend) throw new FlutterError('ImmutableBuffer requires an initialized App buffer owner');
  return backend;
}
export function wrapImmutableBuffer(
  value: ImmutableBufferValue,
  type: typeof ImmutableBuffer,
): ImmutableBuffer {
  if (!wrap || type !== canonical)
    throw new FlutterError('ImmutableBuffer factory is unavailable/foreign');
  return wrap(value);
}
export function registerImmutableBuffer(value: object, native: ImmutableBufferValue): void {
  values.set(value, native);
}
export function retireImmutableBuffer(value: object): void {
  values.delete(value);
}
export function retainImmutableBuffer(value: object): ImmutableBufferLease {
  const native = values.get(value);
  if (!native) throw new FlutterError('ImmutableBuffer is foreign/disposed');
  return native.retain();
}
