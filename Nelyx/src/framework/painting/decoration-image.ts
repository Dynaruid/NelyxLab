// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { invariant } from '../../foundation/errors.ts';
import { Canvas } from '../../ui/canvas.ts';
import { Paint } from '../../ui/paint.ts';
import type { BlendMode } from '../../ui/paint.ts';
import type { Image } from '../../ui/image.ts';
import { Rect } from '../../ui/rect.ts';
import { Offset } from '../../ui/offset.ts';
import { Size } from '../../ui/size.ts';
import type { Path } from '../../ui/path.ts';
import type { ColorFilter } from '../../ui/color-filter.ts';
import type { FilterQuality } from '../../ui/paint-effects-data.ts';
import { Alignment, AlignmentGeometry } from './alignment.ts';
import { applyBoxFit } from './box-fit.ts';
import type { BoxFit } from './box-fit.ts';
import { ImageProvider } from './image-provider.ts';
import { ImageStreamListener } from './image-stream.ts';
import type { ImageInfo, ImageStream, ImageErrorListener } from './image-stream.ts';
import type { ImageConfiguration } from './image-configuration.ts';
import { valueEquals, hashValues } from './value-equality.ts';
export type ImageRepeat = 'repeat' | 'repeatX' | 'repeatY' | 'noRepeat';
export interface PaintImageOptions {
  readonly canvas: Canvas;
  readonly rect: Rect;
  readonly image: Image;
  readonly debugImageLabel?: string | null;
  readonly scale?: number;
  readonly opacity?: number;
  readonly colorFilter?: ColorFilter | null;
  readonly fit?: BoxFit | null;
  readonly alignment?: Alignment;
  readonly centerSlice?: Rect | null;
  readonly repeat?: ImageRepeat;
  readonly flipHorizontally?: boolean;
  readonly invertColors?: boolean;
  readonly filterQuality?: FilterQuality;
  readonly isAntiAlias?: boolean;
  readonly blendMode?: BlendMode;
}
function _scaleRect(rect: Rect, scale: number): Rect {
  return Rect.fromLTRB(
    rect.left * scale,
    rect.top * scale,
    rect.right * scale,
    rect.bottom * scale,
  );
}
function* _generateImageTileRects(
  output: Rect,
  fundamental: Rect,
  repeat: ImageRepeat,
): Iterable<Rect> {
  let startX = 0,
    startY = 0,
    stopX = 0,
    stopY = 0;
  const strideX = fundamental.width,
    strideY = fundamental.height;
  if (strideX <= 0 || strideY <= 0) return;
  if (repeat === 'repeat' || repeat === 'repeatX') {
    startX = Math.floor((output.left - fundamental.left) / strideX);
    stopX = Math.ceil((output.right - fundamental.right) / strideX);
  }
  if (repeat === 'repeat' || repeat === 'repeatY') {
    startY = Math.floor((output.top - fundamental.top) / strideY);
    stopY = Math.ceil((output.bottom - fundamental.bottom) / strideY);
  }
  invariant(
    (stopX - startX + 1) * (stopY - startY + 1) <= 4096,
    'image-tile-budget',
    'Repeated image exceeds frame tile budget',
  );
  for (let x = startX; x <= stopX; x++)
    for (let y = startY; y <= stopY; y++)
      yield fundamental.shift(new Offset(x * strideX, y * strideY));
}
export function paintImage({
  canvas,
  rect,
  image,
  scale = 1,
  opacity = 1,
  colorFilter = null,
  fit = null,
  alignment = Alignment.center,
  centerSlice = null,
  repeat = 'noRepeat',
  flipHorizontally = false,
  invertColors = false,
  filterQuality = 'medium',
  isAntiAlias = false,
  blendMode = 'srcOver',
}: PaintImageOptions): void {
  invariant(!image.debugDisposed, 'disposed-image', 'Cannot paint a disposed image');
  invariant(
    Number.isFinite(scale) && scale > 0 && Number.isFinite(opacity),
    'invalid-image-paint',
    'Image scale/opacity must be finite and scale positive',
  );
  invariant(
    ['repeat', 'repeatX', 'repeatY', 'noRepeat'].includes(repeat),
    'invalid-image-repeat',
    'Unknown image repeat',
  );
  if (rect.isEmpty) return;
  let output = new Size(rect.width, rect.height),
    input = new Size(image.width, image.height),
    slice: Offset | null = null,
    sliceFits = true;
  if (centerSlice) {
    slice = new Offset(
      input.width / scale - centerSlice.width,
      input.height / scale - centerSlice.height,
    );
    output = output.subtract(slice) as Size;
    input = input.subtract(slice.multiply(scale)) as Size;
    sliceFits = output.width > 0 && output.height > 0;
  }
  fit ??= centerSlice === null ? 'scaleDown' : 'fill';
  invariant(
    centerSlice === null || (fit !== 'none' && fit !== 'cover'),
    'invalid-image-slice-fit',
    'Nine-patch cannot use none/cover',
  );
  const fitted = applyBoxFit(fit, input.divide(scale), output),
    sourceSize = fitted.source.multiply(scale);
  let destinationSize = fitted.destination;
  if (centerSlice) {
    output = output.add(slice!);
    destinationSize = destinationSize.add(slice!);
    invariant(
      !sliceFits ||
        (Math.abs(sourceSize.width - input.width) <= 1e-10 &&
          Math.abs(sourceSize.height - input.height) <= 1e-10),
      'invalid-image-slice-fit',
      'Nine-patch fit must show the entire source',
    );
  }
  if (destinationSize.isEmpty) return;
  if (repeat !== 'noRepeat' && destinationSize.equals(output)) repeat = 'noRepeat';
  const paint = new Paint({
      color: (Math.round(Math.min(1, Math.max(0, opacity)) * 255) << 24) >>> 0,
      colorFilter,
      filterQuality,
      invertColors,
      isAntiAlias,
      blendMode,
    }),
    halfW = (output.width - destinationSize.width) / 2,
    halfH = (output.height - destinationSize.height) / 2,
    dx = halfW + (flipHorizontally ? -alignment.x : alignment.x) * halfW,
    dy = halfH + alignment.y * halfH,
    destination = Rect.fromLTWH(
      rect.left + dx,
      rect.top + dy,
      destinationSize.width,
      destinationSize.height,
    ),
    save = centerSlice !== null || repeat !== 'noRepeat' || flipHorizontally;
  if (save) canvas.save();
  try {
    if (repeat !== 'noRepeat') canvas.clipRect(rect);
    if (flipHorizontally) {
      const center = rect.left + rect.width / 2;
      canvas.translate(center, 0);
      canvas.scale(-1, 1);
      canvas.translate(-center, 0);
    }
    if (centerSlice === null) {
      const source = alignment.inscribe(sourceSize, Rect.fromLTWH(0, 0, input.width, input.height));
      if (repeat === 'noRepeat') canvas.drawImageRect(image, source, destination, paint);
      else
        for (const tile of _generateImageTileRects(rect, destination, repeat))
          canvas.drawImageRect(image, source, tile, paint);
    } else {
      canvas.scale(1 / scale);
      const center = _scaleRect(centerSlice, scale);
      if (repeat === 'noRepeat')
        canvas.drawImageNine(image, center, _scaleRect(destination, scale), paint);
      else
        for (const tile of _generateImageTileRects(rect, destination, repeat))
          canvas.drawImageNine(image, center, _scaleRect(tile, scale), paint);
    }
  } finally {
    if (save) canvas.restore();
  }
}
export interface DecorationImageOptions {
  readonly image: ImageProvider;
  readonly placeholder?: ImageProvider | null;
  readonly onError?: ImageErrorListener | null;
  readonly colorFilter?: ColorFilter | null;
  readonly fit?: BoxFit | null;
  readonly alignment?: AlignmentGeometry;
  readonly centerSlice?: Rect | null;
  readonly repeat?: ImageRepeat;
  readonly matchTextDirection?: boolean;
  readonly scale?: number;
  readonly opacity?: number;
  readonly filterQuality?: FilterQuality;
  readonly invertColors?: boolean;
  readonly isAntiAlias?: boolean;
}
export interface DecorationImagePaintOptions {
  readonly blend?: number;
  readonly blendMode?: BlendMode;
}
export interface DecorationImagePainter {
  paint(
    canvas: Canvas,
    rect: Rect,
    clipPath: Path | null,
    configuration: ImageConfiguration,
    options?: DecorationImagePaintOptions,
  ): void;
  dispose(): void;
}
export class DecorationImage {
  readonly image: ImageProvider;
  readonly placeholder: ImageProvider | null;
  readonly onError: ImageErrorListener | null;
  readonly colorFilter: ColorFilter | null;
  readonly fit: BoxFit | null;
  readonly alignment: AlignmentGeometry;
  readonly centerSlice: Rect | null;
  readonly repeat: ImageRepeat;
  readonly matchTextDirection: boolean;
  readonly scale: number;
  readonly opacity: number;
  readonly filterQuality: FilterQuality;
  readonly invertColors: boolean;
  readonly isAntiAlias: boolean;
  constructor({
    image,
    placeholder = null,
    onError = null,
    colorFilter = null,
    fit = null,
    alignment = Alignment.center,
    centerSlice = null,
    repeat = 'noRepeat',
    matchTextDirection = false,
    scale = 1,
    opacity = 1,
    filterQuality = 'medium',
    invertColors = false,
    isAntiAlias = false,
  }: DecorationImageOptions) {
    this.image = image;
    this.placeholder = placeholder;
    this.onError = onError;
    this.colorFilter = colorFilter;
    this.fit = fit;
    this.alignment = alignment;
    this.centerSlice = centerSlice;
    this.repeat = repeat;
    this.matchTextDirection = matchTextDirection;
    this.scale = scale;
    this.opacity = opacity;
    this.filterQuality = filterQuality;
    this.invertColors = invertColors;
    this.isAntiAlias = isAntiAlias;
    invariant(
      Number.isFinite(scale) && scale > 0 && Number.isFinite(opacity),
      'invalid-decoration-image',
      'Decoration image scale/opacity must be finite and scale positive',
    );
  }
  createPainter(onChanged: () => void): DecorationImagePainter {
    return new _DecorationImagePainter(this, onChanged);
  }
  equals(other: unknown): boolean {
    return (
      other instanceof DecorationImage &&
      other.constructor === this.constructor &&
      valueEquals(other.image, this.image) &&
      valueEquals(other.placeholder, this.placeholder) &&
      valueEquals(other.colorFilter, this.colorFilter) &&
      other.fit === this.fit &&
      valueEquals(other.alignment, this.alignment) &&
      valueEquals(other.centerSlice, this.centerSlice) &&
      other.repeat === this.repeat &&
      other.matchTextDirection === this.matchTextDirection &&
      other.scale === this.scale &&
      other.opacity === this.opacity &&
      other.filterQuality === this.filterQuality &&
      other.invertColors === this.invertColors &&
      other.isAntiAlias === this.isAntiAlias
    );
  }
  get hashCode(): number {
    return hashValues(
      this.image,
      this.placeholder,
      this.colorFilter,
      this.fit,
      this.alignment,
      this.centerSlice,
      this.repeat,
      this.matchTextDirection,
      this.scale,
      this.opacity,
      this.filterQuality,
      this.invertColors,
      this.isAntiAlias,
    );
  }
  static lerp(
    a: DecorationImage | null,
    b: DecorationImage | null,
    t: number,
  ): DecorationImage | null {
    if (a === b || t === 0) return a;
    if (t === 1) return b;
    return new _BlendedDecorationImage(a, b, t);
  }
  toString(): string {
    return `DecorationImage(${this.image}, ${this.alignment}, scale ${this.scale}, opacity ${this.opacity}, ${this.filterQuality})`;
  }
}
class _DecorationImagePainter implements DecorationImagePainter {
  private dead = false;
  private stream: ImageStream | null = null;
  private image: ImageInfo | null = null;
  private placeholderStream: ImageStream | null = null;
  private placeholder: ImageInfo | null = null;
  private readonly listener: ImageStreamListener;
  private readonly placeholderListener: ImageStreamListener;
  constructor(
    private readonly details: DecorationImage,
    private readonly onChanged: () => void,
  ) {
    const onError: ImageErrorListener | null =
      details.onError === null
        ? null
        : (error, stack) => {
            if (!this.dead) details.onError!(error, stack);
          };
    this.listener = new ImageStreamListener((info, sync) => this.handle(info, sync, false), {
      onError,
    });
    this.placeholderListener = new ImageStreamListener(
      (info, sync) => this.handle(info, sync, true),
      { onError },
    );
  }
  private handle(info: ImageInfo, synchronous: boolean, placeholder: boolean): void {
    if (this.dead || (placeholder && this.image !== null)) {
      info.dispose();
      return;
    }
    const previous = placeholder ? this.placeholder : this.image;
    if (previous === info) return;
    if (previous?.isCloneOf(info)) {
      info.dispose();
      return;
    }
    previous?.dispose();
    if (placeholder) this.placeholder = info;
    else {
      this.image = info;
      this.disposePlaceholder();
    }
    if (!synchronous) this.onChanged();
  }
  private disposePlaceholder(): void {
    const stream = this.placeholderStream,
      info = this.placeholder;
    this.placeholderStream = null;
    this.placeholder = null;
    try {
      stream?.removeListener(this.placeholderListener);
    } finally {
      info?.dispose();
    }
  }
  paint(
    canvas: Canvas,
    rect: Rect,
    clipPath: Path | null,
    configuration: ImageConfiguration,
    { blend = 1, blendMode = 'srcOver' }: DecorationImagePaintOptions = {},
  ): void {
    invariant(
      !this.dead,
      'disposed-decoration-image-painter',
      'Cannot paint a disposed image painter',
    );
    if (this.details.matchTextDirection)
      invariant(
        configuration.textDirection !== null,
        'missing-text-direction',
        'matchTextDirection requires a text direction',
      );
    if (this.image === null && this.details.placeholder !== null) {
      const next = this.details.placeholder.resolve(configuration);
      if (next.key !== this.placeholderStream?.key) {
        this.placeholderStream?.removeListener(this.placeholderListener);
        this.placeholderStream = next;
        next.addListener(this.placeholderListener);
      }
    }
    const next = this.details.image.resolve(configuration);
    if (next.key !== this.stream?.key) {
      this.stream?.removeListener(this.listener);
      this.stream = next;
      next.addListener(this.listener);
    }
    const info = this.image ?? this.placeholder;
    if (!info) return;
    if (clipPath) canvas.save();
    try {
      if (clipPath) canvas.clipPath(clipPath);
      paintImage({
        canvas,
        rect,
        image: info.image,
        debugImageLabel: info.debugLabel,
        scale: this.details.scale * info.scale,
        opacity: this.details.opacity * blend,
        colorFilter: this.details.colorFilter,
        fit: this.details.fit,
        alignment: this.details.alignment.resolve(configuration.textDirection),
        centerSlice: this.details.centerSlice,
        repeat: this.details.repeat,
        flipHorizontally: this.details.matchTextDirection && configuration.textDirection === 'rtl',
        filterQuality: this.details.filterQuality,
        invertColors: this.details.invertColors,
        isAntiAlias: this.details.isAntiAlias,
        blendMode,
      });
    } finally {
      if (clipPath) canvas.restore();
    }
  }
  dispose(): void {
    if (this.dead) return;
    this.dead = true;
    const stream = this.stream,
      info = this.image;
    this.stream = null;
    this.image = null;
    const errors: unknown[] = [];
    for (const cleanup of [
      () => stream?.removeListener(this.listener),
      () => info?.dispose(),
      () => this.disposePlaceholder(),
    ])
      try {
        cleanup();
      } catch (error) {
        errors.push(error);
      }
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, 'Decoration image disposal failed');
  }
}
class _BlendedDecorationImage extends DecorationImage {
  constructor(
    readonly a: DecorationImage | null,
    readonly b: DecorationImage | null,
    readonly t: number,
  ) {
    const preferred = b ?? a;
    invariant(preferred !== null, 'invalid-image-blend', 'Image blend needs at least one image');
    super(preferred);
  }
  override createPainter(onChanged: () => void): DecorationImagePainter {
    return new _BlendedDecorationImagePainter(
      this.a?.createPainter(onChanged) ?? null,
      this.b?.createPainter(onChanged) ?? null,
      this.t,
    );
  }
  override equals(other: unknown): boolean {
    return (
      other instanceof _BlendedDecorationImage &&
      valueEquals(other.a, this.a) &&
      valueEquals(other.b, this.b) &&
      other.t === this.t
    );
  }
  override get hashCode(): number {
    return hashValues(this.a, this.b, this.t);
  }
  override toString(): string {
    return `_BlendedDecorationImage(${this.a}, ${this.b}, ${this.t})`;
  }
}
class _BlendedDecorationImagePainter implements DecorationImagePainter {
  private dead = false;
  constructor(
    readonly a: DecorationImagePainter | null,
    readonly b: DecorationImagePainter | null,
    readonly t: number,
  ) {}
  paint(
    canvas: Canvas,
    rect: Rect,
    clipPath: Path | null,
    configuration: ImageConfiguration,
    { blend = 1, blendMode = 'srcOver' }: DecorationImagePaintOptions = {},
  ): void {
    invariant(!this.dead, 'disposed-decoration-image-painter', 'Cannot paint disposed image blend');
    canvas.saveLayer(null, new Paint());
    try {
      this.a?.paint(canvas, rect, clipPath, configuration, {
        blend: blend * (1 - this.t),
        blendMode,
      });
      this.b?.paint(canvas, rect, clipPath, configuration, {
        blend: blend * this.t,
        blendMode: this.a ? 'plus' : blendMode,
      });
    } finally {
      canvas.restore();
    }
  }
  dispose(): void {
    if (this.dead) return;
    this.dead = true;
    const errors: unknown[] = [];
    for (const painter of [this.a, this.b])
      try {
        painter?.dispose();
      } catch (error) {
        errors.push(error);
      }
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, 'Image blend disposal failed');
  }
}
