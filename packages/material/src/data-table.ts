// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Behavior reference: Flutter material/data_table.dart at 71e4717a61786faab4c7aa39825989305ed29e8a.
import { UniqueKey, ValueKey } from '@nelyx/core/foundation/key';
import type { LocalKey } from '@nelyx/core/foundation/key';
import { AnimationStatus } from '@nelyx/core/framework/animation/animation';
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import { CurvedAnimation } from '@nelyx/core/framework/animation/animations';
import { Curves } from '@nelyx/core/framework/animation/curves';
import type { TapDownDetails } from '@nelyx/core/framework/gestures/tap';
import { Alignment, AlignmentDirectional } from '@nelyx/core/framework/painting/alignment';
import type { Decoration } from '@nelyx/core/framework/painting/decoration';
import { EdgeInsetsDirectional } from '@nelyx/core/framework/painting/edge-insets';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import type { MainAxisAlignment } from '@nelyx/core/framework/rendering/boxes';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { FixedColumnWidth, IntrinsicColumnWidth } from '@nelyx/core/framework/rendering/table';
import type { TableColumnWidth } from '@nelyx/core/framework/rendering/table';
import { Directionality } from '@nelyx/core/framework/widgets/app-data';
import { Center, Expanded, Row, SizedBox, Transform } from '@nelyx/core/framework/widgets/basic';
import { Container } from '@nelyx/core/framework/widgets/container';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import { StatefulWidget, StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { Icon } from '@nelyx/core/framework/widgets/icon';
import { AnimatedDefaultTextStyle } from '@nelyx/core/framework/widgets/implicit-animations';
import { MouseRegion } from '@nelyx/core/framework/widgets/mouse-region';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { TableCell, TableRow } from '@nelyx/core/framework/widgets/table';
import { TickerProviderStateMixin } from '@nelyx/core/framework/widgets/ticker-provider';
import { AnimatedBuilder, FadeTransition } from '@nelyx/core/framework/widgets/transitions';
import { emptyWidgetStateSet, WidgetState } from '@nelyx/core/framework/widgets/widget-state';
import type { WidgetStateProperty } from '@nelyx/core/framework/widgets/widget-state';
import type { MouseCursor } from '@nelyx/core/services/mouse-cursor';
import { Matrix4 } from '@nelyx/core/math/matrix4';
import type { Clip } from '@nelyx/core/ui/clip';
import { Color } from '@nelyx/core/ui/color';
import { SemanticsRole } from '@nelyx/core/ui/semantics';
import { Checkbox } from './checkbox.ts';
import { DataTableTheme } from './data-table-theme.ts';
import { Divider } from './divider.ts';
import { Icons } from './icons.ts';
import { InkWell } from './ink-well.ts';
import { DataTableGrid, TableRowInkWell } from './internal/data-table-grid.ts';
import { Material, MaterialType } from './material.ts';
import { MaterialLocalizations } from './material-localizations.ts';
import type { TableBorder } from './internal/data-table-grid.ts';
import { Theme } from './theme.ts';
import { Tooltip } from './tooltip.ts';

export { TableBorder, TableRowInkWell } from './internal/data-table-grid.ts';
export type { TableBorderOptions, TableRowInkWellOptions } from './internal/data-table-grid.ts';

export type DataColumnSortCallback = (columnIndex: number, ascending: boolean) => void;
type SelectionCallback = (selected: boolean | null) => void;
type ColorProperty = WidgetStateProperty<Color | null>;
type CursorProperty = WidgetStateProperty<MouseCursor | null>;
type Callback = () => void;

export interface DataColumnOptions {
  readonly label: Widget;
  readonly columnWidth?: TableColumnWidth | null;
  readonly tooltip?: string | null;
  readonly numeric?: boolean;
  readonly onSort?: DataColumnSortCallback | null;
  readonly mouseCursor?: CursorProperty | null;
  readonly headingRowAlignment?: MainAxisAlignment | null;
}

export class DataColumn {
  readonly label: Widget;
  readonly columnWidth: TableColumnWidth | null;
  readonly tooltip: string | null;
  readonly numeric: boolean;
  readonly onSort: DataColumnSortCallback | null;
  readonly mouseCursor: CursorProperty | null;
  readonly headingRowAlignment: MainAxisAlignment | null;
  constructor(options: DataColumnOptions) {
    this.label = options.label;
    this.columnWidth = options.columnWidth ?? null;
    this.tooltip = options.tooltip ?? null;
    this.numeric = options.numeric ?? false;
    this.onSort = options.onSort ?? null;
    this.mouseCursor = options.mouseCursor ?? null;
    this.headingRowAlignment = options.headingRowAlignment ?? null;
  }
}

export interface DataRowOptions {
  readonly key?: LocalKey | null;
  readonly selected?: boolean;
  readonly onSelectChanged?: SelectionCallback | null;
  readonly onLongPress?: Callback | null;
  readonly onHover?: ((hovered: boolean) => void) | null;
  readonly color?: ColorProperty | null;
  readonly mouseCursor?: CursorProperty | null;
  readonly cells: readonly DataCell[];
}

export class DataRow {
  readonly key: LocalKey | null;
  readonly selected: boolean;
  readonly onSelectChanged: SelectionCallback | null;
  readonly onLongPress: Callback | null;
  readonly onHover: NonNullable<DataRowOptions['onHover']> | null;
  readonly color: ColorProperty | null;
  readonly mouseCursor: CursorProperty | null;
  readonly cells: readonly DataCell[];
  constructor(options: DataRowOptions) {
    this.key = options.key ?? null;
    this.selected = options.selected ?? false;
    this.onSelectChanged = options.onSelectChanged ?? null;
    this.onLongPress = options.onLongPress ?? null;
    this.onHover = options.onHover ?? null;
    this.color = options.color ?? null;
    this.mouseCursor = options.mouseCursor ?? null;
    this.cells = Object.freeze([...options.cells]);
  }
  static byIndex({
    index = null,
    ...options
  }: Omit<DataRowOptions, 'key'> & { readonly index?: number | null }): DataRow {
    return new DataRow({ ...options, key: new ValueKey(index) });
  }
}

export interface DataCellOptions {
  readonly placeholder?: boolean;
  readonly showEditIcon?: boolean;
  readonly onTap?: Callback | null;
  readonly onDoubleTap?: Callback | null;
  readonly onLongPress?: Callback | null;
  readonly onTapDown?: ((details: TapDownDetails) => void) | null;
  readonly onTapCancel?: Callback | null;
}

export class DataCell {
  static readonly empty = new DataCell(new SizedBox(0, 0));
  readonly placeholder: boolean;
  readonly showEditIcon: boolean;
  readonly onTap: Callback | null;
  readonly onDoubleTap: Callback | null;
  readonly onLongPress: Callback | null;
  readonly onTapDown: NonNullable<DataCellOptions['onTapDown']> | null;
  readonly onTapCancel: Callback | null;
  constructor(
    readonly child: Widget,
    options: DataCellOptions = {},
  ) {
    this.placeholder = options.placeholder ?? false;
    this.showEditIcon = options.showEditIcon ?? false;
    this.onTap = options.onTap ?? null;
    this.onDoubleTap = options.onDoubleTap ?? null;
    this.onLongPress = options.onLongPress ?? null;
    this.onTapDown = options.onTapDown ?? null;
    this.onTapCancel = options.onTapCancel ?? null;
  }
}

export interface DataTableOptions extends WidgetOptions {
  readonly columns: readonly DataColumn[];
  readonly rows: readonly DataRow[];
  readonly sortColumnIndex?: number | null;
  readonly sortAscending?: boolean;
  readonly onSelectAll?: SelectionCallback | null;
  readonly decoration?: Decoration | null;
  readonly dataRowColor?: ColorProperty | null;
  /** @deprecated Use dataRowMinHeight and dataRowMaxHeight. */
  readonly dataRowHeight?: number | null;
  readonly dataRowMinHeight?: number | null;
  readonly dataRowMaxHeight?: number | null;
  readonly dataTextStyle?: TextStyle | null;
  readonly headingRowColor?: ColorProperty | null;
  readonly headingRowHeight?: number | null;
  readonly headingTextStyle?: TextStyle | null;
  readonly horizontalMargin?: number | null;
  readonly columnSpacing?: number | null;
  readonly showCheckboxColumn?: boolean;
  readonly dividerThickness?: number | null;
  readonly showBottomBorder?: boolean;
  readonly checkboxHorizontalMargin?: number | null;
  readonly border?: TableBorder | null;
  readonly clipBehavior?: Clip;
}

const headingKey = new UniqueKey();
const sortIconSize = 16;
const sortGap = 2;
const sortDuration = 150;
function states(selected = false, disabled = false) {
  const result = emptyWidgetStateSet();
  if (selected) result.add(WidgetState.selected);
  if (disabled) result.add(WidgetState.disabled);
  return result;
}

export class DataTable extends StatelessWidget {
  readonly options: Readonly<DataTableOptions>;
  readonly columns: readonly DataColumn[];
  readonly rows: readonly DataRow[];
  readonly sortColumnIndex: number | null;
  readonly sortAscending: boolean;
  readonly dataRowMinHeight: number | null;
  readonly dataRowMaxHeight: number | null;
  constructor(options: DataTableOptions) {
    super(options.key ?? null);
    this.columns = Object.freeze([...options.columns]);
    this.rows = Object.freeze([...options.rows]);
    this.options = Object.freeze({ ...options, columns: this.columns, rows: this.rows });
    this.sortColumnIndex = options.sortColumnIndex ?? null;
    this.sortAscending = options.sortAscending ?? true;
    this.dataRowMinHeight = options.dataRowMinHeight ?? options.dataRowHeight ?? null;
    this.dataRowMaxHeight = options.dataRowMaxHeight ?? options.dataRowHeight ?? null;
    if (!this.columns.length || this.rows.some((row) => row.cells.length !== this.columns.length))
      throw new RangeError(
        'DataTable requires columns and exactly one cell per column in every row',
      );
    const index = this.sortColumnIndex;
    if (index !== null && (!Number.isInteger(index) || index < 0 || index >= this.columns.length))
      throw new RangeError('Invalid DataTable sortColumnIndex');
    if (
      options.dataRowHeight != null &&
      (options.dataRowMinHeight != null || options.dataRowMaxHeight != null)
    )
      throw new RangeError('Use either dataRowHeight or the minimum/maximum height options');
    const dimensions = [
      this.dataRowMinHeight,
      options.headingRowHeight,
      options.columnSpacing,
      options.horizontalMargin,
      options.checkboxHorizontalMargin,
      options.dividerThickness,
    ];
    if (
      dimensions.some((value) => value != null && (!Number.isFinite(value) || value < 0)) ||
      (this.dataRowMaxHeight != null &&
        (Number.isNaN(this.dataRowMaxHeight) ||
          this.dataRowMaxHeight < (this.dataRowMinHeight ?? 0)))
    )
      throw new RangeError('Invalid DataTable dimensions');
  }
  /** @deprecated Use dataRowMinHeight and dataRowMaxHeight. */
  get dataRowHeight(): number | null {
    return this.dataRowMinHeight === this.dataRowMaxHeight ? this.dataRowMinHeight : null;
  }
  build(context: BuildContext): Widget {
    const o = this.options,
      theme = Theme.of(context),
      local = DataTableTheme.of(context),
      base = theme.dataTableTheme;
    const direction = Directionality.of(context);
    const headingColor = o.headingRowColor ?? local.headingRowColor ?? base.headingRowColor;
    const dataColor = o.dataRowColor ?? local.dataRowColor ?? base.dataRowColor;
    const margin = o.horizontalMargin ?? local.horizontalMargin ?? base.horizontalMargin ?? 24;
    const checkMargin =
      o.checkboxHorizontalMargin ?? local.checkboxHorizontalMargin ?? base.checkboxHorizontalMargin;
    const spacing = o.columnSpacing ?? local.columnSpacing ?? base.columnSpacing ?? 56;
    const headingHeight =
      o.headingRowHeight ?? local.headingRowHeight ?? base.headingRowHeight ?? 56;
    const minHeight =
      this.dataRowMinHeight ?? local.dataRowMinHeight ?? base.dataRowMinHeight ?? 48;
    const maxHeight =
      this.dataRowMaxHeight ?? local.dataRowMaxHeight ?? base.dataRowMaxHeight ?? 48;
    const ambient = DefaultTextStyle.of(context)?.style ?? new TextStyle();
    const headingStyle = ambient.merge(
      o.headingTextStyle ??
        local.headingTextStyle ??
        base.headingTextStyle ??
        theme.textTheme.titleSmall!,
    );
    const dataStyle = ambient.merge(
      o.dataTextStyle ?? local.dataTextStyle ?? base.dataTextStyle ?? theme.textTheme.bodyMedium!,
    );
    const placeholderStyle = dataStyle.copyWith({
      color: new Color(dataStyle.color ?? theme.colorScheme.onSurface).withOpacity(0.6).toARGB32(),
    });
    const selectable = this.rows.filter((row) => row.onSelectChanged !== null);
    const showChecks = (o.showCheckboxColumn ?? true) && selectable.length > 0;
    const checked = selectable.filter((row) => row.selected).length;
    const mixed = checked > 0 && checked < selectable.length;
    const widths = new Map<number, TableColumnWidth>();
    const heading: Widget[] = [],
      body = this.rows.map((): Widget[] => []);
    const checkbox = (
      value: boolean | null,
      onChanged: SelectionCallback | null,
      all = false,
      row?: DataRow,
    ) => {
      let child: Widget = new Container({
        alignment: Alignment.center,
        padding: new EdgeInsetsDirectional(checkMargin ?? margin, 0, checkMargin ?? margin / 2),
        child: new Center(
          new Checkbox({
            value,
            onChanged,
            tristate: all,
            semanticLabel: all ? MaterialLocalizations.of(context).selectAllButtonLabel : null,
          }),
        ),
      });
      if (row && onChanged)
        child = new TableRowInkWell({
          child,
          onTap: () => onChanged(!value),
          excludeFromSemantics: true,
          canRequestFocus: false,
          overlayColor: row.color ?? dataColor,
          mouseCursor:
            row.mouseCursor?.resolve(states(row.selected)) ??
            (local.dataRowCursor ?? base.dataRowCursor)?.resolve(states(row.selected)) ??
            null,
        });
      return new TableCell(new Semantics({ child, container: true, role: SemanticsRole.cell }), {
        verticalAlignment: 'fill',
      });
    };
    if (showChecks) {
      widths.set(
        0,
        new FixedColumnWidth(
          (checkMargin ?? margin) + Checkbox.width + (checkMargin ?? margin / 2),
        ),
      );
      heading.push(
        checkbox(
          mixed ? null : checked === selectable.length,
          (value) => {
            const next = mixed || value === true;
            if (o.onSelectAll) o.onSelectAll(next);
            else
              for (const row of selectable) if (row.selected !== next) row.onSelectChanged!(next);
          },
          true,
        ),
      );
      this.rows.forEach((row, at) =>
        body[at]!.push(checkbox(row.selected, row.onSelectChanged, false, row)),
      );
    }
    const onlyText = this.columns.filter((column) => !column.numeric);
    this.columns.forEach((column, at) => {
      widths.set(
        at + Number(showChecks),
        column.columnWidth ??
          new IntrinsicColumnWidth(onlyText.length === 1 && onlyText[0] === column ? 1 : null),
      );
      const padding = new EdgeInsetsDirectional(
        at === 0
          ? showChecks && o.checkboxHorizontalMargin == null
            ? margin / 2
            : margin
          : spacing / 2,
        0,
        at === this.columns.length - 1 ? margin : spacing / 2,
      );
      const alignment = column.numeric ? Alignment.centerRight : AlignmentDirectional.centerStart;
      const sorted = at === this.sortColumnIndex;
      const mainAxisAlignment =
        column.headingRowAlignment ??
        local.headingRowAlignment ??
        base.headingRowAlignment ??
        'start';
      const label: Widget[] = [column.label];
      if (column.onSort) {
        if (mainAxisAlignment === 'center') label.unshift(new SizedBox(sortIconSize + sortGap, 0));
        label.push(
          new SortArrow(sorted, sorted ? this.sortAscending : null),
          new SizedBox(sortGap, 0),
        );
      }
      let header: Widget = new Container({
        height: headingHeight,
        padding,
        alignment,
        child: new AnimatedDefaultTextStyle({
          style: headingStyle,
          softWrap: false,
          duration: sortDuration,
          child: new Row(label, {
            textDirection: column.numeric ? 'rtl' : direction,
            mainAxisAlignment,
          }),
        }),
      });
      if (column.tooltip !== null) header = new Tooltip({ message: column.tooltip, child: header });
      const onSort = column.onSort
        ? () => column.onSort!(at, !sorted || !this.sortAscending)
        : null;
      const headerStates = states(false, !onSort);
      const mouseCursor =
        column.mouseCursor?.resolve(headerStates) ??
        (local.headingCellCursor ?? base.headingCellCursor)?.resolve(headerStates);
      header = new InkWell({
        child: header,
        onTap: onSort,
        overlayColor: headingColor,
        mouseCursor: mouseCursor ?? null,
      });
      heading.push(
        new Semantics({
          child: onSort ? new Semantics({ child: header, container: true, button: true }) : header,
          container: true,
          explicitChildNodes: onSort !== null,
          role: SemanticsRole.columnHeader,
        }),
      );
      this.rows.forEach((row, rowIndex) => {
        const cell = row.cells[at]!;
        const content = cell.showEditIcon
          ? new Row([new Expanded(cell.child), new Icon(Icons.edit, { size: 18 })], {
              textDirection: column.numeric ? 'rtl' : direction,
            })
          : cell.child;
        let child: Widget = new Container({
          padding,
          alignment,
          constraints: new BoxConstraints(0, Infinity, minHeight, maxHeight),
          child: new DefaultTextStyle(cell.placeholder ? placeholderStyle : dataStyle, content),
        });
        const overlayColor = row.color ?? dataColor;
        const cellOwnsGesture = !!(
          cell.onTap ||
          cell.onDoubleTap ||
          cell.onLongPress ||
          cell.onTapDown ||
          cell.onTapCancel
        );
        const activates = cellOwnsGesture ? !!cell.onTap : !!row.onSelectChanged;
        const longPresses = cellOwnsGesture ? !!cell.onLongPress : !!row.onLongPress;
        if (cellOwnsGesture) {
          child = new InkWell({
            child,
            overlayColor,
            onTap: cell.onTap,
            onDoubleTap: cell.onDoubleTap,
            onLongPress: cell.onLongPress,
            onTapDown: cell.onTapDown,
            onTapCancel: cell.onTapCancel,
          });
        } else {
          const rowStates = states(row.selected);
          const mouseCursor =
            row.mouseCursor?.resolve(rowStates) ??
            (local.dataRowCursor ?? base.dataRowCursor)?.resolve(rowStates);
          if (row.onSelectChanged || row.onLongPress)
            child = new TableRowInkWell({
              child,
              overlayColor,
              mouseCursor: mouseCursor ?? null,
              onTap: row.onSelectChanged ? () => row.onSelectChanged!(!row.selected) : null,
              onLongPress: row.onLongPress,
              onHover: row.onHover,
            });
          else if (row.onHover || mouseCursor)
            child = new MouseRegion(child, {
              ...(mouseCursor ? { cursor: mouseCursor } : {}),
              onEnter: () => row.onHover?.(true),
              onExit: () => row.onHover?.(false),
            });
        }
        const ownsAction = activates || longPresses;
        body[rowIndex]!.push(
          new Semantics({
            child: ownsAction
              ? new Semantics({ child, container: true, button: activates })
              : child,
            container: true,
            explicitChildNodes: ownsAction,
            role: SemanticsRole.cell,
          }),
        );
      });
    });
    const colors = [
      headingColor?.resolve(states()) ?? null,
      ...this.rows.map(
        (row) =>
          (row.color ?? dataColor)?.resolve(
            states(row.selected, selectable.length > 0 && !row.onSelectChanged),
          ) ?? (row.selected ? new Color(theme.colorScheme.primary).withOpacity(0.08) : null),
      ),
    ];
    return new Container({
      decoration: o.decoration ?? local.decoration ?? base.decoration,
      child: new Material({
        type: MaterialType.transparency,
        clipBehavior: o.clipBehavior ?? 'none',
        borderRadius: o.border?.borderRadius ?? null,
        child: new DataTableGrid(
          [
            new TableRow(heading, { key: headingKey }),
            ...this.rows.map((row, at) => new TableRow(body[at], { key: row.key })),
          ],
          widths,
          {
            colors,
            selected: this.rows.map((row) => row.selected),
            border: o.border ?? null,
            showBottomBorder: o.showBottomBorder ?? false,
            divider: Divider.createBorderSide(context, {
              width: o.dividerThickness ?? local.dividerThickness ?? base.dividerThickness ?? 1,
            }),
          },
        ),
      }),
    });
  }
}

class SortArrow extends StatefulWidget {
  constructor(
    readonly visible: boolean,
    readonly ascending: boolean | null,
  ) {
    super();
  }
  createState(): SortArrowState {
    return new SortArrowState();
  }
}

class SortArrowState extends TickerProviderStateMixin<SortArrow> {
  private opacity!: AnimationController;
  private fade!: CurvedAnimation;
  private turn!: AnimationController;
  private baseAngle = 0;
  private ascending: boolean | null = null;
  private readonly icon = new Icon(Icons.arrow_upward, { size: sortIconSize });

  override initState(): void {
    super.initState();
    const arrow = this.widget;
    this.ascending = arrow.ascending;
    this.baseAngle = arrow.ascending === false ? Math.PI : 0;
    this.opacity = new AnimationController({
      duration: sortDuration,
      vsync: this,
      value: arrow.visible ? 1 : 0,
    });
    this.fade = new CurvedAnimation({ parent: this.opacity, curve: Curves.fastOutSlowIn });
    this.turn = new AnimationController({ duration: sortDuration, vsync: this });
    this.turn.addStatusListener((status) => {
      if (status !== AnimationStatus.completed) return;
      this.baseAngle = (this.baseAngle + Math.PI) % (2 * Math.PI);
      this.turn.value = 0;
    });
  }

  override didUpdateWidget(old: SortArrow): void {
    super.didUpdateWidget(old);
    const arrow = this.widget;
    const ascending = arrow.ascending ?? this.ascending;
    const reset =
      arrow.visible && !old.visible && this.opacity.status === AnimationStatus.dismissed;
    if (reset) {
      this.turn.stop();
      this.turn.value = 0;
      this.baseAngle = ascending === false ? Math.PI : 0;
    }
    if (old.visible !== arrow.visible) {
      if (arrow.visible) void this.opacity.forward();
      else void this.opacity.reverse();
    }
    if (this.ascending !== ascending && !reset) {
      if (this.turn.status === AnimationStatus.dismissed) void this.turn.forward();
      else void this.turn.reverse();
    }
    this.ascending = ascending;
  }

  build(): Widget {
    return new FadeTransition({
      opacity: this.fade,
      child: new AnimatedBuilder({
        animation: this.turn,
        child: this.icon,
        builder: (_context, child) => {
          const transform = Matrix4.rotationZ(
            this.baseAngle + Math.PI * Curves.easeIn.transform(this.turn.value),
          );
          transform.setTranslationRaw(0, -1.5, 0);
          return new Transform(child ?? undefined, transform.storage, null, {
            alignment: Alignment.center,
          });
        },
      }),
    });
  }

  override dispose(): void {
    this.fade.dispose();
    this.opacity.dispose();
    this.turn.dispose();
    super.dispose();
  }
}
