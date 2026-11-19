// SPDX-License-Identifier: BSD-3-Clause
// Reproducible source identity for reviewed, explicitly partial framework ports.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { openFlutterSource } from './flutter-source.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const destination = path.join(import.meta.dirname, 'data/framework-ports.json');
const definitions = [
  [
    'material/search_anchor.dart',
    'search-anchor',
    ['SearchAnchor', 'SearchAnchorChildBuilder', 'SearchBar', 'SearchController', 'SuggestionsBuilder', 'ViewBuilder'],
    'Search bar, anchored or full view, route lifecycle and generation-guarded suggestions. Independent editor bindings share the controller value. Source expansion animation and host input flags await parity.',
    'material',
  ],
  [
    'widgets/raw_menu_anchor.dart',
    'widgets/raw-menu-anchor',
    ['RawMenuOverlayInfo', 'RawMenuAnchorOverlayBuilder', 'RawMenuAnchorChildBuilder', 'RawMenuAnchorOpenRequestedCallback', 'RawMenuAnchorCloseRequestedCallback', 'RawMenuAnchor', 'RawMenuAnchorGroup', 'MenuController', 'DismissMenuAction'],
    'Shared controller, cascade grouping and anchored overlay with Core Overlay, TapRegion and Navigator. The overlay builder receives the transformed anchor bounds.',
  ],
  [
    'material/menu_anchor.dart',
    'menu-anchor',
    ['MenuAnchor', 'MenuAnchorChildBuilder', 'MenuBar', 'MenuItemButton', 'SubmenuButton', 'CheckboxMenuButton', 'RadioMenuButton'],
    'Material panels and actions using the shared menu controller, focus scope, selection, and anchored layout. Intrinsic sizing, shortcuts and native motion await parity.',
    'material',
  ],
  [
    'widgets/bottom_navigation_bar_item.dart',
    'widgets/bottom-navigation-bar-item',
    ['BottomNavigationBarItem'],
    'Shared navigation-bar item and active icon default used by Cupertino.',
  ],
  [
    'cupertino/bottom_tab_bar.dart',
    'bottom-tab-bar',
    ['CupertinoTabBar'],
    'Dynamic theme, localized tabs, safe area and blur over Core input and painting.',
    'cupertino',
  ],
  [
    'cupertino/tab_scaffold.dart',
    'tab-scaffold',
    ['CupertinoTabScaffold', 'CupertinoTabController', 'RestorableCupertinoTabController'],
    'Controller selection, retained lazy tab subtrees, focus, media insets and restoration over shared Core state.',
    'cupertino',
  ],
  [
    'cupertino/tab_view.dart',
    'tab-view',
    ['CupertinoTabView'],
    'Independent named route stacks and active-tab Back behavior on Core Navigator. Observer callbacks use the Core transition event API.',
    'cupertino',
  ],
  [
    'widgets/routes.dart',
    'widgets/navigation',
    ['LocalHistoryEntry'],
    'Route-local history entries over the owning NavigatorController and existing Back dispatch.',
  ],
  [
    'material/action_buttons.dart',
    'action-buttons',
    [
      'BackButton', 'BackButtonIcon', 'CloseButton', 'CloseButtonIcon',
      'DrawerButton', 'DrawerButtonIcon', 'EndDrawerButton', 'EndDrawerButtonIcon',
    ],
    'Platform-default artwork and labels, ActionIconTheme overrides and default Navigator or Scaffold actions.',
    'material',
  ],
  [
    'material/drawer.dart',
    'drawer',
    ['Drawer', 'DrawerAlignment', 'DrawerCallback', 'DrawerController', 'DrawerControllerState'],
    'Material 3 drawer surface, directional overlay, local history, drag and focus on Core. Pin comparisons for native edge gestures and platform announcement remain open.',
    'material',
  ],
  [
    'material/navigation_drawer.dart',
    'navigation-drawer',
    ['NavigationDrawer', 'NavigationDrawerDestination'],
    'Scrollable Material 3 destinations, headers and footers, selected and disabled styles and localized semantics.',
    'material',
  ],
  [
    'material/animated_icons/animated_icons.dart',
    'animated-icons',
    ['AnimatedIcon', '_AnimatedIconPainter', '_PathFrames', '_PathCommand', '_interpolate'],
    'Pins the widget, icon theme, animation repaint and frame-by-frame vector rendering over Core CustomPaint.',
    'material',
    'material/animated_icons.dart',
  ],
  [
    'material/animated_icons/animated_icons_data.dart',
    'animated-icons',
    ['AnimatedIcons', 'AnimatedIconData', '_AnimatedIconData'],
    'Opaque immutable icon identifiers backed by generated Flutter vector tracks.',
    'material',
    'material/animated_icons.dart',
  ],
  [
    'widgets/navigation_toolbar.dart',
    'widgets/navigation-toolbar',
    ['NavigationToolbar', '_ToolbarLayout'],
    'Directional leading, middle and trailing layout over the Core custom-layout protocol.',
  ],
  [
    'widgets/preferred_size.dart',
    'widgets/preferred-size',
    ['PreferredSizeWidget', 'PreferredSize'],
    'Preferred size metadata and child pass-through.',
  ],
  [
    'widgets/scroll_notification_observer.dart',
    'widgets/scroll-notification-observer',
    ['ScrollNotificationObserver', 'ScrollNotificationObserverState'],
    'Scroll and geometry notifications across sibling subtrees, including listener removal during dispatch.',
  ],
  [
    'widgets/page_view.dart',
    'widgets/page-view',
    [
      'PageController',
      'PageMetrics',
      '_PagePosition',
      '_ForceImplicitScrollPhysics',
      'PageScrollPhysics',
      'PageView',
      '_PageViewState',
    ],
    'Source Scrollable/Viewport/SliverFillViewport, position and physics port. Eighteen pinned-framework geometry/jump/resize, page storage, controller transfer, interruption, padding and empty-list cases are compared; fling, keyed/keep-alive lifetime, physical input and full semantics acceptance remain open.',
  ],
  [
    'widgets/sliver_fill.dart',
    'widgets/sliver-fill',
    [
      'SliverFillViewport',
      '_SliverFillViewportRenderObjectWidget',
      '_SliverFractionalPadding',
      '_RenderSliverFractionalPadding',
    ],
    'Source delegate/child-manager and fractional-padding path. Only the PageView vertical slice is qualified; SliverFillRemaining is not implemented by this module.',
  ],
  [
    'rendering/sliver_fill.dart',
    'rendering/sliver-fill',
    ['RenderSliverFillViewport'],
    'Source fixed-extent adaptor, fraction and implicit visibility. Eighteen PageView cases; not a claim about every sliver or engine boundary.',
  ],
  [
    'rendering/object.dart',
    'rendering/object',
    ['PipelineOwner', 'RenderObject'],
    'Source compositing invalidation/flush and generic repaint-boundary retirement. Three pinned repaint hook observations and twenty boundary/scheduling/resource regressions are checked. Existing layout, lifecycle, input geometry and semantics still require complete original comparison.',
  ],
  [
    'rendering/object.dart',
    'painting/context',
    ['PaintingContext'],
    'Generic pushClipRect, retained/composited path, and Source boundary recording at paintChild. Immediate clip commands and three original repaint hook observations pass; full raster/layer equivalence remains open.',
  ],
  [
    'rendering/viewport.dart',
    'rendering/viewport',
    ['RenderViewportBase', 'RenderViewport', 'RenderShrinkWrappingViewport'],
    'Partial Source viewport layout/paint with the original repaint-boundary getter restored. List/grid and PageView geometry are compared; full viewport lifecycle, semantics and raster acceptance remain open.',
  ],
  [
    'rendering/proxy_box.dart',
    'rendering/repaint-boundary',
    ['RenderRepaintBoundary'],
    'Source paint hooks use generic PaintingContext boundary recording. Image capture rejects dirty recordings; complete image/raster comparison remains open.',
  ],
  [
    'rendering/object.dart',
    'rendering/retained-paint',
    ['PaintingContext'],
    'Host adaptation of PaintingContext boundary recording and refresh. One cache serves the View root, viewports and custom boundaries; twenty scoped lifetime/scheduling/resource regressions and three original repaint hook observations. Not a second layout or Widget owner.',
  ],
  [
    'material/segmented_button.dart',
    'segmented-button',
    ['ButtonSegment', 'SegmentedButton', 'SegmentedButtonState', '_RenderSegmentedButton'],
    'Controlled selection, segment styles and equal sizing on the Core button, focus, render and semantic owners. Source and host parity awaits qualification.',
    'material',
  ],
  [
    'cupertino/sliding_segmented_control.dart',
    'sliding-segmented-control',
    [
      'CupertinoSlidingSegmentedControl',
      '_SlidingSegmentButtonState',
      '_SegmentedControlState',
      '_RenderSegmentedControl',
    ],
    'Controlled selection, dragging, focus and sliding thumb on the Core gesture, ticker, render and semantic owners. Source and host parity awaits qualification.',
    'cupertino',
  ],
  [
    'cupertino/segmented_control.dart',
    'segmented-control',
    [
      'CupertinoSegmentedControl',
      '_SegmentButton',
      '_SegmentButtonState',
      '_SegmentedControlState',
      '_SegmentedControlRenderWidget',
      '_RenderSegmentedControl',
    ],
    'Classic controlled segmented control on Core focus, gesture, animation, layout and semantics. Rounded superellipse and native parity await qualification.',
    'cupertino',
  ],
  [
    'cupertino/picker.dart',
    'picker',
    [
      'CupertinoPicker',
      '_CupertinoPickerState',
      'CupertinoPickerDefaultSelectionOverlay',
      '_CupertinoPickerSemantics',
      '_RenderCupertinoPickerSemantics',
      '_CupertinoPickerListWheelChildDelegateWrapper',
    ],
    'List, builder and looping picker over the generated Core wheel, with adjustable semantics and the Cupertino selection overlay. Flutter and host parity await qualification.',
    'cupertino',
  ],
  [
    'cupertino/search_field.dart',
    'search-field',
    ['CupertinoSearchTextField', '_CupertinoSearchTextFieldState'],
    'Search input over the Cupertino text field and Core editing, focus and restoration owners. Scroll-collapse visuals, cursor and iOS input traits await qualification.',
    'cupertino',
  ],
  [
    'cupertino/dialog.dart',
    'action-sheet',
    ['CupertinoActionSheet', 'CupertinoActionSheetAction'],
    'Action sheet and button composition on Core layout, scrolling and input owners. Pixel and native route parity await qualification.',
    'cupertino',
  ],
  [
    'material/floating_action_button.dart',
    'floating-action-button',
    ['FloatingActionButton'],
    'Material 3 floating action button variants on the shared button and Core Hero owners. Scaffold positioning and full source and host parity await qualification.',
    'material',
  ],
  [
    'material/bottom_sheet.dart',
    'bottom-sheet',
    ['BottomSheet', 'showModalBottomSheet'],
    'Material 3 inline and modal sheet composition on Core navigation, insets and animation. Drag, persistent Scaffold integration and native parity await qualification.',
    'material',
  ],
  [
    'material/data_table.dart',
    'data-table',
    ['DataTable', 'DataColumn', 'DataRow', 'DataCell', 'TableRowInkWell'],
    'Material data rows, cells, sorting and selection over Core table and input owners. Exact rendering and host qualification remain open.',
    'material',
  ],
  [
    'material/navigation_bar.dart',
    'navigation-bar',
    ['NavigationBar', 'NavigationDestination', 'NavigationIndicator'],
    'Material 3 navigation destinations, theme defaults, controlled selection and semantics. Exact source animation and native parity are pending.',
    'material',
  ],
  [
    'material/navigation_rail.dart',
    'navigation-rail',
    ['NavigationRail', 'NavigationRailDestination', '_NavigationRailState'],
    'Material 3 navigation rail with nullable selection, extension animation, destination roles and themed indicators. Source layout detail and all host interactions remain under review.',
    'material',
  ],
  [
    'material/app_bar.dart',
    'app-bar',
    ['AppBar', '_AppBarState', '_PreferredAppBarSize', '_ToolbarContainerLayout'],
    'Material 3 toolbar composition, scroll-under state, preferred sizing and implicit route dismissal. Drawer, sliver and system-bar host effects await qualification.',
    'material',
  ],
  [
    'material/tab_controller.dart',
    'tab-controller',
    ['TabController', 'DefaultTabController', '_TabControllerScope', '_DefaultTabControllerState'],
    'Shared tab selection, ticker ownership, animation and inherited DefaultTabController replacement.',
    'material',
  ],
  [
    'material/constants.dart',
    'constants',
    ['kTabScrollDuration', 'kTabLabelPadding'],
    'Tab spacing and controller duration, using Core EdgeInsets and scheduler milliseconds.',
    'material',
  ],
  [
    'material/tabs.dart',
    'tabs',
    [
      'Tab',
      'TabBar',
      'TabBarView',
      'TabPageSelector',
      'TabPageSelectorIndicator',
      'TabValueChanged',
      '_TabBarState',
      '_TabBarViewState',
      '_IndicatorPainter',
    ],
    'Material 3 primary and secondary tabs, indicator painting and selection on the Core PageView owner.',
    'material',
  ],
  [
    'material/tab_indicator.dart',
    'tab-indicator',
    ['UnderlineTabIndicator', '_UnderlinePainter'],
    'Tab underline decoration on the Core Canvas and BoxPainter owners.',
    'material',
  ],
  [
    'material/time.dart',
    'time',
    [
      'DayPeriod',
      'TimeOfDay',
      'RestorableTimeOfDay',
      'TimeOfDayFormat',
      'HourFormat',
      'hourFormat',
    ],
    'Immutable time-of-day model, original restoration wire order, format classification and pinned Material locale data.',
    'material',
  ],
  [
    'material/time_picker.dart',
    'time-picker',
    ['TimePickerEntryMode', 'TimePickerDialog', '_TimePickerDialogState', 'showTimePicker'],
    'Dial and text time selection, validation, entry mode changes and dialog results. Exact rendering, foldable placement and host feedback await qualification.',
    'material',
  ],
  [
    'material/scaffold.dart',
    'scaffold',
    ['Scaffold', 'ScaffoldState', '_ScaffoldLayout'],
    'Material 3 page layout for app bar, body, bottom navigation bar, keyboard inset and end-float action. Existing positional construction remains available.',
    'material',
  ],
  [
    'material/scaffold.dart',
    'scaffold-messenger',
    [
      'ScaffoldMessenger',
      'ScaffoldMessengerState',
      'ScaffoldFeatureController',
      '_ScaffoldMessengerScope',
    ],
    'Scaffold registration and snack bar queue, animation, timeout and closed results on the shared View owner.',
    'material',
  ],
  [
    'material/snack_bar.dart',
    'snack-bar',
    [
      'SnackBar',
      'SnackBarAction',
      'SnackBarClosedReason',
      '_SnackBarState',
      '_SnackBarActionState',
    ],
    'Material 3 snack bar surface, single-use action, swipe, semantics and fixed and floating layout.',
    'material',
  ],
  [
    'material/expansion_panel.dart',
    'expansion-panel',
    ['ExpansionPanel', 'ExpansionPanelRadio', 'ExpansionPanelList', '_ExpansionPanelListState'],
    'Controlled and radio expansion state over Core Material, layout and animation. Flutter cross-fade, merged surfaces and native parity await qualification.',
    'material',
  ],
  [
    'cupertino/date_picker.dart',
    'timer-picker',
    ['CupertinoTimerPicker', 'CupertinoTimerPickerMode'],
    'Timer modes and change notifications on the shared Cupertino wheel. Full Flutter and native parity await qualification.',
    'cupertino',
  ],
  [
    'cupertino/date_picker.dart',
    'date-picker',
    ['CupertinoDatePicker', 'CupertinoDatePickerMode'],
    'Four date and time modes using the shared date value and wheel controllers. Source font measurement and native parity are pending.',
    'cupertino',
  ],
  [
    'cupertino/localizations.dart',
    'cupertino-localizations',
    ['DatePickerDateOrder', 'DatePickerDateTimeOrder'],
    'Date column ordering and picker labels from the pinned locale tables.',
    'cupertino',
  ],
  [
    'cupertino/route.dart',
    'route',
    ['CupertinoModalPopupRoute', 'showCupertinoModalPopup'],
    'Bottom-aligned popup on the shared Navigator, with the original spring and optional scrim filtering. Foldable placement and native parity are pending.',
    'cupertino',
  ],
  [
    'cupertino/sheet.dart',
    'sheet',
    [
      'showCupertinoSheet',
      'CupertinoSheetRoute',
      'CupertinoSheetTransition',
      '_CupertinoSheetTransitionState',
      '_CupertinoSheetScrollPosition',
      '_CupertinoSheetScope',
    ],
    'Cupertino sheet transitions, provided scroll position, route results and optional nested navigation. Host system-bar effects and exact device presentation await qualification.',
    'cupertino',
  ],
  [
    'cupertino/page_scaffold.dart',
    'page-scaffold',
    [
      'CupertinoPageScaffold',
      'CupertinoPageScaffoldBackgroundColor',
      'ObstructingPreferredSizeWidget',
    ],
    'Opaque and translucent navigation-bar placement, safe padding and keyboard insets with Core MediaQuery. Native status-bar tapping and full host parity remain open.',
    'cupertino',
  ],
  [
    'cupertino/nav_bar.dart',
    'nav-bar',
    ['CupertinoNavigationBar'],
    'Fixed-height Cupertino route toolbar with localized implicit navigation controls, bottom slot and translucent backdrop. Expanded and sliver navigation and shared-element route transitions await qualification.',
    'cupertino',
  ],
  [
    'material/paginated_data_table.dart',
    'paginated-data-table',
    ['PaginatedDataTable', 'PaginatedDataTableState'],
    'Paginated Core table layout and source lifecycle. Flutter footer and native parity await qualification.',
    'material',
  ],
  [
    'material/data_table_source.dart',
    'data-table-source',
    ['DataTableSource'],
    'Observable row source using the existing Core notifier.',
    'material',
  ],
  [
    'material/stepper.dart',
    'stepper',
    [
      'Stepper',
      'Step',
      'StepState',
      'StepperType',
      'ControlsDetails',
      'StepStyle',
      '_StepperState',
    ],
    'Controlled stepper on the shared layout, scroll, ink and animation owners. Exact transitions and host parity await qualification.',
    'material',
  ],
  [
    'cupertino/refresh.dart',
    'refresh',
    ['CupertinoSliverRefreshControl', 'RefreshIndicatorMode'],
    'Refresh state machine and asynchronous lifecycle on Core overscroll and sliver geometry. Native effects and pinned navigation combinations await qualification.',
    'cupertino',
  ],
];
const options = {};
let mode;
for (let i = 2; i < process.argv.length; ++i) {
  const key = process.argv[i];
  if (['--check', '--write'].includes(key) && !mode) mode = key;
  else if (
    ['--source', '--dart'].includes(key) &&
    !options[key] &&
    process.argv[i + 1] &&
    !process.argv[i + 1].startsWith('--')
  )
    options[key] = process.argv[++i];
  else
    throw Error(
      'Usage: framework-ports.mjs --source <Flutter Git repository> --dart <Dart executable> --check|--write',
    );
}
if (!mode || !options['--source'] || !options['--dart'])
  throw Error('Explicit source, Dart executable and mode are required');
const deadline = Date.now() + 1_200_000;
const hash = (value) => createHash('sha256').update(value).digest('hex');
const source = openFlutterSource(options['--source']);
const parent = path.join(root, '.tmp');
fs.mkdirSync(parent, { recursive: true });
const temporary = fs.mkdtempSync(path.join(parent, 'framework-ports-'));
function removeTemporary() {
  if (path.dirname(temporary) !== parent || fs.lstatSync(temporary).isSymbolicLink())
    throw Error('Framework port input owner differs');
  fs.rmSync(temporary, { recursive: true, force: true });
}
try {
  const files = [...new Set(definitions.map(([file]) => 'packages/flutter/lib/src/' + file))];
  for (const file of files) {
    const output = path.join(temporary, file);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, source.read(file));
  }
  const parsed = spawnSync(
    options['--dart'],
    [path.join(import.meta.dirname, 'dart/bin/source_units.dart'), temporary, ...files],
    {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
      timeout: Math.max(1, deadline - Date.now()),
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  if (parsed.error || parsed.status !== 0)
    throw Error('Pinned source declaration analysis failed: ' + (parsed.error ?? parsed.stderr));
  const units = JSON.parse(parsed.stdout).units;
  const origins = definitions.flatMap(([part, target, symbols, scope, designPackage, library]) => {
    const file = 'packages/flutter/lib/src/' + part;
    if (library) {
      const relative = path.posix.relative(path.posix.dirname(library), part);
      const owner = source.text('packages/flutter/lib/src/' + library);
      if (!owner.split('\n').includes(`part '${relative}';`))
        throw Error('Original library does not own the part: ' + file);
    }
    const unit = units.find((unit) => unit.source === file),
      text = source.text(file);
    if (!unit || unit.rawSha256 !== hash(text) || unit.parseDiagnostics.length)
      throw Error('Original declaration identity differs: ' + file);
    return symbols.map((symbol) => {
      const declaration = unit.symbols.find((entry) => entry.name === symbol);
      if (
        !declaration ||
        hash(text.slice(declaration.offset, declaration.offset + declaration.length)) !==
          declaration.spanSha256
      )
        throw Error('Original declaration span differs: ' + symbol);
      const kind = {
        ClassDeclarationImpl: 'CLASS',
        EnumDeclarationImpl: 'ENUM',
        FunctionDeclarationImpl: 'FUNCTION',
        GenericTypeAliasImpl: 'TYPE_ALIAS',
        VariableDeclarationImpl: 'TOP_LEVEL_VARIABLE',
      }[declaration.kind];
      if (!kind) throw Error('Unsupported port declaration kind: ' + declaration.kind);
      const qualifiedId =
        'package:flutter/' +
        'src/' +
        (library ?? part) +
        '::' +
        symbol +
        ':' +
        kind;
      const output = designPackage
        ? `packages/${designPackage}/src/${target}.ts`
        : `Nelyx/src/framework/${target}.ts`;
      return {
        id: hash(qualifiedId + '\0' + output).slice(0, 20),
        qualifiedId,
        package: `@nelyx/${designPackage ?? 'core'}`,
        source: {
          file,
          pin: source.revision,
          gitBlob: source.blob(file),
          fileSha256: hash(text),
          canonicalSpan: {
            offset: declaration.offset,
            length: declaration.length,
            line: text.slice(0, declaration.offset).split('\n').length,
            sha256: declaration.spanSha256,
            encoding: 'UTF-16 indices, LF line endings',
          },
        },
        destination: {
          file: output,
          module: designPackage
            ? `@nelyx/${designPackage}/${target}`
            : `@nelyx/core/framework/${target}`,
          sha256: hash(fs.readFileSync(path.join(root, output))),
        },
        mode: 'manual-port',
        status: 'PARTIAL',
        scope,
        acceptance: [],
      };
    });
  });
  const output =
    JSON.stringify(
      {
        schema: 'nelyx.framework-ports/v1',
        pin: source.revision,
        coverageStatus:
          'Identity and explicitly partial port scope. This does not promote original or product acceptance.',
        origins,
      },
      null,
      2,
    ) + '\n';
  if (mode === '--write') fs.writeFileSync(destination, output);
  else if (fs.readFileSync(destination, 'utf8') !== output)
    throw Error(
      'Framework port source or destination identity differs; review the changes before refreshing provenance',
    );
  console.log(
    'FRAMEWORK_PORTS',
    JSON.stringify({ result: 'PASS-identity', pin: source.revision, declarations: origins.length }),
  );
} finally {
  removeTemporary();
}
