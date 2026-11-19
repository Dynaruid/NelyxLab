// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/dropdown_menu.dart
// Revision: 71e4717a61786faab4c7aa39825989305ed29e8a
import type { PaintingContext } from '@nelyx/core/framework/painting/context';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { RenderBox } from '@nelyx/core/framework/rendering/object';
import type { HitTestEntry, RenderObject } from '@nelyx/core/framework/rendering/object';
import { MultiChildRenderObjectWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import type { Offset, Size, TransformMatrix } from '@nelyx/core/ui/geometry';
import { RenderInputDecoration } from './input/input-decorator-layout.ts';

export const minimumDropdownWidth = 112;

export class DropdownMenuBody extends MultiChildRenderObjectWidget {
  constructor(
    field: Widget,
    readonly probes: readonly Widget[] | null,
    readonly width: number | null,
  ) {
    super(probes ? [field, ...probes] : [field]);
  }

  override createRenderObject(): RenderDropdownMenuBody {
    return new RenderDropdownMenuBody(this.width, this.probes !== null);
  }
  override updateRenderObject(_context: BuildContext, render: RenderObject): void {
    if (render instanceof RenderDropdownMenuBody)
      render.configure(this.width, this.probes !== null);
  }
}

class RenderDropdownMenuBody extends RenderBox {
  private lastItemWidth = 0;
  constructor(
    private width: number | null,
    private measuringItems: boolean,
  ) {
    super();
  }

  configure(width: number | null, measuringItems: boolean): void {
    if (this.width === width && this.measuringItems === measuringItems) return;
    this.width = width;
    this.measuringItems = measuringItems;
    this.markNeedsLayout();
  }

  private get field(): RenderBox<RenderObject> | null {
    const child = this.children[0];
    return child instanceof RenderBox ? child : null;
  }

  private measureItems(height: number): number {
    let width = 0;
    for (const child of this.children.slice(1)) {
      width = Math.max(width, child.getMaxIntrinsicWidth(height));
    }
    return width;
  }

  private preferredWidth(height: number, itemWidth?: number): number {
    if (this.width !== null) return this.width;
    const item =
      itemWidth ?? (this.measuringItems ? this.measureItems(height) : this.lastItemWidth);
    const field = this.field;
    const widths = field ? findInputDecoration(field)?.dropdownWidths(height) : undefined;
    return Math.max(
      minimumDropdownWidth,
      Math.max(item, widths?.label ?? 0) + (widths?.accessories ?? 0),
    );
  }

  private fieldConstraints(constraints: BoxConstraints, itemWidth?: number): BoxConstraints {
    return constraints.tighten(
      constraints.constrainWidth(this.preferredWidth(constraints.maxHeight, itemWidth)),
    );
  }

  protected override performLayout(constraints: BoxConstraints): Size {
    if (this.measuringItems) {
      this.lastItemWidth = this.measureItems(constraints.maxHeight);
    }
    const inner = this.fieldConstraints(constraints, this.lastItemWidth);
    const field = this.field;
    field?.layout(inner, { parentUsesSize: true });
    this.children.slice(1).forEach((probe) => {
      if (probe instanceof RenderBox) probe.layout(inner.loosen(), { parentUsesSize: true });
    });
    return field?.size ?? inner.smallest;
  }
  protected override computeDryLayout(constraints: BoxConstraints): Size {
    const inner = this.fieldConstraints(constraints);
    return this.field?.getDryLayout(inner) ?? inner.smallest;
  }
  protected override computeMinIntrinsicWidth(height: number): number {
    return this.preferredWidth(height);
  }
  protected override computeMaxIntrinsicWidth(height: number): number {
    return this.preferredWidth(height);
  }
  protected override computeMinIntrinsicHeight(width: number): number {
    return this.field?.getMinIntrinsicHeight(width) ?? 0;
  }
  protected override computeMaxIntrinsicHeight(width: number): number {
    return this.field?.getMaxIntrinsicHeight(width) ?? 0;
  }
  override paintsChild(child: RenderObject): boolean {
    return this.field === child;
  }
  override paint(context: PaintingContext): void {
    if (this.field) this.paintChild(context, this.field);
  }
  override hitTest(position: Offset, result: HitTestEntry[], transform?: TransformMatrix): boolean {
    return this.field?.hitTest(position, result, transform) ?? false;
  }
  override visitChildrenForSemantics(visitor: (child: RenderObject) => void): void {
    if (this.field) visitor(this.field);
  }
}

function findInputDecoration(render: RenderObject): RenderInputDecoration | null {
  if (render instanceof RenderInputDecoration) return render;
  for (const child of render.children) {
    const decoration = findInputDecoration(child);
    if (decoration) return decoration;
  }
  return null;
}
