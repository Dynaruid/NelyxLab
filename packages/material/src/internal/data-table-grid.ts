// SPDX-License-Identifier: BSD-3-Clause
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { Border } from '@nelyx/core/framework/painting/box-border';
import { BorderSide } from '@nelyx/core/framework/painting/borders';
import type { PaintingContext } from '@nelyx/core/framework/painting/context';
import { MatrixUtils } from '@nelyx/core/framework/painting/matrix-utils';
import { RenderTable, TableCellParentData } from '@nelyx/core/framework/rendering/table';
import type { TableColumnWidth } from '@nelyx/core/framework/rendering/table';
import type { RenderBox, RenderObject } from '@nelyx/core/framework/rendering/object';
import { SemanticsConfiguration, SemanticsNode } from '@nelyx/core/framework/semantics/semantics';
import type { BuildContext } from '@nelyx/core/framework/widgets/framework';
import { Table } from '@nelyx/core/framework/widgets/table';
import type { TableRow } from '@nelyx/core/framework/widgets/table';
import { Matrix4 } from '@nelyx/core/math/matrix4';
import type { Canvas } from '@nelyx/core/ui/canvas';
import type { Color } from '@nelyx/core/ui/color';
import { Offset } from '@nelyx/core/ui/offset';
import { Paint } from '@nelyx/core/ui/paint';
import { Rect } from '@nelyx/core/ui/rect';
import { SemanticsRole } from '@nelyx/core/ui/semantics';
import { InkResponse } from '../ink-well.ts';
import type { InkResponseOptions } from '../ink-well.ts';
import { Material } from '../material.ts';
import { InkFeature } from './material/material-ink-owner.ts';
import type { MaterialInkController } from './material/material-ink-owner.ts';

export interface TableBorderOptions {
  readonly top?: BorderSide;
  readonly right?: BorderSide;
  readonly bottom?: BorderSide;
  readonly left?: BorderSide;
  readonly horizontalInside?: BorderSide;
  readonly verticalInside?: BorderSide;
  readonly borderRadius?: BorderRadius;
}

export class TableBorder {
  readonly top: BorderSide;
  readonly right: BorderSide;
  readonly bottom: BorderSide;
  readonly left: BorderSide;
  readonly horizontalInside: BorderSide;
  readonly verticalInside: BorderSide;
  readonly borderRadius: BorderRadius;
  constructor(options: TableBorderOptions = {}) {
    this.top = options.top ?? BorderSide.none;
    this.right = options.right ?? BorderSide.none;
    this.bottom = options.bottom ?? BorderSide.none;
    this.left = options.left ?? BorderSide.none;
    this.horizontalInside = options.horizontalInside ?? BorderSide.none;
    this.verticalInside = options.verticalInside ?? BorderSide.none;
    this.borderRadius = options.borderRadius ?? BorderRadius.zero;
  }
}

export type TableRowInkWellOptions = Omit<
  InkResponseOptions,
  'containedInkWell' | 'highlightShape'
>;
export class TableRowInkWell extends InkResponse {
  constructor(options: TableRowInkWellOptions) {
    super({ ...options, containedInkWell: true, highlightShape: 'rectangle' });
  }
  override getRectCallback(reference: RenderBox): () => Rect {
    return () => {
      let child: RenderObject = reference;
      const transform = Matrix4.identity();
      while (child.parent) {
        const parent: RenderObject = child.parent;
        const edge = Matrix4.identity();
        parent.applyPaintTransform(child, edge);
        edge.multiply(transform);
        transform.setFrom(edge);
        if (parent instanceof RenderTable && child.parentData instanceof TableCellParentData) {
          const shift = MatrixUtils.getAsTranslation(transform),
            row = child.parentData.y;
          if (!shift || row === null || parent.needsLayout) break;
          const box = parent.getRowBox(row);
          return Rect.fromLTWH(box.x - shift.dx, box.y - shift.dy, box.width, box.height);
        }
        child = parent;
      }
      return Rect.zero;
    };
  }
}

interface RowAppearance {
  readonly colors: readonly (Color | null)[];
  readonly selected: readonly boolean[];
  readonly divider: BorderSide;
  readonly showBottomBorder: boolean;
  readonly border: TableBorder | null;
}

export class DataTableGrid extends Table {
  constructor(
    rows: readonly TableRow[],
    widths: ReadonlyMap<number, TableColumnWidth>,
    private readonly appearance: RowAppearance,
  ) {
    super(rows, { columnWidths: widths, defaultVerticalAlignment: 'middle' });
  }
  override createRenderObject(context: BuildContext): RenderTable {
    const render = new RenderDataTable(this.appearance, Material.of(context));
    super.updateRenderObject(context, render);
    return render;
  }
  override updateRenderObject(context: BuildContext, render: RenderObject): void {
    super.updateRenderObject(context, render);
    (render as RenderDataTable).updateAppearance(this.appearance);
  }
}

function line(
  canvas: Canvas,
  side: BorderSide,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void {
  if (side.style !== 'none')
    canvas.drawLine(
      new Offset(x1, y1),
      new Offset(x2, y2),
      new Paint({ color: side.color, strokeWidth: side.width }),
    );
}

class RowBackgrounds extends InkFeature {
  constructor(
    controller: MaterialInkController,
    private readonly table: RenderDataTable,
  ) {
    super({ controller, referenceBox: table });
    controller.addInkFeature(this);
  }
  protected paintFeature(canvas: Canvas, transform: Matrix4): void {
    if (!this.table.hasSize || this.table.needsLayout) return;
    canvas.save();
    try {
      canvas.transform(transform.storage);
      this.table.paintRows(canvas);
    } finally {
      canvas.restore();
    }
  }
}

class RenderDataTable extends RenderTable {
  private readonly backgrounds: RowBackgrounds;
  private rowNodes = new WeakMap<RenderObject, SemanticsNode>();
  constructor(
    private appearance: RowAppearance,
    controller: MaterialInkController,
  ) {
    super();
    this.backgrounds = new RowBackgrounds(controller, this);
  }
  updateAppearance(value: RowAppearance): void {
    const changedSelection =
      value.selected.length !== this.appearance.selected.length ||
      value.selected.some((selected, i) => selected !== this.appearance.selected[i]);
    this.appearance = value;
    this.backgrounds.controller.markNeedsPaint();
    this.markNeedsPaint();
    if (changedSelection) this.markNeedsSemanticsUpdate();
  }
  paintRows(canvas: Canvas): void {
    for (let row = 0; row < this.rows; row++) {
      const { x, y, width, height } = this.getRowBox(row);
      const color = this.appearance.colors[row];
      if (color) canvas.drawRect({ x, y, width, height }, new Paint({ color: color.toARGB32() }));
    }
  }
  override paint(context: PaintingContext): void {
    super.paint(context);
    const { divider, showBottomBorder, border } = this.appearance;
    const { canvas } = context,
      { width, height } = this.size;
    for (let i = 0; i < this.rows; i++) {
      const row = this.getRowBox(i);
      if (showBottomBorder || i > 0) {
        const y = showBottomBorder
          ? row.y + row.height - divider.width / 2
          : row.y + divider.width / 2;
        line(canvas, divider, 0, y, width, y);
      }
      if (border && i > 0) line(canvas, border.horizontalInside, 0, row.y, width, row.y);
    }
    if (!border) return;
    const edges = new Set(
      this.children.slice(0, this.columns).map((child) => child.layoutOffset.x),
    );
    for (const x of edges)
      if (x > 0 && x < width) line(canvas, border.verticalInside, x, 0, x, height);
    new Border(border).paint(canvas, Rect.fromLTWH(0, 0, width, height), {
      borderRadius: border.borderRadius,
    });
  }
  override describeSemanticsConfiguration(config: SemanticsConfiguration): void {
    super.describeSemanticsConfiguration(config);
    config.role = SemanticsRole.table;
    config.isSemanticBoundary = true;
    config.explicitChildNodes = true;
  }
  override assembleSemanticsNode(
    node: SemanticsNode,
    config: SemanticsConfiguration,
    children: SemanticsNode[],
  ): void {
    const rows = Array.from({ length: this.rows }, (_, i) => ({
      box: this.getRowBox(i),
      cells: [] as SemanticsNode[],
    }));
    for (const child of children) {
      // Every cell owns a boundary. Its origin identifies its row without relying on traversal order.
      const y = child.rect.top + (child.transform?.entry(1, 3) ?? 0);
      let low = 0,
        high = rows.length;
      while (low < high) {
        const mid = (low + high) >>> 1;
        if (rows[mid]!.box.y <= y) low = mid + 1;
        else high = mid;
      }
      rows[low - 1]?.cells.push(child);
    }
    const rowNodes: SemanticsNode[] = [];
    rows.forEach(({ box, cells }, i) => {
      const firstCell = this.children[i * this.columns];
      if (!firstCell || !box.height || !cells.length) return;
      let row = this.rowNodes.get(firstCell);
      if (!row) {
        row = new SemanticsNode({
          showOnScreen: () => {
            const index = (firstCell.parentData as TableCellParentData).y;
            if (firstCell.parent === this && index != null && !this.needsLayout)
              this.showOnScreen(this.getRowBox(index));
          },
        });
        this.rowNodes.set(firstCell, row);
      }
      const cfg = new SemanticsConfiguration();
      cfg.role = SemanticsRole.row;
      cfg.indexInParent = i;
      if (i > 0) cfg.isSelected = this.appearance.selected[i - 1] ?? false;
      // Row bounds and the children already share the table's coordinate system.
      row.rect = Rect.fromLTWH(box.x, box.y, box.width, box.height);
      row.updateWith({ config: cfg, childrenInInversePaintOrder: cells });
      rowNodes.push(row);
    });
    super.assembleSemanticsNode(node, config, rowNodes);
  }
  override clearSemantics(): void {
    super.clearSemantics();
    this.rowNodes = new WeakMap();
  }
  override dispose(): void {
    this.backgrounds.dispose();
    super.dispose();
  }
}
