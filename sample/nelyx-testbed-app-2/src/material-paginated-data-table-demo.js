// SPDX-License-Identifier: BSD-3-Clause
import { Text } from '@nelyx/core/framework/widgets/basic';
import { StatefulWidget, State } from '@nelyx/core/framework/widgets/framework';
import { DataCell, DataColumn, DataRow } from '@nelyx/material/data-table';
import { DataTableSource } from '@nelyx/material/data-table-source';
import { PaginatedDataTable } from '@nelyx/material/paginated-data-table';
class InventorySource extends DataTableSource {
    record;
    entries = Array.from({ length: 13 }, (_, id) => ({
        id,
        name: `Item ${String(id + 1).padStart(2, '0')}`,
        quantity: (id * 7) % 17,
    }));
    selected = new Set();
    constructor(record) {
        super();
        this.record = record;
    }
    get rowCount() {
        return this.entries.length;
    }
    get isRowCountApproximate() {
        return false;
    }
    get selectedRowCount() {
        return this.selected.size;
    }
    getRow(index) {
        const entry = this.entries[index];
        if (!entry)
            return null;
        const { id, name, quantity } = entry;
        return DataRow.byIndex({
            index: id,
            selected: this.selected.has(id),
            onSelectChanged: (selected) => {
                if (selected)
                    this.selected.add(id);
                else
                    this.selected.delete(id);
                this.notifyListeners();
                this.record(`Paginated table: ${name} ${selected ? 'selected' : 'unselected'}`);
            },
            cells: [new DataCell(new Text(name)), new DataCell(new Text(String(quantity)))],
        });
    }
    sort(column, ascending) {
        this.entries.sort((a, b) => (column === 0 ? a.name.localeCompare(b.name) : a.quantity - b.quantity) *
            (ascending ? 1 : -1));
        this.notifyListeners();
    }
}
export class MaterialPaginatedDataTableDemo extends StatefulWidget {
    record;
    constructor(record) {
        super();
        this.record = record;
    }
    createState() {
        return new PaginatedDemoState();
    }
}
class PaginatedDemoState extends State {
    source = new InventorySource((message) => this.widget.record(message));
    rowsPerPage = 3;
    sortColumn = null;
    ascending = true;
    dispose() {
        this.source.dispose();
    }
    build() {
        const sort = (column, ascending) => {
            this.setState(() => {
                this.sortColumn = column;
                this.ascending = ascending;
            });
            this.source.sort(column, ascending);
            this.widget.record(`Paginated table: ${column === 0 ? 'Item' : 'Qty'} ${ascending ? 'ascending' : 'descending'}`);
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
                if (size === null)
                    return;
                this.setState(() => {
                    this.rowsPerPage = size;
                });
                this.widget.record(`Paginated table: ${size} rows per page`);
            },
        });
    }
}
