// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { OriginalWidgetHost } from '../../runtime/engine-client/original.ts';
import { CupertinoButton } from '@nelyx/cupertino/button';
import { CupertinoTheme, CupertinoThemeData } from '@nelyx/cupertino/theme';
import { CupertinoSwitch } from '@nelyx/cupertino/switch';
import { CupertinoSlider } from '@nelyx/cupertino/slider';
import { SliderControl } from '@nelyx/core/framework/widgets/slider-control';
import { Switch } from '@nelyx/material/switch';
import { Theme } from '@nelyx/material/theme';
import { ThemeData } from '@nelyx/material/theme-data';
import { ControlInteraction } from '@nelyx/core/framework/widgets/control-interaction';
import { WidgetState, WidgetStatesController } from '@nelyx/core/framework/widgets/widget-state';
import { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { Focus } from '@nelyx/core/framework/widgets/focus-scope';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import {
  EngineClient,
  EngineError,
  protocol as p,
  packet,
  response,
  body,
  layoutQueryBody,
  keyBody,
  measurementBody,
  commands as c,
} from '../../runtime/engine-client/index.ts';
import {
  State,
  StatefulWidget,
  StatelessWidget,
  InheritedWidget,
  LeafRenderObjectWidget,
  MultiChildRenderObjectWidget,
  ErrorWidget,
} from '@nelyx/core/framework/widgets/framework';
import { GlobalKey, GlobalObjectKey } from '@nelyx/core/framework/widgets/global-key';
import {
  SizedBox,
  Padding,
  Row,
  Expanded,
  Stack,
  ColoredBox,
  Text,
  Column,
  Align,
  Center,
  Positioned,
  ClipRect,
  Transform,
} from '@nelyx/core/framework/widgets/basic';
import { AlignmentDirectional } from '@nelyx/core/framework/painting/alignment';
import {
  ClipRect as CanonicalClipRect,
  ClipRRect,
  ClipOval,
  ClipPath,
} from '@nelyx/core/framework/widgets/clip';
import { CustomClipper } from '@nelyx/core/framework/rendering/clip';
import {
  BorderRadius,
  BorderRadiusDirectional,
} from '@nelyx/core/framework/painting/border-radius';
import { Radius } from '@nelyx/core/ui/radius';
import { Directionality } from '@nelyx/core/framework/widgets/app-data';
import { RenderBox } from '@nelyx/core/framework/rendering/object';
import {
  RenderStack,
  RenderConstrainedBox,
  RenderClip,
  RenderTransform,
} from '@nelyx/core/framework/rendering/boxes';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { FlutterError } from '@nelyx/core/foundation/flutter-error';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { FontWeight, TextDecoration } from '@nelyx/core/ui/typography';
import { Color } from '@nelyx/core/ui/color';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import { ListView } from '@nelyx/core/framework/widgets/scroll-view';
import { ScrollController } from '@nelyx/core/framework/widgets/scroll-controller';
import { ScrollPositionWithSingleContext } from '@nelyx/core/framework/widgets/scroll-position-with-single-context';
import { Curves } from '@nelyx/core/framework/animation/curves';
import { GestureDetector } from '@nelyx/core/framework/widgets/gesture-detector';
import { HitTestBehavior } from '@nelyx/core/framework/rendering/pointer-listener';
import { PointerDeviceKind } from '@nelyx/core/ui/pointer';
import {
  TapDownDetails,
  TapUpDetails,
  TapGestureRecognizer,
} from '@nelyx/core/framework/gestures/tap';
import { HorizontalDragGestureRecognizer } from '@nelyx/core/framework/gestures/monodrag';
import { PointerDownEvent } from '@nelyx/core/framework/gestures/events';
import {
  RawGestureDetector,
  GestureRecognizerFactoryWithHandlers,
} from '@nelyx/core/framework/widgets/raw-gesture-detector';
import { DragStartBehavior } from '@nelyx/core/framework/gestures/recognizer';
import {
  DragDownDetails,
  DragStartDetails,
  DragUpdateDetails,
  DragEndDetails,
} from '@nelyx/core/framework/gestures/drag-details';

class Branch extends MultiChildRenderObjectWidget {
  createRenderObject() {
    return new RenderStack({ textDirection: 'ltr', clipBehavior: 'none' });
  }
}
class HyphenText extends Text {
  constructor(value, mode) {
    super(value);
    this.mode = mode;
  }
  configure(render, context) {
    super.configure(render, context);
    render.config = {
      ...render.config,
      painterOptions: { ...render.config.painterOptions, hyphens: this.mode },
    };
  }
}
export function originalContracts({ using, timeout }) {
  test(
    'native: original Slider State and CupertinoSlider retain controlled callbacks, published geometry and thumb-only hit admission',
    { timeout },
    () =>
      using('native', async (f, transport) => {
        const client = await EngineClient.connect(transport),
          view = await client.openView(1),
          errors = [],
          calls = [];
        const host = new OriginalWidgetHost(view, {
          pollEvents: false,
          platform: { kind: 'native', operatingSystem: 'windows' },
          onError: (error) => errors.push(error),
        });
        const previousFlutterError = FlutterError.onError;
        FlutterError.onError = (details) => errors.push(details.exception);
        const interactions = [],
          poll = view.pollInteractionEvents.bind(view);
        view.pollInteractionEvents = async () => {
          const state = await poll();
          interactions.push(...state.events.filter((event) => event.kind === p.events.gesture));
          return state;
        };
        let context;
        const control = (value = 20, disabled = false) =>
          new Directionality(
            'ltr',
            new SliderControl({
              value,
              min: 10,
              max: 30,
              divisions: 4,
              policy: 'material',
              adjustmentUnit: 0.05,
              label: 'Slider probe',
              geometry: {
                width: 160,
                height: 48,
                trackInset: 10,
                thumbHitRadius: 20,
                minDragExtent: 0,
                expand: true,
              },
              onChanged: disabled ? null : (value) => calls.push(['change', value]),
              onChangeStart: (value) => calls.push(['start', value]),
              onChangeEnd: (value) => calls.push(['end', value]),
              builder: (ctx) => {
                context = ctx;
                return new ColoredBox({ color: 0xff123456 });
              },
            }),
          );
        const prepare = async () => {
          for (let attempt = 0; attempt < 20; ++attempt) {
            await host.flush();
            const state = await f.inspect();
            if (
              state.contentWake ||
              state.preparation ||
              state.document !== state.activeDocument ||
              state.layoutMetrics !== state.metrics
            )
              await f.ready();
            else await f.tick();
            if ((await f.inspect()).renderWake) await f.present();
            await host.pollEvents();
            const frame = await view.semanticsSnapshot();
            if (
              frame.publication &&
              frame.publishedMetrics === frame.metrics &&
              frame.publishedDevice === frame.device &&
              frame.publishedDocument === frame.document
            )
              return frame;
          }
          const s = await view.semanticsSnapshot();
          throw Error(
            'Source Slider did not publish current state: ' +
              JSON.stringify(
                {
                  document: s.document,
                  active: s.activeDocument,
                  published: s.publishedDocument,
                  metrics: s.metrics,
                  publishedMetrics: s.publishedMetrics,
                  device: s.device,
                  publishedDevice: s.publishedDevice,
                  preparation: s.preparation,
                  preparationReady: s.preparationReady,
                  renderWake: s.renderWake,
                  frames: s.frames,
                  publication: s.publication,
                  layoutMetrics: s.layoutMetrics,
                  failedDocument: s.failedDocument,
                  errors,
                },
                (_key, value) => (typeof value === 'bigint' ? String(value) : value),
              ),
          );
        };
        const peer = (frame) =>
          frame.nodes.find((n) => n.semantics?.role === p.semanticsRoles.slider);
        const click = async (x, y) => {
          await f.input('begin', 0, { pointer: true, kind: 'mouse', buttons: 1, x, y });
          await f.input('end', 0, { pointer: true, kind: 'mouse', buttons: 0, x, y });
          await f.tick();
          await host.pollEvents();
        };
        let render;
        try {
          await f.resize(300, 200);
          await host.mount(control());
          render = context.findRenderObject();
          assert.equal(
            render.hasSize,
            false,
            'Unpublished native geometry is never supplied by TS layout',
          );
          assert.throws(
            () => render.size,
            (error) => error.code === 'unpublished-slider-geometry',
          );
          let frame = await prepare();
          assert.deepEqual(render.size, { width: 300, height: 48 });
          assert.equal(render.hasSize, true);
          assert.equal(peer(frame).control, null);
          assert.equal(peer(frame).semantics.value, '50%');
          assert.deepEqual(peer(frame).semantics.range, {
            minimum: 10,
            maximum: 30,
            value: 20,
            smallChange: 5,
            largeChange: 0,
            readOnly: false,
          });
          await click(290, 24);
          assert.deepEqual(
            calls,
            [
              ['start', 20],
              ['change', 30],
              ['end', 30],
            ],
            JSON.stringify(
              {
                interactions,
                geometry: render.hasSize,
                nodes: frame.nodes.map((n) => ({
                  node: n.node,
                  parent: n.parent,
                  width: n.width,
                  height: n.height,
                  bounds: n.bounds,
                  semantics: n.semantics,
                  color: n.color,
                })),
              },
              (_key, value) => (typeof value === 'bigint' ? String(value) : value),
            ),
          );
          frame = await prepare();
          assert.equal(
            peer(frame).semantics.range.value,
            20,
            'Controlled update refusal stays in Source State',
          );
          calls.length = 0;
          await view.semanticAction(peer(frame).node, frame.publication, 'setValue', 0n, 23);
          await host.pollEvents();
          assert.deepEqual(
            calls,
            [
              ['start', 20],
              ['change', 25],
              ['end', 25],
            ],
            'Range requests are quantized by original Source State',
          );
          await f.resize(400, 200);
          await host.pollEvents();
          assert.equal(render.hasSize, false, 'Old metrics cannot answer a Source geometry read');
          assert.throws(
            () => render.globalToLocal({ x: 20, y: 20 }),
            (error) => error.code === 'unpublished-slider-transform',
          );
          frame = await prepare();
          assert.deepEqual(render.size, { width: 400, height: 48 });
          await host.update(control(25, true));
          frame = await prepare();
          calls.length = 0;
          assert.equal(peer(frame).semantics.range.readOnly, true);
          await click(390, 24);
          assert.deepEqual(calls, []);
          await assert.rejects(
            view.semanticAction(peer(frame).node, frame.publication, 'setValue', 0n, 20),
            (error) =>
              error instanceof EngineError && error.status === p.statuses.capabilityMissing,
          );
          await host.update(new SizedBox(1, 1));
          await prepare();
          const apple = (disabled = false) =>
            new Directionality(
              'ltr',
              new CupertinoTheme(
                new CupertinoThemeData(),
                new CupertinoSlider({
                  value: 0.5,
                  divisions: 4,
                  onChanged: disabled ? null : (value) => calls.push(['change', value]),
                  onChangeStart: (value) => calls.push(['start', value]),
                  onChangeEnd: (value) => calls.push(['end', value]),
                }),
              ),
            );
          await host.update(apple());
          frame = await prepare();
          calls.length = 0;
          const slider = peer(frame),
            region = frame.nodes
              .flatMap((n) => n.nativePaint ?? [])
              .find((e) => e.kind === 'hitRegion');
          assert.deepEqual([slider.width, slider.height], [176, 44]);
          assert.deepEqual([region.width, region.height, region.transform[4]], [44, 44, 66]);
          const thumb = frame.nodes
            .flatMap((n) => n.nativePaint ?? [])
            .find((e) => e.kind === 'shape' && e.color === 0xffffffff && e.width === 28);
          assert.deepEqual(
            [thumb.transform[4], thumb.transform[5], thumb.width, thumb.height],
            [74, 8, 28, 28],
          );
          assert.equal(
            frame.nodes.flatMap((n) => n.nativePaint ?? []).filter((e) => e.kind === 'shadow')
              .length,
            3,
          );
          await click(slider.bounds.x + 10, slider.bounds.y + 22);
          assert.deepEqual(
            calls,
            [],
            'Cupertino track clicks cannot bypass the Source thumb hit policy',
          );
          const x = slider.bounds.x + 88,
            y = slider.bounds.y + 22;
          await f.input('begin', 0, { pointer: true, kind: 'mouse', buttons: 1, x, y });
          await f.tick();
          await host.pollEvents();
          await f.input('update', 0, { pointer: true, kind: 'mouse', buttons: 1, x: x + 32, y });
          await f.tick();
          await host.pollEvents();
          await f.input('update', 0, { pointer: true, kind: 'mouse', buttons: 1, x: x + 68, y });
          await f.tick();
          await host.pollEvents();
          await f.input('end', 0, { pointer: true, kind: 'mouse', buttons: 0, x: x + 68, y });
          await f.tick();
          await host.pollEvents();
          assert.equal(calls[0]?.[0], 'start');
          assert.equal(calls.at(-1)?.[0], 'end');
          assert.ok(
            calls.some(
              ([kind, value]) => kind === 'change' && value > 0.5 && Number.isInteger(value * 4),
            ),
            JSON.stringify(calls),
          );
          frame = await prepare();
          assert.equal(peer(frame).semantics.range.value, 0.5);
          await host.update(apple(true));
          frame = await prepare();
          calls.length = 0;
          await click(x, y);
          assert.deepEqual(calls, []);
          const state = await f.inspect();
          assert.ok(state.gestureWork > 0n);
          assert.equal(
            state.controlWork,
            0n,
            'Native control state cannot replace Source Slider State',
          );
          assert.equal(state.transactionWork, BigInt(host.counters.commands));
          assert.equal(host.execution.tsLayoutFallbacks, 0);
          assert.equal(host.execution.appGeometryNodes, 0);
          assert.deepEqual(errors, []);
        } catch (error) {
          const describe = (value) =>
            String(value?.stack ?? value) +
            (value?.errors ? '\n' + value.errors.map(describe).join('\n') : '');
          if (errors.length) throw Error(errors.map(describe).join('\n'), { cause: error });
          throw error;
        } finally {
          FlutterError.onError = previousFlutterError;
          await host.close();
          await client.abort();
        }
        assert.equal(render.hasSize, false);
        assert.throws(
          () => render.size,
          (error) => error.code === 'unpublished-slider-geometry',
        );
      }),
  );
  test(
    'native: original RawGestureDetector rejects custom recognition before native commit and recovers with owned recognizer disposal',
    { timeout },
    () =>
      using('native', async (f, transport) => {
        const client = await EngineClient.connect(transport),
          view = await client.openView(1),
          reports = [],
          host = new OriginalWidgetHost(view, {
            pollEvents: false,
            onError: (error) => reports.push(error),
          }),
          previous = FlutterError.onError;
        let mode = 'canonical',
          callbacks = 0,
          filterCalls = 0;
        const recognizers = [];
        class Probe extends StatelessWidget {
          build(context) {
            const type =
              mode === 'velocity' ? HorizontalDragGestureRecognizer : TapGestureRecognizer;
            return new RawGestureDetector(new SizedBox(80, 40), {
              key: new GlobalObjectKey(mode),
              gestures: new Map([
                [
                  type,
                  new GestureRecognizerFactoryWithHandlers(
                    type,
                    () => {
                      const options = { binding: context.owner.gestureBinding };
                      if (mode === 'buttons')
                        options.allowedButtonsFilter = () => {
                          filterCalls++;
                          return true;
                        };
                      if (mode === 'devices')
                        options.supportedDevices = new Set([PointerDeviceKind.mouse]);
                      if (mode === 'velocity')
                        options.velocityTrackerBuilder = () => {
                          throw Error('Custom velocity must never execute');
                        };
                      const recognizer = new type(options);
                      recognizers.push(recognizer);
                      return recognizer;
                    },
                    (recognizer) => {
                      recognizer.onTap = () => callbacks++;
                      if (mode === 'app-recognition')
                        recognizer.addPointer(new PointerDownEvent({ pointer: 1, buttons: 1 }));
                    },
                  ),
                ],
              ]),
            });
          }
        }
        try {
          FlutterError.onError = () => {};
          await f.resize(100, 80);
          await host.mount(new Probe());
          assert.equal(recognizers[0].isDisposed, false);
          for (const variant of ['buttons', 'devices', 'velocity', 'app-recognition']) {
            mode = variant;
            const before = await f.inspect();
            await assert.rejects(
              host.update(new Probe()),
              variant === 'app-recognition'
                ? /App-gesture-recognition/
                : /custom-raw-gesture-configuration/,
            );
            const after = await f.inspect();
            assert.equal(after.document, before.document);
            assert.equal(after.transactionWork, before.transactionWork);
            assert.equal(callbacks, 0);
            assert.equal(filterCalls, 0);
            await host.update(new SizedBox(1, 1));
            assert.ok(recognizers.every((recognizer) => recognizer.isDisposed));
          }
          mode = 'recovered';
          await host.update(new Probe());
          assert.equal(recognizers.at(-1).isDisposed, false);
          assert.equal(host.execution.tsLayoutFallbacks, 0);
          assert.equal(host.execution.appGeometryNodes, 0);
          assert.equal(host.execution.rejectedFallbacks, 4);
          assert.equal((await f.inspect()).transactionWork, BigInt(host.counters.commands));
        } finally {
          FlutterError.onError = previous;
          await host.close();
          await client.abort();
        }
        assert.ok(recognizers.every((recognizer) => recognizer.isDisposed));
      }),
  );
  test(
    'native: original switches retain controlled values, TypeScript styles and disable/retirement fencing',
    { timeout },
    () =>
      using('native', async (f, transport) => {
        const client = await EngineClient.connect(transport),
          view = await client.openView(1),
          errors = [],
          changes = [];
        const host = new OriginalWidgetHost(view, {
          pollEvents: false,
          platform: { kind: 'native', operatingSystem: 'windows' },
          onError: (error) => errors.push(error),
        });
        const tree = (apple, disabled = false, color = 0xff112233) =>
          new Directionality(
            'ltr',
            apple
              ? new CupertinoTheme(
                  new CupertinoThemeData(),
                  new CupertinoSwitch({
                    value: false,
                    onChanged: disabled ? null : (value) => changes.push(value),
                    semanticLabel: 'Switch probe',
                    inactiveTrackColor: new Color(color),
                  }),
                )
              : new Theme(
                  new ThemeData(),
                  new Switch({
                    value: false,
                    onChanged: disabled ? null : (value) => changes.push(value),
                    semanticLabel: 'Switch probe',
                    inactiveTrackColor: new Color(color),
                  }),
                ),
          );
        const prepare = async () => {
          await host.flush();
          const state = await f.inspect();
          if (state.preparation || state.document !== state.activeDocument) await f.ready();
          else await f.tick();
          if ((await f.inspect()).renderWake) await f.present();
          await host.pollEvents();
          return view.semanticsSnapshot();
        };
        const peer = (frame) => frame.nodes.find((n) => n.semantics?.label === 'Switch probe');
        try {
          await f.resize(300, 200);
          await host.mount(new SizedBox(1, 1));
          for (const apple of [false, true]) {
            await host.update(new SizedBox(1, 1));
            await prepare();
            await host.update(tree(apple));
            let frame = await prepare();
            const target = peer(frame),
              before = changes.length;
            assert.equal(target.semantics.role, p.semanticsRoles.switchControl);
            assert.equal(target.control, null);
            await view.semanticAction(target.node, frame.publication, 'activate');
            await host.pollEvents();
            assert.deepEqual(changes.slice(before), [true]);
            frame = await prepare();
            assert.equal(
              peer(frame).semantics.flags & p.semanticsFlags.checked,
              0,
              'A rejected controlled update keeps the original value',
            );
            await host.update(tree(apple, false, 0xff556677));
            frame = await prepare();
            assert.ok(
              frame.nodes.flatMap((n) => n.nativePaint ?? []).some((e) => e.color === 0xff556677),
              'A TypeScript style change reaches C++ paint without native design policy',
            );
            const x = peer(frame).bounds.x + peer(frame).width / 2,
              y = peer(frame).bounds.y + peer(frame).height / 2;
            await f.input('begin', 0, { pointer: true, kind: 'mouse', buttons: 1, x, y });
            await f.tick();
            await host.pollEvents();
            await host.update(tree(apple, true));
            frame = await prepare();
            assert.ok(peer(frame).semantics.flags & p.semanticsFlags.disabled);
            await f.input('end', 0, { pointer: true, kind: 'mouse', buttons: 0, x, y });
            await f.tick();
            await host.pollEvents();
            assert.equal(
              changes.length,
              before + 1,
              'Disable while held cannot commit a controlled value',
            );
            await host.update(tree(apple));
            frame = await prepare();
            await f.input('begin', 0, { pointer: true, kind: 'mouse', buttons: 1, x, y });
            await f.tick();
            await host.pollEvents();
            await host.update(new SizedBox(1, 1));
            await prepare();
            await f.input('end', 0, { pointer: true, kind: 'mouse', buttons: 0, x, y });
            await f.tick();
            await host.pollEvents();
            assert.equal(
              changes.length,
              before + 1,
              'Retired Switch callbacks cannot run from late terminals',
            );
          }
          const state = await f.inspect();
          assert.equal(state.transactionWork, BigInt(host.counters.commands));
          assert.equal(host.execution.tsLayoutFallbacks, 0);
          assert.equal(host.execution.appGeometryNodes, 0);
          assert.deepEqual(errors, []);
        } finally {
          await host.close();
          await client.abort();
        }
      }),
  );
  test(
    'native: original Focus retains published geometry and key callbacks across GlobalKey moves and retirement',
    { timeout },
    () =>
      using('native', async (f, transport) => {
        const client = await EngineClient.connect(transport),
          view = await client.openView(1),
          errors = [],
          keys = [],
          focusChanges = [],
          node = new FocusNode(),
          key = new GlobalKey('native-focus-move'),
          host = new OriginalWidgetHost(view, {
            pollEvents: false,
            platform: { kind: 'native', operatingSystem: 'windows' },
            onError: (error) => errors.push(error),
          });
        let semanticFocus = 0,
          phase = 'mount';
        const geometryFailures = [];
        const seenFocus = [],
          nativePoll = view.pollInteractionEvents.bind(view);
        view.pollInteractionEvents = async () => {
          const state = await nativePoll();
          seenFocus.push(...state.events.filter((event) => event.kind === p.events.focusChanged));
          return state;
        };
        const tree = (moved = false, enabled = true) => {
          const focus = Transform.rotate(
            new Focus(
              new Semantics({
                child: new SizedBox(60, 40),
                button: true,
                focusable: true,
                label: 'source transformed control',
                onFocus: () => {
                  semanticFocus++;
                  assert.equal(
                    node.hasPrimaryFocus,
                    true,
                    'Semantics callback follows the source focus update',
                  );
                  assert.ok(Number.isFinite(node.rect.left));
                },
              }),
              {
                key,
                focusNode: node,
                canRequestFocus: enabled,
                onFocusChange: (focused) => {
                  focusChanges.push(focused);
                  if (focused) {
                    try {
                      assert.ok(Number.isFinite(node.rect.left));
                    } catch (error) {
                      geometryFailures.push(phase + ': ' + String(error));
                    }
                  }
                },
                onKeyEvent: (_node, event) => {
                  keys.push(event);
                  return 'handled';
                },
              },
            ),
            0.2,
          );
          return new Row(
            [
              new SizedBox(100, 80, moved ? new SizedBox() : focus),
              new SizedBox(100, 80, moved ? focus : new SizedBox()),
            ],
            { mainAxisSize: 'min', crossAxisAlignment: 'start', textDirection: 'ltr' },
          );
        };
        const settle = async (geometry = true) => {
          for (let attempt = 0; attempt < 10; ++attempt) {
            await host.flush();
            let state = await f.inspect();
            if (state.preparation || state.document !== state.activeDocument) await f.ready();
            else await f.tick();
            state = await f.inspect();
            if (state.renderWake) await f.present();
            await host.pollEvents();
            await host.flush();
            state = await f.inspect();
            if (
              state.document === state.publishedDocument &&
              !state.preparation &&
              !state.interactionCount
            ) {
              await host.pollEvents();
              if (geometry) {
                try {
                  assert.ok(Number.isFinite(node.rect.left));
                } catch (error) {
                  if (!String(error).includes('not currently published')) throw error;
                  continue;
                }
              }
              return view.semanticsSnapshot();
            }
          }
          assert.fail('Source focus metadata and C++ publication must settle');
        };
        const checkGeometry = (frame) => {
          const peer = frame.nodes.find((n) => n.semantics?.flags & p.semanticsFlags.focusable),
            target = frame.nodes.find((n) => n.node.slot === peer?.parent.slot);
          assert.ok(target);
          const [a, b, c, d, x, y] = target.matrix;
          assert.deepEqual(
            [node.rect.left, node.rect.top, node.rect.right, node.rect.bottom],
            [
              x,
              y,
              a * target.width + c * target.height + x,
              b * target.width + d * target.height + y,
            ],
            'FocusNode preserves source diagonal-corner geometry using the published native transform',
          );
          assert.deepEqual([node.offset.dx, node.offset.dy], [x, y]);
          assert.deepEqual(
            [node.size.width, node.size.height],
            [node.rect.width, node.rect.height],
          );
          return target;
        };
        try {
          await f.resize(300, 200);
          await host.mount(tree());
          assert.throws(() => node.rect, /not currently published/);
          let frame = await settle();
          const first = checkGeometry(frame),
            oldX = node.offset.dx;
          assert.deepEqual(focusChanges, [false]);
          focusChanges.length = 0;
          node.requestFocus();
          await Promise.resolve();
          await settle();
          assert.equal(node.hasPrimaryFocus, true);
          assert.equal(
            semanticFocus,
            1,
            JSON.stringify(
              {
                seenFocus,
                focus: (await f.inspect()).focus,
                semantics: (await view.semanticsSnapshot()).nodes
                  .filter((n) => n.semantics)
                  .map((n) => ({
                    node: n.node,
                    parent: n.parent,
                    semantics: n.semantics,
                    hasFocus: n.hasFocus,
                  })),
              },
              (_key, value) => (typeof value === 'bigint' ? String(value) : value),
            ),
          );
          assert.deepEqual((await f.inspect()).focus.node, first.node);
          await host.update(tree(true));
          phase = 'moved';
          await host.pollEvents();
          assert.throws(() => node.rect, /not currently published/);
          frame = await settle();
          checkGeometry(frame);
          assert.equal(node.offset.dx, oldX + 100);
          assert.equal(node.hasPrimaryFocus, true);
          await view.focus(null, frame.publication, frame.focus.session, true);
          await settle();
          assert.equal(
            node.hasPrimaryFocus,
            false,
            'A moved binding receives the current native blur callback',
          );
          node.requestFocus();
          phase = 'refocus';
          await settle();
          assert.equal(node.hasPrimaryFocus, true);
          assert.equal(semanticFocus, 2);
          for (const [down, repeat] of [
            [true, false],
            [true, true],
            [false, false],
          ]) {
            frame = await view.semanticsSnapshot();
            await view.request(p.opcodes.key, keyBody(frame.publication, 65, down, 0, repeat));
            await host.pollEvents();
            await settle();
          }
          assert.deepEqual(
            keys.map((event) => event.constructor.name),
            ['KeyDownEvent', 'KeyRepeatEvent', 'KeyUpEvent'],
          );
          await host.update(tree(true, false));
          await settle();
          assert.equal(node.hasPrimaryFocus, false);
          assert.equal((await f.inspect()).focus, null);
          assert.deepEqual(focusChanges, [true, false, true, false]);
          await host.update(new SizedBox());
          await settle(false);
          assert.throws(() => node.rect, /laid-out RenderBox|active Element/);
          assert.deepEqual(errors, []);
          assert.deepEqual(geometryFailures, []);
          assert.equal((await f.inspect()).transactionWork, BigInt(host.counters.commands));
          assert.equal(host.execution.appGeometryNodes, 0);
        } finally {
          await host.close();
          await client.abort();
          node.dispose();
        }
      }),
  );
  test(
    'native: original Cupertino buttons preserve canonical state, theme, activation and frame demand',
    { timeout },
    () =>
      using('native', async (f, transport) => {
        const client = await EngineClient.connect(transport),
          view = await client.openView(1),
          errors = [],
          states = new WidgetStatesController(),
          focus = new FocusNode(),
          filledFocus = new FocusNode(),
          host = new OriginalWidgetHost(view, {
            pollEvents: false,
            platform: { kind: 'native', operatingSystem: 'windows' },
            onError: (e) => errors.push(e),
          });
        let taps = 0,
          pressProgress = 0;
        const prepare = async () => {
          let state = await f.inspect();
          if (state.preparation || state.document !== state.activeDocument) {
            for (let i = 0; i < 30; ++i) {
              state = await f.step();
              if (state.measureRequest) {
                const request = await f.send(p.opcodes.measureRequest);
                const measured = await f.send(
                  p.opcodes.measureResult,
                  measurementBody(request, {
                    width: request.nodes[0].width,
                    height: 24,
                    minimum: 40,
                    maximum: 120,
                    baseline: 18,
                  }),
                );
                assert.equal(
                  measured.status,
                  p.statuses.ok,
                  'provider measurement: ' +
                    JSON.stringify({
                      width: request.nodes[0].width,
                      measurement: request.measurement,
                      events: measured.events,
                    }),
                );
              }
              if (state.preparationReady) break;
            }
            assert.equal(
              state.preparationReady,
              true,
              JSON.stringify(
                {
                  preparation: String(state.preparation),
                  measure: String(state.measureRequest),
                  document: String(state.document),
                  active: String(state.activeDocument),
                  events: state.events,
                },
                (_key, value) => (typeof value === 'bigint' ? String(value) : value),
              ),
            );
          }
          await f.tick();
          if ((await f.inspect()).renderWake) await f.present();
          await host.pollEvents();
          await host.flush();
        };
        const tree = (disabled) =>
          new Directionality(
            'ltr',
            new CupertinoTheme(
              new CupertinoThemeData({ primaryColor: 0xff225588 }),
              new Column(
                [
                  new CupertinoButton({
                    child: new Text('Original button'),
                    onPressed: () => {
                      taps++;
                    },
                    statesController: states,
                    focusNode: focus,
                    enabled: !disabled,
                  }),
                  CupertinoButton.filled({
                    child: new Text('Filled'),
                    focusNode: filledFocus,
                    onPressed: () => {
                      taps++;
                    },
                  }),
                  CupertinoButton.tinted({ child: new Text('Disabled'), onPressed: null }),
                  new ControlInteraction(
                    (_context, visual) => {
                      pressProgress = visual.pressProgress;
                      return new SizedBox(140, 50, new ColoredBox({ color: 0xff6688aa }));
                    },
                    { onPressed: () => {}, requestFocusOnPointer: false },
                  ),
                ],
                { mainAxisSize: 'min', crossAxisAlignment: 'start', textDirection: 'ltr' },
              ),
            ),
          );
        const pump = async (at) => {
          await f.tick(at);
          await host.pollEvents();
          await host.flush();
          await prepare();
        };
        const pointer = async (phase, x, y, hover = false) => {
          await f.input(phase, 0, {
            pointer: true,
            x,
            y,
            kind: 'mouse',
            buttons: hover || phase === 'end' ? 0 : 1,
            hover,
          });
          await f.tick();
          await host.pollEvents();
        };
        try {
          await f.resize(360, 360);
          await host.mount(tree(false));
          await prepare();
          let snapshot = await view.semanticsSnapshot();
          const plain = snapshot.nodes.find((n) => n.semantics?.label === 'Original button'),
            disabled = snapshot.nodes.find((n) => n.semantics?.label === 'Disabled');
          assert.equal(plain.semantics.role, p.semanticsRoles.button);
          assert.ok(disabled.semantics.flags & p.semanticsFlags.disabled);
          assert.equal(disabled.semantics.actions & p.semanticsActions.activate, 0);
          await view.semanticAction(plain.node, snapshot.publication, 'activate');
          await host.pollEvents();
          assert.equal(taps, 1);
          await view.request(p.opcodes.key, keyBody(snapshot.publication, 9));
          await host.pollEvents();
          await Promise.resolve();
          assert.equal(focus.hasPrimaryFocus, true);
          await view.request(
            p.opcodes.key,
            keyBody((await view.semanticsSnapshot()).publication, 13),
          );
          await host.pollEvents();
          assert.equal(taps, 2);
          await prepare();
          snapshot = await view.semanticsSnapshot();
          const manager = focus.context.owner.focus,
            transfers = [],
            changed = () => transfers.push(manager.primaryFocus);
          manager.addListener(changed);
          try {
            await view.focus(
              snapshot.nodes.find((n) => n.semantics?.label === 'Filled').node,
              snapshot.publication,
            );
            await prepare();
            await prepare();
            assert.equal(filledFocus.hasPrimaryFocus, true);
            assert.deepEqual(
              transfers,
              [filledFocus],
              'A native focus transfer notifies the source path once without an intermediate root focus',
            );
          } finally {
            manager.removeListener(changed);
          }
          await pointer('update', 30, 30, true);
          assert.ok(states.value.contains(WidgetState.hovered));
          await pointer('begin', 30, 30);
          assert.ok(states.value.contains(WidgetState.pressed));
          await pointer('end', 30, 30);
          assert.equal(taps, 3);
          assert.equal(states.value.contains(WidgetState.pressed), false);
          await host.update(tree(true));
          await prepare();
          await pointer('begin', 30, 30);
          await pointer('end', 30, 30);
          assert.equal(taps, 3);
          snapshot = await view.semanticsSnapshot();
          const interactions = snapshot.nodes.filter(
              (n) =>
                n.semantics?.role === p.semanticsRoles.group &&
                n.semantics.actions & p.semanticsActions.activate,
            ),
            control = interactions.at(-1),
            y = control.bounds.y + 20;
          await pointer('begin', 30, y);
          await host.flush();
          await pump(1);
          await pump(1.05);
          await pump(1.15);
          assert.ok(
            pressProgress > 0.99,
            'The original AnimationController advances from Content frame demand',
          );
          await pointer('end', 30, y);
          await pump(1.3);
          await pump(1.5);
          assert.equal(pressProgress, 0);
          const native = await f.inspect();
          assert.ok(native.gestureWork > 0n);
          assert.equal(native.transactionWork, BigInt(host.counters.commands));
          assert.equal(host.execution.tsLayoutFallbacks, 0);
          assert.equal(host.execution.appGeometryNodes, 0);
          assert.deepEqual(errors, []);
        } finally {
          await host.close();
          await client.abort();
          states.dispose();
          focus.dispose();
          filledFocus.dispose();
        }
      }),
  );
  test(
    'native: original GestureDetector routes hit testing, tap recognition and semantics through C++',
    { timeout },
    () =>
      using('native', async (f, transport) => {
        const client = await EngineClient.connect(transport),
          view = await client.openView(1),
          receipts = [],
          host = new OriginalWidgetHost(view, {
            pollEvents: false,
            onExecution: (value) => receipts.push(value),
          }),
          callbacks = [];
        let mounted = false;
        const show = async (child) => {
          const widget = new Directionality('ltr', new SizedBox(240, 80, child));
          if (mounted) await host.update(widget);
          else {
            mounted = true;
            await host.mount(widget);
          }
          await f.ready();
          await f.present();
        };
        const advance = async (at) => {
          await f.tick(at);
          for (let i = 0; i < p.limits.frames && (await f.inspect()).holds; ++i) await f.present();
          await host.pollEvents();
        };
        const pointer = async (phase, x, kind = 'touch', options = {}) => {
          await f.input(phase, 0, {
            pointer: true,
            x,
            y: 20,
            kind,
            buttons: phase === 'end' ? 0 : 1,
            ...options,
          });
          await advance();
        };
        const tap = async (x) => {
          await pointer('begin', x);
          await pointer('end', x);
        };
        const paint = () => new ColoredBox({ color: 0xff4488cc });
        try {
          await f.resize(240, 80);
          await show(
            new Row(
              [
                new SizedBox(
                  80,
                  80,
                  new GestureDetector(new SizedBox(), { onTap: () => callbacks.push('empty') }),
                ),
                new SizedBox(
                  80,
                  80,
                  new GestureDetector(paint(), { onTap: () => callbacks.push('paint') }),
                ),
                new SizedBox(
                  80,
                  80,
                  new GestureDetector(new SizedBox(), {
                    onTap: () => callbacks.push('opaque'),
                    behavior: HitTestBehavior.opaque,
                  }),
                ),
              ],
              { mainAxisSize: 'min', crossAxisAlignment: 'start', textDirection: 'ltr' },
            ),
          );
          await tap(20);
          await tap(100);
          await tap(180);
          assert.deepEqual(
            callbacks,
            ['paint', 'opaque'],
            'Default deferToChild must not turn an empty box into a hit',
          );
          let snapshot = await view.semanticsSnapshot();
          const actionNode = snapshot.nodes.find(
            (n) => n.semantics?.actions & p.semanticsActions.activate,
          );
          await view.semanticAction(actionNode.node, snapshot.publication, 'activate');
          await host.pollEvents();
          assert.equal(
            callbacks.length,
            3,
            'A native semantic action invokes the original callback exactly once',
          );
          callbacks.length = 0;
          await show(
            new GestureDetector(paint(), {
              onTap: () => callbacks.push('tap'),
              onDoubleTap: () => callbacks.push('double'),
              onLongPress: () => callbacks.push('long'),
            }),
          );
          await tap(30);
          await advance(0.6);
          assert.deepEqual(callbacks, ['tap']);
          await tap(30);
          await advance(0.7);
          await tap(90);
          assert.deepEqual(
            callbacks,
            ['tap', 'double'],
            'The canonical double-tap tolerance is 100 logical pixels',
          );
          await advance(1);
          await pointer('begin', 30);
          await advance(1.6);
          await pointer('end', 30);
          assert.deepEqual(callbacks, ['tap', 'double', 'long']);
          snapshot = await view.semanticsSnapshot();
          const longNode = snapshot.nodes.find(
            (n) => n.semantics?.actions & p.semanticsActions.longPress,
          );
          await view.semanticAction(longNode.node, snapshot.publication, 'longPress');
          await host.pollEvents();
          assert.deepEqual(callbacks, ['tap', 'double', 'long', 'long']);
          callbacks.length = 0;
          await show(
            new GestureDetector(paint(), {
              onTap: () => callbacks.push('tap'),
              excludeFromSemantics: true,
            }),
          );
          await pointer('begin', 30, 'touch');
          await pointer('update', 40, 'touch');
          await pointer('end', 40, 'touch');
          await pointer('begin', 30, 'mouse');
          await pointer('update', 40, 'mouse');
          await pointer('end', 40, 'mouse');
          assert.deepEqual(callbacks, ['tap'], 'Touch and precise mouse thresholds stay distinct');
          const detailEvents = [];
          class DetailsProbe extends StatefulWidget {
            createState() {
              return new DetailsState();
            }
          }
          class DetailsState extends State {
            pressed = false;
            shade = 0;
            build() {
              return new Padding(
                { left: 20, top: 10 },
                new GestureDetector(
                  new ColoredBox({ color: this.pressed ? 0xff44cc88 + this.shade : 0xff4488cc }),
                  {
                    onTapDown: (value) => {
                      detailEvents.push(value);
                      this.setState(() => {
                        this.pressed = true;
                      });
                    },
                    onTapUp: (value) => {
                      detailEvents.push(value);
                      this.setState(() => {
                        this.pressed = false;
                      });
                    },
                    onTap: () => detailEvents.push('tap'),
                    onTapCancel: () => detailEvents.push('cancel'),
                  },
                ),
              );
            }
          }
          const detailsKey = new GlobalKey('held-original-pointer');
          await show(new DetailsProbe(detailsKey));
          await pointer('begin', 80);
          await host.flush();
          await f.ready();
          await f.present();
          const heldPublication = (await f.inspect()).publication;
          detailsKey.currentState.setState(() => ++detailsKey.currentState.shade);
          await host.flush();
          await f.ready();
          await f.present();
          await pointer('end', 80, 'touch', { publication: heldPublication });
          assert.ok(detailEvents[0] instanceof TapDownDetails);
          assert.ok(detailEvents[1] instanceof TapUpDetails);
          assert.equal(detailEvents[0].kind, PointerDeviceKind.touch);
          assert.deepEqual(
            [
              detailEvents[0].globalPosition.dx,
              detailEvents[0].globalPosition.dy,
              detailEvents[0].localPosition.dx,
              detailEvents[0].localPosition.dy,
            ],
            [80, 20, 60, 10],
          );
          assert.equal(
            detailEvents[2],
            'tap',
            'A pressed-state ACK preserves the capture for up/tap',
          );
          await host.flush();
          await f.ready();
          await f.present();
          await pointer('begin', 80);
          await pointer('cancel', 80);
          assert.equal(detailEvents.at(-1), 'cancel');
          const dragEvents = [];
          await show(
            new Padding(
              { left: 20, top: 10 },
              new GestureDetector(paint(), {
                dragStartBehavior: DragStartBehavior.down,
                onlyAcceptDragOnThreshold: true,
                onVerticalDragDown: (v) => dragEvents.push(v),
                onVerticalDragStart: (v) => dragEvents.push(v),
                onVerticalDragUpdate: (v) => dragEvents.push(v),
                onVerticalDragEnd: (v) => dragEvents.push(v),
              }),
            ),
          );
          await pointer('begin', 80);
          await pointer('update', 80, 'touch', { y: 45 });
          await pointer('update', 85, 'touch', { y: 65 });
          await pointer('end', 85, 'touch', { y: 65 });
          assert.ok(dragEvents[0] instanceof DragDownDetails);
          assert.ok(dragEvents[1] instanceof DragStartDetails);
          assert.ok(dragEvents[2] instanceof DragUpdateDetails);
          assert.ok(dragEvents.at(-1) instanceof DragEndDetails);
          assert.deepEqual(
            [
              dragEvents[1].globalPosition.dx,
              dragEvents[1].globalPosition.dy,
              dragEvents[1].localPosition.dx,
              dragEvents[1].localPosition.dy,
            ],
            [80, 20, 60, 10],
          );
          assert.equal(dragEvents[2].primaryDelta, 25);
          assert.equal(dragEvents[3].primaryDelta, 20);
          assert.equal(dragEvents.at(-1).velocity.pixelsPerSecond.dx, 0);
          assert.ok(Math.abs(dragEvents.at(-1).primaryVelocity - 1750) < 0.01);
          const state = await f.inspect();
          assert.ok(state.gestureWork > 0n);
          assert.equal(BigInt(host.counters.commands), state.transactionWork);
          assert.equal(BigInt(receipts.at(-1).acknowledgedCommands), state.transactionWork);
          assert.equal(receipts.at(-1).appModel, 'original-elements');
          assert.equal(host.execution.tsLayoutFallbacks, 0);
          assert.equal(host.execution.appGeometryNodes, 0);
        } finally {
          await host.close();
          await client.abort();
        }
      }),
  );
  test('native: original ListView and ScrollController drive a bounded C++ list', { timeout }, () =>
    using('native', async (f, transport) => {
      const client = await EngineClient.connect(transport),
        view = await client.openView(1),
        errors = [],
        transfers = [],
        controller = new ScrollController({
          onAttach: (position) => transfers.push(['attach', position]),
          onDetach: (position) => transfers.push(['detach', position]),
        }),
        replacement = new ScrollController({
          initialScrollOffset: 120,
          onAttach: (position) => transfers.push(['replacement-attach', position]),
          onDetach: (position) => transfers.push(['replacement-detach', position]),
        }),
        host = new OriginalWidgetHost(view, { pollEvents: false, onError: (e) => errors.push(e) });
      let builds = 0;
      const pump = async () => {
        await host.flush();
        const state = await f.inspect();
        if (state.preparation || state.document !== state.activeDocument) await f.ready();
        else await f.tick();
        const frame = (await f.inspect()).holds ? await f.present() : await view.layoutSnapshot();
        await host.pollEvents();
        await host.flush();
        return frame;
      };
      try {
        await f.resize(200, 160);
        const screen = (controller) =>
          new Directionality(
            'ltr',
            new SizedBox(
              200,
              160,
              ListView.builder({
                controller,
                itemCount: 1000,
                itemExtent: 20,
                childPolicy: { mode: 'bounded' },
                itemBuilder: (_context, index) => {
                  ++builds;
                  return new SizedBox(
                    200,
                    20,
                    new ColoredBox({ color: index % 2 ? 0xff224466 : 0xff446688 }),
                  );
                },
              }),
            ),
          );
        await host.mount(screen(controller));
        let frame = await pump();
        assert.equal(controller.hasClients, true);
        assert.ok(controller.position instanceof ScrollPositionWithSingleContext);
        assert.equal(controller.position.viewportDimension, 160);
        assert.equal(controller.position.maxScrollExtent, 19840);
        assert.ok(builds < 100, 'The original builder stays bounded');
        const values = [];
        const listener = () => {
          values.push(controller.offset);
          if (controller.offset === 40) controller.jumpTo(60);
        };
        controller.addListener(listener);
        controller.jumpTo(40);
        assert.equal(controller.offset, 60, 'Reentrant original listeners are synchronous');
        assert.deepEqual(values, [40, 60]);
        controller.removeListener(listener);
        frame = await pump();
        frame = await pump();
        assert.equal(frame.nodes.find((n) => n.kind === p.kinds.scrollViewport).offset, 60);
        controller.jumpTo(15007);
        assert.equal(controller.offset, 15007);
        for (let i = 0; i < 12; ++i) {
          frame = await pump();
          if (frame.nodes.find((n) => n.kind === p.kinds.scrollViewport).offset === 15007) break;
        }
        assert.equal(frame.nodes.find((n) => n.kind === p.kinds.scrollViewport).offset, 15007);
        assert.ok(frame.nodes.find((n) => n.list)?.list.items.length <= p.limits.listChildren);
        let finished = false;
        const animation = controller
          .animateTo(15027, { duration: 60, curve: Curves.linear })
          .then(() => {
            finished = true;
          });
        for (let i = 0; i < 15 && !finished; ++i) frame = await pump();
        assert.equal(finished, true, 'The original future completes on native terminal');
        await animation;
        assert.equal(controller.offset, 15027);
        const position = controller.position;
        await host.update(screen(replacement));
        frame = await pump();
        assert.equal(controller.hasClients, false);
        assert.equal(
          replacement.position,
          position,
          'Controller transfer retains the original position',
        );
        assert.equal(
          replacement.offset,
          15027,
          'A replacement initial offset does not reset the view',
        );
        assert.deepEqual(
          transfers.map(([kind]) => kind),
          ['attach', 'detach', 'replacement-attach'],
        );
        assert.ok(transfers.every(([, value]) => value === position));
        await host.update(screen(null));
        await pump();
        assert.equal(replacement.hasClients, false);
        await host.update(screen(controller));
        await pump();
        assert.equal(
          controller.position,
          position,
          'The internal fallback can transfer back to the App controller',
        );
        controller.jumpTo(15047);
        for (let i = 0; i < 8; ++i) {
          frame = await pump();
          if (frame.nodes.find((n) => n.kind === p.kinds.scrollViewport).offset === 15047) break;
        }
        assert.equal(frame.nodes.find((n) => n.kind === p.kinds.scrollViewport).offset, 15047);
        assert.deepEqual(errors, []);
        const state = await f.inspect();
        assert.equal(BigInt(host.counters.commands), state.transactionWork);
        assert.ok(state.transactionWork > 0n);
        assert.equal(host.execution.tsLayoutFallbacks, 0);
        assert.equal(host.execution.appGeometryNodes, 0);
        console.log(
          JSON.stringify({
            profile: 'native',
            consumer: 'original-list-controller-transfer',
            commands: String(state.transactionWork),
            sdkAcknowledged: host.counters.commands,
            offset: controller.offset,
            positionPreserved: controller.position === position,
            tsLayoutFallbacks: host.execution.tsLayoutFallbacks,
            appGeometryNodes: host.execution.appGeometryNodes,
          }),
        );
        await host.close();
        assert.equal(controller.hasClients, false);
      } finally {
        await host.close();
        controller.dispose();
        replacement.dispose();
        await client.abort();
      }
    }),
  );
  for (const profile of ['native', 'single-worker', 'threaded']) {
    test(
      `${profile}: original default clip widgets preserve behavior, directional corner radii, resizing and reject custom queries before commit`,
      { timeout },
      () =>
        using(profile, async (f, transport) => {
          const client = await EngineClient.connect(transport),
            view = await client.openView(1),
            host = new OriginalWidgetHost(view, { pollEvents: false });
          const child = () => new ColoredBox({ color: 0xff123456 });
          let mounted = false,
            queries = 0,
            frame;
          const activate = async (widget) => {
            if (mounted) await host.update(widget);
            else {
              mounted = true;
              await host.mount(widget);
            }
            await f.ready();
            frame = await f.present();
            return frame.nodes.find((n) => n.kind === p.kinds.clip);
          };
          try {
            await f.resize(100, 80);
            for (const [Type, shape, behavior] of [
              [CanonicalClipRect, 'rect', 'hardEdge'],
              [ClipRRect, 'rrect', 'antiAlias'],
              [ClipOval, 'oval', 'antiAlias'],
              [ClipPath, 'rect', 'antiAlias'],
            ]) {
              const clip = await activate(new SizedBox(60, 40, new Type(child())));
              assert.deepEqual([clip.width, clip.height], [60, 40]);
              assert.deepEqual(clip.clipStyle, {
                shape,
                behavior,
                radii: [0, 0, 0, 0, 0, 0, 0, 0],
              });
            }
            const radius = BorderRadiusDirectional.only({
              topStart: Radius.elliptical(4, 6),
              topEnd: Radius.elliptical(8, 10),
              bottomStart: Radius.elliptical(12, 14),
              bottomEnd: Radius.elliptical(16, 18),
            });
            let clip = await activate(
              new Directionality(
                'rtl',
                SizedBox.expand(
                  new ClipRRect(child(), {
                    borderRadius: radius,
                    clipBehavior: 'antiAliasWithSaveLayer',
                  }),
                ),
              ),
            );
            assert.deepEqual(clip.clipStyle.radii, [8, 10, 4, 6, 12, 14, 16, 18]);
            assert.ok(clip.flags & p.nodeFlags.clipSaveLayer);
            const commands = host.counters.commands;
            await f.resize(140, 60);
            await f.ready();
            frame = await f.present();
            clip = frame.nodes.find((n) => n.kind === p.kinds.clip);
            assert.deepEqual([clip.width, clip.height], [140, 60]);
            assert.equal(host.counters.commands, commands);
            assert.deepEqual(clip.clipStyle.radii, [8, 10, 4, 6, 12, 14, 16, 18]);
            clip = await activate(
              new SizedBox(
                60,
                40,
                new ClipRRect(child(), { borderRadius: BorderRadius.all(new Radius(-3, 8)) }),
              ),
            );
            assert.deepEqual(
              clip.clipStyle.radii,
              [0, 8, 0, 8, 0, 8, 0, 8],
              'Source BorderRadius clamps each negative radius component before painting',
            );
            for (const behavior of ['none', 'hardEdge', 'antiAlias', 'antiAliasWithSaveLayer']) {
              clip = await activate(
                new SizedBox(60, 40, new ClipOval(child(), { clipBehavior: behavior })),
              );
              assert.equal(clip.clipStyle.behavior, behavior);
              assert.equal(!!(clip.flags & p.nodeFlags.clipsChildren), behavior !== 'none');
              assert.equal(
                !!(clip.flags & p.nodeFlags.clipSaveLayer),
                behavior === 'antiAliasWithSaveLayer',
              );
            }
            class AppClipper extends CustomClipper {
              getClip() {
                ++queries;
                throw Error('App clip query ran');
              }
              shouldReclip() {
                return true;
              }
            }
            const accepted = host.counters.commands;
            for (const Type of [CanonicalClipRect, ClipRRect, ClipOval, ClipPath]) {
              await assert.rejects(
                host.update(new Type(child(), { clipper: new AppClipper() })),
                /custom-clipper/,
              );
              assert.equal(host.counters.commands, accepted);
            }
            assert.equal(queries, 0);
            assert.equal(frame.transactionWork, BigInt(accepted));
            assert.equal(host.execution.tsLayoutFallbacks, 0);
          } finally {
            await host.close();
            await client.abort();
          }
        }),
    );
    test(
      `${profile}: original ClipRect and affine Transform resolve pivots on C++ layout and resize without App geometry`,
      { timeout },
      () =>
        using(profile, async (f, transport) => {
          const client = await EngineClient.connect(transport),
            view = await client.openView(1),
            host = new OriginalWidgetHost(view, { pollEvents: false });
          const child = () => new ClipRect(new ColoredBox({ color: 0xffab2351 }));
          try {
            await f.resize(100, 80);
            await host.mount(
              SizedBox.expand(Transform.scale(child(), { scale: 2, origin: { x: 5, y: 7 } })),
            );
            await f.ready();
            let frame = await f.present(),
              transform = frame.nodes.find((n) => n.kind === p.kinds.transform),
              clip = frame.nodes.find((n) => n.kind === p.kinds.clip);
            assert.deepEqual([transform.width, transform.height], [100, 80]);
            assert.deepEqual(transform.matrix, [2, 0, 0, 2, -55, -47]);
            assert.deepEqual(clip.matrix, transform.matrix);
            assert.ok(clip.flags & p.nodeFlags.clipsChildren);
            assert.equal(clip.flags & p.nodeFlags.hardEdgeClip, 0);
            const commands = host.counters.commands;
            await f.resize(140, 60);
            await f.ready();
            frame = await f.present();
            transform = frame.nodes.find((n) => n.kind === p.kinds.transform);
            assert.deepEqual(transform.matrix, [2, 0, 0, 2, -75, -37]);
            assert.equal(
              host.counters.commands,
              commands,
              'Resize resolves a new pivot without App setState or geometry reads',
            );
            await host.update(
              new SizedBox(60, 40, Transform.flip(child(), { flipX: true, textDirection: 'rtl' })),
            );
            await f.ready();
            frame = await f.present();
            transform = frame.nodes.find((n) => n.kind === p.kinds.transform);
            assert.deepEqual(transform.matrix, [-1, 0, 0, 1, 60, 0]);
            await host.update(
              new SizedBox(
                60,
                40,
                Transform.scale(child(), {
                  scaleX: -1,
                  alignment: AlignmentDirectional.centerStart,
                  textDirection: 'rtl',
                }),
              ),
            );
            await f.ready();
            frame = await f.present();
            transform = frame.nodes.find((n) => n.kind === p.kinds.transform);
            assert.deepEqual(transform.matrix, [-1, 0, 0, 1, 120, 0]);
            await host.update(Transform.translate(new SizedBox(20, 10), { x: 13, y: 17 }));
            await f.ready();
            frame = await f.present();
            assert.deepEqual(
              frame.nodes.find((n) => n.kind === p.kinds.transform).matrix,
              [1, 0, 0, 1, 13, 17],
            );
            for (const [type, kind] of [
              [RenderClip, p.kinds.clip],
              [RenderTransform, p.kinds.transform],
            ]) {
              class ConfiguredProxy extends MultiChildRenderObjectWidget {
                createRenderObject() {
                  const render =
                    type === RenderClip
                      ? new RenderClip()
                      : new RenderTransform([2, 0, 0, 2, 0, 0]);
                  render.additionalConstraints = new BoxConstraints(30, 30, 20, 20);
                  return render;
                }
              }
              await host.update(new ConfiguredProxy([new ColoredBox({ color: 0xff234567 })]));
              await f.ready();
              frame = await f.present();
              const proxy = frame.nodes.find((n) => n.kind === kind);
              assert.deepEqual(
                [proxy.width, proxy.height],
                [30, 20],
                'Canonical inherited additionalConstraints remain configuration',
              );
            }
            const accepted = host.counters.commands;
            for (const [widget, error] of [
              [
                Transform.scale(child(), { scale: 2, transformHitTests: false }),
                /transform-hit-tests-disabled/,
              ],
              [
                Transform.scale(child(), { scale: 2, filterQuality: 'low' }),
                /transform-filter-quality/,
              ],
              [
                new Transform(child(), [1, 0, 0, 0.01, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
                /transform-non-affine/,
              ],
            ]) {
              await assert.rejects(host.update(widget), error);
              assert.equal(host.counters.commands, accepted);
            }
            assert.equal(frame.transactionWork, BigInt(accepted));
            assert.equal(host.execution.tsLayoutFallbacks, 0);
          } finally {
            await host.close();
            await client.abort();
          }
        }),
    );
    test(
      `${profile}: paragraph options preserve native alignment, nowrap, max-line clipping and atomic rollback`,
      { timeout },
      () =>
        using(profile, async (f, transport) => {
          const client = await EngineClient.connect(transport),
            view = await client.openView(1),
            host = new OriginalWidgetHost(view, { pollEvents: false });
          let request;
          const activate = async (value) => {
            let state;
            for (let i = 0; i < 30; ++i) {
              state = await f.step();
              if (state.measureRequest) {
                request = await f.send(p.opcodes.measureRequest);
                assert.equal(
                  (await f.send(p.opcodes.measureResult, measurementBody(request, value))).status,
                  p.statuses.ok,
                );
              }
              if (state.preparationReady) break;
            }
            assert.equal(state.preparationReady, true);
            await f.tick();
            return f.present();
          };
          try {
            await f.resize(100, 80);
            await host.mount(
              new Align(
                new Text('AB', {
                  textAlign: 'center',
                  locale: 'ko',
                  maxLines: 2,
                  ellipsis: '~',
                  style: new TextStyle({
                    fontSize: 14,
                    height: 1.5,
                    letterSpacing: 2,
                    wordSpacing: 3,
                    leadingDistribution: 'even',
                    fontFamily: 'Nelyx 字体',
                    fontWeight: FontWeight.w500,
                    decoration: TextDecoration.none,
                    decorationColor: 0xff123456,
                  }),
                }),
                { widthFactor: 1, heightFactor: 1 },
              ),
            );
            let frame = await activate({
                width: 100,
                height: 30,
                minimum: 5,
                maximum: 40,
                baseline: 12,
                didExceedMaxLines: true,
              }),
              text = frame.nodes.find((n) => n.kind === p.kinds.paragraph);
            assert.ok(frame.capabilities & p.capabilities.paragraphStyles);
            assert.equal(request.nodes[0].flags & 32, 0);
            assert.deepEqual(
              [text.width, text.height, text.content.x, text.content.width],
              [40, 30, -30, 100],
            );
            assert.deepEqual(text.paragraph, {
              fontFamily: 'Nelyx 字体',
              fontWeight: 500,
              hyphens: 'manual',
              textAlign: 'center',
              wrap: true,
              maxLines: 2,
              locale: 'ko',
              ellipsis: '~',
              height: 1.5,
              letterSpacing: 2,
              wordSpacing: 3,
              halfLeading: true,
              applyHeightToFirstAscent: true,
              applyHeightToLastDescent: true,
            });
            assert.ok(
              text.flags & p.nodeFlags.hardEdgeClip,
              'Max-line overflow clips even when the measured height fits',
            );
            const before = await f.inspect(),
              encoded = c.paragraphOptions(text.node, { locale: 'ko', ellipsis: '~' });
            for (const mutate of [
              (data) => data.setUint32(16, 64, true),
              (data) => data.setUint32(20, 6, true),
              (data) => data.setUint32(24, p.limits.textBytes + 1, true),
              (data) => data.setUint32(28, p.limits.localeBytes + 1, true),
              (data) => data.setFloat64(48, -0.5, true),
              (data) => data.setFloat64(56, -1e6 - 1, true),
              (data) => data.setUint32(72, 1, true),
              (data) => data.setUint8(80, 0xc0),
              (data) => data.setUint8(82, 1),
            ]) {
              const bad = encoded.slice();
              mutate(new DataView(bad.buffer, bad.byteOffset, bad.byteLength));
              await assert.rejects(
                view.commit([c.paint(text.node, 0xffff0000), bad]),
                (error) => error instanceof EngineError,
              );
            }
            const root = frame.nodes.find((n) => n.parent.slot === 0);
            await assert.rejects(
              view.commit([c.paragraphOptions(root.node, {})]),
              (error) => error.status === p.statuses.capabilityMissing,
            );
            const after = await f.inspect();
            assert.equal(after.document, before.document);
            assert.equal(after.transactionWork, before.transactionWork);
            const raw = await transport.exchange(packet(p.opcodes.inspect, view.owner)),
              parsed = response(raw);
            let at =
              p.headerBytes +
              p.stateBytes +
              parsed.nodes.length * p.nodeBytes +
              parsed.events.length * p.eventBytes;
            for (const blob of parsed.blobs) {
              if (blob.type === 11) {
                const bad = raw.slice();
                new DataView(bad.buffer, bad.byteOffset, bad.byteLength).setUint32(
                  at + 24 + 4,
                  6,
                  true,
                );
                assert.throws(() => response(bad), /paragraph options/);
                break;
              }
              at += 24 + Math.ceil(blob.bytes.length / 8) * 8;
            }
            assert.ok(parsed.blobs.some((blob) => blob.type === 11));
            const tree = (textAlign, overflow) =>
              new SizedBox(
                30,
                80,
                new Text('long', { softWrap: false, direction: 'rtl', textAlign, overflow }),
              );
            await host.update(tree('end', 'clip'));
            frame = await activate({
              width: 100,
              height: 20,
              minimum: 5,
              maximum: 100,
              baseline: 15,
            });
            text = frame.nodes.find((n) => n.kind === p.kinds.paragraph);
            assert.equal(
              text.paragraph.fontFamily,
              undefined,
              'Removed font families reset after update',
            );
            assert.equal(text.paragraph.fontWeight, undefined);
            assert.ok(request.nodes[0].flags & 32);
            assert.equal(text.textDirection, 1);
            assert.equal(text.content.x, 0);
            assert.deepEqual([text.width, text.height, text.content.width], [30, 80, 100]);
            assert.ok(text.flags & p.nodeFlags.hardEdgeClip);
            await host.update(tree('start', 'visible'));
            frame = await activate({
              width: 100,
              height: 20,
              minimum: 5,
              maximum: 100,
              baseline: 15,
            });
            text = frame.nodes.find((n) => n.kind === p.kinds.paragraph);
            assert.equal(
              text.content.x,
              0,
              'No-wrap alignment retains TextPainter intrinsic width',
            );
            assert.equal(text.flags & p.nodeFlags.clipsChildren, 0);
            await host.update(
              new SizedBox(
                30,
                80,
                new Text('ellipsis', { softWrap: false, overflow: 'ellipsis', maxLines: 1 }),
              ),
            );
            frame = await activate({
              width: 30,
              height: 18,
              minimum: 5,
              maximum: 100,
              baseline: 12,
              didExceedMaxLines: true,
            });
            text = frame.nodes.find((n) => n.kind === p.kinds.paragraph);
            assert.equal(request.nodes[0].flags & 32, 0);
            assert.equal(text.paragraph.ellipsis, '…');
            assert.equal(text.paragraph.maxLines, 1);
            assert.ok(text.flags & p.nodeFlags.hardEdgeClip);
            for (const mode of ['manual', 'hidden']) {
              await host.update(new SizedBox(30, 80, new HyphenText('soft\u00adhyphen', mode)));
              frame = await activate({
                width: 30,
                height: 36,
                minimum: 5,
                maximum: 100,
                baseline: 12,
              });
              text = frame.nodes.find((n) => n.kind === p.kinds.paragraph);
              assert.equal(text.paragraph.hyphens, mode);
            }
            assert.equal(frame.transactionWork, BigInt(host.counters.commands));
            assert.equal(host.execution.tsLayoutFallbacks, 0);
          } finally {
            await host.close();
            await client.abort();
          }
        }),
    );
    test(
      `${profile}: original plain Text owns only metadata and activates C++ paragraph geometry and overflow`,
      { timeout },
      () =>
        using(profile, async (f, transport) => {
          const client = await EngineClient.connect(transport),
            view = await client.openView(1),
            host = new OriginalWidgetHost(view, { pollEvents: false });
          let source, services, measuredText;
          class CapturedText extends Text {
            make(context) {
              services = context.services;
              return (source = super.make(context));
            }
          }
          const tree = (text = '가 A😀\nsecond', overflow = 'clip') =>
            new DefaultTextStyle(
              new TextStyle({ fontSize: 14, color: 0xff123456 }),
              new SizedBox(80, 12, new CapturedText(text, { textScale: 1.5, overflow })),
            );
          const activate = async (height = 40) => {
            let state;
            for (let step = 0; step < 30; ++step) {
              state = await f.step();
              if (state.measureRequest) {
                const request = await f.send(p.opcodes.measureRequest);
                measuredText = new TextDecoder().decode(
                  request.blobs.find((blob) => blob.type === 1).bytes,
                );
                assert.equal(
                  (
                    await f.send(
                      p.opcodes.measureResult,
                      measurementBody(request, {
                        width: request.nodes[0].width,
                        height,
                        minimum: 10,
                        maximum: 60,
                        baseline: Math.min(16, height),
                      }),
                    )
                  ).status,
                  p.statuses.ok,
                );
              }
              if (state.preparationReady) break;
            }
            assert.equal(state.preparationReady, true);
            await f.tick();
            return f.present();
          };
          try {
            await f.resize(100, 80);
            await host.mount(tree());
            let frame = await activate();
            let paragraph = frame.nodes.find((node) => node.kind === p.kinds.paragraph);
            assert.ok(frame.capabilities & p.capabilities.paragraphLayout);
            assert.equal(paragraph.fontSize, 21);
            assert.equal(paragraph.color, 0xff123456);
            assert.equal(measuredText, '가 A😀\nsecond');
            assert.equal(paragraph.width, 80);
            assert.equal(paragraph.height, 12);
            assert.equal(paragraph.baseline, 16);
            assert.ok(paragraph.flags & p.nodeFlags.clipsChildren);
            assert.ok(paragraph.flags & p.nodeFlags.hardEdgeClip);
            assert.equal(paragraph.semantics.label, '가 A😀\nsecond');
            assert.equal(paragraph.semantics.role, p.semanticsRoles.text);
            assert.equal(source.hasSize, false);
            assert.equal(source.paragraph, undefined);
            assert.equal(services.resources.has(services.defaultFont), true);
            assert.equal(services.text.fontFamily(services.defaultFont), 'NelyxDefault');
            assert.throws(() => source.getDryLayout(new BoxConstraints(0, 80)), /native-owned/);
            assert.throws(() => services.text.layout({}), /synchronous-App-text-layout/);
            await host.update(tree('visible', 'visible'));
            frame = await activate();
            paragraph = frame.nodes.find((node) => node.kind === p.kinds.paragraph);
            assert.equal(paragraph.flags & p.nodeFlags.clipsChildren, 0);
            await host.update(tree('short'));
            frame = await activate(10);
            paragraph = frame.nodes.find((node) => node.kind === p.kinds.paragraph);
            assert.equal(paragraph.flags & p.nodeFlags.clipsChildren, 0);
            await host.update(
              new Align(new CapturedText('loose'), { widthFactor: 1, heightFactor: 1 }),
            );
            frame = await activate();
            paragraph = frame.nodes.find((node) => node.kind === p.kinds.paragraph);
            assert.equal(paragraph.width, 60, 'Original paragraph box shrinks to intrinsic width');
            assert.equal(paragraph.content.width, 100, 'Paint keeps the measured layout width');
            assert.equal(paragraph.content.height, 40);
            assert.equal(paragraph.flags & p.nodeFlags.clipsChildren, 0);
            const queryId = 31n;
            assert.equal(
              (
                await f.send(
                  p.opcodes.layoutQuery,
                  layoutQueryBody(
                    paragraph.node,
                    'dry',
                    { kind: 'finite', min: 0, max: 100 },
                    { kind: 'finite', min: 0, max: 80 },
                  ),
                  { id: queryId },
                )
              ).status,
              p.statuses.pending,
            );
            let query;
            for (let step = 0; step < 30; ++step) {
              const state = await f.step();
              if (state.measureRequest) {
                const request = await f.send(p.opcodes.measureRequest);
                assert.equal(
                  (
                    await f.send(
                      p.opcodes.measureResult,
                      measurementBody(request, {
                        width: request.nodes[0].width,
                        height: 40,
                        minimum: 10,
                        maximum: 60,
                        baseline: 16,
                      }),
                    )
                  ).status,
                  p.statuses.ok,
                );
              }
              query = await f.send(p.opcodes.layoutQueryResult, undefined, { id: queryId });
              if (query.status === p.statuses.ok) break;
            }
            assert.equal(query.status, p.statuses.ok);
            assert.deepEqual(
              [query.layoutQuery.width, query.layoutQuery.height, query.layoutQuery.baseline],
              [60, 40, 16],
            );
            await host.update(
              new Text('styled', {
                style: new TextStyle({
                  backgroundColor: 0xff123456,
                  fontStyle: 'italic',
                  decoration: TextDecoration.underline,
                }),
              }),
            );
            frame = await activate();
            const styled = frame.nodes.find((n) => n.kind === p.kinds.paragraph).paragraph.runs[0];
            assert.deepEqual(
              [styled.backgroundColor, styled.fontStyle, styled.decoration],
              [0xff123456, 'italic', 1],
            );
            const before = await f.inspect();
            for (const options of [
              { overflow: 'fade' },
              { textWidthBasis: 'longestLine' },
              { fontSize: 0 },
              { style: new TextStyle({ fontStyle: 'italic', textBaseline: 'ideographic' }) },
            ])
              await assert.rejects(
                host.update(new Text('unported', options)),
                /paragraph|App-text-style/,
              );
            assert.equal((await f.inspect()).transactionWork, before.transactionWork);
            await host.update(tree('recovered'));
            frame = await activate();
            assert.equal(frame.transactionWork, BigInt(host.counters.commands));
            assert.ok(frame.transactionWork > 0n && frame.layoutWork > 0n);
            assert.equal(host.execution.tsLayoutFallbacks, 0);
            const resources = services.resources,
              font = services.defaultFont;
            await host.close();
            assert.equal(source.debugDisposed, true);
            assert.equal(resources.has(font), false);
          } finally {
            await host.close();
            await client.abort();
          }
        }),
    );
    test(
      `${profile}: original RTL/up Flex placement retains canonical ordering, distribution and overflow`,
      { timeout },
      () =>
        using(profile, async (f, transport) => {
          const client = await EngineClient.connect(transport),
            view = await client.openView(1),
            host = new OriginalWidgetHost(view, { pollEvents: false });
          const child = (width, height, color) =>
            new SizedBox(width, height, new ColoredBox({ color }));
          const cases = [
            ['horizontal', 'start', 'start', 'up', 100, [80, 50, 45, 45]],
            ['horizontal', 'end', 'end', 'down', 100, [35, 50, 0, 45]],
            ['horizontal', 'center', 'center', 'down', 100, [57.5, 25, 22.5, 22.5]],
            ['horizontal', 'spaceBetween', 'start', 'down', 100, [80, 0, 0, 0]],
            ['horizontal', 'spaceAround', 'start', 'down', 100, [68.75, 0, 11.25, 0]],
            ['horizontal', 'spaceEvenly', 'start', 'down', 100, [65, 0, 15, 0]],
            ['vertical', 'start', 'start', 'up', 100, [80, 50, 70, 30]],
            ['vertical', 'end', 'end', 'up', 100, [0, 20, 0, 0]],
            ['horizontal', 'start', 'start', 'down', 40, [35, 0, 0, 0]],
          ];
          try {
            await f.resize(100, 80);
            for (const [
              direction,
              mainAxisAlignment,
              crossAxisAlignment,
              verticalDirection,
              width,
              expected,
            ] of cases) {
              const Type = direction === 'horizontal' ? Row : Column;
              const root = new SizedBox(
                width,
                60,
                new Type([child(20, 10, 0xff112233), child(30, 15, 0xff445566)], {
                  mainAxisSize: 'max',
                  mainAxisAlignment,
                  crossAxisAlignment,
                  textDirection: 'rtl',
                  verticalDirection,
                  spacing: 5,
                }),
              );
              if (host.execution.observed) await host.update(root);
              else await host.mount(root);
              await f.ready();
              const frame = await f.present();
              const a = frame.nodes.find((n) => n.color === 0xff112233),
                b = frame.nodes.find((n) => n.color === 0xff445566);
              assert.deepEqual(
                [a.x, a.y, b.x, b.y],
                expected,
                JSON.stringify({
                  direction,
                  mainAxisAlignment,
                  crossAxisAlignment,
                  verticalDirection,
                  width,
                }),
              );
              assert.deepEqual(
                frame.nodes
                  .filter((n) => n.color === 0xff112233 || n.color === 0xff445566)
                  .map((n) => n.color),
                [0xff112233, 0xff445566],
                'Visual child order remains source order even when placement runs backwards',
              );
            }
            await host.update(
              new SizedBox(
                100,
                60,
                new Row([new Row([child(20, 10, 0xff112233), child(30, 15, 0xff445566)])], {
                  crossAxisAlignment: 'start',
                }),
              ),
            );
            await f.ready();
            const nested = await f.present();
            assert.ok(
              nested.nodes.some((n) => n.color === 0xff112233 && n.width === 20 && n.y === 2.5),
            );
            assert.ok(
              nested.nodes.some((n) => n.color === 0xff445566 && n.width === 30 && n.x === 20),
            );
            const commands = host.counters.commands;
            await assert.rejects(
              host.update(new Row([child(20, 10, 1), child(30, 15, 2)], { textDirection: null })),
              /missing-text-direction/,
            );
            assert.equal(host.counters.commands, commands);
            assert.equal(host.execution.tsLayoutFallbacks, 0);
          } finally {
            await host.close();
            await client.abort();
          }
        }),
    );
    test(
      `${profile}: original Align and Center factors use C++ sizing, placement and intrinsic/dry queries`,
      { timeout },
      () =>
        using(profile, async (f, transport) => {
          const client = await EngineClient.connect(transport),
            view = await client.openView(1),
            host = new OriginalWidgetHost(view, { pollEvents: false });
          const child = () => new SizedBox(20, 10, new ColoredBox({ color: 0xff112233 }));
          try {
            await f.resize(100, 80);
            await host.mount(new Align(child(), { alignment: { x: 0.5, y: -0.5 } }));
            await f.ready();
            let snapshot = await f.present(),
              color = snapshot.nodes.find((n) => n.color === 0xff112233);
            assert.deepEqual([color.x, color.y, color.width, color.height], [60, 17.5, 20, 10]);
            await host.update(new Center(child(), { widthFactor: 2, heightFactor: 3 }));
            await f.ready();
            snapshot = await f.present();
            color = snapshot.nodes.find((n) => n.color === 0xff112233);
            assert.deepEqual([color.x, color.y], [10, 10]);
            const aligned = snapshot.nodes.find(
              (n) => n.kind === p.kinds.box && n.width === 40 && n.height === 30,
            );
            assert.ok(aligned);
            let id = 0n;
            for (const [kind, expected] of [
              ['minWidth', 40],
              ['maxHeight', 30],
              ['dry', null],
            ]) {
              const receipt = await view.request(
                p.opcodes.layoutQuery,
                layoutQueryBody(
                  aligned.node,
                  kind,
                  { kind: 'finite', min: 0, max: 100 },
                  { kind: 'finite', min: 0, max: 80 },
                ),
                ++id,
              );
              assert.equal(receipt.status, p.statuses.pending);
              let result;
              for (let i = 0; i < 20; ++i) {
                await f.step();
                result = await view.request(p.opcodes.layoutQueryResult, new Uint8Array(), id);
                if (result.status !== p.statuses.pending) break;
              }
              assert.equal(result.status, p.statuses.ok);
              if (expected !== null) assert.equal(result.layoutQuery.value, expected);
              else
                assert.deepEqual([result.layoutQuery.width, result.layoutQuery.height], [40, 30]);
            }
            await host.update(
              new Align(child(), { alignment: { x: 2, y: -2 }, widthFactor: 0, heightFactor: 0 }),
            );
            await f.ready();
            color = (await f.present()).nodes.find((n) => n.color === 0xff112233);
            assert.deepEqual([color.x, color.y], [-30, 5]);
            await host.update(new Center());
            await f.ready();
            assert.ok(
              (await f.present()).nodes.some(
                (n) => n.kind === p.kinds.box && n.width === 100 && n.height === 80,
              ),
            );
            await host.update(
              new Row([new Center(child())], { mainAxisSize: 'min', crossAxisAlignment: 'start' }),
            );
            await f.ready();
            color = (await f.present()).nodes.find((n) => n.color === 0xff112233);
            assert.deepEqual([color.x, color.y, color.width, color.height], [0, 35, 20, 10]);
            assert.equal(host.execution.tsLayoutFallbacks, 0);
          } finally {
            await host.close();
            await client.abort();
          }
        }),
    );
    test(
      `${profile}: original multi-child Stack uses numeric alignment and conditional hard-edge clipping`,
      { timeout },
      () =>
        using(profile, async (f, transport) => {
          const client = await EngineClient.connect(transport),
            view = await client.openView(1),
            host = new OriginalWidgetHost(view, { pollEvents: false });
          const root = (x, clipBehavior) =>
            new SizedBox(
              40,
              40,
              new Stack(
                [
                  new SizedBox(20, 10, new ColoredBox({ color: 0xff112233 })),
                  new SizedBox(10, 15, new ColoredBox({ color: 0xff445566 })),
                ],
                { alignment: { x, y: 0 }, clipBehavior },
              ),
            );
          try {
            await f.resize(100, 80);
            await host.mount(root(0.5, 'hardEdge'));
            await f.ready();
            let frame = await f.present(),
              stack = frame.nodes.find((n) => n.kind === p.kinds.stack && n.parent.slot !== 0);
            assert.equal(
              stack.flags & p.nodeFlags.clipsChildren,
              0,
              'A fitting Stack does not clip overflowing child paint',
            );
            await host.update(root(2, 'hardEdge'));
            await f.ready();
            frame = await f.present();
            stack = frame.nodes.find((n) => n.kind === p.kinds.stack && n.parent.slot !== 0);
            assert.ok(stack.flags & p.nodeFlags.clipsChildren);
            assert.ok(stack.flags & p.nodeFlags.hardEdgeClip);
            const green = frame.nodes.find((n) => n.color === 0xff445566);
            assert.deepEqual(
              [green.x, green.y, green.clip.width, green.clip.height],
              [45, 12.5, 40, 40],
            );
            await host.update(root(2, 'none'));
            await f.ready();
            frame = await f.present();
            stack = frame.nodes.find((n) => n.kind === p.kinds.stack && n.parent.slot !== 0);
            assert.equal(stack.flags & p.nodeFlags.clipsChildren, 0);
            assert.equal(frame.nodes.find((n) => n.color === 0xff445566).clip.width, 100);
            await host.update(new Stack([]));
            await f.ready();
            assert.ok(
              (await view.layoutSnapshot()).nodes.some(
                (n) =>
                  n.kind === p.kinds.stack &&
                  n.parent.slot !== 0 &&
                  n.width === 100 &&
                  n.height === 80,
              ),
            );
            await host.update(
              new Row([new Stack([])], { mainAxisSize: 'min', crossAxisAlignment: 'start' }),
            );
            await f.ready();
            assert.ok(
              (await view.layoutSnapshot()).nodes.some(
                (n) =>
                  n.kind === p.kinds.stack &&
                  n.parent.slot !== 0 &&
                  n.width === 0 &&
                  n.height === 0,
              ),
            );
            assert.equal(host.execution.tsLayoutFallbacks, 0);
          } finally {
            await host.close();
            await client.abort();
          }
        }),
    );
    test(
      `${profile}: original viewport readers use versioned Core metrics and selectively rebuild after resize`,
      { timeout },
      () =>
        using(profile, async (f, transport) => {
          const client = await EngineClient.connect(transport),
            view = await client.openView(1),
            host = new OriginalWidgetHost(view, { pollEvents: false }),
            builds = { logicalWidth: 0, logicalHeight: 0, scale: 0 },
            values = new Map();
          class Reader extends StatelessWidget {
            constructor(field, color) {
              super();
              this.field = field;
              this.color = color;
            }
            build(context) {
              // Captured service methods must still track the Element that actually calls them.
              this.read ??= context.services.readMetrics;
              const metrics = this.read(this.field);
              ++builds[this.field];
              values.set(this.field, metrics);
              assert.ok(Object.isFrozen(metrics));
              return new SizedBox(
                this.field === 'logicalWidth' ? metrics.logicalWidth / 2 : 10,
                this.field === 'logicalHeight' ? metrics.logicalHeight / 2 : 10,
                new ColoredBox({ color: this.color }),
              );
            }
          }
          try {
            await f.resize(100, 80);
            await host.mount(
              new Branch([
                new Reader('logicalWidth', 0xff112233),
                new Reader('logicalHeight', 0xff445566),
                new Reader('scale', 0xff778899),
              ]),
            );
            assert.deepEqual(builds, { logicalWidth: 1, logicalHeight: 1, scale: 1 });
            const initial = values.get('logicalWidth');
            assert.equal(initial.logicalWidth, 100);
            assert.equal(initial.physicalWidth, 100);
            assert.equal(initial.nativeContextGeneration, null);
            assert.equal(initial.nativeSurfaceGeneration, null);
            await f.ready();
            let layout = await view.layoutSnapshot();
            assert.ok(layout.nodes.some((n) => n.color === 0xff112233 && n.width === 50));
            const previousLayoutMetrics = layout.layoutMetrics;
            const resized = await f.resize(140, 80);
            assert.deepEqual(resized.viewport, { width: 140, height: 80, scale: 1 });
            assert.ok(resized.metrics > previousLayoutMetrics);
            // App metrics observe the new viewport before a matching layout is activated.
            await host.pollEvents();
            await host.flush();
            assert.deepEqual(builds, { logicalWidth: 2, logicalHeight: 1, scale: 1 });
            assert.equal(values.get('logicalWidth').logicalWidth, 140);
            assert.equal(initial.logicalWidth, 100, 'Previously returned metrics stay immutable');
            await f.ready();
            layout = await view.layoutSnapshot();
            assert.equal(layout.layoutMetrics, resized.metrics);
            assert.ok(layout.nodes.some((n) => n.color === 0xff112233 && n.width === 70));
            const scaled = await view.request(
              p.opcodes.metrics,
              body(40, (v) => {
                v.setBigUint64(0, resized.metrics + 1n, true);
                v.setFloat64(8, 140, true);
                v.setFloat64(16, 80, true);
                v.setFloat64(24, 2, true);
                v.setBigUint64(32, resized.lastInput, true);
              }),
            );
            assert.equal(scaled.status, p.statuses.ok);
            await host.pollEvents();
            await host.flush();
            assert.deepEqual(builds, { logicalWidth: 2, logicalHeight: 1, scale: 2 });
            assert.equal(values.get('scale').physicalWidth, 280);
            assert.equal(values.get('scale').physicalHeight, 160);
            await host.pollEvents();
            await host.flush();
            assert.deepEqual(builds, { logicalWidth: 2, logicalHeight: 1, scale: 2 });
            assert.equal(host.execution.tsLayoutFallbacks, 0);
            const bytes = await transport.exchange(packet(p.opcodes.inspect, view.owner));
            assert.equal(response(bytes).viewport.scale, 2);
            for (const [field, value] of [
              [p.stateFields.viewportWidth, NaN],
              [p.stateFields.viewportHeight, -1],
              [p.stateFields.viewportScale, 0],
              [p.stateFields.viewportScale, 17],
            ]) {
              const invalid = bytes.slice();
              new DataView(invalid.buffer, invalid.byteOffset, invalid.byteLength).setFloat64(
                p.headerBytes + field,
                value,
                true,
              );
              assert.throws(() => response(invalid), /scalar|viewport/);
            }
            let current = scaled;
            for (const [width, height, scale] of [
              [140.25, 80.25, 1.5],
              [0, 0, 1.5],
              [100, 80, 1],
            ]) {
              current = await view.request(
                p.opcodes.metrics,
                body(40, (v) => {
                  v.setBigUint64(0, current.metrics + 1n, true);
                  v.setFloat64(8, width, true);
                  v.setFloat64(16, height, true);
                  v.setFloat64(24, scale, true);
                  v.setBigUint64(32, current.lastInput, true);
                }),
              );
              assert.equal(current.status, p.statuses.ok);
              await host.pollEvents();
              await host.flush();
              const observed = values.get('logicalWidth');
              assert.equal(observed.logicalWidth, width);
              assert.equal(observed.physicalWidth, Math.round(width * scale));
              assert.equal(observed.physicalHeight, Math.round(height * scale));
            }
            await f.ready();
            assert.equal((await view.layoutSnapshot()).layoutMetrics, current.metrics);
          } finally {
            await host.close();
            await client.abort();
          }
        }),
    );
    test(
      `${profile}: original App update reentrancy is serialized and immediate close prevents build admission`,
      { timeout },
      () =>
        using(profile, async (f, transport) => {
          let transactions = 0;
          const counted = {
            exchange(bytes) {
              if (
                new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(
                  p.headerFields.opcode,
                  true,
                ) === p.opcodes.transaction
              )
                ++transactions;
              return transport.exchange(bytes);
            },
            close: () => transport.close(),
          };
          const client = await EngineClient.connect(counted),
            view = await client.openView(1),
            host = new OriginalWidgetHost(view, { pollEvents: false });
          let builds = 0,
            reentered;
          class Reentrant extends StatelessWidget {
            build() {
              ++builds;
              reentered = host.update(new SizedBox(40, 10, new ColoredBox({ color: 0xff123456 })));
              return new SizedBox(10, 5);
            }
          }
          try {
            await f.resize(100, 80);
            await host.mount(new Reentrant());
            await reentered;
            await f.ready();
            const layout = await view.layoutSnapshot();
            assert.equal(builds, 1);
            assert.ok(
              layout.nodes.some((n) => n.color === 0xff123456 && n.width === 40 && n.height === 10),
            );
            await host.close();
            const previousTransactions = transactions;
            const closedHost = new OriginalWidgetHost(await client.openView(2), {
              pollEvents: false,
            });
            const pending = closedHost.mount(new Reentrant());
            await closedHost.close();
            await pending;
            assert.equal(builds, 1, 'Closing before queued work starts cannot call App build');
            assert.equal(transactions, previousTransactions);
            await assert.rejects(closedHost.mount(new SizedBox(1, 1)), /closed/);
          } finally {
            await host.close();
            await client.abort();
          }
        }),
    );
    test(
      `${profile}: unported original standard widgets cannot become an empty native success`,
      { timeout },
      () =>
        using(profile, async (f, transport) => {
          const client = await EngineClient.connect(transport),
            view = await client.openView(1),
            reports = [],
            host = new OriginalWidgetHost(view, {
              pollEvents: false,
              onError: (error) => reports.push(error),
            }),
            previous = FlutterError.onError;
          try {
            FlutterError.onError = () => {};
            await f.resize(100, 80);
            await assert.rejects(
              host.mount(new Text('Unported original text', { overflow: 'fade' })),
            );
            assert.equal(host.execution.observed, false);
            assert.equal((await view.request(p.opcodes.inspect)).transactionWork, 0n);
            let layouts = 0;
            class EarlyLayout extends LeafRenderObjectWidget {
              createRenderObject() {
                const render = new RenderConstrainedBox();
                render.performLayout = (constraints) => {
                  ++layouts;
                  return constraints.smallest;
                };
                render.layout(new BoxConstraints(0, 100, 0, 80));
                return render;
              }
            }
            await assert.rejects(host.update(new EarlyLayout()), /synchronous-render-layout/);
            assert.equal(
              layouts,
              0,
              'A creation hook cannot run TS layout before metadata ownership is attached',
            );
            assert.equal((await view.request(p.opcodes.inspect)).transactionWork, 0n);
            await host.update(new SizedBox(20, 10));
            assert.equal(
              host.execution.observed,
              true,
              'A rejected original build can recover through a supported native tree',
            );
          } finally {
            FlutterError.onError = previous;
            await host.close();
            await client.abort();
          }
        }),
    );
    test(
      `${profile}: original State/GlobalObjectKey/context reparent through actual C++ nodes without TS layout`,
      { timeout },
      () =>
        using(profile, async (f, transport) => {
          const client = await EngineClient.connect(transport),
            view = await client.openView(1),
            host = new OriginalWidgetHost(view, { pollEvents: false }),
            trace = [],
            values = [],
            identity = {};
          class Theme extends InheritedWidget {
            constructor(value, child) {
              super(child);
              this.value = value;
            }
            updateShouldNotify(old) {
              return old.value !== this.value;
            }
          }
          class Probe extends StatefulWidget {
            createState() {
              return new ProbeState();
            }
          }
          class ProbeState extends State {
            count = 0;
            initState() {
              trace.push('init');
            }
            didChangeDependencies() {
              trace.push('dependencies');
            }
            didUpdateWidget(old) {
              assert.notEqual(this.widget, old);
              trace.push('update');
            }
            deactivate() {
              trace.push('deactivate');
            }
            activate() {
              trace.push('activate');
            }
            dispose() {
              trace.push('dispose');
            }
            build(context) {
              assert.equal(context, this.context);
              assert.equal(context.findAncestorWidgetOfExactType(Theme), context.dependOn(Theme));
              values.push(context.dependOn(Theme).value);
              return new SizedBox(20 + this.count, 10);
            }
          }
          const key = () => new GlobalObjectKey(identity, ProbeState),
            scene = (value, moved) =>
              new Theme(
                value,
                new Branch([
                  new Branch(moved ? [] : [new Probe(key())]),
                  new Branch(moved ? [new Probe(key())] : []),
                ]),
              );
          try {
            await f.resize(160, 100);
            await host.mount(scene(1, false));
            const state = key().currentState,
              element = key().currentElement,
              render = element.findRenderObject();
            assert.ok(state instanceof ProbeState);
            assert.equal(key().currentContext, element);
            assert.equal(key().currentWidget, state.widget);
            state.setState(() => ++state.count);
            assert.equal(
              state.count,
              1,
              'The original setter mutates synchronously before native ACK',
            );
            await host.flush();
            await f.ready();
            await f.present();
            const before = await view.layoutSnapshot(),
              leaf = before.nodes.find(
                (node) => node.width === 21 && node.height === 10 && node.kind === p.kinds.box,
              );
            assert.ok(leaf);
            await host.update(scene(2, true));
            await f.ready();
            await f.present();
            const after = await view.layoutSnapshot(),
              moved = after.nodes.find(
                (node) => node.width === 21 && node.height === 10 && node.kind === p.kinds.box,
              );
            assert.deepEqual(
              moved.node,
              leaf.node,
              'Native node identity follows the original reparented render object',
            );
            assert.equal(key().currentState, state);
            assert.equal(key().currentElement, element);
            assert.equal(values.at(-1), 2);
            assert.equal(trace.filter((item) => item === 'init').length, 1);
            assert.ok(trace.includes('deactivate') && trace.includes('activate'));
            assert.equal(
              render.hasSize,
              false,
              'Native publication is never misreported as a TS layout',
            );
            assert.throws(() => render.size, /laid|size/i);
            assert.throws(
              () => render.layout(new BoxConstraints(0, 100, 0, 100)),
              /fallback is forbidden/,
            );
            assert.throws(() => render.getMinIntrinsicWidth(10), /fallback is forbidden/);
            assert.throws(() => render.hitTest({ x: 1, y: 1 }, []), /fallback is forbidden/);
            assert.equal(BigInt(host.execution.acknowledgedCommands), after.transactionWork);
            assert.ok(after.layoutWork > 0n);
            assert.equal(host.execution.tsLayoutFallbacks, 0);
            assert.equal(host.execution.appGeometryNodes, 0);
            assert.equal(host.execution.compatibility, 'partial');
            await host.close();
            await host.close();
            assert.equal(key().currentState, undefined);
            assert.equal(trace.filter((item) => item === 'dispose').length, 1);
            assert.throws(() => state.setState(() => {}), /dispose/);
            console.log(
              'W9_ORIGINAL_NATIVE ' +
                JSON.stringify({
                  profile,
                  appOwner: 'canonical-elements',
                  acknowledgedCommands: host.counters.commands,
                  cppCommands: String(after.transactionWork),
                  cppLayout: String(after.layoutWork),
                  reparentIdentity: true,
                  tsLayoutFallbacks: 0,
                  synchronousGeometry: 'unavailable',
                  compatible: false,
                }),
            );
          } finally {
            await host.close();
            await client.abort();
          }
        }),
    );

    test(
      `${profile}: original padding/tight proxy/Expanded constraints are laid out by C++`,
      { timeout },
      () =>
        using(profile, async (f, transport) => {
          const client = await EngineClient.connect(transport),
            view = await client.openView(1),
            host = new OriginalWidgetHost(view, { pollEvents: false });
          try {
            await f.resize(200, 100);
            await host.mount(
              new SizedBox(
                100,
                60,
                new Padding(
                  { left: 10, top: 5, right: 20, bottom: 15 },
                  new Row(
                    [
                      new Expanded(new ColoredBox({ color: 0xff2468ac, child: new SizedBox() })),
                      new SizedBox(20, 10),
                    ],
                    { mainAxisSize: 'max', crossAxisAlignment: 'stretch' },
                  ),
                ),
              ),
            );
            await f.ready();
            await f.present();
            const state = await view.layoutSnapshot(),
              nodes = state.nodes;
            assert.ok(nodes.some((node) => node.width === 100 && node.height === 60));
            assert.ok(nodes.some((node) => node.width === 70 && node.height === 40));
            assert.ok(nodes.some((node) => node.width === 50 && node.height === 40));
            assert.ok(
              nodes.some(
                (node) => node.width === 50 && node.height === 40 && node.color === 0xff2468ac,
              ),
            );
            assert.ok(nodes.some((node) => node.width === 20 && node.height === 40));
            assert.equal(BigInt(host.counters.commands), state.transactionWork);
            assert.equal(host.execution.appGeometryNodes, 0);
            await host.update(new SizedBox(80, 50, new Stack([new SizedBox()], { fit: 'expand' })));
            await f.ready();
            await f.present();
            const expanded = await view.layoutSnapshot();
            assert.equal(expanded.nodes.at(-1).width, 80);
            assert.equal(expanded.nodes.at(-1).height, 50);
          } finally {
            await host.close();
            await client.abort();
          }
        }),
    );

    test(
      `${profile}: original NACK keeps immediate App state and defers disposal until ACK; build exceptions use the original ErrorWidget hook`,
      { timeout },
      () =>
        using(profile, async (f, transport) => {
          let reject = false;
          const client = await EngineClient.connect({
              exchange(bytes) {
                if (
                  reject &&
                  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(
                    p.headerFields.opcode,
                    true,
                  ) === p.opcodes.transaction
                ) {
                  reject = false;
                  bytes = bytes.slice();
                  new DataView(bytes.buffer).setUint16(p.headerBytes, 0xffff, true);
                }
                return transport.exchange(bytes);
              },
              close: () => transport.close?.(),
            }),
            view = await client.openView(1),
            reports = [],
            trace = [],
            host = new OriginalWidgetHost(view, {
              pollEvents: false,
              onError: (error) => reports.push(error),
            }),
            key = new GlobalKey(),
            oldBuilder = ErrorWidget.builder,
            oldReporter = FlutterError.onError;
          class Probe extends StatefulWidget {
            createState() {
              return new ProbeState();
            }
          }
          class ProbeState extends State {
            count = 0;
            build() {
              if (this.count) throw Error('original-build-failure');
              return new SizedBox(20, 10);
            }
            dispose() {
              trace.push('dispose');
            }
          }
          try {
            FlutterError.onError = () => {};
            ErrorWidget.builder = () => new SizedBox(17, 13);
            await f.resize(100, 80);
            await host.mount(new Probe(key));
            await f.ready();
            await f.present();
            const state = key.currentState;
            state.setState(() => ++state.count);
            assert.equal(state.count, 1);
            await host.flush();
            await f.ready();
            await f.present();
            assert.ok(
              (await view.layoutSnapshot()).nodes.some(
                (node) => node.width === 17 && node.height === 13,
              ),
            );
            assert.equal(reports.length, 1);
            const document = view.documentEpoch,
              before = await view.layoutSnapshot();
            reject = true;
            await assert.rejects(
              host.update(new SizedBox(30, 20)),
              (error) => error instanceof EngineError,
            );
            assert.equal(view.documentEpoch, document);
            assert.equal((await view.layoutSnapshot()).activeDocument, before.activeDocument);
            assert.equal(state.count, 1);
            assert.equal(state.mounted, true);
            assert.equal(trace.length, 0, 'NACK cannot finalize a retired original State');
            await host.update(new Probe(key));
            assert.equal(
              key.currentState,
              state,
              'A root GlobalKey can retake its inactive State after NACK',
            );
            assert.equal(key.currentElement.active, true);
            assert.equal(trace.length, 0);
            await host.update(new SizedBox(31, 20));
            assert.deepEqual(trace, ['dispose']);
            assert.equal(state.mounted, false);
            await f.ready();
            await f.present();
            assert.equal(
              BigInt(host.counters.commands),
              (await view.layoutSnapshot()).transactionWork,
            );
          } finally {
            ErrorWidget.builder = oldBuilder;
            FlutterError.onError = oldReporter;
            await host.close();
            await client.abort();
          }
        }),
    );

    test(
      `${profile}: unported original protected render hooks reject without running TS layout or paint`,
      { timeout },
      () =>
        using(profile, async (f, transport) => {
          const client = await EngineClient.connect(transport),
            view = await client.openView(1),
            host = new OriginalWidgetHost(view, { pollEvents: false });
          let layouts = 0,
            paints = 0,
            disposed = 0;
          class CustomRender extends RenderBox {
            performLayout(c) {
              ++layouts;
              return c.smallest;
            }
            paint(c) {
              ++paints;
              super.paint(c);
            }
            dispose() {
              ++disposed;
              super.dispose();
            }
          }
          class CustomWidget extends LeafRenderObjectWidget {
            createRenderObject() {
              return new CustomRender();
            }
          }
          try {
            await f.resize(100, 80);
            await assert.rejects(
              host.mount(new CustomWidget()),
              /custom-or-unported-render-object/,
            );
            assert.equal(layouts, 0);
            assert.equal(paints, 0);
            assert.equal(host.execution.observed, false);
            assert.equal(host.execution.rejectedFallbacks, 1);
            await host.update(new SizedBox(20, 10));
            assert.equal(disposed, 1);
            await f.ready();
            assert.equal(host.execution.observed, true);
            const commands = host.counters.commands;
            assert.throws(() => host.update({}), /foreign-original-widget-identity/);
            await assert.rejects(
              host.update(new Stack([new Positioned(new SizedBox(2, 2), { left: 1 })])),
              /stack-positioned-child/,
            );
            class InstanceHook extends LeafRenderObjectWidget {
              createRenderObject() {
                const render = new RenderConstrainedBox();
                render.performLayout = (c) => {
                  ++layouts;
                  return c.smallest;
                };
                return render;
              }
            }
            await assert.rejects(host.update(new InstanceHook()), /instance-render-hook/);
            assert.equal(layouts, 0);
            assert.equal(
              host.counters.commands,
              commands,
              'Rejected App metadata cannot become native work or a TS fallback',
            );
          } finally {
            await host.close();
            await client.abort();
          }
          assert.equal(disposed, 1);
        }),
    );
  }
}
