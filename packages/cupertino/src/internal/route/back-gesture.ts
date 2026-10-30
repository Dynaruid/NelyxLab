// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { StatefulWidget, State, Element } from '@nelyx/core/framework/widgets/framework';
import type { Widget, BuildContext } from '@nelyx/core/framework/widgets/framework';
import type { PageRoute } from '@nelyx/core/framework/widgets/pages';
import { pageRouteTransitionBinding } from '@nelyx/core/internal/framework/widgets/page-route-gesture';
import { Curves } from '@nelyx/core/framework/animation/curves';
import type { AnimationStatusListener } from '@nelyx/core/framework/animation/animation';
import { HorizontalDragGestureRecognizer } from '@nelyx/core/framework/gestures/monodrag';
import type {
  DragUpdateDetails,
  DragEndDetails,
} from '@nelyx/core/framework/gestures/drag-details';
import type { PointerDownEvent } from '@nelyx/core/framework/gestures/events';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { Listener } from '@nelyx/core/framework/widgets/listener';
import { Stack, PositionedDirectional } from '@nelyx/core/framework/widgets/basic';
import { HitTestBehavior } from '@nelyx/core/framework/rendering/pointer-listener';
import { RenderBox } from '@nelyx/core/framework/rendering/object';
import { invariant } from '@nelyx/core/foundation/errors';

/** @dartType double */
const backGestureWidth = 20;
/** @dartType double */
const minFlingVelocity = 1;
const droppedSwipeDuration = 350;
/** Own typed contact to the single mounted Navigator route/controller lifetime. */
type Binding = NonNullable<ReturnType<typeof pageRouteTransitionBinding>>;
export class CupertinoBackGestureController {
  private closed = false;
  private statusListener: AnimationStatusListener | null = null;
  private removeRetirement: (() => void) | null = null;
  constructor(private readonly binding: Binding) {
    binding.navigator.didStartUserGesture();
    this.removeRetirement = binding.addRetirementListener(() => this.close());
  }
  /** @dartParam delta double */
  dragUpdate(delta: number): void {
    if (!this.closed) this.binding.animation.value -= delta;
  }
  /** @dartParam velocity double */
  dragEnd(velocity: number): void {
    if (this.closed) return;
    const {
        animation: controller,
        navigator,
        isCurrent: getIsCurrent,
        isActive: getIsActive,
      } = this.binding,
      isCurrent = getIsCurrent();
    const animateForward = !isCurrent
      ? getIsActive()
      : Math.abs(velocity) >= minFlingVelocity
        ? velocity <= 0
        : controller.value > 0.5;
    if (animateForward)
      controller.animateTo(1, {
        duration: droppedSwipeDuration,
        curve: Curves.fastEaseInToSlowEaseOut,
      });
    else {
      if (isCurrent) navigator.pop();
      if (controller.isAnimating)
        controller.animateBack(0, {
          duration: droppedSwipeDuration,
          curve: Curves.fastEaseInToSlowEaseOut,
        });
    }
    if (controller.isAnimating) {
      this.statusListener = () => this.close();
      controller.addStatusListener(this.statusListener);
    } else this.close();
  }
  // The route owns the animation. Retiring it cancels this borrowed gesture.
  close(): void {
    if (this.closed) return;
    this.closed = true;
    const remove = this.removeRetirement;
    this.removeRetirement = null;
    remove?.();
    if (this.statusListener) this.binding.animation.removeStatusListener(this.statusListener);
    this.statusListener = null;
    if (this.binding.navigator.isAttached && this.binding.navigator.userGestureInProgress)
      this.binding.navigator.didStopUserGesture();
  }
}
export function startCupertinoBackGesture<T>(route: PageRoute<T>): CupertinoBackGestureController {
  invariant(
    route.popGestureEnabled,
    'disabled-cupertino-pop-gesture',
    'The current route cannot start a back gesture',
  );
  const binding = pageRouteTransitionBinding(route);
  invariant(binding, 'unmounted-cupertino-route', 'Back gesture requires a mounted route');
  return new CupertinoBackGestureController(binding);
}
export class CupertinoBackGestureDetector extends StatefulWidget {
  constructor(
    readonly enabledCallback: () => boolean,
    readonly onStartPopGesture: () => CupertinoBackGestureController,
    readonly child: Widget,
  ) {
    super();
  }
  createState(): State {
    return new CupertinoBackGestureDetectorState();
  }
}
class CupertinoBackGestureDetectorState extends State<CupertinoBackGestureDetector> {
  private recognizer!: HorizontalDragGestureRecognizer;
  private gesture: CupertinoBackGestureController | null = null;
  private readonly start = () => {
    invariant(
      this.gesture === null,
      'duplicate-cupertino-drag',
      'A back gesture is already tracking',
    );
    this.gesture = this.widget.onStartPopGesture();
  };
  private readonly handleDragUpdate = (details: DragUpdateDetails) => {
    invariant(
      this.gesture !== null && details.primaryDelta !== null,
      'missing-cupertino-drag',
      'Back drag update requires an active horizontal gesture',
    );
    this.gesture.dragUpdate(this.toLogical(details.primaryDelta / this.width()));
  };
  private readonly end = (details: DragEndDetails) => {
    invariant(
      this.gesture !== null,
      'missing-cupertino-drag',
      'Back drag end requires an active gesture',
    );
    const gesture = this.gesture;
    this.gesture = null;
    gesture.dragEnd(this.toLogical(details.velocity.pixelsPerSecond.dx / this.width()));
  };
  private readonly cancel = () => {
    const gesture = this.gesture;
    this.gesture = null;
    gesture?.dragEnd(0);
  };
  private readonly down = (event: PointerDownEvent) => {
    if (this.widget.enabledCallback()) this.recognizer.addPointer(event);
  };
  override initState(): void {
    super.initState();
    invariant(
      this.context instanceof Element,
      'invalid-context',
      'Cupertino drag requires its actual View',
    );
    this.recognizer = new HorizontalDragGestureRecognizer({
      binding: this.context.owner.gestureBinding,
      debugOwner: this,
    });
    this.recognizer.onStart = this.start;
    this.recognizer.onUpdate = this.handleDragUpdate;
    this.recognizer.onEnd = this.end;
    this.recognizer.onCancel = this.cancel;
  }
  private width(): number {
    const render = this.context.findRenderObject();
    invariant(
      render instanceof RenderBox && render.size.width > 0,
      'missing-cupertino-drag-size',
      'Back gesture requires a laid-out positive route width',
    );
    return render.size.width;
  }
  /** @dartParam value double
   * @dartReturn double */
  private toLogical(value: number): number {
    return Directionality.of(this.context) === 'rtl' ? -value : value;
  }
  override dispose(): void {
    this.recognizer.dispose();
    const gesture = this.gesture;
    this.gesture = null;
    if (gesture) {
      invariant(
        this.context instanceof Element,
        'invalid-context',
        'Cupertino drag requires its actual View',
      );
      this.context.owner.postFrame(() => gesture.close());
    }
    super.dispose();
  }
  build(context: BuildContext): Widget {
    const padding = MediaQuery.of(context).safeArea;
    /** @dartType double */
    const dragAreaWidth = Directionality.of(context) === 'rtl' ? padding.right : padding.left;
    return new Stack(
      [
        this.widget.child,
        new PositionedDirectional(
          new Listener(null, { onPointerDown: this.down, behavior: HitTestBehavior.translucent }),
          { start: 0, width: Math.max(dragAreaWidth, backGestureWidth), top: 0, bottom: 0 },
        ),
      ],
      { fit: 'passthrough' },
    );
  }
}
