// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Original observable ink response contracts on the current State/arena/focus/keep-alive owners.
import { StatefulWidget, InheritedWidget, Element } from '@nelyx/core/framework/widgets/framework';
import type { Widget, WidgetOptions, BuildContext, State } from '@nelyx/core/framework/widgets/framework';
import { AutomaticKeepAliveClientMixin } from '@nelyx/core/framework/widgets/automatic-keep-alive';
import { Focus } from '@nelyx/core/framework/widgets/focus-scope';
import { FocusNode } from '@nelyx/core/framework/widgets/focus';
import type { FocusManager, FocusHighlightMode } from '@nelyx/core/framework/widgets/focus';
import { Actions, ActivateIntent, ButtonActivateIntent, CallbackAction } from '@nelyx/core/framework/widgets/actions';
import { MouseRegion } from '@nelyx/core/framework/widgets/mouse-region';
import { GestureDetector } from '@nelyx/core/framework/widgets/gesture-detector';
import type { GestureOptions } from '@nelyx/core/framework/widgets/gesture-detector';
import type { TapDownDetails, TapUpDetails } from '@nelyx/core/framework/gestures/tap';
import { HitTestBehavior } from '@nelyx/core/framework/rendering/pointer-listener';
import { RenderBox } from '@nelyx/core/framework/rendering/object';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { DefaultSelectionStyle } from '@nelyx/core/framework/widgets/default-selection-style';
import { SizedBox } from '@nelyx/core/framework/widgets/basic';
import { WidgetState, WidgetStatesController, WidgetStateProperty } from '@nelyx/core/framework/widgets/widget-state';
import { emptyWidgetStateSet } from '@nelyx/core/internal/framework/widgets/widget-state-full-collections';
import { MouseCursor, SystemMouseCursors } from '@nelyx/core/services/mouse-cursor';
import { Color } from '@nelyx/core/ui/color';
import { Offset } from '@nelyx/core/ui/offset';
import { Rect } from '@nelyx/core/ui/rect';
import type { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import type { ShapeBorder } from '@nelyx/core/framework/painting/borders';
import { invariant } from '@nelyx/core/foundation/errors';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { scrollChromeTimer } from '@nelyx/core/internal/framework/widgets/scroll-chrome-timers';
import type { Disposable } from '@nelyx/core/foundation/disposable';
import { Material } from './material.ts';
import { Theme } from './theme.ts';
import { InkHighlight, InkSplash, InkRipple } from './ink-effects.ts';
import { InteractiveInkFeature, InteractiveInkFeatureFactory } from './ink-feature.ts';
import type { RectCallback } from './ink-feature.ts';
import { Feedback } from './feedback.ts';
export { InteractiveInkFeature, InteractiveInkFeatureFactory } from './ink-feature.ts';
export type { InteractiveInkFeatureOptions, InkFactoryOptions, RectCallback } from './ink-feature.ts';
type VoidCallback = () => void;
type HighlightKind = 'pressed' | 'hover' | 'focus';
export interface InkResponseOptions extends WidgetOptions {
    readonly child?: Widget | null;
    readonly onTap?: VoidCallback | null;
    readonly onTapDown?: ((details: TapDownDetails) => void) | null;
    readonly onTapUp?: ((details: TapUpDetails) => void) | null;
    readonly onTapCancel?: VoidCallback | null;
    readonly onDoubleTap?: VoidCallback | null;
    readonly onLongPress?: VoidCallback | null;
    readonly onLongPressUp?: VoidCallback | null;
    readonly onSecondaryTap?: VoidCallback | null;
    readonly onSecondaryTapUp?: ((details: TapUpDetails) => void) | null;
    readonly onSecondaryTapDown?: ((details: TapDownDetails) => void) | null;
    readonly onSecondaryTapCancel?: VoidCallback | null;
    readonly onHighlightChanged?: ((value: boolean) => void) | null;
    readonly onHover?: ((value: boolean) => void) | null;
    readonly mouseCursor?: MouseCursor | WidgetStateProperty<MouseCursor> | null;
    readonly containedInkWell?: boolean;
    readonly highlightShape?: 'circle' | 'rectangle'; /** @dartType double? */
    readonly radius?: number | null;
    readonly borderRadius?: BorderRadius | null;
    readonly customBorder?: ShapeBorder | null;
    readonly focusColor?: Color | null;
    readonly hoverColor?: Color | null;
    readonly highlightColor?: Color | null;
    readonly overlayColor?: WidgetStateProperty<Color | null> | null;
    readonly splashColor?: Color | null;
    readonly splashFactory?: InteractiveInkFeatureFactory | null;
    readonly enableFeedback?: boolean;
    readonly excludeFromSemantics?: boolean;
    readonly focusNode?: FocusNode | null;
    readonly canRequestFocus?: boolean;
    readonly onFocusChange?: ((value: boolean) => void) | null;
    readonly autofocus?: boolean;
    readonly statesController?: WidgetStatesController | null;
    readonly hoverDuration?: number | null;
    readonly id?: string;
}
export class InkResponse extends StatefulWidget {
    readonly options: Readonly<InkResponseOptions>;
    constructor(options: InkResponseOptions = {}) {
        super(options.key ?? null);
        invariant(options.radius == null || Number.isFinite(options.radius) && options.radius >= 0, 'invalid-ink-radius', 'Ink radius must be finite and nonnegative');
        invariant(options.hoverDuration == null || Number.isFinite(options.hoverDuration) && options.hoverDuration >= 0, 'invalid-ink-duration', 'Ink hover duration must be finite and nonnegative');
        this.options = Object.freeze({ ...options });
    }
    get child(): NonNullable<InkResponseOptions['child']> | null {
        return this.options.child ?? null;
    }
    get onTap(): NonNullable<InkResponseOptions['onTap']> | null {
        return this.options.onTap ?? null;
    }
    get onTapDown(): NonNullable<InkResponseOptions['onTapDown']> | null {
        return this.options.onTapDown ?? null;
    }
    get onTapUp(): NonNullable<InkResponseOptions['onTapUp']> | null {
        return this.options.onTapUp ?? null;
    }
    get onTapCancel(): NonNullable<InkResponseOptions['onTapCancel']> | null {
        return this.options.onTapCancel ?? null;
    }
    get onDoubleTap(): NonNullable<InkResponseOptions['onDoubleTap']> | null {
        return this.options.onDoubleTap ?? null;
    }
    get onLongPress(): NonNullable<InkResponseOptions['onLongPress']> | null {
        return this.options.onLongPress ?? null;
    }
    get onLongPressUp(): NonNullable<InkResponseOptions['onLongPressUp']> | null {
        return this.options.onLongPressUp ?? null;
    }
    get onSecondaryTap(): NonNullable<InkResponseOptions['onSecondaryTap']> | null {
        return this.options.onSecondaryTap ?? null;
    }
    get onSecondaryTapUp(): NonNullable<InkResponseOptions['onSecondaryTapUp']> | null {
        return this.options.onSecondaryTapUp ?? null;
    }
    get onSecondaryTapDown(): NonNullable<InkResponseOptions['onSecondaryTapDown']> | null {
        return this.options.onSecondaryTapDown ?? null;
    }
    get onSecondaryTapCancel(): NonNullable<InkResponseOptions['onSecondaryTapCancel']> | null {
        return this.options.onSecondaryTapCancel ?? null;
    }
    get onHighlightChanged(): NonNullable<InkResponseOptions['onHighlightChanged']> | null {
        return this.options.onHighlightChanged ?? null;
    }
    get onHover(): NonNullable<InkResponseOptions['onHover']> | null {
        return this.options.onHover ?? null;
    }
    get mouseCursor(): NonNullable<InkResponseOptions['mouseCursor']> | null {
        return this.options.mouseCursor ?? null;
    }
    get containedInkWell(): NonNullable<InkResponseOptions['containedInkWell']> {
        return this.options.containedInkWell ?? false;
    }
    get highlightShape(): NonNullable<InkResponseOptions['highlightShape']> {
        return this.options.highlightShape ?? 'circle';
    }
    /** @dartReturn double? */
    get radius(): NonNullable<InkResponseOptions['radius']> | null {
        return this.options.radius ?? null;
    }
    get borderRadius(): NonNullable<InkResponseOptions['borderRadius']> | null {
        return this.options.borderRadius ?? null;
    }
    get customBorder(): NonNullable<InkResponseOptions['customBorder']> | null {
        return this.options.customBorder ?? null;
    }
    get focusColor(): NonNullable<InkResponseOptions['focusColor']> | null {
        return this.options.focusColor ?? null;
    }
    get hoverColor(): NonNullable<InkResponseOptions['hoverColor']> | null {
        return this.options.hoverColor ?? null;
    }
    get highlightColor(): NonNullable<InkResponseOptions['highlightColor']> | null {
        return this.options.highlightColor ?? null;
    }
    get overlayColor(): NonNullable<InkResponseOptions['overlayColor']> | null {
        return this.options.overlayColor ?? null;
    }
    get splashColor(): NonNullable<InkResponseOptions['splashColor']> | null {
        return this.options.splashColor ?? null;
    }
    get splashFactory(): NonNullable<InkResponseOptions['splashFactory']> | null {
        return this.options.splashFactory ?? null;
    }
    get enableFeedback(): NonNullable<InkResponseOptions['enableFeedback']> {
        return this.options.enableFeedback ?? true;
    }
    get excludeFromSemantics(): NonNullable<InkResponseOptions['excludeFromSemantics']> {
        return this.options.excludeFromSemantics ?? false;
    }
    get focusNode(): NonNullable<InkResponseOptions['focusNode']> | null {
        return this.options.focusNode ?? null;
    }
    get canRequestFocus(): NonNullable<InkResponseOptions['canRequestFocus']> {
        return this.options.canRequestFocus ?? true;
    }
    get onFocusChange(): NonNullable<InkResponseOptions['onFocusChange']> | null {
        return this.options.onFocusChange ?? null;
    }
    get autofocus(): NonNullable<InkResponseOptions['autofocus']> {
        return this.options.autofocus ?? false;
    }
    get statesController(): NonNullable<InkResponseOptions['statesController']> | null {
        return this.options.statesController ?? null;
    }
    get hoverDuration(): NonNullable<InkResponseOptions['hoverDuration']> | null {
        return this.options.hoverDuration ?? null;
    }
    getRectCallback(_referenceBox: RenderBox): RectCallback | null {
        return null;
    }
    debugCheckContext(context: BuildContext): boolean {
        Material.of(context);
        Directionality.of(context);
        return true;
    }
    createState(): State {
        return new InkResponseState();
    }
}
export interface InkWellOptions extends Omit<InkResponseOptions, 'containedInkWell' | 'highlightShape'> {
}
export class InkWell extends InkResponse {
    constructor(options: InkWellOptions = {}) {
        super({
            ...options, containedInkWell: true, highlightShape: 'rectangle'
        });
    }
}
class ParentInkScope extends InheritedWidget {
    constructor(readonly state: InkResponseState, child: Widget) {
        super(child);
    }
    updateShouldNotify(old: this): boolean {
        return old.state !== this.state;
    }
}
class InkResponseState extends AutomaticKeepAliveClientMixin<InkResponse> {
    private internalStates: WidgetStatesController | null = null;
    private ownedFocus: FocusNode | null = null;
    private controller!: WidgetStatesController;
    private focus!: FocusNode;
    private manager!: FocusManager;
    private parent: InkResponseState | null = null;
    private readonly childrenPressed = new Set<InkResponseState>();
    private readonly splashes = new Set<InteractiveInkFeature>();
    private currentSplash: InteractiveInkFeature | null = null;
    private readonly highlights = new Map<HighlightKind, InkHighlight>();
    private hovered = false;
    private focused = false;
    private live = false;
    private changing = false;
    private activationTimer: Disposable | null = null;
    private readonly statesChanged = () => {
        if (this.live && !this.changing)
            this.setState(() => {
            });
    };
    private readonly highlightModeChanged = (_mode: FocusHighlightMode) => {
        if (this.live)
            this.setState(() => this.updateFocusHighlights());
    };
    private readonly activateAction = new CallbackAction(ActivateIntent, () => this.activateOnIntent());
    private readonly buttonAction = new CallbackAction(ButtonActivateIntent, () => this.activateOnIntent());
    get statesController(): WidgetStatesController {
        return this.controller;
    }
    get focusNode(): FocusNode {
        return this.focus;
    }
    private primary(options = this.widget.options): boolean {
        return !!(options.onTap || options.onTapDown || options.onTapUp || options.onDoubleTap || options.onLongPress || options.onLongPressUp);
    }
    private secondary(options = this.widget.options): boolean {
        return !!(options.onSecondaryTap || options.onSecondaryTapDown || options.onSecondaryTapUp);
    }
    get enabled(): boolean {
        return this.primary() || this.secondary();
    }
    protected get wantKeepAlive(): boolean {
        return this.splashes.size > 0 || this.highlights.size > 0;
    }
    private bindControllers(): void {
        const o = this.widget.options;
        this.controller = o.statesController ?? (this.internalStates ??= new WidgetStatesController());
        this.changing = true;
        try {
            this.controller.update(WidgetState.disabled, !this.enabled);
        }
        finally {
            this.changing = false;
        }
        this.controller.addListener(this.statesChanged);
        this.focus = o.focusNode ?? (this.ownedFocus ??= new FocusNode({ debugLabel: 'InkResponse' }));
    }
    override initState(): void {
        super.initState();
        invariant(this.context instanceof Element, 'invalid-ink-context', 'InkResponse requires an actual Element');
        this.manager = this.context.owner.focus;
        this.bindControllers();
        this.live = true;
        this.manager.addHighlightModeListener(this.highlightModeChanged);
    }
    override didChangeDependencies(): void {
        super.didChangeDependencies();
        const parent = this.context.findAncestorWidgetOfExactType(ParentInkScope)?.state ?? null;
        if (parent !== this.parent) {
            this.parent?.markChild(this, false);
            this.parent = parent;
            if (this.childrenPressed.size)
                this.parent?.markChild(this, true);
        }
        if (this.live)
            this.updateFocusHighlights();
    }
    private markChild(child: InkResponseState, pressed: boolean): void {
        const before = this.childrenPressed.size > 0;
        if (pressed)
            this.childrenPressed.add(child);
        else
            this.childrenPressed.delete(child);
        const after = this.childrenPressed.size > 0;
        if (before !== after)
            this.parent?.markChild(this, after);
    }
    private statesFor(type: HighlightKind) {
        const states = emptyWidgetStateSet();
        for (const state of this.controller.value)
            if (state !== WidgetState.pressed && state !== WidgetState.hovered && state !== WidgetState.focused)
                states.add(state);
        states.add(type === 'pressed' ? WidgetState.pressed : type === 'hover' ? WidgetState.hovered : WidgetState.focused);
        return states;
    }
    private colorFor(type: HighlightKind, isolated = false): Color {
        const o = this.widget.options, t = Theme.of(this.context);
        return o.overlayColor?.resolve(isolated ? this.statesFor(type) : this.controller.value) ?? (type === 'pressed' ? o.highlightColor ?? t.highlightColor : type === 'hover' ? o.hoverColor ?? t.hoverColor : o.focusColor ?? t.focusColor);
    }
    private updateHighlight(type: HighlightKind, value: boolean, callOnHover = true): void {
        if (!this.live)
            return;
        this.changing = true;
        try {
            if (type === 'pressed')
                this.controller.update(WidgetState.pressed, value);
            else if (type === 'hover' && callOnHover)
                this.controller.update(WidgetState.hovered, value);
        }
        finally {
            this.changing = false;
        }
        if (type === 'pressed')
            this.parent?.markChild(this, value);
        const old = this.highlights.get(type);
        if (value === (old !== undefined && old.active))
            return;
        if (value) {
            if (old)
                old.activate();
            else {
                const reference = this.context.findRenderObject();
                if (!(reference instanceof RenderBox))
                    return;
                const o = this.widget.options, color = this.colorFor(type);
                const feature = new InkHighlight({
                    controller: Material.of(this.context), referenceBox: reference, color: this.enabled ? color : color.withAlpha(0), shape: o.highlightShape ?? 'circle', radius: o.radius ?? null, borderRadius: o.borderRadius ?? null, customBorder: o.customBorder ?? null, rectCallback: this.widget.getRectCallback(reference), textDirection: Directionality.of(this.context), fadeDuration: type === 'pressed' ? 200 : o.hoverDuration ?? 50, onRemoved: () => {
                        this.highlights.delete(type);
                        if (this.live)
                            this.updateKeepAlive();
                    }
                });
                this.highlights.set(type, feature);
                this.updateKeepAlive();
            }
        }
        else
            old?.deactivate();
        if (type === 'pressed')
            this.widget.options.onHighlightChanged?.(value);
        else if (type === 'hover' && callOnHover)
            this.widget.options.onHover?.(value);
    }
    private updateFocusHighlights(): void {
        const directional = MediaQuery.maybeNavigationModeOf(this.context) === 'directional', show = this.manager.highlightMode === 'traditional' && this.focused && (this.enabled || directional);
        this.updateHighlight('focus', show);
    }
    private resolveFactory(): InteractiveInkFeatureFactory {
        return this.widget.options.splashFactory ?? Theme.of(this.context).splashFactory;
    }
    private startSplash(details?: TapDownDetails): void {
        if (!this.live)
            return;
        const reference = this.context.findRenderObject();
        invariant(reference instanceof RenderBox && reference.hasSize, 'unlaid-out-ink', 'InkResponse needs its actual laid-out RenderBox');
        const factory = this.resolveFactory(), o = this.widget.options, position = details ? (() => {
            const point = reference.globalToLocal(details.globalPosition);
            return new Offset(point.x, point.y);
        })() : new Offset(reference.size.width / 2, reference.size.height / 2);
        this.changing = true;
        try {
            this.controller.update(WidgetState.pressed, true);
        }
        finally {
            this.changing = false;
        }
        let splash: InteractiveInkFeature | null = null;
        splash = factory.create({
            controller: Material.of(this.context), referenceBox: reference, position, color: o.overlayColor?.resolve(this.controller.value) ?? o.splashColor ?? Theme.of(this.context).splashColor, containedInkWell: o.containedInkWell ?? false, rectCallback: o.containedInkWell ? this.widget.getRectCallback(reference) : null, radius: o.radius ?? null, borderRadius: o.borderRadius ?? null, customBorder: o.customBorder ?? null, onRemoved: () => {
                if (splash) {
                    this.splashes.delete(splash);
                    if (this.currentSplash === splash)
                        this.currentSplash = null;
                    if (this.live)
                        this.updateKeepAlive();
                }
            }, textDirection: Directionality.of(this.context)
        });
        if (splash.debugDisposed)
            return;
        this.splashes.add(splash);
        this.currentSplash?.cancel();
        this.currentSplash = splash;
        this.updateKeepAlive();
        this.updateHighlight('pressed', true);
    }
    private feedback(longPress = false): void {
        if (!this.widget.options.enableFeedback && this.widget.options.enableFeedback !== undefined)
            return;
        const services = this.context.services;
        void (longPress ? Feedback.forLongPress(this.context) : Feedback.forTap(this.context)).catch(error => services.reportError?.(error));
    }
    activateOnIntent(): void {
        if (!this.live)
            return;
        this.activationTimer?.dispose();
        this.activationTimer = null;
        this.startSplash();
        this.currentSplash?.confirm();
        this.currentSplash = null;
        if (this.widget.options.onTap) {
            this.feedback();
            this.widget.options.onTap();
        }
        this.activationTimer = scrollChromeTimer(100, () => {
            this.activationTimer = null;
            if (this.live)
                this.updateHighlight('pressed', false);
        });
    }
    simulateTap(): void {
        if (!this.live || !this.widget.options.onTap)
            return;
        this.startSplash();
        this.handleTap();
    }
    simulateLongPress(): void {
        if (!this.live || !this.widget.options.onLongPress)
            return;
        this.startSplash();
        this.handleLongPress();
    }
    handleTapDown(details: TapDownDetails): void {
        if (!this.live)
            return;
        if (!this.childrenPressed.size)
            this.startSplash(details);
        this.widget.options.onTapDown?.(details);
    }
    handleTapUp(details: TapUpDetails): void {
        if (this.live)
            this.widget.options.onTapUp?.(details);
    }
    handleTap(): void {
        if (!this.live)
            return;
        this.currentSplash?.confirm();
        this.currentSplash = null;
        this.updateHighlight('pressed', false);
        if (this.widget.options.onTap) {
            this.feedback();
            this.widget.options.onTap();
        }
    }
    handleTapCancel(): void {
        if (!this.live)
            return;
        this.currentSplash?.cancel();
        this.currentSplash = null;
        this.widget.options.onTapCancel?.();
        this.updateHighlight('pressed', false);
    }
    handleDoubleTap(): void {
        if (!this.live)
            return;
        this.currentSplash?.confirm();
        this.currentSplash = null;
        this.updateHighlight('pressed', false);
        this.widget.options.onDoubleTap?.();
    }
    handleLongPress(): void {
        if (!this.live)
            return;
        this.currentSplash?.confirm();
        this.currentSplash = null;
        if (this.widget.options.onLongPress) {
            this.feedback(true);
            this.widget.options.onLongPress();
        }
    }
    handleLongPressUp(): void {
        if (!this.live)
            return;
        this.currentSplash?.confirm();
        this.currentSplash = null;
        this.widget.options.onLongPressUp?.();
    }
    handleSecondaryTapDown(details: TapDownDetails): void {
        if (!this.live)
            return;
        if (!this.childrenPressed.size)
            this.startSplash(details);
        this.widget.options.onSecondaryTapDown?.(details);
    }
    handleSecondaryTapUp(details: TapUpDetails): void {
        if (this.live)
            this.widget.options.onSecondaryTapUp?.(details);
    }
    handleSecondaryTap(): void {
        if (!this.live)
            return;
        this.currentSplash?.confirm();
        this.currentSplash = null;
        this.updateHighlight('pressed', false);
        this.widget.options.onSecondaryTap?.();
    }
    handleSecondaryTapCancel(): void {
        if (!this.live)
            return;
        this.currentSplash?.cancel();
        this.currentSplash = null;
        this.widget.options.onSecondaryTapCancel?.();
        this.updateHighlight('pressed', false);
    }
    private retireInk(): void {
        this.activationTimer?.dispose();
        this.activationTimer = null;
        this.currentSplash = null;
        const all = [...this.splashes, ...this.highlights.values()];
        this.splashes.clear();
        this.highlights.clear();
        for (const feature of all)
            feature.dispose();
        this.parent?.markChild(this, false);
        this.childrenPressed.clear();
        this.changing = true;
        try {
            this.controller.update(WidgetState.pressed, false);
        }
        finally {
            this.changing = false;
        }
    }
    override deactivate(): void {
        this.live = false;
        try {
            this.retireInk();
        }
        finally {
            super.deactivate();
        }
    }
    override activate(): void {
        super.activate();
        this.live = true;
    }
    override dispose(): void {
        this.live = false;
        this.manager.removeHighlightModeListener(this.highlightModeChanged);
        this.controller.removeListener(this.statesChanged);
        try {
            this.retireInk();
            this.internalStates?.dispose();
            this.ownedFocus?.dispose();
        }
        finally {
            super.dispose();
        }
    }
    override didUpdateWidget(old: InkResponse): void {
        super.didUpdateWidget(old);
        const o = this.widget.options;
        if (o.statesController !== old.options.statesController) {
            this.controller.removeListener(this.statesChanged);
            if (o.statesController) {
                this.internalStates?.dispose();
                this.internalStates = null;
            }
            this.bindControllers();
        }
        if (o.focusNode !== old.options.focusNode) {
            this.focus = o.focusNode ?? (this.ownedFocus ??= new FocusNode({ debugLabel: 'InkResponse' }));
        }
        if (o.radius !== old.options.radius || o.highlightShape !== old.options.highlightShape || o.borderRadius !== old.options.borderRadius) {
            this.highlights.get('hover')?.dispose();
            this.highlights.get('focus')?.dispose();
            if (this.hovered && this.enabled)
                this.updateHighlight('hover', true, false);
        }
        for (const feature of [...this.splashes, ...this.highlights.values()])
            feature.customBorder = o.customBorder ?? null;
        if (this.enabled !== (this.primary(old.options) || this.secondary(old.options))) {
            this.changing = true;
            try {
                this.controller.update(WidgetState.disabled, !this.enabled);
                if (!this.enabled)
                    this.controller.update(WidgetState.pressed, false);
            }
            finally {
                this.changing = false;
            }
            if (!this.enabled) {
                this.currentSplash?.cancel();
                this.currentSplash = null;
                this.highlights.get('hover')?.dispose();
                this.updateHighlight('pressed', false);
            }
            this.updateHighlight('hover', this.hovered, false);
        }
        this.updateFocusHighlights();
    }
    build(context: BuildContext): Widget {
        super.build(context);
        this.widget.debugCheckContext(context);
        for (const [type, feature] of this.highlights)
            feature.color = this.colorFor(type, true);
        if (this.currentSplash)
            this.currentSplash.color = this.widget.options.overlayColor?.resolve(this.controller.value) ?? this.widget.options.splashColor ?? Theme.of(context).splashColor;
        const o = this.widget.options, cursor = o.mouseCursor instanceof MouseCursor ? o.mouseCursor : o.mouseCursor?.resolve(this.controller.value) ?? (this.enabled ? SystemMouseCursors.click : SystemMouseCursors.basic), canRequest = MediaQuery.maybeNavigationModeOf(context) === 'directional' || this.enabled && (o.canRequestFocus ?? true);
        const gestures: GestureOptions = {
            excludeFromSemantics: true, behavior: HitTestBehavior.opaque, onTapDown: this.primary() ? d => this.handleTapDown(d) : null, onTapUp: this.primary() ? d => this.handleTapUp(d) : null, onTap: this.primary() ? () => this.handleTap() : null, onTapCancel: this.primary() ? () => this.handleTapCancel() : null, onDoubleTap: o.onDoubleTap ? () => this.handleDoubleTap() : null, onLongPress: o.onLongPress ? () => this.handleLongPress() : null, onLongPressUp: o.onLongPressUp ? () => this.handleLongPressUp() : null, onSecondaryTapDown: this.secondary() ? d => this.handleSecondaryTapDown(d) : null, onSecondaryTapUp: this.secondary() ? d => this.handleSecondaryTapUp(d) : null, onSecondaryTap: this.secondary() ? () => this.handleSecondaryTap() : null, onSecondaryTapCancel: this.secondary() ? () => this.handleSecondaryTapCancel() : null
        };
        const body = new GestureDetector(o.child ?? new SizedBox(), gestures), semantics = new Semantics({
            child: body, transportId: o.id ?? null, identifier: o.id ?? null, onTap: !o.excludeFromSemantics && o.onTap ? () => this.simulateTap() : null, onLongPress: !o.excludeFromSemantics && o.onLongPress ? () => this.simulateLongPress() : null
        });
        return new ParentInkScope(this, new Actions({ actions: new Map([[ActivateIntent, this.activateAction], [ButtonActivateIntent, this.buttonAction]]), child: new Focus(new MouseRegion(DefaultSelectionStyle.merge({ mouseCursor: cursor, child: semantics }), {
                cursor, onEnter: () => {
                    if (!this.live)
                        return;
                    this.hovered = true;
                    if (this.enabled)
                        this.updateHighlight('hover', true);
                }, onExit: () => {
                    if (!this.live)
                        return;
                    this.hovered = false;
                    this.updateHighlight('hover', false);
                }
            }), {
                focusNode: this.focus, canRequestFocus: canRequest, autofocus: o.autofocus ?? false, onFocusChange: value => {
                    if (!this.live)
                        return;
                    this.focused = value;
                    this.changing = true;
                    try {
                        this.controller.update(WidgetState.focused, value);
                    }
                    finally {
                        this.changing = false;
                    }
                    this.updateFocusHighlights();
                    o.onFocusChange?.(value);
                }
            }) }));
    }
}
