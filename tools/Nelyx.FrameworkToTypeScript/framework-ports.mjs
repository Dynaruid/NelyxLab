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
  const origins = definitions.flatMap(([file, target, symbols, scope, designPackage]) => {
    file = 'packages/flutter/lib/src/' + file;
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
      }[declaration.kind];
      if (!kind) throw Error('Unsupported port declaration kind: ' + declaration.kind);
      const qualifiedId =
        'package:flutter/' +
        file.slice('packages/flutter/lib/'.length) +
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
