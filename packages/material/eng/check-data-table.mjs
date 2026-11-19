// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { setTimeout as wait } from 'node:timers/promises';
import { execute } from '../../../Nelyx/sdk/tooling/cli/src/commands.mjs';
import { FlutterError } from '@nelyx/core/foundation/flutter-error';
import { ValueNotifier } from '@nelyx/core/foundation/notifier';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { ResourceRegistry } from '@nelyx/core/hosting/resources';
import { FrameDiagnostics, releaseSceneFrameSource } from '@nelyx/core/ui/frame';
import { freezeTextInput } from '@nelyx/core/ui/text';
import { CheckedState, Tristate } from '@nelyx/core/ui/semantics';
import { flattenSemantics } from '@nelyx/core/framework/semantics/semantics';
import { FrameworkRoot } from '@nelyx/core/framework/widgets/root';
import { Align, SizedBox, Text } from '@nelyx/core/framework/widgets/basic';
import { ListenableBuilder } from '@nelyx/core/framework/widgets/listenable-builder';
import { FixedColumnWidth, RenderTable } from '@nelyx/core/framework/rendering/table';
import { MaterialApp } from '@nelyx/material/app';
import { Checkbox } from '@nelyx/material/checkbox';
import { DataCell, DataColumn, DataRow, DataTable } from '@nelyx/material/data-table';
import {
  PageStorage,
  PageStorageBucket,
  PageStorageKey,
} from '@nelyx/core/framework/widgets/page-storage';
import { DataTableSource } from '@nelyx/material/data-table-source';
import { PaginatedDataTable, PaginatedDataTableState } from '@nelyx/material/paginated-data-table';
import { IconButton } from '@nelyx/material/icon-button';
import { CircularProgressIndicator } from '@nelyx/material/progress-indicator';
import {
  DataTable as BarrelTable,
  DataTableSource as BarrelSource,
  PaginatedDataTable as BarrelPaginatedTable,
} from '@nelyx/material/widgets';
import { DataTableTheme, DataTableThemeData } from '@nelyx/material/data-table-theme';
import { ThemeData } from '@nelyx/material/theme-data';

if (!process.argv.includes('--child')) {
  await execute(process.execPath, [import.meta.filename, '--child'], { timeout: 1_200_000 });
  process.exit(0);
}
FoundationPlatform.configure({ kind: 'native', operatingSystem: 'windows' });
FlutterError.onError = ({ exception }) => {
  throw exception;
};
assert.equal(BarrelTable, DataTable);
const state = new ValueNotifier(0),
  selected = new Set([1]),
  calls = [];
let sortColumn = null,
  ascending = true,
  showCheckboxColumn = true,
  customSelectAll = false;
const update = () => {
  state.value++;
};
function table() {
  const onSort = (index, direction) => {
    calls.push(['sort', index, direction]);
    sortColumn = index;
    ascending = direction;
    update();
  };
  const columns = [
    new DataColumn({ label: new Text('Name'), onSort }),
    new DataColumn({
      label: new Text('Qty'),
      numeric: true,
      onSort,
      columnWidth: new FixedColumnWidth(100),
    }),
  ];
  const order = sortColumn === null ? [1, 2, 3] : ascending ? [2, 1, 3] : [3, 1, 2];
  return new DataTable({
    columns,
    sortColumnIndex: sortColumn,
    sortAscending: ascending,
    showCheckboxColumn,
    horizontalMargin: 8,
    columnSpacing: 16,
    dataRowMaxHeight: Infinity,
    onSelectAll: customSelectAll ? (value) => calls.push(['all', value]) : null,
    rows: order.map((id) =>
      DataRow.byIndex({
        index: id,
        selected: selected.has(id),
        onSelectChanged:
          id === 3
            ? null
            : (value) => {
                calls.push(['row', id, value]);
                if (value) selected.add(id);
                else selected.delete(id);
                update();
              },
        onLongPress: () => calls.push(['row-long', id]),
        onHover: (hovered) => calls.push(['hover', id, hovered]),
        cells: [
          new DataCell(
            id === 3 ? new SizedBox(25, 65, new Text('Three')) : new Text(id === 1 ? 'One' : 'Two'),
          ),
          new DataCell(
            new Text(`quantity ${id}`),
            id === 1
              ? {
                  showEditIcon: true,
                  onTap: () => calls.push(['tap', id]),
                  onDoubleTap: () => calls.push(['double', id]),
                  onLongPress: () => calls.push(['long', id]),
                  onTapDown: () => calls.push(['down', id]),
                  onTapCancel: () => calls.push(['cancel', id]),
                }
              : {},
          ),
        ],
      }),
    ),
  });
}
class TestSource extends DataTableSource {
  reads = [];
  selected = new Set();
  missing = new Set();
  approximate = false;
  constructor(count, prefix) {
    super();
    this.total = count;
    this.prefix = prefix;
  }
  get rowCount() {
    return this.total;
  }
  get isRowCountApproximate() {
    return this.approximate;
  }
  get selectedRowCount() {
    return this.selected.size;
  }
  getRow(index) {
    this.reads.push(index);
    if (!this.approximate) assert(index < this.total);
    if (this.missing.has(index)) return null;
    return DataRow.byIndex({
      index,
      selected: this.selected.has(index),
      onSelectChanged: (value) => {
        calls.push(['select-paged', index, value]);
        if (value) this.selected.add(index);
        else this.selected.delete(index);
        this.notifyListeners();
      },
      cells: [new DataCell(new Text(`${this.prefix} ${index}`))],
    });
  }
}
const primary = new TestSource(8, 'Record');
const replacement = new TestSource(2, 'Replacement');
const storage = new PageStorageBucket();
let pagedSource = primary;
let pageSize = 3;
let mode = 'plain';
let emptyRows = true;
let pagination;
class ObservedTable extends PaginatedDataTable {
  createState() {
    pagination = super.createState();
    return pagination;
  }
}
function buildTable() {
  if (mode === 'plain') return table();
  if (mode === 'hidden') return new SizedBox(0, 0);
  return new ObservedTable({
    key: new PageStorageKey('pagination'),
    columns: [new DataColumn({ label: new Text('Record'), numeric: true })],
    header: new Text('Records'),
    source: pagedSource,
    initialFirstRowIndex: 3,
    horizontalMargin: 8,
    showFirstLastButtons: true,
    showEmptyRows: emptyRows,
    rowsPerPage: pageSize,
    availableRowsPerPage: [2, 3, 10],
    onRowsPerPageChanged: (value) => calls.push(['size', value]),
    onPageChanged: (index) => calls.push(['page', index]),
  });
}
const owner = { id: 'data-table-check', generation: 1 },
  resources = new ResourceRegistry();
const font = resources.allocateId('font');
resources.register({ ...font, kind: 'font' }, () => {});
let now = 0,
  sequence = 0,
  semantics = [];
const clock = { now: () => now },
  frameDiagnostics = new FrameDiagnostics(clock);
const metrics = {
  logicalWidth: 400,
  logicalHeight: 420,
  physicalWidth: 400,
  physicalHeight: 420,
  scale: 1,
  viewportGeneration: 1,
  rendererGeneration: 1,
  nativeContextGeneration: null,
  nativeSurfaceGeneration: null,
};
const view = new FrameworkRoot(
  {
    owner,
    resources,
    assets: new Map(),
    defaultFont: font,
    clock,
    paths: {
      contains(path, { x, y }) {
        const [
          {
            verb,
            values: [left, top, right, bottom, rx, ry],
          },
        ] = path.operations;
        assert.equal(verb, 'addRRect');
        if (x < left || y < top || x >= right || y >= bottom) return false;
        if (!rx || !ry) return true;
        const dx = Math.max(left + rx - x, 0, x - (right - rx));
        const dy = Math.max(top + ry - y, 0, y - (bottom - ry));
        return (dx / rx) ** 2 + (dy / ry) ** 2 <= 1;
      },
    },
    text: {
      layout(raw) {
        const input = freezeTextInput(raw),
          width = Math.min(input.width, input.text.length * 7);
        const resource = resources.allocateId('paragraph');
        resources.register({ ...resource, kind: 'paragraph' }, () => {});
        return {
          resource,
          input,
          indexUnit: 'utf16',
          width,
          height: 20,
          alphabeticBaseline: 15,
          ideographicBaseline: 15,
          minIntrinsicWidth: width,
          maxIntrinsicWidth: width,
          longestLine: width,
          overflow: false,
          unresolvedGlyphs: 0,
          lines: [
            {
              start: 0,
              end: input.text.length,
              baseline: 15,
              height: 20,
              bounds: { x: 0, y: 0, width, height: 20 },
            },
          ],
        };
      },
      hit: () => ({ position: 0, affinity: 'downstream' }),
      range: () => [],
      boxes: () => [],
      glyphAt: () => null,
    },
    semantics: {
      capability: 'native-controls',
      bind(nodes) {
        semantics = nodes;
        return {
          update: (nodes) => {
            semantics = nodes;
          },
          dispose() {},
        };
      },
      dispose() {},
    },
    readMetrics: () => metrics,
    readStatus: () => 'open',
    requestFrame() {},
    reportError(error) {
      throw error;
    },
  },
  {
    id: owner.id,
    createRoot: () =>
      new MaterialApp({
        locale: 'ko-KR',
        theme: new ThemeData({ dataTableTheme: new DataTableThemeData({ dataRowMinHeight: 44 }) }),
        home: new Align(
          new DataTableTheme(
            new DataTableThemeData({ headingRowHeight: 53 }),
            new PageStorage({
              bucket: storage,
              child: new ListenableBuilder({ listenable: state, builder: buildTable }),
            }),
          ),
        ),
      }),
  },
);
function tick() {
  now += 16;
  releaseSceneFrameSource(
    view.build({ token: { owner, sequence: ++sequence, metrics }, resources, frameDiagnostics }),
  );
}
function find(Type, predicate = () => true) {
  const result = [];
  function visit(element) {
    if (element.widget instanceof Type && predicate(element.widget)) result.push(element);
    element.visitChildren(visit);
  }
  visit(view.root);
  return result;
}
const grid = () => {
  const object = find(DataTable)[0].findRenderObject();
  if (object instanceof RenderTable) return object;
  const walk = (root) =>
    root instanceof RenderTable ? root : root.children.map(walk).find(Boolean);
  return walk(object);
};
const text = (value) => find(Text, (text) => text.text === value)[0];
function point(element) {
  const r = element.findRenderObject();
  return r.localToGlobal({ x: r.size.width / 2, y: r.size.height / 2 });
}
function mouse(kind, { x, y }, pointer = 1) {
  view.pointer({
    kind,
    pointer,
    device: 'mouse',
    x,
    y,
    buttons: kind === 'down' || kind === 'move' ? 1 : 0,
    timestamp: now,
    viewportGeneration: 1,
  });
}
function tap(element, pointer) {
  const position = point(element);
  mouse('down', position, pointer);
  mouse('up', position, pointer);
  tick();
}
const boxes = () => find(Checkbox).map(({ widget }) => [widget.value, widget.onChanged !== null]);
const has = (event) => calls.some((call) => JSON.stringify(call) === JSON.stringify(event));
try {
  tick();
  tick();
  assert.equal(grid().columns, 3);
  assert.equal(grid().getRowBox(0).height, 53);
  assert.equal(grid().getRowBox(1).height, 44);
  assert.equal(grid().getRowBox(3).height, 65);
  assert.equal(grid().children[2].size.width, 100);
  assert(point(text('Qty')).x > point(text('Name')).x);
  assert.deepEqual(boxes(), [
    [null, true],
    [true, true],
    [false, true],
    [false, false],
  ]);
  const selectAllNode = () =>
    flattenSemantics(semantics).find((node) => node.name === '전체 선택' && node.actions?.activate);
  assert.equal(selectAllNode()?.checkable, 'checkbox');
  assert.equal(selectAllNode()?.checkedMixed, true);
  assert.equal(selectAllNode()?.checked, undefined);
  const source = view.pipeline.semanticsOwner.rootSemanticsNode;
  const semanticNodes = [];
  function walkSemantics(node) {
    semanticNodes.push(node);
    node.visitChildren((child) => {
      walkSemantics(child);
      return true;
    });
  }
  walkSemantics(source);
  assert(semanticNodes.some((node) => node.role === 'table'));
  assert(
    semanticNodes.some(
      (node) => node.label === '전체 선택' && node.flagsCollection.isChecked === CheckedState.mixed,
    ),
  );
  assert.equal(semanticNodes.filter((node) => node.role === 'row').length, 4);
  assert(
    semanticNodes.some(
      (node) =>
        node.label === 'Qty' &&
        node.parent?.role === 'columnHeader' &&
        node.parent.parent?.role === 'row' &&
        node.flagsCollection.isButton,
    ),
  );
  assert(
    semanticNodes.some(
      (node) => node.role === 'row' && node.flagsCollection.isSelected === Tristate.isTrue,
    ),
  );
  const kept = text('Two');
  tap(text('Qty'));
  assert.deepEqual(calls.at(-1), ['sort', 1, true]);
  assert(point(text('Two')).y < point(text('One')).y);
  assert.equal(text('Two'), kept);
  tap(text('Qty'));
  assert.deepEqual(calls.at(-1), ['sort', 1, false]);
  tap(text('Name'));
  assert.deepEqual(calls.at(-1), ['sort', 0, true]);
  tap(find(Checkbox)[0]);
  assert.deepEqual(calls.at(-1), ['row', 2, true]);
  assert.deepEqual(boxes()[0], [true, true]);
  assert.equal(selectAllNode()?.checked, true);
  assert.equal(selectAllNode()?.checkedMixed, undefined);
  tap(find(Checkbox)[0]);
  assert.deepEqual([...selected], []);
  assert.deepEqual(boxes()[0], [false, true]);
  tap(text('One'));
  assert.deepEqual(calls.at(-1), ['row', 1, true]);
  const disabled = find(Checkbox).at(-1);
  tap(disabled);
  assert(!has(['row', 3, true]));
  customSelectAll = true;
  update();
  tick();
  tap(find(Checkbox)[0]);
  assert.deepEqual(calls.at(-1), ['all', true]);
  assert.deepEqual([...selected], [1]);
  showCheckboxColumn = false;
  update();
  tick();
  assert.equal(grid().columns, 2);
  assert.equal(boxes().length, 0);

  tap(text('quantity 1'), 2);
  await wait(350);
  tick();
  assert(has(['tap', 1]));
  assert(has(['down', 1]));
  assert.deepEqual([...selected], [1]);
  tap(text('quantity 1'), 3);
  await wait(60);
  tap(text('quantity 1'), 4);
  await wait(350);
  tick();
  assert(has(['double', 1]));
  let position = point(text('quantity 1'));
  mouse('down', position, 5);
  await wait(550);
  mouse('up', position, 5);
  tick();
  assert(has(['long', 1]));
  mouse('down', position, 6);
  await wait(120);
  mouse('cancel', position, 6);
  tick();
  assert(has(['cancel', 1]));
  position = point(text('One'));
  mouse('down', position, 7);
  await wait(550);
  mouse('up', position, 7);
  tick();
  assert(has(['row-long', 1]));
  mouse('hover', point(text('Two')));
  mouse('hover', { x: 1, y: 1 });
  assert(has(['hover', 2, true]));
  assert(has(['hover', 2, false]));

  assert.equal(BarrelSource, DataTableSource);
  assert.equal(BarrelPaginatedTable, PaginatedDataTable);
  const renderUpdate = () => {
    update();
    tick();
  };
  const arrow = (label) => find(IconButton, ({ tooltip }) => tooltip === label)[0];
  const pageRows = () => find(DataTable)[0].widget.rows;
  mode = 'paginated';
  renderUpdate();
  assert(pagination instanceof PaginatedDataTableState);
  assert(primary.hasListeners);
  assert.deepEqual(primary.reads, [3, 4, 5]);
  assert(text('4–6 of 8'));
  tap(text('Record 3'));
  assert.deepEqual(calls.at(-1), ['select-paged', 3, true]);
  assert(text('1 selected'));
  tap(arrow('Next page'));
  assert.deepEqual(calls.at(-1), ['page', 6]);
  assert.equal(arrow('Next page').widget.onPressed, null);
  assert.equal(arrow('Last page').widget.onPressed, null);
  assert(text('7–8 of 8'), JSON.stringify(find(Text).map(({ widget }) => widget.text)));
  assert.equal(pageRows().length, 3);
  assert.equal(pageRows().at(-1).onSelectChanged, null);
  assert(text('1 selected'));
  const readCount = primary.reads.length;
  tap(arrow('Previous page'));
  assert.equal(primary.reads.length, readCount);
  assert.equal(pageRows()[0].selected, true);
  tap(arrow('First page'));
  assert.deepEqual(calls.at(-1), ['page', 0]);
  assert.equal(arrow('Previous page').widget.onPressed, null);
  tap(arrow('Last page'));
  assert.deepEqual(calls.at(-1), ['page', 6]);
  mode = 'hidden';
  renderUpdate();
  assert(!primary.hasListeners);
  mode = 'paginated';
  renderUpdate();
  assert.equal(pagination.firstRowIndex, 6);
  const eventCount = calls.length;
  pagination.pageTo(7);
  assert.equal(calls.length, eventCount);

  tap(text('Rows per page: 3'));
  assert(!text('10 rows per page'));
  tap(text('2 rows per page'));
  assert.deepEqual(calls.at(-1), ['size', 2]);
  assert(text('Rows per page: 3'));
  pageSize = 2;
  emptyRows = false;
  renderUpdate();
  assert(text('Rows per page: 2'));
  assert.equal(pagination.firstRowIndex, 6);

  pagedSource = replacement;
  renderUpdate();
  assert(!primary.hasListeners);
  assert(replacement.hasListeners);
  assert.equal(pagination.firstRowIndex, 0);
  assert(text('Replacement 0'));
  replacement.approximate = true;
  replacement.missing.add(2).add(3);
  replacement.notifyListeners();
  tick();
  tap(arrow('Next page'));
  assert(text('3–4 of about 2'));
  assert.equal(find(CircularProgressIndicator).length, 1);
  replacement.total = 3;
  replacement.approximate = false;
  replacement.missing.clear();
  replacement.notifyListeners();
  tick();
  assert.equal(find(CircularProgressIndicator).length, 0);
  assert.equal(pageRows().length, 1);
  assert(text('3–3 of 3'));
  replacement.total = 0;
  replacement.notifyListeners();
  tick();
  assert.equal(pagination.firstRowIndex, 0);
  assert.equal(pageRows().length, 0);
  assert(text('0–0 of 0'));
  view.dispose();
  assert(!primary.hasListeners && !replacement.hasListeners);
  primary.notifyListeners();
  replacement.notifyListeners();
} finally {
  view.dispose();
  primary.dispose();
  replacement.dispose();
  state.dispose();
  resources.dispose();
}
console.log(
  'DataTable behavior and PaginatedDataTable navigation, selection, notifications and lifecycle passed',
);
