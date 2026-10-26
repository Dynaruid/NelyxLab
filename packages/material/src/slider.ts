// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Pinned Slider state/render contracts on Core View input, ticker, layer and text owners.
import { StatefulWidget, LeafRenderObjectWidget, Element } from '@nelyx/core/framework/widgets/framework';
import type { State, Widget, BuildContext, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { TickerProviderStateMixin } from '@nelyx/core/framework/widgets/ticker-provider';
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import { CurvedAnimation, AlwaysStoppedAnimation } from '@nelyx/core/framework/animation/animations';
import { Curves } from '@nelyx/core/framework/animation/curves';
import { SliderControl } from '@nelyx/core/framework/widgets/slider-control';
import type { SliderVisualState, SliderTrackGeometry } from '@nelyx/core/framework/widgets/slider-control';
import type { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { WidgetState, WidgetStateProperty, WidgetStatePropertyAll } from '@nelyx/core/framework/widgets/widget-state';
import type { WidgetStatesController } from '@nelyx/core/framework/widgets/widget-state';
import { emptyWidgetStateSet } from '@nelyx/core/framework/widgets/widget-state';
import { Overlay, OverlayEntry } from '@nelyx/core/framework/widgets/overlay';
import { CompositedTransformTarget, CompositedTransformFollower } from '@nelyx/core/framework/widgets/composited-transform';
import { LayerLink } from '@nelyx/core/framework/rendering/layer';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { Padding, SizedBox } from '@nelyx/core/framework/widgets/basic';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { tickerScheduler } from '@nelyx/core/internal/framework/widgets/ticker-scheduler';
import { scrollChromeTimer } from '@nelyx/core/internal/framework/widgets/scroll-chrome-timers';
import type { Disposable } from '@nelyx/core/foundation/disposable';
import { RenderBox, RelayoutWhenSystemFontsChangeMixin } from '@nelyx/core/framework/rendering/object';
import type { RenderObject } from '@nelyx/core/framework/rendering/object';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import type { PaintingContext } from '@nelyx/core/framework/painting/context';
import { TextPainter } from '@nelyx/core/framework/painting/text-painter';
import { TextSpan } from '@nelyx/core/framework/painting/text-span';
import type { ParagraphContext } from '@nelyx/core/ui/paragraph';
import { FontWeight } from '@nelyx/core/ui/typography';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { Offset } from '@nelyx/core/ui/offset';
import { Size } from '@nelyx/core/ui/size';
import type { Rect } from '@nelyx/core/ui/rect';
import { Color } from '@nelyx/core/ui/color';
import { clampDouble } from '@nelyx/core/ui/math';
import { nullableDartType } from '@nelyx/core/foundation/dart-type-witness';
import { sourceSizeType, captureSourceSize } from '@nelyx/core/ui/size-source';
import { SystemMouseCursors, MouseCursor } from '@nelyx/core/services/mouse-cursor';
import { invariant } from '@nelyx/core/foundation/errors';
import { CupertinoSlider } from '@nelyx/cupertino/slider';
import { Theme } from './theme.ts';
import { SliderTheme, SliderThemeData, ShowValueIndicator, SliderInteraction } from './slider-theme.ts';
import { sliderThemeFieldNames } from "./generated/slider/slider-theme-fields.generated.ts";
import { materialSliderDefaults } from "./internal/slider/slider-defaults.ts";
import { RectangularSliderValueIndicatorShape } from './slider-shapes.ts';
export interface SliderOptions extends WidgetOptions {
    /** @dartType double */ readonly value: number;
    readonly onChanged: ((value: number) => void) | null;
    readonly onChangeStart?: ((value: number) => void) | null;
    readonly onChangeEnd?: ((value: number) => void) | null;
    /** @dartType double */ readonly min?: number; /** @dartType double */
    readonly max?: number; /** @dartType int? */
    readonly divisions?: number | null;
    readonly label?: string | null;
    readonly activeColor?: Color | null;
    readonly inactiveColor?: Color | null;
    readonly thumbColor?: Color | null; /** @dartType double? */
    readonly secondaryTrackValue?: number | null;
    readonly secondaryActiveColor?: Color | null;
    readonly overlayColor?: WidgetStateProperty<Color | null> | null;
    readonly mouseCursor?: MouseCursor | WidgetStateProperty<MouseCursor | null> | null;
    readonly semanticFormatterCallback?: ((value: number) => string) | null;
    readonly focusNode?: FocusNode | null;
    readonly autofocus?: boolean;
    readonly allowedInteraction?: SliderInteraction | null;
    readonly padding?: EdgeInsetsGeometry | null;
    readonly year2023?: boolean | null;
    readonly showValueIndicator?: ShowValueIndicator | null;
    readonly id?: string;
    readonly statesController?: WidgetStatesController | null;
}
export class Slider extends StatefulWidget {
    readonly options: Readonly<SliderOptions>;
    private adaptiveVariant = false;
    constructor(options: SliderOptions) {
        super(options.key ?? null);
        const min = options.min ?? 0, max = options.max ?? 1;
        invariant([min, max, options.value].every(Number.isFinite) && max >= min && options.value >= min && options.value <= max, 'invalid-material-slider-range', 'Slider value must be finite within ordered min/max bounds');
        invariant(options.secondaryTrackValue == null || Number.isFinite(options.secondaryTrackValue) && options.secondaryTrackValue >= min && options.secondaryTrackValue <= max, 'invalid-secondary-slider-value', 'Secondary track value must be within min/max bounds');
        invariant(options.divisions == null || Number.isSafeInteger(options.divisions) && options.divisions > 0, 'invalid-material-slider-divisions', 'Slider divisions must be a positive safe integer');
        invariant(options.onChanged === null || typeof options.onChanged === 'function', 'invalid-material-slider-callback', 'onChanged must be a function or null');
        this.options = Object.freeze({ ...options });
    }
    static adaptive(options: SliderOptions): Slider {
        const widget = new Slider(options);
        widget.adaptiveVariant = true;
        return widget;
    }
    get adaptive(): boolean {
        return this.adaptiveVariant;
    }
    /** @dartReturn double */ get value(): number {
        return this.options.value;
    } /** @dartReturn double */
    get min(): number {
        return this.options.min ?? 0;
    } /** @dartReturn double */
    get max(): number {
        return this.options.max ?? 1;
    } /** @dartReturn int? */
    get divisions(): number | null {
        return this.options.divisions ?? null;
    }
    get onChanged(): SliderOptions['onChanged'] {
        return this.options.onChanged;
    }
    get onChangeStart() {
        return this.options.onChangeStart ?? null;
    }
    get onChangeEnd() {
        return this.options.onChangeEnd ?? null;
    }
    get label() {
        return this.options.label ?? null;
    }
    get activeColor() {
        return this.options.activeColor ?? null;
    }
    get inactiveColor() {
        return this.options.inactiveColor ?? null;
    }
    get thumbColor() {
        return this.options.thumbColor ?? null;
    }
    get secondaryTrackValue() {
        return this.options.secondaryTrackValue ?? null;
    }
    get secondaryActiveColor() {
        return this.options.secondaryActiveColor ?? null;
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
    get focusNode() {
        return this.options.focusNode ?? null;
    }
    get autofocus() {
        return this.options.autofocus ?? false;
    }
    get allowedInteraction() {
        return this.options.allowedInteraction ?? null;
    }
    get padding() {
        return this.options.padding ?? null;
    }
    get year2023() {
        return this.options.year2023 ?? null;
    }
    get showValueIndicator() {
        return this.options.showValueIndicator ?? null;
    }
    createState(): State {
        return new MaterialSliderState();
    }
}
const stoppedOne = new AlwaysStoppedAnimation(1), sizeType = nullableDartType(sourceSizeType);
export function materialSliderThumbCenter(theme: SliderThemeData, track: Rect, fraction: number, direction: 'ltr' | 'rtl', enabled: boolean, discrete: boolean): Offset {
    const visual = direction === 'rtl' ? 1 - fraction : fraction, padding = theme.trackShape!.isRounded ? track.height : 0, position = discrete ? track.left + visual * (track.width - padding) + padding / 2 : track.left + visual * track.width, thumb = theme.thumbShape!.getPreferredSize(enabled, discrete), inset = padding > thumb.width / 2 ? padding / 2 : 0;
    return new Offset(clampDouble(position, track.left + inset, track.right - inset), track.center.dy);
}
function showWhenDragged(theme: SliderThemeData, discrete: boolean): boolean {
    const mode = theme.showValueIndicator;
    return mode === ShowValueIndicator.onlyForDiscrete ? discrete : mode === ShowValueIndicator.onlyForContinuous ? !discrete : mode === ShowValueIndicator.always || mode === ShowValueIndicator.onDrag;
}
interface SliderPaintModel {
    readonly theme: SliderThemeData;
    readonly visual: SliderVisualState;
    readonly enabled: boolean;
    readonly divisions: number | null;
    readonly secondary: number | null;
    readonly label: string | null;
    readonly scale: number;
    readonly screen: Size;
    readonly textContext: ParagraphContext | null;
    readonly owner: MaterialSliderState;
}
class MaterialSliderState extends TickerProviderStateMixin<Slider> {
    readonly surfaceKey = new GlobalKey('Material Slider paint');
    readonly link = new LayerLink();
    private enable!: AnimationController;
    private indicator!: AnimationController;
    private enabledCurve!: CurvedAnimation;
    private indicatorCurve!: CurvedAnimation;
    private entry: OverlayEntry | null = null;
    private pendingOverlay = false;
    private suspended = false;
    private retired = false;
    private timer: Disposable | null = null;
    private focused = false;
    private active = false;
    private indicatorPolicy = false;
    private get live(): boolean {
        return this.mounted && !this.suspended && !this.retired && (this.context as Element).active;
    }
    private get enabled(): boolean {
        return this.widget.options.onChanged !== null && this.widget.max > this.widget.min;
    }
    private readonly animationChanged = () => {
        if (this.live) {
            this.setState(() => {
            });
            this.entry?.markNeedsBuild();
        }
    };
    override initState(): void {
        super.initState();
        this.enable = new AnimationController({
            vsync: this, value: this.enabled ? 1 : 0, duration: 75
        });
        this.indicator = new AnimationController({ vsync: this, duration: 100 });
        this.enabledCurve = new CurvedAnimation({ parent: this.enable, curve: Curves.easeInOut });
        this.indicatorCurve = new CurvedAnimation({ parent: this.indicator, curve: Curves.fastOutSlowIn });
        this.enable.addListener(this.animationChanged);
        this.indicator.addListener(this.animationChanged);
    }
    override didUpdateWidget(old: Slider): void {
        super.didUpdateWidget(old);
        if ((old.options.onChanged !== null && old.max > old.min) !== this.enabled)
            (this.enabled ? this.enable.forward() : this.enable.reverse());
        if (!this.enabled) {
            this.active = false;
            this.cancelTimer();
            this.indicator.reverse();
        }
    }
    private cancelTimer(): void {
        if (this.timer !== null) {
            this.timer.dispose();
            this.timer = null;
        }
    }
    private interaction(active: boolean): void {
        if (!this.live)
            return;
        this.active = active;
        if (!this.indicatorPolicy)
            return;
        if (active) {
            this.indicator.forward();
            this.cancelTimer();
            this.timer = scrollChromeTimer(500 * tickerScheduler(this.context).timeDilation, () => {
                this.timer = null;
                if (this.live && !this.active && this.indicator.isCompleted)
                    this.indicator.reverse();
            });
        }
        else if (this.timer === null)
            this.indicator.reverse();
    }
    private focusHighlight(focused: boolean): void {
        if (!this.live)
            return;
        this.focused = focused;
        if (this.indicatorPolicy) {
            if (focused)
                this.indicator.forward();
            else
                this.indicator.reverse();
        }
    }
    get enableAnimation(): CurvedAnimation {
        return this.enabledCurve;
    }
    get indicatorAnimation(): CurvedAnimation {
        return this.indicatorCurve;
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
    private ensureOverlay(context: BuildContext, show: boolean): void {
        if (this.pendingOverlay)
            return;
        this.pendingOverlay = true;
        tickerScheduler(context).addPostFrameCallback(() => {
            this.pendingOverlay = false;
            if (!this.live)
                return;
            if (!show) {
                this.retireOverlay();
                return;
            }
            const overlay = Overlay.of(context);
            if (this.entry?.overlay === overlay) {
                this.entry.markNeedsBuild();
                return;
            }
            this.retireOverlay();
            const entry = new OverlayEntry({ builder: () => new Directionality(Directionality.of(this.context), new CompositedTransformFollower(new SliderIndicator(this), { link: this.link, showWhenUnlinked: false })) });
            this.entry = entry;
            overlay.insert(entry);
        }, { debugLabel: 'Slider.valueIndicator' });
    }
    override deactivate(): void {
        this.suspended = true;
        this.cancelTimer();
        this.active = false;
        this.focused = false;
        this.indicator.stop();
        this.enable.stop();
        this.retireOverlay();
        super.deactivate();
    }
    override activate(): void {
        super.activate();
        this.suspended = false;
        this.enable.value = this.enabled ? 1 : 0;
        this.indicator.value = 0;
    }
    override dispose(): void {
        this.retired = true;
        this.cancelTimer();
        const errors: unknown[] = [];
        for (const close of [() => this.retireOverlay(), () => this.enabledCurve.dispose(), () => this.indicatorCurve.dispose(), () => this.enable.dispose(), () => this.indicator.dispose(), () => super.dispose()])
            try {
                close();
            }
            catch (error) {
                errors.push(error);
            }
        if (errors.length)
            throw new AggregateError(errors, 'Material Slider teardown failed');
    }
    renderer(): MaterialSliderRender | null {
        if (!this.live)
            return null;
        const render = this.surfaceKey.currentContext?.findRenderObject();
        return render instanceof MaterialSliderRender && render.attached ? render : null;
    }
    build(context: BuildContext): Widget {
        const widget = this.widget, o = widget.options, theme = Theme.of(context), ambient = SliderTheme.of(context);
        if (widget.adaptive && (theme.platform === 'iOS' || theme.platform === 'macOS')) {
            this.ensureOverlay(context, false);
            return new SizedBox(Infinity, undefined, new CupertinoSlider({
                value: widget.value, min: widget.min, max: widget.max, divisions: widget.divisions, onChanged: o.onChanged, onChangeStart: o.onChangeStart ?? null, onChangeEnd: o.onChangeEnd ?? null, ...o.activeColor ? { activeColor: o.activeColor } : {}, ...o.thumbColor ? { thumbColor: o.thumbColor } : {}, ...o.id === undefined ? {} : { id: o.id }
            }));
        }
        const year = o.year2023 ?? ambient.year2023 ?? true;
        let effective = ambient;
        const sourceStates = (visual: SliderVisualState) => {
            const states = emptyWidgetStateSet();
            if (o.onChanged === null)
                states.add(WidgetState.disabled);
            if (visual.showHoverHighlight)
                states.add(WidgetState.hovered);
            if (visual.showFocusHighlight)
                states.add(WidgetState.focused);
            if (visual.dragging)
                states.add(WidgetState.dragged);
            return states;
        };
        const resolve = (visual: SliderVisualState): SliderThemeData => {
            const defaults = materialSliderDefaults(context, year, visual, ambient), fields = Object.fromEntries(sliderThemeFieldNames.map(name => [name, ambient[name] ?? defaults[name]])), shape = ambient.valueIndicatorShape ?? defaults.valueIndicatorShape!, colors = theme.colorScheme;
            let style = ambient.valueIndicatorTextStyle ?? defaults.valueIndicatorTextStyle!;
            if (MediaQuery.of(context).boldText)
                style = style.merge(style.copyWith({ fontWeight: FontWeight.bold }));
            return new SliderThemeData({
                ...fields, activeTrackColor: o.activeColor ?? ambient.activeTrackColor ?? defaults.activeTrackColor, inactiveTrackColor: o.inactiveColor ?? ambient.inactiveTrackColor ?? defaults.inactiveTrackColor, secondaryActiveTrackColor: o.secondaryActiveColor ?? ambient.secondaryActiveTrackColor ?? defaults.secondaryActiveTrackColor, activeTickMarkColor: o.inactiveColor ?? ambient.activeTickMarkColor ?? defaults.activeTickMarkColor, inactiveTickMarkColor: o.activeColor ?? ambient.inactiveTickMarkColor ?? defaults.inactiveTickMarkColor, thumbColor: o.thumbColor ?? o.activeColor ?? ambient.thumbColor ?? defaults.thumbColor, overlayColor: o.overlayColor?.resolve(sourceStates(visual)) ?? o.activeColor?.withOpacity(.12) ?? ambient.overlayColor ?? defaults.overlayColor, valueIndicatorShape: shape, valueIndicatorColor: shape instanceof RectangularSliderValueIndicatorShape ? ambient.valueIndicatorColor ?? Color.alphaBlend(new Color(colors.onSurface).withOpacity(.6), new Color(colors.surface).withOpacity(.9)) : o.activeColor ?? ambient.valueIndicatorColor ?? defaults.valueIndicatorColor, valueIndicatorTextStyle: style, showValueIndicator: o.showValueIndicator ?? ambient.showValueIndicator ?? ShowValueIndicator.onlyForDiscrete, padding: o.padding ?? ambient.padding
            });
        };
        // Preferred geometry is state independent, while colors and state properties resolve in the control builder.
        const initial: SliderVisualState = {
            states: o.statesController?.value ?? emptyWidgetStateSet(), focusNode: o.focusNode ?? null, pressed: false, hovered: false, focused: false, showFocusHighlight: this.focused, showHoverHighlight: false, pressProgress: 0, dragging: false, hoveringThumb: false, position: stoppedOne, fraction: widget.max === widget.min ? 0 : (widget.value - widget.min) / (widget.max - widget.min), direction: Directionality.of(context), geometry: {
                width: 192, height: 48, trackInset: 24, thumbHitRadius: 24, minDragExtent: 0, expand: true
            }
        };
        effective = resolve(initial);
        this.indicatorPolicy = showWhenDragged(effective, widget.divisions !== null);
        const enabled = this.enabled, discrete = widget.divisions !== null, thumb = effective.thumbShape!.getPreferredSize(enabled, discrete), overlay = effective.overlayShape!.getPreferredSize(enabled, discrete), tick = effective.tickMarkShape!.getPreferredSize({ isEnabled: enabled, sliderTheme: effective }), width = 144 + Math.max(thumb.width, overlay.width, tick.width), height = Math.max(effective.trackHeight ?? 0, thumb.height, effective.padding === null ? overlay.height : thumb.height, tick.height), interaction = o.allowedInteraction ?? ambient.allowedInteraction ?? SliderInteraction.tapAndSlide;
        this.ensureOverlay(context, o.label != null && effective.showValueIndicator !== ShowValueIndicator.never && (this.indicatorPolicy || effective.showValueIndicator === ShowValueIndicator.alwaysVisible));
        let control: Widget = new SliderControl({
            value: widget.value, min: widget.min, max: widget.max, divisions: widget.divisions, policy: 'material', interaction: interaction === SliderInteraction.tapOnly ? 'tapOnly' : interaction === SliderInteraction.slideOnly ? 'slideOnly' : interaction === SliderInteraction.slideThumb ? 'slideThumb' : 'tapAndSlide', adjustmentUnit: theme.platform === 'iOS' || theme.platform === 'macOS' ? .1 : .05, onChanged: o.onChanged ? (value => this.widget.options.onChanged?.(value)) : null, onChangeStart: o.onChangeStart ?? null, onChangeEnd: o.onChangeEnd ?? null, focusNode: o.focusNode ?? null, autofocus: o.autofocus ?? false, statesController: o.statesController ?? null, ...o.id === undefined ? {} : { id: o.id }, ...o.semanticFormatterCallback ? { semanticFormatter: o.semanticFormatterCallback } : {}, geometry: {
                width, height, trackInset: overlay.width / 2, thumbHitRadius: overlay.width / 2, minDragExtent: 0, expand: true
            }, resolveMouseCursor: visual => (o.mouseCursor instanceof MouseCursor ? o.mouseCursor : o.mouseCursor?.resolve(sourceStates(visual))) ?? ambient.mouseCursor?.resolve(sourceStates(visual)) ?? (enabled ? SystemMouseCursors.click : SystemMouseCursors.basic), trackGeometry: (parentBox, fraction, direction): SliderTrackGeometry => {
                const rect = effective.trackShape!.getPreferredRect({
                    parentBox, sliderTheme: effective, isDiscrete: discrete
                }), center = materialSliderThumbCenter(effective, rect, fraction, direction, enabled, discrete);
                return {
                    left: rect.left, right: rect.right, centerX: center.dx, centerY: center.dy
                };
            }, onInteractionChange: value => this.interaction(value), onFocusHighlightChange: value => this.focusHighlight(value), builder: (buildContext, visual) => {
                effective = resolve(visual);
                const media = MediaQuery.of(buildContext), scale = Math.min(media.textScale, 1.3), font = buildContext.services.defaultFont;
                invariant(o.label == null || font, 'missing-slider-label-font', 'Slider labels require the actual application font');
                return new SliderPaintWidget({
                    theme: effective, visual, enabled, divisions: widget.divisions, secondary: o.secondaryTrackValue == null ? null : widget.max === widget.min ? 0 : (o.secondaryTrackValue - widget.min) / (widget.max - widget.min), label: o.label ?? null, scale, screen: new Size(media.width, media.height), textContext: font ? {
                        text: buildContext.services.text, resources: buildContext.services.resources, font, scale: buildContext.services.readMetrics().scale
                    } : null, owner: this
                }, this.surfaceKey);
            }
        });
        control = new CompositedTransformTarget(control, { link: this.link });
        if (effective.padding)
            control = new Padding(effective.padding, control);
        return control;
    }
}
// The label painter belongs to its render object and never crosses View resource owners.
class SliderPaintWidget extends LeafRenderObjectWidget {
    constructor(readonly model: SliderPaintModel, key: GlobalKey) {
        super(key);
    }
    createRenderObject(): MaterialSliderRender {
        return new MaterialSliderRender(this.model);
    }
    updateRenderObject(_context: BuildContext, render: RenderObject): void {
        invariant(render instanceof MaterialSliderRender, 'invalid-slider-render', 'Slider requires its owning render box');
        render.update(this.model);
    }
}
abstract class SliderRenderBase extends RenderBox {
}
class MaterialSliderRender extends RelayoutWhenSystemFontsChangeMixin(SliderRenderBase) {
    private painter: TextPainter;
    constructor(public model: SliderPaintModel) {
        super();
        this.painter = new TextPainter({}, model.textContext);
        this.updateLabel();
    }
    update(model: SliderPaintModel): void {
        const old = this.model;
        this.model = model;
        if (model.textContext) {
            if (old.textContext)
                this.painter._updateContext(model.textContext);
            else {
                this.painter.dispose();
                this.painter = new TextPainter({}, model.textContext);
            }
        }
        this.updateLabel();
        this.markNeedsLayout();
        this.markNeedsPaint();
    }
    private updateLabel(): void {
        const m = this.model;
        this.painter.text = m.label === null ? null : new TextSpan({ style: m.theme.valueIndicatorTextStyle, text: m.label });
        this.painter.textDirection = m.visual.direction;
        this.painter.textScaleFactor = m.scale;
        if (m.label !== null)
            this.painter.layout();
    }
    override systemFontsDidChange(): void {
        this.painter.markNeedsLayout();
        this.updateLabel();
        super.systemFontsDidChange();
    }
    protected override computeDryLayout(constraints: BoxConstraints): Size {
        return new Size(constraints.smallest.width, constraints.smallest.height);
    }
    protected override performLayout(constraints: BoxConstraints): Size {
        return this.computeDryLayout(constraints);
    }
    override dispose(): void {
        try {
            this.painter.dispose();
        }
        finally {
            super.dispose();
        }
    }
    private rect(): Rect {
        return this.model.theme.trackShape!.getPreferredRect({
            parentBox: this, sliderTheme: this.model.theme, isDiscrete: this.model.divisions !== null
        });
    }
    private center(rect: Rect): Offset {
        const m = this.model;
        return materialSliderThumbCenter(m.theme, rect, m.visual.position.value, m.visual.direction, m.enabled, m.divisions !== null);
    }
    private componentOptions(always = false) {
        const m = this.model;
        return {
            activationAnimation: always ? stoppedOne : new AlwaysStoppedAnimation(m.visual.pressProgress), enableAnimation: always ? stoppedOne : m.owner.enableAnimation, isDiscrete: m.divisions !== null, labelPainter: this.painter, parentBox: this, sliderTheme: m.theme, textDirection: m.visual.direction, value: m.visual.fraction, textScaleFactor: m.scale, sizeWithOverflow: m.screen.isEmpty ? new Size(this.size.width, this.size.height) : m.screen
        };
    }
    paintIndicator(context: PaintingContext): void {
        const m = this.model, always = m.theme.showValueIndicator === ShowValueIndicator.alwaysVisible;
        if (!this.attached || !m.enabled || m.label === null || !always && (!showWhenDragged(m.theme, m.divisions !== null) || m.owner.indicatorAnimation.isDismissed))
            return;
        m.theme.valueIndicatorShape?.paint(context, this.center(this.rect()), { ...this.componentOptions(always), activationAnimation: always ? stoppedOne : m.owner.indicatorAnimation });
    }
    override paint(context: PaintingContext): void {
        const m = this.model, t = m.theme, discrete = m.divisions !== null, rect = this.rect(), center = this.center(rect), thumb = t.thumbSize?.resolve(emptyWidgetStateSet()), pressed = emptyWidgetStateSet();
        pressed.add(WidgetState.pressed);
        const pressedWidth = t.thumbSize?.resolve(pressed)?.width;
        let gap = t.trackGap, width = thumb?.width;
        if (m.visual.dragging && width != null && pressedWidth != null && gap != null) {
            const delta = width - pressedWidth;
            if (width > 0)
                width = pressedWidth;
            if (gap > 0)
                gap -= delta / 2;
        }
        t.trackShape!.paint(context, Offset.zero, {
            parentBox: this, sliderTheme: t.copyWith({ trackGap: gap }), enableAnimation: m.owner.enableAnimation, textDirection: m.visual.direction, thumbCenter: center, secondaryOffset: m.secondary === null ? null : new Offset(rect.left + (m.visual.direction === 'rtl' ? 1 - m.secondary : m.secondary) * rect.width, rect.center.dy), isDiscrete: discrete, isEnabled: m.enabled
        });
        const options = this.componentOptions();
        if (m.visual.pressProgress !== 0)
            t.overlayShape!.paint(context, center, options);
        if (discrete) {
            const tickWidth = t.tickMarkShape!.getPreferredSize({ isEnabled: m.enabled, sliderTheme: t }).width, trackWidth = rect.width - rect.height;
            if (trackWidth / m.divisions! >= 3 * tickWidth)
                for (let i = 0; i <= m.divisions!; i++)
                    t.tickMarkShape!.paint(context, new Offset(rect.left + i / m.divisions! * trackWidth + rect.height / 2, rect.center.dy), {
                        parentBox: this, sliderTheme: t, enableAnimation: m.owner.enableAnimation, textDirection: m.visual.direction, thumbCenter: center, isEnabled: m.enabled
                    });
        }
        t.thumbShape!.paint(context, center, { ...options, sliderTheme: width != null && thumb ? t.copyWith({ thumbSize: new WidgetStatePropertyAll(sizeType, captureSourceSize(new Size(width, thumb.height))) }) : t });
    }
}
class SliderIndicator extends LeafRenderObjectWidget {
    constructor(readonly owner: MaterialSliderState) {
        super();
    }
    createRenderObject(): SliderIndicatorRender {
        return new SliderIndicatorRender(this.owner);
    }
    updateRenderObject(_context: BuildContext, render: RenderObject): void {
        invariant(render instanceof SliderIndicatorRender, 'invalid-slider-indicator', 'Indicator requires its owning render box');
        render.markNeedsPaint();
    }
}
class SliderIndicatorRender extends RenderBox {
    constructor(readonly slider: MaterialSliderState) {
        super();
    }
    protected override computeDryLayout(constraints: BoxConstraints): Size {
        return new Size(constraints.smallest.width, constraints.smallest.height);
    }
    protected override performLayout(constraints: BoxConstraints): Size {
        return this.computeDryLayout(constraints);
    }
    override paint(context: PaintingContext): void {
        this.slider.renderer()?.paintIndicator(context);
    }
}
