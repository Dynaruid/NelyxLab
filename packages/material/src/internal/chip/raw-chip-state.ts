// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import type { Widget, BuildContext } from '@nelyx/core/framework/widgets/framework';
import { TickerProviderStateMixin } from '@nelyx/core/framework/widgets/ticker-provider';
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import { CurvedAnimation } from '@nelyx/core/framework/animation/animations';
import { Curves, Interval } from '@nelyx/core/framework/animation/curves';
import { AnimatedBuilder } from '@nelyx/core/framework/widgets/transitions';
import { AnimatedSwitcher } from '@nelyx/core/framework/widgets/animated-switcher';
import { Listenable } from '@nelyx/core/foundation/notifier';
import { WidgetState, WidgetStatesController, WidgetStateProperty } from '@nelyx/core/framework/widgets/widget-state';
import { nullableSourceBorderSideType } from '@nelyx/core/framework/widgets/widget-state-border-side';
import { BorderSide, OutlinedBorder } from '@nelyx/core/framework/painting/borders';
import { StadiumBorder } from '@nelyx/core/framework/painting/stadium-border';
import { CircleBorder } from '@nelyx/core/framework/painting/circle-border';
import { EdgeInsets, EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { IconTheme } from '@nelyx/core/framework/widgets/icon-theme';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import { MediaQuery, Directionality } from '@nelyx/core/framework/widgets/app-data';
import { Center } from '@nelyx/core/framework/widgets/basic';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { Color } from '@nelyx/core/ui/color';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { invariant } from '@nelyx/core/foundation/errors';
import type { RawChip } from "../../raw-chip.ts";
import { ChipTheme, ChipThemeData } from "../../chip-theme.ts";
import { chipDefaultsM3 } from './chip-defaults.ts';
import { Theme } from "../../theme.ts";
import { ThemeData } from "../../theme-data.ts";
import { MaterialTapTargetSize } from "../../theme-data.ts";
import { Material } from "../../material.ts";
import { Ink } from "../../ink-decoration.ts";
import { InkWell } from "../../ink-well.ts";
import { InteractiveInkFeatureFactory } from "../../ink-feature.ts";
import type { InteractiveInkFeature, InkFactoryOptions } from "../../ink-feature.ts";
import { Tooltip } from "../../tooltip.ts";
import { MaterialLocalizations } from "../../material-localizations.ts";
import { ChipRenderWidget, ChipRedirectingHitDetectionWidget, EnsureMinSemanticsSize } from './chip-render.ts';
import { ChipBackgroundDecoration } from './chip-background.ts';
class UnconstrainedInkSplashFactory extends InteractiveInkFeatureFactory {
    constructor(private readonly parent: InteractiveInkFeatureFactory) {
        super();
    }
    create(options: InkFactoryOptions): InteractiveInkFeature {
        return this.parent.create({ ...options, containedInkWell: false });
    }
}
export class RawChipState extends TickerProviderStateMixin<RawChip> {
    selectController!: AnimationController;
    avatarDrawerController!: AnimationController;
    deleteDrawerController!: AnimationController;
    enableController!: AnimationController;
    checkmarkAnimation!: CurvedAnimation;
    avatarDrawerAnimation!: CurvedAnimation;
    deleteDrawerAnimation!: CurvedAnimation;
    enableAnimation!: CurvedAnimation;
    selectionFade!: CurvedAnimation;
    readonly statesController = new WidgetStatesController();
    private tapping = false;
    private readonly statesChanged = () => {
        if (this.mounted)
            this.setState(() => {
            });
    };
    get hasDeleteButton(): boolean {
        return this.widget.onDeleted !== null;
    }
    get hasAvatar(): boolean {
        return this.widget.avatar !== null;
    }
    get canTap(): boolean {
        return this.widget.isEnabled && this.widget.tapEnabled && (this.widget.onPressed !== null || this.widget.onSelected !== null);
    }
    get isTapping(): boolean {
        return this.canTap && this.tapping;
    }
    override initState(): void {
        super.initState();
        invariant(this.widget.onPressed === null || this.widget.onSelected === null, 'conflicting-chip-callbacks', 'Specify one of onPressed or onSelected');
        this.statesController.update(WidgetState.disabled, !this.widget.isEnabled);
        this.statesController.update(WidgetState.selected, this.widget.selected);
        this.statesController.addListener(this.statesChanged);
        const style = this.widget.chipAnimationStyle;
        this.selectController = new AnimationController({
            vsync: this, duration: style?.selectAnimation?.duration ?? 195, reverseDuration: style?.selectAnimation?.reverseDuration ?? null, value: this.widget.selected ? 1 : 0
        });
        this.selectionFade = new CurvedAnimation({ parent: this.selectController, curve: Curves.fastOutSlowIn });
        this.avatarDrawerController = new AnimationController({
            vsync: this, duration: style?.avatarDrawerAnimation?.duration ?? 150, reverseDuration: style?.avatarDrawerAnimation?.reverseDuration ?? null, value: this.hasAvatar || this.widget.selected ? 1 : 0
        });
        this.deleteDrawerController = new AnimationController({
            vsync: this, duration: style?.deleteDrawerAnimation?.duration ?? 150, reverseDuration: style?.deleteDrawerAnimation?.reverseDuration ?? null, value: this.hasDeleteButton ? 1 : 0
        });
        this.enableController = new AnimationController({
            vsync: this, duration: style?.enableAnimation?.duration ?? 75, reverseDuration: style?.enableAnimation?.reverseDuration ?? null, value: this.widget.isEnabled ? 1 : 0
        });
        this.checkmarkAnimation = new CurvedAnimation({
            parent: this.selectController, curve: new Interval(1 - 150 / 195, 1, { curve: Curves.fastOutSlowIn }), reverseCurve: new Interval(1 - 50 / 195, 1, { curve: Curves.fastOutSlowIn })
        });
        this.deleteDrawerAnimation = new CurvedAnimation({ parent: this.deleteDrawerController, curve: Curves.fastOutSlowIn });
        this.avatarDrawerAnimation = new CurvedAnimation({
            parent: this.avatarDrawerController, curve: Curves.fastOutSlowIn, reverseCurve: new Interval(1 - 100 / 195, 1, { curve: Curves.fastOutSlowIn })
        });
        this.enableAnimation = new CurvedAnimation({ parent: this.enableController, curve: Curves.fastOutSlowIn });
    }
    override didUpdateWidget(old: RawChip): void {
        super.didUpdateWidget(old);
        const w = this.widget;
        if (old.isEnabled !== w.isEnabled) {
            this.statesController.update(WidgetState.disabled, !w.isEnabled);
            if (w.isEnabled)
                this.enableController.forward();
            else
                this.enableController.reverse();
        }
        if (old.avatar !== w.avatar || old.selected !== w.selected) {
            if (this.hasAvatar || w.selected)
                this.avatarDrawerController.forward();
            else
                this.avatarDrawerController.reverse();
        }
        if (old.selected !== w.selected) {
            this.statesController.update(WidgetState.selected, w.selected);
            if (w.selected)
                this.selectController.forward();
            else
                this.selectController.reverse();
        }
        if (old.onDeleted !== w.onDeleted) {
            if (this.hasDeleteButton)
                this.deleteDrawerController.forward();
            else
                this.deleteDrawerController.reverse();
        }
    }
    override dispose(): void {
        this.statesController.removeListener(this.statesChanged);
        for (const controller of [this.selectController, this.avatarDrawerController, this.deleteDrawerController, this.enableController])
            controller.dispose();
        for (const animation of [this.checkmarkAnimation, this.avatarDrawerAnimation, this.deleteDrawerAnimation, this.enableAnimation, this.selectionFade])
            animation.dispose();
        this.statesController.dispose();
        super.dispose();
    }
    private tapDown = (): void => {
        if (!this.canTap)
            return;
        this.statesController.update(WidgetState.pressed, true);
        this.setState(() => {
            this.tapping = true;
        });
    };
    private tapCancel = (): void => {
        if (!this.canTap)
            return;
        this.statesController.update(WidgetState.pressed, false);
        this.setState(() => {
            this.tapping = false;
        });
    };
    private tap = (): void => {
        if (!this.canTap)
            return;
        this.statesController.update(WidgetState.pressed, false);
        this.setState(() => {
            this.tapping = false;
        });
        this.widget.onSelected?.(!this.widget.selected);
        this.widget.onPressed?.();
    };
    private shape(chip: ChipThemeData, defaults: ChipThemeData): OutlinedBorder {
        const states = this.statesController.value, resolvedSide = WidgetStateProperty.resolveAs(nullableSourceBorderSideType, this.widget.side, states) ?? WidgetStateProperty.resolveAs(nullableSourceBorderSideType, chip.side, states), shape = this.widget.shape ?? chip.shape ?? defaults.shape ?? new StadiumBorder();
        if (resolvedSide !== null)
            return shape.copyWith({ side: resolvedSide });
        return !shape.side.equals(BorderSide.none) ? shape : shape.copyWith(defaults.side === null ? {} : { side: defaults.side });
    }
    private resolveColor(color: RawChip['color'], selected: Color | null, background: Color | null, disabled: Color | null, defaultColor: RawChip['color']): Color | null {
        const states = this.statesController.value;
        let resolved: Color | null;
        if (color !== null)
            resolved = color.resolve(states);
        else if (states.contains(WidgetState.selected) && states.contains(WidgetState.disabled))
            resolved = selected;
        else if (states.contains(WidgetState.disabled))
            resolved = disabled;
        else if (states.contains(WidgetState.selected))
            resolved = selected;
        else
            resolved = background;
        return resolved ?? defaultColor?.resolve(states) ?? null;
    }
    private background(theme: ThemeData, chip: ChipThemeData, defaults: ChipThemeData): Color | null {
        const w = this.widget;
        const color = w.color ?? chip.color, disabled = this.resolveColor(color, null, null, w.disabledColor ?? chip.disabledColor, defaults.color), background = this.resolveColor(color, null, w.backgroundColor ?? chip.backgroundColor, null, defaults.color), selected = this.resolveColor(color, w.selectedColor ?? chip.selectedColor, null, null, defaults.color);
        return Color.lerp(Color.lerp(disabled, background, this.enableController.value), selected, this.selectionFade.value);
    }
    private tooltip(child: Widget, tooltip: string | null, enabled = true): Widget {
        return tooltip !== null && enabled ? new Tooltip({ message: tooltip, child }) : child;
    }
    private deleteButton(context: BuildContext, theme: ThemeData, chip: ChipThemeData, defaults: ChipThemeData): Widget | null {
        if (!this.hasDeleteButton)
            return null;
        const w = this.widget, m3 = chipDefaultsM3(context, 'RawChip', w.isEnabled), iconTheme = w.iconTheme ?? chip.iconTheme ?? theme.chipTheme.iconTheme ?? m3.iconTheme!, color = w.deleteIconColor ?? chip.deleteIconColor ?? theme.chipTheme.deleteIconColor ?? w.iconTheme?.color ?? chip.iconTheme?.color ?? defaults.deleteIconColor, size = w.iconTheme?.size ?? chip.iconTheme?.size ?? theme.chipTheme.iconTheme?.size ?? m3.iconTheme!.size!, tap = w.materialTapTargetSize ?? theme.materialTapTargetSize, density = (w.visualDensity ?? theme.visualDensity).baseSizeAdjustment, semantic = tap === MaterialTapTargetSize.padded ? 48 : 40, body = new InkWell({
            radius: (32 + (w.padding?.vertical ?? 0)) * .45, splashFactory: new UnconstrainedInkSplashFactory(theme.splashFactory), customBorder: new CircleBorder(), onTap: w.isEnabled ? w.onDeleted : null, child: new IconTheme(iconTheme.copyWith({ color, size }), w.deleteIcon)
        });
        return new EnsureMinSemanticsSize(this.tooltip(body, w.deleteButtonTooltipMessage ?? MaterialLocalizations.of(context).deleteButtonTooltip, w.isEnabled && w.onDeleted !== null), { width: semantic + density.dx, height: semantic + density.dy });
    }
    build(context: BuildContext): Widget {
        const w = this.widget, theme = Theme.of(context), chip = ChipTheme.of(context), brightness = chip.brightness ?? theme.brightness, defaults = w.defaultProperties ?? chipDefaultsM3(context, 'RawChip', w.isEnabled), direction = Directionality.of(context), shape = this.shape(chip, defaults), elevation = w.elevation ?? chip.elevation ?? defaults.elevation ?? 0, press = w.pressElevation ?? chip.pressElevation ?? defaults.pressElevation ?? 0, padding = w.padding ?? chip.padding ?? defaults.padding, labelStyle = (chip.labelStyle ?? defaults.labelStyle)?.merge(w.labelStyle), iconTheme = w.iconTheme ?? chip.iconTheme ?? defaults.iconTheme, showCheckmark = w.showCheckmark ?? chip.showCheckmark ?? defaults.showCheckmark;
        invariant(padding !== null && labelStyle !== undefined && labelStyle !== null && showCheckmark !== null, 'missing-chip-defaults', 'Chip defaults require padding, labelStyle and showCheckmark');
        let avatar = w.avatar;
        if (iconTheme !== null && avatar !== null) {
            invariant(defaults.iconTheme !== null, 'missing-chip-icon-defaults', 'Chip default iconTheme is required when merging avatar icon style');
            avatar = IconTheme.merge({ data: defaults.iconTheme.merge(iconTheme), child: avatar });
        }
        const ratio = MediaQuery.textScalerOf(context).scale(labelStyle.fontSize ?? 14) / 14, labelPadding = w.labelPadding ?? chip.labelPadding ?? defaults.labelPadding ?? EdgeInsets.symmetric({ horizontal: 8 - 4 * Math.min(1, Math.max(0, ratio - 1)) }), contents = new ChipRenderWidget({
            theme: {
                label: new DefaultTextStyle(labelStyle, w.label, {
                    overflow: 'fade', textAlign: 'start', maxLines: 1, softWrap: false
                }), avatar: new AnimatedSwitcher({
                    duration: 150, switchInCurve: Curves.fastOutSlowIn, child: avatar
                }), deleteIcon: new AnimatedSwitcher({
                    duration: 150, switchInCurve: Curves.fastOutSlowIn, child: this.deleteButton(context, theme, chip, defaults)
                }), brightness, padding: padding.resolve(direction), visualDensity: w.visualDensity ?? theme.visualDensity, labelPadding: labelPadding.resolve(direction), showAvatar: this.hasAvatar, showCheckmark, checkmarkColor: w.checkmarkColor ?? chip.checkmarkColor ?? defaults.checkmarkColor, canTapBody: this.canTap
            }, checkmarkAnimation: this.checkmarkAnimation, enableAnimation: this.enableAnimation, avatarDrawerAnimation: this.avatarDrawerAnimation, deleteDrawerAnimation: this.deleteDrawerAnimation, avatarBorder: w.avatarBorder, avatarBoxConstraints: w.avatarBoxConstraints ?? chip.avatarBoxConstraints, deleteIconBoxConstraints: w.deleteIconBoxConstraints ?? chip.deleteIconBoxConstraints
        });
        const body = new Material({
            elevation: this.isTapping ? press : elevation, shadowColor: w.selected ? w.selectedShadowColor ?? chip.selectedShadowColor ?? defaults.selectedShadowColor : w.shadowColor ?? chip.shadowColor ?? defaults.shadowColor, surfaceTintColor: w.surfaceTintColor ?? chip.surfaceTintColor ?? defaults.surfaceTintColor, animationDuration: 75, shape, clipBehavior: w.clipBehavior, child: new InkWell({
                onFocusChange: v => this.statesController.update(WidgetState.focused, v), focusNode: w.focusNode, autofocus: w.autofocus, canRequestFocus: w.isEnabled, onTap: this.canTap ? this.tap : null, onTapDown: this.canTap ? this.tapDown : null, onTapCancel: this.canTap ? this.tapCancel : null, onHover: this.canTap ? v => this.statesController.update(WidgetState.hovered, v) : null, mouseCursor: w.mouseCursor, hoverColor: (w.color ?? chip.color) === null ? null : new Color(0x00000000), customBorder: shape, child: new AnimatedBuilder({
                    animation: Listenable.merge([this.selectController, this.enableController]), builder: (_c, child) => new Ink({ decoration: new ChipBackgroundDecoration(shape, this.background(theme, chip, defaults)), child }), child: this.tooltip(contents, w.tooltip, w.onPressed !== null || w.onSelected !== null)
                })
            })
        }), density = (w.visualDensity ?? theme.visualDensity).baseSizeAdjustment, constraints = (w.materialTapTargetSize ?? theme.materialTapTargetSize) === MaterialTapTargetSize.padded ? new BoxConstraints(48 + density.dx, Infinity, 48 + density.dy, Infinity) : new BoxConstraints(), result = new ChipRedirectingHitDetectionWidget(new Center(body, { widthFactor: 1, heightFactor: 1 }), constraints), web = FoundationPlatform.hostEnvironment.kind === 'web';
        return new Semantics({
            container: true, button: w.tapEnabled, selected: web ? null : w.selected, checked: web ? w.selected : null, enabled: w.tapEnabled ? this.canTap : null, child: result
        });
    }
}
