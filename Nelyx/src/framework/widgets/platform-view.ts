// SPDX-License-Identifier: BSD-3-Clause
import type { Key } from '../../foundation/key.ts';
import type {
  PlatformViewController,
  PlatformViewReservation,
} from '../../hosting/platform-views.ts';
import type { Size } from '../../ui/geometry.ts';
import { NativeHitTestTarget } from '../gestures/hit-test.ts';
import type { PaintingContext } from '../painting/context.ts';
import { RenderProxyBox } from '../rendering/boxes.ts';
import { BoxConstraints } from '../rendering/constraints.ts';
import { PlatformViewLayer } from '../rendering/layer.ts';
import type { SemanticsConfiguration } from '../semantics/semantics.ts';
import { SingleChildRenderObjectWidget, State, StatefulWidget } from './framework.ts';
import type { BuildContext, Widget } from './framework.ts';

export interface PlatformViewOptions {
  readonly key?: Key | null;
  readonly viewType: string;
  readonly creationParams?: unknown;
  readonly onCreated?: (controller: PlatformViewController) => void;
  readonly onEvent?: (event: unknown) => void;
  readonly fallbackBuilder?: (context: BuildContext, reason?: string) => Widget;
}

/** Embeds a control registered with this View's host. Both axes must be bounded
 * before the host creates it. Change existing controls through their controller. */
export class PlatformView extends StatefulWidget {
  constructor(readonly options: PlatformViewOptions) {
    super(options.key);
  }

  override createState(): State<PlatformView> {
    return new PlatformViewState();
  }
}

class PlatformViewState extends State<PlatformView> {
  private reservation: PlatformViewReservation | undefined;
  private bounded: boolean | undefined;
  private delivered = false;

  override initState(): void {
    this.reserve();
  }

  override didUpdateWidget(old: PlatformView): void {
    if (old.options.viewType === this.widget.options.viewType) return;
    this.reservation?.dispose();
    this.delivered = false;
    this.reserve();
  }

  private reserve(): void {
    const { viewType, creationParams } = this.widget.options;
    this.reservation = this.context.services.platformViews?.reserve(
      viewType,
      creationParams,
      (status) => {
        this.setState(() => {});
        if (status.kind === 'ready' && !this.delivered) {
          this.delivered = true;
          this.widget.options.onCreated?.(status.controller);
        }
      },
      (event) => this.widget.options.onEvent?.(event),
    );
  }

  private readonly reportConstraints = (bounded: boolean) => {
    if ((this.bounded ?? true) === bounded) return;
    this.setState(() => {
      this.bounded = bounded;
    });
  };

  override build(context: BuildContext): Widget {
    const status = this.reservation?.status;
    const reason =
      this.bounded === false
        ? 'Platform views require bounded width and height'
        : !status
          ? 'This View has no platform view host'
          : status.kind === 'unavailable'
            ? status.reason
            : undefined;
    const visible = reason === undefined && status?.kind === 'ready';
    return new PlatformViewBox(
      this.reservation,
      visible,
      this.reportConstraints,
      visible ? undefined : this.widget.options.fallbackBuilder?.(context, reason),
    );
  }

  override dispose(): void {
    this.reservation?.dispose();
  }
}

class PlatformViewBox extends SingleChildRenderObjectWidget {
  constructor(
    readonly reservation: PlatformViewReservation | undefined,
    readonly visible: boolean,
    readonly reportConstraints: (bounded: boolean) => void,
    child: Widget | undefined,
  ) {
    super(child);
  }

  override createRenderObject(): RenderPlatformView {
    return new RenderPlatformView(this.reservation, this.visible, this.reportConstraints);
  }

  override updateRenderObject(_context: BuildContext, render: RenderPlatformView): void {
    render.update(this.reservation, this.visible);
  }
}

export class RenderPlatformView extends NativeHitTestTarget(
  RenderProxyBox,
  (target) => (target as { platformViewId?: number }).platformViewId !== undefined,
) {
  private bounded = true;

  constructor(
    private reservation: PlatformViewReservation | undefined,
    private visible: boolean,
    private readonly reportConstraints: (bounded: boolean) => void,
  ) {
    super();
  }

  get platformViewId(): number | undefined {
    return this.visible &&
      this.bounded &&
      this.hasSize &&
      this.size.width > 0 &&
      this.size.height > 0
      ? this.reservation?.identity.instanceId
      : undefined;
  }

  update(reservation: PlatformViewReservation | undefined, visible: boolean): void {
    if (this.reservation === reservation && this.visible === visible) return;
    this.reservation = reservation;
    this.visible = visible;
    this.markNeedsLayout();
    this.markNeedsSemanticsUpdate();
  }

  override get alwaysNeedsCompositing(): boolean {
    return true;
  }

  protected override performLayout(constraints: BoxConstraints): Size {
    const bounded = constraints.hasBoundedWidth && constraints.hasBoundedHeight;
    if (bounded !== this.bounded) {
      this.bounded = bounded;
      void Promise.resolve().then(() => {
        if (this.attached && this.bounded === bounded) this.reportConstraints(bounded);
      });
    }
    if (!bounded) return super.performLayout(constraints);
    this.reservation?.start();
    if (this.child) super.performLayout(BoxConstraints.tight(constraints.biggest));
    return constraints.biggest;
  }

  protected override computeDryLayout(constraints: BoxConstraints): Size {
    return constraints.hasBoundedWidth && constraints.hasBoundedHeight
      ? constraints.biggest
      : super.computeDryLayout(constraints);
  }

  protected override hitTestSelf(): boolean {
    return this.platformViewId !== undefined;
  }

  override describeSemanticsConfiguration(config: SemanticsConfiguration): void {
    super.describeSemanticsConfiguration(config);
    const id = this.platformViewId;
    if (id === undefined) return;
    config.isSemanticBoundary = true;
    config.platformViewId = id;
  }

  override paint(context: PaintingContext): void {
    const reservation = this.reservation;
    if (this.bounded && reservation?.created) {
      context.addLayer(
        new PlatformViewLayer({
          instanceId: reservation.identity.instanceId,
          rect: this.paintBounds,
          visible: this.platformViewId !== undefined,
        }),
      );
    }
    super.paint(context);
  }
}

/** @internal A Nelyx modal owns pointer input above preceding platform views,
 * including the region covered by passive children of the modal itself. */
export class PlatformViewModalBarrier extends SingleChildRenderObjectWidget {
  override createRenderObject(): RenderProxyBox {
    return new (class extends RenderProxyBox {
      override get alwaysNeedsCompositing(): boolean {
        return true;
      }
      override paint(context: PaintingContext): void {
        context.addLayer(new PlatformViewLayer({ barrier: this.paintBounds }));
        super.paint(context);
      }
    })();
  }
}
