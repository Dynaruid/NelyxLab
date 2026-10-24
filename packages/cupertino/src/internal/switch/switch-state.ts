// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { State } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import { ToggleableControl } from '@nelyx/core/framework/widgets/toggleable-control';
import { SwitchPainter } from '@nelyx/core/internal/framework/widgets/switch-painter';
import { CustomPaint } from '@nelyx/core/framework/widgets/custom-paint';
import { Opacity } from '@nelyx/core/framework/widgets/opacity';
import { Directionality, Localizations } from '@nelyx/core/framework/widgets/app-data';
import { WidgetState } from '@nelyx/core/framework/widgets/widget-state';
import { IconTheme } from '@nelyx/core/framework/widgets/icon-theme';
import { createLocalImageConfiguration } from '@nelyx/core/framework/widgets/image';
import { ImageConfiguration } from '@nelyx/core/framework/painting/image-configuration';
import { HapticFeedback } from '@nelyx/core/services/haptic-feedback';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { resolveCupertinoSwitchPaint, resolveCupertinoSwitchCursor, switchConfig, switchSize, disabledOpacity, trackWidth } from './switch-values.ts';
import type { CupertinoSwitch } from '../../switch.ts';
export class CupertinoSwitchState extends State<CupertinoSwitch> {
    private readonly painter = new SwitchPainter();
    private vibration(context: BuildContext): void { const messenger = context.services.binaryMessenger ?? context.services.platformServices?.defaultBinaryMessenger; if (messenger && FoundationPlatform.defaultTargetPlatform === 'iOS')
        void HapticFeedback.lightImpact(messenger).catch(error => context.services.reportError?.(error)); }
    build(context: BuildContext): Widget {
        const w = this.widget, o = w.options, { key, id, semanticLabel, value, onChanged, activeTrackColor, inactiveTrackColor, thumbColor, inactiveThumbColor, focusColor, onLabelColor, offLabelColor, activeThumbImage, onActiveThumbImageError, inactiveThumbImage, onInactiveThumbImageError, trackOutlineColor, trackOutlineWidth, thumbIcon, mouseCursor, focusNode, onFocusChange, autofocus, applyTheme, dragStartBehavior, ...interaction } = o;
        const configuration = w.activeThumbImage !== null || w.inactiveThumbImage !== null ? createLocalImageConfiguration(context) : ImageConfiguration.empty;
        return new ToggleableControl({ ...interaction, value: w.value, onChanged: w.onChanged === null ? null : next => { if (next !== null) {
                w.onChanged!(next);
                this.vibration(context);
            } }, onSwitchDragValueChanged: () => this.vibration(context), onSwitchDragCommit: next => this.widget.onChanged?.(next), focusNode: w.focusNode, autofocus: w.autofocus, ...(w.onFocusChange === null ? {} : { onFocusChange: w.onFocusChange }), dragStartBehavior: w.dragStartBehavior, motion: 'source', motionProfile: switchConfig.motion, switchDrag: { policy: 'cupertino', extent: trackWidth, deferSettleToBuild: true }, mouseCursorResolver: states => resolveCupertinoSwitchCursor(w, states), semantics: { label: semanticLabel ?? null, identifier: id ?? null, transportId: id ?? null, toggled: w.value }, builder: (context, state, position, motion) => {
                const paint = resolveCupertinoSwitchPaint(w, context, state.states);
                this.painter.update({ ...paint, ...motion, position, config: switchConfig, cupertino: true, onOffLabels: paint.labels, rtl: Directionality.of(context) === 'rtl', isFocused: state.states.contains(WidgetState.focused), isHovered: state.states.contains(WidgetState.hovered), activeImage: w.activeThumbImage, inactiveImage: w.inactiveThumbImage, activeError: w.onActiveThumbImageError, inactiveError: w.onInactiveThumbImageError, configuration, iconTheme: IconTheme.of(context), paragraphContext: context.services.defaultFont ? { text: context.services.text, resources: context.services.resources, font: context.services.defaultFont, scale: context.services.readMetrics().scale, locale: context.maybeDependOn(Localizations)?.locale ?? 'en' } : null });
                const child = new CustomPaint(undefined, { size: switchSize, painter: this.painter });
                return state.states.contains(WidgetState.disabled) ? new Opacity(child, { opacity: disabledOpacity }) : child;
            } });
    }
    override dispose(): void { try {
        this.painter.dispose();
    }
    finally {
        super.dispose();
    } }
}
