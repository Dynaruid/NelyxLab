// SPDX-License-Identifier: BSD-3-Clause
import { Text } from '@nelyx/core/framework/widgets/basic';
import { StatefulWidget, State } from '@nelyx/core/framework/widgets/framework';
import { DataCell, DataColumn, DataRow, DataTable } from '@nelyx/material/data-table';
const entries = [
    { id: 0, name: 'Apple', count: 8 },
    { id: 1, name: 'Pear', count: 3 },
    { id: 2, name: 'Plum', count: 12 },
];
export class MaterialDataTableDemo extends StatefulWidget {
    record;
    constructor(record) {
        super();
        this.record = record;
    }
    createState() {
        return new DataTableDemoState();
    }
}
class DataTableDemoState extends State {
    sortColumn = null;
    ascending = true;
    selected = new Set([0]);
    build() {
        const sort = (column, ascending) => {
            this.setState(() => {
                this.sortColumn = column;
                this.ascending = ascending;
            });
            this.widget.record(`Data table: ${column === 0 ? 'Item' : 'Qty'} ${ascending ? 'ascending' : 'descending'}`);
        };
        const items = this.sortColumn === null
            ? entries
            : [...entries].sort((a, b) => (this.sortColumn === 0 ? a.name.localeCompare(b.name) : a.count - b.count) *
                (this.ascending ? 1 : -1));
        return new DataTable({
            sortColumnIndex: this.sortColumn,
            sortAscending: this.ascending,
            horizontalMargin: 8,
            columnSpacing: 12,
            columns: [
                new DataColumn({ label: new Text('Item'), onSort: sort }),
                new DataColumn({
                    label: new Text('Qty'),
                    numeric: true,
                    onSort: sort,
                    tooltip: 'Sort by quantity',
                }),
            ],
            rows: items.map(({ id, name, count }) => DataRow.byIndex({
                index: id,
                selected: this.selected.has(id),
                onSelectChanged: id === 2
                    ? null
                    : (selected) => {
                        this.setState(() => {
                            if (selected)
                                this.selected.add(id);
                            else
                                this.selected.delete(id);
                        });
                        this.widget.record(`Data table: ${name} ${selected ? 'selected' : 'unselected'}`);
                    },
                cells: [
                    new DataCell(new Text(name)),
                    new DataCell(new Text(String(count)), {
                        showEditIcon: true,
                        onTap: () => this.widget.record(`Data table: ${name} quantity ${count}`),
                    }),
                ],
            })),
        });
    }
}
