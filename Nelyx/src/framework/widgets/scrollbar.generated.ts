// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/widgets/scrollbar.dart; SHA256 1e07a5428421fb29557ad0c8fdca665c8ea24ac087457af4aa77486cf781dd3e
import { protect } from '../../ui/value-math.ts';
import { checkedInteger } from '../../ui/value-math.ts';
import { invariant } from '../../foundation/errors.ts';
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { dartMethodTearOff } from '../../foundation/dart-method-tear-off.ts';
import { dartLateRead } from '../../foundation/dart-late.ts';
import { dartLateWrite } from '../../foundation/dart-late.ts';
import { dartLateLocal } from '../../foundation/dart-late.ts';
import '../../foundation/dart-static-field.ts';
import { Color } from '../../ui/color.ts';
import { Radius } from '../../ui/radius.ts';
import '../../foundation/notifier.ts';
import { Canvas } from '../../ui/canvas.ts';
import { Offset } from '../../ui/offset.ts';
import { Size } from '../../ui/size.ts';
import { Rect } from '../../ui/rect.ts';
import { RRect } from '../../ui/rrect.ts';
import { Path } from '../../ui/path.ts';
import { PointerDeviceKind } from '../../ui/pointer.ts';
import { AxisDirection } from '../painting/basic-types.ts';
import { EdgeInsets } from '../painting/edge-insets.ts';
import { EdgeInsetsGeometry } from '../painting/edge-insets.ts';
import { OutlinedBorder } from '../painting/borders.ts';
import { CustomPainterSemantics } from '../rendering/custom-paint.ts';
import { clampDouble } from '../../ui/math.ts';
import { describeIdentity } from '../../foundation/diagnostics-identity.ts';
import { ScrollbarSourcePaint } from './scrollbar-painter-source-adapter.ts';
import { scrollbarValueEquals } from './scrollbar-painter-source-adapter.ts';
import { scrollbarIsDirectional } from './scrollbar-painter-source-adapter.ts';
import { scrollbarIsInfinite } from './scrollbar-painter-source-adapter.ts';
import { scrollbarEnumString } from './scrollbar-painter-source-adapter.ts';
import { ScrollbarPainterNotifier } from './scrollbar-painter-source-adapter.ts';
import { scrollbarIsPainter } from './scrollbar-painter-source-adapter.ts';
import { GlobalKey } from './global-key.ts';
import { State } from './framework.ts';
import { StatefulWidget } from './framework.ts';
import { Widget } from './framework.ts';
import { RenderBox } from '../rendering/object.ts';
import { CustomPaint } from './custom-paint.ts';
import { PointerEvent } from '../gestures/events.ts';
import { PointerDownEvent } from '../gestures/events.ts';
import { PointerPanZoomStartEvent } from '../gestures/events.ts';
import '../gestures/tap.ts';
import '../gestures/monodrag.ts';
import { ScrollbarTapHost } from './scrollbar-gesture-source-adapter.ts';
import { ScrollbarVerticalDragHost } from './scrollbar-gesture-source-adapter.ts';
import { ScrollbarHorizontalDragHost } from './scrollbar-gesture-source-adapter.ts';
import { scrollbarKeyContext } from './scrollbar-gesture-source-adapter.ts';
import { scrollbarRenderObject } from './scrollbar-gesture-source-adapter.ts';
import { scrollbarCastRenderBox } from './scrollbar-gesture-source-adapter.ts';
import { scrollbarCastCustomPaint } from './scrollbar-gesture-source-adapter.ts';
import { scrollbarForegroundPainter } from './scrollbar-gesture-source-adapter.ts';
import { scrollbarGlobalToLocal } from './scrollbar-gesture-source-adapter.ts';
import { Key } from '../../foundation/key.ts';
import { AnimationController } from '../animation/animation-controller.ts';
import { Curves } from '../animation/curves.ts';
import { Axis } from '../painting/basic-types.ts';
import { PointerSignalEvent } from '../gestures/events.ts';
import { PointerScrollEvent } from '../gestures/events.ts';
import './viewer-widget-source-adapter.ts';
import { DartSet } from '../../foundation/dart-collections.ts';
import { DartMap } from '../../foundation/dart-collections.ts';
import '../../foundation/dart-type-witness.ts';
import './widget-state-diagnostic-source-adapter.ts';
import './widget-state-map-source-adapter.ts';
import { FlutterError } from '../../foundation/flutter-error.ts';
import { ErrorSummary } from '../../foundation/diagnostics.ts';
import { ErrorDescription } from '../../foundation/diagnostics.ts';
import { ErrorHint } from '../../foundation/diagnostics.ts';
import '../../foundation/dart-numeric.ts';
import { ScrollController } from './scroll-controller.ts';
import { ScrollNotification } from './scroll-notification.ts';
import { MouseCursor } from '../../services/mouse-cursor.ts';
import './ticker-provider.ts';
import { CurvedAnimation } from '../animation/animations.ts';
import { Drag } from '../gestures/drag.ts';
import { ScrollHoldController } from './scroll-activity.ts';
import { RawGestureDetectorState } from './raw-gesture-detector.ts';
import { AnimationStatus } from '../animation/animation.ts';
import { ScrollPosition } from './scroll-position.ts';
import '../animation/ticker-future.ts';
import './scroll-physics.ts';
import './scroll-configuration.ts';
import { DragStartDetails } from '../gestures/drag-details.ts';
import { DragUpdateDetails } from '../gestures/drag-details.ts';
import { Velocity } from '../gestures/velocity-tracker.ts';
import { DragEndDetails } from '../gestures/drag-details.ts';
import { TapDownDetails } from '../gestures/tap.ts';
import { ScrollableState } from './scrollable.ts';
import { ScrollIntent } from './scrollable-helpers.ts';
import { ScrollIncrementType } from './scrollable-helpers.ts';
import { ScrollMetricsNotification } from './scroll-position.ts';
import { DragDownDetails } from '../gestures/drag-details.ts';
import { DragGestureRecognizer } from '../gestures/monodrag.ts';
import { DeviceGestureSettings } from '../gestures/gesture-settings.ts';
import { DragStartBehavior } from '../gestures/recognizer.ts';
import { GestureRecognizerFactory } from './raw-gesture-detector.ts';
import { GestureRecognizer } from '../gestures/recognizer.ts';
import { PointerHoverEvent } from '../gestures/events.ts';
import { PointerExitEvent } from '../gestures/events.ts';
import '../gestures/pointer-signal-resolver.ts';
import './repaint-boundary.ts';
import './mouse-region.ts';
import './listener.ts';
import './notification-listener.ts';
import { SourceWidgetState } from './widget-state.generated.ts';
import { SourceWidgetStateProperty } from './widget-state.generated.ts';
import { ScrollbarTimer } from './scrollbar-raw-source-adapter.ts';
import { ScrollbarStatefulHost } from './scrollbar-raw-source-adapter.ts';
import { ScrollbarStateHost } from './scrollbar-raw-source-adapter.ts';
import { PrimaryScrollController } from './primary-scroll-controller.ts';
import { Directionality } from './app-data.ts';
import { ScrollConfiguration } from './scroll-configuration.ts';
import { Scrollable } from './scrollable.ts';
import { ScrollAction } from './scrollable-helpers.ts';
import { defaultScrollNotificationPredicate } from './scroll-notification.ts';
import { axisDirectionIsReversed } from '../painting/basic-types.ts';
import { axisDirectionToAxis } from '../painting/basic-types.ts';
import { scrollbarMediaPadding } from './scrollbar-raw-source-adapter.ts';
import { scrollbarLocalToGlobal } from './scrollbar-raw-source-adapter.ts';
import { scrollbarPostFrame } from './scrollbar-raw-source-adapter.ts';
import { scrollbarRegisterSignal } from './scrollbar-raw-source-adapter.ts';
import { scrollbarRepaintBoundary } from './scrollbar-raw-source-adapter.ts';
import { scrollbarListener } from './scrollbar-raw-source-adapter.ts';
import { scrollbarRawGestureDetector } from './scrollbar-raw-source-adapter.ts';
import { scrollbarMouseRegion } from './scrollbar-raw-source-adapter.ts';
import { scrollbarCustomPaint } from './scrollbar-raw-source-adapter.ts';
import { scrollbarConstGestureSettings } from './scrollbar-raw-source-adapter.ts';
import { scrollbarGlobalKey } from './scrollbar-raw-source-adapter.ts';
import { scrollbarGestureKey } from './scrollbar-raw-source-adapter.ts';
import { scrollbarHorizontalFactory } from './scrollbar-raw-gesture-factories.ts';
import { scrollbarVerticalFactory } from './scrollbar-raw-gesture-factories.ts';
import { scrollbarTrackFactory } from './scrollbar-raw-gesture-factories.ts';
import { scrollbarMetricsListener } from './scrollbar-raw-source-adapter.ts';
import { scrollbarNotificationListener } from './scrollbar-raw-source-adapter.ts';
import { scrollbarIsScrollUpdate } from './scrollbar-raw-source-adapter.ts';
import { scrollbarIsOverscroll } from './scrollbar-raw-source-adapter.ts';
import { scrollbarIsScrollEnd } from './scrollbar-raw-source-adapter.ts';
import { scrollbarIsPointerScroll } from './scrollbar-raw-source-adapter.ts';
import { scrollbarCastPointerScroll } from './scrollbar-raw-source-adapter.ts';
import { scrollbarIsInertiaCancel } from './scrollbar-raw-source-adapter.ts';
import { scrollbarGestureMap } from './scrollbar-raw-source-adapter.ts';
import { emptyWidgetStateSet } from './widget-state.ts';
import { captureDartException } from '../../foundation/dart-exceptions.ts';
import { applyDartType } from '../../foundation/dart-type-witness.ts';
import { captureDartType } from '../../foundation/dart-type-witness.ts';
import { readDartType } from '../../foundation/dart-type-witness.ts';
import { castDartType } from '../../foundation/dart-type-witness.ts';
import { scrollbarStatefulType } from './scrollbar-raw-source-adapter.ts';
import { scrollbarStateType } from './scrollbar-raw-source-adapter.ts';
import { scrollbarTickerStateType } from './scrollbar-raw-source-adapter.ts';
import { scrollbarSetGesture } from './scrollbar-raw-source-adapter.ts';
import { scrollbarIsWeb } from './scrollbar-raw-source-adapter.ts';
import { scrollbarIterableLength } from './scrollbar-raw-source-adapter.ts';
import { scrollbarRawObjectEquals } from './scrollbar-raw-source-adapter.ts';
import '../../ui/radius-source-adapter.ts';
import { constSourceColor } from '../../ui/color-source-adapter.ts';
import type { Animation } from '../animation/animation.ts';
import type { ScrollMetrics } from './scroll-metrics.ts';
import type { ScrollbarTextDirection } from './scrollbar-painter-source-adapter.ts';
import type { ScrollbarSourceList } from './scrollbar-painter-source-adapter.ts';
import type { ScrollbarCustomPainterContract } from './scrollbar-painter-source-adapter.ts';
import type { BuildContext } from './framework.ts';
import type { DiagnosticsNode } from '../../foundation/diagnostics.ts';
import type { TargetPlatform } from '../../foundation/platform.ts';
import type { GestureRecognizerType } from './raw-gesture-detector.ts';
import type { DartTypeWitness } from '../../foundation/dart-type-witness.ts';

const _dartTemporary0 = Symbol();
export class SourceScrollbarOrientation {
  /**
   * @dartType int
   * @dartTypeOrigin explicit
   */
  readonly index: number;
  private readonly _dartTemporary1!: void;
  /**
   * @dartParam index int
   * @dartParamOrigin index explicit
   */
  private constructor(
    index: number,
    readonly name: string,
    token: typeof _dartTemporary0,
  ) {
    if (token !== _dartTemporary0) throw new TypeError('Enum values cannot be constructed');
    this.index = index;
    Object.freeze(this);
  }
  static readonly left: SourceScrollbarOrientation = new SourceScrollbarOrientation(
    0,
    'left',
    _dartTemporary0,
  );
  static readonly right: SourceScrollbarOrientation = new SourceScrollbarOrientation(
    1,
    'right',
    _dartTemporary0,
  );
  static readonly top: SourceScrollbarOrientation = new SourceScrollbarOrientation(
    2,
    'top',
    _dartTemporary0,
  );
  static readonly bottom: SourceScrollbarOrientation = new SourceScrollbarOrientation(
    3,
    'bottom',
    _dartTemporary0,
  );
  static readonly values: ReadonlyArray<SourceScrollbarOrientation> = Object.freeze([
    SourceScrollbarOrientation.left,
    SourceScrollbarOrientation.right,
    SourceScrollbarOrientation.top,
    SourceScrollbarOrientation.bottom,
  ]);
  toString(): string {
    return 'ScrollbarOrientation.' + this.name;
  }
}
Object.freeze(SourceScrollbarOrientation.prototype);
Object.freeze(SourceScrollbarOrientation);
/**
 * @dartType double
 * @dartTypeOrigin explicit
 */
export const _kMinThumbExtent: number = 18;
/**
 * @dartType double
 * @dartTypeOrigin explicit
 */
export const _kMinInteractiveSize: number = 48;
/**
 * @dartType double
 * @dartTypeOrigin explicit
 */
export const _kScrollbarThickness: number = 6;
export const _kScrollbarFadeDuration: number = 0 + 300 * 1;
export const _kScrollbarTimeToFade: number = 0 + 600 * 1;
export class SourceScrollbarPainter
  extends ScrollbarPainterNotifier
  implements ScrollbarCustomPainterContract
{
  _dart_1c5f203b5ad3537b_color: Color;
  _dart_1c5f203b5ad3537b_trackColor: Color;
  _dart_1c5f203b5ad3537b_trackBorderColor: Color;
  _dart_1c5f203b5ad3537b_trackRadius: Radius | null;
  _dart_1c5f203b5ad3537b_textDirection: ScrollbarTextDirection | null;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  _dart_1c5f203b5ad3537b_thickness: number;
  /**
   * @dartType Animation<double>
   * @dartTypeOrigin explicit
   */
  readonly fadeoutOpacityAnimation: Animation<number>;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  _dart_1c5f203b5ad3537b_mainAxisMargin: number;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  _dart_1c5f203b5ad3537b_crossAxisMargin: number;
  _dart_1c5f203b5ad3537b_radius: Radius | null;
  _dart_1c5f203b5ad3537b_shape: OutlinedBorder | null;
  _dart_1c5f203b5ad3537b_padding: EdgeInsetsGeometry;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  _dart_1c5f203b5ad3537b_minLength: number;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  _dart_1c5f203b5ad3537b_minOverscrollLength: number;
  _dart_1c5f203b5ad3537b_scrollbarOrientation: SourceScrollbarOrientation | null;
  _dart_1c5f203b5ad3537b_ignorePointer: boolean;
  _dart_1c5f203b5ad3537b_trackRect: Rect | null;
  _dart_1c5f203b5ad3537b_resolvedPadding: EdgeInsets | null;
  _dart_1c5f203b5ad3537b_thumbRect: Rect | null;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  get _dart_1c5f203b5ad3537b_thumbOffset(): number {
    return dartLateRead<number>(
      this,
      'package:flutter/src/widgets/scrollbar.dart::ScrollbarPainter._thumbOffset:FIELD',
      '_thumbOffset',
    );
  }
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  set _dart_1c5f203b5ad3537b_thumbOffset(value: number) {
    dartLateWrite<number>(
      this,
      'package:flutter/src/widgets/scrollbar.dart::ScrollbarPainter._thumbOffset:FIELD',
      '_thumbOffset',
      value,
      false,
    );
  }
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  get _dart_1c5f203b5ad3537b_thumbExtent(): number {
    return dartLateRead<number>(
      this,
      'package:flutter/src/widgets/scrollbar.dart::ScrollbarPainter._thumbExtent:FIELD',
      '_thumbExtent',
    );
  }
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  set _dart_1c5f203b5ad3537b_thumbExtent(value: number) {
    dartLateWrite<number>(
      this,
      'package:flutter/src/widgets/scrollbar.dart::ScrollbarPainter._thumbExtent:FIELD',
      '_thumbExtent',
      value,
      false,
    );
  }
  _dart_1c5f203b5ad3537b_lastMetrics: ScrollMetrics | null;
  _dart_1c5f203b5ad3537b_lastAxisDirection: AxisDirection | null;
  /**
   * @dartParam fadeoutOpacityAnimation Animation<double>
   * @dartParamOrigin fadeoutOpacityAnimation inferred
   * @dartParam thickness double
   * @dartParamOrigin thickness inferred
   * @dartParam mainAxisMargin double
   * @dartParamOrigin mainAxisMargin inferred
   * @dartParam crossAxisMargin double
   * @dartParamOrigin crossAxisMargin inferred
   * @dartParam minLength double
   * @dartParamOrigin minLength explicit
   * @dartParam minOverscrollLength double?
   * @dartParamOrigin minOverscrollLength explicit
   */
  constructor({
    color,
    fadeoutOpacityAnimation,
    trackColor = constSourceColor(Color, 0),
    trackBorderColor = constSourceColor(Color, 0),
    textDirection = null,
    thickness = _kScrollbarThickness,
    padding = EdgeInsets.zero,
    mainAxisMargin = 0,
    crossAxisMargin = 0,
    radius = null,
    trackRadius = null,
    shape = null,
    minLength = _kMinThumbExtent,
    minOverscrollLength = null,
    scrollbarOrientation = null,
    ignorePointer = false,
  }: {
    readonly color: Color;
    readonly fadeoutOpacityAnimation: Animation<number>;
    readonly trackColor?: Color;
    readonly trackBorderColor?: Color;
    readonly textDirection?: ScrollbarTextDirection | null;
    readonly thickness?: number;
    readonly padding?: EdgeInsetsGeometry;
    readonly mainAxisMargin?: number;
    readonly crossAxisMargin?: number;
    readonly radius?: Radius | null;
    readonly trackRadius?: Radius | null;
    readonly shape?: OutlinedBorder | null;
    readonly minLength?: number;
    readonly minOverscrollLength?: number | null;
    readonly scrollbarOrientation?: SourceScrollbarOrientation | null;
    readonly ignorePointer?: boolean;
  }) {
    const _initialField0 = color;
    /**
     * @dartType Animation<double>
     * @dartTypeOrigin inferred
     */
    const _initialField1 = fadeoutOpacityAnimation;
    const _initialField2 = trackColor;
    const _initialField3 = trackBorderColor;
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const _initialField4 = thickness;
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const _initialField5 = mainAxisMargin;
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const _initialField6 = crossAxisMargin;
    const _initialField7 = trackRadius;
    const _initialField8 = scrollbarOrientation;
    const _initialField9 = ignorePointer;
    if (FoundationBuildMode.debug)
      invariant(
        radius === null || shape === null,
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    if (FoundationBuildMode.debug)
      invariant(minLength >= 0, 'generated-source-assert', 'Pinned Dart assertion failed');
    if (FoundationBuildMode.debug)
      invariant(
        minOverscrollLength === null || (minOverscrollLength as number) <= minLength,
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    if (FoundationBuildMode.debug)
      invariant(
        minOverscrollLength === null || (minOverscrollLength as number) >= 0,
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    if (FoundationBuildMode.debug)
      invariant(padding.isNonNegative, 'generated-source-assert', 'Pinned Dart assertion failed');
    if (FoundationBuildMode.debug)
      invariant(
        !scrollbarIsDirectional(padding) || textDirection !== null,
        'generated-source-assert',
        'A non-null textDirection must be provided when using EdgeInsetsDirectional for padding.',
      );
    const _initialField10 = textDirection;
    const _initialField11 = radius;
    const _initialField12 = shape;
    const _initialField13 = padding;
    const _initialField14 = padding.resolve(textDirection);
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const _initialField15 = minLength;
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const _initialField16 = minOverscrollLength ?? minLength;
    super();
    this._dart_1c5f203b5ad3537b_color = _initialField0;
    this._dart_1c5f203b5ad3537b_trackColor = _initialField2;
    this._dart_1c5f203b5ad3537b_trackBorderColor = _initialField3;
    this._dart_1c5f203b5ad3537b_trackRadius = _initialField7;
    this._dart_1c5f203b5ad3537b_textDirection = _initialField10;
    this._dart_1c5f203b5ad3537b_thickness = _initialField4;
    this.fadeoutOpacityAnimation = _initialField1;
    this._dart_1c5f203b5ad3537b_mainAxisMargin = _initialField5;
    this._dart_1c5f203b5ad3537b_crossAxisMargin = _initialField6;
    this._dart_1c5f203b5ad3537b_radius = _initialField11;
    this._dart_1c5f203b5ad3537b_shape = _initialField12;
    this._dart_1c5f203b5ad3537b_padding = _initialField13;
    this._dart_1c5f203b5ad3537b_minLength = _initialField15;
    this._dart_1c5f203b5ad3537b_minOverscrollLength = _initialField16;
    this._dart_1c5f203b5ad3537b_scrollbarOrientation = _initialField8;
    this._dart_1c5f203b5ad3537b_ignorePointer = _initialField9;
    this._dart_1c5f203b5ad3537b_trackRect = null;
    this._dart_1c5f203b5ad3537b_resolvedPadding = _initialField14;
    this._dart_1c5f203b5ad3537b_thumbRect = null;
    this._dart_1c5f203b5ad3537b_lastMetrics = null;
    this._dart_1c5f203b5ad3537b_lastAxisDirection = null;
    protect(this, ['fadeoutOpacityAnimation']);
    this.fadeoutOpacityAnimation.addListener(dartMethodTearOff(this, this.notifyListeners));
  }
  get color(): Color {
    return this._dart_1c5f203b5ad3537b_color;
  }
  set color(value: Color) {
    if (scrollbarValueEquals(this.color, value)) {
      return;
    }
    this._dart_1c5f203b5ad3537b_color = value;
    this.notifyListeners();
  }
  get trackColor(): Color {
    return this._dart_1c5f203b5ad3537b_trackColor;
  }
  set trackColor(value: Color) {
    if (scrollbarValueEquals(this.trackColor, value)) {
      return;
    }
    this._dart_1c5f203b5ad3537b_trackColor = value;
    this.notifyListeners();
  }
  get trackBorderColor(): Color {
    return this._dart_1c5f203b5ad3537b_trackBorderColor;
  }
  set trackBorderColor(value: Color) {
    if (scrollbarValueEquals(this.trackBorderColor, value)) {
      return;
    }
    this._dart_1c5f203b5ad3537b_trackBorderColor = value;
    this.notifyListeners();
  }
  get trackRadius(): Radius | null {
    return this._dart_1c5f203b5ad3537b_trackRadius;
  }
  set trackRadius(value: Radius | null) {
    if (
      (() => {
        const _dartTemporary2 = this.trackRadius;
        const _dartTemporary3 = value;
        return _dartTemporary2 === null || _dartTemporary3 === null
          ? _dartTemporary2 === _dartTemporary3
          : scrollbarValueEquals(_dartTemporary2, _dartTemporary3);
      })()
    ) {
      return;
    }
    this._dart_1c5f203b5ad3537b_trackRadius = value;
    this.notifyListeners();
  }
  get textDirection(): ScrollbarTextDirection | null {
    return this._dart_1c5f203b5ad3537b_textDirection;
  }
  set textDirection(value: ScrollbarTextDirection | null) {
    if (FoundationBuildMode.debug)
      invariant(value !== null, 'generated-source-assert', 'Pinned Dart assertion failed');
    if (
      (() => {
        const _dartTemporary4 = this.textDirection;
        const _dartTemporary5 = value;
        return _dartTemporary4 === null || _dartTemporary5 === null
          ? _dartTemporary4 === _dartTemporary5
          : scrollbarRawObjectEquals(_dartTemporary4, _dartTemporary5);
      })()
    ) {
      return;
    }
    this._dart_1c5f203b5ad3537b_textDirection = value;
    this._dart_1c5f203b5ad3537b_resolvedPadding = this._dart_1c5f203b5ad3537b_padding.resolve(
      this._dart_1c5f203b5ad3537b_textDirection,
    );
    this.notifyListeners();
  }
  /**
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  get thickness(): number {
    return this._dart_1c5f203b5ad3537b_thickness;
  }
  /**
   * @dartParam value double
   * @dartParamOrigin value explicit
   */
  set thickness(value: number) {
    if (this.thickness === value) {
      return;
    }
    this._dart_1c5f203b5ad3537b_thickness = value;
    this.notifyListeners();
  }
  /**
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  get mainAxisMargin(): number {
    return this._dart_1c5f203b5ad3537b_mainAxisMargin;
  }
  /**
   * @dartParam value double
   * @dartParamOrigin value explicit
   */
  set mainAxisMargin(value: number) {
    if (this.mainAxisMargin === value) {
      return;
    }
    this._dart_1c5f203b5ad3537b_mainAxisMargin = value;
    this.notifyListeners();
  }
  /**
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  get crossAxisMargin(): number {
    return this._dart_1c5f203b5ad3537b_crossAxisMargin;
  }
  /**
   * @dartParam value double
   * @dartParamOrigin value explicit
   */
  set crossAxisMargin(value: number) {
    if (this.crossAxisMargin === value) {
      return;
    }
    this._dart_1c5f203b5ad3537b_crossAxisMargin = value;
    this.notifyListeners();
  }
  get radius(): Radius | null {
    return this._dart_1c5f203b5ad3537b_radius;
  }
  set radius(value: Radius | null) {
    if (FoundationBuildMode.debug)
      invariant(
        this.shape === null || value === null,
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    if (
      (() => {
        const _dartTemporary6 = this.radius;
        const _dartTemporary7 = value;
        return _dartTemporary6 === null || _dartTemporary7 === null
          ? _dartTemporary6 === _dartTemporary7
          : scrollbarValueEquals(_dartTemporary6, _dartTemporary7);
      })()
    ) {
      return;
    }
    this._dart_1c5f203b5ad3537b_radius = value;
    this.notifyListeners();
  }
  get shape(): OutlinedBorder | null {
    return this._dart_1c5f203b5ad3537b_shape;
  }
  set shape(value: OutlinedBorder | null) {
    if (FoundationBuildMode.debug)
      invariant(
        this.radius === null || value === null,
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    if (
      (() => {
        const _dartTemporary8 = this.shape;
        const _dartTemporary9 = value;
        return _dartTemporary8 === null || _dartTemporary9 === null
          ? _dartTemporary8 === _dartTemporary9
          : scrollbarRawObjectEquals(_dartTemporary8, _dartTemporary9);
      })()
    ) {
      return;
    }
    this._dart_1c5f203b5ad3537b_shape = value;
    this.notifyListeners();
  }
  get padding(): EdgeInsetsGeometry {
    return this._dart_1c5f203b5ad3537b_padding;
  }
  set padding(value: EdgeInsetsGeometry) {
    if (scrollbarValueEquals(this.padding, value)) {
      return;
    }
    this._dart_1c5f203b5ad3537b_padding = value;
    this._dart_1c5f203b5ad3537b_resolvedPadding = this._dart_1c5f203b5ad3537b_padding.resolve(
      this._dart_1c5f203b5ad3537b_textDirection,
    );
    this.notifyListeners();
  }
  /**
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  get minLength(): number {
    return this._dart_1c5f203b5ad3537b_minLength;
  }
  /**
   * @dartParam value double
   * @dartParamOrigin value explicit
   */
  set minLength(value: number) {
    if (this.minLength === value) {
      return;
    }
    this._dart_1c5f203b5ad3537b_minLength = value;
    this.notifyListeners();
  }
  /**
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  get minOverscrollLength(): number {
    return this._dart_1c5f203b5ad3537b_minOverscrollLength;
  }
  /**
   * @dartParam value double
   * @dartParamOrigin value explicit
   */
  set minOverscrollLength(value: number) {
    if (this.minOverscrollLength === value) {
      return;
    }
    this._dart_1c5f203b5ad3537b_minOverscrollLength = value;
    this.notifyListeners();
  }
  get scrollbarOrientation(): SourceScrollbarOrientation | null {
    return this._dart_1c5f203b5ad3537b_scrollbarOrientation;
  }
  set scrollbarOrientation(value: SourceScrollbarOrientation | null) {
    if (
      (() => {
        const _dartTemporary10 = this.scrollbarOrientation;
        const _dartTemporary11 = value;
        return _dartTemporary10 === null || _dartTemporary11 === null
          ? _dartTemporary10 === _dartTemporary11
          : scrollbarRawObjectEquals(_dartTemporary10, _dartTemporary11);
      })()
    ) {
      return;
    }
    this._dart_1c5f203b5ad3537b_scrollbarOrientation = value;
    this.notifyListeners();
  }
  get ignorePointer(): boolean {
    return this._dart_1c5f203b5ad3537b_ignorePointer;
  }
  set ignorePointer(value: boolean) {
    if (this.ignorePointer === value) {
      return;
    }
    this._dart_1c5f203b5ad3537b_ignorePointer = value;
    this.notifyListeners();
  }
  /**
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  get _dart_1c5f203b5ad3537b_trackExtent(): number {
    return (
      (() => {
        const _dartTemporary12 = this._dart_1c5f203b5ad3537b_lastMetrics;
        if (_dartTemporary12 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary12!;
      })().viewportDimension - this._dart_1c5f203b5ad3537b_totalTrackMainAxisOffsets
    );
  }
  /**
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  get _dart_1c5f203b5ad3537b_traversableTrackExtent(): number {
    return this._dart_1c5f203b5ad3537b_trackExtent - 2 * this.mainAxisMargin;
  }
  /**
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  get _dart_1c5f203b5ad3537b_totalTrackMainAxisOffsets(): number {
    return this._dart_1c5f203b5ad3537b_isVertical
      ? (() => {
          const _dartTemporary13 = this._dart_1c5f203b5ad3537b_resolvedPadding;
          if (_dartTemporary13 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary13!;
        })().vertical
      : (() => {
          const _dartTemporary14 = this._dart_1c5f203b5ad3537b_resolvedPadding;
          if (_dartTemporary14 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary14!;
        })().horizontal;
  }
  /**
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  get _dart_1c5f203b5ad3537b_leadingTrackMainAxisOffset(): number {
    return (() => {
      const _dartTemporary15 = this._dart_1c5f203b5ad3537b_resolvedOrientation;
      switch (_dartTemporary15) {
        case SourceScrollbarOrientation.left:
          return (() => {
            const _dartTemporary16 = this._dart_1c5f203b5ad3537b_resolvedPadding;
            if (_dartTemporary16 === null)
              throw new TypeError('Null check operator used on a null value');
            return _dartTemporary16!;
          })().top;
        case SourceScrollbarOrientation.right:
          return (() => {
            const _dartTemporary17 = this._dart_1c5f203b5ad3537b_resolvedPadding;
            if (_dartTemporary17 === null)
              throw new TypeError('Null check operator used on a null value');
            return _dartTemporary17!;
          })().top;
        case SourceScrollbarOrientation.top:
          return (() => {
            const _dartTemporary18 = this._dart_1c5f203b5ad3537b_resolvedPadding;
            if (_dartTemporary18 === null)
              throw new TypeError('Null check operator used on a null value');
            return _dartTemporary18!;
          })().left;
        case SourceScrollbarOrientation.bottom:
          return (() => {
            const _dartTemporary19 = this._dart_1c5f203b5ad3537b_resolvedPadding;
            if (_dartTemporary19 === null)
              throw new TypeError('Null check operator used on a null value');
            return _dartTemporary19!;
          })().left;
        default:
          throw new TypeError('Non-exhaustive Dart switch expression');
      }
    })();
  }
  /**
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  get _dart_1c5f203b5ad3537b_leadingThumbMainAxisOffset(): number {
    return this._dart_1c5f203b5ad3537b_leadingTrackMainAxisOffset + this.mainAxisMargin;
  }
  _dart_1c5f203b5ad3537b_setThumbExtent(): void {
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const fractionVisible: number = clampDouble(
      ((() => {
        const _dartTemporary20 = this._dart_1c5f203b5ad3537b_lastMetrics;
        if (_dartTemporary20 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary20!;
      })().extentInside -
        this._dart_1c5f203b5ad3537b_totalTrackMainAxisOffsets) /
        (this._dart_1c5f203b5ad3537b_totalContentExtent -
          this._dart_1c5f203b5ad3537b_totalTrackMainAxisOffsets),
      0,
      1,
    );
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const thumbExtent: number = Math.max(
      Math.min(this._dart_1c5f203b5ad3537b_traversableTrackExtent, this.minOverscrollLength),
      this._dart_1c5f203b5ad3537b_traversableTrackExtent * fractionVisible,
    );
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const fractionOverscrolled: number =
      1 -
      (() => {
        const _dartTemporary21 = this._dart_1c5f203b5ad3537b_lastMetrics;
        if (_dartTemporary21 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary21!;
      })().extentInside /
        (() => {
          const _dartTemporary22 = this._dart_1c5f203b5ad3537b_lastMetrics;
          if (_dartTemporary22 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary22!;
        })().viewportDimension;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const safeMinLength: number = Math.min(
      this.minLength,
      this._dart_1c5f203b5ad3537b_traversableTrackExtent,
    );
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const newMinLength: number =
      this._dart_1c5f203b5ad3537b_beforeExtent > 0 && this._dart_1c5f203b5ad3537b_afterExtent > 0
        ? safeMinLength
        : safeMinLength * (1 - clampDouble(fractionOverscrolled, 0, 0.2) / 0.2);
    this._dart_1c5f203b5ad3537b_thumbExtent = clampDouble(
      thumbExtent,
      newMinLength,
      this._dart_1c5f203b5ad3537b_traversableTrackExtent,
    );
  }
  get _dart_1c5f203b5ad3537b_lastMetricsAreScrollable(): boolean {
    return (
      (() => {
        const _dartTemporary23 = this._dart_1c5f203b5ad3537b_lastMetrics;
        if (_dartTemporary23 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary23!;
      })().minScrollExtent !==
      (() => {
        const _dartTemporary24 = this._dart_1c5f203b5ad3537b_lastMetrics;
        if (_dartTemporary24 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary24!;
      })().maxScrollExtent
    );
  }
  get _dart_1c5f203b5ad3537b_isVertical(): boolean {
    return (
      (() => {
        const _dartTemporary25 = this._dart_1c5f203b5ad3537b_lastAxisDirection;
        const _dartTemporary26 = AxisDirection.down;
        return _dartTemporary25 === null || _dartTemporary26 === null
          ? _dartTemporary25 === _dartTemporary26
          : scrollbarRawObjectEquals(_dartTemporary25, _dartTemporary26);
      })() ||
      (() => {
        const _dartTemporary27 = this._dart_1c5f203b5ad3537b_lastAxisDirection;
        const _dartTemporary28 = AxisDirection.up;
        return _dartTemporary27 === null || _dartTemporary28 === null
          ? _dartTemporary27 === _dartTemporary28
          : scrollbarRawObjectEquals(_dartTemporary27, _dartTemporary28);
      })()
    );
  }
  get _dart_1c5f203b5ad3537b_isReversed(): boolean {
    return (
      (() => {
        const _dartTemporary29 = this._dart_1c5f203b5ad3537b_lastAxisDirection;
        const _dartTemporary30 = AxisDirection.up;
        return _dartTemporary29 === null || _dartTemporary30 === null
          ? _dartTemporary29 === _dartTemporary30
          : scrollbarRawObjectEquals(_dartTemporary29, _dartTemporary30);
      })() ||
      (() => {
        const _dartTemporary31 = this._dart_1c5f203b5ad3537b_lastAxisDirection;
        const _dartTemporary32 = AxisDirection.left;
        return _dartTemporary31 === null || _dartTemporary32 === null
          ? _dartTemporary31 === _dartTemporary32
          : scrollbarRawObjectEquals(_dartTemporary31, _dartTemporary32);
      })()
    );
  }
  /**
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  get _dart_1c5f203b5ad3537b_beforeExtent(): number {
    return this._dart_1c5f203b5ad3537b_isReversed
      ? (() => {
          const _dartTemporary33 = this._dart_1c5f203b5ad3537b_lastMetrics;
          if (_dartTemporary33 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary33!;
        })().extentAfter
      : (() => {
          const _dartTemporary34 = this._dart_1c5f203b5ad3537b_lastMetrics;
          if (_dartTemporary34 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary34!;
        })().extentBefore;
  }
  /**
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  get _dart_1c5f203b5ad3537b_afterExtent(): number {
    return this._dart_1c5f203b5ad3537b_isReversed
      ? (() => {
          const _dartTemporary35 = this._dart_1c5f203b5ad3537b_lastMetrics;
          if (_dartTemporary35 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary35!;
        })().extentBefore
      : (() => {
          const _dartTemporary36 = this._dart_1c5f203b5ad3537b_lastMetrics;
          if (_dartTemporary36 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary36!;
        })().extentAfter;
  }
  /**
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  get _dart_1c5f203b5ad3537b_totalContentExtent(): number {
    return (
      (() => {
        const _dartTemporary37 = this._dart_1c5f203b5ad3537b_lastMetrics;
        if (_dartTemporary37 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary37!;
      })().maxScrollExtent -
      (() => {
        const _dartTemporary38 = this._dart_1c5f203b5ad3537b_lastMetrics;
        if (_dartTemporary38 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary38!;
      })().minScrollExtent +
      (() => {
        const _dartTemporary39 = this._dart_1c5f203b5ad3537b_lastMetrics;
        if (_dartTemporary39 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary39!;
      })().viewportDimension
    );
  }
  get _dart_1c5f203b5ad3537b_resolvedOrientation(): SourceScrollbarOrientation {
    if (this.scrollbarOrientation === null) {
      if (this._dart_1c5f203b5ad3537b_isVertical) {
        return (() => {
          const _dartTemporary40 = this.textDirection;
          const _dartTemporary41 = 'ltr';
          return _dartTemporary40 === null || _dartTemporary41 === null
            ? _dartTemporary40 === _dartTemporary41
            : scrollbarRawObjectEquals(_dartTemporary40, _dartTemporary41);
        })()
          ? SourceScrollbarOrientation.right
          : SourceScrollbarOrientation.left;
      }
      return SourceScrollbarOrientation.bottom;
    }
    return (() => {
      const _dartTemporary42 = this.scrollbarOrientation;
      if (_dartTemporary42 === null)
        throw new TypeError('Null check operator used on a null value');
      return _dartTemporary42!;
    })();
  }
  _dart_1c5f203b5ad3537b_debugAssertIsValidOrientation(
    orientation: SourceScrollbarOrientation,
  ): void {
    if (FoundationBuildMode.debug)
      invariant(
        ((): boolean => {
          const isVerticalOrientation: (argument0: SourceScrollbarOrientation) => boolean = (
            orientation: SourceScrollbarOrientation,
          ): boolean => {
            return (
              scrollbarRawObjectEquals(orientation, SourceScrollbarOrientation.left) ||
              scrollbarRawObjectEquals(orientation, SourceScrollbarOrientation.right)
            );
          };
          return (
            (this._dart_1c5f203b5ad3537b_isVertical && isVerticalOrientation(orientation)) ||
            (!this._dart_1c5f203b5ad3537b_isVertical && !isVerticalOrientation(orientation))
          );
        })(),
        'generated-source-assert',
        `The given ScrollbarOrientation: ${scrollbarEnumString(orientation)} is incompatible with the current AxisDirection: ${(() => {
          const _dartTemporary43 = this._dart_1c5f203b5ad3537b_lastAxisDirection;
          return _dartTemporary43 === null ? 'null' : scrollbarEnumString(_dartTemporary43);
        })()}.`,
      );
  }
  update(metrics: ScrollMetrics, axisDirection: AxisDirection): void {
    if (
      this._dart_1c5f203b5ad3537b_lastMetrics !== null &&
      (() => {
        const _dartTemporary44 = this._dart_1c5f203b5ad3537b_lastMetrics;
        if (_dartTemporary44 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary44!;
      })().extentBefore === metrics.extentBefore &&
      (() => {
        const _dartTemporary45 = this._dart_1c5f203b5ad3537b_lastMetrics;
        if (_dartTemporary45 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary45!;
      })().extentInside === metrics.extentInside &&
      (() => {
        const _dartTemporary46 = this._dart_1c5f203b5ad3537b_lastMetrics;
        if (_dartTemporary46 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary46!;
      })().extentAfter === metrics.extentAfter &&
      (() => {
        const _dartTemporary47 = this._dart_1c5f203b5ad3537b_lastAxisDirection;
        const _dartTemporary48 = axisDirection;
        return _dartTemporary47 === null || _dartTemporary48 === null
          ? _dartTemporary47 === _dartTemporary48
          : scrollbarRawObjectEquals(_dartTemporary47, _dartTemporary48);
      })()
    ) {
      return;
    }
    const oldMetrics: ScrollMetrics | null = this._dart_1c5f203b5ad3537b_lastMetrics;
    this._dart_1c5f203b5ad3537b_lastMetrics = metrics;
    this._dart_1c5f203b5ad3537b_lastAxisDirection = axisDirection;
    if (
      !this._dart_1c5f203b5ad3537b_needPaint(oldMetrics) &&
      !this._dart_1c5f203b5ad3537b_needPaint(metrics)
    ) {
      return;
    }
    this.notifyListeners();
  }
  /**
   * @dartParam nextThickness double
   * @dartParamOrigin nextThickness explicit
   */
  updateThickness(nextThickness: number, nextRadius: Radius): void {
    this.thickness = nextThickness;
    this.radius = nextRadius;
  }
  get _dart_1c5f203b5ad3537b_paintThumb(): ScrollbarSourcePaint {
    return (() => {
      const _dartTemporary49 = new ScrollbarSourcePaint();
      _dartTemporary49.sourceColor = this.color.withOpacity(
        this.color.opacity * this.fadeoutOpacityAnimation.value,
      );
      return _dartTemporary49;
    })();
  }
  _dart_1c5f203b5ad3537b_needPaint(metrics: ScrollMetrics | null): boolean {
    return (
      metrics !== null &&
      (metrics as ScrollMetrics).maxScrollExtent - (metrics as ScrollMetrics).minScrollExtent >
        1e-10
    );
  }
  _dart_1c5f203b5ad3537b_paintTrack({
    isBorder = false,
  }: {
    readonly isBorder?: boolean;
  } = {}): ScrollbarSourcePaint {
    if (isBorder) {
      return (() => {
        const _dartTemporary50 = new ScrollbarSourcePaint();
        _dartTemporary50.sourceColor = this.trackBorderColor.withOpacity(
          this.trackBorderColor.opacity * this.fadeoutOpacityAnimation.value,
        );
        _dartTemporary50.style = 'stroke';
        _dartTemporary50.strokeWidth = 1;
        return _dartTemporary50;
      })();
    }
    return (() => {
      const _dartTemporary51 = new ScrollbarSourcePaint();
      _dartTemporary51.sourceColor = this.trackColor.withOpacity(
        this.trackColor.opacity * this.fadeoutOpacityAnimation.value,
      );
      return _dartTemporary51;
    })();
  }
  _dart_1c5f203b5ad3537b_paintScrollbar(canvas: Canvas, size: Size): void {
    if (FoundationBuildMode.debug)
      invariant(
        this.textDirection !== null,
        'generated-source-assert',
        'A TextDirection must be provided before a Scrollbar can be painted.',
      );
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    let x: number;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    let y: number;
    let thumbSize: Size;
    let trackSize: Size;
    let trackOffset: Offset;
    let borderStart: Offset;
    let borderEnd: Offset;
    this._dart_1c5f203b5ad3537b_debugAssertIsValidOrientation(
      this._dart_1c5f203b5ad3537b_resolvedOrientation,
    );
    switch (this._dart_1c5f203b5ad3537b_resolvedOrientation) {
      case SourceScrollbarOrientation.left: {
        thumbSize = new Size(this.thickness, this._dart_1c5f203b5ad3537b_thumbExtent);
        trackSize = new Size(
          this.thickness + 2 * this.crossAxisMargin,
          this._dart_1c5f203b5ad3537b_trackExtent,
        );
        x =
          this.crossAxisMargin +
          (() => {
            const _dartTemporary52 = this._dart_1c5f203b5ad3537b_resolvedPadding;
            if (_dartTemporary52 === null)
              throw new TypeError('Null check operator used on a null value');
            return _dartTemporary52!;
          })().left;
        y = this._dart_1c5f203b5ad3537b_thumbOffset;
        trackOffset = new Offset(
          x - this.crossAxisMargin,
          this._dart_1c5f203b5ad3537b_leadingTrackMainAxisOffset,
        );
        borderStart = trackOffset.add(new Offset(trackSize.width, 0));
        borderEnd = new Offset(
          trackOffset.dx + trackSize.width,
          trackOffset.dy + this._dart_1c5f203b5ad3537b_trackExtent,
        );
        break;
      }
      case SourceScrollbarOrientation.right: {
        thumbSize = new Size(this.thickness, this._dart_1c5f203b5ad3537b_thumbExtent);
        trackSize = new Size(
          this.thickness + 2 * this.crossAxisMargin,
          this._dart_1c5f203b5ad3537b_trackExtent,
        );
        x =
          size.width -
          this.thickness -
          this.crossAxisMargin -
          (() => {
            const _dartTemporary53 = this._dart_1c5f203b5ad3537b_resolvedPadding;
            if (_dartTemporary53 === null)
              throw new TypeError('Null check operator used on a null value');
            return _dartTemporary53!;
          })().right;
        y = this._dart_1c5f203b5ad3537b_thumbOffset;
        trackOffset = new Offset(
          x - this.crossAxisMargin,
          this._dart_1c5f203b5ad3537b_leadingTrackMainAxisOffset,
        );
        borderStart = trackOffset;
        borderEnd = new Offset(
          trackOffset.dx,
          trackOffset.dy + this._dart_1c5f203b5ad3537b_trackExtent,
        );
        break;
      }
      case SourceScrollbarOrientation.top: {
        thumbSize = new Size(this._dart_1c5f203b5ad3537b_thumbExtent, this.thickness);
        trackSize = new Size(
          this._dart_1c5f203b5ad3537b_trackExtent,
          this.thickness + 2 * this.crossAxisMargin,
        );
        x = this._dart_1c5f203b5ad3537b_thumbOffset;
        y =
          this.crossAxisMargin +
          (() => {
            const _dartTemporary54 = this._dart_1c5f203b5ad3537b_resolvedPadding;
            if (_dartTemporary54 === null)
              throw new TypeError('Null check operator used on a null value');
            return _dartTemporary54!;
          })().top;
        trackOffset = new Offset(
          this._dart_1c5f203b5ad3537b_leadingTrackMainAxisOffset,
          y - this.crossAxisMargin,
        );
        borderStart = trackOffset.add(new Offset(0, trackSize.height));
        borderEnd = new Offset(
          trackOffset.dx + this._dart_1c5f203b5ad3537b_trackExtent,
          trackOffset.dy + trackSize.height,
        );
        break;
      }
      case SourceScrollbarOrientation.bottom: {
        thumbSize = new Size(this._dart_1c5f203b5ad3537b_thumbExtent, this.thickness);
        trackSize = new Size(
          this._dart_1c5f203b5ad3537b_trackExtent,
          this.thickness + 2 * this.crossAxisMargin,
        );
        x = this._dart_1c5f203b5ad3537b_thumbOffset;
        y =
          size.height -
          this.thickness -
          this.crossAxisMargin -
          (() => {
            const _dartTemporary55 = this._dart_1c5f203b5ad3537b_resolvedPadding;
            if (_dartTemporary55 === null)
              throw new TypeError('Null check operator used on a null value');
            return _dartTemporary55!;
          })().bottom;
        trackOffset = new Offset(
          this._dart_1c5f203b5ad3537b_leadingTrackMainAxisOffset,
          y - this.crossAxisMargin,
        );
        borderStart = trackOffset;
        borderEnd = new Offset(
          trackOffset.dx + this._dart_1c5f203b5ad3537b_trackExtent,
          trackOffset.dy,
        );
        break;
      }
      default:
        throw new TypeError('Invalid value outside exhaustive Dart switch');
    }
    this._dart_1c5f203b5ad3537b_trackRect = trackOffset.and(trackSize);
    this._dart_1c5f203b5ad3537b_thumbRect = new Offset(x, y).and(thumbSize);
    if (this.fadeoutOpacityAnimation.value !== 0) {
      if (this.trackRadius === null) {
        canvas.drawRect(
          (() => {
            const _dartTemporary56 = this._dart_1c5f203b5ad3537b_trackRect;
            if (_dartTemporary56 === null)
              throw new TypeError('Null check operator used on a null value');
            return _dartTemporary56!;
          })(),
          this._dart_1c5f203b5ad3537b_paintTrack(),
        );
      } else {
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            (() => {
              const _dartTemporary57 = this._dart_1c5f203b5ad3537b_trackRect;
              if (_dartTemporary57 === null)
                throw new TypeError('Null check operator used on a null value');
              return _dartTemporary57!;
            })(),
            (() => {
              const _dartTemporary58 = this.trackRadius;
              if (_dartTemporary58 === null)
                throw new TypeError('Null check operator used on a null value');
              return _dartTemporary58!;
            })(),
          ),
          this._dart_1c5f203b5ad3537b_paintTrack(),
        );
      }
      canvas.drawLine(
        borderStart,
        borderEnd,
        this._dart_1c5f203b5ad3537b_paintTrack({ isBorder: true }),
      );
      if (this.radius !== null) {
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            (() => {
              const _dartTemporary59 = this._dart_1c5f203b5ad3537b_thumbRect;
              if (_dartTemporary59 === null)
                throw new TypeError('Null check operator used on a null value');
              return _dartTemporary59!;
            })(),
            (() => {
              const _dartTemporary60 = this.radius;
              if (_dartTemporary60 === null)
                throw new TypeError('Null check operator used on a null value');
              return _dartTemporary60!;
            })(),
          ),
          this._dart_1c5f203b5ad3537b_paintThumb,
        );
        return;
      }
      if (this.shape === null) {
        canvas.drawRect(
          (() => {
            const _dartTemporary61 = this._dart_1c5f203b5ad3537b_thumbRect;
            if (_dartTemporary61 === null)
              throw new TypeError('Null check operator used on a null value');
            return _dartTemporary61!;
          })(),
          this._dart_1c5f203b5ad3537b_paintThumb,
        );
        return;
      }
      if (
        (() => {
          const _dartTemporary62 = this.shape;
          if (_dartTemporary62 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary62!;
        })().preferPaintInterior
      ) {
        (() => {
          const _dartTemporary64 = this.shape;
          if (_dartTemporary64 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary64!;
        })().paintInterior(
          canvas,
          (() => {
            const _dartTemporary63 = this._dart_1c5f203b5ad3537b_thumbRect;
            if (_dartTemporary63 === null)
              throw new TypeError('Null check operator used on a null value');
            return _dartTemporary63!;
          })(),
          this._dart_1c5f203b5ad3537b_paintThumb,
        );
      } else {
        const outerPath: Path = (() => {
          const _dartTemporary66 = this.shape;
          if (_dartTemporary66 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary66!;
        })().getOuterPath(
          (() => {
            const _dartTemporary65 = this._dart_1c5f203b5ad3537b_thumbRect;
            if (_dartTemporary65 === null)
              throw new TypeError('Null check operator used on a null value');
            return _dartTemporary65!;
          })(),
        );
        canvas.drawPath(outerPath, this._dart_1c5f203b5ad3537b_paintThumb);
      }
      (() => {
        const _dartTemporary68 = this.shape;
        if (_dartTemporary68 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary68!;
      })().paint(
        canvas,
        (() => {
          const _dartTemporary67 = this._dart_1c5f203b5ad3537b_thumbRect;
          if (_dartTemporary67 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary67!;
        })(),
      );
    }
  }
  paint(canvas: Canvas, size: Size): void {
    if (
      this._dart_1c5f203b5ad3537b_lastAxisDirection === null ||
      !this._dart_1c5f203b5ad3537b_needPaint(this._dart_1c5f203b5ad3537b_lastMetrics)
    ) {
      return;
    }
    if (this._dart_1c5f203b5ad3537b_traversableTrackExtent <= 0) {
      return;
    }
    if (
      scrollbarIsInfinite(
        (() => {
          const _dartTemporary69 = this._dart_1c5f203b5ad3537b_lastMetrics;
          if (_dartTemporary69 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary69!;
        })().maxScrollExtent,
      )
    ) {
      return;
    }
    this._dart_1c5f203b5ad3537b_setThumbExtent();
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const thumbPositionOffset: number = this._dart_1c5f203b5ad3537b_getScrollToTrack(
      (() => {
        const _dartTemporary70 = this._dart_1c5f203b5ad3537b_lastMetrics;
        if (_dartTemporary70 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary70!;
      })(),
      this._dart_1c5f203b5ad3537b_thumbExtent,
    );
    this._dart_1c5f203b5ad3537b_thumbOffset =
      thumbPositionOffset + this._dart_1c5f203b5ad3537b_leadingThumbMainAxisOffset;
    return this._dart_1c5f203b5ad3537b_paintScrollbar(canvas, size);
  }
  /**
   * @dartParam thumbOffsetLocal double
   * @dartParamOrigin thumbOffsetLocal explicit
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  getTrackToScroll(thumbOffsetLocal: number): number {
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const scrollableExtent: number =
      (() => {
        const _dartTemporary71 = this._dart_1c5f203b5ad3537b_lastMetrics;
        if (_dartTemporary71 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary71!;
      })().maxScrollExtent -
      (() => {
        const _dartTemporary72 = this._dart_1c5f203b5ad3537b_lastMetrics;
        if (_dartTemporary72 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary72!;
      })().minScrollExtent;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const thumbMovableExtent: number =
      this._dart_1c5f203b5ad3537b_traversableTrackExtent - this._dart_1c5f203b5ad3537b_thumbExtent;
    return (scrollableExtent * thumbOffsetLocal) / thumbMovableExtent;
  }
  /**
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  getThumbScrollOffset(): number {
    if (FoundationBuildMode.debug)
      invariant(
        Number.isFinite(
          (() => {
            const _dartTemporary73 = this._dart_1c5f203b5ad3537b_lastMetrics;
            if (_dartTemporary73 === null)
              throw new TypeError('Null check operator used on a null value');
            return _dartTemporary73!;
          })().maxScrollExtent,
        ) &&
          Number.isFinite(
            (() => {
              const _dartTemporary74 = this._dart_1c5f203b5ad3537b_lastMetrics;
              if (_dartTemporary74 === null)
                throw new TypeError('Null check operator used on a null value');
              return _dartTemporary74!;
            })().minScrollExtent,
          ),
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const scrollableExtent: number =
      (() => {
        const _dartTemporary75 = this._dart_1c5f203b5ad3537b_lastMetrics;
        if (_dartTemporary75 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary75!;
      })().maxScrollExtent -
      (() => {
        const _dartTemporary76 = this._dart_1c5f203b5ad3537b_lastMetrics;
        if (_dartTemporary76 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary76!;
      })().minScrollExtent;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const maxFraction: number =
      (() => {
        const _dartTemporary77 = this._dart_1c5f203b5ad3537b_lastMetrics;
        if (_dartTemporary77 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary77!;
      })().maxScrollExtent / scrollableExtent;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const minFraction: number =
      (() => {
        const _dartTemporary78 = this._dart_1c5f203b5ad3537b_lastMetrics;
        if (_dartTemporary78 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary78!;
      })().minScrollExtent / scrollableExtent;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const fractionPast: number =
      scrollableExtent > 0
        ? clampDouble(
            (() => {
              const _dartTemporary79 = this._dart_1c5f203b5ad3537b_lastMetrics;
              if (_dartTemporary79 === null)
                throw new TypeError('Null check operator used on a null value');
              return _dartTemporary79!;
            })().pixels / scrollableExtent,
            minFraction,
            maxFraction,
          )
        : 0;
    return (
      fractionPast *
      (this._dart_1c5f203b5ad3537b_traversableTrackExtent - this._dart_1c5f203b5ad3537b_thumbExtent)
    );
  }
  /**
   * @dartParam thumbExtent double
   * @dartParamOrigin thumbExtent explicit
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  _dart_1c5f203b5ad3537b_getScrollToTrack(metrics: ScrollMetrics, thumbExtent: number): number {
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const scrollableExtent: number = metrics.maxScrollExtent - metrics.minScrollExtent;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const fractionPast: number =
      scrollableExtent > 0
        ? clampDouble((metrics.pixels - metrics.minScrollExtent) / scrollableExtent, 0, 1)
        : 0;
    return (
      (this._dart_1c5f203b5ad3537b_isReversed ? 1 - fractionPast : fractionPast) *
      (this._dart_1c5f203b5ad3537b_traversableTrackExtent - thumbExtent)
    );
  }
  hitTest(position: Offset | null): boolean | null {
    if (this._dart_1c5f203b5ad3537b_thumbRect === null) {
      return null;
    }
    if (
      this.ignorePointer ||
      this.fadeoutOpacityAnimation.value === 0 ||
      !this._dart_1c5f203b5ad3537b_lastMetricsAreScrollable
    ) {
      return false;
    }
    return (() => {
      const _dartTemporary81 = this._dart_1c5f203b5ad3537b_trackRect;
      if (_dartTemporary81 === null)
        throw new TypeError('Null check operator used on a null value');
      return _dartTemporary81!;
    })().contains(
      (() => {
        const _dartTemporary80 = position;
        if (_dartTemporary80 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary80!;
      })(),
    );
  }
  hitTestInteractive(
    position: Offset,
    kind: PointerDeviceKind,
    {
      forHover = false,
    }: {
      readonly forHover?: boolean;
    } = {},
  ): boolean {
    if (this._dart_1c5f203b5ad3537b_trackRect === null) {
      return false;
    }
    if (this.ignorePointer) {
      return false;
    }
    if (!this._dart_1c5f203b5ad3537b_lastMetricsAreScrollable) {
      return false;
    }
    const interactiveRect: Rect = (() => {
      const _dartTemporary82 = this._dart_1c5f203b5ad3537b_trackRect;
      if (_dartTemporary82 === null)
        throw new TypeError('Null check operator used on a null value');
      return _dartTemporary82!;
    })();
    const paddedRect: Rect = interactiveRect.expandToInclude(
      Rect.fromCircle({
        center: (() => {
          const _dartTemporary83 = this._dart_1c5f203b5ad3537b_thumbRect;
          if (_dartTemporary83 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary83!;
        })().center,
        radius: _kMinInteractiveSize / 2,
      }),
    );
    if (this.fadeoutOpacityAnimation.value === 0) {
      if (forHover && scrollbarRawObjectEquals(kind, PointerDeviceKind.mouse)) {
        return paddedRect.contains(position);
      }
      return false;
    }
    switch (kind) {
      case PointerDeviceKind.touch:
      case PointerDeviceKind.trackpad: {
        return paddedRect.contains(position);
      }
      case PointerDeviceKind.mouse:
      case PointerDeviceKind.stylus:
      case PointerDeviceKind.invertedStylus:
      case PointerDeviceKind.unknown: {
        return interactiveRect.contains(position);
      }
      default:
        throw new TypeError('Invalid value outside exhaustive Dart switch');
    }
  }
  hitTestOnlyThumbInteractive(position: Offset, kind: PointerDeviceKind): boolean {
    if (this._dart_1c5f203b5ad3537b_thumbRect === null) {
      return false;
    }
    if (this.ignorePointer) {
      return false;
    }
    if (this.fadeoutOpacityAnimation.value === 0) {
      return false;
    }
    if (!this._dart_1c5f203b5ad3537b_lastMetricsAreScrollable) {
      return false;
    }
    switch (kind) {
      case PointerDeviceKind.touch:
      case PointerDeviceKind.trackpad: {
        const touchThumbRect: Rect = (() => {
          const _dartTemporary85 = this._dart_1c5f203b5ad3537b_thumbRect;
          if (_dartTemporary85 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary85!;
        })().expandToInclude(
          Rect.fromCircle({
            center: (() => {
              const _dartTemporary84 = this._dart_1c5f203b5ad3537b_thumbRect;
              if (_dartTemporary84 === null)
                throw new TypeError('Null check operator used on a null value');
              return _dartTemporary84!;
            })().center,
            radius: _kMinInteractiveSize / 2,
          }),
        );
        return touchThumbRect.contains(position);
      }
      case PointerDeviceKind.mouse:
      case PointerDeviceKind.stylus:
      case PointerDeviceKind.invertedStylus:
      case PointerDeviceKind.unknown: {
        return (() => {
          const _dartTemporary86 = this._dart_1c5f203b5ad3537b_thumbRect;
          if (_dartTemporary86 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary86!;
        })().contains(position);
      }
      default:
        throw new TypeError('Invalid value outside exhaustive Dart switch');
    }
  }
  shouldRepaint(oldDelegate: SourceScrollbarPainter): boolean {
    if (!(oldDelegate instanceof SourceScrollbarPainter))
      throw new TypeError('Invalid covariant argument: oldDelegate');
    return (
      !scrollbarValueEquals(this.color, oldDelegate.color) ||
      !scrollbarValueEquals(this.trackColor, oldDelegate.trackColor) ||
      !scrollbarValueEquals(this.trackBorderColor, oldDelegate.trackBorderColor) ||
      !(() => {
        const _dartTemporary87 = this.textDirection;
        const _dartTemporary88 = oldDelegate.textDirection;
        return _dartTemporary87 === null || _dartTemporary88 === null
          ? _dartTemporary87 === _dartTemporary88
          : scrollbarRawObjectEquals(_dartTemporary87, _dartTemporary88);
      })() ||
      this.thickness !== oldDelegate.thickness ||
      !scrollbarRawObjectEquals(
        this.fadeoutOpacityAnimation,
        oldDelegate.fadeoutOpacityAnimation,
      ) ||
      this.mainAxisMargin !== oldDelegate.mainAxisMargin ||
      this.crossAxisMargin !== oldDelegate.crossAxisMargin ||
      !(() => {
        const _dartTemporary89 = this.radius;
        const _dartTemporary90 = oldDelegate.radius;
        return _dartTemporary89 === null || _dartTemporary90 === null
          ? _dartTemporary89 === _dartTemporary90
          : scrollbarValueEquals(_dartTemporary89, _dartTemporary90);
      })() ||
      !(() => {
        const _dartTemporary91 = this.trackRadius;
        const _dartTemporary92 = oldDelegate.trackRadius;
        return _dartTemporary91 === null || _dartTemporary92 === null
          ? _dartTemporary91 === _dartTemporary92
          : scrollbarValueEquals(_dartTemporary91, _dartTemporary92);
      })() ||
      !(() => {
        const _dartTemporary93 = this.shape;
        const _dartTemporary94 = oldDelegate.shape;
        return _dartTemporary93 === null || _dartTemporary94 === null
          ? _dartTemporary93 === _dartTemporary94
          : scrollbarRawObjectEquals(_dartTemporary93, _dartTemporary94);
      })() ||
      !scrollbarValueEquals(this.padding, oldDelegate.padding) ||
      this.minLength !== oldDelegate.minLength ||
      this.minOverscrollLength !== oldDelegate.minOverscrollLength ||
      !(() => {
        const _dartTemporary95 = this.scrollbarOrientation;
        const _dartTemporary96 = oldDelegate.scrollbarOrientation;
        return _dartTemporary95 === null || _dartTemporary96 === null
          ? _dartTemporary95 === _dartTemporary96
          : scrollbarRawObjectEquals(_dartTemporary95, _dartTemporary96);
      })() ||
      this.ignorePointer !== oldDelegate.ignorePointer
    );
  }
  shouldRebuildSemantics(oldDelegate: ScrollbarCustomPainterContract): boolean {
    if (!scrollbarIsPainter(oldDelegate))
      throw new TypeError('Invalid covariant argument: oldDelegate');
    return false;
  }
  get semanticsBuilder():
    | ((argument0: Size) => ScrollbarSourceList<CustomPainterSemantics>)
    | null {
    return null;
  }
  override toString(): string {
    return describeIdentity(this);
  }
  override dispose(): void {
    this.fadeoutOpacityAnimation.removeListener(dartMethodTearOff(this, this.notifyListeners));
    super.dispose();
  }
}
export class SourceRawScrollbar extends ScrollbarStatefulHost {
  readonly child: Widget;
  readonly controller: ScrollController | null;
  readonly thumbVisibility: boolean | null;
  readonly shape: OutlinedBorder | null;
  readonly radius: Radius | null;
  /**
   * @dartType double?
   * @dartTypeOrigin explicit
   */
  readonly thickness: number | null;
  readonly thumbColor: Color | null;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  readonly minThumbLength: number;
  /**
   * @dartType double?
   * @dartTypeOrigin explicit
   */
  readonly minOverscrollLength: number | null;
  readonly trackVisibility: boolean | null;
  readonly trackRadius: Radius | null;
  readonly trackColor: Color | null;
  readonly trackBorderColor: Color | null;
  readonly fadeDuration: number;
  readonly timeToFade: number;
  readonly pressDuration: number;
  readonly notificationPredicate: (argument0: ScrollNotification) => boolean;
  readonly interactive: boolean | null;
  readonly scrollbarOrientation: SourceScrollbarOrientation | null;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  readonly mainAxisMargin: number;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  readonly crossAxisMargin: number;
  readonly padding: EdgeInsetsGeometry | null;
  readonly mouseCursor: SourceWidgetStateProperty<MouseCursor | null> | null;
  /**
   * @dartParam thickness double?
   * @dartParamOrigin thickness inferred
   * @dartParam minThumbLength double
   * @dartParamOrigin minThumbLength inferred
   * @dartParam minOverscrollLength double?
   * @dartParamOrigin minOverscrollLength inferred
   * @dartParam mainAxisMargin double
   * @dartParamOrigin mainAxisMargin inferred
   * @dartParam crossAxisMargin double
   * @dartParamOrigin crossAxisMargin inferred
   */
  constructor({
    key = null,
    child,
    controller = null,
    thumbVisibility = null,
    shape = null,
    radius = null,
    thickness = null,
    thumbColor = null,
    minThumbLength = _kMinThumbExtent,
    minOverscrollLength = null,
    trackVisibility = null,
    trackRadius = null,
    trackColor = null,
    trackBorderColor = null,
    fadeDuration = _kScrollbarFadeDuration,
    timeToFade = _kScrollbarTimeToFade,
    pressDuration = 0,
    notificationPredicate = defaultScrollNotificationPredicate,
    interactive = null,
    scrollbarOrientation = null,
    mainAxisMargin = 0,
    crossAxisMargin = 0,
    padding = null,
    mouseCursor = null,
  }: {
    readonly key?: Key | null;
    readonly child: Widget;
    readonly controller?: ScrollController | null;
    readonly thumbVisibility?: boolean | null;
    readonly shape?: OutlinedBorder | null;
    readonly radius?: Radius | null;
    readonly thickness?: number | null;
    readonly thumbColor?: Color | null;
    readonly minThumbLength?: number;
    readonly minOverscrollLength?: number | null;
    readonly trackVisibility?: boolean | null;
    readonly trackRadius?: Radius | null;
    readonly trackColor?: Color | null;
    readonly trackBorderColor?: Color | null;
    readonly fadeDuration?: number;
    readonly timeToFade?: number;
    readonly pressDuration?: number;
    readonly notificationPredicate?: (argument0: ScrollNotification) => boolean;
    readonly interactive?: boolean | null;
    readonly scrollbarOrientation?: SourceScrollbarOrientation | null;
    readonly mainAxisMargin?: number;
    readonly crossAxisMargin?: number;
    readonly padding?: EdgeInsetsGeometry | null;
    readonly mouseCursor?: SourceWidgetStateProperty<MouseCursor | null> | null;
  }) {
    const _initialField0 = child;
    const _initialField1 = controller;
    const _initialField2 = thumbVisibility;
    const _initialField3 = shape;
    const _initialField4 = radius;
    /**
     * @dartType double?
     * @dartTypeOrigin inferred
     */
    const _initialField5 = thickness;
    const _initialField6 = thumbColor;
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const _initialField7 = minThumbLength;
    /**
     * @dartType double?
     * @dartTypeOrigin inferred
     */
    const _initialField8 = minOverscrollLength;
    const _initialField9 = trackVisibility;
    const _initialField10 = trackRadius;
    const _initialField11 = trackColor;
    const _initialField12 = trackBorderColor;
    const _initialField13 = fadeDuration;
    const _initialField14 = timeToFade;
    const _initialField15 = pressDuration;
    const _initialField16 = notificationPredicate;
    const _initialField17 = interactive;
    const _initialField18 = scrollbarOrientation;
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const _initialField19 = mainAxisMargin;
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const _initialField20 = crossAxisMargin;
    const _initialField21 = padding;
    const _initialField22 = mouseCursor;
    if (FoundationBuildMode.debug)
      invariant(
        !(thumbVisibility === false && (trackVisibility ?? false)),
        'generated-source-assert',
        'A scrollbar track cannot be drawn without a scrollbar thumb.',
      );
    if (FoundationBuildMode.debug)
      invariant(minThumbLength >= 0, 'generated-source-assert', 'Pinned Dart assertion failed');
    if (FoundationBuildMode.debug)
      invariant(
        minOverscrollLength === null || (minOverscrollLength as number) <= minThumbLength,
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    if (FoundationBuildMode.debug)
      invariant(
        minOverscrollLength === null || (minOverscrollLength as number) >= 0,
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    if (FoundationBuildMode.debug)
      invariant(
        radius === null || shape === null,
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    super({ key: key });
    captureDartType(
      this,
      applyDartType<SourceRawScrollbar>(
        SourceRawScrollbar,
        'RawScrollbar',
        [],
        [scrollbarStatefulType],
      ),
    );
    this.child = _initialField0;
    this.controller = _initialField1;
    this.thumbVisibility = _initialField2;
    this.shape = _initialField3;
    this.radius = _initialField4;
    this.thickness = _initialField5;
    this.thumbColor = _initialField6;
    this.minThumbLength = _initialField7;
    this.minOverscrollLength = _initialField8;
    this.trackVisibility = _initialField9;
    this.trackRadius = _initialField10;
    this.trackColor = _initialField11;
    this.trackBorderColor = _initialField12;
    this.fadeDuration = _initialField13;
    this.timeToFade = _initialField14;
    this.pressDuration = _initialField15;
    this.notificationPredicate = _initialField16;
    this.interactive = _initialField17;
    this.scrollbarOrientation = _initialField18;
    this.mainAxisMargin = _initialField19;
    this.crossAxisMargin = _initialField20;
    this.padding = _initialField21;
    this.mouseCursor = _initialField22;
    protect(this, [
      'child',
      'controller',
      'thumbVisibility',
      'shape',
      'radius',
      'thickness',
      'thumbColor',
      'minThumbLength',
      'minOverscrollLength',
      'trackVisibility',
      'trackRadius',
      'trackColor',
      'trackBorderColor',
      'fadeDuration',
      'timeToFade',
      'pressDuration',
      'notificationPredicate',
      'interactive',
      'scrollbarOrientation',
      'mainAxisMargin',
      'crossAxisMargin',
      'padding',
      'mouseCursor',
    ]);
  }
  override createState(): SourceRawScrollbarState<SourceRawScrollbar> {
    return new SourceRawScrollbarState<SourceRawScrollbar>(
      applyDartType<SourceRawScrollbar>(
        SourceRawScrollbar,
        'RawScrollbar',
        [],
        [scrollbarStatefulType],
      ),
    );
  }
}
export class SourceRawScrollbarState<T extends SourceRawScrollbar> extends ScrollbarStateHost<T> {
  _dart_1c5f203b5ad3537b_startDragScrollbarAxisOffset: Offset | null;
  _dart_1c5f203b5ad3537b_lastDragUpdateOffset: Offset | null;
  /**
   * @dartType double?
   * @dartTypeOrigin explicit
   */
  _dart_1c5f203b5ad3537b_startDragThumbOffset: number | null;
  _dart_1c5f203b5ad3537b_cachedController: ScrollController | null;
  _dart_1c5f203b5ad3537b_fadeoutTimer: ScrollbarTimer | null;
  get _dart_1c5f203b5ad3537b_fadeoutAnimationController(): AnimationController {
    return dartLateRead<AnimationController>(
      this,
      'package:flutter/src/widgets/scrollbar.dart::RawScrollbarState._fadeoutAnimationController:FIELD',
      '_fadeoutAnimationController',
    );
  }
  set _dart_1c5f203b5ad3537b_fadeoutAnimationController(value: AnimationController) {
    dartLateWrite<AnimationController>(
      this,
      'package:flutter/src/widgets/scrollbar.dart::RawScrollbarState._fadeoutAnimationController:FIELD',
      '_fadeoutAnimationController',
      value,
      false,
    );
  }
  get _dart_1c5f203b5ad3537b_fadeoutOpacityAnimation(): CurvedAnimation {
    return dartLateRead<CurvedAnimation>(
      this,
      'package:flutter/src/widgets/scrollbar.dart::RawScrollbarState._fadeoutOpacityAnimation:FIELD',
      '_fadeoutOpacityAnimation',
    );
  }
  set _dart_1c5f203b5ad3537b_fadeoutOpacityAnimation(value: CurvedAnimation) {
    dartLateWrite<CurvedAnimation>(
      this,
      'package:flutter/src/widgets/scrollbar.dart::RawScrollbarState._fadeoutOpacityAnimation:FIELD',
      '_fadeoutOpacityAnimation',
      value,
      false,
    );
  }
  readonly _dart_1c5f203b5ad3537b_scrollbarPainterKey: GlobalKey<State<StatefulWidget>>;
  _dart_1c5f203b5ad3537b_hoverIsActive: boolean;
  _dart_1c5f203b5ad3537b_dragIsActive: boolean;
  _dart_1c5f203b5ad3537b_thumbDragPointerKind: PointerDeviceKind | null;
  _dart_1c5f203b5ad3537b_effectiveMouseCursor: MouseCursor;
  _dart_1c5f203b5ad3537b_thumbDrag: Drag | null;
  _dart_1c5f203b5ad3537b_maxScrollExtentPermitsScrolling: boolean;
  _dart_1c5f203b5ad3537b_thumbHold: ScrollHoldController | null;
  _dart_1c5f203b5ad3537b_axis: Axis | null;
  readonly _dart_1c5f203b5ad3537b_gestureDetectorKey: GlobalKey<RawGestureDetectorState>;
  get scrollbarPainter(): SourceScrollbarPainter {
    return dartLateRead<SourceScrollbarPainter>(
      this,
      'package:flutter/src/widgets/scrollbar.dart::RawScrollbarState.scrollbarPainter:FIELD',
      'scrollbarPainter',
    );
  }
  set scrollbarPainter(value: SourceScrollbarPainter) {
    dartLateWrite<SourceScrollbarPainter>(
      this,
      'package:flutter/src/widgets/scrollbar.dart::RawScrollbarState.scrollbarPainter:FIELD',
      'scrollbarPainter',
      value,
      true,
    );
  }
  constructor(_dartTemporary97: DartTypeWitness<T>) {
    const _initialField0 = scrollbarGlobalKey();
    const _initialField1 = false;
    const _initialField2 = false;
    const _initialField3 = MouseCursor.defer;
    const _initialField4 = false;
    const _initialField5 = scrollbarGestureKey();
    super();
    captureDartType(
      this,
      applyDartType<SourceRawScrollbarState<T>>(
        SourceRawScrollbarState,
        'RawScrollbarState',
        [_dartTemporary97],
        [scrollbarStateType<T>(_dartTemporary97), scrollbarTickerStateType<T>(_dartTemporary97)],
      ),
    );
    this._dart_1c5f203b5ad3537b_startDragScrollbarAxisOffset = null;
    this._dart_1c5f203b5ad3537b_lastDragUpdateOffset = null;
    this._dart_1c5f203b5ad3537b_startDragThumbOffset = null;
    this._dart_1c5f203b5ad3537b_cachedController = null;
    this._dart_1c5f203b5ad3537b_fadeoutTimer = null;
    this._dart_1c5f203b5ad3537b_scrollbarPainterKey = _initialField0;
    this._dart_1c5f203b5ad3537b_hoverIsActive = _initialField1;
    this._dart_1c5f203b5ad3537b_dragIsActive = _initialField2;
    this._dart_1c5f203b5ad3537b_thumbDragPointerKind = null;
    this._dart_1c5f203b5ad3537b_effectiveMouseCursor = _initialField3;
    this._dart_1c5f203b5ad3537b_thumbDrag = null;
    this._dart_1c5f203b5ad3537b_maxScrollExtentPermitsScrolling = _initialField4;
    this._dart_1c5f203b5ad3537b_thumbHold = null;
    this._dart_1c5f203b5ad3537b_axis = null;
    this._dart_1c5f203b5ad3537b_gestureDetectorKey = _initialField5;
    protect(this, [
      '_dart_1c5f203b5ad3537b_scrollbarPainterKey',
      '_dart_1c5f203b5ad3537b_gestureDetectorKey',
    ]);
  }
  get _dart_1c5f203b5ad3537b_effectiveScrollController(): ScrollController | null {
    return this.widget.controller ?? PrimaryScrollController.maybeOf(this.context);
  }
  get showScrollbar(): boolean {
    return this.widget.thumbVisibility ?? false;
  }
  get _dart_1c5f203b5ad3537b_showTrack(): boolean {
    return this.showScrollbar && (this.widget.trackVisibility ?? false);
  }
  get enableGestures(): boolean {
    return this.widget.interactive ?? true;
  }
  override initState(): void {
    super.initState();
    this._dart_1c5f203b5ad3537b_fadeoutAnimationController = (() => {
      const _dartTemporary98 = new AnimationController({
        vsync: this,
        duration: this.widget.fadeDuration,
      });
      _dartTemporary98.addStatusListener(
        dartMethodTearOff(this, this._dart_1c5f203b5ad3537b_validateInteractions),
      );
      return _dartTemporary98;
    })();
    this._dart_1c5f203b5ad3537b_fadeoutOpacityAnimation = new CurvedAnimation({
      parent: this._dart_1c5f203b5ad3537b_fadeoutAnimationController,
      curve: Curves.fastOutSlowIn,
    });
    this.scrollbarPainter = new SourceScrollbarPainter({
      color: this.widget.thumbColor ?? constSourceColor(Color, 1723645116),
      fadeoutOpacityAnimation: this._dart_1c5f203b5ad3537b_fadeoutOpacityAnimation,
      thickness: this.widget.thickness ?? _kScrollbarThickness,
      radius: this.widget.radius,
      trackRadius: this.widget.trackRadius,
      scrollbarOrientation: this.widget.scrollbarOrientation,
      mainAxisMargin: this.widget.mainAxisMargin,
      shape: this.widget.shape,
      crossAxisMargin: this.widget.crossAxisMargin,
      minLength: this.widget.minThumbLength,
      minOverscrollLength: this.widget.minOverscrollLength ?? this.widget.minThumbLength,
    });
  }
  override didChangeDependencies(): void {
    super.didChangeDependencies();
    if (FoundationBuildMode.debug)
      invariant(
        this._dart_1c5f203b5ad3537b_debugScheduleCheckHasValidScrollPosition(),
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
  }
  _dart_1c5f203b5ad3537b_debugScheduleCheckHasValidScrollPosition(): boolean {
    if (!this.showScrollbar) {
      return true;
    }
    scrollbarPostFrame(
      this,
      (_duration: number): void => {
        if (FoundationBuildMode.debug)
          invariant(
            this._dart_1c5f203b5ad3537b_debugCheckHasValidScrollPosition(),
            'generated-source-assert',
            'Pinned Dart assertion failed',
          );
      },
      { debugLabel: 'RawScrollbar.checkScrollPosition' },
    );
    return true;
  }
  _dart_1c5f203b5ad3537b_validateInteractions(status: AnimationStatus): void {
    if (status.isDismissed) {
      if (FoundationBuildMode.debug)
        invariant(
          this._dart_1c5f203b5ad3537b_fadeoutOpacityAnimation.value === 0,
          'generated-source-assert',
          'Pinned Dart assertion failed',
        );
    } else if (
      this._dart_1c5f203b5ad3537b_effectiveScrollController !== null &&
      this.enableGestures
    ) {
      if (
        scrollbarRawObjectEquals(
          this._dart_1c5f203b5ad3537b_fadeoutAnimationController.status,
          AnimationStatus.forward,
        ) &&
        (this.widget.thumbVisibility ?? false)
      ) {
        return;
      }
      if (FoundationBuildMode.debug)
        invariant(
          this._dart_1c5f203b5ad3537b_debugCheckHasValidScrollPosition(),
          'generated-source-assert',
          'Pinned Dart assertion failed',
        );
    }
  }
  _dart_1c5f203b5ad3537b_debugCheckHasValidScrollPosition(): boolean {
    if (!this.mounted) {
      return true;
    }
    const scrollController: ScrollController | null =
      this._dart_1c5f203b5ad3537b_effectiveScrollController;
    const tryPrimary: boolean = this.widget.controller === null;
    const controllerForError: string = tryPrimary
      ? 'PrimaryScrollController'
      : 'provided ScrollController';
    let when: string = '';
    if (this.widget.thumbVisibility ?? false) {
      when = 'Scrollbar.thumbVisibility is true';
    } else if (this.enableGestures) {
      when = 'the scrollbar is interactive';
    } else {
      when = 'using the Scrollbar';
    }
    if (FoundationBuildMode.debug)
      invariant(
        scrollController !== null,
        'generated-source-assert',
        `A ScrollController is required when ${when}. ${tryPrimary ? 'The Scrollbar was not provided a ScrollController, and attempted to use the PrimaryScrollController, but none was found.' : ''}`,
      );
    if (FoundationBuildMode.debug)
      invariant(
        ((): boolean => {
          if (
            !(() => {
              const _dartTemporary99 = scrollController;
              if (_dartTemporary99 === null)
                throw new TypeError('Null check operator used on a null value');
              return _dartTemporary99!;
            })().hasClients
          ) {
            (() => {
              const _dartTemporary103 = FlutterError.fromParts(
                (() => {
                  const _dartTemporary100: DiagnosticsNode[] = [];
                  _dartTemporary100.push(
                    new ErrorSummary(
                      "The Scrollbar's ScrollController has no ScrollPosition attached.",
                    ),
                  );
                  _dartTemporary100.push(
                    new ErrorDescription(
                      'A Scrollbar cannot be painted without a ScrollPosition. ',
                    ),
                  );
                  _dartTemporary100.push(
                    new ErrorHint(
                      `The Scrollbar attempted to use the ${controllerForError}. This ScrollController should be associated with the ScrollView that the Scrollbar is being applied to.`,
                    ),
                  );
                  if (tryPrimary) {
                    const _dartTemporary101 = [
                      new ErrorHint(
                        'If a ScrollController has not been provided, the PrimaryScrollController is used by default on mobile platforms for ScrollViews with an Axis.vertical scroll direction.',
                      ),
                      new ErrorHint(
                        'To use the PrimaryScrollController explicitly, set ScrollView.primary to true on the Scrollable widget.',
                      ),
                    ];
                    for (const _dartTemporary102 of _dartTemporary101)
                      _dartTemporary100.push(_dartTemporary102);
                  } else
                    _dartTemporary100.push(
                      new ErrorHint(
                        'When providing your own ScrollController, ensure both the Scrollbar and the Scrollable widget use the same one.',
                      ),
                    );
                  return _dartTemporary100;
                })(),
              );
              throw _dartTemporary103;
            })();
          }
          return true;
        })(),
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    if (FoundationBuildMode.debug)
      invariant(
        ((): boolean => {
          try {
            void (() => {
              const _dartTemporary104 = scrollController;
              if (_dartTemporary104 === null)
                throw new TypeError('Null check operator used on a null value');
              return _dartTemporary104!;
            })().position;
          } catch (_dartTemporary105) {
            const _dartTemporary106 = captureDartException(_dartTemporary105);
            {
              void _dartTemporary106.exception;
              if (
                scrollController === null ||
                checkedInteger(
                  scrollbarIterableLength((scrollController as ScrollController).positions),
                ) <= 1
              ) {
                (() => {
                  throw _dartTemporary106.exception;
                })();
              }
              (() => {
                const _dartTemporary110 = FlutterError.fromParts(
                  (() => {
                    const _dartTemporary107: DiagnosticsNode[] = [];
                    _dartTemporary107.push(
                      new ErrorSummary(
                        `The ${controllerForError} is attached to more than one ScrollPosition.`,
                      ),
                    );
                    _dartTemporary107.push(
                      new ErrorDescription(
                        'The Scrollbar requires a single ScrollPosition in order to be painted.',
                      ),
                    );
                    _dartTemporary107.push(
                      new ErrorHint(
                        `When ${when}, the associated ScrollController must only have one ScrollPosition attached.`,
                      ),
                    );
                    if (tryPrimary) {
                      const _dartTemporary108 = [
                        new ErrorHint(
                          'If a ScrollController has not been provided, the PrimaryScrollController is used by default on mobile platforms for ScrollViews with an Axis.vertical scroll direction.',
                        ),
                        new ErrorHint(
                          'More than one ScrollView may have tried to use the PrimaryScrollController of the current context. ScrollView.primary can override this behavior.',
                        ),
                      ];
                      for (const _dartTemporary109 of _dartTemporary108)
                        _dartTemporary107.push(_dartTemporary109);
                    } else
                      _dartTemporary107.push(
                        new ErrorHint(
                          'The provided ScrollController cannot be shared by multiple ScrollView widgets.',
                        ),
                      );
                    return _dartTemporary107;
                  })(),
                );
                throw _dartTemporary110;
              })();
            }
          }
          return true;
        })(),
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    return true;
  }
  updateScrollbarPainter(): void {
    const textDirection: ScrollbarTextDirection = Directionality.of(this.context);
    (() => {
      const _dartTemporary111 = this.scrollbarPainter;
      _dartTemporary111.color = this.widget.thumbColor ?? constSourceColor(Color, 1723645116);
      _dartTemporary111.trackRadius = this.widget.trackRadius;
      _dartTemporary111.trackColor = this._dart_1c5f203b5ad3537b_showTrack
        ? (this.widget.trackColor ?? constSourceColor(Color, 134217728))
        : constSourceColor(Color, 0);
      _dartTemporary111.trackBorderColor = this._dart_1c5f203b5ad3537b_showTrack
        ? (this.widget.trackBorderColor ?? constSourceColor(Color, 436207616))
        : constSourceColor(Color, 0);
      _dartTemporary111.textDirection = textDirection;
      _dartTemporary111.thickness = this.widget.thickness ?? _kScrollbarThickness;
      _dartTemporary111.radius = this.widget.radius;
      _dartTemporary111.padding = (
        this.widget.padding ?? scrollbarMediaPadding(this.context)
      ).resolve(textDirection);
      _dartTemporary111.scrollbarOrientation = this.widget.scrollbarOrientation;
      _dartTemporary111.mainAxisMargin = this.widget.mainAxisMargin;
      _dartTemporary111.shape = this.widget.shape;
      _dartTemporary111.crossAxisMargin = this.widget.crossAxisMargin;
      _dartTemporary111.minLength = this.widget.minThumbLength;
      _dartTemporary111.minOverscrollLength =
        this.widget.minOverscrollLength ?? this.widget.minThumbLength;
      _dartTemporary111.ignorePointer = !this.enableGestures;
      return _dartTemporary111;
    })();
  }
  override didUpdateWidget(oldWidget: T): void {
    castDartType<T>(oldWidget, readDartType<T>(this, SourceRawScrollbarState, 0));
    super.didUpdateWidget(oldWidget);
    if (this.widget.thumbVisibility !== oldWidget.thumbVisibility) {
      if (this.widget.thumbVisibility ?? false) {
        if (FoundationBuildMode.debug)
          invariant(
            this._dart_1c5f203b5ad3537b_debugScheduleCheckHasValidScrollPosition(),
            'generated-source-assert',
            'Pinned Dart assertion failed',
          );
        void (this._dart_1c5f203b5ad3537b_fadeoutTimer?.cancel() ?? null);
        this._dart_1c5f203b5ad3537b_fadeoutAnimationController.animateTo(1);
      } else {
        this._dart_1c5f203b5ad3537b_fadeoutAnimationController.reverse();
      }
    }
    if (
      !(() => {
        const _dartTemporary112 = this.widget.mouseCursor;
        const _dartTemporary113 = oldWidget.mouseCursor;
        return _dartTemporary112 === null || _dartTemporary113 === null
          ? _dartTemporary112 === _dartTemporary113
          : scrollbarRawObjectEquals(_dartTemporary112, _dartTemporary113);
      })()
    ) {
      this.updateMouseCursor();
    }
    this._dart_1c5f203b5ad3537b_releaseStalePointerState();
  }
  _dart_1c5f203b5ad3537b_maybeStartFadeoutTimer(): void {
    if (!this.showScrollbar) {
      void (this._dart_1c5f203b5ad3537b_fadeoutTimer?.cancel() ?? null);
      this._dart_1c5f203b5ad3537b_fadeoutTimer = new ScrollbarTimer(
        this.widget.timeToFade,
        (): void => {
          this._dart_1c5f203b5ad3537b_fadeoutAnimationController.reverse();
          this._dart_1c5f203b5ad3537b_fadeoutTimer = null;
        },
      );
    }
  }
  getScrollbarDirection(): Axis | null {
    return this._dart_1c5f203b5ad3537b_axis;
  }
  _dart_1c5f203b5ad3537b_disposeThumbDrag(): void {
    this._dart_1c5f203b5ad3537b_thumbDrag = null;
  }
  _dart_1c5f203b5ad3537b_disposeThumbHold(): void {
    this._dart_1c5f203b5ad3537b_thumbHold = null;
  }
  /**
   * @dartReturn double?
   * @dartReturnOrigin explicit
   */
  _dart_1c5f203b5ad3537b_getPrimaryDelta(localPosition: Offset): number | null {
    if (FoundationBuildMode.debug)
      invariant(
        this._dart_1c5f203b5ad3537b_cachedController !== null,
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    if (FoundationBuildMode.debug)
      invariant(
        this._dart_1c5f203b5ad3537b_startDragScrollbarAxisOffset !== null,
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    if (FoundationBuildMode.debug)
      invariant(
        this._dart_1c5f203b5ad3537b_lastDragUpdateOffset !== null,
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    if (FoundationBuildMode.debug)
      invariant(
        this._dart_1c5f203b5ad3537b_startDragThumbOffset !== null,
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    const position: ScrollPosition = (() => {
      const _dartTemporary114 = this._dart_1c5f203b5ad3537b_cachedController;
      if (_dartTemporary114 === null)
        throw new TypeError('Null check operator used on a null value');
      return _dartTemporary114!;
    })().position;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const primaryDeltaFromDragStart = dartLateLocal<number>('primaryDeltaFromDragStart', false);
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const primaryDeltaFromLastDragUpdate = dartLateLocal<number>(
      'primaryDeltaFromLastDragUpdate',
      false,
    );
    switch (position.axisDirection) {
      case AxisDirection.up: {
        primaryDeltaFromDragStart.value =
          (() => {
            const _dartTemporary115 = this._dart_1c5f203b5ad3537b_startDragScrollbarAxisOffset;
            if (_dartTemporary115 === null)
              throw new TypeError('Null check operator used on a null value');
            return _dartTemporary115!;
          })().dy - localPosition.dy;
        primaryDeltaFromLastDragUpdate.value =
          (() => {
            const _dartTemporary116 = this._dart_1c5f203b5ad3537b_lastDragUpdateOffset;
            if (_dartTemporary116 === null)
              throw new TypeError('Null check operator used on a null value');
            return _dartTemporary116!;
          })().dy - localPosition.dy;
        break;
      }
      case AxisDirection.right: {
        primaryDeltaFromDragStart.value =
          localPosition.dx -
          (() => {
            const _dartTemporary117 = this._dart_1c5f203b5ad3537b_startDragScrollbarAxisOffset;
            if (_dartTemporary117 === null)
              throw new TypeError('Null check operator used on a null value');
            return _dartTemporary117!;
          })().dx;
        primaryDeltaFromLastDragUpdate.value =
          localPosition.dx -
          (() => {
            const _dartTemporary118 = this._dart_1c5f203b5ad3537b_lastDragUpdateOffset;
            if (_dartTemporary118 === null)
              throw new TypeError('Null check operator used on a null value');
            return _dartTemporary118!;
          })().dx;
        break;
      }
      case AxisDirection.down: {
        primaryDeltaFromDragStart.value =
          localPosition.dy -
          (() => {
            const _dartTemporary119 = this._dart_1c5f203b5ad3537b_startDragScrollbarAxisOffset;
            if (_dartTemporary119 === null)
              throw new TypeError('Null check operator used on a null value');
            return _dartTemporary119!;
          })().dy;
        primaryDeltaFromLastDragUpdate.value =
          localPosition.dy -
          (() => {
            const _dartTemporary120 = this._dart_1c5f203b5ad3537b_lastDragUpdateOffset;
            if (_dartTemporary120 === null)
              throw new TypeError('Null check operator used on a null value');
            return _dartTemporary120!;
          })().dy;
        break;
      }
      case AxisDirection.left: {
        primaryDeltaFromDragStart.value =
          (() => {
            const _dartTemporary121 = this._dart_1c5f203b5ad3537b_startDragScrollbarAxisOffset;
            if (_dartTemporary121 === null)
              throw new TypeError('Null check operator used on a null value');
            return _dartTemporary121!;
          })().dx - localPosition.dx;
        primaryDeltaFromLastDragUpdate.value =
          (() => {
            const _dartTemporary122 = this._dart_1c5f203b5ad3537b_lastDragUpdateOffset;
            if (_dartTemporary122 === null)
              throw new TypeError('Null check operator used on a null value');
            return _dartTemporary122!;
          })().dx - localPosition.dx;
        break;
      }
      default:
        throw new TypeError('Invalid value outside exhaustive Dart switch');
    }
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    let scrollOffsetGlobal: number = this.scrollbarPainter.getTrackToScroll(
      (() => {
        const _dartTemporary123 = this._dart_1c5f203b5ad3537b_startDragThumbOffset;
        if (_dartTemporary123 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary123!;
      })() + primaryDeltaFromDragStart.value,
    );
    if (
      (primaryDeltaFromDragStart.value > 0 && scrollOffsetGlobal < position.pixels) ||
      (primaryDeltaFromDragStart.value < 0 && scrollOffsetGlobal > position.pixels)
    ) {
      scrollOffsetGlobal =
        position.pixels +
        this.scrollbarPainter.getTrackToScroll(primaryDeltaFromLastDragUpdate.value);
    }
    if (scrollOffsetGlobal !== position.pixels) {
      /**
       * @dartType double
       * @dartTypeOrigin explicit
       */
      const physicsAdjustment: number = position.physics.applyBoundaryConditions(
        position,
        scrollOffsetGlobal,
      );
      /**
       * @dartType double
       * @dartTypeOrigin explicit
       */
      let newPosition: number = scrollOffsetGlobal - physicsAdjustment;
      switch (ScrollConfiguration.of(this.context).getPlatform(this.context)) {
        case 'fuchsia':
        case 'linux':
        case 'macOS':
        case 'windows': {
          newPosition = clampDouble(
            newPosition,
            position.minScrollExtent,
            position.maxScrollExtent,
          );
          break;
        }
        case 'iOS':
        case 'android':
          break;
        default:
          throw new TypeError('Invalid value outside exhaustive Dart switch');
      }
      const isReversed: boolean = axisDirectionIsReversed(position.axisDirection);
      return isReversed ? newPosition - position.pixels : position.pixels - newPosition;
    }
    return null;
  }
  handleThumbPress(): void {
    if (FoundationBuildMode.debug)
      invariant(
        this._dart_1c5f203b5ad3537b_debugCheckHasValidScrollPosition(),
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    this._dart_1c5f203b5ad3537b_cachedController =
      this._dart_1c5f203b5ad3537b_effectiveScrollController;
    if (this.getScrollbarDirection() === null) {
      return;
    }
    void (this._dart_1c5f203b5ad3537b_fadeoutTimer?.cancel() ?? null);
    this._dart_1c5f203b5ad3537b_thumbHold = (() => {
      const _dartTemporary124 = this._dart_1c5f203b5ad3537b_cachedController;
      if (_dartTemporary124 === null)
        throw new TypeError('Null check operator used on a null value');
      return _dartTemporary124!;
    })().position.hold(dartMethodTearOff(this, this._dart_1c5f203b5ad3537b_disposeThumbHold));
  }
  handleThumbPressStart(localPosition: Offset): void {
    if (FoundationBuildMode.debug)
      invariant(
        this._dart_1c5f203b5ad3537b_debugCheckHasValidScrollPosition(),
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    const direction: Axis | null = this.getScrollbarDirection();
    if (direction === null) {
      return;
    }
    void (this._dart_1c5f203b5ad3537b_fadeoutTimer?.cancel() ?? null);
    this._dart_1c5f203b5ad3537b_fadeoutAnimationController.forward();
    if (FoundationBuildMode.debug)
      invariant(
        this._dart_1c5f203b5ad3537b_thumbDrag === null,
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    const position: ScrollPosition = (() => {
      const _dartTemporary125 = this._dart_1c5f203b5ad3537b_cachedController;
      if (_dartTemporary125 === null)
        throw new TypeError('Null check operator used on a null value');
      return _dartTemporary125!;
    })().position;
    const renderBox: RenderBox = scrollbarCastRenderBox(
      (() => {
        const _dartTemporary127 = scrollbarRenderObject(
          (() => {
            const _dartTemporary126 = scrollbarKeyContext(
              this._dart_1c5f203b5ad3537b_scrollbarPainterKey,
            );
            if (_dartTemporary126 === null)
              throw new TypeError('Null check operator used on a null value');
            return _dartTemporary126!;
          })(),
        );
        if (_dartTemporary127 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary127!;
      })(),
    );
    const details: DragStartDetails = new DragStartDetails({
      localPosition: localPosition,
      globalPosition: scrollbarLocalToGlobal(renderBox, localPosition),
    });
    this._dart_1c5f203b5ad3537b_thumbDrag = position.drag(
      details,
      dartMethodTearOff(this, this._dart_1c5f203b5ad3537b_disposeThumbDrag),
    );
    if (FoundationBuildMode.debug)
      invariant(
        this._dart_1c5f203b5ad3537b_thumbDrag !== null,
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    if (FoundationBuildMode.debug)
      invariant(
        this._dart_1c5f203b5ad3537b_thumbHold === null,
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    this._dart_1c5f203b5ad3537b_startDragScrollbarAxisOffset = localPosition;
    this._dart_1c5f203b5ad3537b_lastDragUpdateOffset = localPosition;
    this._dart_1c5f203b5ad3537b_startDragThumbOffset = this.scrollbarPainter.getThumbScrollOffset();
    this._dart_1c5f203b5ad3537b_dragIsActive = true;
    this.updateMouseCursor();
  }
  handleThumbPressUpdate(localPosition: Offset): void {
    if (FoundationBuildMode.debug)
      invariant(
        this._dart_1c5f203b5ad3537b_debugCheckHasValidScrollPosition(),
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    if (
      (() => {
        const _dartTemporary128 = this._dart_1c5f203b5ad3537b_lastDragUpdateOffset;
        const _dartTemporary129 = localPosition;
        return _dartTemporary128 === null || _dartTemporary129 === null
          ? _dartTemporary128 === _dartTemporary129
          : _dartTemporary128.equals(_dartTemporary129);
      })()
    ) {
      return;
    }
    const position: ScrollPosition = (() => {
      const _dartTemporary130 = this._dart_1c5f203b5ad3537b_cachedController;
      if (_dartTemporary130 === null)
        throw new TypeError('Null check operator used on a null value');
      return _dartTemporary130!;
    })().position;
    if (!position.physics.shouldAcceptUserOffset(position)) {
      return;
    }
    const direction: Axis | null = this.getScrollbarDirection();
    if (direction === null) {
      return;
    }
    if (FoundationBuildMode.debug)
      invariant(
        this._dart_1c5f203b5ad3537b_thumbHold === null ||
          this._dart_1c5f203b5ad3537b_thumbDrag === null,
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    if (this._dart_1c5f203b5ad3537b_thumbDrag === null) {
      return;
    }
    /**
     * @dartType double?
     * @dartTypeOrigin explicit
     */
    const primaryDelta: number | null = this._dart_1c5f203b5ad3537b_getPrimaryDelta(localPosition);
    if (primaryDelta === null) {
      return;
    }
    const delta: Offset = (() => {
      const _dartTemporary131 = direction as Axis;
      switch (_dartTemporary131) {
        case Axis.horizontal:
          return new Offset(primaryDelta as number, 0);
        case Axis.vertical:
          return new Offset(0, primaryDelta as number);
        default:
          throw new TypeError('Non-exhaustive Dart switch expression');
      }
    })();
    const renderBox: RenderBox = scrollbarCastRenderBox(
      (() => {
        const _dartTemporary133 = scrollbarRenderObject(
          (() => {
            const _dartTemporary132 = scrollbarKeyContext(
              this._dart_1c5f203b5ad3537b_scrollbarPainterKey,
            );
            if (_dartTemporary132 === null)
              throw new TypeError('Null check operator used on a null value');
            return _dartTemporary132!;
          })(),
        );
        if (_dartTemporary133 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary133!;
      })(),
    );
    const scrollDetails: DragUpdateDetails = new DragUpdateDetails({
      delta: delta,
      primaryDelta: primaryDelta as number,
      globalPosition: scrollbarLocalToGlobal(renderBox, localPosition),
      localPosition: localPosition,
    });
    (() => {
      const _dartTemporary134 = this._dart_1c5f203b5ad3537b_thumbDrag;
      if (_dartTemporary134 === null)
        throw new TypeError('Null check operator used on a null value');
      return _dartTemporary134!;
    })().update(scrollDetails);
    this._dart_1c5f203b5ad3537b_lastDragUpdateOffset = localPosition;
  }
  handleThumbPressEnd(localPosition: Offset, velocity: Velocity): void {
    if (FoundationBuildMode.debug)
      invariant(
        this._dart_1c5f203b5ad3537b_debugCheckHasValidScrollPosition(),
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    this._dart_1c5f203b5ad3537b_dragIsActive = false;
    this.updateMouseCursor();
    const direction: Axis | null = this.getScrollbarDirection();
    if (direction === null) {
      return;
    }
    this._dart_1c5f203b5ad3537b_maybeStartFadeoutTimer();
    this._dart_1c5f203b5ad3537b_cachedController = null;
    this._dart_1c5f203b5ad3537b_lastDragUpdateOffset = null;
    if (FoundationBuildMode.debug)
      invariant(
        this._dart_1c5f203b5ad3537b_thumbHold === null ||
          this._dart_1c5f203b5ad3537b_thumbDrag === null,
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    if (this._dart_1c5f203b5ad3537b_thumbDrag === null) {
      return;
    }
    const platform: TargetPlatform = ScrollConfiguration.of(this.context).getPlatform(this.context);
    const adjustedVelocity: Velocity = (() => {
      const _dartTemporary135 = platform;
      switch (_dartTemporary135) {
        case 'iOS':
          return velocity.negate();
        case 'android':
          return velocity.negate();
        default:
          return Velocity.zero;
      }
    })();
    const renderBox: RenderBox = scrollbarCastRenderBox(
      (() => {
        const _dartTemporary137 = scrollbarRenderObject(
          (() => {
            const _dartTemporary136 = scrollbarKeyContext(
              this._dart_1c5f203b5ad3537b_scrollbarPainterKey,
            );
            if (_dartTemporary136 === null)
              throw new TypeError('Null check operator used on a null value');
            return _dartTemporary136!;
          })(),
        );
        if (_dartTemporary137 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary137!;
      })(),
    );
    const details: DragEndDetails = new DragEndDetails({
      localPosition: localPosition,
      globalPosition: scrollbarLocalToGlobal(renderBox, localPosition),
      velocity: adjustedVelocity,
      primaryVelocity: (() => {
        const _dartTemporary138 = direction as Axis;
        switch (_dartTemporary138) {
          case Axis.horizontal:
            return adjustedVelocity.pixelsPerSecond.dx;
          case Axis.vertical:
            return adjustedVelocity.pixelsPerSecond.dy;
          default:
            throw new TypeError('Non-exhaustive Dart switch expression');
        }
      })(),
    });
    void (this._dart_1c5f203b5ad3537b_thumbDrag?.end(details) ?? null);
    if (FoundationBuildMode.debug)
      invariant(
        this._dart_1c5f203b5ad3537b_thumbDrag === null,
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    this._dart_1c5f203b5ad3537b_startDragScrollbarAxisOffset = null;
    this._dart_1c5f203b5ad3537b_lastDragUpdateOffset = null;
    this._dart_1c5f203b5ad3537b_startDragThumbOffset = null;
    this._dart_1c5f203b5ad3537b_cachedController = null;
  }
  handleTrackTapDown(details: TapDownDetails): void {
    if (FoundationBuildMode.debug)
      invariant(
        this._dart_1c5f203b5ad3537b_debugCheckHasValidScrollPosition(),
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    this._dart_1c5f203b5ad3537b_cachedController =
      this._dart_1c5f203b5ad3537b_effectiveScrollController;
    const position: ScrollPosition = (() => {
      const _dartTemporary139 = this._dart_1c5f203b5ad3537b_cachedController;
      if (_dartTemporary139 === null)
        throw new TypeError('Null check operator used on a null value');
      return _dartTemporary139!;
    })().position;
    if (!position.physics.shouldAcceptUserOffset(position)) {
      return;
    }
    let scrollDirection: AxisDirection;
    switch (axisDirectionToAxis(position.axisDirection)) {
      case Axis.vertical: {
        if (details.localPosition.dy > this.scrollbarPainter._dart_1c5f203b5ad3537b_thumbOffset) {
          scrollDirection = AxisDirection.down;
        } else {
          scrollDirection = AxisDirection.up;
        }
        break;
      }
      case Axis.horizontal: {
        if (details.localPosition.dx > this.scrollbarPainter._dart_1c5f203b5ad3537b_thumbOffset) {
          scrollDirection = AxisDirection.right;
        } else {
          scrollDirection = AxisDirection.left;
        }
        break;
      }
      default:
        throw new TypeError('Invalid value outside exhaustive Dart switch');
    }
    const state: ScrollableState | null = Scrollable.maybeOf(
      (() => {
        const _dartTemporary140 = position.context.notificationContext;
        if (_dartTemporary140 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary140!;
      })(),
    );
    const intent: ScrollIntent = new ScrollIntent({
      direction: scrollDirection,
      type: ScrollIncrementType.page,
    });
    if (FoundationBuildMode.debug)
      invariant(state !== null, 'generated-source-assert', 'Pinned Dart assertion failed');
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const scrollIncrement: number = ScrollAction.getDirectionalIncrement(
      (() => {
        const _dartTemporary141 = state;
        if (_dartTemporary141 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary141!;
      })(),
      intent,
    );
    (() => {
      const _dartTemporary143 = this._dart_1c5f203b5ad3537b_cachedController;
      if (_dartTemporary143 === null)
        throw new TypeError('Null check operator used on a null value');
      return _dartTemporary143!;
    })().position.moveTo(
      (() => {
        const _dartTemporary142 = this._dart_1c5f203b5ad3537b_cachedController;
        if (_dartTemporary142 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary142!;
      })().position.pixels + scrollIncrement,
      { duration: 0 + 100 * 1, curve: Curves.easeInOut },
    );
  }
  _dart_1c5f203b5ad3537b_shouldUpdatePainter(notificationAxis: Axis): boolean {
    const scrollController: ScrollController | null =
      this._dart_1c5f203b5ad3537b_effectiveScrollController;
    if (scrollController === null) {
      return true;
    }
    if (
      checkedInteger(scrollbarIterableLength((scrollController as ScrollController).positions)) > 1
    ) {
      return false;
    }
    return (
      !(scrollController as ScrollController).hasClients ||
      scrollbarRawObjectEquals(
        (scrollController as ScrollController).position.axis,
        notificationAxis,
      )
    );
  }
  _dart_1c5f203b5ad3537b_handleScrollMetricsNotification(
    notification: ScrollMetricsNotification,
  ): boolean {
    if (!this.widget.notificationPredicate(notification.asScrollUpdate())) {
      return false;
    }
    if (
      this.showScrollbar &&
      !this._dart_1c5f203b5ad3537b_fadeoutAnimationController.isForwardOrCompleted
    ) {
      this._dart_1c5f203b5ad3537b_fadeoutAnimationController.forward();
    }
    const metrics: ScrollMetrics = notification.metrics;
    if (this._dart_1c5f203b5ad3537b_shouldUpdatePainter(metrics.axis)) {
      this.scrollbarPainter.update(metrics, metrics.axisDirection);
    }
    if (
      !(() => {
        const _dartTemporary144 = metrics.axis;
        const _dartTemporary145 = this._dart_1c5f203b5ad3537b_axis;
        return _dartTemporary144 === null || _dartTemporary145 === null
          ? _dartTemporary144 === _dartTemporary145
          : scrollbarRawObjectEquals(_dartTemporary144, _dartTemporary145);
      })()
    ) {
      this.setState((): void => {
        this._dart_1c5f203b5ad3537b_axis = metrics.axis;
      });
    }
    if (
      this._dart_1c5f203b5ad3537b_maxScrollExtentPermitsScrolling !==
      notification.metrics.maxScrollExtent > 0
    ) {
      this.setState((): void => {
        this._dart_1c5f203b5ad3537b_maxScrollExtentPermitsScrolling =
          !this._dart_1c5f203b5ad3537b_maxScrollExtentPermitsScrolling;
      });
      this._dart_1c5f203b5ad3537b_releaseStalePointerState();
    }
    return false;
  }
  _dart_1c5f203b5ad3537b_handleScrollNotification(notification: ScrollNotification): boolean {
    if (!this.widget.notificationPredicate(notification)) {
      return false;
    }
    const metrics: ScrollMetrics = notification.metrics;
    if (metrics.maxScrollExtent <= metrics.minScrollExtent) {
      if (this._dart_1c5f203b5ad3537b_fadeoutAnimationController.isForwardOrCompleted) {
        this._dart_1c5f203b5ad3537b_fadeoutAnimationController.reverse();
      }
      if (this._dart_1c5f203b5ad3537b_shouldUpdatePainter(metrics.axis)) {
        this.scrollbarPainter.update(metrics, metrics.axisDirection);
      }
      return false;
    }
    if (scrollbarIsScrollUpdate(notification) || scrollbarIsOverscroll(notification)) {
      if (!this._dart_1c5f203b5ad3537b_fadeoutAnimationController.isForwardOrCompleted) {
        this._dart_1c5f203b5ad3537b_fadeoutAnimationController.forward();
      }
      void (this._dart_1c5f203b5ad3537b_fadeoutTimer?.cancel() ?? null);
      if (this._dart_1c5f203b5ad3537b_shouldUpdatePainter(metrics.axis)) {
        this.scrollbarPainter.update(metrics, metrics.axisDirection);
      }
    } else if (scrollbarIsScrollEnd(notification)) {
      if (this._dart_1c5f203b5ad3537b_thumbDrag === null) {
        this._dart_1c5f203b5ad3537b_maybeStartFadeoutTimer();
      }
    }
    return false;
  }
  _dart_1c5f203b5ad3537b_handleThumbDragDown(_details: DragDownDetails): void {
    this.handleThumbPress();
  }
  _dart_1c5f203b5ad3537b_globalToScrollbar(offset: Offset): Offset {
    const renderBox: RenderBox = scrollbarCastRenderBox(
      (() => {
        const _dartTemporary147 = scrollbarRenderObject(
          (() => {
            const _dartTemporary146 = scrollbarKeyContext(
              this._dart_1c5f203b5ad3537b_scrollbarPainterKey,
            );
            if (_dartTemporary146 === null)
              throw new TypeError('Null check operator used on a null value');
            return _dartTemporary146!;
          })(),
        );
        if (_dartTemporary147 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary147!;
      })(),
    );
    return scrollbarGlobalToLocal(renderBox, offset);
  }
  _dart_1c5f203b5ad3537b_handleThumbDragStart(details: DragStartDetails): void {
    this._dart_1c5f203b5ad3537b_thumbDragPointerKind = details.kind;
    this.handleThumbPressStart(
      this._dart_1c5f203b5ad3537b_globalToScrollbar(details.globalPosition),
    );
  }
  _dart_1c5f203b5ad3537b_handleThumbDragUpdate(details: DragUpdateDetails): void {
    this.handleThumbPressUpdate(
      this._dart_1c5f203b5ad3537b_globalToScrollbar(details.globalPosition),
    );
  }
  _dart_1c5f203b5ad3537b_handleThumbDragEnd(details: DragEndDetails): void {
    this._dart_1c5f203b5ad3537b_updateHoverStateAfterThumbDrag(details.globalPosition);
    this.handleThumbPressEnd(
      this._dart_1c5f203b5ad3537b_globalToScrollbar(details.globalPosition),
      details.velocity,
    );
  }
  _dart_1c5f203b5ad3537b_updateHoverStateAfterThumbDrag(globalPosition: Offset): void {
    const kind: PointerDeviceKind | null = this._dart_1c5f203b5ad3537b_thumbDragPointerKind;
    this._dart_1c5f203b5ad3537b_thumbDragPointerKind = null;
    if (kind === null || !this.enableGestures) {
      return;
    }
    switch (kind as PointerDeviceKind) {
      case PointerDeviceKind.mouse:
      case PointerDeviceKind.trackpad: {
        this._dart_1c5f203b5ad3537b_hoverIsActive = this.isPointerOverScrollbar(
          globalPosition,
          kind as PointerDeviceKind,
          { forHover: true },
        );
        break;
      }
      case PointerDeviceKind.stylus:
      case PointerDeviceKind.invertedStylus:
      case PointerDeviceKind.touch:
      case PointerDeviceKind.unknown: {
        break;
      }
      default:
        throw new TypeError('Invalid value outside exhaustive Dart switch');
    }
  }
  _dart_1c5f203b5ad3537b_releaseStalePointerState(): void {
    const hoverIsStale: boolean = this._dart_1c5f203b5ad3537b_hoverIsActive && !this.enableGestures;
    const dragIsStale: boolean =
      this._dart_1c5f203b5ad3537b_dragIsActive &&
      !this._dart_1c5f203b5ad3537b_canHandleScrollGestures();
    if (!hoverIsStale && !dragIsStale) {
      return;
    }
    if (hoverIsStale) {
      this._dart_1c5f203b5ad3537b_hoverIsActive = false;
    }
    if (dragIsStale) {
      this._dart_1c5f203b5ad3537b_dragIsActive = false;
      this._dart_1c5f203b5ad3537b_thumbDragPointerKind = null;
    }
    this.updateMouseCursor();
  }
  _dart_1c5f203b5ad3537b_handleThumbDragCancel(): void {
    if (scrollbarKeyContext(this._dart_1c5f203b5ad3537b_gestureDetectorKey) === null) {
      return;
    }
    if (FoundationBuildMode.debug)
      invariant(
        this._dart_1c5f203b5ad3537b_thumbHold === null ||
          this._dart_1c5f203b5ad3537b_thumbDrag === null,
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    void (this._dart_1c5f203b5ad3537b_thumbHold?.cancel() ?? null);
    void (this._dart_1c5f203b5ad3537b_thumbDrag?.cancel() ?? null);
    if (FoundationBuildMode.debug)
      invariant(
        this._dart_1c5f203b5ad3537b_thumbHold === null,
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    if (FoundationBuildMode.debug)
      invariant(
        this._dart_1c5f203b5ad3537b_thumbDrag === null,
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    this._dart_1c5f203b5ad3537b_thumbDragPointerKind = null;
    if (this._dart_1c5f203b5ad3537b_dragIsActive) {
      this._dart_1c5f203b5ad3537b_dragIsActive = false;
      this.updateMouseCursor();
    }
  }
  _dart_1c5f203b5ad3537b_initThumbDragGestureRecognizer(instance: DragGestureRecognizer): void {
    instance.onDown = dartMethodTearOff(this, this._dart_1c5f203b5ad3537b_handleThumbDragDown);
    instance.onStart = dartMethodTearOff(this, this._dart_1c5f203b5ad3537b_handleThumbDragStart);
    instance.onUpdate = dartMethodTearOff(this, this._dart_1c5f203b5ad3537b_handleThumbDragUpdate);
    instance.onEnd = dartMethodTearOff(this, this._dart_1c5f203b5ad3537b_handleThumbDragEnd);
    instance.onCancel = dartMethodTearOff(this, this._dart_1c5f203b5ad3537b_handleThumbDragCancel);
    instance.gestureSettings = scrollbarConstGestureSettings(DeviceGestureSettings, {
      touchSlop: 0,
    });
    instance.dragStartBehavior = DragStartBehavior.down;
  }
  _dart_1c5f203b5ad3537b_canHandleScrollGestures(): boolean {
    return (
      this.enableGestures &&
      this._dart_1c5f203b5ad3537b_effectiveScrollController !== null &&
      checkedInteger(
        scrollbarIterableLength(
          (() => {
            const _dartTemporary148 = this._dart_1c5f203b5ad3537b_effectiveScrollController;
            if (_dartTemporary148 === null)
              throw new TypeError('Null check operator used on a null value');
            return _dartTemporary148!;
          })().positions,
        ),
      ) === 1 &&
      (() => {
        const _dartTemporary149 = this._dart_1c5f203b5ad3537b_effectiveScrollController;
        if (_dartTemporary149 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary149!;
      })().position.hasContentDimensions &&
      (() => {
        const _dartTemporary150 = this._dart_1c5f203b5ad3537b_effectiveScrollController;
        if (_dartTemporary150 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary150!;
      })().position.maxScrollExtent -
        (() => {
          const _dartTemporary151 = this._dart_1c5f203b5ad3537b_effectiveScrollController;
          if (_dartTemporary151 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary151!;
        })().position.minScrollExtent >
        1e-10
    );
  }
  get _dart_1c5f203b5ad3537b_gestures(): DartMap<
    GestureRecognizerType,
    GestureRecognizerFactory<GestureRecognizer>
  > {
    const gestures: DartMap<
      GestureRecognizerType,
      GestureRecognizerFactory<GestureRecognizer>
    > = (() => {
      const _dartTemporary152 = scrollbarGestureMap();
      return _dartTemporary152;
    })();
    if (!this._dart_1c5f203b5ad3537b_canHandleScrollGestures()) {
      return gestures;
    }
    switch (
      (() => {
        const _dartTemporary159 = this._dart_1c5f203b5ad3537b_effectiveScrollController;
        if (_dartTemporary159 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary159!;
      })().position.axis
    ) {
      case Axis.horizontal: {
        (() => {
          const _dartTemporary155 = gestures;
          const _dartTemporary153 = SourceHorizontalThumbDragGestureRecognizer;
          const _dartTemporary154 = scrollbarHorizontalFactory(
            (): SourceHorizontalThumbDragGestureRecognizer => {
              return new SourceHorizontalThumbDragGestureRecognizer({
                debugOwner: this,
                customPaintKey: this._dart_1c5f203b5ad3537b_scrollbarPainterKey,
              });
            },
            dartMethodTearOff(this, this._dart_1c5f203b5ad3537b_initThumbDragGestureRecognizer),
          );
          scrollbarSetGesture(_dartTemporary155, _dartTemporary153, _dartTemporary154);
          return _dartTemporary154;
        })();
        break;
      }
      case Axis.vertical: {
        (() => {
          const _dartTemporary158 = gestures;
          const _dartTemporary156 = SourceVerticalThumbDragGestureRecognizer;
          const _dartTemporary157 = scrollbarVerticalFactory(
            (): SourceVerticalThumbDragGestureRecognizer => {
              return new SourceVerticalThumbDragGestureRecognizer({
                debugOwner: this,
                customPaintKey: this._dart_1c5f203b5ad3537b_scrollbarPainterKey,
              });
            },
            dartMethodTearOff(this, this._dart_1c5f203b5ad3537b_initThumbDragGestureRecognizer),
          );
          scrollbarSetGesture(_dartTemporary158, _dartTemporary156, _dartTemporary157);
          return _dartTemporary157;
        })();
        break;
      }
      default:
        throw new TypeError('Invalid value outside exhaustive Dart switch');
    }
    (() => {
      const _dartTemporary162 = gestures;
      const _dartTemporary160 = SourceTrackTapGestureRecognizer;
      const _dartTemporary161 = scrollbarTrackFactory(
        (): SourceTrackTapGestureRecognizer => {
          return new SourceTrackTapGestureRecognizer({
            debugOwner: this,
            customPaintKey: this._dart_1c5f203b5ad3537b_scrollbarPainterKey,
          });
        },
        (instance: SourceTrackTapGestureRecognizer): void => {
          instance.onTapDown = dartMethodTearOff(this, this.handleTrackTapDown);
        },
      );
      scrollbarSetGesture(_dartTemporary162, _dartTemporary160, _dartTemporary161);
      return _dartTemporary161;
    })();
    return gestures;
  }
  isPointerOverTrack(position: Offset, kind: PointerDeviceKind): boolean {
    if (scrollbarKeyContext(this._dart_1c5f203b5ad3537b_scrollbarPainterKey) === null) {
      return false;
    }
    const localOffset: Offset = _getLocalOffset(
      this._dart_1c5f203b5ad3537b_scrollbarPainterKey,
      position,
    );
    return (
      this.scrollbarPainter.hitTestInteractive(localOffset, kind) &&
      !this.scrollbarPainter.hitTestOnlyThumbInteractive(localOffset, kind)
    );
  }
  isPointerOverThumb(position: Offset, kind: PointerDeviceKind): boolean {
    if (scrollbarKeyContext(this._dart_1c5f203b5ad3537b_scrollbarPainterKey) === null) {
      return false;
    }
    const localOffset: Offset = _getLocalOffset(
      this._dart_1c5f203b5ad3537b_scrollbarPainterKey,
      position,
    );
    return this.scrollbarPainter.hitTestOnlyThumbInteractive(localOffset, kind);
  }
  isPointerOverScrollbar(
    position: Offset,
    kind: PointerDeviceKind,
    {
      forHover: _forHover = false,
    }: {
      readonly forHover?: boolean;
    } = {},
  ): boolean {
    if (scrollbarKeyContext(this._dart_1c5f203b5ad3537b_scrollbarPainterKey) === null) {
      return false;
    }
    const localOffset: Offset = _getLocalOffset(
      this._dart_1c5f203b5ad3537b_scrollbarPainterKey,
      position,
    );
    return this.scrollbarPainter.hitTestInteractive(localOffset, kind, { forHover: true });
  }
  handleHover(event: PointerHoverEvent): void {
    if (this.isPointerOverScrollbar(event.position, event.kind, { forHover: true })) {
      const wasHoverActive: boolean = this._dart_1c5f203b5ad3537b_hoverIsActive;
      this._dart_1c5f203b5ad3537b_hoverIsActive = true;
      this._dart_1c5f203b5ad3537b_fadeoutAnimationController.forward();
      void (this._dart_1c5f203b5ad3537b_fadeoutTimer?.cancel() ?? null);
      if (!wasHoverActive) {
        this.updateMouseCursor();
      }
    } else if (this._dart_1c5f203b5ad3537b_hoverIsActive) {
      this._dart_1c5f203b5ad3537b_hoverIsActive = false;
      this._dart_1c5f203b5ad3537b_maybeStartFadeoutTimer();
      this.updateMouseCursor();
    }
  }
  handleHoverExit(_event: PointerExitEvent): void {
    this._dart_1c5f203b5ad3537b_hoverIsActive = false;
    this._dart_1c5f203b5ad3537b_maybeStartFadeoutTimer();
    this.updateMouseCursor();
  }
  get cursorStates(): DartSet<SourceWidgetState> {
    return (() => {
      const _dartTemporary163 = emptyWidgetStateSet();
      if (this._dart_1c5f203b5ad3537b_dragIsActive)
        _dartTemporary163.add(SourceWidgetState.dragged);
      if (this._dart_1c5f203b5ad3537b_hoverIsActive)
        _dartTemporary163.add(SourceWidgetState.hovered);
      if (!this.enableGestures) _dartTemporary163.add(SourceWidgetState.disabled);
      return _dartTemporary163;
    })();
  }
  updateMouseCursor(): void {
    const resolved: MouseCursor | null =
      this.widget.mouseCursor?.resolve(this.cursorStates) ?? null;
    const desired: MouseCursor =
      (this._dart_1c5f203b5ad3537b_hoverIsActive || this._dart_1c5f203b5ad3537b_dragIsActive) &&
      resolved !== null
        ? (resolved as MouseCursor)
        : MouseCursor.defer;
    if (!scrollbarRawObjectEquals(desired, this._dart_1c5f203b5ad3537b_effectiveMouseCursor)) {
      this.setState((): void => {
        this._dart_1c5f203b5ad3537b_effectiveMouseCursor = desired;
      });
    }
  }
  /**
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  _dart_1c5f203b5ad3537b_pointerSignalEventDelta(event: PointerScrollEvent): number {
    if (FoundationBuildMode.debug)
      invariant(
        this._dart_1c5f203b5ad3537b_cachedController !== null,
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    let delta: number = scrollbarRawObjectEquals(
      (() => {
        const _dartTemporary164 = this._dart_1c5f203b5ad3537b_cachedController;
        if (_dartTemporary164 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary164!;
      })().position.axis,
      Axis.horizontal,
    )
      ? event.scrollDelta.dx
      : event.scrollDelta.dy;
    if (
      axisDirectionIsReversed(
        (() => {
          const _dartTemporary165 = this._dart_1c5f203b5ad3537b_cachedController;
          if (_dartTemporary165 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary165!;
        })().position.axisDirection,
      )
    ) {
      delta *= checkedInteger(-1);
    }
    return delta;
  }
  /**
   * @dartParam delta double
   * @dartParamOrigin delta explicit
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  _dart_1c5f203b5ad3537b_targetScrollOffsetForPointerScroll(delta: number): number {
    if (FoundationBuildMode.debug)
      invariant(
        this._dart_1c5f203b5ad3537b_cachedController !== null,
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    return Math.min(
      Math.max(
        (() => {
          const _dartTemporary166 = this._dart_1c5f203b5ad3537b_cachedController;
          if (_dartTemporary166 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary166!;
        })().position.pixels + delta,
        (() => {
          const _dartTemporary167 = this._dart_1c5f203b5ad3537b_cachedController;
          if (_dartTemporary167 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary167!;
        })().position.minScrollExtent,
      ),
      (() => {
        const _dartTemporary168 = this._dart_1c5f203b5ad3537b_cachedController;
        if (_dartTemporary168 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary168!;
      })().position.maxScrollExtent,
    );
  }
  _dart_1c5f203b5ad3537b_handlePointerScroll(event: PointerEvent): void {
    if (FoundationBuildMode.debug)
      invariant(
        scrollbarIsPointerScroll(event),
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    this._dart_1c5f203b5ad3537b_cachedController =
      this._dart_1c5f203b5ad3537b_effectiveScrollController;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const delta: number = this._dart_1c5f203b5ad3537b_pointerSignalEventDelta(
      scrollbarCastPointerScroll(event),
    );
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const targetScrollOffset: number =
      this._dart_1c5f203b5ad3537b_targetScrollOffsetForPointerScroll(delta);
    if (
      delta !== 0 &&
      targetScrollOffset !==
        (() => {
          const _dartTemporary169 = this._dart_1c5f203b5ad3537b_cachedController;
          if (_dartTemporary169 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary169!;
        })().position.pixels
    ) {
      (() => {
        const _dartTemporary170 = this._dart_1c5f203b5ad3537b_cachedController;
        if (_dartTemporary170 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary170!;
      })().position.pointerScroll(delta);
    }
  }
  _dart_1c5f203b5ad3537b_receivedPointerSignal(event: PointerSignalEvent): void {
    this._dart_1c5f203b5ad3537b_cachedController =
      this._dart_1c5f203b5ad3537b_effectiveScrollController;
    if (
      (this.scrollbarPainter.hitTest(event.localPosition) ?? false) &&
      this._dart_1c5f203b5ad3537b_cachedController !== null &&
      (() => {
        const _dartTemporary171 = this._dart_1c5f203b5ad3537b_cachedController;
        if (_dartTemporary171 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary171!;
      })().hasClients &&
      (this._dart_1c5f203b5ad3537b_thumbDrag === null || scrollbarIsWeb())
    ) {
      const position: ScrollPosition = (() => {
        const _dartTemporary172 = this._dart_1c5f203b5ad3537b_cachedController;
        if (_dartTemporary172 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary172!;
      })().position;
      if (scrollbarIsPointerScroll(event)) {
        if (!position.physics.shouldAcceptUserOffset(position)) {
          return;
        }
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const delta: number = this._dart_1c5f203b5ad3537b_pointerSignalEventDelta(
          event as PointerScrollEvent,
        );
        /**
         * @dartType double
         * @dartTypeOrigin explicit
         */
        const targetScrollOffset: number =
          this._dart_1c5f203b5ad3537b_targetScrollOffsetForPointerScroll(delta);
        if (delta !== 0 && targetScrollOffset !== position.pixels) {
          scrollbarRegisterSignal(
            this,
            event as PointerScrollEvent,
            dartMethodTearOff(this, this._dart_1c5f203b5ad3537b_handlePointerScroll),
          );
        }
      } else if (scrollbarIsInertiaCancel(event)) {
        position.jumpTo(position.pixels);
      }
    }
  }
  override dispose(): void {
    this._dart_1c5f203b5ad3537b_fadeoutAnimationController.dispose();
    void (this._dart_1c5f203b5ad3537b_fadeoutTimer?.cancel() ?? null);
    this.scrollbarPainter.dispose();
    this._dart_1c5f203b5ad3537b_fadeoutOpacityAnimation.dispose();
    super.dispose();
  }
  override build(context: BuildContext): Widget {
    this.updateScrollbarPainter();
    return scrollbarMetricsListener({
      onNotification: dartMethodTearOff(
        this,
        this._dart_1c5f203b5ad3537b_handleScrollMetricsNotification,
      ),
      child: scrollbarNotificationListener({
        onNotification: dartMethodTearOff(
          this,
          this._dart_1c5f203b5ad3537b_handleScrollNotification,
        ),
        child: scrollbarRepaintBoundary({
          child: scrollbarListener({
            onPointerSignal: dartMethodTearOff(
              this,
              this._dart_1c5f203b5ad3537b_receivedPointerSignal,
            ),
            child: scrollbarRawGestureDetector({
              key: this._dart_1c5f203b5ad3537b_gestureDetectorKey,
              gestures: this._dart_1c5f203b5ad3537b_gestures,
              child: scrollbarMouseRegion({
                cursor: this._dart_1c5f203b5ad3537b_effectiveMouseCursor,
                onExit: (event: PointerExitEvent): void => {
                  switch (event.kind) {
                    case PointerDeviceKind.mouse:
                    case PointerDeviceKind.trackpad: {
                      if (this.enableGestures) {
                        this.handleHoverExit(event);
                      }
                      break;
                    }
                    case PointerDeviceKind.stylus:
                    case PointerDeviceKind.invertedStylus:
                    case PointerDeviceKind.unknown:
                    case PointerDeviceKind.touch: {
                      break;
                    }
                    default:
                      throw new TypeError('Invalid value outside exhaustive Dart switch');
                  }
                },
                onHover: (event: PointerHoverEvent): void => {
                  switch (event.kind) {
                    case PointerDeviceKind.mouse:
                    case PointerDeviceKind.trackpad: {
                      if (this.enableGestures) {
                        this.handleHover(event);
                      }
                      break;
                    }
                    case PointerDeviceKind.stylus:
                    case PointerDeviceKind.invertedStylus:
                    case PointerDeviceKind.unknown:
                    case PointerDeviceKind.touch: {
                      break;
                    }
                    default:
                      throw new TypeError('Invalid value outside exhaustive Dart switch');
                  }
                },
                child: scrollbarCustomPaint({
                  key: this._dart_1c5f203b5ad3537b_scrollbarPainterKey,
                  foregroundPainter: this.scrollbarPainter,
                  child: scrollbarRepaintBoundary({ child: this.widget.child }),
                }),
              }),
            }),
          }),
        }),
      }),
    });
  }
}
export class SourceTrackTapGestureRecognizer extends ScrollbarTapHost {
  readonly _dart_1c5f203b5ad3537b_customPaintKey: GlobalKey<State<StatefulWidget>>;
  constructor({
    debugOwner,
    customPaintKey,
  }: {
    readonly debugOwner: {} | null;
    readonly customPaintKey: GlobalKey<State<StatefulWidget>>;
  }) {
    const _initialField0 = customPaintKey;
    super({ debugOwner: debugOwner });
    this._dart_1c5f203b5ad3537b_customPaintKey = _initialField0;
    protect(this, ['_dart_1c5f203b5ad3537b_customPaintKey']);
  }
  override isPointerAllowed(event: PointerDownEvent): boolean {
    return (
      _isTrackEvent(this._dart_1c5f203b5ad3537b_customPaintKey, event) &&
      super.isPointerAllowed(event)
    );
  }
}
export class SourceVerticalThumbDragGestureRecognizer extends ScrollbarVerticalDragHost {
  readonly _dart_1c5f203b5ad3537b_customPaintKey: GlobalKey<State<StatefulWidget>>;
  constructor({
    debugOwner,
    customPaintKey,
  }: {
    readonly debugOwner: {};
    readonly customPaintKey: GlobalKey<State<StatefulWidget>>;
  }) {
    const _initialField0 = customPaintKey;
    super({ debugOwner: debugOwner });
    this._dart_1c5f203b5ad3537b_customPaintKey = _initialField0;
    protect(this, ['_dart_1c5f203b5ad3537b_customPaintKey']);
  }
  override isPointerPanZoomAllowed(event: PointerPanZoomStartEvent): boolean {
    return false;
  }
  override isPointerAllowed(event: PointerEvent): boolean {
    return (
      _isThumbEvent(this._dart_1c5f203b5ad3537b_customPaintKey, event) &&
      super.isPointerAllowed(event)
    );
  }
}
export class SourceHorizontalThumbDragGestureRecognizer extends ScrollbarHorizontalDragHost {
  readonly _dart_1c5f203b5ad3537b_customPaintKey: GlobalKey<State<StatefulWidget>>;
  constructor({
    debugOwner,
    customPaintKey,
  }: {
    readonly debugOwner: {};
    readonly customPaintKey: GlobalKey<State<StatefulWidget>>;
  }) {
    const _initialField0 = customPaintKey;
    super({ debugOwner: debugOwner });
    this._dart_1c5f203b5ad3537b_customPaintKey = _initialField0;
    protect(this, ['_dart_1c5f203b5ad3537b_customPaintKey']);
  }
  override isPointerPanZoomAllowed(event: PointerPanZoomStartEvent): boolean {
    return false;
  }
  override isPointerAllowed(event: PointerEvent): boolean {
    return (
      _isThumbEvent(this._dart_1c5f203b5ad3537b_customPaintKey, event) &&
      super.isPointerAllowed(event)
    );
  }
}
export function _getLocalOffset(
  scrollbarPainterKey: GlobalKey<State<StatefulWidget>>,
  position: Offset,
): Offset {
  const renderBox: RenderBox = scrollbarCastRenderBox(
    (() => {
      const _dartTemporary174 = scrollbarRenderObject(
        (() => {
          const _dartTemporary173 = scrollbarKeyContext(scrollbarPainterKey);
          if (_dartTemporary173 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary173!;
        })(),
      );
      if (_dartTemporary174 === null)
        throw new TypeError('Null check operator used on a null value');
      return _dartTemporary174!;
    })(),
  );
  return scrollbarGlobalToLocal(renderBox, position);
}
export function _isThumbEvent(
  customPaintKey: GlobalKey<State<StatefulWidget>>,
  event: PointerEvent,
): boolean {
  if (scrollbarKeyContext(customPaintKey) === null) {
    return false;
  }
  const customPaint: CustomPaint = scrollbarCastCustomPaint(
    (() => {
      const _dartTemporary175 = scrollbarKeyContext(customPaintKey);
      if (_dartTemporary175 === null)
        throw new TypeError('Null check operator used on a null value');
      return _dartTemporary175!;
    })().widget,
  );
  const painter: SourceScrollbarPainter = (() => {
    const _dartTemporary177 = (() => {
      const _dartTemporary176 = scrollbarForegroundPainter(customPaint);
      if (_dartTemporary176 === null)
        throw new TypeError('Null check operator used on a null value');
      return _dartTemporary176!;
    })();
    if (!(_dartTemporary177 instanceof SourceScrollbarPainter))
      throw new TypeError(
        'Invalid source cast: package:flutter/src/widgets/scrollbar.dart::ScrollbarPainter:CLASS',
      );
    return _dartTemporary177 as SourceScrollbarPainter;
  })();
  const localOffset: Offset = _getLocalOffset(customPaintKey, event.position);
  return painter.hitTestOnlyThumbInteractive(localOffset, event.kind);
}
export function _isTrackEvent(
  customPaintKey: GlobalKey<State<StatefulWidget>>,
  event: PointerEvent,
): boolean {
  if (scrollbarKeyContext(customPaintKey) === null) {
    return false;
  }
  const customPaint: CustomPaint = scrollbarCastCustomPaint(
    (() => {
      const _dartTemporary178 = scrollbarKeyContext(customPaintKey);
      if (_dartTemporary178 === null)
        throw new TypeError('Null check operator used on a null value');
      return _dartTemporary178!;
    })().widget,
  );
  const painter: SourceScrollbarPainter = (() => {
    const _dartTemporary180 = (() => {
      const _dartTemporary179 = scrollbarForegroundPainter(customPaint);
      if (_dartTemporary179 === null)
        throw new TypeError('Null check operator used on a null value');
      return _dartTemporary179!;
    })();
    if (!(_dartTemporary180 instanceof SourceScrollbarPainter))
      throw new TypeError(
        'Invalid source cast: package:flutter/src/widgets/scrollbar.dart::ScrollbarPainter:CLASS',
      );
    return _dartTemporary180 as SourceScrollbarPainter;
  })();
  const localOffset: Offset = _getLocalOffset(customPaintKey, event.position);
  const kind: PointerDeviceKind = event.kind;
  return (
    painter.hitTestInteractive(localOffset, kind) &&
    !painter.hitTestOnlyThumbInteractive(localOffset, kind)
  );
}
