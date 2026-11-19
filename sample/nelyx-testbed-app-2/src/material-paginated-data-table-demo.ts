// SPDX-License-Identifier: BSD-3-Clause
import { Text } from '@nelyx/core/framework/widgets/basic';
import { StatefulWidget, State } from '@nelyx/core/framework/widgets/framework';
import { DataCell, DataColumn, DataRow } from '@nelyx/material/data-table';
import { DataTableSource } from '@nelyx/material/data-table-source';
import { PaginatedDataTable } from '@nelyx/material/paginated-data-table';

class InventorySource extends DataTableSource {
  private readonly entries = Array.from({ length: 13 }, (_, id) => ({
    id,
    name: `Item ${String(id + 1).padStart(2, '0')}`,
    quantity: (id * 7) % 17,
  }));
  private readonly selected = new Set<number>();
  constructor(private readonly record: (action: string) => void) {
    super();
  }
  get rowCount(): number {
    return this.entries.length;
  }
  get isRowCountApproximate(): boolean {
    return false;
  }
  get selectedRowCount(): number {
    return this.selected.size;
  }
  getRow(index: number): DataRow | null {
    const entry = this.entries[index];
    if (!entry) return null;
    const { id, name, quantity } = entry;
    return DataRow.byIndex({
      index: id,
      selected: this.selected.has(id),
      onSelectChanged: (selected) => {
        if (selected) this.selected.add(id);
        else this.selected.delete(id);
        this.notifyListeners();
        this.record(`Paginated table: ${name} ${selected ? 'selected' : 'unselected'}`);
      },
      cells: [new DataCell(new Text(name)), new DataCell(new Text(String(quantity)))],
    });
  }
  sort(column: number, ascending: boolean): void {
    this.entries.sort(
      (a, b) =>
        (column === 0 ? a.name.localeCompare(b.name) : a.quantity - b.quantity) *
        (ascending ? 1 : -1),
    );
    this.notifyListeners();
  }
}

export class MaterialPaginatedDataTableDemo extends StatefulWidget {
  constructor(readonly record: (message: string) => void) {
    super();
  }
  createState(): State<MaterialPaginatedDataTableDemo> {
    return new PaginatedDemoState();
  }
}

class PaginatedDemoState extends State<MaterialPaginatedDataTableDemo> {
  private readonly source = new InventorySource((message) => this.widget.record(message));
  private rowsPerPage = 3;
  private sortColumn: number | null = null;
  private ascending = true;
  override dispose(): void {
    this.source.dispose();
  }
  build(): PaginatedDataTable {
    const sort = (column: number, ascending: boolean) => {
      this.setState(() => {
        this.sortColumn = column;
        this.ascending = ascending;
      });
      this.source.sort(column, ascending);
      this.widget.record(
        `Paginated table: ${column === 0 ? 'Item' : 'Qty'} ${ascending ? 'ascending' : 'descending'}`,
      );
    };
    return new PaginatedDataTable({
      header: new Text('Inventory'),
      columns: [
        new DataColumn({ label: new Text('Item'), onSort: sort }),
        new DataColumn({ label: new Text('Qty'), numeric: true, onSort: sort }),
      ],
      source: this.source,
      sortColumnIndex: this.sortColumn,
      sortAscending: this.ascending,
      horizontalMargin: 8,
      columnSpacing: 16,
      showEmptyRows: false,
      showFirstLastButtons: true,
      rowsPerPage: this.rowsPerPage,
      availableRowsPerPage: [3, 5, 10],
      onPageChanged: (index) => this.widget.record(`Paginated table: first row index ${index}`),
      onRowsPerPageChanged: (size) => {
        if (size === null) return;
        this.setState(() => {
          this.rowsPerPage = size;
        });
        this.widget.record(`Paginated table: ${size} rows per page`);
      },
    });
  }
}
