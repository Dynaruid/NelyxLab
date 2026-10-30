// SPDX-License-Identifier: BSD-3-Clause
import { StatefulWidget, State, Element } from '@nelyx/core/framework/widgets/framework';
import type { Widget, BuildContext } from '@nelyx/core/framework/widgets/framework';
import { Column, Text, SizedBox, Padding, DecoratedBox } from '@nelyx/core/framework/widgets/basic';
import { GestureDetector } from '@nelyx/core/framework/widgets/gesture-detector';
import { Listener } from '@nelyx/core/framework/widgets/listener';
import { HitTestBehavior } from '@nelyx/core/framework/rendering/pointer-listener';
import { GestureDisposition } from '@nelyx/core/framework/gestures/arena';
import type { GestureArenaManager, GestureArenaMember } from '@nelyx/core/framework/gestures/arena';
import { GestureArenaTeam } from '@nelyx/core/framework/gestures/team';
import { DragStartBehavior } from '@nelyx/core/framework/gestures/recognizer';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { Scaffold, FilledButton } from '@nelyx/material/widgets';
import { AppTheme } from '@nelyx/core/framework/widgets/app-data';
import { allInsets } from '@nelyx/core/ui/geometry';
type Choice = 'first' | 'member' | 'outside';
export class GestureArenaLab extends StatefulWidget {
  constructor(readonly onBack: () => void) {
    super();
  }
  createState(): State {
    return new GestureArenaLabState();
  }
}
class GestureArenaLabState extends State<GestureArenaLab> {
  private arena!: GestureArenaManager;
  private team!: GestureArenaTeam;
  private taps = 0;
  private drags = 0;
  private ends = 0;
  private distance = 0;
  private choice: Choice = 'first';
  private captain = false;
  private outcome = 'none';
  private trace: string[] = [];
  private readonly first = this.member('A');
  private readonly second = this.member('B');
  private readonly outside = this.member('Outside');
  private readonly leader = this.member('Captain');
  private member(name: string): GestureArenaMember {
    const member = {
      acceptGesture: () => this.record(name, true),
      rejectGesture: () => this.record(name, false),
      toString: () => name,
    };
    return member;
  }
  private record(name: string, accepted: boolean): void {
    if (this.mounted && this.context.mounted)
      this.setState(() => {
        if (accepted) this.outcome = name;
        this.trace = [...this.trace, `${name} ${accepted ? 'accepted' : 'rejected'}`];
      });
  }
  override initState(): void {
    if (!(this.context instanceof Element)) throw new Error('Gesture arena lab requires Element');
    this.arena = this.context.owner.gestureBinding.gestureArena;
    this.team = new GestureArenaTeam(this.arena);
  }
  override dispose(): void {
    this.team.dispose();
  }
  build(context: BuildContext): Widget {
    const color = AppTheme.of(context).foreground;
    const dragPad = new Semantics(
      new DecoratedBox(
        new SizedBox(
          undefined,
          100,
          new GestureDetector(
            new Padding(
              allInsets(12),
              new Text('Tap, or drag beyond the movement threshold', {
                fontSize: 16,
                color: 0xffffffff,
              }),
            ),
            {
              behavior: HitTestBehavior.opaque,
              dragStartBehavior: DragStartBehavior.down,
              onTap: () =>
                this.setState(() => {
                  this.taps++;
                }),
              onDrag: (dx, dy) =>
                this.setState(() => {
                  this.drags++;
                  this.distance += Math.hypot(dx, dy);
                }),
              onDragEnd: () =>
                this.setState(() => {
                  this.ends++;
                }),
            },
          ),
        ),
        0xff244c74,
        8,
      ),
      {
        id: 'arena-tap-drag-target',
        role: 'text',
        name: 'Arena tap and drag target',
        enabled: true,
      },
    );
    const teamPad = new Semantics(
      new DecoratedBox(
        new SizedBox(
          undefined,
          100,
          new Listener(
            new Padding(
              allInsets(12),
              new Text('Press to compete as one real arena team', {
                fontSize: 16,
                color: 0xffffffff,
              }),
            ),
            {
              behavior: HitTestBehavior.opaque,
              onPointerDown: (event) => {
                this.setState(() => {
                  this.outcome = 'pending';
                  this.trace = [];
                });
                this.team.captain = this.captain ? this.leader : null;
                this.team.add(event.pointer, this.first);
                const second = this.team.add(event.pointer, this.second),
                  outside = this.arena.add(event.pointer, this.outside);
                if (this.choice === 'first') outside.resolve(GestureDisposition.rejected);
                else if (this.choice === 'member') second.resolve(GestureDisposition.accepted);
                else outside.resolve(GestureDisposition.accepted);
              },
            },
          ),
        ),
        0xff315c40,
        8,
      ),
      { id: 'arena-team-target', role: 'text', name: 'Arena team target', enabled: true },
    );
    return new Scaffold(
      'Gesture arena',
      new Column(
        [
          new Text(`Taps ${this.taps} · Drags ${this.drags} · Ends ${this.ends}`, {
            fontSize: 22,
            color,
          }),
          new Text(`Drag distance ${Math.round(this.distance)}`, { fontSize: 14, color }),
          dragPad,
          new Text(`Team outcome: ${this.outcome}`, { fontSize: 20, color }),
          new Text(`Team trace: ${this.trace.join(' → ') || 'none'}`, { fontSize: 14, color }),
          new Text(`Choice: ${this.choice} · Captain: ${this.captain ? 'on' : 'off'}`, {
            fontSize: 14,
            color,
          }),
          new FilledButton('arena-first', 'Team first member', () =>
            this.setState(() => {
              this.choice = 'first';
            }),
          ),
          new FilledButton('arena-member', 'Teammate B claims', () =>
            this.setState(() => {
              this.choice = 'member';
            }),
          ),
          new FilledButton('arena-outside', 'Outside member claims', () =>
            this.setState(() => {
              this.choice = 'outside';
            }),
          ),
          new FilledButton(
            'arena-captain',
            this.captain ? 'Remove team captain' : 'Use team captain',
            () =>
              this.setState(() => {
                this.captain = !this.captain;
              }),
          ),
          teamPad,
        ],
        { spacing: 12, crossAlign: 'stretch' },
      ),
      new FilledButton('arena-back', 'Back', this.widget.onBack),
    );
  }
}
