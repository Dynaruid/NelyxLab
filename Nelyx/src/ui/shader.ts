// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from dart:ui Shader/Gradient/ImageShader at the recorded source pin.
import { invariant } from '../foundation/errors.ts';
import type { Offset } from './geometry.ts';
import type { ResourceId } from './types.ts';
import { Image } from './image.ts';
import { retainResource } from './resource-retention.ts';
import { freezeShader } from './paint-effects-data.ts';
import type { ShaderSnapshot, TileMode, FilterQuality } from './paint-effects-data.ts';
/** CPU descriptions own no GPU handle; a recorded frame retains image leases. */
export abstract class Shader {
  private _debugDisposed = false;
  protected constructor(
    private readonly description: ShaderSnapshot,
    private readonly retire: (() => void) | null = null,
  ) {}
  get debugDisposed(): boolean {
    return this._debugDisposed;
  }
  snapshot(): ShaderSnapshot {
    invariant(!this._debugDisposed, 'disposed-shader', 'Cannot record a disposed Shader');
    return this.description;
  }
  dispose(): void {
    invariant(!this._debugDisposed, 'disposed-shader', 'Shader cannot be disposed more than once');
    this._debugDisposed = true;
    this.retire?.();
  }
}
export class Gradient extends Shader {
  private constructor(value: ShaderSnapshot) {
    super(freezeShader(value));
  }
  static linear(
    from: Offset,
    to: Offset,
    colors: readonly number[],
    colorStops: readonly number[] | null = null,
    tileMode: TileMode = 'clamp',
    matrix4: ArrayLike<number> | null = null,
  ): Gradient {
    return new Gradient({
      kind: 'linear',
      points: [from.x, from.y, to.x, to.y],
      colors,
      stops: colorStops,
      tileMode,
      matrix: matrix4 === null ? null : Array.from(matrix4),
    });
  }
  static radial(
    center: Offset,
    radius: number,
    colors: readonly number[],
    colorStops: readonly number[] | null = null,
    tileMode: TileMode = 'clamp',
    matrix4: ArrayLike<number> | null = null,
    focal: Offset | null = null,
    focalRadius = 0,
  ): Gradient {
    const start = focal ?? center;
    return new Gradient({
      kind: 'radial',
      points: [start.x, start.y, focal === null ? 0 : focalRadius, center.x, center.y, radius],
      colors,
      stops: colorStops,
      tileMode,
      matrix: matrix4 === null ? null : Array.from(matrix4),
    });
  }
  static sweep(
    center: Offset,
    colors: readonly number[],
    colorStops: readonly number[] | null = null,
    tileMode: TileMode = 'clamp',
    startAngle = 0,
    endAngle = Math.PI * 2,
    matrix4: ArrayLike<number> | null = null,
  ): Gradient {
    return new Gradient({
      kind: 'sweep',
      points: [center.x, center.y, startAngle, endAngle],
      colors,
      stops: colorStops,
      tileMode,
      matrix: matrix4 === null ? null : Array.from(matrix4),
    });
  }
}
export class ImageShader extends Shader {
  constructor(
    image: Image | ResourceId,
    tmx: TileMode,
    tmy: TileMode,
    matrix4: ArrayLike<number>,
    { filterQuality = null }: { readonly filterQuality?: FilterQuality | null } = {},
  ) {
    const resource = image instanceof Image ? image.resource : image,
      description = freezeShader({
        kind: 'image',
        image: resource,
        tileModeX: tmx,
        tileModeY: tmy,
        matrix: Array.from(matrix4),
        filterQuality,
      }),
      hold = retainResource(resource);
    super(description, hold ? () => hold.dispose() : null);
  }
}
/** Nelyx SkSL value shader. Float uniforms only; compilation errors surface at render.
 * Recorded frames own immutable values and remain valid after this wrapper retires.
 * This is not Flutter's asset-based FragmentProgram API.
 */
export class RuntimeShader extends Shader {
  constructor(source: string, uniforms: readonly number[]) {
    super(freezeShader({ kind: 'runtime', source, uniforms }));
  }
}
