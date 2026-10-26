// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Doroti radio Widget/paint responsibility split, pinned Flutter M3 policy on Nelyx Core.
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import { CupertinoRadio } from '@nelyx/cupertino/radio';
import { RawRadio, RadioGroup } from '@nelyx/core/framework/widgets/radio-group';
import { CustomPaint } from '@nelyx/core/framework/widgets/custom-paint';
import { WidgetState } from '@nelyx/core/framework/widgets/widget-state';
import { emptyWidgetStateSet } from '@nelyx/core/framework/widgets/widget-state';
import { WidgetStateBorderSide } from '@nelyx/core/framework/widgets/widget-state-border-side';
import { WidgetStateMouseCursor } from '@nelyx/core/framework/widgets/widget-state-mouse-cursor';
import type { DartSet } from '@nelyx/core/foundation/dart-collections';
import { BorderSide } from '@nelyx/core/framework/painting/borders';
import type { MouseCursor } from '@nelyx/core/services/mouse-cursor';
import type { Color } from '@nelyx/core/ui/color';
import { invariant } from '@nelyx/core/foundation/errors';
import { DartDouble } from '@nelyx/core/foundation/dart-numeric';
import type { RadioOptions } from '../../radio.ts';
import { RadioTheme } from '../../radio-theme.ts';
import { Theme } from '../../theme.ts';
import type { RadioThemeData } from '../../radio-theme.ts';
import { MaterialTapTargetSize } from '../../theme-data.ts';
import { radioDefaultsM3 } from '../toggle/toggle-defaults.ts';
import { RadioPainter } from './radio-painter.ts';
import type { RadioPaintValues } from './radio-painter.ts';

function copy(states: DartSet<WidgetState>, add?: WidgetState, remove?: WidgetState): DartSet<WidgetState> {
    const result = emptyWidgetStateSet();
    for (const state of states) if (state !== remove) result.add(state);
    if (add !== undefined) result.add(add);
    return result;
}
function resolveSide(side: BorderSide | null | undefined, states: DartSet<WidgetState>): BorderSide | null {
    return side instanceof WidgetStateBorderSide ? side.resolve(states) : states.contains(WidgetState.selected) ? null : side ?? null;
}
export function resolveRadioPaint<T>(w: RadioOptions<T>, theme: RadioThemeData, defaults: RadioThemeData, states: DartSet<WidgetState>, down: boolean): RadioPaintValues {
    const active = copy(states, WidgetState.selected), inactive = copy(states, undefined, WidgetState.selected);
    const fill = (s: DartSet<WidgetState>): Color | null => w.fillColor?.resolve(s) ?? (!s.contains(WidgetState.disabled) && s.contains(WidgetState.selected) ? w.activeColor : null) ?? theme.fillColor?.resolve(s) ?? null;
    const a = fill(active), b = fill(inactive), activeColor = a ?? defaults.fillColor!.resolve(active)!, inactiveColor = b ?? defaults.fillColor!.resolve(inactive)!;
    const activeBackgroundColor = w.backgroundColor?.resolve(active) ?? theme.backgroundColor?.resolve(active) ?? defaults.backgroundColor!.resolve(active)!;
    const inactiveBackgroundColor = w.backgroundColor?.resolve(inactive) ?? theme.backgroundColor?.resolve(inactive) ?? defaults.backgroundColor!.resolve(inactive)!;
    const activeSide = resolveSide(w.side, active) ?? resolveSide(theme.side, active) ?? new BorderSide({ width: 2, color: activeColor.toARGB32(), strokeAlign: BorderSide.strokeAlignCenter });
    const inactiveSide = resolveSide(w.side, inactive) ?? resolveSide(theme.side, inactive) ?? new BorderSide({ width: 2, color: inactiveColor.toARGB32(), strokeAlign: BorderSide.strokeAlignCenter });
    const focused = copy(states, WidgetState.focused), hovered = copy(states, WidgetState.hovered);
    let focusColor = w.overlayColor?.resolve(focused) ?? w.focusColor ?? theme.overlayColor?.resolve(focused) ?? defaults.overlayColor!.resolve(focused)!;
    let hoverColor = w.overlayColor?.resolve(hovered) ?? w.hoverColor ?? theme.overlayColor?.resolve(hovered) ?? defaults.overlayColor!.resolve(hovered)!;
    const pressedActive = copy(active, WidgetState.pressed), pressedInactive = copy(inactive, WidgetState.pressed);
    const activeReactionColor = w.overlayColor?.resolve(pressedActive) ?? theme.overlayColor?.resolve(pressedActive) ?? a?.withAlpha(0x1f) ?? defaults.overlayColor!.resolve(pressedActive)!;
    const inactiveReactionColor = w.overlayColor?.resolve(pressedInactive) ?? theme.overlayColor?.resolve(pressedInactive) ?? b?.withAlpha(0x1f) ?? defaults.overlayColor!.resolve(pressedInactive)!;
    if (down) focusColor = hoverColor = states.contains(WidgetState.selected) ? activeReactionColor : inactiveReactionColor;
    const inner = w.innerRadius?.resolve(active) ?? theme.innerRadius?.resolve(active) ?? null;
    invariant(inner === null || DartDouble.is(inner), 'invalid-radio-inner-radius-type', 'Radio innerRadius requires retained DartDouble provenance');
    const innerRadius = inner?.value ?? 4.5;
    invariant(Number.isFinite(innerRadius) && innerRadius >= 0, 'invalid-radio-inner-radius', 'Radio innerRadius must resolve a finite nonnegative double');
    return { activeColor, inactiveColor, activeBackgroundColor, inactiveBackgroundColor, activeSide, inactiveSide, focusColor, hoverColor, activeReactionColor, inactiveReactionColor, innerRadius, splashRadius: w.splashRadius ?? theme.splashRadius ?? 20 };
}
export function resolveRadioCursor<T>(w: RadioOptions<T>, theme: RadioThemeData, states: DartSet<WidgetState>): MouseCursor {
    return w.mouseCursor instanceof WidgetStateMouseCursor ? w.mouseCursor.resolve(states) : w.mouseCursor ?? theme.mouseCursor?.resolve(states) ?? WidgetStateMouseCursor.adaptiveClickable.resolve(states);
}
export function buildMaterialRadio<T>(w: RadioOptions<T>, context: BuildContext, adaptive = false, useCupertinoCheckmarkStyle = false): Widget {
    if (adaptive && ['iOS', 'macOS'].includes(Theme.of(context).platform)) {
        const { key: _, semanticLabel, id, mouseCursor, activeColor, fillColor, focusColor, hoverColor, overlayColor, splashRadius, materialTapTargetSize, visualDensity, backgroundColor, side, innerRadius, ...interaction } = w;
        return new CupertinoRadio({ ...interaction, ...(id === undefined ? {} : { id }), semanticLabel: semanticLabel ?? null, mouseCursor: mouseCursor ?? null, activeColor: activeColor ?? null, focusColor: focusColor ?? null, useCheckmarkStyle: useCupertinoCheckmarkStyle });
    }
    const theme = RadioTheme.of(context), defaults = radioDefaultsM3(context);
    const registry = w.groupRegistry ?? (w.groupToken === undefined ? null : RadioGroup.maybeOf<T>(context, w.groupToken));
    const enabled = w.enabled ?? registry !== null;
    invariant(!enabled || registry !== null, 'missing-radio-registry', 'Enabled Radio needs a typed RadioGroup ancestor or an explicit registry');
    const target = w.materialTapTargetSize ?? theme.materialTapTargetSize ?? defaults.materialTapTargetSize!, density = w.visualDensity ?? theme.visualDensity ?? defaults.visualDensity!, base = target === MaterialTapTargetSize.padded ? 48 : 40;
    const { key: _, semanticLabel, id, mouseCursor, enabled: __, activeColor, fillColor, focusColor, hoverColor, overlayColor, splashRadius, materialTapTargetSize, visualDensity, backgroundColor, side, innerRadius, ...interaction } = w;
    return new RawRadio({
        ...interaction, enabled, motion: 'source', mouseCursorResolver: states => resolveRadioCursor(w, theme, states),
        semantics: { label: semanticLabel ?? null, identifier: id ?? null, transportId: id ?? null },
        builder: (_context, state, _selected, position, motion) => new CustomPaint(undefined, {
            size: { width: base + density.baseSizeAdjustment.dx, height: base + density.baseSizeAdjustment.dy },
            painter: new RadioPainter({ ...resolveRadioPaint(w, theme, defaults, state.states, motion.downPosition !== null), ...motion, position, isFocused: state.states.contains(WidgetState.focused), isHovered: state.states.contains(WidgetState.hovered) })
        })
    });
}
