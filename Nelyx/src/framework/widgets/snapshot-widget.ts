// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Source recipes on the canonical Core layer/image/rasterization owners.
import { ChangeNotifier } from '../../foundation/notifier.ts';
import { invariant } from '../../foundation/errors.ts';
import { FlutterError } from '../../foundation/flutter-error.ts';
import type { Key } from '../../foundation/key.ts';
import { RenderObjectWidget } from './framework.ts';
import type { Widget, BuildContext } from './framework.ts';
import { MediaQuery } from './app-data.ts';
import { RenderProxyBox } from '../rendering/boxes.ts';
import type { RenderObject, RenderBox, PipelineOwner } from '../rendering/object.ts';
import { OffsetLayer } from '../rendering/layer.ts';
import { PaintingContext } from '../painting/context.ts';
import { Size } from '../../ui/size.ts';
import { Offset } from '../../ui/offset.ts';
import { Paint } from '../../ui/paint.ts';
import type { Image } from '../../ui/image.ts';
import type { PictureRasterizer } from '../../ui/picture.ts';

export const SnapshotMode = Object.freeze({
  permissive: 'permissive',
  normal: 'normal',
  forced: 'forced',
} as const);
export type SnapshotMode = (typeof SnapshotMode)[keyof typeof SnapshotMode];
export class SnapshotController extends ChangeNotifier {
  private allowed: boolean;
  constructor({ allowSnapshotting = false }: { readonly allowSnapshotting?: boolean } = {}) {
    super();
    this.allowed = allowSnapshotting;
  }
  clear(): void {
    this.notifyListeners();
  }
  get allowSnapshotting(): boolean {
    return this.allowed;
  }
  set allowSnapshotting(value: boolean) {
    if (value === this.allowed) return;
    this.allowed = value;
    this.notifyListeners();
  }
}
export type SnapshotChildPainter = (context: PaintingContext, offset: Offset) => void;
export abstract class SnapshotPainter extends ChangeNotifier {
  // The source const default implements this interface without allocating a notifier.
  constructor() {
    super();
    if (new.target !== DefaultSnapshotPainter) ChangeNotifier.maybeDispatchObjectCreation(this);
  }
  /** @dartParam pixelRatio double */
  abstract paintSnapshot(
    context: PaintingContext,
    offset: Offset,
    size: Size,
    image: Image,
    sourceSize: Size,
    pixelRatio: number,
  ): void;
  abstract paint(
    context: PaintingContext,
    offset: Offset,
    size: Size,
    painter: SnapshotChildPainter,
  ): void;
  abstract shouldRepaint(oldPainter: SnapshotPainter): boolean;
}
class DefaultSnapshotPainter extends SnapshotPainter {
  override addListener(_listener: () => void): void {}
  override removeListener(_listener: () => void): void {}
  override dispose(): void {}
  override get hasListeners(): boolean {
    return false;
  }
  override notifyListeners(): void {}
  paint(
    context: PaintingContext,
    offset: Offset,
    _size: Size,
    painter: SnapshotChildPainter,
  ): void {
    painter(context, offset);
  }
  /** @dartParam pixelRatio double */
  paintSnapshot(
    context: PaintingContext,
    offset: Offset,
    size: Size,
    image: Image,
    sourceSize: Size,
    pixelRatio: number,
  ): void {
    void pixelRatio;
    const paint = new Paint();
    paint.filterQuality = 'medium';
    context.canvas.drawImageRect(
      image,
      { x: 0, y: 0, width: sourceSize.width, height: sourceSize.height },
      { x: offset.dx, y: offset.dy, width: size.width, height: size.height },
      paint,
    );
  }
  shouldRepaint(_oldPainter: SnapshotPainter): boolean {
    return false;
  }
}
const defaultPainter = new DefaultSnapshotPainter();
export interface SnapshotWidgetOptions {
  readonly key?: Key | null;
  readonly mode?: SnapshotMode;
  readonly painter?: SnapshotPainter;
  readonly autoresize?: boolean;
  readonly controller: SnapshotController;
  readonly child: Widget | null;
}
export class SnapshotWidget extends RenderObjectWidget {
  readonly mode: SnapshotMode;
  readonly painter: SnapshotPainter;
  readonly autoresize: boolean;
  readonly controller: SnapshotController;
  readonly child: Widget | null;
  constructor({
    key = null,
    mode = SnapshotMode.normal,
    painter = defaultPainter,
    autoresize = false,
    controller,
    child,
  }: SnapshotWidgetOptions) {
    super(key);
    this.mode = mode;
    this.painter = painter;
    this.autoresize = autoresize;
    this.controller = controller;
    this.child = child;
  }
  get childWidgets(): readonly Widget[] {
    return this.child === null ? [] : [this.child];
  }
  createRenderObject(context: BuildContext): RenderBox {
    return new RenderSnapshotWidget({
      devicePixelRatio: MediaQuery.of(context).scale,
      controller: this.controller,
      mode: this.mode,
      painter: this.painter,
      autoresize: this.autoresize,
      rasterizer: context.services.rasterizer ?? null,
    });
  }
  updateRenderObject(context: BuildContext, object: RenderObject): void {
    const render = object as RenderSnapshotWidget;
    render.controller = this.controller;
    render.mode = this.mode;
    render.devicePixelRatio = MediaQuery.of(context).scale;
    render.painter = this.painter;
    render.autoresize = this.autoresize;
    render.rasterizer = context.services.rasterizer ?? null;
  }
}
class RenderSnapshotWidget extends RenderProxyBox {
  /** @dartType double */
  private density: number;
  private controllerValue: SnapshotController;
  private painterValue: SnapshotPainter;
  private modeValue: SnapshotMode;
  private autoresizeValue: boolean;
  private rasterizerValue: PictureRasterizer | null;
  private childRaster: Image | null = null;
  private childRasterSize: Size | null = null;
  private disableSnapshotAttempt = false;
  private lastCachedSize: Size | null = null;
  private readonly paintChanged = () => this.markNeedsPaint();
  private readonly rasterValueChanged = () => {
    this.disableSnapshotAttempt = false;
    this.clearRaster();
    this.markNeedsPaint();
  };
  private readonly paintChildren: SnapshotChildPainter = (context, offset) => {
    context.save();
    try {
      context.translate(offset.dx, offset.dy);
      super.paint(context);
    } finally {
      context.restore();
    }
  };
  /** @dartParam devicePixelRatio double */
  constructor({
    devicePixelRatio,
    controller,
    mode,
    painter,
    autoresize,
    rasterizer,
  }: {
    readonly devicePixelRatio: number;
    readonly controller: SnapshotController;
    readonly mode: SnapshotMode;
    readonly painter: SnapshotPainter;
    readonly autoresize: boolean;
    readonly rasterizer: PictureRasterizer | null;
  }) {
    super();
    this.density = devicePixelRatio;
    this.controllerValue = controller;
    this.modeValue = mode;
    this.painterValue = painter;
    this.autoresizeValue = autoresize;
    this.rasterizerValue = rasterizer;
  }
  /** @dartReturn double */
  get devicePixelRatio(): number {
    return this.density;
  }
  /** @dartParam value double */
  set devicePixelRatio(value: number) {
    if (value === this.density) return;
    this.density = value;
    if (this.childRaster !== null) {
      this.clearRaster();
      this.markNeedsPaint();
    }
  }
  get painter(): SnapshotPainter {
    return this.painterValue;
  }
  set painter(value: SnapshotPainter) {
    if (value === this.painterValue) return;
    const old = this.painterValue;
    old.removeListener(this.paintChanged);
    this.painterValue = value;
    if (old.constructor !== value.constructor || value.shouldRepaint(old)) this.markNeedsPaint();
    if (this.attached) value.addListener(this.paintChanged);
  }
  get controller(): SnapshotController {
    return this.controllerValue;
  }
  set controller(value: SnapshotController) {
    if (value === this.controllerValue) return;
    this.controllerValue.removeListener(this.rasterValueChanged);
    const oldValue = this.controllerValue.allowSnapshotting;
    this.controllerValue = value;
    if (this.attached) {
      value.addListener(this.rasterValueChanged);
      if (oldValue !== value.allowSnapshotting) this.rasterValueChanged();
    }
  }
  get mode(): SnapshotMode {
    return this.modeValue;
  }
  set mode(value: SnapshotMode) {
    if (value === this.modeValue) return;
    this.modeValue = value;
    this.markNeedsPaint();
  }
  get autoresize(): boolean {
    return this.autoresizeValue;
  }
  set autoresize(value: boolean) {
    if (value === this.autoresizeValue) return;
    this.autoresizeValue = value;
    this.markNeedsPaint();
  }
  // View-local provider injection is own host metadata, not a source numeric claim.
  get rasterizer(): PictureRasterizer | null {
    return this.rasterizerValue;
  }
  set rasterizer(value: PictureRasterizer | null) {
    if (value === this.rasterizerValue) return;
    this.rasterizerValue = value;
    this.clearRaster();
    this.markNeedsPaint();
  }
  private clearRaster(): void {
    const image = this.childRaster;
    this.childRaster = null;
    this.childRasterSize = null;
    image?.dispose();
  }
  override attach(owner: PipelineOwner): void {
    const attached = this.attached;
    super.attach(owner);
    if (attached) return;
    try {
      this.controller.addListener(this.rasterValueChanged);
      this.painter.addListener(this.paintChanged);
    } catch (error) {
      this.controller.removeListener(this.rasterValueChanged);
      this.painter.removeListener(this.paintChanged);
      if (!this.parent) super.detach();
      throw error;
    }
  }
  override detach(): void {
    try {
      super.detach();
    } finally {
      if (!this.attached) {
        this.disableSnapshotAttempt = false;
        this.controller.removeListener(this.rasterValueChanged);
        this.painter.removeListener(this.paintChanged);
        this.clearRaster();
      }
    }
  }
  override dispose(): void {
    try {
      super.dispose();
    } finally {
      if (this.debugDisposed) {
        this.controller.removeListener(this.rasterValueChanged);
        this.painter.removeListener(this.paintChanged);
        this.clearRaster();
      }
    }
  }
  private paintAndDetachToImage(context: PaintingContext): Image | null {
    const layer = new OffsetLayer();
    try {
      const child = context._recordChildLayer((recording) => super.paint(recording), {
        x: 0,
        y: 0,
        ...this.size,
      });
      try {
        layer.append(child);
      } catch (error) {
        child.dispose();
        throw error;
      }
      if (this.mode !== SnapshotMode.forced && !layer.supportsRasterization()) {
        if (this.mode === SnapshotMode.normal)
          throw new FlutterError('SnapshotWidget used with a child that contains a PlatformView.');
        this.disableSnapshotAttempt = true;
        return null;
      }
      invariant(
        this.rasterizerValue,
        'missing-snapshot-rasterizer',
        'SnapshotWidget capture requires its owning View rasterization service',
      );
      const image = layer.toImageSync(
        { x: 0, y: 0, ...this.size },
        { pixelRatio: this.devicePixelRatio, rasterizer: this.rasterizerValue },
      );
      this.lastCachedSize = new Size(this.size.width, this.size.height);
      return image;
    } finally {
      layer.dispose();
    }
  }
  override paint(context: PaintingContext): void {
    const size = new Size(this.size.width, this.size.height);
    if (size.isEmpty) {
      this.clearRaster();
      return;
    }
    if (!this.controller.allowSnapshotting || this.disableSnapshotAttempt) {
      this.clearRaster();
      this.painter.paint(context, Offset.zero, size, this.paintChildren);
      return;
    }
    if (this.autoresize && this.lastCachedSize !== null && !size.equals(this.lastCachedSize))
      this.clearRaster();
    if (this.childRaster === null) {
      this.childRaster = this.paintAndDetachToImage(context);
      this.childRasterSize = new Size(
        size.width * this.devicePixelRatio,
        size.height * this.devicePixelRatio,
      );
    }
    if (this.childRaster === null)
      this.painter.paint(context, Offset.zero, size, this.paintChildren);
    else
      this.painter.paintSnapshot(
        context,
        Offset.zero,
        size,
        this.childRaster,
        this.childRasterSize!,
        this.devicePixelRatio,
      );
  }
}
