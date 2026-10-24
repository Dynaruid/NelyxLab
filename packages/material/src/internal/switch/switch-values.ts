// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Pinned M3 and adaptive switch decisions. M2/deprecated policy is excluded.
import type {SwitchConfig,SwitchPaintValues} from '@nelyx/core/internal/framework/widgets/switch-painter';
import type { BuildContext } from '@nelyx/core/framework/widgets/framework';
import { Color } from '@nelyx/core/ui/color';
import { sourceColorType, captureSourceColor, assertSourceColorInterface } from '@nelyx/core/ui/color-source';
import { WidgetState, WidgetStateProperty } from '@nelyx/core/framework/widgets/widget-state';
import type { DartSet } from '@nelyx/core/foundation/dart-collections';
import { emptyWidgetStateSet } from '@nelyx/core/internal/framework/widgets/widget-state-full-collections';
import { DartDouble } from '@nelyx/core/foundation/dart-numeric';
import { nullableDartType } from '@nelyx/core/foundation/dart-type-witness';
import { WidgetStateMouseCursor, sourceMouseCursorType } from '@nelyx/core/framework/widgets/widget-state-mouse-cursor';
import type { MouseCursor } from '@nelyx/core/services/mouse-cursor';
import { HSLColor } from '@nelyx/core/framework/painting/colors';
import { BoxShadow } from '@nelyx/core/framework/painting/box-shadow';
import { Offset } from '@nelyx/core/ui/offset';
import type { Icon } from '@nelyx/core/framework/widgets/icon';
import { Curves } from '@nelyx/core/framework/animation/curves';
import type { ToggleableMotionProfile } from '@nelyx/core/framework/widgets/toggleable-control';
import { invariant } from '@nelyx/core/foundation/errors';
import { CupertinoColors, CupertinoDynamicColor } from '@nelyx/cupertino/colors';
import { Theme } from '../../theme.ts';
import { SwitchTheme, SwitchThemeData } from '../../switch-theme.ts';
import { MaterialTapTargetSize } from '../../theme-data.ts';
import { switchDefaultsM3 } from '../toggle/toggle-defaults.ts';
import type { Switch } from '../../switch.ts';
import { requireThemeValue } from '../theme/theme-types.ts';
import { Size } from '@nelyx/core/ui/size';

const m3Motion: ToggleableMotionProfile = Object.freeze({ duration: 300, reactionDuration: 100, curve: Curves.easeOutBack, reverseCurve: Curves.easeOutBack.flipped, colorCurve: Curves.easeOut, colorReverseCurve: Curves.easeIn });
const cupMotion: ToggleableMotionProfile = Object.freeze({ duration: 140, reactionDuration: 200, curve: Curves.linear, reverseCurve: Curves.linear, colorCurve: Curves.easeOut, colorReverseCurve: Curves.easeIn });
const cupShadows = Object.freeze([new BoxShadow({color: 0x26000000, offset: new Offset(0, 3), blurRadius: 8}), new BoxShadow({color: 0x0f000000, offset: new Offset(0, 3), blurRadius: 1})]);
const m3Config: SwitchConfig = Object.freeze({ isCupertino: false, trackWidth: 52, trackHeight: 32, activeRadius: 12, inactiveRadius: 8, pressedRadius: 14, iconRadius: 12, transitionalWidth: 34, transitionalHeight: 22, shadows: [], motion: m3Motion });
const cupConfig: SwitchConfig = Object.freeze({ isCupertino: true, trackWidth: 51, trackHeight: 31, activeRadius: 14, inactiveRadius: 14, pressedRadius: 14, iconRadius: 14, transitionalWidth: 28, transitionalHeight: 28, shadows: cupShadows, motion: cupMotion });
const transparent = new Color(0), white = new Color(0xffffffff);
function property(resolve: (states: DartSet<WidgetState>) => Color | null): WidgetStateProperty<Color | null> {
    return WidgetStateProperty.resolveWith(nullableDartType(sourceColorType), states => {
        const color = resolve(states); if (color === null) return null;
        assertSourceColorInterface(color);
        // Reviewed source subtypes retain their captured identity and resolved floating channels.
        return Object.getPrototypeOf(color) === Color.prototype ? captureSourceColor(color) : color;
    });
}
export function switchDefaultsCupertino(context: BuildContext): SwitchThemeData {
    const green = CupertinoDynamicColor.resolve(CupertinoColors.systemGreen, context), inactive = CupertinoDynamicColor.resolve(CupertinoColors.secondarySystemFill, context);
    return new SwitchThemeData({ thumbColor: property(() => white), trackColor: property(states => states.contains(WidgetState.selected) ? green : inactive), trackOutlineColor: property(() => transparent), overlayColor: property(states => states.contains(WidgetState.focused) ? HSLColor.fromColor(green.withOpacity(.8)).withLightness(.69).withSaturation(.835).toColor() : transparent), mouseCursor: WidgetStateProperty.resolveWith(nullableDartType(sourceMouseCursorType), states => WidgetStateMouseCursor.adaptiveClickable.resolve(states)), splashRadius: 0 });
}
export interface SwitchEnvironment {
    readonly config: SwitchConfig; readonly style: SwitchThemeData; readonly defaults: SwitchThemeData;
    readonly surface: Color;
    readonly applyCupertinoTheme: boolean; readonly cupertinoPrimary: Color;
    readonly iconColor: (states: DartSet<WidgetState>) => Color;
}
function effectiveSwitchTheme(context: BuildContext, adaptive: boolean): SwitchThemeData {
    const theme = Theme.of(context), inherited = SwitchTheme.of(context);
    if (!adaptive) return inherited;
    const adaptation = theme.getAdaptation(SwitchThemeData);
    if (adaptation !== null) return requireThemeValue(adaptation.adapt(theme, inherited), SwitchThemeData);
    return ['iOS', 'macOS'].includes(theme.platform) ? new SwitchThemeData() : inherited;
}
/** Public Switch size resolution and internal painter resolution are independent source build stages. */
export function switchSize(w: Switch, context: BuildContext, adaptive: boolean): Size {
    const theme = Theme.of(context), style = effectiveSwitchTheme(context, adaptive), defaults = switchDefaultsM3(context);
    const padding = w.padding ?? style.padding ?? defaults.padding!;
    const target = w.materialTapTargetSize ?? style.materialTapTargetSize ?? theme.materialTapTargetSize;
    return new Size(52 + padding.horizontal, (target === MaterialTapTargetSize.padded ? 56 : 40) + padding.vertical);
}
export function switchEnvironment(w: Switch, context: BuildContext, adaptive: boolean): SwitchEnvironment {
    const theme = Theme.of(context), isCupertino = adaptive && ['iOS', 'macOS'].includes(theme.platform), config = isCupertino ? cupConfig : m3Config;
    const style = effectiveSwitchTheme(context, adaptive);
    const materialDefaults = switchDefaultsM3(context), defaults = isCupertino ? switchDefaultsCupertino(context) : materialDefaults;
    const c = theme.colorScheme;
    return { config, style, defaults, surface: new Color(c.surface), applyCupertinoTheme: isCupertino && (w.applyCupertinoTheme ?? theme.cupertinoOverrideTheme?.applyThemeToAll ?? false), cupertinoPrimary: new Color(theme.cupertinoOverrideTheme?.primaryColor ?? c.primary), iconColor: states => states.contains(WidgetState.disabled) ? new Color(isCupertino || states.contains(WidgetState.selected) ? c.onSurface : c.surfaceContainerHighest).withOpacity(.38) : new Color(isCupertino || states.contains(WidgetState.selected) ? c.onPrimaryContainer : c.surfaceContainerHighest) };
}
function copy(states: DartSet<WidgetState>, selected?: boolean, add?: WidgetState): DartSet<WidgetState> {
    const result = emptyWidgetStateSet(); for (const state of states) if (state !== WidgetState.selected || selected !== false) result.add(state);
    if (selected === true) result.add(WidgetState.selected); if (add !== undefined) result.add(add); return result;
}
function double(value: DartDouble | null | undefined): number | null {
    if (value == null) return null;
    invariant(DartDouble.is(value), 'invalid-switch-outline-type', 'Switch trackOutlineWidth requires retained DartDouble provenance');
    invariant(Number.isFinite(value.value) && value.value >= 0, 'invalid-switch-outline-width', 'Switch outline width must be finite and nonnegative'); return value.value;
}
export function resolveSwitchPaint(w: Switch, e: SwitchEnvironment, states: DartSet<WidgetState>): SwitchPaintValues {
    const {style, defaults, config} = e, active = copy(states, true), inactive = copy(states, false);
    const widgetThumb = (s: DartSet<WidgetState>) => s.contains(WidgetState.disabled) ? w.inactiveThumbColor : s.contains(WidgetState.selected) ? w.activeThumbColor : w.inactiveThumbColor;
    const thumb = (s: DartSet<WidgetState>) => w.thumbColor?.resolve(s) ?? widgetThumb(s) ?? style.thumbColor?.resolve(s) ?? null;
    const a = thumb(active), b = thumb(inactive), activeColor = a ?? defaults.thumbColor!.resolve(active)!, inactiveColor = b ?? defaults.thumbColor!.resolve(inactive)!;
    const activeTrackColor = w.trackColor?.resolve(active) ?? w.activeTrackColor ?? (e.applyCupertinoTheme ? e.cupertinoPrimary : style.trackColor?.resolve(active)) ?? widgetThumb(active)?.withAlpha(0x80) ?? defaults.trackColor!.resolve(active)!;
    const inactiveTrackColor = w.trackColor?.resolve(inactive) ?? w.inactiveTrackColor ?? style.trackColor?.resolve(inactive) ?? defaults.trackColor!.resolve(inactive)!;
    const activeIcon = w.thumbIcon?.resolve(active) ?? style.thumbIcon?.resolve(active) ?? null, inactiveIcon = w.thumbIcon?.resolve(inactive) ?? style.thumbIcon?.resolve(inactive) ?? null;
    const focused = copy(states, undefined, WidgetState.focused), hovered = copy(states, undefined, WidgetState.hovered), pressedActive = copy(active, undefined, WidgetState.pressed), pressedInactive = copy(inactive, undefined, WidgetState.pressed);
    return {
        activeColor, inactiveColor, activeTrackColor, inactiveTrackColor,
        activePressedColor: thumb(pressedActive) ?? defaults.thumbColor!.resolve(pressedActive)!, inactivePressedColor: thumb(pressedInactive) ?? defaults.thumbColor!.resolve(pressedInactive)!,
        activeOutline: w.trackOutlineColor?.resolve(active) ?? style.trackOutlineColor?.resolve(active) ?? defaults.trackOutlineColor?.resolve(active) ?? null,
        inactiveOutline: w.trackOutlineColor?.resolve(inactive) ?? style.trackOutlineColor?.resolve(inactive) ?? defaults.trackOutlineColor?.resolve(inactive) ?? null,
        activeOutlineWidth: double(w.trackOutlineWidth?.resolve(active) ?? style.trackOutlineWidth?.resolve(active) ?? defaults.trackOutlineWidth?.resolve(active)),
        inactiveOutlineWidth: double(w.trackOutlineWidth?.resolve(inactive) ?? style.trackOutlineWidth?.resolve(inactive) ?? defaults.trackOutlineWidth?.resolve(inactive)),
        activeIcon, inactiveIcon, activeIconColor: activeIcon?.color ?? e.iconColor(active), inactiveIconColor: inactiveIcon?.color ?? e.iconColor(inactive),
        activeRadius: activeIcon === null ? config.activeRadius : config.iconRadius,
        inactiveRadius: inactiveIcon === null && w.inactiveThumbImage === null ? config.inactiveRadius : config.iconRadius,
        focusColor: w.overlayColor?.resolve(focused) ?? w.focusColor ?? style.overlayColor?.resolve(focused) ?? (e.applyCupertinoTheme ? HSLColor.fromColor(e.cupertinoPrimary.withOpacity(.8)).withLightness(.69).withSaturation(.835).toColor() : null) ?? defaults.overlayColor!.resolve(focused)!,
        hoverColor: w.overlayColor?.resolve(hovered) ?? w.hoverColor ?? style.overlayColor?.resolve(hovered) ?? defaults.overlayColor!.resolve(hovered)!,
        activeReaction: w.overlayColor?.resolve(pressedActive) ?? style.overlayColor?.resolve(pressedActive) ?? a?.withAlpha(0x1f) ?? defaults.overlayColor!.resolve(pressedActive)!,
        inactiveReaction: w.overlayColor?.resolve(pressedInactive) ?? style.overlayColor?.resolve(pressedInactive) ?? b?.withAlpha(0x1f) ?? defaults.overlayColor!.resolve(pressedInactive)!,
        splashRadius: w.splashRadius ?? style.splashRadius ?? defaults.splashRadius!
    };
}
export function resolveSwitchCursor(w: Switch, e: SwitchEnvironment, states: DartSet<WidgetState>): MouseCursor {
    return w.mouseCursor instanceof WidgetStateMouseCursor ? w.mouseCursor.resolve(states) : w.mouseCursor ?? e.style.mouseCursor?.resolve(states) ?? (e.config.isCupertino ? WidgetStateMouseCursor.adaptiveClickable.resolve(states) : e.defaults.mouseCursor!.resolve(states)!);
}
