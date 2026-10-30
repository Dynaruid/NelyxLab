// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/rendering/list_wheel_viewport.dart; SHA256 fcf565b043029714852ad1a74c96164432345bce8efa7ef267ab0e796ec43241
// Adopted product owner: nominal checks use the classes declared here.
import { WheelRenderHost } from './list-wheel-renderer-adapter.ts';
import { WheelContainerParentData } from './list-wheel-renderer-adapter.ts';
import { createWheelClipHandle } from './list-wheel-renderer-adapter.ts';
import { createWheelOpacityHandle } from './list-wheel-renderer-adapter.ts';
import { wheelBoxSize } from './list-wheel-renderer-adapter.ts';
import { wheelConstraintsBiggest } from './list-wheel-renderer-adapter.ts';
import { wheelParentData } from './list-wheel-renderer-adapter.ts';
import { wheelParent } from './list-wheel-renderer-adapter.ts';
import { wheelPaintBounds } from './list-wheel-renderer-adapter.ts';
import { wheelParentOffset } from './list-wheel-renderer-adapter.ts';
import { wheelPushClipRect } from './list-wheel-renderer-adapter.ts';
import { wheelPushOpacity } from './list-wheel-renderer-adapter.ts';
import { wheelPushTransform } from './list-wheel-renderer-adapter.ts';
import { wheelPaintChild } from './list-wheel-renderer-adapter.ts';
import { wheelGetTransform } from './list-wheel-renderer-adapter.ts';
import { wheelRemovePerspective } from './list-wheel-renderer-adapter.ts';
import { wheelBoxHitTest } from './list-wheel-renderer-adapter.ts';
import { WheelBoxHitTestResult } from './list-wheel-renderer-adapter.ts';
import { wheelOffsetString } from './list-wheel-renderer-adapter.ts';
import { isWheelBox } from './list-wheel-renderer-adapter.ts';
import { isWheelConstraints } from './list-wheel-renderer-adapter.ts';
import { RenderBox } from './object.ts';
import { RenderObject } from './object.ts';
import { BoxConstraints } from './constraints.ts';
import { LayerHandle } from './layer.ts';
import { Offset } from '../../ui/offset.ts';
import { Size } from '../../ui/size.ts';
import { Rect } from '../../ui/rect.ts';
import { Matrix4 } from '../../math/matrix4.ts';
import { MatrixUtils } from '../painting/matrix-utils.ts';
import { Alignment } from '../painting/alignment.ts';
import { Curves } from '../animation/curves.ts';
import { FlutterError } from '../../foundation/flutter-error.ts';
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { invariant } from '../../foundation/errors.ts';
import { protect } from '../../ui/value-math.ts';
import { checkedInteger } from '../../ui/value-math.ts';
import { roundInteger } from '../../ui/value-math.ts';
import { dartMethodTearOff } from '../../foundation/dart-method-tear-off.ts';
import { createWheelRevealedOffset } from './list-wheel-renderer-adapter.ts';
import { isWheelRenderObject } from './list-wheel-renderer-adapter.ts';
import type { PipelineOwner } from './object.ts';
import type { WheelViewportContract } from './list-wheel-renderer-adapter.ts';
import type { RevealedOffset } from './viewport.ts';
import type { ViewportOffset } from './viewport-offset.ts';
import type { ClipRectLayer } from './layer.ts';
import type { OpacityLayer } from './layer.ts';
import type { PaintingContext } from '../painting/context.ts';
import type { Clip } from '../../ui/clip.ts';
import type { Axis } from '../painting/basic-types.ts';
import type { Curve } from '../animation/curves.ts';
import type { DartList } from '../../foundation/dart-list.ts';
export abstract class SourceListWheelChildManager {
  constructor() {}
  /**
   * @dartReturn int?
   * @dartReturnOrigin explicit
   */
  abstract get childCount(): number | null;
  /**
   * @dartParam index int
   * @dartParamOrigin index explicit
   */
  abstract childExistsAt(index: number): boolean;
  /**
   * @dartParam index int
   * @dartParamOrigin index explicit
   */
  abstract createChild(
    index: number,
    {
      after,
    }: {
      readonly after: RenderBox | null;
    },
  ): void;
  abstract removeChild(child: RenderBox): void;
}
export class SourceListWheelParentData extends WheelContainerParentData<RenderBox> {
  /**
   * @dartType int?
   * @dartTypeOrigin explicit
   */
  index: number | null;
  transform: Matrix4 | null;
  constructor() {
    super();
    this.index = null;
    this.transform = null;
  }
}
export class SourceRenderListWheelViewport
  extends WheelRenderHost
  implements WheelViewportContract
{
  readonly childManager: SourceListWheelChildManager;
  _dart_5bcb85ae98e6dd3d_offset: ViewportOffset;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  _dart_5bcb85ae98e6dd3d_diameterRatio: number;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  _dart_5bcb85ae98e6dd3d_perspective: number;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  _dart_5bcb85ae98e6dd3d_offAxisFraction: number;
  _dart_5bcb85ae98e6dd3d_useMagnifier: boolean;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  _dart_5bcb85ae98e6dd3d_magnification: number;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  _dart_5bcb85ae98e6dd3d_overAndUnderCenterOpacity: number;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  _dart_5bcb85ae98e6dd3d_itemExtent: number;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  _dart_5bcb85ae98e6dd3d_squeeze: number;
  _dart_5bcb85ae98e6dd3d_renderChildrenOutsideViewport: boolean;
  _dart_5bcb85ae98e6dd3d_clipBehavior: Clip;
  readonly _dart_5bcb85ae98e6dd3d_clipRectLayer: LayerHandle<ClipRectLayer>;
  readonly _dart_5bcb85ae98e6dd3d_childOpacityLayerHandler: LayerHandle<OpacityLayer>;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  static readonly defaultDiameterRatio: number = 2;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  static readonly defaultPerspective: number = 0.003;
  static readonly diameterRatioZeroMessage: string =
    "You can't set a diameterRatio of 0 or of a negative number. It would imply a cylinder of 0 in diameter in which case nothing will be drawn.";
  static readonly perspectiveTooHighMessage: string =
    'A perspective too high will be clipped in the z-axis and therefore not renderable. Value must be between 0 and 0.01.';
  static readonly clipBehaviorAndRenderChildrenOutsideViewportConflict: string =
    'Cannot renderChildrenOutsideViewport and clip since children rendered outside will be clipped anyway.';
  /**
   * @dartParam diameterRatio double
   * @dartParamOrigin diameterRatio explicit
   * @dartParam perspective double
   * @dartParamOrigin perspective explicit
   * @dartParam offAxisFraction double
   * @dartParamOrigin offAxisFraction inferred
   * @dartParam magnification double
   * @dartParamOrigin magnification explicit
   * @dartParam overAndUnderCenterOpacity double
   * @dartParamOrigin overAndUnderCenterOpacity explicit
   * @dartParam itemExtent double
   * @dartParamOrigin itemExtent explicit
   * @dartParam squeeze double
   * @dartParamOrigin squeeze explicit
   */
  constructor({
    childManager,
    offset,
    diameterRatio = SourceRenderListWheelViewport.defaultDiameterRatio,
    perspective = SourceRenderListWheelViewport.defaultPerspective,
    offAxisFraction = 0,
    useMagnifier = false,
    magnification = 1,
    overAndUnderCenterOpacity = 1,
    itemExtent,
    squeeze = 1,
    renderChildrenOutsideViewport = false,
    clipBehavior = 'none',
    children = null,
  }: {
    readonly childManager: SourceListWheelChildManager;
    readonly offset: ViewportOffset;
    readonly diameterRatio?: number;
    readonly perspective?: number;
    readonly offAxisFraction?: number;
    readonly useMagnifier?: boolean;
    readonly magnification?: number;
    readonly overAndUnderCenterOpacity?: number;
    readonly itemExtent: number;
    readonly squeeze?: number;
    readonly renderChildrenOutsideViewport?: boolean;
    readonly clipBehavior?: Clip;
    readonly children?: DartList<RenderBox> | null;
  }) {
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const _initialField0 = 0;
    const _initialField1 = false;
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const _initialField2 = 1;
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const _initialField3 = 1;
    const _initialField4 = 'hardEdge';
    const _initialField5 = createWheelClipHandle();
    const _initialField6 = createWheelOpacityHandle();
    const _initialField7 = childManager;
    const _initialField8 = offset;
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const _initialField9 = offAxisFraction;
    const _initialField10 = useMagnifier;
    if (FoundationBuildMode.debug)
      invariant(
        diameterRatio > 0,
        'invalid-source-wheel-renderer',
        SourceRenderListWheelViewport.diameterRatioZeroMessage,
      );
    if (FoundationBuildMode.debug)
      invariant(
        perspective > 0,
        'invalid-source-wheel-renderer',
        'Pinned wheel renderer invariant',
      );
    if (FoundationBuildMode.debug)
      invariant(
        perspective <= 0.01,
        'invalid-source-wheel-renderer',
        SourceRenderListWheelViewport.perspectiveTooHighMessage,
      );
    if (FoundationBuildMode.debug)
      invariant(
        magnification > 0,
        'invalid-source-wheel-renderer',
        'Pinned wheel renderer invariant',
      );
    if (FoundationBuildMode.debug)
      invariant(
        overAndUnderCenterOpacity >= 0 && overAndUnderCenterOpacity <= 1,
        'invalid-source-wheel-renderer',
        'Pinned wheel renderer invariant',
      );
    if (FoundationBuildMode.debug)
      invariant(squeeze > 0, 'invalid-source-wheel-renderer', 'Pinned wheel renderer invariant');
    if (FoundationBuildMode.debug)
      invariant(itemExtent > 0, 'invalid-source-wheel-renderer', 'Pinned wheel renderer invariant');
    if (FoundationBuildMode.debug)
      invariant(
        !renderChildrenOutsideViewport || clipBehavior === 'none',
        'invalid-source-wheel-renderer',
        SourceRenderListWheelViewport.clipBehaviorAndRenderChildrenOutsideViewportConflict,
      );
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const _initialField11 = diameterRatio;
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const _initialField12 = perspective;
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const _initialField13 = magnification;
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const _initialField14 = overAndUnderCenterOpacity;
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const _initialField15 = itemExtent;
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const _initialField16 = squeeze;
    const _initialField17 = renderChildrenOutsideViewport;
    const _initialField18 = clipBehavior;
    super();
    this.childManager = _initialField7;
    this._dart_5bcb85ae98e6dd3d_offset = _initialField8;
    this._dart_5bcb85ae98e6dd3d_diameterRatio = _initialField11;
    this._dart_5bcb85ae98e6dd3d_perspective = _initialField12;
    this._dart_5bcb85ae98e6dd3d_offAxisFraction = _initialField9;
    this._dart_5bcb85ae98e6dd3d_useMagnifier = _initialField10;
    this._dart_5bcb85ae98e6dd3d_magnification = _initialField13;
    this._dart_5bcb85ae98e6dd3d_overAndUnderCenterOpacity = _initialField14;
    this._dart_5bcb85ae98e6dd3d_itemExtent = _initialField15;
    this._dart_5bcb85ae98e6dd3d_squeeze = _initialField16;
    this._dart_5bcb85ae98e6dd3d_renderChildrenOutsideViewport = _initialField17;
    this._dart_5bcb85ae98e6dd3d_clipBehavior = _initialField18;
    this._dart_5bcb85ae98e6dd3d_clipRectLayer = _initialField5;
    this._dart_5bcb85ae98e6dd3d_childOpacityLayerHandler = _initialField6;
    protect(this, [
      'childManager',
      '_dart_5bcb85ae98e6dd3d_clipRectLayer',
      '_dart_5bcb85ae98e6dd3d_childOpacityLayerHandler',
    ]);
    this.addAll(children);
  }
  get offset(): ViewportOffset {
    return this._dart_5bcb85ae98e6dd3d_offset;
  }
  set offset(value: ViewportOffset) {
    if (value === this._dart_5bcb85ae98e6dd3d_offset) {
      return;
    }
    if (this.attached) {
      this._dart_5bcb85ae98e6dd3d_offset.removeListener(
        dartMethodTearOff(this, this._dart_5bcb85ae98e6dd3d_hasScrolled),
      );
    }
    this._dart_5bcb85ae98e6dd3d_offset = value;
    if (this.attached) {
      this._dart_5bcb85ae98e6dd3d_offset.addListener(
        dartMethodTearOff(this, this._dart_5bcb85ae98e6dd3d_hasScrolled),
      );
    }
    this.markNeedsLayout();
  }
  /**
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  get diameterRatio(): number {
    return this._dart_5bcb85ae98e6dd3d_diameterRatio;
  }
  /**
   * @dartParam value double
   * @dartParamOrigin value explicit
   */
  set diameterRatio(value: number) {
    if (FoundationBuildMode.debug)
      invariant(
        value > 0,
        'invalid-source-wheel-renderer',
        SourceRenderListWheelViewport.diameterRatioZeroMessage,
      );
    if (value === this._dart_5bcb85ae98e6dd3d_diameterRatio) {
      return;
    }
    this._dart_5bcb85ae98e6dd3d_diameterRatio = value;
    this.markNeedsPaint();
    this.markNeedsSemanticsUpdate();
  }
  /**
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  get perspective(): number {
    return this._dart_5bcb85ae98e6dd3d_perspective;
  }
  /**
   * @dartParam value double
   * @dartParamOrigin value explicit
   */
  set perspective(value: number) {
    if (FoundationBuildMode.debug)
      invariant(value > 0, 'invalid-source-wheel-renderer', 'Pinned wheel renderer invariant');
    if (FoundationBuildMode.debug)
      invariant(
        value <= 0.01,
        'invalid-source-wheel-renderer',
        SourceRenderListWheelViewport.perspectiveTooHighMessage,
      );
    if (value === this._dart_5bcb85ae98e6dd3d_perspective) {
      return;
    }
    this._dart_5bcb85ae98e6dd3d_perspective = value;
    this.markNeedsPaint();
    this.markNeedsSemanticsUpdate();
  }
  /**
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  get offAxisFraction(): number {
    return this._dart_5bcb85ae98e6dd3d_offAxisFraction;
  }
  /**
   * @dartParam value double
   * @dartParamOrigin value explicit
   */
  set offAxisFraction(value: number) {
    if (value === this._dart_5bcb85ae98e6dd3d_offAxisFraction) {
      return;
    }
    this._dart_5bcb85ae98e6dd3d_offAxisFraction = value;
    this.markNeedsPaint();
  }
  get useMagnifier(): boolean {
    return this._dart_5bcb85ae98e6dd3d_useMagnifier;
  }
  set useMagnifier(value: boolean) {
    if (value === this._dart_5bcb85ae98e6dd3d_useMagnifier) {
      return;
    }
    this._dart_5bcb85ae98e6dd3d_useMagnifier = value;
    this.markNeedsPaint();
  }
  /**
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  get magnification(): number {
    return this._dart_5bcb85ae98e6dd3d_magnification;
  }
  /**
   * @dartParam value double
   * @dartParamOrigin value explicit
   */
  set magnification(value: number) {
    if (FoundationBuildMode.debug)
      invariant(value > 0, 'invalid-source-wheel-renderer', 'Pinned wheel renderer invariant');
    if (value === this._dart_5bcb85ae98e6dd3d_magnification) {
      return;
    }
    this._dart_5bcb85ae98e6dd3d_magnification = value;
    this.markNeedsPaint();
  }
  /**
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  get overAndUnderCenterOpacity(): number {
    return this._dart_5bcb85ae98e6dd3d_overAndUnderCenterOpacity;
  }
  /**
   * @dartParam value double
   * @dartParamOrigin value explicit
   */
  set overAndUnderCenterOpacity(value: number) {
    if (FoundationBuildMode.debug)
      invariant(
        value >= 0 && value <= 1,
        'invalid-source-wheel-renderer',
        'Pinned wheel renderer invariant',
      );
    if (value === this._dart_5bcb85ae98e6dd3d_overAndUnderCenterOpacity) {
      return;
    }
    this._dart_5bcb85ae98e6dd3d_overAndUnderCenterOpacity = value;
    this.markNeedsPaint();
  }
  /**
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  get itemExtent(): number {
    return this._dart_5bcb85ae98e6dd3d_itemExtent;
  }
  /**
   * @dartParam value double
   * @dartParamOrigin value explicit
   */
  set itemExtent(value: number) {
    if (FoundationBuildMode.debug)
      invariant(value > 0, 'invalid-source-wheel-renderer', 'Pinned wheel renderer invariant');
    if (value === this._dart_5bcb85ae98e6dd3d_itemExtent) {
      return;
    }
    this._dart_5bcb85ae98e6dd3d_itemExtent = value;
    this.markNeedsLayout();
  }
  /**
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  get squeeze(): number {
    return this._dart_5bcb85ae98e6dd3d_squeeze;
  }
  /**
   * @dartParam value double
   * @dartParamOrigin value explicit
   */
  set squeeze(value: number) {
    if (FoundationBuildMode.debug)
      invariant(value > 0, 'invalid-source-wheel-renderer', 'Pinned wheel renderer invariant');
    if (value === this._dart_5bcb85ae98e6dd3d_squeeze) {
      return;
    }
    this._dart_5bcb85ae98e6dd3d_squeeze = value;
    this.markNeedsLayout();
    this.markNeedsSemanticsUpdate();
  }
  get renderChildrenOutsideViewport(): boolean {
    return this._dart_5bcb85ae98e6dd3d_renderChildrenOutsideViewport;
  }
  set renderChildrenOutsideViewport(value: boolean) {
    if (FoundationBuildMode.debug)
      invariant(
        !this.renderChildrenOutsideViewport || this.clipBehavior === 'none',
        'invalid-source-wheel-renderer',
        SourceRenderListWheelViewport.clipBehaviorAndRenderChildrenOutsideViewportConflict,
      );
    if (value === this._dart_5bcb85ae98e6dd3d_renderChildrenOutsideViewport) {
      return;
    }
    this._dart_5bcb85ae98e6dd3d_renderChildrenOutsideViewport = value;
    this.markNeedsLayout();
    this.markNeedsSemanticsUpdate();
  }
  get clipBehavior(): Clip {
    return this._dart_5bcb85ae98e6dd3d_clipBehavior;
  }
  set clipBehavior(value: Clip) {
    if (!(value === this._dart_5bcb85ae98e6dd3d_clipBehavior)) {
      this._dart_5bcb85ae98e6dd3d_clipBehavior = value;
      this.markNeedsPaint();
      this.markNeedsSemanticsUpdate();
    }
  }
  _dart_5bcb85ae98e6dd3d_hasScrolled(): void {
    this.markNeedsLayout();
    this.markNeedsSemanticsUpdate();
  }
  override setupParentData(child: RenderObject): void {
    if (!isWheelRenderObject(child)) throw new TypeError('Invalid covariant argument: child');
    if (!isWheelParentData(wheelParentData(child))) {
      child.parentData = new SourceListWheelParentData();
    }
  }
  override attach(owner: PipelineOwner): void {
    super.attach(owner);
    this._dart_5bcb85ae98e6dd3d_offset.addListener(
      dartMethodTearOff(this, this._dart_5bcb85ae98e6dd3d_hasScrolled),
    );
  }
  override detach(): void {
    this._dart_5bcb85ae98e6dd3d_offset.removeListener(
      dartMethodTearOff(this, this._dart_5bcb85ae98e6dd3d_hasScrolled),
    );
    super.detach();
  }
  override get isRepaintBoundary(): boolean {
    return true;
  }
  /**
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  get _dart_5bcb85ae98e6dd3d_viewportExtent(): number {
    if (FoundationBuildMode.debug)
      invariant(this.hasSize, 'invalid-source-wheel-renderer', 'Pinned wheel renderer invariant');
    return this.sourceSize.height;
  }
  /**
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  get _dart_5bcb85ae98e6dd3d_minEstimatedScrollExtent(): number {
    if (FoundationBuildMode.debug)
      invariant(this.hasSize, 'invalid-source-wheel-renderer', 'Pinned wheel renderer invariant');
    if (this.childManager.childCount === null) {
      return -Infinity;
    }
    return 0;
  }
  /**
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  get _dart_5bcb85ae98e6dd3d_maxEstimatedScrollExtent(): number {
    if (FoundationBuildMode.debug)
      invariant(this.hasSize, 'invalid-source-wheel-renderer', 'Pinned wheel renderer invariant');
    if (this.childManager.childCount === null) {
      return Infinity;
    }
    return Math.max(
      0,
      checkedInteger(
        checkedInteger(
          checkedInteger(
            (() => {
              const _dartTemporary0 = this.childManager.childCount;
              if (_dartTemporary0 === null)
                throw new TypeError('Null check operator used on a null value');
              return _dartTemporary0!;
            })(),
          ) - 1,
        ),
      ) * this._dart_5bcb85ae98e6dd3d_itemExtent,
    );
  }
  /**
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  get _dart_5bcb85ae98e6dd3d_topScrollMarginExtent(): number {
    if (FoundationBuildMode.debug)
      invariant(this.hasSize, 'invalid-source-wheel-renderer', 'Pinned wheel renderer invariant');
    return -this.sourceSize.height / 2 + this._dart_5bcb85ae98e6dd3d_itemExtent / 2;
  }
  /**
   * @dartParam layoutCoordinateY double
   * @dartParamOrigin layoutCoordinateY explicit
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  _dart_5bcb85ae98e6dd3d_getUntransformedPaintingCoordinateY(layoutCoordinateY: number): number {
    return (
      layoutCoordinateY - this._dart_5bcb85ae98e6dd3d_topScrollMarginExtent - this.offset.pixels
    );
  }
  /**
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  get _dart_5bcb85ae98e6dd3d_maxVisibleRadian(): number {
    if (this._dart_5bcb85ae98e6dd3d_diameterRatio < 1) {
      return 3.141592653589793 / 2;
    }
    return Math.asin(1 / this._dart_5bcb85ae98e6dd3d_diameterRatio);
  }
  /**
   * @dartParam childSize double Function(RenderBox)
   * @dartParamOrigin childSize explicit
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  _dart_5bcb85ae98e6dd3d_getIntrinsicCrossAxis(
    childSize: (argument0: RenderBox) => number,
  ): number {
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    let extent: number = 0;
    let child: RenderBox | null = this.firstChild;
    while (child !== null) {
      extent = Math.max(extent, childSize(child));
      child = this.childAfter(child);
    }
    return extent;
  }
  /**
   * @dartParam height double
   * @dartParamOrigin height explicit
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  override computeMinIntrinsicWidth(height: number): number {
    return this._dart_5bcb85ae98e6dd3d_getIntrinsicCrossAxis((child: RenderBox): number => {
      return child.getMinIntrinsicWidth(height);
    });
  }
  /**
   * @dartParam height double
   * @dartParamOrigin height explicit
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  override computeMaxIntrinsicWidth(height: number): number {
    return this._dart_5bcb85ae98e6dd3d_getIntrinsicCrossAxis((child: RenderBox): number => {
      return child.getMaxIntrinsicWidth(height);
    });
  }
  /**
   * @dartParam width double
   * @dartParamOrigin width explicit
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  override computeMinIntrinsicHeight(width: number): number {
    if (this.childManager.childCount === null) {
      return 0;
    }
    return (
      checkedInteger(
        (() => {
          const _dartTemporary1 = this.childManager.childCount;
          if (_dartTemporary1 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary1!;
        })(),
      ) * this._dart_5bcb85ae98e6dd3d_itemExtent
    );
  }
  /**
   * @dartParam width double
   * @dartParamOrigin width explicit
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  override computeMaxIntrinsicHeight(width: number): number {
    if (this.childManager.childCount === null) {
      return 0;
    }
    return (
      checkedInteger(
        (() => {
          const _dartTemporary2 = this.childManager.childCount;
          if (_dartTemporary2 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary2!;
        })(),
      ) * this._dart_5bcb85ae98e6dd3d_itemExtent
    );
  }
  override get sizedByParent(): boolean {
    return true;
  }
  override computeDryLayout(constraints: BoxConstraints): Size {
    if (!isWheelConstraints(constraints))
      throw new TypeError('Invalid covariant argument: constraints');
    return wheelConstraintsBiggest(constraints);
  }
  /**
   * @dartReturn int
   * @dartReturnOrigin explicit
   */
  indexOf(child: RenderBox): number {
    const childParentData: SourceListWheelParentData = castWheelParentData(
      (() => {
        const _dartTemporary3 = wheelParentData(child);
        if (_dartTemporary3 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary3!;
      })(),
    );
    if (FoundationBuildMode.debug)
      invariant(
        childParentData.index !== null,
        'invalid-source-wheel-renderer',
        'Pinned wheel renderer invariant',
      );
    return checkedInteger(
      (() => {
        const _dartTemporary4 = childParentData.index;
        if (_dartTemporary4 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary4!;
      })(),
    );
  }
  /**
   * @dartParam scrollOffset double
   * @dartParamOrigin scrollOffset explicit
   * @dartReturn int
   * @dartReturnOrigin explicit
   */
  scrollOffsetToIndex(scrollOffset: number): number {
    return checkedInteger(Math.floor(scrollOffset / this.itemExtent));
  }
  /**
   * @dartParam index int
   * @dartParamOrigin index explicit
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  indexToScrollOffset(index: number): number {
    checkedInteger(index);
    return checkedInteger(index) * this.itemExtent;
  }
  /**
   * @dartParam index int
   * @dartParamOrigin index explicit
   */
  _dart_5bcb85ae98e6dd3d_createChild(
    index: number,
    {
      after = null,
    }: {
      readonly after?: RenderBox | null;
    } = {},
  ): void {
    checkedInteger(index);
    this.sourceInvokeLayout((constraints: BoxConstraints): void => {
      if (FoundationBuildMode.debug)
        invariant(
          constraints.equals(this.constraints),
          'invalid-source-wheel-renderer',
          'Pinned wheel renderer invariant',
        );
      this.childManager.createChild(checkedInteger(index), { after: after });
    });
  }
  _dart_5bcb85ae98e6dd3d_destroyChild(child: RenderBox): void {
    this.sourceInvokeLayout((constraints: BoxConstraints): void => {
      if (FoundationBuildMode.debug)
        invariant(
          constraints.equals(this.constraints),
          'invalid-source-wheel-renderer',
          'Pinned wheel renderer invariant',
        );
      this.childManager.removeChild(child);
    });
  }
  /**
   * @dartParam index int
   * @dartParamOrigin index explicit
   */
  _dart_5bcb85ae98e6dd3d_layoutChild(
    child: RenderBox,
    constraints: BoxConstraints,
    index: number,
  ): void {
    checkedInteger(index);
    child.layout(constraints, { parentUsesSize: true });
    const childParentData: SourceListWheelParentData = castWheelParentData(
      (() => {
        const _dartTemporary5 = wheelParentData(child);
        if (_dartTemporary5 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary5!;
      })(),
    );
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const crossPosition: number = this.sourceSize.width / 2 - wheelBoxSize(child).width / 2;
    childParentData.offset = new Offset(
      crossPosition,
      this.indexToScrollOffset(checkedInteger(index)),
    );
  }
  override sourcePerformLayout(): void {
    this.offset.applyViewportDimension(this._dart_5bcb85ae98e6dd3d_viewportExtent);
    if (this.childManager.childCount !== null) {
      this.offset.applyContentDimensions(
        this._dart_5bcb85ae98e6dd3d_minEstimatedScrollExtent,
        this._dart_5bcb85ae98e6dd3d_maxEstimatedScrollExtent,
      );
    }
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    let visibleHeight: number = this.sourceSize.height * this._dart_5bcb85ae98e6dd3d_squeeze;
    if (this.renderChildrenOutsideViewport) {
      visibleHeight *= 2;
    }
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const firstVisibleOffset: number =
      this.offset.pixels + this._dart_5bcb85ae98e6dd3d_itemExtent / 2 - visibleHeight / 2;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const lastVisibleOffset: number = firstVisibleOffset + visibleHeight;
    /**
     * @dartType int
     * @dartTypeOrigin explicit
     */
    let targetFirstIndex: number = checkedInteger(this.scrollOffsetToIndex(firstVisibleOffset));
    /**
     * @dartType int
     * @dartTypeOrigin explicit
     */
    let targetLastIndex: number = checkedInteger(this.scrollOffsetToIndex(lastVisibleOffset));
    if (
      checkedInteger(targetLastIndex) * this._dart_5bcb85ae98e6dd3d_itemExtent ===
      lastVisibleOffset
    ) {
      checkedInteger(
        (() => {
          const _dartTemporary6 = checkedInteger(targetLastIndex);
          const _dartTemporary7 = checkedInteger(_dartTemporary6 - 1);
          targetLastIndex = _dartTemporary7;
          return _dartTemporary6;
        })(),
      );
    }
    while (
      !this.childManager.childExistsAt(checkedInteger(targetFirstIndex)) &&
      checkedInteger(targetFirstIndex) <= checkedInteger(targetLastIndex)
    ) {
      checkedInteger(
        (() => {
          const _dartTemporary8 = checkedInteger(targetFirstIndex);
          const _dartTemporary9 = checkedInteger(_dartTemporary8 + 1);
          targetFirstIndex = _dartTemporary9;
          return _dartTemporary8;
        })(),
      );
    }
    while (
      !this.childManager.childExistsAt(checkedInteger(targetLastIndex)) &&
      checkedInteger(targetFirstIndex) <= checkedInteger(targetLastIndex)
    ) {
      checkedInteger(
        (() => {
          const _dartTemporary10 = checkedInteger(targetLastIndex);
          const _dartTemporary11 = checkedInteger(_dartTemporary10 - 1);
          targetLastIndex = _dartTemporary11;
          return _dartTemporary10;
        })(),
      );
    }
    if (checkedInteger(targetFirstIndex) > checkedInteger(targetLastIndex)) {
      while (this.firstChild !== null) {
        this._dart_5bcb85ae98e6dd3d_destroyChild(
          (() => {
            const _dartTemporary12 = this.firstChild;
            if (_dartTemporary12 === null)
              throw new TypeError('Null check operator used on a null value');
            return _dartTemporary12!;
          })(),
        );
      }
      return;
    }
    if (
      checkedInteger(this.childCount) > 0 &&
      (checkedInteger(
        this.indexOf(
          (() => {
            const _dartTemporary13 = this.firstChild;
            if (_dartTemporary13 === null)
              throw new TypeError('Null check operator used on a null value');
            return _dartTemporary13!;
          })(),
        ),
      ) > checkedInteger(targetLastIndex) ||
        checkedInteger(
          this.indexOf(
            (() => {
              const _dartTemporary14 = this.lastChild;
              if (_dartTemporary14 === null)
                throw new TypeError('Null check operator used on a null value');
              return _dartTemporary14!;
            })(),
          ),
        ) < checkedInteger(targetFirstIndex))
    ) {
      while (this.firstChild !== null) {
        this._dart_5bcb85ae98e6dd3d_destroyChild(
          (() => {
            const _dartTemporary15 = this.firstChild;
            if (_dartTemporary15 === null)
              throw new TypeError('Null check operator used on a null value');
            return _dartTemporary15!;
          })(),
        );
      }
    }
    const childConstraints: BoxConstraints = this.constraints.copyWith({
      minHeight: this._dart_5bcb85ae98e6dd3d_itemExtent,
      maxHeight: this._dart_5bcb85ae98e6dd3d_itemExtent,
      minWidth: 0,
    });
    if (checkedInteger(this.childCount) === 0) {
      this._dart_5bcb85ae98e6dd3d_createChild(checkedInteger(targetFirstIndex));
      this._dart_5bcb85ae98e6dd3d_layoutChild(
        (() => {
          const _dartTemporary16 = this.firstChild;
          if (_dartTemporary16 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary16!;
        })(),
        childConstraints,
        checkedInteger(targetFirstIndex),
      );
    }
    /**
     * @dartType int
     * @dartTypeOrigin explicit
     */
    let currentFirstIndex: number = checkedInteger(
      this.indexOf(
        (() => {
          const _dartTemporary17 = this.firstChild;
          if (_dartTemporary17 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary17!;
        })(),
      ),
    );
    /**
     * @dartType int
     * @dartTypeOrigin explicit
     */
    let currentLastIndex: number = checkedInteger(
      this.indexOf(
        (() => {
          const _dartTemporary18 = this.lastChild;
          if (_dartTemporary18 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary18!;
        })(),
      ),
    );
    while (checkedInteger(currentFirstIndex) < checkedInteger(targetFirstIndex)) {
      this._dart_5bcb85ae98e6dd3d_destroyChild(
        (() => {
          const _dartTemporary19 = this.firstChild;
          if (_dartTemporary19 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary19!;
        })(),
      );
      checkedInteger(
        (() => {
          const _dartTemporary20 = checkedInteger(currentFirstIndex);
          const _dartTemporary21 = checkedInteger(_dartTemporary20 + 1);
          currentFirstIndex = _dartTemporary21;
          return _dartTemporary20;
        })(),
      );
    }
    while (checkedInteger(currentLastIndex) > checkedInteger(targetLastIndex)) {
      this._dart_5bcb85ae98e6dd3d_destroyChild(
        (() => {
          const _dartTemporary22 = this.lastChild;
          if (_dartTemporary22 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary22!;
        })(),
      );
      checkedInteger(
        (() => {
          const _dartTemporary23 = checkedInteger(currentLastIndex);
          const _dartTemporary24 = checkedInteger(_dartTemporary23 - 1);
          currentLastIndex = _dartTemporary24;
          return _dartTemporary23;
        })(),
      );
    }
    let child: RenderBox | null = this.firstChild;
    /**
     * @dartType int
     * @dartTypeOrigin inferred
     */
    let index: number = checkedInteger(currentFirstIndex);
    while (child !== null) {
      this._dart_5bcb85ae98e6dd3d_layoutChild(
        child,
        childConstraints,
        checkedInteger(
          (() => {
            const _dartTemporary25 = checkedInteger(index);
            const _dartTemporary26 = checkedInteger(_dartTemporary25 + 1);
            index = _dartTemporary26;
            return _dartTemporary25;
          })(),
        ),
      );
      child = this.childAfter(child);
    }
    while (checkedInteger(currentFirstIndex) > checkedInteger(targetFirstIndex)) {
      this._dart_5bcb85ae98e6dd3d_createChild(
        checkedInteger(checkedInteger(currentFirstIndex) - 1),
      );
      this._dart_5bcb85ae98e6dd3d_layoutChild(
        (() => {
          const _dartTemporary27 = this.firstChild;
          if (_dartTemporary27 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary27!;
        })(),
        childConstraints,
        checkedInteger(
          (() => {
            const _dartTemporary28 = checkedInteger(currentFirstIndex);
            const _dartTemporary29 = checkedInteger(_dartTemporary28 - 1);
            currentFirstIndex = _dartTemporary29;
            return _dartTemporary29;
          })(),
        ),
      );
    }
    while (checkedInteger(currentLastIndex) < checkedInteger(targetLastIndex)) {
      this._dart_5bcb85ae98e6dd3d_createChild(
        checkedInteger(checkedInteger(currentLastIndex) + 1),
        { after: this.lastChild },
      );
      this._dart_5bcb85ae98e6dd3d_layoutChild(
        (() => {
          const _dartTemporary30 = this.lastChild;
          if (_dartTemporary30 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary30!;
        })(),
        childConstraints,
        checkedInteger(
          (() => {
            const _dartTemporary31 = checkedInteger(currentLastIndex);
            const _dartTemporary32 = checkedInteger(_dartTemporary31 + 1);
            currentLastIndex = _dartTemporary32;
            return _dartTemporary32;
          })(),
        ),
      );
    }
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const minScrollExtent: number = this.childManager.childExistsAt(
      checkedInteger(checkedInteger(targetFirstIndex) - 1),
    )
      ? this._dart_5bcb85ae98e6dd3d_minEstimatedScrollExtent
      : this.indexToScrollOffset(checkedInteger(targetFirstIndex));
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const maxScrollExtent: number = this.childManager.childExistsAt(
      checkedInteger(checkedInteger(targetLastIndex) + 1),
    )
      ? this._dart_5bcb85ae98e6dd3d_maxEstimatedScrollExtent
      : this.indexToScrollOffset(checkedInteger(targetLastIndex));
    this.offset.applyContentDimensions(minScrollExtent, maxScrollExtent);
  }
  _dart_5bcb85ae98e6dd3d_shouldClipAtCurrentOffset(): boolean {
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const highestUntransformedPaintY: number =
      this._dart_5bcb85ae98e6dd3d_getUntransformedPaintingCoordinateY(0);
    return (
      highestUntransformedPaintY < 0 ||
      this.sourceSize.height <
        highestUntransformedPaintY +
          this._dart_5bcb85ae98e6dd3d_maxEstimatedScrollExtent +
          this._dart_5bcb85ae98e6dd3d_itemExtent
    );
  }
  override sourcePaint(context: PaintingContext, offset: Offset): void {
    if (checkedInteger(this.childCount) > 0) {
      if (
        this._dart_5bcb85ae98e6dd3d_shouldClipAtCurrentOffset() &&
        !(this.clipBehavior === 'none')
      ) {
        this._dart_5bcb85ae98e6dd3d_clipRectLayer.layer = wheelPushClipRect(
          context,
          this.needsCompositing,
          offset,
          Offset.zero.and(this.sourceSize),
          dartMethodTearOff(this, this._dart_5bcb85ae98e6dd3d_paintVisibleChildren),
          {
            clipBehavior: this.clipBehavior,
            oldLayer: this._dart_5bcb85ae98e6dd3d_clipRectLayer.layer,
          },
        );
      } else {
        this._dart_5bcb85ae98e6dd3d_clipRectLayer.layer = null;
        this._dart_5bcb85ae98e6dd3d_paintVisibleChildren(context, offset);
      }
    }
  }
  override dispose(): void {
    this._dart_5bcb85ae98e6dd3d_clipRectLayer.layer = null;
    this._dart_5bcb85ae98e6dd3d_childOpacityLayerHandler.layer = null;
    super.dispose();
  }
  _dart_5bcb85ae98e6dd3d_paintVisibleChildren(context: PaintingContext, offset: Offset): void {
    if (this.overAndUnderCenterOpacity >= 1) {
      this._dart_5bcb85ae98e6dd3d_paintAllChildren(context, offset);
      return;
    }
    this._dart_5bcb85ae98e6dd3d_childOpacityLayerHandler.layer = wheelPushOpacity(
      context,
      offset,
      checkedInteger(roundInteger(this.overAndUnderCenterOpacity * 255)),
      (context: PaintingContext, offset: Offset): void => {
        this._dart_5bcb85ae98e6dd3d_paintAllChildren(context, offset, { center: false });
      },
    );
    this._dart_5bcb85ae98e6dd3d_paintAllChildren(context, offset, { center: true });
  }
  _dart_5bcb85ae98e6dd3d_paintAllChildren(
    context: PaintingContext,
    offset: Offset,
    {
      center = null,
    }: {
      readonly center?: boolean | null;
    } = {},
  ): void {
    let childToPaint: RenderBox | null = this.firstChild;
    while (childToPaint !== null) {
      const childParentData: SourceListWheelParentData = castWheelParentData(
        (() => {
          const _dartTemporary33 = wheelParentData(childToPaint);
          if (_dartTemporary33 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary33!;
        })(),
      );
      this._dart_5bcb85ae98e6dd3d_paintTransformedChild(
        childToPaint,
        context,
        offset,
        wheelParentOffset(childParentData),
        { center: center },
      );
      childToPaint = this.childAfter(childToPaint);
    }
  }
  _dart_5bcb85ae98e6dd3d_paintTransformedChild(
    child: RenderBox,
    context: PaintingContext,
    offset: Offset,
    layoutOffset: Offset,
    {
      center,
    }: {
      readonly center: boolean | null;
    },
  ): void {
    const untransformedPaintingCoordinates: Offset = offset.add(
      new Offset(
        layoutOffset.dx,
        this._dart_5bcb85ae98e6dd3d_getUntransformedPaintingCoordinateY(layoutOffset.dy),
      ),
    );
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const fractionalY: number =
      (untransformedPaintingCoordinates.dy + this._dart_5bcb85ae98e6dd3d_itemExtent / 2) /
      this.sourceSize.height;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const angle: number =
      (-(fractionalY - 0.5) * 2 * this._dart_5bcb85ae98e6dd3d_maxVisibleRadian) / this.squeeze;
    if (angle > 3.141592653589793 / 2 || angle < -3.141592653589793 / 2 || Number.isNaN(angle)) {
      return;
    }
    const transform: Matrix4 = MatrixUtils.createCylindricalProjectionTransform({
      radius: (this.sourceSize.height * this._dart_5bcb85ae98e6dd3d_diameterRatio) / 2,
      angle: angle,
      perspective: this._dart_5bcb85ae98e6dd3d_perspective,
    });
    const offsetToCenter: Offset = new Offset(
      untransformedPaintingCoordinates.dx,
      -this._dart_5bcb85ae98e6dd3d_topScrollMarginExtent,
    );
    const shouldApplyOffCenterDim: boolean = this.overAndUnderCenterOpacity < 1;
    if (this.useMagnifier || shouldApplyOffCenterDim) {
      this._dart_5bcb85ae98e6dd3d_paintChildWithMagnifier(
        context,
        offset,
        child,
        transform,
        offsetToCenter,
        untransformedPaintingCoordinates,
        { center: center },
      );
    } else {
      if (FoundationBuildMode.debug)
        invariant(
          center === null,
          'invalid-source-wheel-renderer',
          'Pinned wheel renderer invariant',
        );
      this._dart_5bcb85ae98e6dd3d_paintChildCylindrically(
        context,
        offset,
        child,
        transform,
        offsetToCenter,
      );
    }
  }
  _dart_5bcb85ae98e6dd3d_paintChildWithMagnifier(
    context: PaintingContext,
    offset: Offset,
    child: RenderBox,
    cylindricalTransform: Matrix4,
    offsetToCenter: Offset,
    untransformedPaintingCoordinates: Offset,
    {
      center,
    }: {
      readonly center: boolean | null;
    },
  ): void {
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const magnifierTopLinePosition: number =
      this.sourceSize.height / 2 -
      (this._dart_5bcb85ae98e6dd3d_itemExtent * this._dart_5bcb85ae98e6dd3d_magnification) / 2;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const magnifierBottomLinePosition: number =
      this.sourceSize.height / 2 +
      (this._dart_5bcb85ae98e6dd3d_itemExtent * this._dart_5bcb85ae98e6dd3d_magnification) / 2;
    const isAfterMagnifierTopLine: boolean =
      untransformedPaintingCoordinates.dy >=
      magnifierTopLinePosition -
        this._dart_5bcb85ae98e6dd3d_itemExtent * this._dart_5bcb85ae98e6dd3d_magnification;
    const isBeforeMagnifierBottomLine: boolean =
      untransformedPaintingCoordinates.dy <= magnifierBottomLinePosition;
    const centerRect: Rect = Rect.fromLTWH(
      0,
      magnifierTopLinePosition,
      this.sourceSize.width,
      this._dart_5bcb85ae98e6dd3d_itemExtent * this._dart_5bcb85ae98e6dd3d_magnification,
    );
    const topHalfRect: Rect = Rect.fromLTWH(0, 0, this.sourceSize.width, magnifierTopLinePosition);
    const bottomHalfRect: Rect = Rect.fromLTWH(
      0,
      magnifierBottomLinePosition,
      this.sourceSize.width,
      magnifierTopLinePosition,
    );
    const inCenter: boolean = isAfterMagnifierTopLine && isBeforeMagnifierBottomLine;
    if ((center === null || center) && inCenter) {
      wheelPushClipRect(
        context,
        this.needsCompositing,
        offset,
        centerRect,
        (context: PaintingContext, offset: Offset): void => {
          wheelPushTransform(
            context,
            this.needsCompositing,
            offset,
            this._dart_5bcb85ae98e6dd3d_magnifyTransform(),
            (context: PaintingContext, offset: Offset): void => {
              wheelPaintChild(context, child, offset.add(untransformedPaintingCoordinates));
            },
          );
        },
      );
    }
    if ((center === null || !center) && inCenter) {
      wheelPushClipRect(
        context,
        this.needsCompositing,
        offset,
        untransformedPaintingCoordinates.dy <= magnifierTopLinePosition
          ? topHalfRect
          : bottomHalfRect,
        (context: PaintingContext, offset: Offset): void => {
          this._dart_5bcb85ae98e6dd3d_paintChildCylindrically(
            context,
            offset,
            child,
            cylindricalTransform,
            offsetToCenter,
          );
        },
      );
    }
    if ((center === null || !center) && !inCenter) {
      this._dart_5bcb85ae98e6dd3d_paintChildCylindrically(
        context,
        offset,
        child,
        cylindricalTransform,
        offsetToCenter,
      );
    }
  }
  _dart_5bcb85ae98e6dd3d_paintChildCylindrically(
    context: PaintingContext,
    offset: Offset,
    child: RenderBox,
    cylindricalTransform: Matrix4,
    offsetToCenter: Offset,
  ): void {
    const paintOriginOffset: Offset = offset.add(offsetToCenter);
    const painter: (argument0: PaintingContext, argument1: Offset) => void = (
      context: PaintingContext,
      _offset: Offset,
    ): void => {
      wheelPaintChild(context, child, paintOriginOffset);
    };
    wheelPushTransform(
      context,
      this.needsCompositing,
      offset,
      this._dart_5bcb85ae98e6dd3d_centerOriginTransform(cylindricalTransform),
      painter,
    );
    const childParentData: SourceListWheelParentData = castWheelParentData(
      (() => {
        const _dartTemporary34 = wheelParentData(child);
        if (_dartTemporary34 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary34!;
      })(),
    );
    const transform: Matrix4 = (() => {
      const _dartTemporary35 =
        this._dart_5bcb85ae98e6dd3d_centerOriginTransform(cylindricalTransform);
      _dartTemporary35.translateByDouble(paintOriginOffset.dx, paintOriginOffset.dy, 0, 1);
      return _dartTemporary35;
    })();
    childParentData.transform = transform;
  }
  _dart_5bcb85ae98e6dd3d_magnifyTransform(): Matrix4 {
    return (() => {
      const _dartTemporary36 = Matrix4.identity();
      _dartTemporary36.translateByDouble(
        this.sourceSize.width * (-this._dart_5bcb85ae98e6dd3d_offAxisFraction + 0.5),
        this.sourceSize.height / 2,
        0,
        1,
      );
      _dartTemporary36.scaleByDouble(
        this._dart_5bcb85ae98e6dd3d_magnification,
        this._dart_5bcb85ae98e6dd3d_magnification,
        this._dart_5bcb85ae98e6dd3d_magnification,
        1,
      );
      _dartTemporary36.translateByDouble(
        -this.sourceSize.width * (-this._dart_5bcb85ae98e6dd3d_offAxisFraction + 0.5),
        -this.sourceSize.height / 2,
        0,
        1,
      );
      return _dartTemporary36;
    })();
  }
  _dart_5bcb85ae98e6dd3d_centerOriginTransform(originalMatrix: Matrix4): Matrix4 {
    const result: Matrix4 = Matrix4.identity();
    const centerOriginTranslation: Offset = Alignment.center.alongSize(this.sourceSize);
    result.translateByDouble(
      centerOriginTranslation.dx * (-this._dart_5bcb85ae98e6dd3d_offAxisFraction * 2 + 1),
      centerOriginTranslation.dy,
      0,
      1,
    );
    result.multiply(originalMatrix);
    result.translateByDouble(
      -centerOriginTranslation.dx * (-this._dart_5bcb85ae98e6dd3d_offAxisFraction * 2 + 1),
      -centerOriginTranslation.dy,
      0,
      1,
    );
    return result;
  }
  static _dart_5bcb85ae98e6dd3d_debugAssertValidHitTestOffsets(
    context: string,
    offset1: Offset,
    offset2: Offset,
  ): boolean {
    if (!offset1.equals(offset2)) {
      (() => {
        const _dartTemporary37 = new FlutterError(
          `${context} - hit test expected values didn't match: ${wheelOffsetString(offset1)} != ${wheelOffsetString(offset2)}`,
        );
        throw _dartTemporary37;
      })();
    }
    return true;
  }
  override applyPaintTransform(child: RenderBox, transform: Matrix4): void {
    if (!isWheelBox(child)) throw new TypeError('Invalid covariant argument: child');
    const parentData: SourceListWheelParentData = castWheelParentData(
      (() => {
        const _dartTemporary38 = wheelParentData(child);
        if (_dartTemporary38 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary38!;
      })(),
    );
    const paintTransform: Matrix4 | null = parentData.transform;
    if (paintTransform !== null) {
      transform.multiply(paintTransform);
    }
  }
  override describeApproximatePaintClip(child: RenderObject): Rect | null {
    if (!isWheelRenderObject(child)) throw new TypeError('Invalid covariant argument: child');
    if (this._dart_5bcb85ae98e6dd3d_shouldClipAtCurrentOffset()) {
      return Offset.zero.and(this.sourceSize);
    }
    return null;
  }
  override sourceHitTestChildren(
    result: WheelBoxHitTestResult,
    {
      position,
    }: {
      readonly position: Offset;
    },
  ): boolean {
    let child: RenderBox | null = this.lastChild;
    while (child !== null) {
      const childParentData: SourceListWheelParentData = castWheelParentData(
        (() => {
          const _dartTemporary39 = wheelParentData(child);
          if (_dartTemporary39 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary39!;
        })(),
      );
      const transform: Matrix4 | null = childParentData.transform;
      if (transform !== null) {
        const isHit: boolean = result.addWithPaintTransform({
          transform: transform,
          position: position,
          hitTest: (result: WheelBoxHitTestResult, transformed: Offset): boolean => {
            if (FoundationBuildMode.debug)
              invariant(
                ((): boolean => {
                  const inverted: Matrix4 | null = Matrix4.tryInvert(
                    wheelRemovePerspective(transform),
                  );
                  if (inverted === null) {
                    return SourceRenderListWheelViewport._dart_5bcb85ae98e6dd3d_debugAssertValidHitTestOffsets(
                      'Null inverted transform',
                      transformed,
                      position,
                    );
                  }
                  return SourceRenderListWheelViewport._dart_5bcb85ae98e6dd3d_debugAssertValidHitTestOffsets(
                    'MatrixUtils.transformPoint',
                    transformed,
                    MatrixUtils.transformPoint(inverted, position),
                  );
                })(),
                'invalid-source-wheel-renderer',
                'Pinned wheel renderer invariant',
              );
            return wheelBoxHitTest(
              (() => {
                const _dartTemporary40 = child;
                if (_dartTemporary40 === null)
                  throw new TypeError('Null check operator used on a null value');
                return _dartTemporary40!;
              })(),
              result,
              { position: transformed },
            );
          },
        });
        if (isHit) {
          return true;
        }
      }
      child = childParentData.previousSibling;
    }
    return false;
  }
  /**
   * @dartParam alignment double
   * @dartParamOrigin alignment explicit
   */
  getOffsetToReveal(
    target: RenderObject,
    alignment: number,
    {
      rect = null,
      axis: _axis = null,
    }: {
      readonly rect?: Rect | null;
      readonly axis?: Axis | null;
    } = {},
  ): RevealedOffset {
    rect ??= wheelPaintBounds(target);
    let child: RenderObject = target;
    while (!(wheelParent(child) === this)) {
      child = (() => {
        const _dartTemporary41 = wheelParent(child);
        if (_dartTemporary41 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary41!;
      })();
    }
    const parentData: SourceListWheelParentData = castWheelParentData(
      (() => {
        const _dartTemporary42 = wheelParentData(child);
        if (_dartTemporary42 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary42!;
      })(),
    );
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const targetOffset: number = wheelParentOffset(parentData).dy;
    const transform: Matrix4 = wheelGetTransform(target, child);
    const bounds: Rect = MatrixUtils.transformRect(transform, rect);
    const targetRect: Rect = bounds.translate(0, (this.sourceSize.height - this.itemExtent) / 2);
    return createWheelRevealedOffset({ offset: targetOffset, rect: targetRect });
  }
  override sourceShowOnScreen({
    descendant = null,
    rect = null,
    duration = 0,
    curve = Curves.ease,
  }: {
    readonly descendant?: RenderObject | null;
    readonly rect?: Rect | null;
    readonly duration?: number;
    readonly curve?: Curve;
  } = {}): void {
    if (descendant !== null) {
      const revealedOffset: RevealedOffset = this.getOffsetToReveal(descendant, 0.5, {
        rect: rect,
      });
      if (duration === 0) {
        this.offset.jumpTo(revealedOffset.offset);
      } else {
        this.offset.animateTo(revealedOffset.offset, { duration: duration, curve: curve });
      }
      rect = revealedOffset.rect;
    }
    super.sourceForwardShowOnScreen({ rect: rect, duration: duration, curve: curve });
  }
}
protect(SourceRenderListWheelViewport, [
  'defaultDiameterRatio',
  'defaultPerspective',
  'diameterRatioZeroMessage',
  'perspectiveTooHighMessage',
  'clipBehaviorAndRenderChildrenOutsideViewportConflict',
]);

export function isWheelParentData(value: unknown): value is SourceListWheelParentData {
  return value instanceof SourceListWheelParentData;
}
export function castWheelParentData(value: unknown): SourceListWheelParentData {
  invariant(
    isWheelParentData(value),
    'invalid-wheel-parent-data',
    'Expected actual source wheel parent data',
  );
  return value;
}
