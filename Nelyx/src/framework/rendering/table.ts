// SPDX-License-Identifier: BSD-3-Clause
// Reviewed Flutter rendering/table.dart at the exact pin in upstream coverage.
import { invariant } from '../../foundation/errors.ts';
import { RenderBox, BoxParentData } from './object.ts';
import type { RenderObject, TextBaseline } from './object.ts';
import { BoxConstraints } from './constraints.ts';
import type { Size } from '../../ui/geometry.ts';
import type { Rect } from '../../ui/types.ts';
type Box = RenderBox<RenderObject>;
export type TableCellVerticalAlignment =
  | 'top'
  | 'middle'
  | 'bottom'
  | 'baseline'
  | 'fill'
  | 'intrinsicHeight';
const alignments: readonly TableCellVerticalAlignment[] = [
  'top',
  'middle',
  'bottom',
  'baseline',
  'fill',
  'intrinsicHeight',
];
function alignment(value: TableCellVerticalAlignment): void {
  invariant(alignments.includes(value), 'invalid-table-alignment', 'Unknown table cell alignment');
}
function dimension(value: number): void {
  invariant(
    Number.isFinite(value) && value >= 0,
    'invalid-column-width',
    'Column widths must be finite and nonnegative',
  );
}
function flexValue(value: number | null): void {
  invariant(
    value === null || (Number.isFinite(value) && value > 0),
    'invalid-column-flex',
    'Column flex must be finite and positive or null',
  );
}
function index(value: number): void {
  invariant(
    Number.isSafeInteger(value) && value >= 0,
    'invalid-table-index',
    'Table dimensions and indexes must be nonnegative safe integers',
  );
}
function capacity(columns: number, rows: number): void {
  index(columns);
  index(rows);
  invariant(
    columns * rows <= 0xffffffff,
    'invalid-table-size',
    'Table grid exceeds JavaScript array capacity',
  );
}
export class TableCellParentData extends BoxParentData {
  verticalAlignment: TableCellVerticalAlignment | null = null;
  x: number | null = null;
  y: number | null = null;
  override toString(): string {
    return `${super.toString()}; ${this.verticalAlignment ?? 'default vertical alignment'}`;
  }
}
export abstract class TableColumnWidth {
  abstract minIntrinsicWidth(cells: Iterable<Box>, containerWidth: number): number;
  abstract maxIntrinsicWidth(cells: Iterable<Box>, containerWidth: number): number;
  flex(_cells: Iterable<Box>): number | null {
    return null;
  }
  toString(): string {
    return this.constructor.name;
  }
}
export class IntrinsicColumnWidth extends TableColumnWidth {
  constructor(private readonly flexFactor: number | null = null) {
    super();
    flexValue(flexFactor);
  }
  minIntrinsicWidth(cells: Iterable<Box>, _containerWidth: number): number {
    let result = 0;
    for (const cell of cells) result = Math.max(result, cell.getMinIntrinsicWidth(Infinity));
    return result;
  }
  maxIntrinsicWidth(cells: Iterable<Box>, _containerWidth: number): number {
    let result = 0;
    for (const cell of cells) result = Math.max(result, cell.getMaxIntrinsicWidth(Infinity));
    return result;
  }
  override flex(_cells: Iterable<Box>): number | null {
    return this.flexFactor;
  }
  override toString(): string {
    return `${this.constructor.name}(flex: ${this.flexFactor?.toFixed(1) ?? 'null'})`;
  }
}
export class FixedColumnWidth extends TableColumnWidth {
  constructor(readonly value: number) {
    super();
    dimension(value);
  }
  minIntrinsicWidth(_cells: Iterable<Box>, _containerWidth: number): number {
    return this.value;
  }
  maxIntrinsicWidth(_cells: Iterable<Box>, _containerWidth: number): number {
    return this.value;
  }
  override toString(): string {
    return `${this.constructor.name}(${this.value.toFixed(1)})`;
  }
}
export class FractionColumnWidth extends TableColumnWidth {
  constructor(readonly value: number) {
    super();
    dimension(value);
  }
  minIntrinsicWidth(_cells: Iterable<Box>, containerWidth: number): number {
    return Number.isFinite(containerWidth) ? this.value * containerWidth : 0;
  }
  maxIntrinsicWidth(cells: Iterable<Box>, containerWidth: number): number {
    return this.minIntrinsicWidth(cells, containerWidth);
  }
  override toString(): string {
    return `${this.constructor.name}(${this.value})`;
  }
}
export class FlexColumnWidth extends TableColumnWidth {
  constructor(readonly value = 1) {
    super();
    flexValue(value);
  }
  minIntrinsicWidth(_cells: Iterable<Box>, _containerWidth: number): number {
    return 0;
  }
  maxIntrinsicWidth(_cells: Iterable<Box>, _containerWidth: number): number {
    return 0;
  }
  override flex(_cells: Iterable<Box>): number {
    return this.value;
  }
  override toString(): string {
    return `${this.constructor.name}(${this.value.toFixed(1)})`;
  }
}
abstract class CombinedColumnWidth extends TableColumnWidth {
  constructor(
    readonly a: TableColumnWidth,
    readonly b: TableColumnWidth,
  ) {
    super();
    invariant(
      a instanceof TableColumnWidth && b instanceof TableColumnWidth,
      'invalid-column-width',
      'Combined column widths require two algorithms',
    );
  }
  protected abstract combine(a: number, b: number): number;
  minIntrinsicWidth(cells: Iterable<Box>, containerWidth: number): number {
    const values = [...cells];
    return this.combine(
      this.a.minIntrinsicWidth(values, containerWidth),
      this.b.minIntrinsicWidth(values, containerWidth),
    );
  }
  maxIntrinsicWidth(cells: Iterable<Box>, containerWidth: number): number {
    const values = [...cells];
    return this.combine(
      this.a.maxIntrinsicWidth(values, containerWidth),
      this.b.maxIntrinsicWidth(values, containerWidth),
    );
  }
  override flex(cells: Iterable<Box>): number | null {
    const values = [...cells],
      a = this.a.flex(values),
      b = this.b.flex(values);
    return a === null ? b : b === null ? a : this.combine(a, b);
  }
  override toString(): string {
    return `${this.constructor.name}(${this.a}, ${this.b})`;
  }
}
export class MaxColumnWidth extends CombinedColumnWidth {
  protected combine(a: number, b: number): number {
    return Math.max(a, b);
  }
}
export class MinColumnWidth extends CombinedColumnWidth {
  protected combine(a: number, b: number): number {
    return Math.min(a, b);
  }
}
export interface RenderTableOptions {
  readonly columns?: number;
  readonly rows?: number;
  readonly children?: readonly (readonly (Box | null)[])[];
  readonly columnWidths?: ReadonlyMap<number, TableColumnWidth> | null;
  readonly defaultColumnWidth?: TableColumnWidth;
  readonly textDirection?: 'ltr' | 'rtl';
  readonly defaultVerticalAlignment?: TableCellVerticalAlignment;
  readonly textBaseline?: TextBaseline | null;
}
interface Geometry {
  readonly size: Size;
  readonly widths: readonly number[];
  readonly rowTops: readonly number[];
  readonly baseline: number | null;
}
export class RenderTable extends RenderBox {
  private columnCount = 0;
  private rowCount = 0;
  private grid: readonly (Box | null)[] = Object.freeze([]);
  private widths = new Map<number, TableColumnWidth>();
  private defaultWidth: TableColumnWidth = new FlexColumnWidth();
  private direction: 'ltr' | 'rtl' = 'ltr';
  private defaultAlignment: TableCellVerticalAlignment = 'top';
  private baselineType: TextBaseline | null = null;
  private geometry: Geometry | undefined;
  private changingGrid = false;
  constructor(options: RenderTableOptions = {}) {
    super();
    this.columnWidths = options.columnWidths ?? null;
    this.defaultColumnWidth = options.defaultColumnWidth ?? new FlexColumnWidth();
    this.textDirection = options.textDirection ?? 'ltr';
    this.defaultVerticalAlignment = options.defaultVerticalAlignment ?? 'top';
    this.textBaseline = options.textBaseline ?? null;
    invariant(
      options.children === undefined || options.rows === undefined,
      'invalid-table-size',
      'rows and children cannot both be specified',
    );
    const columns = options.columns ?? options.children?.[0]?.length ?? 0;
    capacity(columns, options.rows ?? options.children?.length ?? 0);
    if (options.children) {
      invariant(
        options.children.every((row) => row.length === columns),
        'irregular-table-rows',
        'Every table row must have the same number of cells',
      );
      this.commitGrid(columns, options.children.length, options.children.flat());
    } else
      this.commitGrid(
        columns,
        options.rows ?? 0,
        Array<Box | null>((options.rows ?? 0) * columns).fill(null),
      );
  }
  override setupParentData(child: RenderObject): void {
    invariant(
      child instanceof RenderBox,
      'invalid-table-child',
      'Table cells must be render boxes',
    );
    if (!(child.parentData instanceof TableCellParentData))
      child.parentData = new TableCellParentData();
  }
  private assertMutable(): void {
    this.assertCanMutateLayoutProperty();
    invariant(
      !this.changingGrid,
      'reentrant-table-update',
      'Cannot update a table during a grid transition',
    );
  }
  private commitGrid(columns: number, rows: number, cells: readonly (Box | null)[]): void {
    this.assertMutable();
    capacity(columns, rows);
    invariant(
      cells.length === columns * rows,
      'irregular-table-rows',
      'Cell count must equal rows times columns',
    );
    const next = Object.freeze([...cells]);
    invariant(
      next.every((cell) => cell === null || cell instanceof RenderBox),
      'invalid-table-child',
      'Table cells must be render boxes or null',
    );
    const desired = next.filter((cell): cell is Box => cell !== null);
    invariant(
      new Set(desired).size === desired.length,
      'duplicate-table-child',
      'A render box cannot occupy more than one cell',
    );
    if (
      columns === this.columnCount &&
      rows === this.rowCount &&
      next.every((cell, i) => cell === this.grid[i]) &&
      next.length === this.grid.length &&
      desired.length === this.children.length &&
      desired.every((cell, i) => cell === this.children[i])
    )
      return;
    const treeChanged =
        desired.length !== this.children.length ||
        desired.some((cell, i) => cell !== this.children[i]),
      errors: unknown[] = [];
    this.changingGrid = true;
    try {
      try {
        super.setChildren(desired);
      } catch (error) {
        errors.push(error);
      }
      if (
        desired.length === this.children.length &&
        desired.every((cell, i) => cell === this.children[i])
      ) {
        this.columnCount = columns;
        this.rowCount = rows;
        this.grid = next;
        this.geometry = undefined;
        if (!treeChanged)
          try {
            this.markNeedsLayout();
          } catch (error) {
            errors.push(error);
          }
      }
    } finally {
      this.changingGrid = false;
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length) throw new AggregateError(errors, 'Updating table cells failed');
  }
  get columns(): number {
    return this.columnCount;
  }
  set columns(value: number) {
    this.assertMutable();
    capacity(value, this.rows);
    if (value === this.columns) return;
    const cells = Array<Box | null>(value * this.rows).fill(null);
    for (let y = 0; y < this.rows; y++)
      for (let x = 0; x < Math.min(value, this.columns); x++)
        cells[x + y * value] = this.grid[x + y * this.columns]!;
    this.commitGrid(value, this.rows, cells);
  }
  get rows(): number {
    return this.rowCount;
  }
  set rows(value: number) {
    this.assertMutable();
    capacity(this.columns, value);
    if (value === this.rows) return;
    const cells = Array<Box | null>(this.columns * value).fill(null);
    for (let i = 0; i < Math.min(cells.length, this.grid.length); i++) cells[i] = this.grid[i]!;
    this.commitGrid(this.columns, value, cells);
  }
  get cells(): readonly (Box | null)[] {
    return this.grid;
  }
  get columnWidths(): ReadonlyMap<number, TableColumnWidth> {
    return new Map(this.widths);
  }
  set columnWidths(value: ReadonlyMap<number, TableColumnWidth> | null) {
    this.assertMutable();
    const next = new Map(value ?? []);
    for (const [column, width] of next) {
      index(column);
      invariant(
        width instanceof TableColumnWidth,
        'invalid-column-width',
        'Expected TableColumnWidth',
      );
    }
    if (
      next.size === this.widths.size &&
      [...next].every(([column, width]) => this.widths.get(column) === width)
    )
      return;
    this.widths = next;
    this.markNeedsLayout();
  }
  setColumnWidth(column: number, value: TableColumnWidth): void {
    index(column);
    const widths = new Map(this.widths);
    widths.set(column, value);
    this.columnWidths = widths;
  }
  get defaultColumnWidth(): TableColumnWidth {
    return this.defaultWidth;
  }
  set defaultColumnWidth(value: TableColumnWidth) {
    this.assertMutable();
    invariant(
      value instanceof TableColumnWidth,
      'invalid-column-width',
      'Expected TableColumnWidth',
    );
    if (value === this.defaultWidth) return;
    this.defaultWidth = value;
    this.markNeedsLayout();
  }
  get textDirection(): 'ltr' | 'rtl' {
    return this.direction;
  }
  set textDirection(value: 'ltr' | 'rtl') {
    this.assertMutable();
    invariant(
      value === 'ltr' || value === 'rtl',
      'invalid-text-direction',
      'Table needs ltr or rtl',
    );
    if (value === this.direction) return;
    this.direction = value;
    this.markNeedsLayout();
  }
  get defaultVerticalAlignment(): TableCellVerticalAlignment {
    return this.defaultAlignment;
  }
  set defaultVerticalAlignment(value: TableCellVerticalAlignment) {
    this.assertMutable();
    alignment(value);
    if (value === this.defaultAlignment) return;
    this.defaultAlignment = value;
    this.markNeedsLayout();
  }
  get textBaseline(): TextBaseline | null {
    return this.baselineType;
  }
  set textBaseline(value: TextBaseline | null) {
    this.assertMutable();
    invariant(
      value === null || value === 'alphabetic' || value === 'ideographic',
      'invalid-baseline',
      'Unknown table text baseline',
    );
    if (value === this.baselineType) return;
    this.baselineType = value;
    this.markNeedsLayout();
  }
  setFlatChildren(columns: number, cells: readonly (Box | null)[]): void {
    index(columns);
    invariant(
      columns > 0 || cells.length === 0,
      'invalid-table-size',
      'A zero-column table cannot have cells',
    );
    invariant(
      columns === 0 || cells.length % columns === 0,
      'irregular-table-rows',
      'Cell count must divide into complete rows',
    );
    this.commitGrid(columns, columns === 0 ? 0 : cells.length / columns, cells);
  }
  /** Dart setChildren(rows) uses this name because the base render tree owns flat setChildren. */
  setCellRows(rows: readonly (readonly (Box | null)[])[] | null): void {
    const columns = rows?.[0]?.length ?? 0;
    invariant(
      !rows || rows.every((row) => row.length === columns),
      'irregular-table-rows',
      'Every table row must have the same number of cells',
    );
    this.commitGrid(columns, rows?.length ?? 0, rows?.flat() ?? []);
  }
  addRow(cells: readonly (Box | null)[]): void {
    invariant(
      cells.length === this.columns,
      'irregular-table-rows',
      'New row must match table columns',
    );
    this.commitGrid(this.columns, this.rows + 1, [...this.grid, ...cells]);
  }
  setChild(x: number, y: number, child: Box | null): void {
    index(x);
    index(y);
    invariant(
      x < this.columns && y < this.rows,
      'invalid-table-index',
      'Table cell is outside the grid',
    );
    if (this.grid[x + y * this.columns] === child) return;
    const cells = [...this.grid];
    cells[x + y * this.columns] = child;
    this.commitGrid(this.columns, this.rows, cells);
  }
  /** Base tree edits preserve surviving cell slots; setFlatChildren finishes grid insertion/reordering. */
  override setChildren(children: readonly RenderObject[]): void {
    this.assertMutable();
    try {
      super.setChildren(children);
    } finally {
      const live = new Set(this.children);
      if (this.grid.some((cell) => cell !== null && !live.has(cell))) {
        this.grid = Object.freeze(
          this.grid.map((cell) => (cell !== null && !live.has(cell) ? null : cell)),
        );
        this.geometry = undefined;
      }
    }
  }
  override remove(child: RenderObject): void {
    try {
      super.remove(child);
    } finally {
      if (child.parent !== this && this.grid.includes(child as Box)) {
        this.grid = Object.freeze(this.grid.map((cell) => (cell === child ? null : cell)));
        this.geometry = undefined;
      }
    }
  }
  *column(x: number): IterableIterator<Box> {
    index(x);
    invariant(x < this.columns, 'invalid-table-index', 'Column is outside the grid');
    for (let y = 0; y < this.rows; y++) {
      const child = this.grid[x + y * this.columns];
      if (child) yield child;
    }
  }
  *row(y: number): IterableIterator<Box> {
    index(y);
    invariant(y < this.rows, 'invalid-table-index', 'Row is outside the grid');
    for (let x = 0; x < this.columns; x++) {
      const child = this.grid[x + y * this.columns];
      if (child) yield child;
    }
  }
  private algorithm(x: number): TableColumnWidth {
    return this.widths.get(x) ?? this.defaultWidth;
  }
  private computeColumnWidths(c: BoxConstraints): number[] {
    const widths: number[] = [],
      minimum: number[] = [],
      flexes: (number | null)[] = [];
    let table = 0,
      unflexed = 0,
      totalFlex = 0;
    for (let x = 0; x < this.columns; x++) {
      const algorithm = this.algorithm(x),
        cells = { [Symbol.iterator]: () => this.column(x) },
        max = algorithm.maxIntrinsicWidth(cells, c.maxWidth),
        min = algorithm.minIntrinsicWidth(cells, c.maxWidth),
        flex = algorithm.flex(cells);
      dimension(max);
      dimension(min);
      flexValue(flex);
      invariant(max >= min, 'invalid-column-width', 'Maximum column width is below its minimum');
      widths.push(max);
      minimum.push(min);
      flexes.push(flex);
      table += max;
      if (flex === null) unflexed += max;
      else totalFlex += flex;
    }
    invariant(
      Number.isFinite(table) && Number.isFinite(totalFlex),
      'invalid-table-size',
      'Column totals must be finite',
    );
    if (totalFlex > 0) {
      const target = c.hasBoundedWidth ? c.maxWidth : c.minWidth;
      if (table < target) {
        const remaining = target - unflexed;
        for (let x = 0; x < this.columns; x++)
          if (flexes[x] !== null) {
            const value = (remaining * flexes[x]!) / totalFlex;
            if (widths[x]! < value) {
              table += value - widths[x]!;
              widths[x] = value;
            }
          }
      }
    } else if (table < c.minWidth) {
      const delta = (c.minWidth - table) / this.columns;
      for (let x = 0; x < this.columns; x++) widths[x] = widths[x]! + delta;
      table = c.minWidth;
    }
    if (table > c.maxWidth) {
      let deficit = table - c.maxWidth,
        available = this.columns;
      while (deficit > 1e-10 && totalFlex > 1e-10) {
        let nextFlex = 0;
        for (let x = 0; x < this.columns; x++)
          if (flexes[x] !== null) {
            const value = widths[x]! - (deficit * flexes[x]!) / totalFlex;
            if (value <= minimum[x]!) {
              deficit -= widths[x]! - minimum[x]!;
              widths[x] = minimum[x]!;
              flexes[x] = null;
              available--;
            } else {
              deficit -= widths[x]! - value;
              widths[x] = value;
              nextFlex += flexes[x]!;
            }
          }
        totalFlex = nextFlex;
      }
      while (deficit > 1e-10 && available > 0) {
        const delta = deficit / available;
        let nextAvailable = 0;
        for (let x = 0; x < this.columns; x++) {
          const spare = widths[x]! - minimum[x]!;
          if (spare > 0) {
            if (spare <= delta) {
              deficit -= spare;
              widths[x] = minimum[x]!;
            } else {
              deficit -= delta;
              widths[x] = widths[x]! - delta;
              nextAvailable++;
            }
          }
        }
        available = nextAvailable;
      }
    }
    return widths;
  }
  protected override computeMinIntrinsicWidth(_height: number): number {
    if (!this.rows || !this.columns) return 0;
    let width = 0;
    for (let x = 0; x < this.columns; x++)
      width += this.algorithm(x).minIntrinsicWidth(
        { [Symbol.iterator]: () => this.column(x) },
        Infinity,
      );
    return width;
  }
  protected override computeMaxIntrinsicWidth(_height: number): number {
    if (!this.rows || !this.columns) return 0;
    let width = 0;
    for (let x = 0; x < this.columns; x++)
      width += this.algorithm(x).maxIntrinsicWidth(
        { [Symbol.iterator]: () => this.column(x) },
        Infinity,
      );
    return width;
  }
  protected override computeMinIntrinsicHeight(width: number): number {
    if (!this.rows || !this.columns) return 0;
    const widths = this.computeColumnWidths(BoxConstraints.tightForFinite(width));
    let height = 0;
    for (let y = 0; y < this.rows; y++) {
      let row = 0;
      for (let x = 0; x < this.columns; x++)
        row = Math.max(
          row,
          this.grid[x + y * this.columns]?.getMaxIntrinsicHeight(widths[x]!) ?? 0,
        );
      height += row;
    }
    return height;
  }
  protected override computeMaxIntrinsicHeight(width: number): number {
    return this.getMinIntrinsicHeight(width);
  }
  private layoutGeometry(c: BoxConstraints, dry: boolean): Geometry {
    const expected = this.grid.filter((cell): cell is Box => cell !== null);
    invariant(
      expected.length === this.children.length &&
        expected.every((cell, i) => cell === this.children[i]),
      'unsynchronized-table-cells',
      'Use setFlatChildren/setChild to finish table cell updates before layout',
    );
    if (!this.rows || !this.columns)
      return {
        size: c.constrain({ width: 0, height: 0 }),
        widths: [],
        rowTops: Array<number>(this.rows + 1).fill(0),
        baseline: null,
      };
    const widths = this.computeColumnWidths(c),
      positions: number[] = [],
      rowTops: number[] = [],
      sizes = new Map<Box, Size>(),
      baselines = new Map<Box, number | null>();
    let total = 0;
    for (const width of widths) total += width;
    let position = this.direction === 'ltr' ? 0 : total;
    for (let x = 0; x < this.columns; x++) {
      if (this.direction === 'rtl') position -= widths[x]!;
      positions.push(position);
      if (this.direction === 'ltr') position += widths[x]!;
    }
    let top = 0,
      firstBaseline: number | null = null;
    for (let y = 0; y < this.rows; y++) {
      rowTops.push(top);
      let height = 0,
        before = 0,
        after = 0,
        hasBaseline = false;
      for (let x = 0; x < this.columns; x++) {
        const child = this.grid[x + y * this.columns];
        if (!child) continue;
        const data = child.parentData;
        invariant(
          data instanceof TableCellParentData,
          'invalid-parent-data',
          'Table requires TableCellParentData',
        );
        const align = data.verticalAlignment ?? this.defaultAlignment;
        alignment(align);
        if (align === 'fill') continue;
        const inner = BoxConstraints.tightFor(widths[x]);
        let size: Size;
        if (dry) size = child.getDryLayout(inner);
        else {
          child.layout(inner, { parentUsesSize: true });
          size = child.size;
        }
        sizes.set(child, size);
        if (align === 'baseline') {
          invariant(
            this.textBaseline,
            'missing-table-baseline',
            'An explicit textBaseline is required for baseline alignment',
          );
          const baseline = dry
            ? child.getDryBaseline(inner, this.textBaseline)
            : child.getDistanceToActualBaseline(this.textBaseline);
          baselines.set(child, baseline);
          if (baseline !== null) {
            hasBaseline = true;
            before = Math.max(before, baseline);
            after = Math.max(after, size.height - baseline);
          } else height = Math.max(height, size.height);
        } else height = Math.max(height, size.height);
      }
      if (hasBaseline) {
        height = Math.max(height, before + after);
        if (y === 0) firstBaseline = before;
      }
      if (!dry)
        for (let x = 0; x < this.columns; x++) {
          const child = this.grid[x + y * this.columns];
          if (!child) continue;
          const data = child.parentData as TableCellParentData,
            align = data.verticalAlignment ?? this.defaultAlignment;
          data.x = x;
          data.y = y;
          let dy = 0;
          if (align === 'fill' || align === 'intrinsicHeight')
            child.layout(BoxConstraints.tightFor(widths[x], height));
          else if (align === 'middle') dy = (height - sizes.get(child)!.height) / 2;
          else if (align === 'bottom') dy = height - sizes.get(child)!.height;
          else if (align === 'baseline' && baselines.get(child) !== null)
            dy = before - baselines.get(child)!;
          child.layoutOffset = { x: positions[x]!, y: top + dy };
        }
      top += height;
    }
    rowTops.push(top);
    return {
      size: c.constrain({ width: total, height: top }),
      widths: Object.freeze(widths),
      rowTops: Object.freeze(rowTops),
      baseline: firstBaseline,
    };
  }
  protected override performLayout(c: BoxConstraints): Size {
    const geometry = this.layoutGeometry(c, false);
    this.geometry = geometry;
    return geometry.size;
  }
  protected override computeDryLayout(c: BoxConstraints): Size {
    return this.layoutGeometry(c, true).size;
  }
  protected override computeDryBaseline(c: BoxConstraints, _baseline: TextBaseline): number | null {
    if (!this.rows || !this.columns) return null;
    const widths = this.computeColumnWidths(c);
    let result: number | null = null;
    for (let x = 0; x < this.columns; x++) {
      const child = this.grid[x];
      if (!child) continue;
      const data = child.parentData;
      invariant(
        data instanceof TableCellParentData,
        'invalid-parent-data',
        'Table requires TableCellParentData',
      );
      if ((data.verticalAlignment ?? this.defaultAlignment) !== 'baseline') continue;
      invariant(
        this.textBaseline,
        'missing-table-baseline',
        'An explicit textBaseline is required for baseline alignment',
      );
      const baseline = child.getDryBaseline(BoxConstraints.tightFor(widths[x]), this.textBaseline);
      if (baseline !== null) result = result === null ? baseline : Math.max(result, baseline);
    }
    return result;
  }
  protected override computeDistanceToActualBaseline(_baseline: TextBaseline): number | null {
    return this.geometry?.baseline ?? null;
  }
  getRowBox(row: number): Rect {
    index(row);
    invariant(row < this.rows, 'invalid-table-index', 'Row is outside the grid');
    invariant(
      this.hasSize && !this.needsLayout && this.geometry,
      'stale-table-geometry',
      'Row geometry requires a current layout',
    );
    return Object.freeze({
      x: 0,
      y: this.geometry.rowTops[row]!,
      width: this.size.width,
      height: this.geometry.rowTops[row + 1]! - this.geometry.rowTops[row]!,
    });
  }
  override dispose(): void {
    try {
      super.dispose();
    } finally {
      if (this.debugDisposed) {
        this.grid = Object.freeze([]);
        this.columnCount = this.rowCount = 0;
        this.geometry = undefined;
        this.widths.clear();
      }
    }
  }
}
