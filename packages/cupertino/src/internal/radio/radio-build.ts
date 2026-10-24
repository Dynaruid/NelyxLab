// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Doroti Widget/default/paint responsibility split; shared typed registry and input belong to Core.
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import { RawRadio, RadioGroup } from '@nelyx/core/framework/widgets/radio-group';
import { CustomPaint } from '@nelyx/core/framework/widgets/custom-paint';
import { WidgetState } from '@nelyx/core/framework/widgets/widget-state';
import type { DartSet } from '@nelyx/core/foundation/dart-collections';
import { HSLColor } from '@nelyx/core/framework/painting/colors';
import { invariant } from '@nelyx/core/foundation/errors';
import { WidgetStateMouseCursor } from '@nelyx/core/framework/widgets/widget-state-mouse-cursor';
import type { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { CupertinoTheme } from '../../theme.ts';
import { CupertinoDynamicColor, CupertinoColors } from '../../colors.ts';
import type { CupertinoRadio } from '../../radio.ts';
import { _size, _kDisabledOuterColor, _kDisabledInnerColor, _kDisabledBorderColor, _kDefaultBorderColor, _kDefaultInnerColor, _kDefaultOuterColor } from '../../generated/radio/radio-defaults.generated.ts';
// These three source constants already have one verified common focus-data owner.
import { kCupertinoFocusColorOpacity, kCupertinoFocusColorBrightness, kCupertinoFocusColorSaturation } from '../../generated/checkbox/checkbox-defaults.generated.ts';
import { CupertinoRadioPainter } from './radio-painter.ts';
import type { CupertinoRadioPaintValues } from './radio-painter.ts';

export function resolveCupertinoRadio<T>(w: CupertinoRadio<T>, context: BuildContext, states: DartSet<WidgetState>): CupertinoRadioPaintValues {
    const disabled = states.contains(WidgetState.disabled), selected = states.contains(WidgetState.selected), resolve = (color: Parameters<typeof CupertinoDynamicColor.resolve>[0]) => CupertinoDynamicColor.resolve(color, context);
    const activeColor = disabled ? _kDisabledOuterColor : w.activeColor === null ? resolve(_kDefaultOuterColor) : resolve(w.activeColor);
    const inactiveColor = disabled ? _kDisabledOuterColor : w.inactiveColor === null ? CupertinoColors.white : resolve(w.inactiveColor);
    const fillColor = selected ? w.fillColor === null ? resolve(disabled ? _kDisabledInnerColor : _kDefaultInnerColor) : resolve(w.fillColor) : CupertinoColors.white;
    const borderColor = (selected || states.contains(WidgetState.focused)) && !disabled ? CupertinoColors.transparent : resolve(disabled ? _kDisabledBorderColor : _kDefaultBorderColor);
    return { activeColor, inactiveColor, fillColor, borderColor, focusColor: w.focusColor === null ? HSLColor.fromColor(activeColor.withOpacity(kCupertinoFocusColorOpacity)).withLightness(kCupertinoFocusColorBrightness).withSaturation(kCupertinoFocusColorSaturation).toColor() : resolve(w.focusColor), brightness: CupertinoTheme.of(context).specifiedBrightness, isActive: !disabled };
}
export function buildCupertinoRadio<T>(w: CupertinoRadio<T>, context: BuildContext, focusNode: FocusNode): Widget {
    const options = w.options, registry = options.groupRegistry ?? (options.groupToken === undefined ? null : RadioGroup.maybeOf<T>(context, options.groupToken));
    const enabled = w.enabled ?? registry !== null;
    invariant(!enabled || registry !== null, 'missing-radio-registry', 'Enabled CupertinoRadio needs a typed RadioGroup ancestor or an explicit registry');
    const { key: _, semanticLabel, id, activeColor, inactiveColor, fillColor, focusColor, useCheckmarkStyle, mouseCursor, enabled: __, ...interaction } = options;
    return new RawRadio({
        ...interaction, enabled, focusNode, motion: 'source', mouseCursorResolver: states => w.mouseCursor instanceof WidgetStateMouseCursor ? w.mouseCursor.resolve(states) : w.mouseCursor ?? WidgetStateMouseCursor.adaptiveClickable.resolve(states),
        semantics: { label: semanticLabel ?? null, identifier: id ?? null, transportId: id ?? null },
        builder: (context, state, selected, _position, motion) => new CustomPaint(undefined, { size: _size, painter: new CupertinoRadioPainter({ ...resolveCupertinoRadio(w, context, state.states), selected, checkmarkStyle: w.useCheckmarkStyle, downPosition: motion.downPosition, isFocused: state.focusNode.hasFocus }) })
    });
}
