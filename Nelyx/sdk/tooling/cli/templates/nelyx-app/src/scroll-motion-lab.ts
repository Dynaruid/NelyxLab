// SPDX-License-Identifier: BSD-3-Clause
import { StatefulWidget, State } from '@nelyx/core/framework/widgets/framework';
import type { Widget } from '@nelyx/core/framework/widgets/framework';
import { Column, Row, Expanded, Text } from '@nelyx/core/framework/widgets/basic';
import { Scaffold, FilledButton } from '@nelyx/material/widgets';
import { AppTheme } from '@nelyx/core/framework/widgets/app-data';
import {
  ScrollController,
  LazyList,
  SingleChildScrollView,
} from '@nelyx/core/framework/widgets/scroll';
import {
  ClampingScrollPhysics,
  BouncingScrollPhysics,
  NeverScrollableScrollPhysics,
  AlwaysScrollableScrollPhysics,
  RangeMaintainingScrollPhysics,
  ScrollDecelerationRate,
} from '@nelyx/core/framework/widgets/scroll-physics';
import type { FrameScheduler } from '@nelyx/core/framework/scheduler/scheduler';
type Mode = 'Clamp' | 'Bounce' | 'Fast bounce' | 'Touch disabled';
const modes: readonly Mode[] = ['Clamp', 'Bounce', 'Fast bounce', 'Touch disabled'];
export class ScrollMotionLab extends StatefulWidget {
  constructor(
    readonly scheduler: FrameScheduler,
    readonly onBack: () => void,
  ) {
    super();
  }
  createState(): State {
    return new ScrollMotionState();
  }
}
class ScrollMotionState extends State<ScrollMotionLab> {
  private mode: Mode = 'Clamp';
  private controller = this.makeController();
  private readonly page = new ScrollController();
  private readonly retiring = new Set<ScrollController>();
  private count = 10000;
  private built = 0;
  private selected: number | null = null;
  private pendingBuildCount = false;
  private makeController(): ScrollController {
    const range = new RangeMaintainingScrollPhysics();
    if (this.mode === 'Clamp')
      return new ScrollController(0, new ClampingScrollPhysics({ parent: range }));
    if (this.mode === 'Touch disabled')
      return new ScrollController(
        0,
        new NeverScrollableScrollPhysics({ parent: new ClampingScrollPhysics({ parent: range }) }),
      );
    return new ScrollController(
      0,
      new BouncingScrollPhysics({
        parent: new RangeMaintainingScrollPhysics({ parent: new AlwaysScrollableScrollPhysics() }),
        decelerationRate:
          this.mode === 'Fast bounce' ? ScrollDecelerationRate.fast : ScrollDecelerationRate.normal,
      }),
    );
  }
  private readonly changed = () => {
    if (this.mounted && this.context.mounted) this.setState(() => {});
  };
  override initState(): void {
    this.controller.addListener(this.changed);
    this.controller.isScrollingNotifier.addListener(this.changed);
  }
  private change(update: () => void): void {
    if (!this.mounted || !this.context.mounted) return;
    this.setState(update);
  }
  private cycleMode(): void {
    if (!this.mounted || !this.context.mounted) return;
    const old = this.controller;
    old.stop();
    old.removeListener(this.changed);
    old.isScrollingNotifier.removeListener(this.changed);
    this.change(() => {
      this.mode = modes[(modes.indexOf(this.mode) + 1) % modes.length]!;
      this.controller = this.makeController();
      this.controller.addListener(this.changed);
      this.controller.isScrollingNotifier.addListener(this.changed);
      this.selected = null;
    });
    this.retiring.add(old);
    this.widget.scheduler.addPostFrame(() => {
      if (this.retiring.delete(old)) old.dispose();
    });
  }
  private readonly row = (index: number): Widget => {
    this.built++;
    if (!this.pendingBuildCount) {
      this.pendingBuildCount = true;
      this.widget.scheduler.addPostFrame(() => {
        this.pendingBuildCount = false;
        this.changed();
      });
    }
    return new FilledButton('motion-row-' + index, 'Row ' + index, () =>
      this.change(() => {
        this.selected = index;
      }),
    );
  };
  override dispose(): void {
    this.controller.removeListener(this.changed);
    this.controller.isScrollingNotifier.removeListener(this.changed);
    const controllers = [this.controller, this.page, ...this.retiring];
    this.retiring.clear();
    const errors: unknown[] = [];
    for (const controller of controllers)
      try {
        controller.dispose();
      } catch (error) {
        errors.push(error);
      }
    if (errors.length) throw new AggregateError(errors, 'Scroll motion owner retirement failed');
  }
  private pair(a: Widget, b: Widget): Widget {
    return new Row([new Expanded(a), new Expanded(b)], { spacing: 8 });
  }
  build(): Widget {
    const color = AppTheme.of(this.context).foreground,
      c = this.controller,
      max = c.hasContentDimensions ? c.maxScrollExtent.toFixed(1) : 'pending';
    return new Scaffold(
      'Scroll motion',
      new SingleChildScrollView(
        new Column(
          [
            new Text(`Edges ${this.mode} · ${c.isScrollingNotifier.value ? 'scrolling' : 'idle'}`, {
              fontSize: 19,
              color,
            }),
            new Text(`Offset ${c.offset.toFixed(1)} · Max ${max}`, { fontSize: 14, color }),
            new Text(
              `${this.count.toLocaleString('en-US')} fixed rows · Built ${this.built} · Selected ${this.selected ?? 'none'}`,
              { fontSize: 14, color },
            ),
            new LazyList({
              itemCount: this.count,
              itemExtent: 64,
              height: 220,
              cacheExtent: 128,
              keepAliveCount: 2,
              itemBuilder: this.row,
              controller: c,
              scheduler: this.widget.scheduler,
            }),
            new FilledButton('motion-mode', 'Edges: ' + this.mode, () => this.cycleMode()),
            this.pair(
              new FilledButton('motion-top', 'Jump top', () => c.jumpTo(0)),
              new FilledButton('motion-end', 'Jump end', () => c.jumpTo(c.maxScrollExtent)),
            ),
            this.pair(
              new FilledButton('motion-up', 'Fling up', () =>
                c.fling(-1600, this.widget.scheduler),
              ),
              new FilledButton('motion-down', 'Fling down', () =>
                c.fling(1600, this.widget.scheduler),
              ),
            ),
            this.pair(
              new FilledButton('motion-stop', 'Stop motion', () => c.jumpTo(c.offset)),
              new FilledButton(
                'motion-count',
                this.count === 10000 ? 'Use short content' : 'Use 10,000 rows',
                () =>
                  this.change(() => {
                    this.count = this.count === 10000 ? 3 : 10000;
                  }),
              ),
            ),
          ],
          { spacing: 8, mainAxisSize: 'min' },
        ),
        this.page,
        this.widget.scheduler,
      ),
      new FilledButton('motion-back', 'Back', this.widget.onBack),
    );
  }
}
