// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { Color } from '@nelyx/core/ui/color';
import { captureSourceColor } from '@nelyx/core/ui/color-source';
import { WidgetState, WidgetStateColor } from '@nelyx/core/framework/widgets/widget-state';
import type { DartSet } from '@nelyx/core/foundation/dart-collections';
import { emptyWidgetStateSet } from '@nelyx/core/framework/widgets/widget-state';
import type { BuildContext } from '@nelyx/core/framework/widgets/framework';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { MouseCursor, SystemMouseCursors } from '@nelyx/core/services/mouse-cursor';
import { DartDouble } from '@nelyx/core/foundation/dart-numeric';
import { HSLColor } from '@nelyx/core/framework/painting/colors';
import { Curves } from '@nelyx/core/framework/animation/curves';
import { BoxShadow } from '@nelyx/core/framework/painting/box-shadow';
import { Offset } from '@nelyx/core/ui/offset';
import { Size } from '@nelyx/core/ui/size';
import type { SwitchConfig, SwitchPaintValues } from '@nelyx/core/internal/framework/widgets/switch-painter';
import { CupertinoColors, CupertinoDynamicColor } from '../../colors.ts';
import { CupertinoTheme } from '../../theme.ts';
import { coreCupertinoColor, resolveCupertinoColor } from '../colors/color-values.ts';
import type { CupertinoColor } from '../colors/color-values.ts';
import type { CupertinoSwitch } from '../../switch.ts';
/** @dartType double */ export const disabledOpacity = .5;
/** @dartType double */ export const trackWidth = 51;
/** @dartType double */ export const trackHeight = 31;
export const switchSize = new Size(59, 39);
const shadows = Object.freeze([new BoxShadow({ color: 0x26000000, offset: new Offset(0, 3), blurRadius: 8 }), new BoxShadow({ color: 0x0f000000, offset: new Offset(0, 3), blurRadius: 1 })]);
export const switchConfig: SwitchConfig = Object.freeze({ isCupertino: true, trackWidth, trackHeight, activeRadius: 14, inactiveRadius: 14, pressedRadius: 14, iconRadius: 14, transitionalWidth: 28, transitionalHeight: 28, shadows, motion: Object.freeze({ duration: 200, reactionDuration: 300, curve: Curves.ease, reverseCurve: Curves.ease.flipped, colorCurve: Curves.easeOut, colorReverseCurve: Curves.easeIn }) });
const offLabelColor = CupertinoDynamicColor.withBrightnessAndContrast({ debugLabel: 'offSwitchLabel', color: captureSourceColor(new Color(0xffb3b3b3)), darkColor: captureSourceColor(new Color(0xffb3b3b3)), highContrastColor: captureSourceColor(new Color(0xffffffff)), darkHighContrastColor: captureSourceColor(new Color(0xffffffff)) });
const copy = (states: DartSet<WidgetState>, selected: boolean, pressed = false) => { const result = emptyWidgetStateSet(); for (const s of states)
    if (s !== WidgetState.selected)
        result.add(s); if (selected)
    result.add(WidgetState.selected); if (pressed)
    result.add(WidgetState.pressed); return result; };
const raw = (value: CupertinoColor | null): Color | null => value === null ? null : coreCupertinoColor(value);
const stateColor = (value: CupertinoColor | null, states: DartSet<WidgetState>): Color | null => { const color = raw(value); return color instanceof WidgetStateColor ? color.resolve(states) : color; };
function outline(value: DartDouble | null | undefined): number | null { if (value == null)
    return null; if (!DartDouble.is(value))
    throw new TypeError('Cupertino switch outline requires retained DartDouble provenance'); if (!Number.isFinite(value.value) || value.value < 0)
    throw new RangeError('Cupertino switch outline must be finite and nonnegative'); return value.value; }
export interface CupertinoSwitchPaint extends SwitchPaintValues {
    readonly surface: Color;
    readonly labels: {
        readonly on: Color;
        readonly off: Color;
    } | null;
}
export function resolveCupertinoSwitchPaint(w: CupertinoSwitch, context: BuildContext, states: DartSet<WidgetState>): CupertinoSwitchPaint {
    const theme = CupertinoTheme.of(context), active = copy(states, true), inactive = copy(states, false), pressedActive = copy(states, true, true), pressedInactive = copy(states, false, true), activeTrack = resolveCupertinoColor(w.activeTrackColor ?? ((w.applyTheme ?? theme.applyThemeToAll) ? theme.primaryColor : null) ?? CupertinoColors.systemGreen, context);
    const activeThumb = stateColor(w.thumbColor, active) ?? raw(w.thumbColor) ?? coreCupertinoColor(CupertinoColors.white), inactiveThumb = stateColor(w.inactiveThumbColor, inactive) ?? raw(w.inactiveThumbColor) ?? activeThumb;
    const activeIcon = w.thumbIcon?.resolve(active) ?? null, inactiveIcon = w.thumbIcon?.resolve(inactive) ?? null, transparent = new Color(0);
    return { activeColor: activeThumb, inactiveColor: inactiveThumb, activePressedColor: stateColor(w.thumbColor, pressedActive) ?? raw(w.thumbColor) ?? coreCupertinoColor(CupertinoColors.white), inactivePressedColor: stateColor(w.thumbColor, pressedInactive) ?? raw(w.inactiveThumbColor) ?? coreCupertinoColor(CupertinoColors.white), activeTrackColor: raw(w.activeTrackColor) ?? activeTrack, inactiveTrackColor: stateColor(w.inactiveTrackColor, inactive) ?? resolveCupertinoColor(CupertinoColors.secondarySystemFill, context), activeOutline: w.trackOutlineColor?.resolve(active) ?? null, inactiveOutline: w.trackOutlineColor?.resolve(inactive) ?? null, activeOutlineWidth: outline(w.trackOutlineWidth?.resolve(active)), inactiveOutlineWidth: outline(w.trackOutlineWidth?.resolve(inactive)), activeIcon, inactiveIcon, activeIconColor: activeIcon?.color ?? coreCupertinoColor(CupertinoColors.black), inactiveIconColor: inactiveIcon?.color ?? coreCupertinoColor(CupertinoColors.black), activeRadius: 14, inactiveRadius: 14, activeReaction: transparent, inactiveReaction: transparent, focusColor: resolveCupertinoColor(w.focusColor ?? HSLColor.fromColor(activeTrack.withOpacity(.8)).withLightness(.69).withSaturation(.835).toColor(), context), hoverColor: transparent, splashRadius: 0, surface: coreCupertinoColor(theme.scaffoldBackgroundColor), labels: MediaQuery.of(context).onOffSwitchLabels ? { on: resolveCupertinoColor(w.onLabelColor ?? CupertinoColors.white, context), off: resolveCupertinoColor(w.offLabelColor ?? offLabelColor, context) } : null };
}
export function resolveCupertinoSwitchCursor(w: CupertinoSwitch, states: DartSet<WidgetState>): MouseCursor { return w.mouseCursor?.resolve(states) ?? (states.contains(WidgetState.disabled) ? MouseCursor.defer : FoundationPlatform.hostEnvironment.kind === 'web' ? SystemMouseCursors.click : MouseCursor.defer); }
