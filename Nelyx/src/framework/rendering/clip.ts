// SPDX-License-Identifier: BSD-3-Clause
// Reviewed Flutter rendering/proxy_box.dart at the exact upstream pin.
import { invariant } from '../../foundation/errors.ts';
import type { Listenable } from '../../foundation/notifier.ts';
import type { Clip } from '../../ui/clip.ts';
import type { Size, Offset, TransformMatrix } from '../../ui/geometry.ts';
import { contains, identity, bounds, multiply, translate, intersect } from '../../ui/geometry.ts';
import type { Rect, SemanticsNode } from '../../ui/types.ts';
import { Paint } from '../../ui/paint.ts';
import { Path } from '../../ui/path.ts';
import { RRect } from '../../ui/rrect.ts';
import { Rect as LtrbRect } from '../../ui/rect.ts';
import { copyRRect } from '../../ui/rrect-data.ts';
import { BorderRadius, BorderRadiusGeometry } from '../painting/border-radius.ts';
import type { BoxShape } from '../painting/box-border.ts';
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { DiagnosticsProperty } from '../../foundation/diagnostics.ts';
import type { DiagnosticPropertiesBuilder } from '../../foundation/diagnostics.ts';
import { ClipRRectLayer, ClipPathLayer, LayerHandle } from './layer.ts';
import type { PaintingContext } from '../painting/context.ts';
import { RenderProxyBox } from './boxes.ts';
import type { BoxConstraints } from './constraints.ts';
import type { RenderBox, RenderObject, HitTestEntry, PipelineOwner } from './object.ts';
import { withRenderPaint, assertOutsideRenderPaint } from './phase.ts';

export interface CustomClipperOptions {
  readonly reclip?: Listenable | null;
  readonly typeToken?: object | symbol;
}
export abstract class CustomClipper<T> implements Listenable {
  readonly reclip: Listenable | null;
  readonly typeToken: object | symbol;
  constructor(options: CustomClipperOptions = {}) {
    invariant(
      Object.keys(options).every((key) => ['reclip', 'typeToken'].includes(key)),
      'unsupported-clipper',
      'Unknown CustomClipper option',
    );
    this.reclip = options.reclip ?? null;
    this.typeToken = options.typeToken ?? this.constructor;
    invariant(
      this.reclip === null ||
        (typeof this.reclip.addListener === 'function' &&
          typeof this.reclip.removeListener === 'function'),
      'invalid-reclip',
      'reclip must implement Listenable',
    );
    invariant(
      typeof this.typeToken === 'symbol' ||
        typeof this.typeToken === 'function' ||
        (typeof this.typeToken === 'object' && this.typeToken !== null),
      'invalid-clipper-token',
      'Clipper type token must have identity',
    );
  }
  addListener(listener: () => void): void {
    this.reclip?.addListener(listener);
  }
  removeListener(listener: () => void): void {
    this.reclip?.removeListener(listener);
  }
  abstract getClip(size: Size): T;
  getApproximateClipRect(size: Size): Rect {
    return { x: 0, y: 0, width: size.width, height: size.height };
  }
  abstract shouldReclip(oldClipper: CustomClipper<T>): boolean;
}
/** Legacy uniform corner input. New rounded clippers can return RRect directly. */
export interface RoundedClip {
  readonly rect: Rect;
  readonly radius: number;
}
interface Subscription {
  readonly source: Listenable;
  readonly callback: () => void;
  active: boolean;
  pending: boolean;
  notified: boolean;
}
export interface RenderClipOptions<T> {
  readonly child?: RenderBox<RenderObject>;
  readonly clipper?: CustomClipper<T> | null;
  readonly clipBehavior?: Clip;
}
function attempt(errors: unknown[], callback: () => void): void {
  try {
    callback();
  } catch (error) {
    errors.push(error);
  }
}
function failures(errors: unknown[], message: string): void {
  if (errors.length === 1) throw errors[0];
  if (errors.length) throw new AggregateError(errors, message);
}
function behavior(value: Clip): Clip {
  invariant(
    ['none', 'hardEdge', 'antiAlias', 'antiAliasWithSaveLayer'].includes(value),
    'invalid-clip',
    'Unknown clip behavior',
  );
  return value;
}
function rectangle(value: Rect): Rect {
  invariant(value, 'invalid-clip', 'Missing clip bounds');
  const { x, y, width, height } = value;
  invariant(
    [x, y, width, height, x + width, y + height].every(
      (n) => typeof n === 'number' && Number.isFinite(n) && Number.isFinite(Math.fround(n)),
    ) &&
      width >= 0 &&
      height >= 0,
    'invalid-clip',
    'Clip bounds must have nonnegative size and finite SkScalar endpoints',
  );
  return Object.freeze({ x, y, width, height });
}
function radius(value: number): number {
  invariant(
    typeof value === 'number' &&
      Number.isFinite(value) &&
      Number.isFinite(Math.fround(value)) &&
      value >= 0,
    'invalid-clip-radius',
    'Clip radius must be a nonnegative finite SkScalar',
  );
  return value;
}
function shouldReclip<T>(next: CustomClipper<T>, previous: CustomClipper<T>): boolean {
  return withRenderPaint(() => {
    const value = next.shouldReclip(previous);
    invariant(typeof value === 'boolean', 'invalid-reclip', 'shouldReclip must return boolean');
    return value;
  });
}

abstract class RenderCustomClip<T, Captured extends T = T> extends RenderProxyBox {
  private current: CustomClipper<T> | null;
  private clipping: Clip;
  private cached: Captured | undefined;
  private revision = 0;
  private computing = false;
  private changing = false;
  private subscription: Subscription | undefined;
  constructor(options: RenderClipOptions<T> = {}) {
    super();
    invariant(
      Object.keys(options).every((key) => ['child', 'clipper', 'clipBehavior'].includes(key)),
      'unsupported-clip',
      'Unknown RenderClip option',
    );
    invariant(
      options.clipper == null || options.clipper instanceof CustomClipper,
      'invalid-clipper',
      'Clipper must extend CustomClipper',
    );
    this.current = options.clipper ?? null;
    this.clipping = behavior(options.clipBehavior ?? 'antiAlias');
    if (options.child) this.child = options.child;
  }
  get clipper(): CustomClipper<T> | null {
    return this.current;
  }
  set clipper(value: CustomClipper<T> | null) {
    this.assertCanMutateLayoutProperty();
    invariant(
      !this.changing && (value === null || value instanceof CustomClipper),
      'invalid-clipper',
      'Wrong or reentrant clipper',
    );
    if (value === this.current) return;
    this.changing = true;
    const errors: unknown[] = [];
    try {
      const old = this.current,
        reclip = !old || !value || old.typeToken !== value.typeToken || shouldReclip(value, old),
        next = this.attached && value ? this.subscribe(value) : undefined,
        previous = this.subscription;
      this.current = value;
      this.subscription = next;
      if (next) {
        next.pending = false;
        next.active = true;
      }
      this.retire(previous, errors);
      if (reclip || next?.notified) attempt(errors, () => this.markNeedsClip());
    } finally {
      this.changing = false;
    }
    failures(errors, 'Clipper replacement failed');
  }
  get clipBehavior(): Clip {
    return this.clipping;
  }
  set clipBehavior(value: Clip) {
    this.assertCanMutateLayoutProperty();
    const next = behavior(value);
    if (next !== this.clipping) {
      this.clipping = next;
      this.markNeedsPaint();
    }
  }
  override get clips(): boolean {
    return this.clipping !== 'none';
  }
  protected markNeedsClip(): void {
    this.cached = undefined;
    this.revision++;
    this.markNeedsPaint();
  }
  protected abstract defaultClip(): Captured;
  protected abstract captureClip(value: T): Captured;
  protected abstract recordClip(
    context: PaintingContext,
    value: Captured,
    antiAlias: boolean,
  ): void;
  protected abstract clipBounds(value: Captured): Rect;
  protected updateClip(): Captured {
    if (this.cached !== undefined) return this.cached;
    invariant(!this.computing, 'reentrant-clip', 'Clip computation cannot reenter');
    const revision = this.revision;
    this.computing = true;
    try {
      const value = withRenderPaint(() =>
        this.captureClip(this.current ? this.current.getClip(this.size) : this.defaultClip()),
      );
      if (revision === this.revision) this.cached = value;
      return value;
    } finally {
      this.computing = false;
    }
  }
  private subscribe(source: Listenable): Subscription {
    const entry: Subscription = {
      source,
      callback: () => {
        if (entry.active && this.attached && !this.debugDisposed) this.markNeedsClip();
        else if (entry.pending) entry.notified = true;
      },
      active: false,
      pending: true,
      notified: false,
    };
    try {
      source.addListener(entry.callback);
      return entry;
    } catch (error) {
      entry.pending = false;
      const errors = [error];
      attempt(errors, () => source.removeListener(entry.callback));
      failures(errors, 'Clip listener registration failed');
      throw error;
    }
  }
  private retire(entry: Subscription | undefined, errors: unknown[]): void {
    if (entry) {
      entry.active = false;
      entry.pending = false;
      attempt(errors, () => entry.source.removeListener(entry.callback));
    }
  }
  override attach(owner: PipelineOwner): void {
    invariant(!this.changing, 'reentrant-clipper', 'Clip binding is active');
    const attached = this.attached;
    super.attach(owner);
    if (attached) return;
    this.changing = true;
    try {
      if (this.current) {
        const entry = this.subscribe(this.current);
        this.subscription = entry;
        entry.pending = false;
        entry.active = true;
        if (entry.notified) this.markNeedsClip();
      }
    } catch (error) {
      const errors = [error];
      this.retire(this.subscription, errors);
      this.subscription = undefined;
      if (!this.parent) attempt(errors, () => super.detach());
      failures(errors, 'Clip attach failed');
    } finally {
      this.changing = false;
    }
  }
  override detach(): void {
    invariant(!this.changing, 'reentrant-clipper', 'Clip binding is active');
    this.changing = true;
    const errors: unknown[] = [];
    try {
      attempt(errors, () => super.detach());
      if (!this.attached) {
        const entry = this.subscription;
        this.subscription = undefined;
        this.retire(entry, errors);
      }
    } finally {
      this.changing = false;
    }
    failures(errors, 'Clip detach failed');
  }
  override dispose(): void {
    assertOutsideRenderPaint();
    const errors: unknown[] = [];
    attempt(errors, () => super.dispose());
    if (this.debugDisposed) {
      this.cached = undefined;
      const entry = this.subscription;
      this.subscription = undefined;
      this.retire(entry, errors);
    }
    failures(errors, 'Clip teardown failed');
  }
  protected override performLayout(constraints: BoxConstraints): Size {
    const old = this.hasSize ? this.size : undefined,
      size = super.performLayout(constraints);
    if (!old || old.width !== size.width || old.height !== size.height) {
      this.cached = undefined;
      this.revision++;
    }
    return size;
  }
  describeApproximatePaintClip(_child: RenderObject): Rect | null {
    return this.clipping === 'none'
      ? null
      : withRenderPaint(() =>
          rectangle(
            this.current
              ? this.current.getApproximateClipRect(this.size)
              : { x: 0, y: 0, ...this.size },
          ),
        );
  }
  override paint(context: PaintingContext): void {
    if (!this.child) return;
    if (this.clipping === 'none') {
      super.paint(context);
      return;
    }
    const clip = this.updateClip();
    context.save();
    try {
      this.recordClip(context, clip, this.clipping !== 'hardEdge');
      if (this.clipping === 'antiAliasWithSaveLayer') {
        context.saveLayer(this.clipBounds(clip), new Paint());
        try {
          super.paint(context);
        } finally {
          context.restore();
        }
      } else super.paint(context);
    } finally {
      context.restore();
    }
  }
  override collectSemantics(
    output: SemanticsNode[],
    matrix: TransformMatrix = identity,
    clip?: Rect,
  ): void {
    const own = bounds(matrix, this.size);
    if (![own.x, own.y, own.width, own.height].every(Number.isFinite)) return;
    const approximate = this.child ? this.describeApproximatePaintClip(this.child) : null;
    let next = clip;
    if (approximate) {
      const projected = bounds(
        multiply(matrix, translate(approximate.x, approximate.y)),
        approximate,
      );
      if (![projected.x, projected.y, projected.width, projected.height].every(Number.isFinite))
        return;
      next = clip ? intersect(clip, projected) : projected;
    }
    const children: SemanticsNode[] = [];
    for (const child of this.children)
      child.collectSemantics(children, multiply(matrix, this.childTransform(child)), next);
    if (this.semantics) {
      const visible = clip ? intersect(clip, own) : own;
      if (visible.width > 0 && visible.height > 0)
        output.push({
          ...this.semantics,
          bounds: visible,
          ...(children.length &&
          this.semantics.role !== 'button' &&
          this.semantics.role !== 'text-field'
            ? { children }
            : {}),
        });
    } else output.push(...children);
  }
}
export class RenderClipRect extends RenderCustomClip<Rect> {
  protected defaultClip(): Rect {
    return { x: 0, y: 0, ...this.size };
  }
  protected captureClip(value: Rect): Rect {
    return rectangle(value);
  }
  protected clipBounds(value: Rect): Rect {
    return value;
  }
  protected recordClip(context: PaintingContext, value: Rect, antiAlias: boolean): void {
    context.clipRect(value, { doAntiAlias: antiAlias });
  }
  override hitTest(
    position: Offset,
    result: HitTestEntry[],
    toLocal: TransformMatrix = identity,
  ): boolean {
    if (this.clipper && !contains(this.updateClip(), position)) return false;
    return super.hitTest(position, result, toLocal);
  }
}
export interface RenderClipRRectOptions extends RenderClipOptions<RRect | RoundedClip> {
  readonly borderRadius?: number | BorderRadiusGeometry;
  readonly textDirection?: 'ltr' | 'rtl' | null;
}
function border(value: number | BorderRadiusGeometry): number | BorderRadiusGeometry {
  if (typeof value === 'number') return radius(value);
  invariant(
    value instanceof BorderRadiusGeometry,
    'invalid-clip-radius',
    'Expected BorderRadiusGeometry or a legacy uniform radius',
  );
  return value;
}
function textDirection(value: 'ltr' | 'rtl' | null): 'ltr' | 'rtl' | null {
  invariant(
    value === null || value === 'ltr' || value === 'rtl',
    'invalid-text-direction',
    'Expected null, ltr or rtl',
  );
  return value;
}
export class RenderClipRRect extends RenderCustomClip<RRect | RoundedClip, RRect> {
  private rounding: number | BorderRadiusGeometry;
  private direction: 'ltr' | 'rtl' | null;
  constructor(options: RenderClipRRectOptions = {}) {
    const {
        borderRadius = BorderRadius.zero,
        textDirection: inputDirection = null,
        child,
        ...base
      } = options,
      rounding = border(borderRadius),
      direction = textDirection(inputDirection);
    super(base);
    this.rounding = rounding;
    this.direction = direction;
    if (child) this.child = child;
  }
  get borderRadius(): number | BorderRadiusGeometry {
    return this.rounding;
  }
  set borderRadius(value: number | BorderRadiusGeometry) {
    this.assertCanMutateLayoutProperty();
    const next = border(value),
      same =
        typeof next === 'number'
          ? next === this.rounding
          : this.rounding instanceof BorderRadiusGeometry &&
            withRenderPaint(
              () => this.rounding instanceof BorderRadiusGeometry && this.rounding.equals(next),
            );
    if (!same) {
      this.rounding = next;
      this.markNeedsClip();
    }
  }
  get textDirection(): 'ltr' | 'rtl' | null {
    return this.direction;
  }
  set textDirection(value: 'ltr' | 'rtl' | null) {
    this.assertCanMutateLayoutProperty();
    const next = textDirection(value);
    if (next !== this.direction) {
      this.direction = next;
      this.markNeedsClip();
    }
  }
  protected defaultClip(): RRect {
    const rounding =
      typeof this.rounding === 'number' ? BorderRadius.circular(this.rounding) : this.rounding;
    return rounding
      .resolve(this.direction)
      .toRRect(LtrbRect.fromLTWH(0, 0, this.size.width, this.size.height));
  }
  protected captureClip(value: RRect | RoundedClip): RRect {
    if (value instanceof RRect) return copyRRect(value);
    invariant(
      value && Object.keys(value).every((key) => ['rect', 'radius'].includes(key)),
      'unsupported-rounded-clip',
      'Expected RRect or legacy uniform rounded geometry',
    );
    const rect = rectangle(value.rect),
      r = radius(value.radius);
    return copyRRect(RRect.fromRectXY(rect, r, r));
  }
  protected clipBounds(value: RRect): Rect {
    return value.outerRect;
  }
  protected recordClip(context: PaintingContext, value: RRect, antiAlias: boolean): void {
    context.clipRRect(value, { doAntiAlias: antiAlias });
  }
  override hitTest(
    position: Offset,
    result: HitTestEntry[],
    toLocal: TransformMatrix = identity,
  ): boolean {
    if (this.clipper && !this.updateClip().contains(position)) return false;
    return super.hitTest(position, result, toLocal);
  }
}
export class RenderClipOval extends RenderCustomClip<Rect> {
  private pathRect: Rect | undefined;
  private path: Path | undefined;
  protected defaultClip(): Rect {
    return { x: 0, y: 0, ...this.size };
  }
  protected captureClip(value: Rect): Rect {
    return rectangle(value);
  }
  protected clipBounds(value: Rect): Rect {
    return value;
  }
  private getClipPath(rect: Rect): Path {
    const old = this.pathRect;
    if (
      !old ||
      old.x !== rect.x ||
      old.y !== rect.y ||
      old.width !== rect.width ||
      old.height !== rect.height
    ) {
      const path = new Path();
      path.addOval(rect);
      this.pathRect = rect;
      this.path = path;
    }
    return this.path!;
  }
  protected recordClip(context: PaintingContext, value: Rect, antiAlias: boolean): void {
    context.clipPath(this.getClipPath(value), { doAntiAlias: antiAlias });
  }
  override hitTest(
    position: Offset,
    result: HitTestEntry[],
    toLocal: TransformMatrix = identity,
  ): boolean {
    const clip = this.updateClip(),
      x = (position.x - (clip.x + clip.width / 2)) / clip.width,
      y = (position.y - (clip.y + clip.height / 2)) / clip.height;
    if (x * x + y * y > 0.25) return false;
    return super.hitTest(position, result, toLocal);
  }
  override dispose(): void {
    try {
      super.dispose();
    } finally {
      if (this.debugDisposed) {
        this.path = undefined;
        this.pathRect = undefined;
      }
    }
  }
}
export interface RenderClipPathOptions extends RenderClipOptions<Path> {
  readonly paths?: import('../../ui/path.ts').PathQueryService;
}
export class RenderClipPath extends RenderCustomClip<Path> {
  private readonly queries: import('../../ui/path.ts').PathQueryService | undefined;
  constructor({ paths, ...options }: RenderClipPathOptions = {}) {
    super(options);
    this.queries = paths;
  }
  protected defaultClip(): Path {
    const path = new Path();
    path.addRect({ x: 0, y: 0, ...this.size });
    return path;
  }
  protected captureClip(value: Path): Path {
    return Path.from(value);
  }
  protected clipBounds(_value: Path): Rect {
    return this.clipper?.getApproximateClipRect(this.size) ?? { x: 0, y: 0, ...this.size };
  }
  protected recordClip(context: PaintingContext, value: Path, antiAlias: boolean): void {
    context.clipPath(value, { doAntiAlias: antiAlias });
  }
  override hitTest(
    position: Offset,
    result: HitTestEntry[],
    toLocal: TransformMatrix = identity,
  ): boolean {
    if (this.clipper) {
      invariant(
        this.queries,
        'missing-path-queries',
        'ClipPath hit testing requires the host engine path query service',
      );
      if (!this.updateClip().contains(position, this.queries)) return false;
    }
    return super.hitTest(position, result, toLocal);
  }
}

/** Mutable debug globals use an owner object in ESM. Ignored in release mode. */
export class RenderingDebug {
  static debugDisableShadows = false;
}
export interface RenderPhysicalModelOptions extends Omit<RenderClipOptions<RRect>, 'clipper'> {
  readonly shape?: BoxShape;
  readonly borderRadius?: BorderRadius | null;
  readonly elevation?: number;
  readonly color: number;
  readonly shadowColor?: number;
  readonly readDevicePixelRatio?: () => number;
}
interface RenderPhysicalBaseOptions<T> extends RenderClipOptions<T> {
  readonly elevation?: number;
  readonly color: number;
  readonly shadowColor?: number;
  readonly readDevicePixelRatio?: () => number;
}
function physicalColor(value: number): number {
  invariant(
    Number.isInteger(value) && value >= 0 && value <= 0xffffffff,
    'invalid-physical-color',
    'Physical color must be ARGB uint32',
  );
  return value;
}
function physicalElevation(value: number): number {
  invariant(
    Number.isFinite(value) && Number.isFinite(Math.fround(value)) && value >= 0,
    'invalid-elevation',
    'Physical elevation must be a nonnegative SkScalar',
  );
  return value;
}
function physicalShape(value: BoxShape): BoxShape {
  invariant(
    value === 'rectangle' || value === 'circle',
    'invalid-physical-shape',
    'Expected rectangle or circle',
  );
  return value;
}
/** Common physical value contract; retained clip ownership belongs to each shape. */
abstract class RenderPhysicalModelBase<T> extends RenderCustomClip<T> {
  private z: number;
  private background: number;
  private shadow: number;
  protected readonly density: () => number;
  constructor({
    elevation = 0,
    color,
    shadowColor = 0xff000000,
    readDevicePixelRatio = () => 1,
    ...options
  }: RenderPhysicalBaseOptions<T>) {
    super({ ...options, clipBehavior: options.clipBehavior ?? 'none' });
    this.z = physicalElevation(elevation);
    this.background = physicalColor(color);
    this.shadow = physicalColor(shadowColor);
    invariant(
      typeof readDevicePixelRatio === 'function',
      'invalid-physical-density',
      'Expected a device pixel ratio reader',
    );
    this.density = readDevicePixelRatio;
  }
  private physicalPaintChanged(): void {
    const prototype =
      this instanceof RenderPhysicalShape
        ? RenderPhysicalShape.prototype
        : RenderPhysicalModel.prototype;
    if (
      this.hasStaticLayoutSemantics(
        prototype,
        RenderProxyBox.prototype.describeSemanticsConfiguration,
      )
    )
      this.markNeedsPaintOnly();
    else this.markNeedsPaint();
  }
  get elevation(): number {
    return this.z;
  }
  set elevation(value: number) {
    this.assertCanMutateLayoutProperty();
    value = physicalElevation(value);
    if (value === this.z) return;
    this.z = value;
    this.physicalPaintChanged();
  }
  get color(): number {
    return this.background;
  }
  set color(value: number) {
    this.assertCanMutateLayoutProperty();
    value = physicalColor(value);
    if (value === this.background) return;
    this.background = value;
    this.physicalPaintChanged();
  }
  get shadowColor(): number {
    return this.shadow;
  }
  set shadowColor(value: number) {
    this.assertCanMutateLayoutProperty();
    value = physicalColor(value);
    if (value === this.shadow) return;
    this.shadow = value;
    this.physicalPaintChanged();
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty('elevation', this.elevation));
    properties.add(new DiagnosticsProperty('color', this.color));
    properties.add(new DiagnosticsProperty('shadowColor', this.color));
  }
}
/** Source physical paint order and clipping, backed by actual SkShadowUtils. */
export class RenderPhysicalModel extends RenderPhysicalModelBase<RRect> {
  private currentShape: BoxShape;
  private rounding: BorderRadius | null;
  private readonly clippingLayer = new LayerHandle<ClipRRectLayer>();
  constructor({
    shape = 'rectangle',
    borderRadius = null,
    ...options
  }: RenderPhysicalModelOptions) {
    super(options);
    this.currentShape = physicalShape(shape);
    this.rounding = borderRadius;
    invariant(
      borderRadius === null || borderRadius instanceof BorderRadius,
      'invalid-physical-radius',
      'Expected BorderRadius or null',
    );
  }
  get shape(): BoxShape {
    return this.currentShape;
  }
  set shape(value: BoxShape) {
    this.assertCanMutateLayoutProperty();
    value = physicalShape(value);
    if (value === this.currentShape) return;
    this.currentShape = value;
    this.markNeedsClip();
  }
  get borderRadius(): BorderRadius | null {
    return this.rounding;
  }
  set borderRadius(value: BorderRadius | null) {
    this.assertCanMutateLayoutProperty();
    invariant(
      value === null || value instanceof BorderRadius,
      'invalid-physical-radius',
      'Expected BorderRadius or null',
    );
    if (
      value === this.rounding ||
      (value !== null && this.rounding !== null && value.equals(this.rounding))
    )
      return;
    this.rounding = value;
    this.markNeedsClip();
  }
  get layer(): ClipRRectLayer | null {
    return this.clippingLayer.layer;
  }
  protected defaultClip(): RRect {
    const rect = LtrbRect.fromLTWH(0, 0, this.size.width, this.size.height);
    return this.shape === 'circle'
      ? RRect.fromRectXY(rect, rect.width / 2, rect.height / 2)
      : (this.borderRadius ?? BorderRadius.zero).toRRect(rect);
  }
  protected captureClip(value: RRect): RRect {
    return copyRRect(value);
  }
  protected clipBounds(value: RRect): Rect {
    return value.outerRect;
  }
  protected recordClip(context: PaintingContext, value: RRect, antiAlias: boolean): void {
    context.clipRRect(value, { doAntiAlias: antiAlias });
  }
  override hitTest(
    position: Offset,
    result: HitTestEntry[],
    toLocal: TransformMatrix = identity,
  ): boolean {
    if (this.clipper && !this.updateClip().contains(position)) return false;
    return super.hitTest(position, result, toLocal);
  }
  override paint(context: PaintingContext): void {
    const child = this.child;
    if (!child) {
      this.clippingLayer.layer = null;
      return;
    }
    const clip = this.updateClip(),
      paintShadows = !(FoundationBuildMode.debug && RenderingDebug.debugDisableShadows);
    if (this.elevation !== 0) {
      if (paintShadows) {
        const path = new Path();
        path.addRRect(clip);
        context.drawShadow(
          path,
          this.shadowColor,
          this.elevation,
          this.color >>> 24 !== 255,
          this.density(),
        );
      } else {
        const paint = new Paint();
        paint.color = this.shadowColor;
        paint.style = 'stroke';
        paint.strokeWidth = this.elevation * 2;
        context.drawRRect(clip, paint);
      }
    }
    const usesSaveLayer = this.clipBehavior === 'antiAliasWithSaveLayer',
      paint = new Paint();
    paint.color = this.color;
    if (!usesSaveLayer) context.drawRRect(clip, paint);
    const body = (inside: PaintingContext) => {
      if (usesSaveLayer) inside.drawPaint(paint);
      inside.paintChild(child, this.childTransform(child));
    };
    if (this.clipBehavior === 'none') {
      this.clippingLayer.layer = null;
      body(context);
      return;
    }
    const layer = this.clippingLayer.layer ?? new ClipRRectLayer();
    this.clippingLayer.layer = layer;
    layer.clipRRect = clip;
    layer.clipBehavior = this.clipBehavior;
    context.pushLayer(layer, body, { x: 0, y: 0 }, { x: 0, y: 0, ...this.size });
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty('shape', this.shape));
    properties.add(new DiagnosticsProperty('borderRadius', this.borderRadius));
  }
  override dispose(): void {
    const errors: unknown[] = [];
    attempt(errors, () => super.dispose());
    if (this.debugDisposed) attempt(errors, () => (this.clippingLayer.layer = null));
    failures(errors, 'Physical model teardown failed');
  }
}

export interface RenderPhysicalShapeOptions extends Omit<
  RenderPhysicalBaseOptions<Path>,
  'clipper'
> {
  readonly clipper: CustomClipper<Path>;
  readonly paths?: import('../../ui/path.ts').PathQueryService;
}
export class RenderPhysicalShape extends RenderPhysicalModelBase<Path> {
  private readonly queries: import('../../ui/path.ts').PathQueryService | undefined;
  private readonly clippingLayer = new LayerHandle<ClipPathLayer>();
  constructor({ paths, ...options }: RenderPhysicalShapeOptions) {
    invariant(
      options.clipper instanceof CustomClipper,
      'invalid-physical-clipper',
      'PhysicalShape requires a CustomClipper<Path>',
    );
    super(options);
    this.queries = paths;
  }
  get layer(): ClipPathLayer | null {
    return this.clippingLayer.layer;
  }
  protected defaultClip(): Path {
    const path = new Path();
    path.addRect({ x: 0, y: 0, ...this.size });
    return path;
  }
  protected captureClip(value: Path): Path {
    return Path.from(value);
  }
  protected clipBounds(_value: Path): Rect {
    return this.clipper?.getApproximateClipRect(this.size) ?? { x: 0, y: 0, ...this.size };
  }
  protected recordClip(context: PaintingContext, value: Path, antiAlias: boolean): void {
    context.clipPath(value, { doAntiAlias: antiAlias });
  }
  override hitTest(
    position: Offset,
    result: HitTestEntry[],
    toLocal: TransformMatrix = identity,
  ): boolean {
    if (this.clipper) {
      invariant(
        this.queries,
        'missing-path-queries',
        'PhysicalShape hit testing requires the host engine path query service',
      );
      if (!withRenderPaint(() => this.updateClip().contains(position, this.queries!))) return false;
    }
    return super.hitTest(position, result, toLocal);
  }
  override paint(context: PaintingContext): void {
    const child = this.child;
    if (!child) {
      this.clippingLayer.layer = null;
      return;
    }
    const clip = this.updateClip(),
      paintShadows = !(FoundationBuildMode.debug && RenderingDebug.debugDisableShadows);
    if (this.elevation !== 0) {
      if (paintShadows)
        context.drawShadow(
          clip,
          this.shadowColor,
          this.elevation,
          this.color >>> 24 !== 255,
          this.density(),
        );
      else {
        const paint = new Paint();
        paint.color = this.shadowColor;
        paint.style = 'stroke';
        paint.strokeWidth = this.elevation * 2;
        context.drawPath(clip, paint);
      }
    }
    const usesSaveLayer = this.clipBehavior === 'antiAliasWithSaveLayer',
      paint = new Paint();
    paint.color = this.color;
    if (!usesSaveLayer) context.drawPath(clip, paint);
    const body = (inside: PaintingContext) => {
      if (usesSaveLayer) inside.drawPaint(paint);
      inside.paintChild(child, this.childTransform(child));
    };
    if (this.clipBehavior === 'none') {
      this.clippingLayer.layer = null;
      body(context);
      return;
    }
    const layer = this.clippingLayer.layer ?? new ClipPathLayer();
    this.clippingLayer.layer = layer;
    layer.clipPath = clip;
    layer.clipBehavior = this.clipBehavior;
    context.pushLayer(layer, body, { x: 0, y: 0 }, { x: 0, y: 0, ...this.size });
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty('clipper', this.clipper));
  }
  override dispose(): void {
    const errors: unknown[] = [];
    attempt(errors, () => super.dispose());
    if (this.debugDisposed) attempt(errors, () => (this.clippingLayer.layer = null));
    failures(errors, 'Physical shape teardown failed');
  }
}
RenderProxyBox._registerGeometryLayoutSemantics(
  RenderPhysicalModel.prototype,
  RenderPhysicalShape.prototype,
);
