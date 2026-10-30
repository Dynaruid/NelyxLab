// SPDX-License-Identifier: BSD-3-Clause
// Public finite-content policy around the complete generated Viewer state.
import {
  SourceInteractiveViewer,
  SourceInteractiveViewerState,
  SourceTransformationController,
} from './interactive-viewer.generated.ts';
import { Matrix4 } from '../../math/matrix4.ts';
import { dartMethodTearOff } from '../../foundation/dart-method-tear-off.ts';
import { invariant } from '../../foundation/errors.ts';
import { Element } from './framework.ts';
import type { BuildContext, Widget } from './framework.ts';
import { Listener } from './listener.ts';
import { GestureDetector } from './gesture-detector.ts';
import type { ScaleStartDetails, ScaleUpdateDetails, ScaleEndDetails } from '../gestures/scale.ts';
import { PointerScrollEvent, PointerScaleEvent } from '../gestures/events.ts';
import type { PointerSignalEvent } from '../gestures/events.ts';
import { PointerDeviceKind } from '../../ui/pointer.ts';

/** Source uses XYZ uniform scale for getMaxScaleOnAxis; the public copy remains XY. */
export class FiniteViewerTransformer extends SourceTransformationController {
  constructor(
    value: Matrix4,
    private readonly commit: (value: Matrix4) => Matrix4,
  ) {
    super();
    this.synchronize(value);
  }
  synchronize(value: Matrix4): void {
    const copy = value.clone();
    copy.setEntry(2, 2, copy.entry(0, 0));
    this.value = copy;
  }
  transaction(body: () => void): void {
    try {
      body();
    } finally {
      this.synchronize(this.commit(this.value));
    }
  }
}
export interface FiniteViewerPort {
  state: FiniteViewerSourceState | null;
  readonly admitted: () => boolean;
  readonly cancelled: () => boolean;
  readonly inertia: () => boolean;
}
export class FiniteViewerSource extends SourceInteractiveViewer {
  constructor(
    options: ConstructorParameters<typeof SourceInteractiveViewer>[0],
    readonly port: FiniteViewerPort,
  ) {
    super(options);
  }
  override createState(): FiniteViewerSourceState {
    return new FiniteViewerSourceState();
  }
}
export class FiniteViewerSourceState extends SourceInteractiveViewerState {
  private get port(): FiniteViewerPort {
    return (this.widget as FiniteViewerSource).port;
  }
  private get admitted(): boolean {
    return this.mounted && (this.context as Element).active && this.port.admitted();
  }
  private transact(body: () => void): void {
    if (this.admitted)
      (this._dart_bb3c6814efa30c40_transformer as FiniteViewerTransformer).transaction(body);
  }
  override initState(): void {
    super.initState();
    this.port.state = this;
  }
  stopMotion(): void {
    this._dart_bb3c6814efa30c40_animation?.removeListener(
      dartMethodTearOff(this, this._dart_bb3c6814efa30c40_handleInertiaAnimation),
    );
    this._dart_bb3c6814efa30c40_scaleAnimation?.removeListener(
      dartMethodTearOff(this, this._dart_bb3c6814efa30c40_handleScaleAnimation),
    );
    this._dart_bb3c6814efa30c40_animation = null;
    this._dart_bb3c6814efa30c40_scaleAnimation = null;
    this._dart_bb3c6814efa30c40_controller.stop();
    this._dart_bb3c6814efa30c40_scaleController.stop();
  }
  override _dart_bb3c6814efa30c40_onScaleStart(details: ScaleStartDetails): void {
    if (!this.port.cancelled())
      this.transact(() => super._dart_bb3c6814efa30c40_onScaleStart(details));
  }
  override _dart_bb3c6814efa30c40_onScaleUpdate(details: ScaleUpdateDetails): void {
    if (!this.port.cancelled())
      this.transact(() => super._dart_bb3c6814efa30c40_onScaleUpdate(details));
  }
  override _dart_bb3c6814efa30c40_onScaleEnd(details: ScaleEndDetails): void {
    if (this.port.cancelled()) return;
    this.transact(() => {
      super._dart_bb3c6814efa30c40_onScaleEnd(details);
      if (!this.port.inertia()) this.stopMotion();
    });
  }
  override _dart_bb3c6814efa30c40_receivedPointerSignal(event: PointerSignalEvent): void {
    if (
      !this.admitted ||
      (!this.widget.panEnabled && !this.widget.scaleEnabled) ||
      (!(event instanceof PointerScrollEvent) && !(event instanceof PointerScaleEvent))
    )
      return;
    (this.context as Element).owner.gestureBinding.pointerSignalResolver.register(
      event,
      (signal) => {
        if (!this.admitted) {
          signal.respond({ allowPlatformDefault: true });
          return;
        }
        const before = this._dart_bb3c6814efa30c40_transformer.value.clone();
        // The public pan-only API treats wheel deltas as a pan. Source already
        // implements that transform-aware path for trackpad scroll signals.
        const input =
          !this.widget.scaleEnabled && event instanceof PointerScrollEvent
            ? event.copyWith({ kind: PointerDeviceKind.trackpad })
            : event;
        this.transact(() => super._dart_bb3c6814efa30c40_receivedPointerSignal(input));
        signal.respond({
          allowPlatformDefault: before.equals(this._dart_bb3c6814efa30c40_transformer.value),
        });
      },
    );
  }
  // Extreme finite wheel deltas can underflow exp to zero. The public facade
  // saturates at its minimum scale instead of exposing the source assertion.
  override _dart_bb3c6814efa30c40_matrixScale(value: Matrix4, scale: number): Matrix4 {
    return super._dart_bb3c6814efa30c40_matrixScale(value, Math.max(Number.MIN_VALUE, scale));
  }
  override _dart_bb3c6814efa30c40_handleInertiaAnimation(): void {
    this.transact(() => super._dart_bb3c6814efa30c40_handleInertiaAnimation());
  }
  override _dart_bb3c6814efa30c40_handleScaleAnimation(): void {
    this.transact(() => super._dart_bb3c6814efa30c40_handleScaleAnimation());
  }
  override build(context: BuildContext): Widget {
    const built = super.build(context);
    if (this.widget.panEnabled || this.widget.scaleEnabled) return built;
    invariant(
      built instanceof Listener && built.child instanceof GestureDetector,
      'viewer-source-shape',
      'Generated Viewer must retain its Listener/GestureDetector shape',
    );
    return new Listener(
      new GestureDetector(built.child.child, {
        ...built.child.options,
        onScaleStart: null,
        onScaleUpdate: null,
        onScaleEnd: null,
      }),
      built.options,
    );
  }
  override deactivate(): void {
    this.stopMotion();
    super.deactivate();
  }
  override dispose(): void {
    this.port.state = null;
    super.dispose();
  }
}
