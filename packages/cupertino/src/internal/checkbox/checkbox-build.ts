// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import type { MouseCursor } from '@nelyx/core/services/mouse-cursor';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import { ToggleableControl } from '@nelyx/core/framework/widgets/toggleable-control';
import { CustomPaint } from '@nelyx/core/framework/widgets/custom-paint';
import { WidgetState } from '@nelyx/core/framework/widgets/widget-state';
import { WidgetStateBorderSide } from '@nelyx/core/framework/widgets/widget-state-border-side';
import { WidgetStateMouseCursor } from '@nelyx/core/framework/widgets/widget-state-mouse-cursor';
import { emptyWidgetStateSet } from '@nelyx/core/framework/widgets/widget-state';
import type { DartSet } from '@nelyx/core/foundation/dart-collections';
import { Color } from '@nelyx/core/ui/color';
import { Size } from '@nelyx/core/ui/size';
import { BorderSide, withSourceBorderSideColor } from '@nelyx/core/framework/painting/borders';
import { RoundedRectangleBorder } from '@nelyx/core/framework/painting/rounded-rectangle-border';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { HSLColor } from '@nelyx/core/framework/painting/colors';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { CupertinoTheme } from '../../theme.ts';
import { CupertinoColors, CupertinoDynamicColor } from '../../colors.ts';
import type { CupertinoCheckbox } from '../../checkbox.ts';
import { CupertinoCheckboxPainter } from './checkbox-painter.ts';
import type { CupertinoCheckboxPaintValues } from './checkbox-painter.ts';
import {
  _kDefaultFillColor,
  _kDisabledCheckColor,
  _kDefaultCheckColor,
  _kDefaultBorderColor,
  _kDisabledBorderColor,
  kCupertinoFocusColorOpacity,
  kCupertinoFocusColorBrightness,
  kCupertinoFocusColorSaturation,
  kMinInteractiveDimensionCupertino,
} from '../../generated/checkbox/checkbox-defaults.generated.ts';
const radius = BorderRadius.circular(4);
for (const r of [radius.topLeft, radius.topRight, radius.bottomLeft, radius.bottomRight])
  Object.freeze(r);
Object.freeze(radius);
const defaultShape = Object.freeze(new RoundedRectangleBorder({ borderRadius: radius }));
function copy(states: DartSet<WidgetState>): DartSet<WidgetState> {
  const result = emptyWidgetStateSet();
  for (const s of states) result.add(s);
  return result;
}
export function resolveCupertinoCheckbox(
  w: CupertinoCheckbox,
  context: BuildContext,
  states: DartSet<WidgetState>,
): CupertinoCheckboxPaintValues {
  const active = copy(states),
    inactive = copy(states);
  active.add(WidgetState.selected);
  inactive.remove(WidgetState.selected);
  const disabled = states.contains(WidgetState.disabled),
    selected = states.contains(WidgetState.selected),
    resolve = (color: Color) => CupertinoDynamicColor.resolve(color, context),
    defaultFill = (isSelected: boolean) =>
      disabled
        ? CupertinoColors.white.withOpacity(0.5)
        : isSelected
          ? (w.activeColor ?? resolve(_kDefaultFillColor))
          : CupertinoColors.white;
  const activeColor = w.fillColor?.resolve(active) ?? defaultFill(true),
    inactiveColor = w.fillColor?.resolve(inactive) ?? defaultFill(false),
    side =
      w.side instanceof WidgetStateBorderSide ? w.side.resolve(states) : selected ? null : w.side,
    effectiveSide =
      side ??
      ((selected || states.contains(WidgetState.focused)) && !disabled
        ? new BorderSide({ width: 0, color: 0 })
        : withSourceBorderSideColor(
            new BorderSide(),
            resolve(disabled ? _kDisabledBorderColor : _kDefaultBorderColor),
          ));
  return {
    activeColor,
    inactiveColor,
    checkColor:
      disabled && selected
        ? (w.checkColor ?? resolve(_kDisabledCheckColor))
        : selected
          ? (w.checkColor ?? resolve(_kDefaultCheckColor))
          : CupertinoColors.white,
    focusColor:
      w.focusColor ??
      HSLColor.fromColor(activeColor.withOpacity(kCupertinoFocusColorOpacity))
        .withLightness(kCupertinoFocusColorBrightness)
        .withSaturation(kCupertinoFocusColorSaturation)
        .toColor(),
    side: effectiveSide,
    shape: w.shape ?? defaultShape,
    brightness: CupertinoTheme.of(context).specifiedBrightness,
    isActive: w.onChanged !== null && (w.options.enabled ?? true),
  };
}
export function cupertinoCheckboxSize(w: CupertinoCheckbox): Size {
  if (w.tapTargetSize !== null) return w.tapTargetSize;
  return Size.square(
    ['iOS', 'android', 'fuchsia'].includes(FoundationPlatform.defaultTargetPlatform)
      ? kMinInteractiveDimensionCupertino
      : 14,
  );
}
export function cupertinoCheckboxCursor(
  w: CupertinoCheckbox,
  states: DartSet<WidgetState>,
): MouseCursor {
  return w.mouseCursor instanceof WidgetStateMouseCursor
    ? w.mouseCursor.resolve(states)
    : (w.mouseCursor ?? WidgetStateMouseCursor.adaptiveClickable.resolve(states));
}
export function buildCupertinoCheckbox(w: CupertinoCheckbox, context: BuildContext): Widget {
  const {
    key: _,
    id,
    value: __,
    tristate: ___,
    onChanged: ____,
    mouseCursor: _____,
    activeColor: ______,
    fillColor: _______,
    checkColor: ________,
    focusColor: _________,
    side: __________,
    shape: ___________,
    tapTargetSize: ____________,
    semanticLabel: _____________,
    ...interaction
  } = w.options;
  return new ToggleableControl({
    ...interaction,
    value: w.value,
    tristate: w.tristate,
    onChanged: w.onChanged,
    motion: 'source',
    animateValueChanges: false,
    mouseCursorResolver: (states) => cupertinoCheckboxCursor(w, states),
    semantics: {
      label: w.semanticLabel,
      identifier: id ?? null,
      transportId: id ?? null,
      checked: w.value === true,
      mixed: w.tristate ? w.value === null : null,
    },
    builder: (_context, state, _position, motion) =>
      new CustomPaint(undefined, {
        size: cupertinoCheckboxSize(w),
        painter: new CupertinoCheckboxPainter({
          ...resolveCupertinoCheckbox(w, context, state.states),
          value: w.value,
          downPosition: motion.downPosition,
          isFocused: state.states.contains(WidgetState.focused),
        }),
      }),
  });
}
