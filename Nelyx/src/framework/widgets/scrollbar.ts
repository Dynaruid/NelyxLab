// SPDX-License-Identifier: BSD-3-Clause
// Public ARGB/scalar-radius facade over the complete pinned source implementation.
import { invariant } from '../../foundation/errors.ts';
import { Color } from '../../ui/color.ts';
import { Radius } from '../../ui/radius.ts';
import { Size as SourceSize } from '../../ui/size.ts';
import { Offset } from '../../ui/offset.ts';
import type { Size } from '../../ui/geometry.ts';
import type { Canvas } from '../../ui/canvas.ts';
import type { PointerDeviceKind } from '../../ui/pointer.ts';
import { CustomPainter } from '../rendering/custom-paint.ts';
import type { AxisDirection } from '../painting/basic-types.ts';
import { EdgeInsets } from '../painting/edge-insets.ts';
import type { EdgeInsetsGeometry } from '../painting/edge-insets.ts';
import type { Animation } from '../animation/animation.ts';
import { State, StatefulWidget } from './framework.ts';
import type { BuildContext, Widget, WidgetOptions } from './framework.ts';
import { GlobalKey } from './global-key.ts';
import { Directionality, MediaQuery } from './app-data.ts';
import { PrimaryScrollController } from './primary-scroll-controller.ts';
import type { ScrollController } from './scroll-controller.ts';
import type { ScrollMetrics } from './scroll-metrics.ts';
import type { ScrollNotificationPredicate } from './scroll-notification.ts';
import {
  SourceScrollbarOrientation as ScrollbarOrientation,
  SourceScrollbarPainter,
  SourceRawScrollbar,
  SourceRawScrollbarState,
} from './scrollbar.generated.ts';
import { scrollbarRegisterEmptyPainterSemantics } from './scrollbar-painter-source-adapter.ts';
export { ScrollbarOrientation };

export interface ScrollbarPainterOptions {
  readonly color: number;
  readonly fadeoutOpacityAnimation: Animation<number>;
  readonly textDirection?: 'ltr' | 'rtl' | null;
  readonly thickness?: number;
  readonly padding?: EdgeInsetsGeometry;
  readonly mainAxisMargin?: number;
  readonly crossAxisMargin?: number;
  readonly radius?: number | null;
  readonly trackColor?: number;
  readonly trackBorderColor?: number;
  readonly trackRadius?: number | null;
  readonly minLength?: number;
  readonly minOverscrollLength?: number | null;
  readonly scrollbarOrientation?: ScrollbarOrientation | null;
  readonly ignorePointer?: boolean;
}
class SourcePainterFacade extends CustomPainter {
  private closed = false;
  constructor(
    readonly source: SourceScrollbarPainter,
    private readonly ownsSource: boolean,
  ) {
    super();
    scrollbarRegisterEmptyPainterSemantics(SourceScrollbarPainter.prototype);
  }
  override addListener(listener: () => void): void {
    this.source.addListener(listener);
  }
  override removeListener(listener: () => void): void {
    this.source.removeListener(listener);
  }
  get fadeoutOpacityAnimation(): Animation<number> {
    return this.source.fadeoutOpacityAnimation;
  }
  get color(): number {
    return this.source.color.toARGB32();
  }
  set color(value: number) {
    this.source.color = new Color(value);
  }
  get trackColor(): number {
    return this.source.trackColor.toARGB32();
  }
  set trackColor(value: number) {
    this.source.trackColor = new Color(value);
  }
  get trackBorderColor(): number {
    return this.source.trackBorderColor.toARGB32();
  }
  set trackBorderColor(value: number) {
    this.source.trackBorderColor = new Color(value);
  }
  get radius(): number | null {
    return this.source.radius?.x ?? null;
  }
  set radius(value: number | null) {
    this.source.radius = value === null ? null : Radius.circular(value);
  }
  get trackRadius(): number | null {
    return this.source.trackRadius?.x ?? null;
  }
  set trackRadius(value: number | null) {
    this.source.trackRadius = value === null ? null : Radius.circular(value);
  }
  get thickness(): number {
    return this.source.thickness;
  }
  set thickness(value: number) {
    this.source.thickness = value;
  }
  get padding(): EdgeInsetsGeometry {
    return this.source.padding;
  }
  set padding(value: EdgeInsetsGeometry) {
    this.source.padding = value;
  }
  get textDirection(): 'ltr' | 'rtl' | null {
    return this.source.textDirection;
  }
  set textDirection(value: 'ltr' | 'rtl' | null) {
    this.source.textDirection = value;
  }
  get mainAxisMargin(): number {
    return this.source.mainAxisMargin;
  }
  set mainAxisMargin(value: number) {
    this.source.mainAxisMargin = value;
  }
  get crossAxisMargin(): number {
    return this.source.crossAxisMargin;
  }
  set crossAxisMargin(value: number) {
    this.source.crossAxisMargin = value;
  }
  get minLength(): number {
    return this.source.minLength;
  }
  set minLength(value: number) {
    this.source.minLength = value;
  }
  get minOverscrollLength(): number {
    return this.source.minOverscrollLength;
  }
  set minOverscrollLength(value: number) {
    this.source.minOverscrollLength = value;
  }
  get scrollbarOrientation(): ScrollbarOrientation | null {
    return this.source.scrollbarOrientation;
  }
  set scrollbarOrientation(value: ScrollbarOrientation | null) {
    this.source.scrollbarOrientation = value;
  }
  get ignorePointer(): boolean {
    return this.source.ignorePointer;
  }
  set ignorePointer(value: boolean) {
    this.source.ignorePointer = value;
  }
  update(metrics: ScrollMetrics, direction: AxisDirection): void {
    this.source.update(metrics, direction);
  }
  updateThickness(thickness: number, radius: number): void {
    this.source.updateThickness(thickness, Radius.circular(radius));
  }
  override paint(canvas: Canvas, size: Size): void {
    this.source.paint(canvas, new SourceSize(size.width, size.height));
  }
  getTrackToScroll(offset: number): number {
    return this.source.getTrackToScroll(offset);
  }
  getThumbScrollOffset(): number {
    return this.source.getThumbScrollOffset();
  }
  override hitTest(position: Offset): boolean | null {
    return this.source.hitTest(position);
  }
  hitTestInteractive(
    position: Offset,
    kind: PointerDeviceKind,
    options: { readonly forHover?: boolean } = {},
  ): boolean {
    return this.source.hitTestInteractive(position, kind, options);
  }
  hitTestOnlyThumbInteractive(position: Offset, kind: PointerDeviceKind): boolean {
    return !this.source.ignorePointer && this.source.hitTestOnlyThumbInteractive(position, kind);
  }
  override shouldRepaint(old: CustomPainter): boolean {
    return !(old instanceof SourcePainterFacade) || this.source.shouldRepaint(old.source);
  }
  override shouldRebuildSemantics(old: CustomPainter): boolean {
    return !(old instanceof SourcePainterFacade) || this.source.shouldRebuildSemantics(old.source);
  }
  dispose(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.ownsSource) this.source.dispose();
  }
}
export class ScrollbarPainter extends SourcePainterFacade {
  constructor({
    color,
    fadeoutOpacityAnimation,
    textDirection = null,
    thickness = 6,
    padding = EdgeInsets.zero,
    mainAxisMargin = 0,
    crossAxisMargin = 0,
    radius = null,
    trackColor = 0,
    trackBorderColor = 0,
    trackRadius = null,
    minLength = 18,
    minOverscrollLength = null,
    scrollbarOrientation = null,
    ignorePointer = false,
  }: ScrollbarPainterOptions) {
    super(
      new SourceScrollbarPainter({
        color: new Color(color),
        fadeoutOpacityAnimation,
        textDirection,
        thickness,
        padding,
        mainAxisMargin,
        crossAxisMargin,
        radius: radius === null ? null : Radius.circular(radius),
        trackColor: new Color(trackColor),
        trackBorderColor: new Color(trackBorderColor),
        trackRadius: trackRadius === null ? null : Radius.circular(trackRadius),
        minLength,
        minOverscrollLength,
        scrollbarOrientation,
        ignorePointer,
      }),
      true,
    );
  }
}
const painters = new WeakMap<SourceScrollbarPainter, SourcePainterFacade>();
function facade(source: SourceScrollbarPainter): ScrollbarPainter {
  let result = painters.get(source);
  if (!result) {
    result = new SourcePainterFacade(source, false);
    painters.set(source, result);
  }
  return result;
}

export interface RawScrollbarOptions extends WidgetOptions {
  readonly child: Widget;
  readonly controller?: ScrollController | null;
  readonly thumbVisibility?: boolean | null;
  readonly trackVisibility?: boolean | null;
  readonly thickness?: number | null;
  readonly radius?: number | null;
  readonly thumbColor?: number | null;
  readonly trackColor?: number | null;
  readonly trackBorderColor?: number | null;
  readonly trackRadius?: number | null;
  readonly minThumbLength?: number;
  readonly minOverscrollLength?: number | null;
  readonly mainAxisMargin?: number;
  readonly crossAxisMargin?: number;
  readonly padding?: EdgeInsetsGeometry | null;
  readonly scrollbarOrientation?: ScrollbarOrientation | null;
  readonly interactive?: boolean | null;
  readonly notificationPredicate?: ScrollNotificationPredicate;
  readonly fadeDuration?: number;
  readonly timeToFade?: number;
}
export class RawScrollbar extends StatefulWidget {
  readonly options: Readonly<RawScrollbarOptions>;
  constructor(options: RawScrollbarOptions) {
    super(options.key ?? null);
    scrollbarRegisterEmptyPainterSemantics(SourceScrollbarPainter.prototype);
    invariant(
      !(options.thumbVisibility === false && options.trackVisibility),
      'track-without-scrollbar-thumb',
      'A visible scrollbar track requires its thumb',
    );
    this.options = Object.freeze({ ...options });
  }
  createState(): RawScrollbarState {
    return new RawScrollbarState();
  }
}
export class RawScrollbarState extends State<RawScrollbar> {
  private readonly sourceKey = new GlobalKey<SourceRawScrollbarState<SourceRawScrollbar>>();
  get sourceState(): SourceRawScrollbarState<SourceRawScrollbar> | undefined {
    return this.sourceKey.currentState;
  }
  get scrollbarPainter(): ScrollbarPainter {
    const source = this.sourceState;
    invariant(
      source,
      'unmounted-scrollbar-painter',
      'Scrollbar painter requires its mounted source State',
    );
    return facade(source.scrollbarPainter);
  }
  build(context: BuildContext): Widget {
    const {
      child,
      controller = null,
      thumbVisibility = null,
      trackVisibility = null,
      thickness = null,
      radius = null,
      thumbColor = null,
      trackColor = null,
      trackBorderColor = null,
      trackRadius = null,
      minThumbLength = 18,
      minOverscrollLength = null,
      mainAxisMargin = 0,
      crossAxisMargin = 0,
      padding = null,
      scrollbarOrientation = null,
      interactive = null,
      notificationPredicate,
      fadeDuration = 300,
      timeToFade = 600,
    } = this.widget.options;
    const source = new SourceRawScrollbar({
      key: this.sourceKey,
      child,
      controller,
      thumbVisibility,
      trackVisibility,
      thickness,
      radius: radius === null ? null : Radius.circular(radius),
      thumbColor: thumbColor === null ? null : new Color(thumbColor),
      trackColor:
        trackColor === null
          ? trackVisibility
            ? new Color(0x08000000)
            : null
          : new Color(trackColor),
      trackBorderColor:
        trackBorderColor === null
          ? trackVisibility
            ? new Color(0x1a000000)
            : null
          : new Color(trackBorderColor),
      trackRadius: trackRadius === null ? null : Radius.circular(trackRadius),
      minThumbLength,
      minOverscrollLength,
      mainAxisMargin,
      crossAxisMargin,
      padding:
        padding ??
        EdgeInsets.fromViewPadding(
          context.maybeDependOn(MediaQuery)?.data.safeArea ?? {
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
          },
          1,
        ),
      scrollbarOrientation,
      interactive,
      fadeDuration: thumbVisibility === true ? 0 : fadeDuration,
      timeToFade,
      notificationPredicate: (notification) => {
        const activeController = controller ?? PrimaryScrollController.maybeOf(context);
        if (activeController !== null) {
          if (!activeController.hasClients) return false;
          invariant(
            [...activeController.positions].length === 1,
            'ambiguous-scrollbar-controller',
            'A controlled scrollbar requires exactly one ScrollPosition',
          );
          if (activeController.position.context.notificationContext !== notification.context)
            return false;
        } else if (notification.depth !== 0) return false;
        return notificationPredicate?.(notification) ?? true;
      },
    });
    return Directionality.maybeOf(context) === null ? new Directionality('ltr', source) : source;
  }
}
