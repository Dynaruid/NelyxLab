// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/widgets/app.dart and widget_inspector.dart
// @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { ValueNotifier } from '../../foundation/notifier.ts';
import { Canvas } from '../../ui/canvas.ts';
import type { Offset, Size } from '../../ui/geometry.ts';
import { Paint } from '../../ui/paint.ts';
import { Rect } from '../../ui/rect.ts';
import type { SemanticsNode } from '../../ui/types.ts';
import { TextStyle } from '../painting/text-style.ts';
import { CustomPainter } from '../rendering/custom-paint.ts';
import { RenderBox } from '../rendering/object.ts';
import type { HitTestEntry } from '../rendering/object.ts';
import { HitTestBehavior } from '../rendering/pointer-listener.ts';
import { AppFocus } from './app-focus.ts';
import type { AppDiagnosticsObserver, AppFrameSample } from './app-diagnostics-data.ts';
import { ColoredBox, Padding, Positioned, Row, SizedBox, Stack, Text } from './basic.ts';
import { ControlInteraction } from './control-interaction.ts';
import { CustomPaint } from './custom-paint.ts';
import { EdgeInsets } from '../painting/edge-insets.ts';
import { ExcludeFocus } from './focus-scope.ts';
import { Element, RenderObjectElement, State, StatefulWidget } from './framework.ts';
import type { BuildContext, Widget } from './framework.ts';
import { GlobalKey } from './global-key.ts';
import { Listener } from './listener.ts';
import { MediaQuery } from './app-data.ts';
import { IgnorePointer } from './pointer-blocking.ts';
import { ExcludeSemantics, Semantics } from './semantics.ts';

export interface InspectorButtonOptions {
  readonly action: 'select' | 'exit' | 'move' | 'tapBehavior';
  readonly label: string;
  readonly moveRight: boolean;
  readonly selected: boolean;
  readonly onPressed: () => void;
}
export type InspectorButtonBuilder = (
  context: BuildContext,
  button: InspectorButtonOptions,
) => Widget;

interface AppDiagnosticsOptions {
  readonly inspect: boolean;
  readonly performance: boolean;
  readonly semantics: boolean;
  readonly inspectorButtonBuilder?: InspectorButtonBuilder;
}

const focusStroke = new Paint({ color: 0xff00b7f1, style: 'stroke', strokeWidth: 2 });
const focusFill = new Paint({ color: 0x3200b7f1 });
const semanticsStroke = new Paint({ color: 0xff44b891, style: 'stroke', strokeWidth: 1 });
const disabledStroke = new Paint({ color: 0xffab7552, style: 'stroke', strokeWidth: 1 });
const timingColors = [0xff65a9ff, 0xffeabc5f, 0xff8de2ab].map((color) => new Paint({ color }));
const timingBackground = new Paint({ color: 0xe61d2635 });
const timingLine = new Paint({ color: 0xfff56f72 });
const panelText = new TextStyle({ fontSize: 11, color: 0xffffffff });
const maxSamples = 64;
const maxSemanticsNodes = 256;

class AppDiagnosticsPainter extends CustomPainter {
  constructor(
    private readonly state: AppDiagnosticsState,
    private readonly performance = false,
  ) {
    super({ repaint: state.repaint });
  }
  override shouldRepaint(): boolean {
    return false;
  }
  override paint(canvas: Canvas, size: Size): void {
    const state = this.state;
    if (this.performance) {
      const height = size.height;
      canvas.drawRect(Rect.fromLTWH(0, 0, size.width, height), timingBackground);
      const width = size.width / maxSamples;
      const budget = state.samples.at(-1)?.refreshInterval ?? 1000 / 60;
      const scale = height / 2 / budget;
      for (const [index, sample] of state.samples.entries()) {
        let available = height;
        const stages = [sample.build, sample.layout, sample.paint];
        for (const [stage, duration] of stages.entries()) {
          const bar = Math.min(available, Math.max(0, duration * scale));
          available -= bar;
          canvas.drawRect(
            Rect.fromLTWH(index * width, available, width * 0.8, bar),
            timingColors[stage]!,
          );
        }
      }
      canvas.drawLine({ x: 0, y: height / 2 }, { x: size.width, y: height / 2 }, timingLine);
      return;
    }
    for (const node of state.outlines) {
      const { x, y, width, height } = node.bounds;
      canvas.drawRect(
        Rect.fromLTWH(x, y, width, height),
        node.enabled ? semanticsStroke : disabledStroke,
      );
    }
    const target = state.target;
    const content = state.contentRender();
    if (!target?.owner || target.owner !== content?.owner || !target.hasSize) return;
    const { x: left, y: top, width, height } = target.paintBounds;
    const right = left + width,
      bottom = top + height;
    const corners = [
      { x: left, y: top },
      { x: right, y: top },
      { x: left, y: bottom },
      { x: right, y: bottom },
    ].map((point) => content.globalToLocal(target.localToGlobal(point)));
    if (corners.some(({ x, y }) => !Number.isFinite(x) || !Number.isFinite(y))) return;
    const xs = corners.map(({ x }) => x),
      ys = corners.map(({ y }) => y);
    const bounds = Rect.fromLTRB(
      Math.min(...xs),
      Math.min(...ys),
      Math.max(...xs),
      Math.max(...ys),
    );
    canvas.drawRect(bounds, focusFill);
    canvas.drawRect(bounds, focusStroke);
  }
}

export class AppDiagnostics extends StatefulWidget {
  constructor(
    readonly child: Widget,
    readonly options: AppDiagnosticsOptions,
  ) {
    super();
  }
  override createState(): State<AppDiagnostics> {
    return new AppDiagnosticsState();
  }
}

class AppDiagnosticsState extends State<AppDiagnostics> {
  readonly repaint = new ValueNotifier(0);
  readonly samples: AppFrameSample[] = [];
  outlines: readonly SemanticsNode[] = [];
  target: RenderBox | undefined;
  private label = '';
  private selecting = false;
  private selectionOnTap = true;
  private alignRight = false;
  private readonly content = new GlobalKey();
  private readonly overlay = new AppDiagnosticsPainter(this);
  private readonly timings = new AppDiagnosticsPainter(this, true);
  private readonly observer: AppDiagnosticsObserver = {
    measureFrames: () => this.widget.options.performance,
    beginFrame: () => {
      if (this.target || this.samples.length) this.repaint.value++;
    },
    endFrame: (nodes, sample) => {
      if (sample && this.widget.options.performance) {
        const first = this.samples.length === 0;
        if (this.samples.length >= maxSamples) this.samples.shift();
        this.samples.push(sample);
        if (first) this.context.services.requestFrame();
      }
      if (!this.widget.options.semantics || nodes === this.lastNodes) return;
      this.lastNodes = nodes;
      const next = nodes
        .filter(({ bounds }) => bounds.width > 0 && bounds.height > 0)
        .slice(0, maxSemanticsNodes);
      const same =
        next.length === this.outlines.length &&
        next.every((node, index) => {
          const previous = this.outlines[index]!;
          const a = node.bounds,
            b = previous.bounds;
          return (
            node.id === previous.id &&
            node.name === previous.name &&
            node.enabled === previous.enabled &&
            a.x === b.x &&
            a.y === b.y &&
            a.width === b.width &&
            a.height === b.height
          );
        });
      if (!same)
        this.setState(() => {
          this.outlines = next;
        });
    },
  };
  private lastNodes: readonly SemanticsNode[] | undefined;
  private listeners!: Set<AppDiagnosticsObserver>;
  override initState(): void {
    const owner = (this.context as Element).owner;
    this.listeners = owner.appDiagnostics ??= new Set();
    this.listeners.add(this.observer);
    owner.postFrame(() => {
      if (this.mounted && (this.widget.options.performance || this.widget.options.semantics))
        this.context.services.requestFrame();
    });
  }
  override didUpdateWidget(old: AppDiagnostics): void {
    if (!this.widget.options.inspect) {
      this.selecting = false;
      this.target = undefined;
      this.label = '';
    }
    if (!this.widget.options.performance) this.samples.length = 0;
    if (!this.widget.options.semantics) {
      this.outlines = [];
      this.lastNodes = undefined;
    }
    if (
      (!old.options.performance && this.widget.options.performance) ||
      (!old.options.semantics && this.widget.options.semantics)
    )
      (this.context as Element).owner.postFrame(() => {
        if (this.mounted) this.context.services.requestFrame();
      });
  }
  override dispose(): void {
    this.listeners.delete(this.observer);
    this.repaint.dispose();
    super.dispose();
  }
  contentRender(): RenderBox | undefined {
    const render = this.content.currentContext?.findRenderObject();
    return render instanceof RenderBox && render.hasSize ? render : undefined;
  }
  private readonly select = (position: Offset) => {
    const content = this.contentRender(),
      element = this.content.currentContext;
    if (!content?.owner || !(element instanceof Element)) return;
    const hit: HitTestEntry[] = [];
    content.hitTest(content.globalToLocal(position), hit);
    const target = hit.find(
      ({ target }) => target instanceof RenderBox && target !== content,
    )?.target;
    if (target === this.target || !(target instanceof RenderBox)) return;
    let selected: Element | undefined;
    const visit = (child: Element) => {
      if (selected || !child.active) return;
      if (child instanceof RenderObjectElement && child.renderObject === target) selected = child;
      else child.visitChildren(visit);
    };
    element.visitChildren(visit);
    this.setState(() => {
      this.target = target;
      this.label = selected?.widget.constructor.name ?? target.constructor.name;
    });
  };
  private button(context: BuildContext, options: InspectorButtonOptions): Widget {
    return (
      this.widget.options.inspectorButtonBuilder?.(context, options) ??
      new ControlInteraction(
        () =>
          new ColoredBox({
            color: 0xff263448,
            child: new Padding(EdgeInsets.all(10), new Text(options.label, { style: panelText })),
          }),
        {
          onPressed: options.onPressed,
          selected: options.selected,
          semantics: { button: true, label: options.label },
        },
      )
    );
  }
  override build(context: BuildContext): Widget {
    const { inspect, performance, semantics } = this.widget.options;
    const selecting = inspect && this.selecting && this.selectionOnTap;
    const hasFont = context.services.defaultFont !== undefined;
    const padding = MediaQuery.paddingOf(context);
    const children: Widget[] = [
      new ExcludeFocus(
        new Semantics({
          excludeSemantics: selecting,
          child: SizedBox.expand(this.widget.child, { key: this.content }),
        }),
        { excluding: selecting },
      ),
      Positioned.fill(new IgnorePointer(new CustomPaint(undefined, { painter: this.overlay }))),
    ];
    if (semantics && hasFont)
      for (const node of this.outlines)
        if (node.name)
          children.push(
            new Positioned(
              new IgnorePointer(
                new ExcludeSemantics(
                  new ColoredBox({
                    color: 0xd025524e,
                    child: new Text(node.name, {
                      style: panelText,
                      maxLines: 1,
                      overflow: 'ellipsis',
                    }),
                  }),
                ),
              ),
              { top: node.bounds.y, left: node.bounds.x, width: node.bounds.width },
            ),
          );
    if (selecting)
      children.push(
        Positioned.fill(
          new Listener(null, {
            behavior: HitTestBehavior.opaque,
            onPointerHover: (event) => this.select(event.position),
            onPointerDown: (event) => this.select(event.position),
          }),
        ),
      );
    if (performance) {
      children.push(
        new Positioned(new IgnorePointer(new CustomPaint(undefined, { painter: this.timings })), {
          top: padding.top,
          left: 0,
          right: 0,
          height: 72,
        }),
      );
      if (hasFont)
        children.push(
          new Positioned(
            new IgnorePointer(
              new Text('CPU frame time · Build / Layout / Paint', { style: panelText }),
            ),
            { top: padding.top, left: 8, right: 0 },
          ),
        );
    }
    if (inspect) {
      const make = (
        action: InspectorButtonOptions['action'],
        label: string,
        selected: boolean,
        callback: () => void,
      ) =>
        this.button(context, {
          action,
          label,
          selected,
          moveRight: !this.alignRight,
          onPressed: () => this.setState(callback),
        });
      const buttons = this.selecting
        ? [
            make('exit', 'Exit widget selection', false, () => {
              this.selecting = false;
              this.label = '';
              this.target = undefined;
            }),
            make('move', 'Move widget inspector', false, () => {
              this.alignRight = !this.alignRight;
            }),
            make('tapBehavior', 'Select widgets on tap', this.selectionOnTap, () => {
              this.selectionOnTap = !this.selectionOnTap;
            }),
          ]
        : [
            make('select', 'Select a widget', false, () => {
              this.selecting = true;
            }),
          ];
      if (hasFont && this.label)
        buttons.push(
          new ExcludeSemantics(
            new ColoredBox({
              color: 0xd0263448,
              child: new Padding(EdgeInsets.all(4), new Text(this.label, { style: panelText })),
            }),
          ),
        );
      children.push(
        new Positioned(new AppFocus(new Row(buttons, { mainSize: 'min', spacing: 4 })), {
          bottom: padding.bottom + 8,
          ...(this.alignRight ? { right: 8 } : { left: 8 }),
        }),
      );
    }
    return new Stack(children, { fit: 'expand' });
  }
}
