// SPDX-License-Identifier: BSD-3-Clause
import { StatefulWidget, State, Element } from '@nelyx/core/framework/widgets/framework';
import type { Widget, BuildContext } from '@nelyx/core/framework/widgets/framework';
import { Column, Row, Text, SizedBox, DecoratedBox } from '@nelyx/core/framework/widgets/basic';
import { Overlay, OverlayEntry } from '@nelyx/core/framework/widgets/overlay';
import {
  Draggable,
  LongPressDraggable,
  DragTarget,
} from '@nelyx/core/framework/widgets/drag-target';
import type { DraggableOptions } from '@nelyx/core/framework/widgets/drag-target';
import { TapRegionSurface, TapRegion } from '@nelyx/core/framework/widgets/tap-region';
import { GestureDetector } from '@nelyx/core/framework/widgets/gesture-detector';
import {
  RawGestureDetector,
  GestureRecognizerFactoryWithHandlers,
} from '@nelyx/core/framework/widgets/raw-gesture-detector';
import { Listener } from '@nelyx/core/framework/widgets/listener';
import { EagerGestureRecognizer } from '@nelyx/core/framework/gestures/eager';
import { PointerDeviceKind } from '@nelyx/core/ui/pointer';
import { MouseRegion } from '@nelyx/core/framework/widgets/mouse-region';
import { SystemMouseCursors } from '@nelyx/core/services/mouse-cursor';
import type { SystemMouseCursor } from '@nelyx/core/services/mouse-cursor';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { HitTestBehavior } from '@nelyx/core/framework/rendering/pointer-listener';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { Scaffold, FilledButton } from '@nelyx/material/widgets';
import { AppTheme } from '@nelyx/core/framework/widgets/app-data';
import { SingleChildScrollView, ScrollController } from '@nelyx/core/framework/widgets/scroll';
import type { FrameScheduler } from '@nelyx/core/framework/scheduler/scheduler';
class SurfaceRegionGroup {
  constructor(readonly id: string) {}
  get hashCode(): number {
    return this.id.length;
  }
  equals(other: unknown): boolean {
    return other instanceof SurfaceRegionGroup && this.id === other.id;
  }
}
type Mode = 'Immediate' | 'Long press' | 'Horizontal' | 'Eager';
export class GestureSurfacesLab extends StatefulWidget {
  constructor(
    readonly scheduler: FrameScheduler,
    readonly onBack: () => void,
  ) {
    super();
  }
  createState(): State {
    return new GestureSurfacesLabState();
  }
}
class GestureSurfacesLabState extends State<GestureSurfacesLab> {
  private readonly scroll = new ScrollController();
  private entry!: OverlayEntry;
  private mode: Mode = 'Immediate';
  private accepting = true;
  private consumeOutside = false;
  private started = 0;
  private dropped = 0;
  private cancelled = 0;
  private active = 0;
  private moves = 0;
  private insideA = 0;
  private insideB = 0;
  private outside = 0;
  private upInside = 0;
  private outsideClicks = 0;
  private captured = 0;
  private bubbled = 0;
  private cursorText = false;
  private cursorOverride: SystemMouseCursor | null = null;
  private separateGroups = false;
  private hovered = false;
  private entered = 0;
  private hoveredMoves = 0;
  private exited = 0;
  override initState(): void {
    this.entry = new OverlayEntry({ builder: (context) => this.body(context) });
  }
  private change(update: () => void): void {
    if (!this.mounted || !this.context.mounted) return;
    this.setState(update);
    this.entry.markNeedsBuild();
  }
  override dispose(): void {
    if (this.entry.overlay) this.entry.remove();
    this.entry.dispose();
    this.scroll.dispose();
  }
  build(): Widget {
    return new Overlay({ initialEntries: [this.entry] });
  }
  private box(label: string, width = 180, height = 90, color = 0xff244c74): Widget {
    return new DecoratedBox(
      new SizedBox(width, height, new Text(label, { fontSize: 18, color: 0xffffffff })),
      color,
      8,
    );
  }
  private named(id: string, name: string, child: Widget, excludeChildren = false): Widget {
    return new Semantics(child, { id, role: 'text', name, enabled: true, excludeChildren });
  }
  private body(context: BuildContext): Widget {
    if (!(context instanceof Element))
      throw new Error('Gesture surfaces require the actual View Element');
    const color = AppTheme.of(context).foreground,
      binding = context.owner.gestureBinding;
    const available = Math.max(1, MediaQuery.of(context).width - 40),
      half = Math.max(1, (available - 24) / 2),
      wide = available >= 700;
    let source: Widget = this.named(
      'gesture-drag-source',
      'Drag source',
      new MouseRegion(
        this.box(
          this.mode === 'Eager' ? 'Press to capture input' : 'Drag the parcel',
          Math.min(180, half),
        ),
        { cursor: this.active > 0 ? SystemMouseCursors.grabbing : SystemMouseCursors.grab },
      ),
    );
    if (this.mode === 'Eager')
      source = new GestureDetector(
        new RawGestureDetector(
          new Listener(source, {
            behavior: HitTestBehavior.opaque,
            onPointerDown: () =>
              this.change(() => {
                this.captured++;
              }),
          }),
          {
            behavior: HitTestBehavior.opaque,
            gestures: new Map([
              [
                EagerGestureRecognizer,
                new GestureRecognizerFactoryWithHandlers(
                  EagerGestureRecognizer,
                  () => new EagerGestureRecognizer({ binding, debugOwner: this }),
                  (r) => {
                    r.supportedDevices = new Set([
                      PointerDeviceKind.mouse,
                      PointerDeviceKind.touch,
                    ]);
                  },
                ),
              ],
            ]),
          },
        ),
        {
          behavior: HitTestBehavior.opaque,
          onTap: () =>
            this.change(() => {
              this.bubbled++;
            }),
        },
      );
    else {
      const options: DraggableOptions<string> = {
        data: 'parcel',
        hitTestBehavior: HitTestBehavior.opaque,
        maxSimultaneousDrags: 2,
        ...(this.mode === 'Horizontal'
          ? ({ axis: 'horizontal', affinity: 'horizontal' } as const)
          : {}),
        onDragStarted: () =>
          this.change(() => {
            this.started++;
            this.active++;
          }),
        onDragUpdate: () =>
          this.change(() => {
            this.moves++;
          }),
        onDragCompleted: () =>
          this.change(() => {
            this.active--;
          }),
        onDraggableCanceled: () =>
          this.change(() => {
            this.cancelled++;
            this.active--;
          }),
      };
      const feedback = this.box('Parcel', 100, 55, 0xff287d65);
      source =
        this.mode === 'Long press'
          ? new LongPressDraggable(source, feedback, { ...options, hapticFeedbackOnStart: false })
          : new Draggable(source, feedback, options);
    }
    const target = new DragTarget<string>({
      isDataType: (value: unknown): value is string => typeof value === 'string',
      onWillAcceptWithDetails: () => this.accepting,
      onAccept: () =>
        this.change(() => {
          this.dropped++;
        }),
      builder: (_context, candidate, rejected) =>
        this.named(
          'gesture-drop-target',
          'Drop target',
          new MouseRegion(
            this.box(
              `Drop here · ${candidate.length} ready · ${rejected.length} refused`,
              Math.min(260, half),
              90,
              candidate.length ? 0xff287d65 : 0xff395273,
            ),
            { cursor: this.accepting ? SystemMouseCursors.copy : SystemMouseCursors.forbidden },
          ),
        ),
    });
    const region = (name: 'A' | 'B') =>
      new TapRegion(
        this.named(
          'gesture-region-' + name,
          'Tap region ' + name,
          this.box('Tap region ' + name, Math.min(180, half), 70),
          true,
        ),
        {
          groupId: new SurfaceRegionGroup(this.separateGroups ? name : 'shared'),
          behavior: HitTestBehavior.opaque,
          consumeOutsideTaps: this.consumeOutside,
          onTapInside: () =>
            this.change(() => {
              if (name === 'A') this.insideA++;
              else this.insideB++;
            }),
          onTapOutside: () =>
            this.change(() => {
              this.outside++;
            }),
          onTapUpInside: () =>
            this.change(() => {
              this.upInside++;
            }),
        },
      );
    const outside = new GestureDetector(
      this.named(
        'gesture-outside-target',
        'Outside tap target',
        this.box('Tap outside both regions', Math.min(440, available), 70, 0xff4b3b64),
      ),
      {
        behavior: HitTestBehavior.opaque,
        onTap: () =>
          this.change(() => {
            this.outsideClicks++;
          }),
      },
    );
    const cursor = this.named(
      'gesture-cursor-target',
      'Cursor target',
      new MouseRegion(this.box('Hover to inspect the cursor', Math.min(440, available), 55), {
        cursor:
          this.cursorOverride ??
          (this.cursorText ? SystemMouseCursors.text : SystemMouseCursors.click),
        onEnter: () =>
          this.change(() => {
            this.hovered = true;
            this.entered++;
          }),
        onHover: () =>
          this.change(() => {
            this.hoveredMoves++;
          }),
        onExit: () =>
          this.change(() => {
            this.hovered = false;
            this.exited++;
          }),
      }),
    );
    return new Scaffold(
      'Gesture surfaces',
      new SingleChildScrollView(
        new Column(
          [
            new Text(`Drag mode ${this.mode}`, { fontSize: 21, color }),
            new Text(
              `Touch slop ${MediaQuery.gestureSettingsOf(this.context).touchSlop ?? 'framework default'} · Source ${this.context.services.readMetrics().environment?.gestureSettingsSource ?? 'unavailable'}`,
              { fontSize: 14, color },
            ),
            new Text(
              `Started ${this.started} · Dropped ${this.dropped} · Cancelled ${this.cancelled}`,
              { fontSize: 16, color },
            ),
            new Text(
              `Active ${this.active} · Moves ${this.moves} · Captured ${this.captured} · Bubbled ${this.bubbled}`,
              { fontSize: 16, color },
            ),
            new Row([source, new SizedBox(24, 0), target], {
              crossAxisAlignment: 'start',
              mainAxisAlignment: 'center',
            }),
            ...(['Immediate', 'Long press', 'Horizontal', 'Eager'] as const).map(
              (mode) =>
                new FilledButton('surface-mode-' + mode, mode + ' input', () =>
                  this.change(() => {
                    this.mode = mode;
                  }),
                ),
            ),
            new FilledButton(
              'surface-accept',
              this.accepting ? 'Refuse drops' : 'Accept drops',
              () =>
                this.change(() => {
                  this.accepting = !this.accepting;
                }),
            ),
            new TapRegionSurface(
              new Column(
                [
                  new Text(
                    `Inside A ${this.insideA} · B ${this.insideB} · Outside ${this.outside} · Up inside ${this.upInside}`,
                    { fontSize: 16, color },
                  ),
                  new Row([region('A'), new SizedBox(24, 0), region('B')], {
                    crossAxisAlignment: 'start',
                    mainAxisAlignment: 'center',
                  }),
                  outside,
                  new Text(`Outside clicks ${this.outsideClicks}`, { fontSize: 16, color }),
                ],
                { spacing: 8, mainAxisSize: 'min' },
              ),
            ),
            new FilledButton(
              'surface-consume',
              this.consumeOutside ? 'Allow outside taps' : 'Consume outside taps',
              () =>
                this.change(() => {
                  this.consumeOutside = !this.consumeOutside;
                }),
            ),
            cursor,
            new Text(
              `Hover ${this.hovered ? 'inside' : 'outside'} · Entries ${this.entered} · Moves ${this.hoveredMoves} · Exits ${this.exited}`,
              { fontSize: 14, color },
            ),
            new FilledButton(
              'surface-cursor',
              this.cursorText ? 'Use click cursor' : 'Use text cursor',
              () =>
                this.change(() => {
                  this.cursorOverride = null;
                  this.cursorText = !this.cursorText;
                }),
            ),
            ...(wide
              ? [
                  new Row(
                    [
                      new FilledButton('surface-cursor-basic', 'Default cursor', () =>
                        this.change(() => {
                          this.cursorOverride = SystemMouseCursors.basic;
                        }),
                      ),
                      new FilledButton('surface-cursor-disappearing', 'Disappearing cursor', () =>
                        this.change(() => {
                          this.cursorOverride = SystemMouseCursors.disappearing;
                        }),
                      ),
                      new FilledButton('surface-cursor-none', 'Hide cursor', () =>
                        this.change(() => {
                          this.cursorOverride = SystemMouseCursors.none;
                        }),
                      ),
                    ],
                    { mainAxisAlignment: 'center' },
                  ),
                ]
              : [
                  new FilledButton('surface-cursor-basic', 'Default cursor', () =>
                    this.change(() => {
                      this.cursorOverride = SystemMouseCursors.basic;
                    }),
                  ),
                  new FilledButton('surface-cursor-disappearing', 'Disappearing cursor', () =>
                    this.change(() => {
                      this.cursorOverride = SystemMouseCursors.disappearing;
                    }),
                  ),
                  new FilledButton('surface-cursor-none', 'Hide cursor', () =>
                    this.change(() => {
                      this.cursorOverride = SystemMouseCursors.none;
                    }),
                  ),
                ]),
            new FilledButton(
              'surface-groups',
              this.separateGroups ? 'Join tap regions' : 'Separate tap regions',
              () =>
                this.change(() => {
                  this.separateGroups = !this.separateGroups;
                }),
            ),
          ],
          { spacing: 8, mainAxisSize: 'min' },
        ),
        this.scroll,
        this.widget.scheduler,
      ),
      new FilledButton('surface-back', 'Back', this.widget.onBack),
    );
  }
}
