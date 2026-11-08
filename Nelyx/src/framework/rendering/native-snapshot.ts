// SPDX-License-Identifier: BSD-3-Clause
/** Source paint policy. Content resolves these factors against the actual box/image size. */
export interface NativeSnapshotPaint {
  readonly scaleX?: number;
  readonly scaleY?: number;
  readonly translateXFactor?: number;
  readonly translateYFactor?: number;
  readonly offsetX?: number;
  readonly offsetY?: number;
  readonly opacity?: number;
  readonly backgroundColor?: number;
  /** Stretch uses the current box; intrinsic uses the captured pixel size / pixelRatio. */
  readonly sizing?: 'stretch' | 'intrinsic';
}
export interface NativeSnapshotPainterConfiguration {
  readonly live?: NativeSnapshotPaint;
  readonly snapshot?: NativeSnapshotPaint;
}
export interface NativeSnapshotConfiguration extends NativeSnapshotPainterConfiguration {
  readonly revision: bigint;
  readonly enabled: boolean;
  readonly autoresize: boolean;
  readonly pixelRatio: number;
  readonly mode: 'normal' | 'permissive' | 'forced';
}
type Reader<T extends object> = (painter: T) => NativeSnapshotPainterConfiguration;
const readers = new WeakMap<
  object,
  { readonly read: Reader<object>; readonly methods: readonly unknown[] }
>();
const methodNames = ['paint', 'paintSnapshot', 'shouldRepaint'] as const;
/** @internal Explicit native declarations do not execute a painter's JS render hooks. */
export function registerNativeSnapshotPainter<T extends object>(
  prototype: T,
  read: Reader<T>,
): void {
  if (readers.has(prototype)) throw Error('Native snapshot painter is already registered');
  readers.set(prototype, {
    read: read as Reader<object>,
    methods: methodNames.map((name) => Reflect.get(prototype, name)),
  });
}
/** @internal An inherited registration never admits an unknown painter subclass. */
export function nativeSnapshotPainterConfiguration(
  painter: object,
  reject: (reason: string) => never,
): NativeSnapshotPainterConfiguration {
  const prototype = Object.getPrototypeOf(painter),
    reader = readers.get(prototype);
  if (
    !reader ||
    methodNames.some(
      (name, index) =>
        Object.hasOwn(painter, name) || Reflect.get(prototype, name) !== reader.methods[index],
    )
  )
    return reject('custom-snapshot-painter');
  return reader.read(painter);
}
