// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Pinned RangeSlider interaction/render contracts on the existing Core owners.
import { StatefulWidget, LeafRenderObjectWidget, Element } from '@nelyx/core/framework/widgets/framework';
import type { State, Widget, BuildContext, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { TickerProviderStateMixin } from '@nelyx/core/framework/widgets/ticker-provider';
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import { CurvedAnimation, AlwaysStoppedAnimation } from '@nelyx/core/framework/animation/animations';
import { Curves } from '@nelyx/core/framework/animation/curves';
import { RawGestureDetector, GestureRecognizerFactoryWithHandlers } from '@nelyx/core/framework/widgets/raw-gesture-detector';
import type { GestureRecognizerFactories, GestureRecognizerType, GestureRecognizerFactory } from '@nelyx/core/framework/widgets/raw-gesture-detector';
import { HorizontalDragGestureRecognizer } from '@nelyx/core/framework/gestures/monodrag';
import { TapGestureRecognizer } from '@nelyx/core/framework/gestures/tap';
import { GestureArenaTeam } from '@nelyx/core/framework/gestures/team';
import type { DragUpdateDetails } from '@nelyx/core/framework/gestures/drag-details';
import { HitTestBehavior } from '@nelyx/core/framework/rendering/pointer-listener';
import { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { Focus } from '@nelyx/core/framework/widgets/focus-scope';
import { MouseRegion } from '@nelyx/core/framework/widgets/mouse-region';
import { KeyDownEvent, KeyRepeatEvent } from '@nelyx/core/services/hardware-keyboard';
import type { KeyEvent } from '@nelyx/core/services/hardware-keyboard';
import { LogicalKeyboardKey } from '@nelyx/core/services/keyboard-key';
import { SystemMouseCursors } from '@nelyx/core/services/mouse-cursor';
import type { MouseCursor } from '@nelyx/core/services/mouse-cursor';
import { WidgetState, WidgetStatePropertyAll } from '@nelyx/core/framework/widgets/widget-state';
import type { WidgetStateProperty } from '@nelyx/core/framework/widgets/widget-state';
import { emptyWidgetStateSet } from '@nelyx/core/internal/framework/widgets/widget-state-full-collections';
import { Overlay, OverlayEntry } from '@nelyx/core/framework/widgets/overlay';
import { CompositedTransformTarget, CompositedTransformFollower } from '@nelyx/core/framework/widgets/composited-transform';
import { LayerLink } from '@nelyx/core/framework/rendering/layer';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { Padding, SizedBox, Stack, Row } from '@nelyx/core/framework/widgets/basic';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { tickerScheduler } from '@nelyx/core/internal/framework/widgets/ticker-scheduler';
import { scrollChromeTimer } from '@nelyx/core/internal/framework/widgets/scroll-chrome-timers';
import type { Disposable } from '@nelyx/core/foundation/disposable';
import { RenderBox, RelayoutWhenSystemFontsChangeMixin } from '@nelyx/core/framework/rendering/object';
import type { RenderObject } from '@nelyx/core/framework/rendering/object';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import type { PaintingContext } from '@nelyx/core/framework/painting/context';
import { SemanticsNode, SemanticsConfiguration } from '@nelyx/core/framework/semantics/semantics';
import { setSemanticsTransportProperties } from '@nelyx/core/internal/framework/rendering/semantics-transport';
import type { SemanticsTransportProperties } from '@nelyx/core/internal/framework/rendering/semantics-transport';
import { TextPainter } from '@nelyx/core/framework/painting/text-painter';
import { TextSpan } from '@nelyx/core/framework/painting/text-span';
import type { ParagraphContext } from '@nelyx/core/ui/paragraph';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { Offset } from '@nelyx/core/ui/offset';
import type { Offset as Point } from '@nelyx/core/ui/geometry';
import { Size } from '@nelyx/core/ui/size';
import { Rect } from '@nelyx/core/ui/rect';
import { Color } from '@nelyx/core/ui/color';
import { clampDouble } from '@nelyx/core/ui/math';
import { nullableDartType } from '@nelyx/core/foundation/dart-type-witness';
import { sourceSizeType, captureSourceSize } from '@nelyx/core/ui/size-source';
import { invariant } from '@nelyx/core/foundation/errors';
import { Theme } from './theme.ts';
import { SliderTheme, SliderThemeData, ShowValueIndicator, Thumb } from './slider-theme.ts';
import { sliderThemeFieldNames } from "./generated/slider/slider-theme-fields.generated.ts";
import { RangeValues, RangeLabels } from './range-slider-values.ts';
import type { RangeThumbSelector } from './range-slider-values.ts';
import { RectangularRangeSliderValueIndicatorShape } from './slider-shapes.ts';
import { materialRangeSliderDefaults } from "./internal/slider/range-slider-defaults.ts";
export interface RangeSliderOptions extends WidgetOptions {
    readonly values: RangeValues;
    readonly onChanged: ((values: RangeValues) => void) | null;
    readonly onChangeStart?: ((values: RangeValues) => void) | null;
    readonly onChangeEnd?: ((values: RangeValues) => void) | null;
    /** @dartType double */ readonly min?: number;
    /** @dartType double */ readonly max?: number;
    /** @dartType int? */ readonly divisions?: number | null;
    readonly labels?: RangeLabels | null;
    readonly activeColor?: Color | null;
    readonly inactiveColor?: Color | null;
    readonly overlayColor?: WidgetStateProperty<Color | null> | null;
    readonly mouseCursor?: WidgetStateProperty<MouseCursor | null> | null;
    readonly semanticFormatterCallback?: ((value: number) => string) | null;
    readonly padding?: EdgeInsetsGeometry | null;
    readonly year2023?: boolean | null;
    /** Nelyx host identifier; the two source thumb nodes use id-start and id-end. */ readonly id?: string;
}
export class RangeSlider extends StatefulWidget {
    readonly options: Readonly<RangeSliderOptions>;
    constructor(options: RangeSliderOptions) {
        super(options.key ?? null);
        const min = options.min ?? 0, max = options.max ?? 1, v = options.values;
        invariant(v instanceof RangeValues && [min, max, v.start, v.end].every(Number.isFinite) && min <= v.start && v.start <= v.end && v.end <= max, 'invalid-range-slider-values', 'RangeSlider requires real RangeValues within finite ordered min/max bounds');
        invariant(options.divisions == null || Number.isSafeInteger(options.divisions) && options.divisions > 0, 'invalid-range-slider-divisions', 'RangeSlider divisions must be a positive safe integer');
        invariant(options.labels == null || options.labels instanceof RangeLabels, 'invalid-range-slider-labels', 'RangeSlider labels require the actual RangeLabels owner');
        invariant(options.onChanged === null || typeof options.onChanged === 'function', 'invalid-range-slider-callback', 'onChanged must be a function or null');
        this.options = Object.freeze({ ...options });
    }
    get values(): RangeValues {
        return this.options.values;
    }
    /** @dartReturn double */ get min(): number {
        return this.options.min ?? 0;
    }
    /** @dartReturn double */ get max(): number {
        return this.options.max ?? 1;
    }
    /** @dartReturn int? */ get divisions(): number | null {
        return this.options.divisions ?? null;
    }
    get onChanged() {
        return this.options.onChanged;
    }
    get onChangeStart() {
        return this.options.onChangeStart ?? null;
    }
    get onChangeEnd() {
        return this.options.onChangeEnd ?? null;
    }
    get labels() {
        return this.options.labels ?? null;
    }
    get activeColor() {
        return this.options.activeColor ?? null;
    }
    get inactiveColor() {
        return this.options.inactiveColor ?? null;
    }
    get overlayColor() {
        return this.options.overlayColor ?? null;
    }
    get mouseCursor() {
        return this.options.mouseCursor ?? null;
    }
    get semanticFormatterCallback() {
        return this.options.semanticFormatterCallback ?? null;
    }
    get padding() {
        return this.options.padding ?? null;
    }
    get year2023() {
        return this.options.year2023 ?? null;
    }
    createState(): State {
        return new MaterialRangeSliderState();
    }
}
export const materialRangeThumbSelector: RangeThumbSelector = (direction, values, tapValue, thumbSize, trackSize, dx) => {
    const radius = Math.max(thumbSize.width, 48) / 2, start = Math.abs(tapValue - values.start) * trackSize.width < radius, end = Math.abs(tapValue - values.end) * trackSize.width < radius;
    if (start && end) {
        if (direction === 'ltr' ? dx < 0 : dx > 0)
            return Thumb.start;
        if (direction === 'ltr' ? dx > 0 : dx < 0)
            return Thumb.end;
        return null;
    }
    return tapValue * 2 < values.start + values.end ? Thumb.start : Thumb.end;
};
export function materialRangeSemanticValues(values: RangeValues, unit: number, separation: number) {
    const increasedStart = Number((values.start + unit).toFixed(2)), decreasedEnd = values.end - unit;
    return Object.freeze({
        increasedStart: increasedStart <= values.end - separation ? increasedStart : values.start, decreasedStart: clampDouble(values.start - unit, 0, 1), increasedEnd: clampDouble(values.end + unit, 0, 1), decreasedEnd: decreasedEnd >= values.start + separation ? decreasedEnd : values.end
    });
}
export function materialRangeThumbCenters(theme: SliderThemeData, rect: Rect, values: RangeValues, direction: 'ltr' | 'rtl', enabled: boolean, discrete: boolean): readonly [
    Offset,
    Offset
] {
    const padding = theme.rangeTrackShape!.isRounded ? rect.height : 0, thumb = theme.rangeThumbShape!.getPreferredSize(enabled, discrete), inset = padding > thumb.width / 2 ? padding / 2 : 0;
    const center = (value: number) => {
        const visual = direction === 'rtl' ? 1 - value : value, x = discrete ? rect.left + visual * (rect.width - padding) + padding / 2 : rect.left + visual * rect.width;
        return new Offset(clampDouble(x, rect.left + inset, rect.right - inset), rect.center.dy);
    };
    return [center(values.start), center(values.end)];
}
function shouldShowOnDrag(theme: SliderThemeData, discrete: boolean): boolean {
    const mode = theme.showValueIndicator;
    return mode === ShowValueIndicator.onlyForDiscrete ? discrete : mode === ShowValueIndicator.onlyForContinuous ? !discrete : mode !== ShowValueIndicator.never;
}
const one = new AlwaysStoppedAnimation(1), sizeType = nullableDartType(sourceSizeType);
interface RangePaintModel {
    readonly owner: MaterialRangeSliderState;
    readonly theme: SliderThemeData;
    readonly direction: 'ltr' | 'rtl';
    readonly screen: Size;
    readonly scale: number;
    readonly textContext: ParagraphContext | null;
    readonly preferred: Size;
}
class MaterialRangeSliderState extends TickerProviderStateMixin<RangeSlider> {
    readonly startFocusNode = new FocusNode({ debugLabel: 'RangeSlider start' });
    readonly endFocusNode = new FocusNode({ debugLabel: 'RangeSlider end' });
    readonly surfaceKey = new GlobalKey('RangeSlider paint');
    readonly link = new LayerLink();
    startPosition!: AnimationController;
    endPosition!: AnimationController;
    private overlay!: AnimationController;
    private indicator!: AnimationController;
    private enable!: AnimationController;
    overlayAnimation!: CurvedAnimation;
    indicatorAnimation!: CurvedAnimation;
    enableAnimation!: CurvedAnimation;
    values!: RangeValues;
    selected: Thumb | null = null;
    active = false;
    hoverStart = false;
    hoverEnd = false;
    private hovering = false;
    private dragging = false;
    private suspended = false;
    private retired = false;
    private team!: GestureArenaTeam;
    private timer: Disposable | null = null;
    private entry: OverlayEntry | null = null;
    private pendingOverlay = false;
    private overlayWanted = false;
    private nextValues!: RangeValues;
    private theme: SliderThemeData | null = null;
    private inputValues!: RangeValues;
    private inputMin = 0;
    private inputMax = 1;
    private inputDivisions: number | null = null;
    get live(): boolean {
        return this.mounted && !this.suspended && !this.retired && (this.context as Element).active;
    }
    get enabled(): boolean {
        return this.widget.onChanged !== null && this.widget.max > this.widget.min;
    }
    get discrete(): boolean {
        return this.widget.divisions !== null;
    }
    get direction(): 'ltr' | 'rtl' {
        return Directionality.of(this.context);
    }
    private normalized(): RangeValues {
        const w = this.widget, span = w.max - w.min;
        return new RangeValues(span === 0 ? 0 : (w.values.start - w.min) / span, span === 0 ? 0 : (w.values.end - w.min) / span);
    }
    private quantize(value: number): number {
        const v = clampDouble(value, 0, 1);
        return this.widget.divisions === null ? v : Math.floor(v * this.widget.divisions + .5) / this.widget.divisions;
    }
    private quantized(values: RangeValues): RangeValues {
        return new RangeValues(this.quantize(values.start), this.quantize(values.end));
    }
    private lerp(value: number): number {
        return this.widget.min * (1 - value) + this.widget.max * value;
    }
    private projected(values: RangeValues): RangeValues {
        return new RangeValues(this.lerp(values.start), this.lerp(values.end));
    }
    private readonly animationChanged = () => {
        if (!this.live)
            return;
        const render = this.renderer();
        render?.markNeedsPaint();
        render?.markNeedsSemanticsUpdate();
        this.entry?.markNeedsBuild();
    };
    private readonly focusChanged = () => {
        if (this.live) {
            this.animationChanged();
        }
    };
    override initState(): void {
        super.initState();
        this.values = this.normalized();
        this.nextValues = this.values;
        this.inputValues = this.values;
        this.inputMin = this.widget.min;
        this.inputMax = this.widget.max;
        this.inputDivisions = this.widget.divisions;
        this.startPosition = new AnimationController({
            vsync: this, value: this.values.start, duration: 0
        });
        this.endPosition = new AnimationController({
            vsync: this, value: this.values.end, duration: 0
        });
        this.overlay = new AnimationController({ vsync: this, duration: 200 });
        this.indicator = new AnimationController({ vsync: this, duration: 100 });
        this.enable = new AnimationController({
            vsync: this, value: this.widget.onChanged !== null ? 1 : 0, duration: 75
        });
        this.overlayAnimation = new CurvedAnimation({ parent: this.overlay, curve: Curves.fastOutSlowIn });
        this.indicatorAnimation = new CurvedAnimation({ parent: this.indicator, curve: Curves.fastOutSlowIn });
        this.enableAnimation = new CurvedAnimation({ parent: this.enable, curve: Curves.easeInOut });
        for (const controller of [this.startPosition, this.endPosition, this.overlay, this.indicator, this.enable])
            controller.addListener(this.animationChanged);
        this.startFocusNode.addListener(this.focusChanged);
        this.endFocusNode.addListener(this.focusChanged);
        this.team = new GestureArenaTeam((this.context as Element).owner.gestureBinding.gestureArena);
    }
    updateValues(): void {
        const raw = this.normalized();
        // Keep controlled off-grid input stable through ambient/layout-only rebuilds.
        // Quantization belongs to a changed parent input or an interaction callback.
        if (raw.equals(this.inputValues) && this.inputMin === this.widget.min && this.inputMax === this.widget.max && this.inputDivisions === this.widget.divisions)
            return;
        this.inputValues = raw;
        this.inputMin = this.widget.min;
        this.inputMax = this.widget.max;
        this.inputDivisions = this.widget.divisions;
        const next = this.discrete ? this.quantized(raw) : raw;
        if (next.equals(this.values))
            return;
        this.values = next;
        for (const [controller, target] of [[this.startPosition, next.start], [this.endPosition, next.end]] as const) {
            if (!this.discrete)
                controller.value = target;
            else {
                const distance = Math.abs(target - controller.value);
                controller.duration = distance === 0 ? 0 : Math.round(75000 / distance) / 1000;
                controller.animateTo(target, { duration: Math.round(controller.duration * distance * 1000) / 1000, curve: Curves.easeInOut });
            }
        }
    }
    override didUpdateWidget(old: RangeSlider): void {
        super.didUpdateWidget(old);
        if ((old.onChanged !== null) !== (this.widget.onChanged !== null)) {
            if (this.widget.onChanged !== null)
                this.enable.forward();
            else
                this.enable.reverse();
        }
        if (!this.enabled)
            this.cancel();
    }
    renderer(): MaterialRangeSliderRender | null {
        if (!this.live)
            return null;
        const context = this.surfaceKey.currentContext;
        if (!(context instanceof Element) || !context.active)
            return null;
        const render = context.findRenderObject();
        return render instanceof MaterialRangeSliderRender && render.hasSize ? render : null;
    }
    private fraction(global: Point): number {
        const render = this.renderer();
        if (!render)
            return 0;
        const rect = render.inputTrackRect(), point = render.globalToLocal(global), visual = (point.x - rect.left) / rect.width;
        return this.direction === 'rtl' ? 1 - visual : visual;
    }
    private select(value: number, dx: number): Thumb | null {
        const render = this.renderer(), theme = this.theme;
        if (!render || !theme)
            return null;
        const result = theme.thumbSelector!(this.direction, this.values, value, theme.rangeThumbShape!.getPreferredSize(this.enabled, this.discrete), captureSourceSize(new Size(render.size.width, render.size.height)), dx);
        invariant(result === null || result === Thumb.start || result === Thumb.end, 'invalid-range-thumb-selector', 'A thumb selector must return the actual Thumb.start/end enum or null');
        return result;
    }
    private emit(values: RangeValues): void {
        if (!this.live || !this.enabled)
            return;
        const projected = this.projected(values);
        if (!projected.equals(this.widget.values))
            this.widget.onChanged?.(projected);
    }
    private startCallback(values: RangeValues): void {
        this.dragging = true;
        this.setState(() => {
        });
        this.widget.onChangeStart?.(this.projected(values));
    }
    private start(global: Point): void {
        if (!this.live || !this.enabled || this.active)
            return;
        const value = clampDouble(this.fraction(global), 0, 1);
        this.selected = this.select(value, 0);
        if (this.selected === null) {
            this.animationChanged();
            return;
        }
        (this.selected === Thumb.start ? this.startFocusNode : this.endFocusNode).requestFocus();
        this.active = true;
        const current = this.quantized(this.values);
        this.nextValues = this.selected === Thumb.start ? new RangeValues(value, current.end) : new RangeValues(current.start, value);
        this.startCallback(current);
        if (!this.live || !this.enabled)
            return;
        this.emit(this.quantized(this.nextValues));
        if (!this.live || !this.enabled)
            return;
        this.overlay.forward();
        if (this.theme && shouldShowOnDrag(this.theme, this.discrete)) {
            this.indicator.forward();
            this.cancelTimer();
            this.timer = scrollChromeTimer(500 * tickerScheduler(this.context).timeDilation, () => {
                this.timer = null;
                if (this.live && !this.active && this.indicator.isCompleted)
                    this.indicator.reverse();
            });
        }
    }
    private dragUpdate(details: DragUpdateDetails): void {
        if (!this.live || !this.enabled)
            return;
        const value = this.fraction(details.globalPosition);
        let start = false;
        if (this.selected === null) {
            this.selected = this.select(value, details.delta.x);
            if (this.selected !== null) {
                start = true;
                this.active = true;
                this.overlay.forward();
                if (this.theme && shouldShowOnDrag(this.theme, this.discrete))
                    this.indicator.forward();
            }
        }
        if (this.selected === null)
            return;
        const current = this.quantized(this.values);
        if (start)
            this.startCallback(current);
        if (!this.live || !this.enabled)
            return;
        const drag = this.quantize(value), separation = this.separation;
        this.nextValues = this.selected === Thumb.start ? new RangeValues(Math.min(drag, current.end - separation), current.end) : new RangeValues(current.start, Math.max(drag, current.start + separation));
        this.emit(this.quantized(this.nextValues));
    }
    private end(): void {
        if (!this.live)
            return;
        if (this.theme && shouldShowOnDrag(this.theme, this.discrete) && this.timer === null)
            this.indicator.reverse();
        if (this.active && this.selected !== null) {
            const values = this.quantized(this.nextValues);
            this.dragging = false;
            this.setState(() => {
            });
            this.widget.onChangeEnd?.(this.projected(values));
            this.active = false;
        }
        if (this.live)
            this.overlay.reverse();
    }
    private cancelTimer(): void {
        this.timer?.dispose();
        this.timer = null;
    }
    private cancel(): void {
        this.active = false;
        this.dragging = false;
        this.cancelTimer();
        this.overlay.stop();
        this.indicator.stop();
        this.overlay.value = 0;
        this.indicator.value = 0;
    }
    get separation(): number {
        return this.discrete ? 0 : (this.theme?.minThumbSeparation ?? 0) / (this.renderer()?.inputTrackRect().width ?? Infinity);
    }
    get semanticValues() {
        return materialRangeSemanticValues(this.values, this.widget.divisions !== null ? 1 / this.widget.divisions : Theme.of(this.context).platform === 'iOS' ? .1 : .05, this.separation);
    }
    format(value: number): string {
        return this.widget.semanticFormatterCallback?.(this.lerp(value)) ?? String(Math.floor(value * 100 + .5)) + '%';
    }
    adjust(thumb: Thumb, increase: boolean): void {
        if (!this.live || !this.enabled)
            return;
        const values = this.semanticValues;
        this.emit(thumb === Thumb.start ? new RangeValues(increase ? values.increasedStart : values.decreasedStart, this.values.end) : new RangeValues(this.values.start, increase ? values.increasedEnd : values.decreasedEnd));
    }
    setSemanticValue(thumb: Thumb, value: number): void {
        const {min,max}=this.widget;
        if (!this.live || !this.enabled || !Number.isFinite(value) || value<min || value>max)
            return;
        const span=max-min, fraction=Number.isFinite(span)?(value-min)/span:(value/2-min/2)/(max/2-min/2);
        const next=this.quantized(thumb===Thumb.start?new RangeValues(fraction,this.values.end):new RangeValues(this.values.start,fraction));
        this.emit(thumb===Thumb.start?new RangeValues(clampDouble(next.start,0,Math.max(0,this.values.end-this.separation)),this.values.end):new RangeValues(this.values.start,clampDouble(next.end,Math.min(1,this.values.start+this.separation),1)));
    }
    private key(thumb: Thumb, event: KeyEvent): 'handled' | 'ignored' {
        if (!this.live || !this.enabled || !(event instanceof KeyDownEvent || event instanceof KeyRepeatEvent))
            return 'ignored';
        const key = event.logicalKey;
        if (key === LogicalKeyboardKey.arrowUp || key === LogicalKeyboardKey.arrowDown) {
            if (MediaQuery.maybeNavigationModeOf(this.context) === 'directional')
                return 'ignored';
            this.adjust(thumb, key === LogicalKeyboardKey.arrowUp);
            return 'handled';
        }
        if (key === LogicalKeyboardKey.arrowLeft || key === LogicalKeyboardKey.arrowRight) {
            this.adjust(thumb, (key === LogicalKeyboardKey.arrowRight) === (this.direction === 'ltr'));
            return 'handled';
        }
        return 'ignored';
    }
    private recognizers(): GestureRecognizerFactories {
        const result = new Map<GestureRecognizerType, GestureRecognizerFactory>();
        if (!this.enabled)
            return result;
        const binding = (this.context as Element).owner.gestureBinding, settings = MediaQuery.maybeGestureSettingsOf(this.context);
        result.set(HorizontalDragGestureRecognizer, new GestureRecognizerFactoryWithHandlers(HorizontalDragGestureRecognizer, () => {
            const drag = new HorizontalDragGestureRecognizer({ binding, debugOwner: this });
            drag.team = this.team;
            return drag;
        }, drag => {
            drag.onStart = details => this.start(details.globalPosition);
            drag.onUpdate = details => this.dragUpdate(details);
            drag.onEnd = () => this.end();
            drag.onCancel = () => this.end();
            drag.gestureSettings = settings;
        }));
        result.set(TapGestureRecognizer, new GestureRecognizerFactoryWithHandlers(TapGestureRecognizer, () => {
            const tap = new TapGestureRecognizer({ binding, debugOwner: this });
            tap.team = this.team;
            return tap;
        }, tap => {
            tap.onTapDown = details => this.start(details.globalPosition);
            tap.onTapUp = () => this.end();
            tap.gestureSettings = settings;
        }));
        return result;
    }
    private hover(global: Point): void {
        const render = this.renderer();
        if (!this.enabled || !render)
            return;
        const p = render.globalToLocal(global), [a, b] = render.centers(), radius = this.theme!.overlayShape!.getPreferredSize(true, false).width / 2;
        this.hoverStart = Math.abs(p.x - a.dx) <= radius && Math.abs(p.y - a.dy) <= radius;
        this.hoverEnd = Math.abs(p.x - b.dx) <= radius && Math.abs(p.y - b.dy) <= radius;
        if (this.hovering && (this.hoverStart || this.hoverEnd))
            this.overlay.forward();
        else
            this.overlay.reverse();
        this.animationChanged();
    }
    private retireOverlay(): void {
        const entry = this.entry;
        this.entry = null;
        if (entry) {
            if (entry.overlay !== null)
                entry.remove();
            entry.dispose();
        }
    }
    private ensureOverlay(context: BuildContext, wanted: boolean): void {
        this.overlayWanted = wanted;
        if (this.pendingOverlay)
            return;
        this.pendingOverlay = true;
        tickerScheduler(context).addPostFrameCallback(() => {
            this.pendingOverlay = false;
            if (!this.live)
                return;
            if (!this.overlayWanted) {
                this.retireOverlay();
                return;
            }
            const overlay = Overlay.of(context);
            if (this.entry?.overlay === overlay) {
                this.entry.markNeedsBuild();
                return;
            }
            this.retireOverlay();
            this.entry = new OverlayEntry({ builder: () => new Directionality(this.direction, new CompositedTransformFollower(new RangeIndicatorWidget(this), { link: this.link, showWhenUnlinked: false })) });
            overlay.insert(this.entry);
        }, { debugLabel: 'RangeSlider.valueIndicator' });
    }
    override deactivate(): void {
        this.suspended = true;
        this.cancel();
        this.startPosition.stop();
        this.endPosition.stop();
        this.enable.stop();
        this.retireOverlay();
        super.deactivate();
    }
    override activate(): void {
        super.activate();
        this.suspended = false;
        this.startPosition.value = this.values.start;
        this.endPosition.value = this.values.end;
        this.enable.value = this.widget.onChanged !== null ? 1 : 0;
    }
    override dispose(): void {
        this.retired = true;
        this.cancelTimer();
        this.startFocusNode.removeListener(this.focusChanged);
        this.endFocusNode.removeListener(this.focusChanged);
        const errors: unknown[] = [];
        for (const close of [() => this.retireOverlay(), () => this.team.dispose(), () => this.startPosition.dispose(), () => this.endPosition.dispose(), () => this.overlay.dispose(), () => this.indicator.dispose(), () => this.enable.dispose(), () => this.overlayAnimation.dispose(), () => this.indicatorAnimation.dispose(), () => this.enableAnimation.dispose(), () => this.startFocusNode.dispose(), () => this.endFocusNode.dispose(), () => super.dispose()])
            try {
                close();
            }
            catch (error) {
                errors.push(error);
            }
        if (errors.length)
            throw new AggregateError(errors, 'RangeSlider retirement failed');
    }
    build(context: BuildContext): Widget {
        const w = this.widget, o = w.options, ambient = SliderTheme.of(context), theme = Theme.of(context), defaults = materialRangeSliderDefaults(context, w.year2023 ?? ambient.year2023 ?? true), states = emptyWidgetStateSet();
        if (w.onChanged === null)
            states.add(WidgetState.disabled);
        if (this.hovering && w.onChanged !== null)
            states.add(WidgetState.hovered);
        if (this.dragging)
            states.add(WidgetState.dragged);
        const fields = Object.fromEntries(sliderThemeFieldNames.map(name => [name, ambient[name] ?? defaults[name]])), indicator = ambient.rangeValueIndicatorShape ?? defaults.rangeValueIndicatorShape!;
        const effective = new SliderThemeData({
            ...fields, activeTrackColor: w.activeColor ?? ambient.activeTrackColor ?? defaults.activeTrackColor, inactiveTrackColor: w.inactiveColor ?? ambient.inactiveTrackColor ?? defaults.inactiveTrackColor, activeTickMarkColor: w.inactiveColor ?? ambient.activeTickMarkColor ?? defaults.activeTickMarkColor, inactiveTickMarkColor: w.activeColor ?? ambient.inactiveTickMarkColor ?? defaults.inactiveTickMarkColor, thumbColor: w.activeColor ?? ambient.thumbColor ?? defaults.thumbColor, overlayColor: w.overlayColor?.resolve(states) ?? w.activeColor?.withOpacity(.12) ?? ambient.overlayColor ?? defaults.overlayColor, rangeValueIndicatorShape: indicator, valueIndicatorColor: indicator instanceof RectangularRangeSliderValueIndicatorShape ? ambient.valueIndicatorColor ?? Color.alphaBlend(new Color(theme.colorScheme.onSurface).withOpacity(.6), new Color(theme.colorScheme.surface).withOpacity(.9)) : w.activeColor ?? ambient.valueIndicatorColor ?? defaults.valueIndicatorColor, thumbSelector: ambient.thumbSelector ?? materialRangeThumbSelector, padding: w.padding ?? ambient.padding
        });
        this.theme = effective;
        const thumb = effective.rangeThumbShape!.getPreferredSize(this.enabled, this.discrete), overlay = effective.overlayShape!.getPreferredSize(this.enabled, this.discrete), tick = effective.rangeTickMarkShape!.getPreferredSize({ sliderTheme: effective, isEnabled: this.enabled });
        const media = MediaQuery.of(context), font = context.services.defaultFont;
        invariant(w.labels === null || font, 'missing-range-slider-font', 'RangeSlider labels require the actual application font');
        const model: RangePaintModel = {
            owner: this, theme: effective, direction: this.direction, screen: new Size(media.width, media.height), scale: media.textScale, textContext: font ? {
                text: context.services.text, resources: context.services.resources, font, scale: context.services.readMetrics().scale
            } : null, preferred: new Size(144 + Math.max(thumb.width, overlay.width, tick.width), Math.max(effective.trackHeight ?? 0, thumb.height, effective.padding === null ? overlay.height : thumb.height, tick.height))
        };
        let content: Widget = new RawGestureDetector(new RangePaintWidget(model, this.surfaceKey), {
            gestures: this.recognizers(), behavior: HitTestBehavior.opaque, excludeFromSemantics: true
        });
        content = new CompositedTransformTarget(content, { link: this.link });
        if (effective.padding)
            content = new Padding(effective.padding, content);
        this.ensureOverlay(context, w.labels !== null && effective.showValueIndicator !== ShowValueIndicator.never && shouldShowOnDrag(effective, this.discrete));
        return new Stack([new Row([new Focus(SizedBox.shrink(), {
                    focusNode: this.startFocusNode, includeSemantics: false, onKeyEvent: (_node, event) => this.key(Thumb.start, event)
                }), new Focus(SizedBox.shrink(), {
                    focusNode: this.endFocusNode, includeSemantics: false, onKeyEvent: (_node, event) => this.key(Thumb.end, event)
                })]), new MouseRegion(content, {
                cursor: w.mouseCursor?.resolve(states) ?? ambient.mouseCursor?.resolve(states) ?? (this.enabled ? SystemMouseCursors.click : SystemMouseCursors.basic), onEnter: () => {
                    if (this.live) {
                        this.hovering = true;
                        this.setState(() => {
                        });
                    }
                }, onExit: () => {
                    if (this.live) {
                        this.hovering = false;
                        this.hoverStart = false;
                        this.hoverEnd = false;
                        this.overlay.reverse();
                        this.setState(() => {
                        });
                    }
                }, onHover: event => this.hover(event.position)
            })]);
    }
}
class RangePaintWidget extends LeafRenderObjectWidget {
    constructor(readonly model: RangePaintModel, key: GlobalKey) {
        super(key);
    }
    createRenderObject(): MaterialRangeSliderRender {
        return new MaterialRangeSliderRender(this.model);
    }
    updateRenderObject(_context: BuildContext, render: RenderObject): void {
        invariant(render instanceof MaterialRangeSliderRender, 'invalid-range-slider-render', 'RangeSlider requires its actual owning render box');
        render.update(this.model);
    }
}
abstract class RangeRenderBase extends RenderBox {
}
class MaterialRangeSliderRender extends RelayoutWhenSystemFontsChangeMixin(RangeRenderBase) {
    private startLabel: TextPainter;
    private endLabel: TextPainter;
    private startNode: SemanticsNode | null = null;
    private endNode: SemanticsNode | null = null;
    constructor(public model: RangePaintModel) {
        super();
        this.startLabel = new TextPainter({}, model.textContext);
        this.endLabel = new TextPainter({}, model.textContext);
        this.updateLabels();
    }
    update(model: RangePaintModel): void {
        const old = this.model;
        this.model = model;
        if (model.textContext) {
            if (old.textContext) {
                this.startLabel._updateContext(model.textContext);
                this.endLabel._updateContext(model.textContext);
            }
            else {
                this.startLabel.dispose();
                this.endLabel.dispose();
                this.startLabel = new TextPainter({}, model.textContext);
                this.endLabel = new TextPainter({}, model.textContext);
            }
        }
        model.owner.updateValues();
        this.updateLabels();
        this.markNeedsLayout();
        this.markNeedsPaint();
        this.markNeedsSemanticsUpdate();
    }
    private updateLabels(): void {
        const m = this.model, labels = m.owner.widget.labels;
        if (labels === null)
            return;
        for (const [painter, text] of [[this.startLabel, labels.start], [this.endLabel, labels.end]] as const) {
            painter.text = new TextSpan({ text, style: m.theme.valueIndicatorTextStyle });
            painter.textDirection = m.direction;
            painter.textScaleFactor = m.scale;
            painter.layout();
        }
    }
    override systemFontsDidChange(): void {
        this.startLabel.markNeedsLayout();
        this.endLabel.markNeedsLayout();
        this.updateLabels();
        super.systemFontsDidChange();
    }
    protected override computeMinIntrinsicWidth(_height: number): number {
        return this.model.preferred.width;
    }
    protected override computeMaxIntrinsicWidth(height: number): number {
        return this.computeMinIntrinsicWidth(height);
    }
    protected override computeMinIntrinsicHeight(_width: number): number {
        return this.model.preferred.height;
    }
    protected override computeMaxIntrinsicHeight(width: number): number {
        return this.computeMinIntrinsicHeight(width);
    }
    protected override computeDryLayout(constraints: BoxConstraints): Size {
        const p = this.model.preferred, v = constraints.constrain({ width: Number.isFinite(constraints.maxWidth) ? constraints.maxWidth : p.width, height: Number.isFinite(constraints.maxHeight) ? constraints.maxHeight : p.height });
        return new Size(v.width, v.height);
    }
    protected override performLayout(constraints: BoxConstraints): Size {
        return this.computeDryLayout(constraints);
    }
    inputTrackRect(): Rect {
        return this.model.theme.rangeTrackShape!.getPreferredRect({
            parentBox: this, sliderTheme: this.model.theme, isDiscrete: false
        });
    }
    private trackRect(): Rect {
        return this.model.theme.rangeTrackShape!.getPreferredRect({
            parentBox: this, sliderTheme: this.model.theme, isDiscrete: this.model.owner.discrete
        });
    }
    centers(): readonly [
        Offset,
        Offset
    ] {
        const m = this.model, o = m.owner;
        return materialRangeThumbCenters(m.theme, this.trackRect(), new RangeValues(o.startPosition.value, o.endPosition.value), m.direction, o.enabled, o.discrete);
    }
    override get semanticsTransport(): SemanticsTransportProperties | null {
        const o = this.model.owner, id = o.widget.options.id;
        return id === undefined ? null : {
            id, role: 'group', name: '', enabled: o.enabled
        };
    }
    protected override get hasSourceSemanticsConfiguration(): boolean {
        return true;
    }
    override describeSemanticsConfiguration(config: SemanticsConfiguration): void {
        super.describeSemanticsConfiguration(config);
        config.isSemanticBoundary = true;
        config.explicitChildNodes = true;
    }
    override assembleSemanticsNode(node: SemanticsNode, config: SemanticsConfiguration, _children: SemanticsNode[]): void {
        const m = this.model, o = m.owner, v = o.values, steps = o.semanticValues, [start, end] = this.centers();
        this.startNode ??= new SemanticsNode();
        this.endNode ??= new SemanticsNode();
        for (const [thumb, child, value, increased, decreased, focused, center] of [[Thumb.start, this.startNode, v.start, steps.increasedStart, steps.decreasedStart, o.startFocusNode.hasFocus, m.direction === 'ltr' ? start : end], [Thumb.end, this.endNode, v.end, steps.increasedEnd, steps.decreasedEnd, o.endFocusNode.hasFocus, m.direction === 'ltr' ? end : start]] as const) {
            const c = new SemanticsConfiguration();
            c.isEnabled = o.enabled;
            c.textDirection = m.direction;
            c.isSlider = true;
            c.isFocusable = true;
            c.isFocused = focused;
            c.value = o.format(value);
            c.increasedValue = o.format(increased);
            c.decreasedValue = o.format(decreased);
            if (o.enabled) {
                c.onIncrease = () => o.adjust(thumb, true);
                c.onDecrease = () => o.adjust(thumb, false);
                c.onFocus = () => {
                    if (o.live && o.enabled)
                        (thumb === Thumb.start ? o.startFocusNode : o.endFocusNode).requestFocus();
                };
            }
            const id = o.widget.options.id, suffix = thumb === Thumb.start ? 'start' : 'end';
            if (id !== undefined)
                c.identifier = id + '-' + suffix;
            child.rect = Rect.fromCenter({
                center, width: 48, height: 48
            });
            child.updateWith({ config: c });
            setSemanticsTransportProperties(child, {
                id: id === undefined ? 'range-thumb-' + child.id : id + '-' + suffix, role: 'group', name: '', enabled: o.enabled, numericRange: {
                    min: o.widget.min, max: o.widget.max, value: o.widget.min * (1 - value) + o.widget.max * value
                }, ...(o.enabled ? {rangeActions:{setValue:(value:number)=>o.setSemanticValue(thumb,value)}} : {})
            });
        }
        node.updateWith({ config, childrenInInversePaintOrder: [this.startNode, this.endNode] });
    }
    override clearSemantics(): void {
        super.clearSemantics();
        this.startNode = null;
        this.endNode = null;
    }
    override dispose(): void {
        try {
            this.startLabel.dispose();
            this.endLabel.dispose();
        }
        finally {
            super.dispose();
        }
    }
    private componentOptions(painter: TextPainter, value: number, activation = this.model.owner.overlayAnimation) {
        const m = this.model, o = m.owner;
        return {
            activationAnimation: activation, enableAnimation: o.enableAnimation, isDiscrete: o.discrete, labelPainter: painter, parentBox: this, sliderTheme: m.theme, textDirection: m.direction, value, textScaleFactor: m.scale, sizeWithOverflow: m.screen.isEmpty ? new Size(this.size.width, this.size.height) : m.screen
        };
    }
    paintIndicators(context: PaintingContext): void {
        const m = this.model, o = m.owner, t = m.theme, always = t.showValueIndicator === ShowValueIndicator.alwaysVisible;
        if (!this.attached || !o.live || !o.enabled || o.widget.labels === null || !always && (!shouldShowOnDrag(t, o.discrete) || o.indicatorAnimation.isDismissed))
            return;
        const [start, end] = this.centers(), lastStart = o.selected === Thumb.start, bottom = lastStart ? Thumb.end : Thumb.start, top = lastStart ? Thumb.start : Thumb.end, shape = t.rangeValueIndicatorShape!, screen = m.screen.isEmpty ? new Size(this.size.width, this.size.height) : m.screen;
        const shift = (center: Offset, labelPainter: TextPainter) => shape.getHorizontalShift({
            parentBox: this, center, labelPainter, activationAnimation: o.indicatorAnimation, textScaleFactor: m.scale, sizeWithOverflow: screen
        });
        const half = (labelPainter: TextPainter) => shape.getPreferredSize(o.enabled, o.discrete, { labelPainter, textScaleFactor: m.scale }).width / 2, startShift = shift(start, this.startLabel), endShift = shift(end, this.endLabel), overflow = half(this.startLabel) + half(this.endLabel) + (m.direction === 'ltr' ? startShift - endShift : endShift - startShift);
        for (const [thumb, onTop] of [[bottom, false], [top, Math.abs(end.dx - start.dx) < overflow]] as const) {
            const isStart = thumb === Thumb.start, label = isStart ? this.startLabel : this.endLabel;
            shape.paint(context, isStart ? start : end, {
                ...this.componentOptions(label, isStart ? o.startPosition.value : o.endPosition.value), activationAnimation: always ? one : o.indicatorAnimation, enableAnimation: always ? one : o.enableAnimation, isOnTop: onTop, thumb
            });
        }
    }
    override paint(context: PaintingContext): void {
        const m = this.model, o = m.owner, t = m.theme, rect = this.trackRect(), [start, end] = this.centers(), normal = t.thumbSize?.resolve(emptyWidgetStateSet()), pressed = emptyWidgetStateSet();
        pressed.add(WidgetState.pressed);
        const pressedWidth = t.thumbSize?.resolve(pressed)?.width;
        let gap = t.trackGap, width = normal?.width;
        if (o.active && width != null && pressedWidth != null && gap != null) {
            const delta = width - pressedWidth;
            width = pressedWidth;
            if (gap > 0)
                gap -= delta / 2;
        }
        t.rangeTrackShape!.paint(context, Offset.zero, {
            parentBox: this, sliderTheme: t.copyWith({ trackGap: gap }), enableAnimation: o.enableAnimation, textDirection: m.direction, startThumbCenter: start, endThumbCenter: end, isDiscrete: o.discrete, isEnabled: o.enabled
        });
        const startSelected = o.selected === Thumb.start && !o.hoverEnd, endSelected = o.selected === Thumb.end && !o.hoverStart;
        for (const [center, label, value, focused, selected, hovered] of [[start, this.startLabel, o.startPosition.value, o.startFocusNode.hasFocus, startSelected, o.hoverStart], [end, this.endLabel, o.endPosition.value, o.endFocusNode.hasFocus, endSelected, o.hoverEnd]] as const) {
            if (focused)
                t.overlayShape!.paint(context, center, { ...this.componentOptions(label, value), activationAnimation: one });
            if (!o.overlayAnimation.isDismissed && (selected || hovered))
                t.overlayShape!.paint(context, center, this.componentOptions(label, value));
        }
        if (o.discrete) {
            const tickWidth = t.rangeTickMarkShape!.getPreferredSize({ sliderTheme: t, isEnabled: o.enabled }).width, trackWidth = rect.width - rect.height, divisions = o.widget.divisions!;
            if (trackWidth / divisions >= 3 * tickWidth)
                for (let i = 0; i <= divisions; i++)
                    t.rangeTickMarkShape!.paint(context, new Offset(rect.left + i / divisions * trackWidth + rect.height / 2, rect.center.dy), {
                        parentBox: this, sliderTheme: t, enableAnimation: o.enableAnimation, textDirection: m.direction, startThumbCenter: start, endThumbCenter: end, isEnabled: o.enabled
                    });
        }
        const lastStart = o.selected === Thumb.start, bottom = lastStart ? Thumb.end : Thumb.start, top = lastStart ? Thumb.start : Thumb.end, effective = width != null && normal ? t.copyWith({ thumbSize: new WidgetStatePropertyAll(sizeType, captureSourceSize(new Size(width, normal.height))) }) : t;
        for (const [thumb, onTop, activation] of [[bottom, false, o.indicatorAnimation], [top, Math.abs(end.dx - start.dx) < t.rangeThumbShape!.getPreferredSize(o.enabled, o.discrete).width, o.overlayAnimation]] as const) {
            const isStart = thumb === Thumb.start;
            t.rangeThumbShape!.paint(context, isStart ? start : end, {
                activationAnimation: activation, enableAnimation: o.enableAnimation, isDiscrete: o.discrete, isOnTop: onTop, textDirection: m.direction, sliderTheme: effective, thumb, isPressed: isStart ? startSelected : endSelected
            });
        }
    }
}
class RangeIndicatorWidget extends LeafRenderObjectWidget {
    constructor(readonly owner: MaterialRangeSliderState) {
        super();
    }
    createRenderObject(): RangeIndicatorRender {
        return new RangeIndicatorRender(this.owner);
    }
    updateRenderObject(_context: BuildContext, render: RenderObject): void {
        invariant(render instanceof RangeIndicatorRender, 'invalid-range-indicator-render', 'Range indicator requires its owning render box');
        render.markNeedsPaint();
    }
}
class RangeIndicatorRender extends RenderBox {
    constructor(readonly slider: MaterialRangeSliderState) {
        super();
    }
    protected override computeDryLayout(constraints: BoxConstraints): Size {
        return new Size(constraints.smallest.width, constraints.smallest.height);
    }
    protected override performLayout(constraints: BoxConstraints): Size {
        return this.computeDryLayout(constraints);
    }
    override paint(context: PaintingContext): void {
        this.slider.renderer()?.paintIndicators(context);
    }
}
