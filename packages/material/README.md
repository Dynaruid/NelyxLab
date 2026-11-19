# @nelyx/material

Material 3 components and themes for Nelyx applications. The package builds on the shared Widget/Element/RenderObject framework in `@nelyx/core`.

Start with the [project guide](../../README.md) or explore the [Testbed](../../sample/nelyx-testbed-app-2/README.md). Component coverage is incomplete; available themes and declarations do not imply every Material component is implemented.

## Maintaining widgets

Move existing candidates from `src/generated/flutter-design` into the owning feature modules as described in the [W11 migration plan](../../work11.md). Edit and test the package TypeScript directly, preserving upstream notices. Unpromoted candidates are not public imports.

## Imports

Use the component aggregate or a feature subpath:

```ts
import {MaterialApp, FilledButton, TextField} from '@nelyx/material/widgets';
import {ThemeData} from '@nelyx/material/theme-data';
import {ColorScheme} from '@nelyx/material/color-scheme';
```

| Area | Subpaths |
| --- | --- |
| Application and theme | `app`, `theme`, `theme-data`, `color-scheme`, `text-theme` |
| Buttons | `filled-button`, `text-button`, `outlined-button`, `elevated-button`, `icon-button` |
| Selection | `checkbox`, `radio`, `switch`, `segmented-button`, `slider`, `range-slider`, `date-picker`, `time-picker` |
| Text and forms | `text-field`, `text-form-field`, `input-decoration` |
| Surfaces and feedback | `material`, `card`, `bottom-sheet`, `snack-bar`, `scaffold-messenger`, `ink-well`, `tooltip`, `progress-indicator` |
| Navigation and scrolling | `scaffold`, `app-bar`, `action-buttons`, `drawer`, `navigation-drawer`, `navigation-bar`, `navigation-rail`, `tabs`, `tab-controller`, `page`, `page-transitions-theme`, `scrollbar`, `scroll-behavior` |
| Data | `data-table`, `data-table-theme`, `data-table-source`, `paginated-data-table` |
| Assets | `icons`, `icon-assets`, `animated-icons` |

All names are relative to `@nelyx/material/`. See [package.json](package.json) for the full export list.

## Themes and state

Wrap the application in MaterialApp and use the package's Theme/ThemeData for Material styling. Core's AppTheme/AppThemeData serves the common Nelyx adapter. Keep one shared Core instance across design packages.

This package targets Material 3. Material 2 configuration and compatibility aliases are unavailable.

`NavigationBar` renders controlled destinations. Update `selectedIndex` from `onDestinationSelected`. `NavigationDestination` supports a selected icon, accessibility label, tooltip, and disabled state. `NavigationBarTheme` controls the destination colors, text and indicator.

`Scaffold({ appBar, body, bottomNavigationBar, floatingActionButton })` supports a Material page with a fixed `AppBar`, including a preferred-size bottom widget and automatically implied back action on a pushed page. `AppBarTheme` supplies the toolbar defaults, and scrolling in the body updates the bar's Material surface.

`showTimePicker({ context, initialTime })` returns an immutable `TimeOfDay` or `null` on dismissal. The dialog supports dial and typed input, including either mode alone, and uses the Material locale for format and labels. `TimePickerDialog` accepts a restoration ID inside a Core restoration scope.

Checkbox, Radio, Switch, Slider, and RangeSlider are controlled components: the application stores their values and applies changes requested through callbacks. Controllers and FocusNodes supplied by the application remain caller-owned.

Some source-typed generic values require explicit numeric carriers and type witnesses. For example:

```ts
import {ScrollbarThemeData} from '@nelyx/material/scrollbar-theme';
import {WidgetStatePropertyAll} from '@nelyx/core/framework/widgets/widget-state';
import {DartDouble} from '@nelyx/core/foundation/dart-numeric';
import {dartDoubleType, nullableDartType} from '@nelyx/core/foundation/dart-type-witness';

const thickness = new WidgetStatePropertyAll(
  nullableDartType(dartDoubleType), DartDouble.fromSource(12),
);
const scrollbarTheme = new ScrollbarThemeData({thickness});
```

Use the declarations for the selected component's exact value and callback types.

## Floating action buttons

Import `FloatingActionButton` from `@nelyx/material/floating-action-button`. Use the constructor or `.small()`, `.large()`, and `.extended()` (required `label`, optional `icon`). Set `onPressed: null` to disable activation without changing the default Material 3 colors. Use `FloatingActionButtonThemeData` for family-wide overrides.

With a Hero-enabled navigator, use distinct `heroTag` values for multiple buttons on one route, or pass `null` to opt out. FABs register with Core Hero; Flutter's default flight tween and inherited-theme interpolation are not implemented, and end-to-end route flights are not covered by the check. Material 2 is not supported by the current Material theme.

Run the mounted package regression with `node packages/material/eng/check-floating-action-button.mjs` after building Material.

## Bottom sheets

Import `BottomSheet` and `showModalBottomSheet<T>` from `@nelyx/material/bottom-sheet`. The inline widget leaves dismissal to its owner. The modal uses Core's nearest navigator by default, resolves with the value passed to `Navigator.pop`, and resolves to `undefined` on dismissal. Set `useRootNavigator` to use the outer navigator. The optional handle closes the sheet on activation; swipe-to-dismiss, draggable scrolling, and custom transition controllers are not available.

## Drawers and tabs

Pass `drawer` or `endDrawer` to `Scaffold`. Its `AppBar` supplies a drawer button when the corresponding leading or actions slot is empty. Use `Scaffold.of(context)` to open and close either side. `Navigator.pop()` closes the most recently opened drawer and preserves its page. `NavigationDrawer` counts only `NavigationDrawerDestination` children when reporting `onDestinationSelected` and resolving `selectedIndex`.

Use a `TabController` from `tab-controller` or a surrounding `DefaultTabController` to connect `TabBar` and `TabBarView` from `tabs`. Declare a matching number of tabs and pages. The same controller receives tab activation, drag progress, and the settled page index. `TabBar.secondary` supplies the secondary style.

## Snackbars

Use `ScaffoldMessenger.of(context).showSnackBar(new SnackBar({ content }))` inside a `MaterialApp`. Calls queue in order and return a controller whose `closed` promise resolves to a `SnackBarClosedReason`. A snackbar with an action stays open by default. Set `persist: false` to start a timeout after it appears.

## Data tables

Import `DataTable`, `DataColumn`, `DataRow`, and `DataCell` from `@nelyx/material/data-table` or `@nelyx/material/widgets`. Sorting and selection are controlled: reorder `rows` in `DataColumn.onSort`, update `sortColumnIndex` and `sortAscending`, and rebuild with new `DataRow.selected` values in selection callbacks. Use `DataRow.byIndex` with a stable record index when reordering. A cell gesture takes precedence over its row's gestures; an edit icon is visual and does not edit the value on its own.

Table style overrides fall back to `DataTableTheme` and then `ThemeData.dataTableTheme`. The table measures all rows and does not scroll by itself.

Parity limits against Flutter `71e4717a61786faab4c7aa39825989305ed29e8a`: sort arrows switch immediately, without Flutter's fade, rotation, or baseline offset; dropdown underlines are not suppressed; and the Material-local `TableBorder` provides border painting but not Flutter's factories, interpolation, or value methods. Visual options are available through `DataTable.options` rather than individual Dart-style properties. Source semantics retain the table, row, header, and cell roles and the mixed checkbox state. The current host transport does not preserve all those roles or the mixed state. There is no separate semantic sort-direction property.

Run `node packages/material/eng/check-data-table.mjs` after building Material. The Material Testbed has a sortable/selectable example under **Containment → Data table**.

### Paginated data table

Import `PaginatedDataTable`, `PaginatedDataTableState`, and `DataTableSource` from `@nelyx/material/widgets`, or use the `paginated-data-table` and `data-table-source` subpaths. See **Containment → Paginated data table** in the Material Testbed.

- Reuse a caller-owned `DataTableSource`: return rows in display order, key them by record identity, and call `notifyListeners()` when rows, counts or selection change. Return `null` for an unloaded row. The table subscribes to the current source, caches requested rows until notified, and detaches without disposing the source.
- `onPageChanged` reports the zero-based first row after navigation. Use `state.pageTo(rowIndex)` for programmatic navigation and a `PageStorageKey` for restoring the current page. If an exact count shrinks past the current page, the view moves to the last valid page without a navigation callback. Approximate counts permit forward navigation while rows are still loading.
- Page size is controlled: use `onRowsPerPageChanged` to update `rowsPerPage` and rebuild. Row selection, select-all, and sorting use the underlying `DataTable` callbacks. Default select-all covers selectable rows on the current page; the header count comes from the entire source.

The footer wraps and offers inline choices rather than Flutter's scrolling footer and dropdown. Pagination labels are English-only. Horizontal table scrolling, Flutter's `controller`/`primary`/`dragStartBehavior` options, and Flutter's exact card/header/footer/last-page spacing are not implemented. Host-native interaction and pixel parity are not verified by the mounted test.

## Expansion panels

Import `ExpansionPanel`, `ExpansionPanelRadio`, and `ExpansionPanelList` from `@nelyx/material/expansion-panel`. Update each regular panel's `isExpanded` in response to `expansionCallback`. With `ExpansionPanelList.radio()`, the list manages one open panel and reports the previous panel closing before the next one opens. Panel height and gaps animate; Flutter's exact cross-fade and merged-surface shadows are not reproduced.

## Stepper

Import `Stepper`, `Step`, `StepState`, and `StepperType` from `@nelyx/material/stepper`. The caller owns `currentStep`; disabled steps do not accept header activation. Use `controlsBuilder` for application-specific Continue and Cancel controls and provide bounded height for a horizontal stepper. Panel height animates, but Flutter's exact cross-fade and error-icon transitions are not reproduced.

## Icons and assets

Import `AnimatedIcon` and `AnimatedIcons` from `@nelyx/material/animated-icons`. Provide a Core `Animation<number>` as `progress`. The painter uses the pinned Flutter tracks for all 14 icons and reads size, color, and opacity from `IconTheme` unless the widget overrides them. Maintain the checked-in tracks in this package and verify changes through playback and reverse playback.

Material Icons metadata is exported from `@nelyx/material/icon-assets`. Declare the exported font and license through the application's `nelyx.assets` configuration, keeping `packageSource` and notice metadata together. See the [SDK asset guide](../../Nelyx/sdk/README.md#assets).

The package includes [MaterialIcons.otf](assets/MaterialIcons.otf) and [its license](licenses/MaterialIcons-LICENSE.txt).

## Build and use

From the repository root, after `npm ci`:

```powershell
npm run build:designs
```

Use `npm run build:sdk` for the full package set. Supply and reinstall the selected runner after changing local packages. The Testbed demonstrates components through their public APIs.

## License

Nelyx-authored code uses [BSD-3-Clause](LICENSE.md). Imported Flutter sources and assets retain the notices and source records in [licenses/](licenses/).

## Source framework migration

Version 0.2 uses the canonical Core Source framework. The former `/v2` exports and per-widget native registration APIs have been removed. Custom shapes, painters and layout delegates run their Source hooks. See the [W12 closing summary](../../history/26/11/14/work12-summary.md#현재-구현과-확인-범위) for verified and pending behavior.
