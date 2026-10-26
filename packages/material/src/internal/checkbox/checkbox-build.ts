// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { CupertinoCheckbox } from '@nelyx/cupertino/checkbox';
import { Theme } from "../../theme.ts";
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import { ToggleableControl } from '@nelyx/core/framework/widgets/toggleable-control';
import { CustomPaint } from '@nelyx/core/framework/widgets/custom-paint';
import { WidgetState } from '@nelyx/core/framework/widgets/widget-state';
import { emptyWidgetStateSet } from '@nelyx/core/framework/widgets/widget-state';
import { WidgetStateBorderSide } from '@nelyx/core/framework/widgets/widget-state-border-side';
import { WidgetStateMouseCursor } from '@nelyx/core/framework/widgets/widget-state-mouse-cursor';
import type { DartSet } from '@nelyx/core/foundation/dart-collections';
import type { BorderSide } from '@nelyx/core/framework/painting/borders';
import type { MouseCursor } from '@nelyx/core/services/mouse-cursor';
import type { Color } from '@nelyx/core/ui/color';
import { invariant } from '@nelyx/core/foundation/errors';
import type { Checkbox } from "../../checkbox.ts";
import type { CheckboxThemeData } from "../../checkbox-theme.ts";
import { CheckboxTheme } from "../../checkbox-theme.ts";
import { checkboxDefaultsM3 } from "../toggle/toggle-defaults.ts";
import { MaterialTapTargetSize } from "../../theme-data.ts";
import { CheckboxPainter } from './checkbox-painter.ts';
import type { CheckboxPaintValues } from './checkbox-painter.ts';
function copy(states: DartSet<WidgetState>): DartSet<WidgetState> {
    const result = emptyWidgetStateSet();
    for (const s of states)
        result.add(s);
    return result;
}
function resolveSide(side: BorderSide | null, states: DartSet<WidgetState>): BorderSide | null {
    return side instanceof WidgetStateBorderSide ? side.resolve(states) : states.contains(WidgetState.selected) ? null : side;
}
export function resolveCheckboxPaint(w: Checkbox, theme: CheckboxThemeData, defaults: CheckboxThemeData, states: DartSet<WidgetState>, down: boolean): CheckboxPaintValues {
    const active = copy(states), inactive = copy(states);
    active.add(WidgetState.selected);
    inactive.remove(WidgetState.selected);
    if (w.isError) {
        active.add(WidgetState.error);
        inactive.add(WidgetState.error);
    }
    const fill = (s: DartSet<WidgetState>): Color | null => w.fillColor?.resolve(s) ?? (!s.contains(WidgetState.disabled) && s.contains(WidgetState.selected) ? w.activeColor : null) ?? theme.fillColor?.resolve(s) ?? null, a = fill(active), b = fill(inactive), activeColor = a ?? defaults.fillColor!.resolve(active)!, inactiveColor = b ?? defaults.fillColor!.resolve(inactive)!;
    const activeSide = resolveSide(w.side, active) ?? resolveSide(theme.side, active) ?? resolveSide(defaults.side, active)!, inactiveSide = resolveSide(w.side, inactive) ?? resolveSide(theme.side, inactive) ?? resolveSide(defaults.side, inactive)!;
    const focused = copy(states), hovered = copy(states);
    focused.add(WidgetState.focused);
    hovered.add(WidgetState.hovered);
    if (w.isError) {
        focused.add(WidgetState.error);
        hovered.add(WidgetState.error);
    }
    let focusColor = w.overlayColor?.resolve(focused) ?? w.focusColor ?? theme.overlayColor?.resolve(focused) ?? defaults.overlayColor!.resolve(focused)!, hoverColor = w.overlayColor?.resolve(hovered) ?? w.hoverColor ?? theme.overlayColor?.resolve(hovered) ?? defaults.overlayColor!.resolve(hovered)!;
    active.add(WidgetState.pressed);
    inactive.add(WidgetState.pressed);
    const activeReactionColor = w.overlayColor?.resolve(active) ?? theme.overlayColor?.resolve(active) ?? a?.withAlpha(0x1f) ?? defaults.overlayColor!.resolve(active)!, inactiveReactionColor = w.overlayColor?.resolve(inactive) ?? theme.overlayColor?.resolve(inactive) ?? b?.withAlpha(0x1f) ?? defaults.overlayColor!.resolve(inactive)!;
    if (down)
        focusColor = hoverColor = states.contains(WidgetState.selected) ? activeReactionColor : inactiveReactionColor;
    const checkStates = copy(states);
    if (w.isError)
        checkStates.add(WidgetState.error);
    return {
        activeColor, inactiveColor, activeSide, inactiveSide, focusColor, hoverColor, activeReactionColor, inactiveReactionColor, checkColor: w.checkColor ?? theme.checkColor?.resolve(checkStates) ?? defaults.checkColor!.resolve(checkStates)!, splashRadius: w.splashRadius ?? theme.splashRadius ?? defaults.splashRadius!, shape: w.shape ?? theme.shape ?? defaults.shape!
    };
}
export function resolveCheckboxCursor(w: Checkbox, theme: CheckboxThemeData, states: DartSet<WidgetState>): MouseCursor {
    return w.mouseCursor instanceof WidgetStateMouseCursor ? w.mouseCursor.resolve(states) : w.mouseCursor ?? theme.mouseCursor?.resolve(states) ?? WidgetStateMouseCursor.adaptiveClickable.resolve(states);
}
export function buildMaterialCheckbox(w: Checkbox, context: BuildContext, adaptive = false): Widget {
    if (adaptive && ['iOS', 'macOS'].includes(Theme.of(context).platform)) {
        const { key: _, id, value: __, tristate: ___, onChanged: ____, mouseCursor: _____, activeColor: ______, fillColor: _______, checkColor: ________, focusColor: _________, hoverColor: __________, overlayColor: ___________, splashRadius: ____________, materialTapTargetSize: _____________, visualDensity: ______________, shape: _______________, side: ________________, isError: _________________, semanticLabel: __________________, focusNode: ___________________, autofocus: ____________________, ...interaction } = w.options;
        return new CupertinoCheckbox({
            ...interaction, ...(id === undefined ? {} : { id }), value: w.value, tristate: w.tristate, onChanged: w.onChanged, mouseCursor: w.mouseCursor, activeColor: w.activeColor, checkColor: w.checkColor, focusColor: w.focusColor, focusNode: w.focusNode, autofocus: w.autofocus, side: w.side, shape: w.shape, semanticLabel: w.semanticLabel
        });
    }
    const style = CheckboxTheme.of(context), defaults = checkboxDefaultsM3(context), target = w.materialTapTargetSize ?? style.materialTapTargetSize ?? defaults.materialTapTargetSize!, density = w.visualDensity ?? style.visualDensity ?? defaults.visualDensity!, base = target === MaterialTapTargetSize.padded ? 48 : 40, adjustment = density.baseSizeAdjustment, options = w.options;
    invariant(w.splashRadius === null || Number.isFinite(w.splashRadius) && w.splashRadius >= 0, 'invalid-checkbox-radius', 'Checkbox splashRadius must be finite and nonnegative');
    const { key: _, value: __, tristate: ___, onChanged: ____, mouseCursor: _____, activeColor: ______, fillColor: _______, checkColor: ________, focusColor: _________, hoverColor: __________, overlayColor: ___________, splashRadius: ____________, materialTapTargetSize: _____________, visualDensity: ______________, shape: _______________, side: ________________, isError: _________________, semanticLabel: __________________, id: ___________________, ...interaction } = options;
    return new ToggleableControl({
        ...interaction, value: w.value, tristate: w.tristate, onChanged: w.onChanged, motion: 'source', mouseCursorResolver: states => resolveCheckboxCursor(w, style, states), semantics: {
            label: w.semanticLabel, identifier: options.id ?? null, transportId: options.id ?? null, checked: w.value === true, mixed: w.tristate ? w.value === null : null
        }, builder: (_context, state, position, motion) => new CustomPaint(undefined, { size: { width: base + adjustment.dx, height: base + adjustment.dy }, painter: new CheckboxPainter({
                ...resolveCheckboxPaint(w, style, defaults, state.states, motion.downPosition !== null), ...motion, value: w.value, position, isFocused: state.states.contains(WidgetState.focused), isHovered: state.states.contains(WidgetState.hovered)
            }) })
    });
}
