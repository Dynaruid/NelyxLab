// SPDX-License-Identifier: BSD-3-Clause
// Reviewed dart:ui Paint/painting enums at the source pin in upstream coverage.
import { invariant } from '../foundation/errors.ts';
import { blendModeValues } from './blend-mode-data.ts';
import { Shader } from './shader.ts';
import { ColorFilter } from './color-filter.ts';
import { ImageFilter } from './image-filter.ts';
import { MaskFilter } from './mask-filter.ts';
import {
  freezeShader,
  freezeColorFilter,
  freezeImageFilter,
  freezeMaskFilter,
  filterQualities,
} from './paint-effects-data.ts';
import type {
  ShaderSnapshot,
  ColorFilterSnapshot,
  ImageFilterSnapshot,
  MaskFilterSnapshot,
  FilterQuality,
} from './paint-effects-data.ts';
export type PaintingStyle = 'fill' | 'stroke';
export type StrokeCap = 'butt' | 'round' | 'square';
export type StrokeJoin = 'miter' | 'round' | 'bevel';
export const blendModes = blendModeValues;
export type BlendMode = (typeof blendModes)[number];
export interface PaintSnapshot {
  readonly color: number;
  readonly blendMode: BlendMode;
  readonly style: PaintingStyle;
  readonly isAntiAlias: boolean;
  readonly strokeWidth: number;
  readonly strokeCap: StrokeCap;
  readonly strokeJoin: StrokeJoin;
  readonly strokeMiterLimit: number;
  readonly shader?: ShaderSnapshot | null;
  readonly colorFilter?: ColorFilterSnapshot | null;
  readonly imageFilter?: ImageFilterSnapshot | null;
  readonly maskFilter?: MaskFilterSnapshot | null;
  readonly filterQuality?: FilterQuality;
  readonly invertColors?: boolean;
  readonly dither?: boolean;
}
export interface PaintOptions extends Partial<
  Omit<PaintSnapshot, 'shader' | 'colorFilter' | 'imageFilter' | 'maskFilter'>
> {
  readonly shader?: Shader | null;
  readonly colorFilter?: ColorFilter | null;
  readonly imageFilter?: ImageFilter | null;
  readonly maskFilter?: MaskFilter | null;
}
const defaults: PaintSnapshot = Object.freeze({
  color: 0xff000000,
  blendMode: 'srcOver',
  style: 'fill',
  isAntiAlias: true,
  strokeWidth: 0,
  strokeCap: 'butt',
  strokeJoin: 'miter',
  strokeMiterLimit: 4,
});
const fields = new Set([
  ...Object.keys(defaults),
  'shader',
  'colorFilter',
  'imageFilter',
  'maskFilter',
  'filterQuality',
  'invertColors',
  'dither',
]);
const capturedPaints = new WeakSet<PaintSnapshot>();
function scalar(value: number, label: string): number {
  invariant(
    typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= 0 &&
      Number.isFinite(Math.fround(value)),
    'invalid-paint',
    `${label} must be a nonnegative finite SkScalar`,
  );
  return Math.fround(value);
}
/** Copies only supported, validated value fields. No backend object or resource handle enters a frame. */
export function freezePaint(value: PaintSnapshot): PaintSnapshot {
  // Only our own deeply captured values can bypass validation. Image shaders
  // still copy their resource bindings for independent command ownership.
  if (capturedPaints.has(value) && value.shader?.kind !== 'image') return value;
  invariant(
    value && typeof value === 'object' && Object.keys(value).every((key) => fields.has(key)),
    'invalid-paint',
    'Unknown or unsupported paint field',
  );
  invariant(
    Number.isInteger(value.color) && value.color >= 0 && value.color <= 0xffffffff,
    'invalid-color',
    'Paint color must be ARGB uint32',
  );
  invariant(
    blendModes.includes(value.blendMode) &&
      ['fill', 'stroke'].includes(value.style) &&
      typeof value.isAntiAlias === 'boolean' &&
      ['butt', 'round', 'square'].includes(value.strokeCap) &&
      ['miter', 'round', 'bevel'].includes(value.strokeJoin),
    'invalid-paint',
    'Unknown paint enum or anti-alias value',
  );
  const strokeWidth = scalar(value.strokeWidth, 'strokeWidth');
  scalar(value.strokeMiterLimit, 'strokeMiterLimit');
  invariant(
    value.filterQuality === undefined || filterQualities.includes(value.filterQuality),
    'invalid-paint',
    'Unknown filter quality',
  );
  invariant(
    (value.invertColors === undefined || typeof value.invertColors === 'boolean') &&
      (value.dither === undefined || typeof value.dither === 'boolean'),
    'invalid-paint',
    'Invalid invertColors/dither',
  );
  for (const key of ['shader', 'colorFilter', 'imageFilter', 'maskFilter'] as const)
    invariant(
      value[key] === undefined || value[key] === null || typeof value[key] === 'object',
      'invalid-paint',
      'Invalid nullable paint effect',
    );
  const captured: PaintSnapshot = Object.freeze({
    color: value.color,
    blendMode: value.blendMode,
    style: value.style,
    isAntiAlias: value.isAntiAlias,
    strokeWidth,
    strokeCap: value.strokeCap,
    strokeJoin: value.strokeJoin,
    strokeMiterLimit: value.strokeMiterLimit,
    ...(value.shader ? { shader: freezeShader(value.shader) } : {}),
    ...(value.colorFilter ? { colorFilter: freezeColorFilter(value.colorFilter) } : {}),
    ...(value.imageFilter ? { imageFilter: freezeImageFilter(value.imageFilter) } : {}),
    ...(value.maskFilter ? { maskFilter: freezeMaskFilter(value.maskFilter) } : {}),
    ...(value.filterQuality && value.filterQuality !== 'none'
      ? { filterQuality: value.filterQuality }
      : {}),
    ...(value.invertColors ? { invertColors: true } : {}),
    ...(value.dither ? { dither: true } : {}),
  });
  capturedPaints.add(captured);
  return captured;
}
const emptyPaintOptions: PaintOptions = Object.freeze({});
const defaultPaintSnapshot = freezePaint(defaults);
// Scalar-only snapshots have no resource/effect ownership. Repeated palette and
// low-alpha shadow colors can share them; keep this cache bounded across apps.
const defaultColorPaints = new Map<number, PaintSnapshot>([[defaults.color, defaultPaintSnapshot]]);
function defaultColorPaint(color: number): PaintSnapshot {
  invariant(
    Number.isInteger(color) && color >= 0 && color <= 0xffffffff,
    'invalid-color',
    'Paint color must be ARGB uint32',
  );
  if (Object.is(color, -0)) return freezePaint({ ...defaults, color });
  const cached = defaultColorPaints.get(color);
  if (cached) return cached;
  const value = freezePaint({ ...defaults, color });
  if (defaultColorPaints.size >= 128)
    defaultColorPaints.delete(defaultColorPaints.keys().next().value!);
  defaultColorPaints.set(color, value);
  return value;
}
/** Mutable configuration; recording captures a separate immutable snapshot. */
export class Paint {
  private value: PaintSnapshot;
  private defaultScalars = true;
  private shaderValue: Shader | null = null;
  private colorFilterValue: ColorFilter | null = null;
  private imageFilterValue: ImageFilter | null = null;
  private maskFilterValue: MaskFilter | null = null;
  constructor(options: PaintOptions = emptyPaintOptions) {
    if (options === emptyPaintOptions && new.target === Paint) {
      this.value = defaultPaintSnapshot;
      return;
    }
    const {
      shader = null,
      colorFilter = null,
      imageFilter = null,
      maskFilter = null,
      ...scalars
    } = options;
    this.value =
      options === emptyPaintOptions
        ? defaultPaintSnapshot
        : freezePaint({ ...defaults, ...scalars });
    this.defaultScalars = options === emptyPaintOptions;
    this.strokeMiterLimit = this.value.strokeMiterLimit;
    this.shader = shader;
    this.colorFilter = colorFilter;
    this.imageFilter = imageFilter;
    this.maskFilter = maskFilter;
  }
  static from(other: Paint): Paint {
    invariant(other instanceof Paint, 'invalid-paint', 'Paint.from requires Paint');
    const result = new Paint();
    result.value = other.value;
    result.defaultScalars = other.defaultScalars;
    result.shaderValue = other.shaderValue;
    result.colorFilterValue = other.colorFilterValue;
    result.imageFilterValue = other.imageFilterValue;
    result.maskFilterValue = other.maskFilterValue;
    return result;
  }
  snapshot(): PaintSnapshot {
    return this.shaderValue ||
      this.colorFilterValue ||
      this.imageFilterValue ||
      this.maskFilterValue
      ? freezePaint({
          ...this.value,
          shader: this.shaderValue?.snapshot() ?? null,
          colorFilter: this.colorFilterValue?.snapshot() ?? null,
          imageFilter: this.imageFilterValue?.snapshot() ?? null,
          maskFilter: this.maskFilterValue?.snapshot() ?? null,
        })
      : this.value;
  }
  private update<K extends keyof PaintSnapshot>(key: K, value: PaintSnapshot[K]): void {
    if (Object.is(this.value[key], value)) return;
    if (key === 'color' && this.defaultScalars) this.value = defaultColorPaint(value as number);
    else {
      this.value = freezePaint({ ...this.value, [key]: value });
      this.defaultScalars = false;
    }
  }
  get color(): number {
    return this.value.color;
  }
  set color(value: number) {
    this.update('color', value);
  }
  get blendMode(): BlendMode {
    return this.value.blendMode;
  }
  set blendMode(value: BlendMode) {
    this.update('blendMode', value);
  }
  get style(): PaintingStyle {
    return this.value.style;
  }
  set style(value: PaintingStyle) {
    this.update('style', value);
  }
  get isAntiAlias(): boolean {
    return this.value.isAntiAlias;
  }
  set isAntiAlias(value: boolean) {
    this.update('isAntiAlias', value);
  }
  get strokeWidth(): number {
    return this.value.strokeWidth;
  }
  set strokeWidth(value: number) {
    this.update('strokeWidth', value);
  }
  get strokeCap(): StrokeCap {
    return this.value.strokeCap;
  }
  set strokeCap(value: StrokeCap) {
    this.update('strokeCap', value);
  }
  get strokeJoin(): StrokeJoin {
    return this.value.strokeJoin;
  }
  set strokeJoin(value: StrokeJoin) {
    this.update('strokeJoin', value);
  }
  get strokeMiterLimit(): number {
    return this.value.strokeMiterLimit;
  }
  set strokeMiterLimit(value: number) {
    scalar(value, 'strokeMiterLimit');
    this.update('strokeMiterLimit', Math.fround(value - 4) + 4);
  }
  get shader(): Shader | null {
    return this.shaderValue;
  }
  set shader(value: Shader | null) {
    invariant(
      value === null || value instanceof Shader,
      'invalid-paint',
      'Expected Shader or null',
    );
    invariant(
      value === null || !value.debugDisposed,
      'disposed-shader',
      'Cannot assign a disposed Shader',
    );
    this.shaderValue = value;
  }
  get colorFilter(): ColorFilter | null {
    return this.colorFilterValue;
  }
  set colorFilter(value: ColorFilter | null) {
    invariant(
      value === null || value instanceof ColorFilter,
      'invalid-paint',
      'Expected ColorFilter or null',
    );
    this.colorFilterValue = value;
  }
  get imageFilter(): ImageFilter | null {
    return this.imageFilterValue;
  }
  set imageFilter(value: ImageFilter | null) {
    invariant(
      value === null || value instanceof ImageFilter,
      'invalid-paint',
      'Expected ImageFilter or null',
    );
    this.imageFilterValue = value;
  }
  get maskFilter(): MaskFilter | null {
    return this.maskFilterValue;
  }
  set maskFilter(value: MaskFilter | null) {
    invariant(
      value === null || value instanceof MaskFilter,
      'invalid-paint',
      'Expected MaskFilter or null',
    );
    this.maskFilterValue = value;
  }
  get filterQuality(): FilterQuality {
    return this.value.filterQuality ?? 'none';
  }
  set filterQuality(value: FilterQuality) {
    this.update('filterQuality', value);
  }
  get invertColors(): boolean {
    return this.value.invertColors ?? false;
  }
  set invertColors(value: boolean) {
    this.update('invertColors', value);
  }
  get dither(): boolean {
    return this.value.dither ?? false;
  }
  set dither(value: boolean) {
    this.update('dither', value);
  }
}
