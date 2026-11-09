// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Square finite dividers have no user subtree or state boundary. One owner
// computes their box geometry; the canonical decoration owner still paints.
import {
  LeafRenderObjectWidget,
  LeafRenderObjectElement,
} from '@nelyx/core/framework/widgets/framework';
import type { BuildContext } from '@nelyx/core/framework/widgets/framework';
import { Directionality, Localizations } from '@nelyx/core/framework/widgets/app-data';
import { RenderConstrainedBox, RenderDecoratedBox } from '@nelyx/core/framework/rendering/boxes';
import type { RenderObject, TextBaseline } from '@nelyx/core/framework/rendering/object';
import { registerNativeBoxConfiguration } from '@nelyx/core/framework/rendering/object';
import type { NativePaintScalar, NativePaintEntry } from '@nelyx/core/framework/rendering/object';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { ImageConfiguration } from '@nelyx/core/framework/painting/image-configuration';
import type { BoxDecoration } from '@nelyx/core/framework/painting/box-decoration';
import { Border } from '@nelyx/core/framework/painting/box-border';
import type { EdgeInsetsDirectional } from '@nelyx/core/framework/painting/edge-insets';
import type { Size } from '@nelyx/core/ui/geometry';

interface Configuration {
  readonly vertical: boolean;
  readonly extent: number;
  readonly thickness: number;
  readonly margin: EdgeInsetsDirectional;
  readonly decoration: BoxDecoration;
}
const extentConstraints = (c: Configuration) =>
  BoxConstraints.tightFor(c.vertical ? c.extent : undefined, c.vertical ? undefined : c.extent);
class DividerElement extends LeafRenderObjectElement {
  protected override synchronizeRenderObjectChildren(): void {}
}
export class DividerRenderWidget extends LeafRenderObjectWidget {
  constructor(readonly configuration: Configuration) {
    super();
    configuration.decoration.debugAssertIsValid();
  }
  override createElement(): LeafRenderObjectElement {
    return new DividerElement(this);
  }
  createRenderObject(): RenderDivider {
    return new RenderDivider(this.configuration);
  }
  updateRenderObject(context: BuildContext, render: RenderObject): void {
    // Center, margin and decoration originally read these ambient owners in
    // separate pure scopes. Keep their lookup order and distinct directions.
    void context.maybeDependOn(Directionality)?.direction;
    const direction = context.maybeDependOn(Directionality)?.direction ?? null;
    const painting = new ImageConfiguration({
      images: context.services.images ?? null,
      textDirection: context.maybeDependOn(Directionality)?.direction ?? null,
      devicePixelRatio: context.services.readMetrics('scale').scale,
      locale: context.maybeDependOn(Localizations)?.locale ?? null,
    });
    (render as RenderDivider).configure(this.configuration, direction, painting);
  }
}
class RenderDivider extends RenderConstrainedBox {
  static {
    registerNativeBoxConfiguration(RenderDivider.prototype, (render, reject) => {
      const config = render.configuration,
        padding = config.margin.resolve(render.direction);
      const border = config.decoration.border;
      if (!(border instanceof Border)) return reject('divider-border');
      const side = config.vertical ? border.left : border.bottom;
      const variable = (
        op: 'width' | 'height' | 'boundedWidth' | 'boundedHeight',
      ): NativePaintScalar => ({ op });
      const expression = (
        op: 'min' | 'max' | 'add' | 'subtract' | 'multiply' | 'divide' | 'select',
        ...args: NativePaintScalar[]
      ): NativePaintScalar => ({ op, args });
      const width = variable('width'),
        height = variable('height'),
        lineWidth = config.vertical
          ? expression('min', config.thickness, width)
          : expression(
              'select',
              variable('boundedWidth'),
              expression('max', 0, expression('subtract', width, padding.horizontal)),
              0,
            ),
        lineHeight = config.vertical
          ? expression(
              'select',
              variable('boundedHeight'),
              expression('max', 0, expression('subtract', height, padding.vertical)),
              0,
            )
          : expression('min', config.thickness, height),
        rect = [
          config.vertical
            ? expression('divide', expression('subtract', width, lineWidth), 2)
            : expression(
                'add',
                padding.left,
                expression(
                  'divide',
                  expression(
                    'subtract',
                    width,
                    expression('select', variable('boundedWidth'), width, padding.horizontal),
                  ),
                  2,
                ),
              ),
          config.vertical
            ? expression(
                'add',
                padding.top,
                expression(
                  'divide',
                  expression(
                    'subtract',
                    height,
                    expression('select', variable('boundedHeight'), height, padding.vertical),
                  ),
                  2,
                ),
              )
            : expression('divide', expression('subtract', height, lineHeight), 2),
          lineWidth,
          lineHeight,
        ] as const,
        shape = {
          kind: 'rrect' as const,
          radii: Array<number>(8).fill(0),
          strokeWidth: 0,
          strokeColor: 0,
          strokeAlign: 0,
        };
      // Preserve Source paintBorder, including zero-width hairlines and a
      // border wider than the constrained line box. Content resolves geometry.
      const path: NativePaintEntry['path'] = {
        commands: config.vertical
          ? config.thickness === 0
            ? [
                ['move', 0, 0],
                ['line', 0, lineHeight],
              ]
            : [
                ['move', 0, 0],
                ['line', 0, lineHeight],
                ['line', config.thickness, lineHeight],
                ['line', config.thickness, 0],
                ['close'],
              ]
          : config.thickness === 0
            ? [
                ['move', 0, lineHeight],
                ['line', lineWidth, lineHeight],
              ]
            : [
                ['move', 0, lineHeight],
                ['line', lineWidth, lineHeight],
                ['line', lineWidth, expression('subtract', lineHeight, config.thickness)],
                ['line', 0, expression('subtract', lineHeight, config.thickness)],
                ['close'],
              ],
      };
      return {
        kind: 'box',
        children: [],
        hitTest: 'self',
        layout: { alignment: { x: 0, y: 0 }, alignmentSizing: true, enforceBounds: true },
        constraints: config.vertical
          ? new BoxConstraints(config.extent, config.extent, padding.vertical, Infinity)
          : new BoxConstraints(padding.horizontal, Infinity, config.extent, config.extent),
        paint: [
          { kind: 'hitRegion', color: 0, shape, geometry: { kind: 'program', rect } },
          {
            kind: 'path',
            color: config.thickness === 0 || side.style === 'none' ? 0 : side.color,
            shape: {
              ...shape,
              strokeColor: config.thickness === 0 && side.style !== 'none' ? side.color : 0,
            },
            geometry: { kind: 'program', rect },
            path,
          },
        ],
      };
    });
  }
  private readonly line: RenderDecoratedBox;
  private direction: 'ltr' | 'rtl' | null = null;
  constructor(private configuration: Configuration) {
    const line = new RenderDecoratedBox(configuration.decoration);
    super(extentConstraints(configuration), line);
    this.line = line;
  }
  configure(
    value: Configuration,
    direction: 'ltr' | 'rtl' | null,
    painting: ImageConfiguration,
  ): void {
    const old = this.configuration;
    this.assertCanMutateLayoutProperty();
    this.additionalConstraints = extentConstraints(value);
    this.line.decoration = value.decoration;
    this.line.configuration = painting;
    if (
      value.vertical !== old.vertical ||
      value.thickness !== old.thickness ||
      !value.margin.equals(old.margin) ||
      direction !== this.direction
    )
      this.markNeedsLayout();
    this.configuration = value;
    this.direction = direction;
  }
  private geometry(constraints: BoxConstraints): { size: Size; line: Size; x: number; y: number } {
    const c = this.configuration,
      box = this.additionalConstraints.enforce(constraints),
      padding = c.margin.resolve(this.direction);
    box.debugAssertIsValid({ isAppliedConstraint: true });
    const width = box.constrainWidth(box.hasBoundedWidth ? box.maxWidth : padding.horizontal),
      height = box.constrainHeight(box.hasBoundedHeight ? box.maxHeight : padding.vertical);
    // LimitedBox makes the expanding empty Container zero in an unbounded
    // cross axis. Center may still grow to the incoming minimum afterwards.
    if (!c.vertical) {
      const lineWidth = box.hasBoundedWidth ? Math.max(0, box.maxWidth - padding.horizontal) : 0,
        lineHeight = Math.min(c.thickness, height),
        marginWidth = box.hasBoundedWidth ? box.maxWidth : padding.horizontal;
      return {
        size: { width, height },
        line: { width: lineWidth, height: lineHeight },
        x: (width - marginWidth) / 2 + padding.left,
        y: (height - lineHeight) / 2,
      };
    }
    const lineWidth = Math.min(c.thickness, width),
      lineHeight = box.hasBoundedHeight ? Math.max(0, box.maxHeight - padding.vertical) : 0,
      marginHeight = box.hasBoundedHeight ? box.maxHeight : padding.vertical;
    return {
      size: { width, height },
      line: { width: lineWidth, height: lineHeight },
      x: (width - lineWidth) / 2,
      y: (height - marginHeight) / 2 + padding.top,
    };
  }
  protected override computeMinIntrinsicWidth(_height: number): number {
    return this.configuration.vertical
      ? this.configuration.extent
      : this.configuration.margin.resolve(this.direction).horizontal;
  }
  protected override computeMaxIntrinsicWidth(height: number): number {
    return this.computeMinIntrinsicWidth(height);
  }
  protected override computeMinIntrinsicHeight(_width: number): number {
    return this.configuration.vertical
      ? this.configuration.margin.resolve(this.direction).vertical
      : this.configuration.extent;
  }
  protected override computeMaxIntrinsicHeight(width: number): number {
    return this.computeMinIntrinsicHeight(width);
  }
  protected override computeDryLayout(constraints: BoxConstraints): Size {
    return this.geometry(constraints).size;
  }
  protected override computeDryBaseline(
    constraints: BoxConstraints,
    _baseline: TextBaseline,
  ): number | null {
    this.geometry(constraints);
    return null;
  }
  protected override performLayout(constraints: BoxConstraints): Size {
    const geometry = this.geometry(constraints);
    this.line.layout(BoxConstraints.tight(geometry.line), { parentUsesSize: true });
    this.line.layoutOffset = { x: geometry.x, y: geometry.y };
    return geometry.size;
  }
  override dispose(): void {
    if (this.debugDisposed) return;
    const errors: unknown[] = [];
    try {
      super.dispose();
    } catch (error) {
      errors.push(error);
    }
    if (this.debugDisposed)
      try {
        this.line.dispose();
      } catch (error) {
        errors.push(error);
      }
    if (errors.length === 1) throw errors[0];
    if (errors.length) throw new AggregateError(errors, 'Divider decoration retirement failed');
  }
}
RenderConstrainedBox._registerGeometryLayoutSemantics(RenderDivider.prototype);
