// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { StatefulWidget, State } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import { ToggleableControl } from '@nelyx/core/framework/widgets/toggleable-control';
import { CustomPaint } from '@nelyx/core/framework/widgets/custom-paint';
import { Directionality, Localizations } from '@nelyx/core/framework/widgets/app-data';
import { Opacity } from '@nelyx/core/framework/widgets/opacity';
import { WidgetState } from '@nelyx/core/framework/widgets/widget-state';
import { IconTheme } from '@nelyx/core/framework/widgets/icon-theme';
import { createLocalImageConfiguration } from '@nelyx/core/framework/widgets/image';
import { ImageConfiguration } from '@nelyx/core/framework/painting/image-configuration';
import { switchEnvironment, resolveSwitchPaint, resolveSwitchCursor } from './switch-values.ts';
import { SwitchPainter } from '@nelyx/core/internal/framework/widgets/switch-painter';
import type { Switch } from '../../switch.ts';
import type { Size } from '@nelyx/core/ui/size';

export class MaterialSwitch extends StatefulWidget {
    constructor(readonly source: Switch, readonly adaptive: boolean, readonly size: Size) { super(); }
    createState(): State<MaterialSwitch> { return new MaterialSwitchState(); }
}
class MaterialSwitchState extends State<MaterialSwitch> {
    private readonly painter = new SwitchPainter();
    build(context: BuildContext): Widget {
        const w = this.widget.source, e = switchEnvironment(w, context, this.widget.adaptive), options = w.options;
        // Solid controls acquire no unused image/bundle service. Actual image inputs use the canonical configuration.
        const configuration = w.activeThumbImage !== null || w.inactiveThumbImage !== null ? createLocalImageConfiguration(context) : ImageConfiguration.empty;
        const {key, id, semanticLabel, value, onChanged, activeThumbColor, activeTrackColor, inactiveThumbColor, inactiveTrackColor, activeThumbImage, inactiveThumbImage, onActiveThumbImageError, onInactiveThumbImageError, thumbColor, trackColor, trackOutlineColor, trackOutlineWidth, thumbIcon, materialTapTargetSize, dragStartBehavior, mouseCursor, focusColor, hoverColor, overlayColor, splashRadius, onFocusChange, padding, ...interaction} = options;
        return new ToggleableControl({
            ...interaction, value: w.value, onChanged: w.onChanged === null ? null : next => {if (next !== null) w.onChanged!(next);},
            ...(w.onFocusChange === null ? {} : {onFocusChange: w.onFocusChange}), dragStartBehavior: w.dragStartBehavior,
            motion: 'source', motionProfile: e.config.motion, switchDrag: {policy: 'material', extent: e.config.trackWidth - e.config.trackHeight, deferSettleToBuild: true},
            mouseCursorResolver: states => resolveSwitchCursor(w, e, states), semantics: {label: semanticLabel ?? null, identifier: id ?? null, transportId: id ?? null, toggled: w.value},
            builder: (context, state, position, motion) => {
                this.painter.update({...resolveSwitchPaint(w, e, state.states), ...motion, position, config: e.config, surface: e.surface, rtl: Directionality.of(context) === 'rtl', isFocused: state.states.contains(WidgetState.focused), isHovered: state.states.contains(WidgetState.hovered), activeImage: w.activeThumbImage, inactiveImage: w.inactiveThumbImage, activeError: w.onActiveThumbImageError, inactiveError: w.onInactiveThumbImageError, configuration, iconTheme: IconTheme.of(context), paragraphContext: context.services.defaultFont ? {text: context.services.text, resources: context.services.resources, font: context.services.defaultFont, scale: context.services.readMetrics('scale').scale, locale: context.maybeDependOn(Localizations)?.locale ?? 'en'} : null});
                const paint = new CustomPaint(undefined, {size: this.widget.size, painter: this.painter});
                return e.config.isCupertino && state.states.contains(WidgetState.disabled) ? new Opacity(paint, {opacity: .5}) : paint;
            }
        });
    }
    override dispose(): void { try {this.painter.dispose();} finally {super.dispose();} }
}
