// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from Flutter rendering/error.dart at the recorded pin.
import { RenderBox } from './object.ts';
import type { BoxConstraints } from './constraints.ts';
import type { PaintingContext } from '../painting/context.ts';
import type { Offset } from '../../ui/geometry.ts';
import { EdgeInsets } from '../painting/edge-insets.ts';
import { FlutterError } from '../../foundation/flutter-error.ts';
import type { ResourceId, TextLayout, TextLayoutService } from '../../ui/types.ts';
import type { ResourceRegistry } from '../../hosting/resources.ts';
export interface ErrorBoxTextStyle {
  readonly color: number;
  readonly fontSize: number;
}
export interface ErrorBoxOptions {
  readonly text?: TextLayoutService;
  readonly resources?: ResourceRegistry;
  readonly font?: ResourceId;
  readonly scale?: number;
}
/** Emergency paragraph rendering uses the low-level text service, never TextPainter or widgets. */
export class RenderErrorBox extends RenderBox {
  static padding = EdgeInsets.fromLTRB(64, 96, 64, 12);
  static minimumWidth = 200;
  private static color: number | undefined;
  static get backgroundColor(): number {
    return this.color ?? (FlutterError.debugMode ? 0xf0900000 : 0xf0c0c0c0);
  }
  static set backgroundColor(value: number) {
    this.color = value;
  }
  private static style: ErrorBoxTextStyle | undefined;
  static get textStyle(): ErrorBoxTextStyle {
    return (
      this.style ??
      (FlutterError.debugMode
        ? { color: 0xffffff66, fontSize: 14 }
        : { color: 0xff303030, fontSize: 18 })
    );
  }
  static set textStyle(value: ErrorBoxTextStyle) {
    this.style = value;
  }
  static paragraphStyle: { readonly textDirection: 'ltr' | 'rtl'; readonly textAlign: 'left' } = {
    textDirection: 'ltr',
    textAlign: 'left',
  };
  private readonly capturedStyle: ErrorBoxTextStyle;
  private readonly capturedDirection: 'ltr' | 'rtl';
  private paragraph: TextLayout | undefined;
  private width: number | undefined;
  constructor(
    readonly message = '',
    private readonly options: ErrorBoxOptions = {},
  ) {
    super();
    this.capturedStyle = { ...RenderErrorBox.textStyle };
    this.capturedDirection = RenderErrorBox.paragraphStyle.textDirection;
  }
  override get sizedByParent(): boolean {
    return true;
  }
  protected override computeMaxIntrinsicWidth(_height: number): number {
    return 100000;
  }
  protected override computeMaxIntrinsicHeight(_width: number): number {
    return 100000;
  }
  protected override computeDryLayout(c: BoxConstraints) {
    return c.constrain({ width: 100000, height: 100000 });
  }
  protected override hitTestSelf(_position: Offset): boolean {
    return true;
  }
  override paint(context: PaintingContext): void {
    try {
      context.rect({ x: 0, y: 0, ...this.size }, RenderErrorBox.backgroundColor);
      const { text, resources, font } = this.options;
      if (!this.message || !text || !resources || !font) return;
      let width = this.size.width,
        left = 0,
        top = 0;
      const padding = RenderErrorBox.padding;
      if (width > padding.left + RenderErrorBox.minimumWidth + padding.right) {
        width -= padding.left + padding.right;
        left += padding.left;
      }
      if (this.width !== width || !this.paragraph || !resources.has(this.paragraph.resource)) {
        const next = text.layout({
          text: this.message,
          width,
          font,
          fontSize: this.capturedStyle.fontSize,
          color: this.capturedStyle.color,
          locale: 'en',
          direction: this.capturedDirection,
          scale: this.options.scale ?? 1,
        });
        const old = this.paragraph;
        this.paragraph = next;
        this.width = width;
        if (old && resources.has(old.resource)) resources.releaseProducer(old.resource);
      }
      if (this.size.height > padding.top + this.paragraph.height + padding.bottom)
        top += padding.top;
      context.paragraph(this.paragraph.resource, left, top);
    } catch {
      /* The original emergency surface deliberately suppresses secondary paint/text failures. */
    }
  }
  override dispose(): void {
    const paragraph = this.paragraph;
    try {
      super.dispose();
    } finally {
      if (this.debugDisposed) {
        this.paragraph = undefined;
        this.width = undefined;
        if (paragraph && this.options.resources?.has(paragraph.resource))
          this.options.resources.releaseProducer(paragraph.resource);
      }
    }
  }
}
