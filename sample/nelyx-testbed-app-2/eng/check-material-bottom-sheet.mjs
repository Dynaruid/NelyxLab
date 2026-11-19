// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { execute } from '../../../Nelyx/sdk/tooling/cli/src/commands.mjs';
import { FlutterError } from '@nelyx/core/foundation/flutter-error';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { flattenSemantics } from '@nelyx/core/framework/semantics/semantics';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { Builder, SizedBox } from '@nelyx/core/framework/widgets/basic';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { Navigator, NavigatorController, Route } from '@nelyx/core/framework/widgets/navigation';
import { RouteSettings } from '@nelyx/core/framework/widgets/pages';
import { FrameworkRoot } from '@nelyx/core/framework/widgets/root';
import { ResourceRegistry } from '@nelyx/core/hosting/resources';
import { Color } from '@nelyx/core/ui/color';
import { FrameDiagnostics, releaseSceneFrameSource } from '@nelyx/core/ui/frame';
import { MaterialApp } from '@nelyx/material/app';
import { BottomSheet, showModalBottomSheet } from '@nelyx/material/bottom-sheet';
import { BottomSheetThemeData } from '@nelyx/material/bottom-sheet-theme-data';
import { Theme } from '@nelyx/material/theme';
import { ThemeData } from '@nelyx/material/theme-data';
import { showModalBottomSheet as exportedShow } from '@nelyx/material/widgets';

if (!process.argv.includes('--child')) {
  await execute(process.execPath, [import.meta.filename, '--child'], { timeout: 1_200_000 });
  process.exit(0);
}
FoundationPlatform.configure({ kind: 'native', operatingSystem: 'android' });
FlutterError.onError = ({ exception }) => {
  throw exception;
};
assert.equal(exportedShow, showModalBottomSheet);
const outer = new NavigatorController(),
  inner = new NavigatorController();
const modalColor = new Color(0xff235544),
  scrim = new Color(0x67000000);
const theme = new ThemeData({
  bottomSheetTheme: new BottomSheetThemeData({
    modalBackgroundColor: modalColor,
    modalBarrierColor: scrim,
  }),
});
const owner = { id: 'material-sheet-check', generation: 1 };
const resources = new ResourceRegistry();
const font = resources.allocateId('font');
resources.register({ ...font, kind: 'font' }, () => {});
let now = 0,
  sequence = 0,
  origin,
  sheetContext,
  semantics = [],
  inlineCloses = 0;
const clock = { now: () => now };
const frameDiagnostics = new FrameDiagnostics(clock);
let metrics = {
  logicalWidth: 1000,
  logicalHeight: 600,
  physicalWidth: 1000,
  physicalHeight: 600,
  scale: 1,
  viewportGeneration: 1,
  rendererGeneration: 1,
  nativeContextGeneration: null,
  nativeSurfaceGeneration: null,
  environment: {
    safeArea: { top: 30, right: 30, bottom: 20, left: 210 },
    safeAreaSource: 'native',
    keyboardInset: 0,
    keyboardSource: 'native-ime',
    textScale: 1,
  },
};
const inline = new GlobalKey();
let content;
const view = new FrameworkRoot(
  {
    owner,
    resources,
    assets: new Map(),
    defaultFont: font,
    clock,
    paths: { contains: () => true },
    semantics: {
      capability: 'native-controls',
      bind(nodes) {
        semantics = nodes;
        return {
          update: (value) => {
            semantics = value;
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
        navigatorController: outer,
        home: new Theme(
          theme,
          new Navigator(
            inner,
            new Route(
              () =>
                new Builder((context) => {
                  origin = context;
                  return new BottomSheet({
                    showDragHandle: true,
                    onClosing: () => {
                      inlineCloses++;
                    },
                    builder: () => new SizedBox(120, 48, undefined, inline),
                  });
                }),
            ),
          ),
        ),
      }),
  },
);
function tick(ms = 16) {
  now += ms;
  releaseSceneFrameSource(
    view.build({ token: { owner, sequence: ++sequence, metrics }, resources, frameDiagnostics }),
  );
}
function settle() {
  tick();
  tick(300);
  tick();
}
async function retire() {
  settle();
  await Promise.resolve();
  tick();
  assert.equal(content.currentContext, undefined);
}
function rect(key) {
  const render = key.currentContext.findRenderObject();
  const { x, y } = render.localToGlobal({ x: 0, y: 0 });
  return [x, y, render.size.width, render.size.height];
}
function tap(x, y) {
  for (const kind of ['down', 'up'])
    view.pointer({
      kind,
      pointer: 1,
      device: 'mouse',
      x,
      y,
      buttons: kind === 'down' ? 1 : 0,
      timestamp: now,
      viewportGeneration: metrics.viewportGeneration,
    });
}
function open(options = {}) {
  const key = (content = new GlobalKey());
  const result = showModalBottomSheet(origin, {
    builder: (context) => {
      sheetContext = context;
      return new SizedBox(Infinity, Infinity, undefined, key);
    },
    ...options,
  });
  settle();
  return result;
}
try {
  tick();
  const [x, y, width] = rect(inline);
  tap(x + width / 2, y - 24);
  assert.equal(inlineCloses, 1);

  const first = open({
    routeSettings: new RouteSettings({ name: 'choice', arguments: { source: 'test' } }),
  });
  assert.equal(Navigator.of(sheetContext), inner);
  const entry = inner.routes.at(-1);
  assert.equal(entry.name, 'choice');
  assert.equal(entry.argumentsValue.source, 'test');
  assert.equal(entry.route.barrierColor.toARGB32(), scrim.toARGB32());
  assert.equal(Theme.of(sheetContext).bottomSheetTheme.modalBackgroundColor, modalColor);
  assert.deepEqual(rect(content), [180, 262.5, 640, 337.5]);
  assert.deepEqual(MediaQuery.paddingOf(sheetContext), new EdgeInsets(210, 0, 30, 20));
  tap(500, 400);
  assert.equal(inner.routes.length, 2, 'sheet interior must not dismiss or hit the underlay');
  const selection = { saved: false };
  assert.equal(Navigator.of(sheetContext).pop(selection), true);
  assert.equal(await first, selection);
  await retire();

  const second = open({
    barrierLabel: 'Dismiss test sheet',
    scrollControlDisabledMaxHeightRatio: 0.4,
  });
  assert.equal(rect(content)[3], 240);
  assert(flattenSemantics(semantics).some(({ name }) => name === 'Dismiss test sheet'));
  tap(20, 10);
  assert.equal(await second, undefined);
  await retire();

  const last = open({
    useRootNavigator: true,
    isDismissible: false,
    useSafeArea: true,
    isScrollControlled: true,
    constraints: new BoxConstraints(0, 500),
    requestFocus: false,
  });
  assert.equal(Navigator.of(sheetContext), outer);
  assert.equal(outer.routes.at(-1).route.requestFocus, false);
  assert.equal(inner.routes.length, 1);
  assert.deepEqual(rect(content), [340, 30, 500, 570]);
  assert.deepEqual(MediaQuery.paddingOf(sheetContext), new EdgeInsets(0, 0, 0, 20));
  metrics = {
    ...metrics,
    viewportGeneration: metrics.viewportGeneration + 1,
    environment: { ...metrics.environment, keyboardInset: 100 },
  };
  tick();
  assert.deepEqual(rect(content), [340, 30, 500, 470]);
  tap(20, 10);
  assert.equal(outer.routes.length, 2, 'locked barrier must not pop the sheet');
  assert.equal(inlineCloses, 1, 'the route must block underlay interaction');
  assert.equal(await outer.maybePop(), true);
  assert.equal(await last, undefined);
  await retire();

  const withHandle = open({ isDismissible: false, showDragHandle: true });
  const [sheetX, contentTop, contentWidth] = rect(content);
  const controls = flattenSemantics(semantics).map(({ name, role }) => ({ name, role }));
  assert(
    controls.some(({ name, role }) => name === 'Dismiss' && role === 'button'),
    JSON.stringify(controls),
  );
  tap(sheetX + contentWidth / 2, contentTop - 24);
  assert.equal(inner.routes.length, 1, 'handle tap must dismiss the current sheet');
  assert.equal(await withHandle, undefined);
  await retire();
  console.log(
    'Material bottom sheet: inline/modal close, nested/root routes, results, barriers, sizing and safe/IME insets passed',
  );
} finally {
  view.dispose();
  inner.dispose();
  outer.dispose();
}
