// SPDX-License-Identifier: BSD-3-Clause
// Behavior reference: Flutter material/data_table_source.dart at 71e4717a61786faab4c7aa39825989305ed29e8a.
import { ChangeNotifier } from '@nelyx/core/foundation/notifier';
import type { DataRow } from './data-table.ts';

/** A caller-owned, long-lived source. Notify listeners whenever rows or counts change. */
export abstract class DataTableSource extends ChangeNotifier {
  /** Read a position in the current sort order. Use stable row keys for the underlying records. */
  abstract getRow(index: number): DataRow | null;
  abstract get rowCount(): number;
  abstract get isRowCountApproximate(): boolean;
  /** The total selection count, including rows outside the current page. */
  abstract get selectedRowCount(): number;
}
