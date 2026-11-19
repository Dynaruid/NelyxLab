// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/cupertino/dialog.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { GestureDisposition } from '@nelyx/core/framework/gestures/arena';
import type { GestureBinding } from '@nelyx/core/framework/gestures/binding';
import {
  PointerCancelEvent,
  PointerMoveEvent,
  PointerPanZoomEndEvent,
  PointerPanZoomUpdateEvent,
  PointerUpEvent,
  computeHitSlop,
  kPrimaryButton,
} from '@nelyx/core/framework/gestures/events';
import type {
  PointerDownEvent,
  PointerEvent,
  PointerPanZoomStartEvent,
} from '@nelyx/core/framework/gestures/events';
import { HitTestResult } from '@nelyx/core/framework/gestures/hit-test';
import { OneSequenceGestureRecognizer } from '@nelyx/core/framework/gestures/recognizer';
import { RenderMetaData } from '@nelyx/core/framework/rendering/meta-data';
import { HitTestBehavior } from '@nelyx/core/framework/rendering/pointer-listener';
import { ColoredBox, MetaData } from '@nelyx/core/framework/widgets/basic';
import {
  Element,
  InheritedWidget,
  State,
  StatefulWidget,
} from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import {
  GestureRecognizerFactoryWithHandlers,
  RawGestureDetector,
} from '@nelyx/core/framework/widgets/raw-gesture-detector';
import { MergeSemantics } from '@nelyx/core/framework/widgets/semantics';

export interface DialogSlideTarget {
  didEnter(fromPointerDown: boolean, innerEnabled: boolean): boolean;
  didLeave(): void;
  didConfirm(): void;
}

export class DialogSlideScope extends InheritedWidget {
  constructor(
    readonly group: object,
    child: Widget,
  ) {
    super(child);
  }

  override updateShouldNotify(old: DialogSlideScope): boolean {
    return this.group !== old.group;
  }
}

class DialogSlideHit {
  constructor(
    readonly group: object,
    readonly target: DialogSlideTarget,
  ) {}
}

export function dialogSlideRegion(
  scope: DialogSlideScope | undefined,
  target: DialogSlideTarget,
  child: Widget,
): Widget {
  return scope
    ? new MetaData(child, {
        behavior: HitTestBehavior.opaque,
        metaData: new DialogSlideHit(scope.group, target),
      })
    : child;
}

export function dialogSelectionClick(context: BuildContext): void {
  const platform = FoundationPlatform.defaultTargetPlatform;
  if (platform !== 'iOS' && platform !== 'android') return;
  const services = context.services;
  const channel = services.platformServices?.channels.platform;
  if (channel)
    void channel
      .invokeMethod('HapticFeedback.vibrate', 'HapticFeedbackType.selectionClick')
      .catch((error: unknown) => services.reportError?.(error));
}

export class DialogActionBackground extends StatefulWidget {
  constructor(
    readonly child: Widget,
    readonly idleColor: number,
    readonly pressedColor: number,
    readonly onHighlight?: (pressed: boolean) => void,
  ) {
    super();
  }

  override createState(): State<DialogActionBackground> {
    return new DialogActionBackgroundState();
  }
}

class DialogActionBackgroundState
  extends State<DialogActionBackground>
  implements DialogSlideTarget
{
  private pressed = false;

  private setPressed(value: boolean): void {
    if (!this.mounted || !(this.context as Element).active || value === this.pressed) return;
    this.setState(() => {
      this.pressed = value;
    });
    this.widget.onHighlight?.(value);
  }

  didEnter(fromPointerDown: boolean, innerEnabled: boolean): boolean {
    this.setPressed(innerEnabled);
    if (innerEnabled && !fromPointerDown && this.mounted) dialogSelectionClick(this.context);
    return innerEnabled;
  }

  didLeave(): void {
    this.setPressed(false);
  }
  didConfirm(): void {}

  override build(context: BuildContext): Widget {
    return dialogSlideRegion(
      context.maybeDependOn(DialogSlideScope),
      this,
      new MergeSemantics({
        child: new ColoredBox({
          child: this.widget.child,
          color: this.pressed ? this.widget.pressedColor : this.widget.idleColor,
        }),
      }),
    );
  }
}

export class DialogSlidingActions extends StatefulWidget {
  constructor(readonly child: Widget) {
    super();
  }

  override createState(): State<DialogSlidingActions> {
    return new DialogSlidingActionsState();
  }
}

class DialogSlidingActionsState extends State<DialogSlidingActions> {
  private readonly group = {};

  override build(context: BuildContext): Widget {
    const binding = (context as Element).owner.gestureBinding;
    const gestures = new Map([
      [
        SlidingActionRecognizer,
        new GestureRecognizerFactoryWithHandlers(
          SlidingActionRecognizer,
          () => new SlidingActionRecognizer(binding, this.group),
          () => {},
        ),
      ],
    ]);
    return new RawGestureDetector(new DialogSlideScope(this.group, this.widget.child), {
      gestures,
      excludeFromSemantics: true,
    });
  }
}

class SlidingActionRecognizer extends OneSequenceGestureRecognizer {
  private pointer: number | null = null;
  private downY = 0;
  private accepted = false;
  private dragAccepted = false;
  private lifted = false;
  private readonly secondaryPointers = new Map<number, number>();
  private targets: readonly DialogSlideTarget[] = [];

  constructor(
    binding: GestureBinding,
    private readonly group: object,
  ) {
    super({ binding, allowedButtonsFilter: (buttons) => buttons === kPrimaryButton });
  }

  override get debugDescription(): string {
    return 'dialog sliding tap';
  }

  protected override handleNonAllowedPointer(): void {}

  protected override addAllowedPointer(event: PointerDownEvent): void {
    if (this.pointer !== null) {
      this.trackSecondary(event, event.position.dy);
      return;
    }
    super.addAllowedPointer(event);
    this.pointer = event.pointer;
    this.downY = event.position.dy;
    this.updateTargets(event, true);
    if (this.dragAccepted) this.resolvePointer(event.pointer, GestureDisposition.accepted);
  }

  protected override addAllowedPointerPanZoom(event: PointerPanZoomStartEvent): void {
    this.trackSecondary(event, 0);
  }

  private trackSecondary(event: PointerEvent, startY: number): void {
    this.startTrackingPointer(event.pointer, event.transform);
    this.secondaryPointers.set(event.pointer, startY);
    if (this.dragAccepted) this.resolvePointer(event.pointer, GestureDisposition.accepted);
  }

  private releaseSecondary(pointer: number): void {
    if (!this.secondaryPointers.delete(pointer)) return;
    this.stopTrackingPointer(pointer);
    this.resolvePointer(pointer, GestureDisposition.rejected);
    if (this.pointer === null && this.secondaryPointers.size === 0) this.dragAccepted = false;
  }

  private handleSecondaryEvent(event: PointerEvent): void {
    const startY = this.secondaryPointers.get(event.pointer);
    if (startY === undefined) return;
    if (
      event instanceof PointerUpEvent ||
      event instanceof PointerCancelEvent ||
      event instanceof PointerPanZoomEndEvent ||
      (event instanceof PointerMoveEvent && event.buttons !== kPrimaryButton)
    ) {
      this.releaseSecondary(event.pointer);
      return;
    }
    const distance =
      event instanceof PointerPanZoomUpdateEvent
        ? event.pan.dy
        : event instanceof PointerMoveEvent
          ? event.position.dy - startY
          : 0;
    if (!this.dragAccepted && Math.abs(distance) > computeHitSlop(event.kind, this.gestureSettings))
      this.resolve(GestureDisposition.accepted);
  }

  protected override handleEvent(event: PointerEvent): void {
    if (event.pointer !== this.pointer) {
      this.handleSecondaryEvent(event);
      return;
    }
    if (event instanceof PointerMoveEvent && event.buttons === kPrimaryButton) {
      this.updateTargets(event, false);
      if (
        !this.accepted &&
        Math.abs(event.position.dy - this.downY) > computeHitSlop(event.kind, this.gestureSettings)
      )
        this.resolve(GestureDisposition.accepted);
      return;
    }
    if (event instanceof PointerUpEvent) {
      this.updateTargets(event, false);
      this.lifted = true;
      if (this.accepted) this.finish(true);
      // A short tap waits for the arena sweep. Inner legacy tap handlers take precedence.
      else this.stopTrackingPointer(event.pointer, event);
      return;
    }
    if (event instanceof PointerCancelEvent || event instanceof PointerMoveEvent) {
      this.resolvePointer(event.pointer, GestureDisposition.rejected);
      this.finish(false);
    }
  }

  override acceptGesture(pointer: number): void {
    const primary = pointer === this.pointer;
    if (!primary && !this.secondaryPointers.has(pointer)) return;
    this.resolvePointer(pointer, GestureDisposition.accepted);
    if (!this.dragAccepted) {
      this.dragAccepted = true;
      this.resolve(GestureDisposition.accepted);
    }
    if (primary && pointer === this.pointer) {
      this.accepted = true;
      if (this.lifted) this.finish(true);
    }
  }

  override rejectGesture(pointer: number): void {
    if (pointer !== this.pointer) {
      this.releaseSecondary(pointer);
      return;
    }
    this.finish(false);
    this.resolvePointer(pointer, GestureDisposition.rejected);
  }

  protected override didStopTrackingLastPointer(): void {}

  private updateTargets(event: PointerEvent, fromPointerDown: boolean): void {
    this.invokeCallback('slideUpdate', () => {
      const hit = new HitTestResult();
      this.binding.hitTestInView(hit, event.position, event.viewId);
      const targets: DialogSlideTarget[] = [];
      for (const entry of hit.path) {
        const render = entry.target;
        if (!(render instanceof RenderMetaData)) continue;
        const metadata = render.metaData;
        if (metadata instanceof DialogSlideHit && metadata.group === this.group)
          targets.push(metadata.target);
      }
      if (this.targets[0] === targets[0]) return;
      for (const target of this.targets) target.didLeave();
      this.targets = targets;
      let enabled = true;
      for (const target of targets) enabled = target.didEnter(fromPointerDown, enabled);
    });
  }

  private finish(confirm: boolean): void {
    const pointer = this.pointer;
    if (pointer === null) return;
    const targets = this.targets;
    this.pointer = null;
    this.targets = [];
    this.accepted = false;
    this.lifted = false;
    if (this.secondaryPointers.size === 0) this.dragAccepted = false;
    this.stopTrackingPointer(pointer);
    this.invokeCallback('slideEnd', () => {
      for (const target of targets) target.didLeave();
      if (confirm) for (const target of targets) target.didConfirm();
    });
  }

  override dispose(): void {
    try {
      this.finish(false);
    } finally {
      try {
        super.dispose();
      } finally {
        this.secondaryPointers.clear();
      }
    }
  }
}
