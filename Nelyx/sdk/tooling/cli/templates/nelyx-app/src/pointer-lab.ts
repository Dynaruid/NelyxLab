// SPDX-License-Identifier: BSD-3-Clause
import { StatefulWidget, State, Element } from '@nelyx/core/framework/widgets/framework';
import type { Widget, BuildContext } from '@nelyx/core/framework/widgets/framework';
import { Column, Text, SizedBox, DecoratedBox, Padding } from '@nelyx/core/framework/widgets/basic';
import { Listener } from '@nelyx/core/framework/widgets/listener';
import { HitTestBehavior } from '@nelyx/core/framework/rendering/pointer-listener';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { SingleChildScrollView, ScrollController } from '@nelyx/core/framework/widgets/scroll';
import { Scaffold, FilledButton } from '@nelyx/material/widgets';
import { AppTheme } from '@nelyx/core/framework/widgets/app-data';
import { allInsets } from '@nelyx/core/ui/geometry';
import {
  PointerDownEvent,
  PointerUpEvent,
  PointerCancelEvent,
} from '@nelyx/core/framework/gestures/events';
import type { PointerEvent } from '@nelyx/core/framework/gestures/events';
import type { GestureBinding } from '@nelyx/core/framework/gestures/binding';
import type { FrameScheduler } from '@nelyx/core/framework/scheduler/scheduler';

export class PointerLab extends StatefulWidget {
  constructor(
    readonly scheduler: FrameScheduler,
    readonly onBack: () => void,
  ) {
    super();
  }
  createState(): State {
    return new PointerLabState();
  }
}
class PointerLabState extends State<PointerLab> {
  private binding!: GestureBinding;
  private previousResampling = false;
  private readonly scroll = new ScrollController();
  private down = 0;
  private up = 0;
  private cancel = 0;
  private signals = 0;
  private captureSignal = true;
  private resampling = false;
  private last = 'none';
  private trace: string[] = [];
  private tracedEvent: PointerEvent | null = null;
  private readonly scrollChanged = () => {
    if (this.mounted) this.setState(() => {});
  };
  private readonly globalRoute = (event: PointerEvent) => {
    if ((event.original ?? event) !== this.tracedEvent) return;
    const stage =
      event instanceof PointerDownEvent
        ? 'down'
        : event instanceof PointerUpEvent
          ? 'up'
          : event instanceof PointerCancelEvent
            ? 'cancel'
            : 'other';
    if (this.mounted)
      this.setState(() => {
        this.trace = [...this.trace, `global ${stage}`];
      });
  };
  override initState(): void {
    if (!(this.context instanceof Element)) throw new Error('Pointer lab requires Element');
    this.binding = this.context.owner.gestureBinding;
    this.previousResampling = this.binding.resamplingEnabled;
    this.resampling = this.previousResampling;
    this.binding.pointerRouter.addGlobalRoute(this.globalRoute);
    this.scroll.addListener(this.scrollChanged);
  }
  override dispose(): void {
    this.binding.pointerRouter.removeGlobalRoute(this.globalRoute);
    this.binding.resamplingEnabled = this.previousResampling;
    this.tracedEvent = null;
    this.scroll.removeListener(this.scrollChanged);
    this.scroll.dispose();
  }
  private record(stage: 'down' | 'up' | 'cancel', event: PointerEvent): void {
    this.setState(() => {
      if (stage === 'down') this.down++;
      else if (stage === 'up') this.up++;
      else this.cancel++;
      this.tracedEvent = event.original ?? event;
      this.trace = [`target ${stage}`];
      this.last = `${event.kind.name} ${event.pointer} · global ${Math.round(event.position.dx)},${Math.round(event.position.dy)} · local ${Math.round(event.localPosition.dx)},${Math.round(event.localPosition.dy)}`;
    });
  }
  build(context: BuildContext): Widget {
    const color = AppTheme.of(context).foreground;
    const target = new Semantics(
      new DecoratedBox(
        new SizedBox(
          undefined,
          110,
          new Listener(
            new Padding(
              allInsets(12),
              new Text('Press or touch here, then release outside', {
                fontSize: 16,
                color: 0xffffffff,
              }),
            ),
            {
              behavior: HitTestBehavior.opaque,
              onPointerDown: (e) => this.record('down', e),
              onPointerUp: (e) => this.record('up', e),
              onPointerCancel: (e) => this.record('cancel', e),
            },
          ),
        ),
        0xff244c74,
        8,
      ),
      { id: 'pointer-target', role: 'text', name: 'Pointer target', enabled: true },
    );
    const signalTarget = new Semantics(
      new DecoratedBox(
        new SizedBox(
          undefined,
          320,
          new Listener(
            new Padding(
              allInsets(12),
              new Text('Wheel here: the first listener can claim the signal', {
                fontSize: 16,
                color: 0xffffffff,
              }),
            ),
            {
              behavior: HitTestBehavior.opaque,
              onPointerSignal: (event) => {
                if (this.captureSignal)
                  this.binding.pointerSignalResolver.register(event, (signal) => {
                    if (this.mounted)
                      this.setState(() => {
                        this.signals++;
                      });
                    signal.respond({ allowPlatformDefault: false });
                  });
              },
            },
          ),
        ),
        0xff315c40,
        8,
      ),
      { id: 'pointer-signal-target', role: 'text', name: 'Pointer signal target', enabled: true },
    );
    return new Scaffold(
      'Pointer dispatch',
      new Column(
        [
          new Text(`Down ${this.down} · Up ${this.up} · Cancel ${this.cancel}`, {
            fontSize: 22,
            color,
          }),
          new Text(`Dispatch: ${this.trace.join(' → ') || 'none'}`, { fontSize: 14, color }),
          new Text(`Last: ${this.last}`, { fontSize: 14, color }),
          target,
          new Text(`Touch resampling: ${this.resampling ? 'on' : 'off'}`, { fontSize: 14, color }),
          new FilledButton(
            'pointer-resampling',
            this.resampling ? 'Disable touch resampling' : 'Enable touch resampling',
            () =>
              this.setState(() => {
                this.resampling = !this.resampling;
                this.binding.resamplingEnabled = this.resampling;
              }),
          ),
          new Text(`Signal wins ${this.signals} · Scroll ${Math.round(this.scroll.offset)}`, {
            fontSize: 18,
            color,
          }),
          new FilledButton(
            'pointer-signal-mode',
            this.captureSignal ? 'Let page scroll' : 'Capture wheel',
            () =>
              this.setState(() => {
                this.captureSignal = !this.captureSignal;
              }),
          ),
          new SizedBox(
            undefined,
            100,
            new SingleChildScrollView(signalTarget, this.scroll, this.widget.scheduler),
          ),
        ],
        { spacing: 12, crossAlign: 'stretch' },
      ),
      new FilledButton('pointer-back', 'Back', this.widget.onBack),
    );
  }
}
