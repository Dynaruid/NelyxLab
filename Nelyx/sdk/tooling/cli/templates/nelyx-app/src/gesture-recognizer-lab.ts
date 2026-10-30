// SPDX-License-Identifier: BSD-3-Clause
import { StatefulWidget, State } from '@nelyx/core/framework/widgets/framework';
import type { Widget, BuildContext } from '@nelyx/core/framework/widgets/framework';
import { Column, Text, SizedBox, DecoratedBox } from '@nelyx/core/framework/widgets/basic';
import { GestureDetector } from '@nelyx/core/framework/widgets/gesture-detector';
import type { GestureOptions } from '@nelyx/core/framework/widgets/gesture-detector';
import {
  DragStartBehavior,
  MultitouchDragStrategy,
} from '@nelyx/core/framework/gestures/recognizer';
import { HitTestBehavior } from '@nelyx/core/framework/rendering/pointer-listener';
import type {
  DragUpdateDetails,
  DragEndDetails,
} from '@nelyx/core/framework/gestures/drag-details';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { Scaffold, FilledButton } from '@nelyx/material/widgets';
import { AppTheme } from '@nelyx/core/framework/widgets/app-data';
type Mode = 'Tap' | 'Horizontal' | 'Vertical' | 'Pan';
export class GestureRecognizerLab extends StatefulWidget {
  constructor(readonly onBack: () => void) {
    super();
  }
  createState(): State {
    return new GestureRecognizerLabState();
  }
}
class GestureRecognizerLabState extends State<GestureRecognizerLab> {
  private mode: Mode = 'Tap';
  private down = 0;
  private up = 0;
  private tap = 0;
  private secondary = 0;
  private tertiary = 0;
  private moves = 0;
  private cancel = 0;
  private starts = 0;
  private ends = 0;
  private updates = 0;
  private lastDelta = 'none';
  private lastVelocity = 'none';
  private enabled = true;
  private changed(change: () => void): void {
    if (this.mounted && this.context.mounted) this.setState(change);
  }
  private readonly dragUpdate = (details: DragUpdateDetails) =>
    this.changed(() => {
      this.updates++;
      this.lastDelta = `${Math.round(details.delta.dx)},${Math.round(details.delta.dy)} · primary ${details.primaryDelta === null ? 'none' : Math.round(details.primaryDelta)}`;
    });
  private readonly end = (details: DragEndDetails) =>
    this.changed(() => {
      this.ends++;
      this.lastVelocity = `${Math.round(details.velocity.pixelsPerSecond.dx)},${Math.round(details.velocity.pixelsPerSecond.dy)}`;
    });
  build(context: BuildContext): Widget {
    const color = AppTheme.of(context).foreground,
      options: GestureOptions = {
        behavior: HitTestBehavior.opaque,
        enabled: this.enabled,
        dragStartBehavior: DragStartBehavior.down,
        multitouchDragStrategy: MultitouchDragStrategy.averageBoundaryPointers,
      };
    let callbacks: GestureOptions;
    if (this.mode === 'Tap')
      callbacks = {
        onTapDown: () =>
          this.changed(() => {
            this.down++;
          }),
        onTapUp: () =>
          this.changed(() => {
            this.up++;
          }),
        onTap: () =>
          this.changed(() => {
            this.tap++;
          }),
        onTapMove: () =>
          this.changed(() => {
            this.moves++;
          }),
        onTapCancel: () =>
          this.changed(() => {
            this.cancel++;
          }),
        onSecondaryTap: () =>
          this.changed(() => {
            this.secondary++;
          }),
        onTertiaryTapUp: () =>
          this.changed(() => {
            this.tertiary++;
          }),
      };
    else if (this.mode === 'Horizontal')
      callbacks = {
        onHorizontalDragStart: () =>
          this.changed(() => {
            this.starts++;
          }),
        onHorizontalDragUpdate: this.dragUpdate,
        onHorizontalDragEnd: this.end,
        onHorizontalDragCancel: () =>
          this.changed(() => {
            this.cancel++;
          }),
      };
    else if (this.mode === 'Vertical')
      callbacks = {
        onVerticalDragStart: () =>
          this.changed(() => {
            this.starts++;
          }),
        onVerticalDragUpdate: this.dragUpdate,
        onVerticalDragEnd: this.end,
        onVerticalDragCancel: () =>
          this.changed(() => {
            this.cancel++;
          }),
      };
    else
      callbacks = {
        onPanStart: () =>
          this.changed(() => {
            this.starts++;
          }),
        onPanUpdate: this.dragUpdate,
        onPanEnd: this.end,
        onPanCancel: () =>
          this.changed(() => {
            this.cancel++;
          }),
      };
    const pad = new Semantics(
      new GestureDetector(
        new DecoratedBox(
          new SizedBox(
            undefined,
            140,
            new Text('Press and move here', { fontSize: 20, color: 0xffffffff }),
          ),
          0xff244c74,
          8,
        ),
        { ...options, ...callbacks },
      ),
      { id: 'recognizer-target', role: 'text', name: 'Gesture recognizer target', enabled: true },
    );
    return new Scaffold(
      'Gesture recognizers',
      new Column(
        [
          new Text(`Mode ${this.mode} · ${this.enabled ? 'enabled' : 'disabled'}`, {
            fontSize: 20,
            color,
          }),
          new Text(
            `Tap down ${this.down} · up ${this.up} · tap ${this.tap} · move ${this.moves} · cancel ${this.cancel}`,
            { fontSize: 15, color },
          ),
          new Text(`Secondary ${this.secondary} · Tertiary ${this.tertiary}`, {
            fontSize: 15,
            color,
          }),
          new Text(`Drag start ${this.starts} · update ${this.updates} · end ${this.ends}`, {
            fontSize: 15,
            color,
          }),
          new Text(`Delta ${this.lastDelta}`, { fontSize: 15, color }),
          new Text(`Velocity ${this.lastVelocity}`, { fontSize: 15, color }),
          pad,
          ...(['Tap', 'Horizontal', 'Vertical', 'Pan'] as const).map(
            (mode) =>
              new FilledButton('recognizer-' + mode, mode + ' mode', () =>
                this.changed(() => {
                  this.mode = mode;
                }),
              ),
          ),
          new FilledButton(
            'recognizer-enabled',
            this.enabled ? 'Disable gestures' : 'Enable gestures',
            () =>
              this.changed(() => {
                this.enabled = !this.enabled;
              }),
          ),
          new FilledButton('recognizer-back', 'Back', this.widget.onBack),
        ],
        { spacing: 8 },
      ),
    );
  }
}
