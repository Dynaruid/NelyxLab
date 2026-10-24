// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Full selected pinned M3 default getter decisions; Material2 is excluded.
import type { BuildContext } from '@nelyx/core/framework/widgets/framework';
import { Color } from '@nelyx/core/ui/color';
import { constSourceColor, sourceColorType, captureSourceColor } from '@nelyx/core/ui/color-source';
import { WidgetState, WidgetStateProperty } from '@nelyx/core/framework/widgets/widget-state';
import type { DartSet } from '@nelyx/core/foundation/dart-collections';
import { WidgetStateBorderSide } from '@nelyx/core/framework/widgets/widget-state-border-side';
import { WidgetStateMouseCursor, sourceMouseCursorType } from '@nelyx/core/framework/widgets/widget-state-mouse-cursor';
import { BorderSide, withSourceBorderSideColor } from '@nelyx/core/framework/painting/borders';
import { RoundedRectangleBorder } from '@nelyx/core/framework/painting/rounded-rectangle-border';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { nullableDartType, dartDoubleType } from '@nelyx/core/foundation/dart-type-witness';
import { DartDouble } from '@nelyx/core/foundation/dart-numeric';
import { sourceConstWidgetStatePropertyAll } from '@nelyx/core/internal/framework/widgets/widget-state.generated';
import { Theme } from "../../theme.ts";
import { VisualDensity } from "../../theme-data.ts";
import { CheckboxThemeData, RadioThemeData, SwitchThemeData } from "../../generated/theme/toggle-theme-data.generated.ts";
const transparent = constSourceColor(Color, 0), radius = BorderRadius.circular(2);
for (const corner of [radius.topLeft, radius.topRight, radius.bottomLeft, radius.bottomRight])
    Object.freeze(corner);
Object.freeze(radius);
const checkboxShape = Object.freeze(new RoundedRectangleBorder({ borderRadius: radius })), switchPadding = EdgeInsets.symmetric({ horizontal: 4 }), trackOutlineWidth = sourceConstWidgetStatePropertyAll(dartDoubleType, DartDouble.fromSource(2));
Object.freeze(switchPadding);
const property = (resolve: (states: DartSet<WidgetState>) => Color | null) => WidgetStateProperty.resolveWith<Color | null>(nullableDartType(sourceColorType), states => {
    const value = resolve(states);
    return value === null ? null : captureSourceColor(value);
});
export function checkboxDefaultsM3(context: BuildContext): CheckboxThemeData {
    const theme = Theme.of(context), c = theme.colorScheme, onSurface = new Color(c.onSurface), side = WidgetStateBorderSide.resolveWith(states => {
        if (states.contains(WidgetState.disabled))
            return states.contains(WidgetState.selected) ? new BorderSide({ width: 2, color: 0 }) : withSourceBorderSideColor(new BorderSide({ width: 2 }), onSurface.withOpacity(.38));
        if (states.contains(WidgetState.selected))
            return new BorderSide({ width: 0, color: 0 });
        return withSourceBorderSideColor(new BorderSide({ width: 2 }), new Color(states.contains(WidgetState.error) ? c.error : states.contains(WidgetState.pressed) || states.contains(WidgetState.hovered) || states.contains(WidgetState.focused) ? c.onSurface : c.onSurfaceVariant));
    });
    return new CheckboxThemeData({
        side, fillColor: property(s => s.contains(WidgetState.disabled) ? s.contains(WidgetState.selected) ? onSurface.withOpacity(.38) : transparent : s.contains(WidgetState.selected) ? new Color(s.contains(WidgetState.error) ? c.error : c.primary) : transparent), checkColor: property(s => s.contains(WidgetState.disabled) ? s.contains(WidgetState.selected) ? new Color(c.surface) : transparent : s.contains(WidgetState.selected) ? new Color(s.contains(WidgetState.error) ? c.onError : c.onPrimary) : transparent), overlayColor: property(s => {
            if (s.contains(WidgetState.error)) {
                if (s.contains(WidgetState.pressed))
                    return new Color(c.error).withOpacity(.1);
                if (s.contains(WidgetState.hovered))
                    return new Color(c.error).withOpacity(.08);
                if (s.contains(WidgetState.focused))
                    return new Color(c.error).withOpacity(.1);
            }
            if (s.contains(WidgetState.selected)) {
                if (s.contains(WidgetState.pressed))
                    return onSurface.withOpacity(.1);
                if (s.contains(WidgetState.hovered))
                    return new Color(c.primary).withOpacity(.08);
                if (s.contains(WidgetState.focused))
                    return new Color(c.primary).withOpacity(.1);
                return transparent;
            }
            if (s.contains(WidgetState.pressed))
                return new Color(c.primary).withOpacity(.1);
            if (s.contains(WidgetState.hovered))
                return onSurface.withOpacity(.08);
            if (s.contains(WidgetState.focused))
                return onSurface.withOpacity(.1);
            return transparent;
        }), splashRadius: 20, materialTapTargetSize: theme.materialTapTargetSize, visualDensity: VisualDensity.standard, shape: checkboxShape
    });
}
export function radioDefaultsM3(context: BuildContext): RadioThemeData {
    const theme = Theme.of(context), c = theme.colorScheme, onSurface = new Color(c.onSurface);
    return new RadioThemeData({
        fillColor: property(s => s.contains(WidgetState.disabled) ? onSurface.withOpacity(.38) : new Color(s.contains(WidgetState.selected) ? c.primary : s.contains(WidgetState.pressed) || s.contains(WidgetState.hovered) || s.contains(WidgetState.focused) ? c.onSurface : c.onSurfaceVariant)), overlayColor: property(s => {
            if (s.contains(WidgetState.selected)) {
                if (s.contains(WidgetState.pressed))
                    return onSurface.withOpacity(.1);
                if (s.contains(WidgetState.hovered))
                    return new Color(c.primary).withOpacity(.08);
                if (s.contains(WidgetState.focused))
                    return new Color(c.primary).withOpacity(.1);
                return transparent;
            }
            if (s.contains(WidgetState.pressed))
                return new Color(c.primary).withOpacity(.1);
            if (s.contains(WidgetState.hovered))
                return onSurface.withOpacity(.08);
            if (s.contains(WidgetState.focused))
                return onSurface.withOpacity(.1);
            return transparent;
        }), materialTapTargetSize: theme.materialTapTargetSize, visualDensity: theme.visualDensity, backgroundColor: property(() => transparent)
    });
}
export function switchDefaultsM3(context: BuildContext): SwitchThemeData {
    const c = Theme.of(context).colorScheme;
    return new SwitchThemeData({
        thumbColor: property(s => s.contains(WidgetState.disabled) ? new Color(s.contains(WidgetState.selected) ? c.surface : c.onSurface).withOpacity(s.contains(WidgetState.selected) ? 1 : .38) : new Color(s.contains(WidgetState.selected) ? s.contains(WidgetState.pressed) || s.contains(WidgetState.hovered) || s.contains(WidgetState.focused) ? c.primaryContainer : c.onPrimary : s.contains(WidgetState.pressed) || s.contains(WidgetState.hovered) || s.contains(WidgetState.focused) ? c.onSurfaceVariant : c.outline)), trackColor: property(s => s.contains(WidgetState.disabled) ? new Color(s.contains(WidgetState.selected) ? c.onSurface : c.surfaceContainerHighest).withOpacity(.12) : new Color(s.contains(WidgetState.selected) ? c.primary : c.surfaceContainerHighest)), trackOutlineColor: property(s => s.contains(WidgetState.selected) ? transparent : s.contains(WidgetState.disabled) ? new Color(c.onSurface).withOpacity(.12) : new Color(c.outline)), overlayColor: property(s => {
            const color = new Color(s.contains(WidgetState.selected) ? c.primary : c.onSurface);
            if (s.contains(WidgetState.pressed))
                return color.withOpacity(.1);
            if (s.contains(WidgetState.hovered))
                return color.withOpacity(.08);
            if (s.contains(WidgetState.focused))
                return color.withOpacity(.1);
            return null;
        }), mouseCursor: WidgetStateProperty.resolveWith(nullableDartType(sourceMouseCursorType), s => WidgetStateMouseCursor.clickable.resolve(s)), trackOutlineWidth, splashRadius: 20, padding: switchPadding
    });
}
