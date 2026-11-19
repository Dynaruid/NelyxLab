// SPDX-License-Identifier: BSD-3-Clause
// Behavior reference: Flutter material/paginated_data_table.dart at 71e4717a61786faab4c7aa39825989305ed29e8a.
import { ValueKey } from '@nelyx/core/foundation/key';
import { BoxDecoration } from '@nelyx/core/framework/painting/box-decoration';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { Column, Padding, SizedBox, Text } from '@nelyx/core/framework/widgets/basic';
import { State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import { Icon } from '@nelyx/core/framework/widgets/icon';
import { PageStorage } from '@nelyx/core/framework/widgets/page-storage';
import { Wrap } from '@nelyx/core/framework/widgets/wrap';
import type { Color } from '@nelyx/core/ui/color';
import { Card } from './card.ts';
import { DataCell, DataRow, DataTable } from './data-table.ts';
import type { DataTableOptions } from './data-table.ts';
import type { DataTableSource } from './data-table-source.ts';
import { IconButton } from './icon-button.ts';
import { Icons } from './icons.ts';
import { CircularProgressIndicator } from './progress-indicator.ts';
import { TextButton } from './text-button.ts';

export interface PaginatedDataTableOptions extends Pick<
  DataTableOptions,
  | 'key'
  | 'columns'
  | 'sortColumnIndex'
  | 'sortAscending'
  | 'onSelectAll'
  | 'dataRowHeight'
  | 'dataRowMinHeight'
  | 'dataRowMaxHeight'
  | 'headingRowHeight'
  | 'headingRowColor'
  | 'horizontalMargin'
  | 'columnSpacing'
  | 'showCheckboxColumn'
  | 'dividerThickness'
  | 'checkboxHorizontalMargin'
> {
  readonly header?: Widget | null;
  readonly actions?: readonly Widget[] | null;
  readonly source: DataTableSource;
  readonly showFirstLastButtons?: boolean;
  readonly initialFirstRowIndex?: number | null;
  readonly onPageChanged?: ((firstRowIndex: number) => void) | null;
  readonly rowsPerPage?: number;
  readonly availableRowsPerPage?: readonly number[];
  readonly onRowsPerPageChanged?: ((rowsPerPage: number | null) => void) | null;
  readonly arrowHeadColor?: Color | null;
  readonly showEmptyRows?: boolean;
}

function validIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export class PaginatedDataTable extends StatefulWidget {
  static readonly defaultRowsPerPage = 10;
  readonly options: Readonly<PaginatedDataTableOptions>;
  readonly source: DataTableSource;
  readonly rowsPerPage: number;
  readonly availableRowsPerPage: readonly number[];
  constructor(options: PaginatedDataTableOptions) {
    super(options.key ?? null);
    this.source = options.source;
    this.rowsPerPage = options.rowsPerPage ?? PaginatedDataTable.defaultRowsPerPage;
    this.availableRowsPerPage = Object.freeze([
      ...(options.availableRowsPerPage ?? [10, 20, 50, 100]),
    ]);
    if (
      !validIndex(this.rowsPerPage) ||
      this.rowsPerPage === 0 ||
      this.availableRowsPerPage.some((size) => !validIndex(size) || size === 0) ||
      new Set(this.availableRowsPerPage).size !== this.availableRowsPerPage.length ||
      (options.onRowsPerPageChanged && !this.availableRowsPerPage.includes(this.rowsPerPage))
    )
      throw new RangeError('Invalid PaginatedDataTable page sizes');
    if (!validIndex(options.initialFirstRowIndex ?? 0))
      throw new RangeError('Invalid PaginatedDataTable initialFirstRowIndex');
    this.options = Object.freeze({
      ...options,
      columns: Object.freeze([...options.columns]),
      ...(options.actions ? { actions: Object.freeze([...options.actions]) } : {}),
      rowsPerPage: this.rowsPerPage,
      availableRowsPerPage: this.availableRowsPerPage,
    });
  }
  createState(): PaginatedDataTableState {
    return new PaginatedDataTableState();
  }
}

class PlaceholderKey extends ValueKey<number> {}

export class PaginatedDataTableState extends State<PaginatedDataTable> {
  private first = 0;
  private count = 0;
  private approximate = false;
  private selectedCount = 0;
  private showPageSizes = false;
  private readonly rows = new Map<number, DataRow | null>();
  private readonly sourceChanged = () => this.setState(() => this.refreshSource());

  get firstRowIndex(): number {
    return this.first;
  }
  override initState(): void {
    const restored = PageStorage.maybeOf(this.context)?.readState(this.context);
    this.first = validIndex(restored) ? restored : (this.widget.options.initialFirstRowIndex ?? 0);
    this.refreshSource();
    this.widget.source.addListener(this.sourceChanged);
  }
  override didUpdateWidget(old: PaginatedDataTable): void {
    if (old.source !== this.widget.source) {
      old.source.removeListener(this.sourceChanged);
      this.refreshSource();
      this.widget.source.addListener(this.sourceChanged);
    }
    if (old.rowsPerPage !== this.widget.rowsPerPage) {
      this.showPageSizes = false;
      this.clampPage();
    }
    if (!this.widget.options.onRowsPerPageChanged) this.showPageSizes = false;
  }
  override dispose(): void {
    this.widget.source.removeListener(this.sourceChanged);
    this.rows.clear();
  }
  private get lastPage(): number {
    const size = this.widget.rowsPerPage;
    return Math.floor(Math.max(0, this.count - 1) / size) * size;
  }
  private clampPage(): void {
    if (!this.approximate && this.first >= this.count) this.first = this.lastPage;
  }
  private refreshSource(): void {
    const source = this.widget.source;
    this.count = source.rowCount;
    this.approximate = source.isRowCountApproximate;
    this.selectedCount = source.selectedRowCount;
    this.rows.clear();
    this.clampPage();
  }
  /** Navigate to the page containing the requested zero-based row. */
  pageTo(rowIndex: number): void {
    if (!validIndex(rowIndex)) throw new RangeError('Invalid PaginatedDataTable row index');
    const size = this.widget.rowsPerPage;
    const aligned = Math.floor(rowIndex / size) * size;
    const next = this.approximate ? aligned : Math.min(aligned, this.lastPage);
    if (next === this.first) return;
    this.setState(() => {
      this.first = next;
    });
    PageStorage.maybeOf(this.context)?.writeState(this.context, next);
    this.widget.options.onPageChanged?.(next);
  }
  private getRows(): DataRow[] {
    const { columns, showEmptyRows = true } = this.widget.options;
    const rows: DataRow[] = [];
    let showedProgress = false;
    for (let offset = 0; offset < this.widget.rowsPerPage; offset++) {
      const index = this.first + offset;
      let row: DataRow | null = null;
      let loading = false;
      if (this.approximate || index < this.count) {
        if (!this.rows.has(index)) this.rows.set(index, this.widget.source.getRow(index));
        row = this.rows.get(index) ?? null;
        if (row === null && !showedProgress) loading = showedProgress = true;
      }
      if (row !== null) rows.push(row);
      else if (loading || showEmptyRows) {
        const progressColumn = loading
          ? Math.max(
              0,
              columns.findIndex((column) => !column.numeric),
            )
          : -1;
        rows.push(
          new DataRow({
            key: new PlaceholderKey(index),
            cells: columns.map((_, at) =>
              at === progressColumn
                ? new DataCell(
                    new SizedBox(
                      20,
                      20,
                      new CircularProgressIndicator({ semanticsLabel: 'Loading rows' }),
                    ),
                  )
                : DataCell.empty,
            ),
          }),
        );
      }
    }
    return rows;
  }
  build(_context: BuildContext): Widget {
    const { options, rowsPerPage, availableRowsPerPage } = this.widget;
    const children: Widget[] = [];
    if (options.header || options.actions?.length) {
      children.push(
        new Padding(
          EdgeInsets.symmetric({ horizontal: 16, vertical: 8 }),
          new Wrap(
            [
              ...(options.header
                ? [
                    this.selectedCount > 0
                      ? new Text(`${this.selectedCount} selected`)
                      : options.header,
                  ]
                : []),
              ...(options.actions ?? []),
            ],
            { spacing: 12, crossAxisAlignment: 'center' },
          ),
        ),
      );
    }
    children.push(
      new DataTable({
        ...options,
        key: null,
        headingRowHeight: options.headingRowHeight ?? 56,
        horizontalMargin: options.horizontalMargin ?? 24,
        columnSpacing: options.columnSpacing ?? 56,
        decoration: new BoxDecoration(),
        showBottomBorder: true,
        rows: this.getRows(),
      }),
    );

    const end = this.first + rowsPerPage;
    const canNext = Number.isSafeInteger(end) && (this.approximate || end < this.count);
    const rangeStart = !this.approximate && this.count === 0 ? 0 : this.first + 1;
    const rangeEnd = this.approximate ? end : Math.min(end, this.count);
    const footer: Widget[] = [];
    if (options.onRowsPerPageChanged)
      footer.push(
        new TextButton({
          child: new Text(`Rows per page: ${rowsPerPage}`),
          onPressed: () =>
            this.setState(() => {
              this.showPageSizes = !this.showPageSizes;
            }),
        }),
      );
    footer.push(
      new Text(`${rangeStart}–${rangeEnd} of ${this.approximate ? 'about ' : ''}${this.count}`),
    );
    const button = (
      label: string,
      icon: ConstructorParameters<typeof Icon>[0],
      onPressed: (() => void) | null,
    ) =>
      new IconButton({
        tooltip: label,
        icon: new Icon(icon),
        onPressed,
        color: options.arrowHeadColor ?? null,
      });
    const canBack = this.first > 0;
    if (options.showFirstLastButtons)
      footer.push(button('First page', Icons.skip_previous, canBack ? () => this.pageTo(0) : null));
    footer.push(
      button(
        'Previous page',
        Icons.chevron_left,
        canBack ? () => this.pageTo(Math.max(0, this.first - rowsPerPage)) : null,
      ),
      button('Next page', Icons.chevron_right, canNext ? () => this.pageTo(end) : null),
    );
    if (options.showFirstLastButtons)
      footer.push(
        button(
          'Last page',
          Icons.skip_next,
          canNext && this.lastPage > this.first ? () => this.pageTo(this.lastPage) : null,
        ),
      );
    children.push(
      new Padding(
        EdgeInsets.symmetric({ horizontal: 8, vertical: 4 }),
        new Wrap(footer, {
          alignment: 'end',
          spacing: 4,
          crossAxisAlignment: 'center',
        }),
      ),
    );
    if (this.showPageSizes && options.onRowsPerPageChanged) {
      const choices = availableRowsPerPage.filter(
        (size) => size <= this.count || size === rowsPerPage,
      );
      children.push(
        new Wrap(
          choices.map(
            (size) =>
              new TextButton({
                child: new Text(`${size} rows per page`),
                onPressed: () => {
                  this.setState(() => {
                    this.showPageSizes = false;
                  });
                  if (size !== rowsPerPage) this.widget.options.onRowsPerPageChanged?.(size);
                },
              }),
          ),
          { alignment: 'end' },
        ),
      );
    }
    return new Card({
      semanticContainer: false,
      child: new Column(children, { crossAlign: 'stretch' }),
    });
  }
}
