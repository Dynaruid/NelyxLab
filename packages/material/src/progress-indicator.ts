// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Functional pinned progress painter/default/controller contracts on the existing Core owners.
import { StatefulWidget, State } from '@nelyx/core/framework/widgets/framework';
import type { Widget, BuildContext, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { SingleTickerProviderStateMixin } from '@nelyx/core/framework/widgets/ticker-provider';
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import type { Animation } from '@nelyx/core/framework/animation/animation';
import { CurveTween, Tween } from '@nelyx/core/framework/animation/tween';
import { TweenSequence } from '@nelyx/core/framework/animation/tween-sequence';
import { TweenSequenceItem } from '@nelyx/core/framework/animation/tween-sequence-item';
import { Interval, Cubic, SawTooth, Curves } from '@nelyx/core/framework/animation/curves';
import { Listenable } from '@nelyx/core/foundation/notifier';
import { ListenableBuilder } from '@nelyx/core/framework/widgets/listenable-builder';
import { Color } from '@nelyx/core/ui/color';
import { Paint } from '@nelyx/core/ui/paint';
import type { StrokeCap } from '@nelyx/core/ui/paint';
import type { Canvas } from '@nelyx/core/ui/canvas';
import type { Size } from '@nelyx/core/ui/geometry';
import { Rect } from '@nelyx/core/ui/rect';
import { Path } from '@nelyx/core/ui/path';
import { SemanticsRole } from '@nelyx/core/ui/semantics';
import { clampDouble } from '@nelyx/core/ui/math';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { Directionality } from '@nelyx/core/framework/widgets/app-data';
import { Padding, ConstrainedBox, SizedBox, Transform } from '@nelyx/core/framework/widgets/basic';
import { Opacity } from '@nelyx/core/framework/widgets/opacity';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { CustomPainter } from '@nelyx/core/framework/rendering/custom-paint';
import { CustomPaint } from '@nelyx/core/framework/widgets/custom-paint';
import { ClipRRect } from '@nelyx/core/framework/widgets/clip';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import type { BorderRadiusGeometry } from '@nelyx/core/framework/painting/border-radius';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { CupertinoActivityIndicator } from '@nelyx/cupertino/activity-indicator';
import { invariant } from '@nelyx/core/foundation/errors';
import { Theme } from './theme.ts';
import { ProgressIndicatorTheme } from './progress-indicator-theme.ts';
import { Material, MaterialType } from './material.ts';
import { PercentProperty } from '@nelyx/core/foundation/diagnostic-properties';
import type { DiagnosticPropertiesBuilder } from '@nelyx/core/foundation/diagnostics';
const linearDuration = 1800, circularDuration = 1333 * 2222, epsilon = .001, twoPi = Math.PI * 2;
const lineCurves = [new Interval(0, 750 / linearDuration, { curve: new Cubic(.2, 0, .8, 1) }), new Interval(333 / linearDuration, (333 + 750) / linearDuration, { curve: new Cubic(.4, 0, 1, 1) }), new Interval(1000 / linearDuration, (1000 + 567) / linearDuration, { curve: new Cubic(0, 0, .65, 1) }), new Interval(1267 / linearDuration, 1, { curve: new Cubic(.1, 0, .45, 1) })];
export interface LinearProgressSegment {
    readonly start: number;
    readonly end: number;
    readonly track: boolean;
}
/** Exact source line ordering and ramped track gaps, before LTR/RTL projection. */
export function materialLinearProgressSegments(value: number | null, phase: number, width: number, trackGap = 0): readonly LinearProgressSegment[] {
    if (width <= 0)
        return [];
    const gap = trackGap / width, rows: LinearProgressSegment[] = [], add = (start: number, end: number, track: boolean) => {
        if (end - start > 0)
            rows.push(Object.freeze({
                start, end, track
            }));
    }, effectiveGap = (x: number) => gap * clampDouble(x, 0, .01) / .01;
    if (value !== null) {
        const v = clampDouble(value, 0, 1), start = gap > 0 ? v + effectiveGap(v) : 0;
        if (start < 1)
            add(start, 1, true);
        if (v > 0)
            add(0, v, false);
        return Object.freeze(rows);
    }
    const head1 = lineCurves[0]!.transform(phase), tail1 = lineCurves[1]!.transform(phase), head2 = lineCurves[2]!.transform(phase), tail2 = lineCurves[3]!.transform(phase);
    if (head1 < 1 - gap)
        add(head1 > 0 ? head1 + effectiveGap(head1) : 0, 1, true);
    if (head1 - tail1 > 0)
        add(tail1, head1, false);
    if (tail1 > gap)
        add(head2 > 0 ? head2 + effectiveGap(head2) : 0, tail1 < 1 ? tail1 - effectiveGap(1 - tail1) : 1, true);
    if (head2 - tail2 > 0)
        add(tail2, head2, false);
    if (tail2 > gap)
        add(0, tail2 < 1 ? tail2 - effectiveGap(1 - tail2) : 1, true);
    return Object.freeze(rows);
}
export interface MaterialCircularArc {
    readonly start: number;
    readonly sweep: number;
}
function circularArc(value: number | null, phase: number, headScale = 1): MaterialCircularArc {
    if (value !== null)
        return Object.freeze({ start: -Math.PI / 2, sweep: clampDouble(value, 0, 1) * (twoPi - epsilon) });
    const offset = new SawTooth(2222).transform(phase), rotation = new SawTooth(1333).transform(phase), head = headScale * new Interval(0, .5, { curve: Curves.fastOutSlowIn }).transform(offset), tail = new Interval(.5, 1, { curve: Curves.fastOutSlowIn }).transform(offset);
    return Object.freeze({ start: -Math.PI / 2 + tail * 1.5 * Math.PI + rotation * twoPi + offset * .5 * Math.PI, sweep: Math.max((head - tail) * 1.5 * Math.PI, epsilon) });
}
export function materialCircularProgressArc(value: number | null, phase: number): MaterialCircularArc {
    return circularArc(value, phase);
}
export interface ProgressIndicatorOptions extends WidgetOptions {
    readonly value?: number | null;
    readonly color?: Color | null;
    readonly backgroundColor?: Color | null;
    readonly valueColor?: Animation<Color | null> | null;
    readonly semanticsLabel?: string | null;
    readonly semanticsValue?: string | null;
    readonly controller?: AnimationController | null;
    readonly year2023?: boolean | null;
    readonly id?: string;
}
export interface LinearProgressIndicatorOptions extends ProgressIndicatorOptions {
    readonly minHeight?: number | null;
    readonly borderRadius?: BorderRadiusGeometry | null;
    readonly stopIndicatorColor?: Color | null;
    readonly stopIndicatorRadius?: number | null;
    readonly trackGap?: number | null;
}
export interface CircularProgressIndicatorOptions extends ProgressIndicatorOptions {
    readonly strokeWidth?: number | null;
    readonly strokeAlign?: number | null;
    readonly strokeCap?: StrokeCap | null;
    readonly constraints?: BoxConstraints | null;
    readonly trackGap?: number | null;
    readonly padding?: EdgeInsetsGeometry | null;
}
export abstract class ProgressIndicator<O extends ProgressIndicatorOptions = ProgressIndicatorOptions> extends StatefulWidget {
    readonly options: Readonly<O>;
    abstract get kind(): 'linear' | 'circular';
    constructor(options: O) {
        super(options.key ?? null);
        invariant(options.value == null || typeof options.value === 'number', 'invalid-progress-value', 'Progress value must be a number or null');
        invariant(options.value == null || options.controller == null, 'conflicting-progress-controller', 'Determinate progress cannot have an animation controller');
        this.options = Object.freeze({ ...options });
    }
    get value(): number | null {
        return this.options.value ?? null;
    }
    get effectiveValue(): number | null {
        return this.value === null ? null : clampDouble(this.value, 0, 1);
    }
    get color(): Color | null {
        return this.options.color ?? null;
    }
    get backgroundColor(): Color | null {
        return this.options.backgroundColor ?? null;
    }
    get valueColor(): Animation<Color | null> | null {
        return this.options.valueColor ?? null;
    }
    get semanticsLabel(): string | null {
        return this.options.semanticsLabel ?? null;
    }
    get semanticsValue(): string | null {
        return this.options.semanticsValue ?? null;
    }
    override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
        super.debugFillProperties(properties);
        properties.add(new PercentProperty('value', this.value, { showName: false, ifNull: '<indeterminate>' }));
    }
    createState(): State {
        return new ProgressIndicatorState();
    }
}
export class LinearProgressIndicator extends ProgressIndicator<LinearProgressIndicatorOptions> {
    static readonly defaultAnimationDuration = linearDuration;
    constructor(options: LinearProgressIndicatorOptions = {}) {
        super(options);
        invariant(options.minHeight == null || Number.isFinite(options.minHeight) && options.minHeight > 0, 'invalid-linear-progress-height', 'Progress minHeight must be finite and positive');
        for (const value of [options.stopIndicatorRadius, options.trackGap])
            invariant(value == null || Number.isFinite(value) && value >= 0, 'invalid-linear-progress-size', 'Progress dimensions must be finite and nonnegative');
    }
    get kind(): 'linear' {
        return 'linear';
    }
    get minHeight(): number | null {
        return this.options.minHeight ?? null;
    }
    get borderRadius(): BorderRadiusGeometry | null {
        return this.options.borderRadius ?? null;
    }
    get stopIndicatorColor(): Color | null {
        return this.options.stopIndicatorColor ?? null;
    }
    get stopIndicatorRadius(): number | null {
        return this.options.stopIndicatorRadius ?? null;
    }
    get trackGap(): number | null {
        return this.options.trackGap ?? null;
    }
    get year2023(): boolean | null {
        return this.options.year2023 ?? null;
    }
    get controller(): AnimationController | null {
        return this.options.controller ?? null;
    }
}
export class CircularProgressIndicator extends ProgressIndicator<CircularProgressIndicatorOptions> {
    static readonly defaultAnimationDuration = circularDuration;
    static readonly strokeAlignInside = -1;
    static readonly strokeAlignCenter = 0;
    static readonly strokeAlignOutside = 1;
    private adaptiveVariant = false;
    constructor(options: CircularProgressIndicatorOptions = {}) {
        super(options);
        invariant(options.strokeWidth == null || Number.isFinite(options.strokeWidth) && options.strokeWidth >= 0, 'invalid-circular-progress-stroke', 'Stroke width must be finite and nonnegative');
        invariant(options.strokeAlign == null || Number.isFinite(options.strokeAlign), 'invalid-circular-progress-align', 'Stroke alignment must be finite');
    }
    static adaptive(options: CircularProgressIndicatorOptions = {}): CircularProgressIndicator {
        const widget = new CircularProgressIndicator(options);
        widget.adaptiveVariant = true;
        return widget;
    }
    get adaptive(): boolean {
        return this.adaptiveVariant;
    }
    get kind(): 'circular' {
        return 'circular';
    }
    get strokeWidth(): number | null {
        return this.options.strokeWidth ?? null;
    }
    get strokeAlign(): number | null {
        return this.options.strokeAlign ?? null;
    }
    get strokeCap(): StrokeCap | null {
        return this.options.strokeCap ?? null;
    }
    get constraints(): BoxConstraints | null {
        return this.options.constraints ?? null;
    }
    get trackGap(): number | null {
        return this.options.trackGap ?? null;
    }
    get year2023(): boolean | null {
        return this.options.year2023 ?? null;
    }
    get padding(): EdgeInsetsGeometry | null {
        return this.options.padding ?? null;
    }
    get controller(): AnimationController | null {
        return this.options.controller ?? null;
    }
}
class LinearPainter extends CustomPainter {
    constructor(readonly value: number | null, readonly phase: number, readonly color: Color, readonly track: Color, readonly direction: 'ltr' | 'rtl', readonly radius: BorderRadiusGeometry | null, readonly stopColor: Color | null, readonly stopRadius: number | null, readonly gap: number, private readonly phaseSource: Animation<number> | null = null, private readonly colorSource: Animation<Color | null> | null = null) {
        super({repaint: Listenable.merge([phaseSource, colorSource])});
    }
    paint(canvas: Canvas, size: Size): void {
        const draw = (segment: LinearProgressSegment) => {
            const left = (this.direction === 'ltr' ? segment.start : 1 - segment.end) * size.width, right = (this.direction === 'ltr' ? segment.end : 1 - segment.start) * size.width, rect = Rect.fromLTRB(left, 0, right, size.height), paint = new Paint({ color: (segment.track ? this.track : this.colorSource?.value ?? this.color).toARGB32() });
            if (this.radius)
                canvas.drawRRect(this.radius.resolve(this.direction).toRRect(rect), paint);
            else
                canvas.drawRect(rect, paint);
        };
        const rows = materialLinearProgressSegments(this.value, this.phaseSource?.value ?? this.phase, size.width, this.gap);
        if (this.value !== null) {
            rows.filter(r => r.track).forEach(draw);
            if (this.stopRadius !== null && this.stopRadius > 0 && this.stopColor) {
                const max = size.height / 2;
                canvas.drawCircle({ x: this.direction === 'rtl' ? max : size.width - max, y: max }, Math.min(this.stopRadius, max), new Paint({ color: this.stopColor.toARGB32() }));
            }
            rows.filter(r => !r.track).forEach(draw);
        }
        else
            rows.forEach(draw);
    }
    shouldRepaint(_old: CustomPainter): boolean {
        return true;
    }
}
class CircularPainter extends CustomPainter {
    constructor(readonly value: number | null, readonly phase: number, readonly color: Color, readonly track: Color | null, readonly width: number, readonly align: number, readonly cap: StrokeCap | null, readonly gap: number | null, readonly year2023: boolean, private readonly headScale = 1, private readonly phaseSource: Animation<number> | null = null, private readonly colorSource: Animation<Color | null> | null = null) {
        super({repaint: Listenable.merge([phaseSource, colorSource])});
    }
    protected get arc(): MaterialCircularArc {
        return circularArc(this.value, this.phaseSource?.value ?? this.phase, this.headScale);
    }
    paint(canvas: Canvas, size: Size): void {
        const offset = this.width / 2 * -this.align, actual = {
            x: offset, y: offset, width: size.width - offset * 2, height: size.height - offset * 2
        };
        if (actual.width <= 0 || actual.height <= 0)
            return;
        const sweep = twoPi - epsilon;
        if (this.track) {
            const background = new Paint({
                color: this.track.toARGB32(), strokeWidth: this.width, strokeCap: this.cap ?? 'round', style: 'stroke'
            });
            if (this.gap !== null && this.gap > 0 && this.value !== null && this.value > epsilon) {
                const radius = Math.min(actual.width, actual.height) / 2, startGap = this.width / radius + this.gap / radius, endGap = this.value < epsilon ? startGap : startGap * 2, start = -Math.PI / 2 + startGap, end = Math.max(0, twoPi - clampDouble(this.value, 0, 1) * twoPi - endGap);
                canvas.save();
                canvas.scale(-1, 1);
                canvas.translate(-size.width, 0);
                canvas.drawArc(actual, start, end, false, background);
                canvas.restore();
            }
            else
                canvas.drawArc(actual, 0, sweep, false, background);
        }
        const arc = this.arc, cap = this.year2023 ? (this.value === null && this.cap === null ? 'square' : this.cap ?? 'butt') : this.cap ?? 'round';
        canvas.drawArc(actual, arc.start, arc.sweep, false, new Paint({
            color: (this.colorSource?.value ?? this.color).toARGB32(), strokeWidth: this.width, style: 'stroke', strokeCap: cap
        }));
    }
    shouldRepaint(_old: CustomPainter): boolean {
        return true;
    }
}
class ProgressIndicatorState extends SingleTickerProviderStateMixin<ProgressIndicator> {
    protected internal!: AnimationController;
    protected external: AnimationController | null = null;
    private sync(): void {
        this.internal.duration = this.widget.kind === 'linear' ? linearDuration : circularDuration;
        const platform = Theme.of(this.context).platform, adaptive = this.widget instanceof CircularProgressIndicator && this.widget.adaptive && (platform === 'iOS' || platform === 'macOS');
        const animate = this.widget.value === null && this.external === null && !adaptive;
        if (animate && !this.internal.isAnimating)
            this.internal.repeat();
        else if (!animate && this.internal.isAnimating)
            this.internal.stop();
    }
    private resolveController(): void {
        this.external = this.widget.options.controller ?? ProgressIndicatorTheme.of(this.context).controller;
        this.sync();
    }
    override initState(): void {
        super.initState();
        this.internal = new AnimationController({ vsync: this, duration: this.widget.kind === 'linear' ? linearDuration : circularDuration });
    }
    override didChangeDependencies(): void {
        super.didChangeDependencies();
        this.resolveController();
    }
    override didUpdateWidget(old: ProgressIndicator): void {
        super.didUpdateWidget(old);
        this.resolveController();
    }
    override dispose(): void {
        try {
            this.internal.dispose();
        }
        finally {
            super.dispose();
        }
    }
    protected indicator(context: BuildContext, phase: number): Widget {
        const widget = this.widget, options = widget.options, theme = Theme.of(context), data = ProgressIndicatorTheme.of(context), value = widget.effectiveValue, year = options.year2023 ?? data.year2023 ?? true, color = options.color ?? data.color ?? new Color(theme.colorScheme.primary), phaseSource = value === null ? this.external ?? this.internal : null, colorSource = options.valueColor ?? null;
        let body: Widget;
        if (widget instanceof CircularProgressIndicator && widget.adaptive && (theme.platform === 'iOS' || theme.platform === 'macOS'))
            return value === null ? new CupertinoActivityIndicator({ ...((options.backgroundColor) && ({ color: options.backgroundColor })) }) : CupertinoActivityIndicator.partiallyRevealed({ progress: value, ...options.backgroundColor ? { color: options.backgroundColor } : {} });
        if (widget instanceof LinearProgressIndicator) {
            const o = widget.options, minHeight = o.minHeight ?? data.linearMinHeight ?? 4, radius = o.borderRadius ?? data.borderRadius ?? (!year ? BorderRadius.circular(2) : null), track = o.backgroundColor ?? data.linearTrackColor ?? new Color(theme.colorScheme.secondaryContainer), stopColor = !year ? o.stopIndicatorColor ?? data.stopIndicatorColor ?? new Color(theme.colorScheme.primary) : null, stopRadius = !year ? o.stopIndicatorRadius ?? data.stopIndicatorRadius ?? 2 : null, gap = !year ? o.trackGap ?? data.trackGap ?? 4 : 0;
            body = new ConstrainedBox(new CustomPaint(undefined, { painter: new LinearPainter(value, phase, color, track, Directionality.of(context), radius, stopColor, stopRadius, gap, phaseSource, colorSource) }), new BoxConstraints(Infinity, Infinity, minHeight));
            if (radius && value === null)
                body = new ClipRRect(body, { borderRadius: radius });
        }
        else {
            const o = (widget as CircularProgressIndicator).options, modern = !year, track = o.backgroundColor ?? data.circularTrackColor ?? (modern && value !== null ? new Color(theme.colorScheme.secondaryContainer) : null), width = o.strokeWidth ?? data.strokeWidth ?? 4, align = o.strokeAlign ?? data.strokeAlign ?? (modern ? -1 : 0), cap = o.strokeCap ?? data.strokeCap ?? null, gap = year ? null : o.trackGap ?? data.trackGap ?? (modern ? 4 : null), constraints = o.constraints ?? data.constraints ?? new BoxConstraints(modern ? 40 : 36, Infinity, modern ? 40 : 36), padding = o.padding ?? data.circularTrackPadding ?? (modern ? EdgeInsets.all(4) : null);
            body = new ConstrainedBox(new CustomPaint(undefined, { painter: new CircularPainter(value, phase, color, track, width, align, cap, gap, year, 1, phaseSource, colorSource) }), constraints);
            if (padding)
                body = new Padding(padding, body);
        }
        return this.wrapSemantics(body);
    }
    protected wrapSemantics(body: Widget): Widget {
        const options = this.widget.options, value = this.widget.effectiveValue;
        return new Semantics({
            child: body, container: true, transportId: options.id ?? null, identifier: options.id ?? null, label: options.semanticsLabel ?? null, role: value === null ? SemanticsRole.loadingSpinner : SemanticsRole.progressBar, minValue: value === null ? null : '0', maxValue: value === null ? null : '100', value: options.semanticsValue ?? (value === null ? null : String(Math.round(value * 100)))
        });
    }
    build(): Widget {
        // Phase and valueColor affect pixels only. Their painter listeners keep
        // the layout/build scope and semantic wrapper stable between ticks.
        const controller = this.external ?? this.internal;
        return this.indicator(this.context, controller.value);
    }
}
export interface RefreshProgressIndicatorOptions extends Omit<CircularProgressIndicatorOptions, 'constraints' | 'trackGap' | 'padding' | 'year2023' | 'controller'> {
    readonly elevation?: number;
    readonly indicatorMargin?: EdgeInsetsGeometry;
    readonly indicatorPadding?: EdgeInsetsGeometry;
}
const refreshMargin = EdgeInsets.all(4), refreshPadding = EdgeInsets.all(12);
export class RefreshProgressIndicator extends CircularProgressIndicator {
    static readonly defaultStrokeWidth = 2.5;
    private get refreshOptions(): Readonly<RefreshProgressIndicatorOptions> {
        return this.options;
    }
    constructor(options: RefreshProgressIndicatorOptions = {}) {
        super({ ...options, strokeWidth: options.strokeWidth === undefined ? RefreshProgressIndicator.defaultStrokeWidth : options.strokeWidth });
        invariant(Number.isFinite(this.elevation) && this.elevation >= 0, 'invalid-refresh-elevation', 'Refresh elevation must be finite and nonnegative');
    }
    get elevation(): number {
        return this.refreshOptions.elevation ?? 2;
    }
    get indicatorMargin(): EdgeInsetsGeometry {
        return this.refreshOptions.indicatorMargin ?? refreshMargin;
    }
    get indicatorPadding(): EdgeInsetsGeometry {
        return this.refreshOptions.indicatorPadding ?? refreshPadding;
    }
    override createState(): State {
        return new RefreshProgressIndicatorState();
    }
}
class RefreshPainter extends CircularPainter {
    constructor(phase: number, color: Color, width: number, align: number, cap: StrokeCap | null, readonly arrowheadScale: number) {
        super(null, phase, color, null, width, align, cap, null, true, 1.05);
    }
    override paint(canvas: Canvas, size: Size): void {
        super.paint(canvas, size);
        if (this.arrowheadScale <= 0)
            return;
        const angle = this.arc.start + this.arc.sweep, ux = Math.cos(angle), uy = Math.sin(angle), radius = size.width / 2, arrowRadius = this.width * 2 * this.arrowheadScale, inner = radius - arrowRadius, outer = radius + arrowRadius, path = new Path();
        path.moveTo(radius + ux * inner, radius + uy * inner);
        path.lineTo(radius + ux * outer, radius + uy * outer);
        path.lineTo(radius + ux * radius - uy * arrowRadius, radius + uy * radius + ux * arrowRadius);
        path.close();
        canvas.drawPath(path, new Paint({
            color: this.color.toARGB32(), strokeWidth: this.width, style: 'fill'
        }));
    }
}
class RefreshProgressIndicatorState extends ProgressIndicatorState {
    private lastValue: number | null = null;
    private readonly convertTween = new CurveTween({ curve: new Interval(.1, .33) });
    private readonly rotationTween = new TweenSequence([new TweenSequenceItem({ tween: new Tween({ begin: -.1, end: -.2 }), weight: .33 }), new TweenSequenceItem({ tween: new Tween({ begin: -.2, end: 1.35 }), weight: 1 - .33 })]);
    protected override indicator(context: BuildContext, phase: number): Widget {
        const widget = this.widget;
        invariant(widget instanceof RefreshProgressIndicator, 'invalid-refresh-owner', 'Refresh State needs its owning RefreshProgressIndicator');
        const theme = Theme.of(context), data = ProgressIndicatorTheme.of(context), value = widget.effectiveValue, sourceColor = widget.valueColor?.value ?? widget.color ?? data.color ?? new Color(theme.colorScheme.primary), rotation = value === null && this.lastValue === null ? 0 : Math.PI * this.rotationTween.transform(value ?? this.lastValue!), arrowScale = value === null ? 0 : this.convertTween.transform(value), strokeWidth = widget.options.strokeWidth ?? data.strokeWidth ?? 4, strokeAlign = widget.options.strokeAlign ?? data.strokeAlign ?? 0, strokeCap = widget.options.strokeCap ?? data.strokeCap ?? null;
        return this.wrapSemantics(new Padding(widget.indicatorMargin, new SizedBox(41, 41, new Material({
            type: MaterialType.circle, color: widget.backgroundColor ?? data.refreshBackgroundColor ?? theme.canvasColor, elevation: widget.elevation, child: new Padding(widget.indicatorPadding, new Opacity(Transform.rotate(new CustomPaint(undefined, { painter: new RefreshPainter(phase, sourceColor.withOpacity(1), strokeWidth, strokeAlign, strokeCap, arrowScale) }), rotation), { opacity: sourceColor.opacity }))
        }))));
    }
    override build(): Widget {
        const controller = this.external ?? this.internal, value = this.widget.effectiveValue;
        if (value !== null) {
            this.lastValue = value;
            controller.value = this.convertTween.transform(value) * (1333 / 2 / circularDuration);
        }
        return new ListenableBuilder({ listenable: Listenable.merge([controller, this.widget.valueColor]), builder: context => this.indicator(context, controller.value) });
    }
}
