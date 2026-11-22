// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { execute } from '../../../Nelyx/sdk/tooling/cli/src/commands.mjs';
import { FlutterError } from '@nelyx/core/foundation/flutter-error';
import { ValueNotifier } from '@nelyx/core/foundation/notifier';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { nullableDartType } from '@nelyx/core/foundation/dart-type-witness';
import { ResourceRegistry } from '@nelyx/core/hosting/resources';
import { FrameDiagnostics, releaseSceneFrameSource } from '@nelyx/core/ui/frame';
import { Offset } from '@nelyx/core/ui/offset';
import { freezeTextInput } from '@nelyx/core/ui/text';
import { flattenSemantics } from '@nelyx/core/framework/semantics/semantics';
import { Element } from '@nelyx/core/framework/widgets/framework';
import { FrameworkRoot } from '@nelyx/core/framework/widgets/root';
import { Directionality } from '@nelyx/core/framework/widgets/app-data';
import { Column, SizedBox, SliverToBoxAdapter } from '@nelyx/core/framework/widgets/basic';
import { ListenableBuilder } from '@nelyx/core/framework/widgets/listenable-builder';
import { ScrollController } from '@nelyx/core/framework/widgets/scroll-controller';
import { CustomScrollView } from '@nelyx/core/framework/widgets/scroll-view';
import { WidgetState, WidgetStateProperty } from '@nelyx/core/framework/widgets/widget-state';
import {
  captureSourceMouseCursor,
  sourceMouseCursorType,
} from '@nelyx/core/framework/widgets/widget-state-mouse-cursor';
import { SystemMouseCursors } from '@nelyx/core/services/mouse-cursor';
import { KeyDownEvent, KeyUpEvent } from '@nelyx/core/services/hardware-keyboard';
import { LogicalKeyboardKey, PhysicalKeyboardKey } from '@nelyx/core/services/keyboard-key';
import { MaterialApp } from '@nelyx/material/app';
import { Material } from '@nelyx/material/material';
import { RangeSlider } from '@nelyx/material/range-slider';
import { Slider } from '@nelyx/material/slider';
import { RangeLabels, RangeValues } from '@nelyx/material/range-slider-values';
import {
  RoundedRectRangeSliderTrackShape,
  RoundRangeSliderTickMarkShape,
} from '@nelyx/material/slider-shapes';
import { ShowValueIndicator, SliderTheme, SliderThemeData } from '@nelyx/material/slider-theme';

if (!process.argv.includes('--child')) {
  await execute(process.execPath, [import.meta.filename, ...process.argv.slice(2), '--child'], {
    timeout: 1_200_000,
  });
  process.exit(0);
}
const baseline = process.argv.includes('--baseline');
FoundationPlatform.configure({ kind: 'native', operatingSystem: 'windows' });
FlutterError.onError = ({ exception }) => {
  throw exception;
};

function fixture(
  custom,
  stateful,
  {
    track = new RoundedRectRangeSliderTrackShape(),
    showValueIndicator = null,
    divisions = null,
    tickShape = null,
    single = false,
  } = {},
) {
  let at = 0,
    sequence = 0,
    semantics = [],
    status = 'open';
  const counts = {
    widgets: 0,
    sliderBuilds: 0,
    layout: 0,
    semantics: 0,
    indicatorBuilds: 0,
    labelCalls: 0,
    paragraphs: 0,
  };
  const owner = { id: 'range-hover', generation: 1 };
  const resources = new ResourceRegistry();
  const font = resources.allocateId('font');
  resources.register({ ...font, kind: 'font' }, () => {});
  const controller = new ScrollController();
  const options = new ValueNotifier({
    singleValue: 0.25,
    values: new RangeValues(0.25, 0.75),
    labels: new RangeLabels('lower', 'upper'),
    direction: 'ltr',
  });
  const theme = new SliderThemeData({
    rangeTrackShape: track,
    rangeTickMarkShape: tickShape,
    showValueIndicator,
  });
  const cursor = stateful
    ? WidgetStateProperty.resolveWith(nullableDartType(sourceMouseCursorType), (states) =>
        captureSourceMouseCursor(
          states.contains(WidgetState.hovered) ? SystemMouseCursors.text : SystemMouseCursors.click,
        ),
      )
    : null;
  const clock = { now: () => at };
  const text = {
    layout(raw) {
      const input = freezeTextInput(raw);
      if (/^(lower|upper)/.test(input.text)) counts.paragraphs++;
      const resource = resources.allocateId('paragraph');
      resources.register({ ...resource, kind: 'paragraph' }, () => {});
      const width = Math.min(input.width, input.text.length * 7);
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
  };
  const metrics = {
    logicalWidth: 340,
    logicalHeight: 170,
    physicalWidth: 340,
    physicalHeight: 170,
    scale: 1,
    viewportGeneration: 1,
    rendererGeneration: 1,
    nativeContextGeneration: null,
    nativeSurfaceGeneration: null,
  };
  const diagnostics = new FrameDiagnostics(clock);
  const view = new FrameworkRoot(
    {
      owner,
      resources,
      assets: new Map(),
      defaultFont: font,
      text,
      clock,
      semantics: {
        capability: 'native-controls',
        bind(nodes) {
          semantics = nodes;
          return {
            update(nodes) {
              semantics = nodes;
            },
            dispose() {},
          };
        },
        dispose() {},
      },
      readMetrics: () => metrics,
      readStatus: () => status,
      requestFrame() {},
      reportError(error) {
        throw error;
      },
    },
    {
      id: owner.id,
      createRoot: () =>
        new MaterialApp({
          home: new Material({
            child: new CustomScrollView({
              controller,
              primary: false,
              slivers: [
                new SliverToBoxAdapter({
                  child: new Column(
                    [
                      new SizedBox(undefined, 80),
                      new SizedBox(
                        220,
                        48,
                        new ListenableBuilder(options, () => {
                          const { values, labels, direction } = options.value;
                          if (single)
                            return new Directionality(
                              direction,
                              new SliderTheme(
                                theme,
                                new Slider({
                                  id: 'single',
                                  value: options.value.singleValue,
                                  label: String(options.value.singleValue),
                                  divisions,
                                  onChanged: (singleValue) => {
                                    if (options.value.acceptChanges !== false)
                                      options.value = { ...options.value, singleValue };
                                  },
                                }),
                              ),
                            );
                          const slider = new RangeSlider({
                            id: 'range',
                            labels,
                            values,
                            divisions,
                            mouseCursor: cursor,
                            onChanged: (values) => {
                              if (options.value.acceptChanges !== false)
                                options.value = { ...options.value, values };
                            },
                          });
                          return new Directionality(
                            direction,
                            custom ? new SliderTheme(theme, slider) : slider,
                          );
                        }),
                      ),
                      new SizedBox(undefined, 300),
                    ],
                    { crossAlign: 'start', mainSize: 'min' },
                  ),
                }),
              ],
            }),
          }),
        }),
    },
  );
  function tick(count = 1, capturePaint = false) {
    let commands;
    for (let i = 0; i < count; i++) {
      at += 16;
      const scene = view.build({
        token: { owner, sequence: ++sequence, metrics },
        resources,
        frameDiagnostics: diagnostics,
      });
      try {
        if (capturePaint && i === count - 1) commands = [...(scene.commands ?? scene)];
      } finally {
        releaseSceneFrameSource(scene);
      }
      assert.equal(diagnostics.drain().overwritten, 0);
    }
    return commands;
  }
  function pointer(device, kind, x, y) {
    view.pointer({
      kind,
      pointer: 1,
      device,
      x,
      y,
      buttons: kind === 'down' || kind === 'move' ? 1 : 0,
      timestamp: at,
      viewportGeneration: 1,
    });
  }
  const mouse = (kind, x, y) => pointer('mouse', kind, x, y);
  function pan(position, dx, dy, count, terminal = 'panZoomEnd') {
    const common = {
      pointer: 7,
      device: 'trackpad',
      x: position.x,
      y: position.y,
      buttons: 0,
      viewportGeneration: 1,
    };
    view.pointer({ ...common, kind: 'panZoomStart', timestamp: at });
    tick();
    for (let n = 1; n <= count; n++) {
      view.pointer({
        ...common,
        kind: 'panZoomUpdate',
        timestamp: at,
        panX: n * dx,
        panY: n * dy,
        deltaX: dx,
        deltaY: dy,
        scale: 1,
        rotation: 0,
      });
      tick();
    }
    view.pointer({ ...common, kind: terminal, timestamp: at });
    tick(5);
  }
  function findSlider(element) {
    if (element.widget instanceof (single ? Slider : RangeSlider)) return element.state;
    for (const child of element.children) {
      const state = findSlider(child);
      if (state) return state;
    }
  }
  tick(4);
  const state = findSlider(view.root);
  const render = state.renderer();
  function countMethod(instance, method, count) {
    const original = instance[method];
    instance[method] = function (...args) {
      counts[count]++;
      return original.apply(this, args);
    };
  }
  countMethod(state, 'build', 'sliderBuilds');
  countMethod(render, 'performLayout', 'layout');
  countMethod(render, 'markNeedsSemanticsUpdate', 'semantics');
  for (const painter of single ? [render.painter] : [render.startLabel, render.endLabel])
    countMethod(painter, 'layout', 'labelCalls');
  if (state.entry) countMethod(state.entry, 'markNeedsBuild', 'indicatorBuilds');
  const rebuild = Element.prototype.rebuild;
  Element.prototype.rebuild = function (...args) {
    if (this.active && this.dirty) counts.widgets++;
    return rebuild.apply(this, args);
  };
  return {
    state,
    render,
    options,
    controller,
    tick,
    mouse,
    pointer,
    hover: (x, y) => mouse('hover', x, y),
    pan,
    measure(run) {
      const before = { ...counts };
      run();
      return Object.fromEntries(Object.keys(counts).map((key) => [key, counts[key] - before[key]]));
    },
    node: (suffix) =>
      flattenSemantics(semantics).find(
        (node) => node.id === (single ? 'single' : `range-${suffix}`),
      ),
    cursor: () =>
      [...view.mouseTracker.states.get(1).annotations.keys()].find((node) => node.onHover)?.cursor
        .kind,
    arrowRight() {
      const key = {
        physicalKey: PhysicalKeyboardKey.arrowRight,
        logicalKey: LogicalKeyboardKey.arrowRight,
        timeStamp: at,
      };
      assert(view.key(new KeyDownEvent(key)));
      view.key(new KeyUpEvent(key));
    },
    close() {
      Element.prototype.rebuild = rebuild;
      status = 'closing';
      view.dispose();
      controller.dispose();
      options.dispose();
      resources.dispose();
    },
  };
}

for (const [custom, stateful] of [
  [false, false],
  [true, false],
  [true, true],
]) {
  const f = fixture(custom, stateful);
  const { state, render, options, controller, tick, hover, measure, node } = f;
  try {
    hover(80, 55);
    tick(3);
    const enter = measure(() => {
      controller.jumpTo(30);
      tick(5);
    });
    assert.equal(f.cursor(), stateful ? 'text' : 'click');
    assert.equal(state.renderer(), render);
    assert.equal(state.hoverStart, false);
    const center = render.localToGlobal(render.centers()[0]);
    const hoverWork = measure(() => {
      for (let n = 0; n < 18; n++) {
        hover(center.x + (n % 2), center.y);
        tick();
      }
    });
    assert(state.hoverStart);
    if (!baseline) {
      assert.equal(state.overlayAnimation.value, 1, 'Repeated moves restarted the overlay');
      assert.equal(hoverWork.widgets, 0, 'Steady hover rebuilt the indicator overlay');
      assert.equal(hoverWork.layout, 0, 'Steady hover relaid out stationary thumbs');
      assert.equal(hoverWork.semantics, 0, 'Steady hover republished stationary thumb semantics');
    }
    const overlayColor = render.model.theme.overlayColor.toARGB32();
    const paintsOverlay = (commands) =>
      commands.some(
        (op) => op.op === 'drawOval' && op.paint.color === overlayColor && op.rect.width > 0,
      );
    if (!baseline)
      assert(paintsOverlay(tick(1, true)), 'The settled hover overlay was not painted');
    const paintVersion = render.paintVersion;
    hover(center.x, center.y);
    if (!baseline)
      assert.equal(render.paintVersion, paintVersion, 'Unchanged settled hover invalidated paint');
    const exit = measure(() => {
      controller.jumpTo(90);
      tick(18);
    });
    assert(!state.hoverStart && !state.hoverEnd);
    assert(state.overlayAnimation.isDismissed);
    assert.equal(state.renderer(), render);
    assert.notEqual(f.cursor(), stateful ? 'text' : 'click');
    if (!baseline) {
      for (const sample of [enter, hoverWork, exit]) {
        assert.equal(sample.labelCalls, 0);
        assert.equal(sample.paragraphs, 0);
        if (!custom) {
          assert.equal(sample.widgets, 0);
          assert.equal(sample.sliderBuilds, 0);
          assert.equal(sample.layout, 0);
          assert.equal(sample.semantics, 0);
        }
      }
      assert(!paintsOverlay(tick(1, true)), 'The hover overlay remained after exit');
      if (stateful)
        assert(enter.sliderBuilds && exit.sliderBuilds, 'Custom cursor skipped re-resolution');
      else assert.equal(enter.sliderBuilds + exit.sliderBuilds, 0);
    }
    controller.jumpTo(30);
    tick(6);
    const startX = node('start').bounds.x;
    const endX = node('end').bounds.x;
    node('start').rangeActions.setValue(0.35);
    tick(6);
    assert.equal(node('start').numericRange.value, 0.35);
    assert(node('start').bounds.x > startX);
    assert.equal(node('end').bounds.x, endX);
    state.endFocusNode.requestFocus();
    tick(6);
    f.arrowRight();
    tick(6);
    assert.equal(node('end').numericRange.value, 0.8);
    assert(node('end').bounds.x > endX);
    if (!baseline) {
      const pixels = controller.position.pixels;
      f.pan(render.localToGlobal(render.centers()[0]), 0.125, -1.5, 6);
      assert.equal(
        controller.position.pixels,
        pixels + 9,
        'The short vertical pan lost its first deltas',
      );
      assert.equal(node('start').numericRange.value, 0.35);
      assert.equal(node('end').numericRange.value, 0.8);
      f.pan(render.localToGlobal(render.centers()[0]), 6, 0.375, 7);
      assert.equal(
        controller.position.pixels,
        pixels + 9,
        'Cross-axis drift moved the vertical list',
      );
      assert(
        node('start').numericRange.value > 0.35,
        'Horizontal pan must still change the thumb value',
      );

      const beforeCancel = controller.position.pixels;
      const margin = new Offset(180, 20);
      f.pan(margin, 0, -6, 7, 'cancel');
      assert.equal(controller.position.pixels, beforeCancel + 42, 'Cancel must not fling');
      assert.equal(controller.position.isScrollingNotifier.value, false);
      f.pan(margin, 0, -1.5, 6);
      assert.equal(
        controller.position.pixels,
        beforeCancel + 51,
        'A second pan from the same native contact identity must scroll after cancellation',
      );
      f.pan(margin, 0, -6, 7);
      assert(
        controller.position.pixels > beforeCancel + 93,
        'A normal release must still preserve fling velocity',
      );
      controller.jumpTo(beforeCancel);
      tick(6);
    }
    const labels = measure(() => {
      options.value = { ...options.value, labels: new RangeLabels('lower', 'upper2') };
      tick(6);
    });
    if (!baseline) assert.equal(labels.labelCalls, 1);
    assert(labels.paragraphs > 0);
    const direction = measure(() => {
      options.value = { ...options.value, direction: 'rtl' };
      tick(6);
    });
    assert(direction.labelCalls >= 2);
    const rtlBoundsFollowThumbs = node('start').bounds.x > node('end').bounds.x;
    if (!baseline) assert(rtlBoundsFollowThumbs);
    assert.equal(node('start').textDirection, 'rtl');
    assert.equal(measure(() => render.systemFontsDidChange()).labelCalls, 2);
    console.log(
      JSON.stringify({
        variant: baseline ? 'baseline' : 'candidate',
        custom,
        stateful,
        enter,
        hover: hoverWork,
        exit,
        rtlBoundsFollowThumbs,
      }),
    );
  } finally {
    f.close();
  }
}

if (!baseline) {
  const single = fixture(false, false, {
    single: true,
    divisions: 20,
    showValueIndicator: ShowValueIndicator.alwaysVisible,
  });
  try {
    const { render, options, tick, pointer } = single;
    const indicators = [];
    const paintIndicator = render.paintIndicator.bind(render);
    render.paintIndicator = (context) => {
      indicators.push({ x: render.center(render.rect()).dx, label: render.painter.plainText });
      paintIndicator(context);
    };
    function input(kind, fraction) {
      const rect = render.rect();
      const point = render.localToGlobal(
        new Offset(rect.left + rect.width * fraction, rect.center.dy),
      );
      pointer('touch', kind, point.x, point.y);
    }
    function assertPosition(expected) {
      assert.equal(render.model.visual.position.value, expected);
      assert(!render.model.visual.position.isAnimating);
      assert.equal(single.node().numericRange.value, expected);
    }
    function assertPaintedPosition(expected) {
      indicators.length = 0;
      tick();
      assertPosition(expected);
      assert.deepEqual(indicators.at(-1), {
        x: render.center(render.rect()).dx,
        label: String(expected),
      });
    }

    input('down', 0.25);
    await Promise.resolve();
    tick();
    const dragWork = single.measure(() => {
      input('move', 0.4);
      assertPaintedPosition(0.4);
      input('move', 0.45);
      input('move', 0.4);
      tick();
      assertPosition(0.4);
      input('move', 0.55);
      input('up', 0.55);
      assertPaintedPosition(0.55);
    });
    assert.equal(dragWork.layout, 0, 'Changing the drag value preserves the slider layout');
    assert.equal(dragWork.indicatorBuilds, 0, 'The indicator repaints in its existing overlay');

    options.value = { ...options.value, acceptChanges: false };
    tick();
    input('down', 0.55);
    await Promise.resolve();
    input('move', 0.7);
    input('up', 0.7);
    tick();
    assertPosition(0.55);
    options.value = { ...options.value, singleValue: 0.7 };
    tick();
    assert(render.model.visual.position.isAnimating, 'An external value still animates');
    indicators.length = 0;
    tick();
    assert.equal(indicators.at(-1)?.x, render.center(render.rect()).dx);
    tick(6);
    assertPosition(0.7);
    console.log(JSON.stringify({ singleSlider: 'passed', dragWork }));
  } finally {
    single.close();
  }

  for (const [device, custom, direction, divisions] of [
    ['mouse', false, 'ltr', 20],
    ['mouse', true, 'rtl', 200],
    ['touch', false, 'ltr', 20],
    ['touch', true, 'rtl', 200],
  ]) {
    const f = fixture(custom, false, {
      divisions,
      tickShape: custom ? new RoundRangeSliderTickMarkShape({ tickMarkRadius: 0.1 }) : null,
    });
    const { state, render, options, tick, pointer, node } = f;
    function input(kind, value) {
      const rect = render.inputTrackRect(),
        visual = direction === 'rtl' ? 1 - value : value,
        point = render.localToGlobal(new Offset(rect.left + visual * rect.width, rect.center.dy));
      pointer(device, kind, point.x, point.y);
    }
    function assertThumb(thumb, expected) {
      const isStart = thumb === 'start',
        position = isStart ? state.startPosition : state.endPosition,
        center = render.localToGlobal(render.centers()[isStart ? 0 : 1]),
        { bounds, numericRange } = node(thumb);
      assert.equal(position.value, expected, 'The first frame must paint the accepted drag value');
      assert(!position.isAnimating, 'The dragged thumb must not ease toward the accepted value');
      assert.equal(numericRange.value, expected);
      assert(Math.abs(bounds.x + bounds.width / 2 - center.x) < 0.001);
    }
    try {
      options.value = { ...options.value, direction };
      tick();
      const scroll = f.controller.position.pixels;
      input('down', 0.25);
      await Promise.resolve();
      tick();
      const dragWork = f.measure(() => {
        input('move', 0.4);
        tick();
        assertThumb('start', 0.4);
        assertThumb('end', 0.75);
        tick();
      });
      assert.equal(dragWork.layout, 0, 'Moving the thumb must not relayout its fixed-size box');
      assert.equal(
        dragWork.indicatorBuilds,
        0,
        'Moving the indicator must reuse its overlay entry',
      );

      if (custom) {
        const tickPaths = tick(1, true).filter(
          (command) =>
            command.op === 'drawPath' &&
            command.path.operations.every((item) => item.verb === 'addOval'),
        );
        assert(
          tickPaths.length >= 2 && tickPaths.length < divisions / 4,
          'Dense marks must share path recordings',
        );
        assert(
          tickPaths.reduce((count, command) => count + command.path.operations.length, 0) >=
            divisions - 32,
        );
        assert.equal(
          new Set(tickPaths.map((command) => command.paint.color)).size,
          2,
          'Both sides of the range must be painted',
        );
      }

      input('move', 0.45);
      input('move', 0.4);
      tick();
      assertThumb('start', 0.4);

      input('move', 0.3);
      input('up', 0.3);
      tick();
      assertThumb('start', 0.3);

      input('down', 0.75);
      await Promise.resolve();
      input('move', 0.6);
      tick();
      assertThumb('end', 0.6);
      options.value = { ...options.value, acceptChanges: false };
      input('move', 0.65);
      input('up', 0.65);
      tick();
      assertThumb('end', 0.6);
      assert.equal(f.controller.position.pixels, scroll);

      options.value = { ...options.value, values: new RangeValues(0.3, 0.65) };
      tick();
      assert(state.endPosition.isAnimating, 'An external value change after drag still eases');
      tick(7);
      assertThumb('end', 0.65);
    } finally {
      f.close();
    }
  }

  class MovingTrack extends RoundedRectRangeSliderTrackShape {
    dx = 0;
    getPreferredRect(options) {
      return super.getPreferredRect(options).shift(new Offset(this.dx, 0));
    }
  }
  const track = new MovingTrack();
  const moving = fixture(true, false, { track });
  try {
    const start = moving.node('start').bounds.x,
      end = moving.node('end').bounds.x,
      center = moving.render.localToGlobal(moving.render.centers()[0]);
    moving.hover(center.x, center.y);
    moving.tick();
    track.dx = 12;
    const changed = moving.measure(() => moving.tick(3));
    assert.equal(changed.layout, 0, 'A moved custom track should only change thumb geometry');
    assert.equal(moving.node('start').bounds.x, start + 12);
    assert.equal(moving.node('end').bounds.x, end + 12);
    assert.equal(moving.measure(() => moving.tick(6)).layout, 0);
  } finally {
    moving.close();
  }

  const visible = fixture(true, false, { showValueIndicator: ShowValueIndicator.alwaysVisible });
  try {
    const render = visible.render,
      center = render.localToGlobal(render.centers()[0]),
      paint = render.paintIndicators.bind(render);
    let indicatorPaints = 0;
    render.paintIndicators = (context) => {
      indicatorPaints++;
      paint(context);
    };
    visible.hover(center.x, center.y);
    visible.tick(8);
    assert(render.hasVisibleIndicators);
    assert(indicatorPaints > 0, 'The visible custom indicator must still repaint');
  } finally {
    visible.close();
  }
}
