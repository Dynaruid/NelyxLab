// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { Widget, BuildContext } from '@nelyx/core/framework/widgets/framework';
import { ControlInteraction } from '@nelyx/core/framework/widgets/control-interaction';
import type { ControlInteractionOptions } from '@nelyx/core/framework/widgets/control-interaction';
import { Padding, Text, DecoratedBox, ConstrainedBox, Center } from '@nelyx/core/framework/widgets/basic';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import { Opacity } from '@nelyx/core/framework/widgets/opacity';
import type { Size, Insets } from '@nelyx/core/ui/geometry';
import { Color } from '@nelyx/core/ui/color';
import type { CupertinoColor } from "./internal/colors/color-values.ts";
import { resolveCupertinoColor } from "./internal/colors/color-values.ts";
import { CupertinoTheme } from './theme.ts';
import { CupertinoColors } from './colors.ts';
export const CupertinoButtonSize = Object.freeze({
    small: 'small', medium: 'medium', large: 'large'
} as const);
export type CupertinoButtonSize = typeof CupertinoButtonSize[keyof typeof CupertinoButtonSize];
export interface CupertinoButtonOptions extends Omit<ControlInteractionOptions, 'selected' | 'semantics' | 'gestures'> {
    readonly child: Widget;
    readonly id?: string;
    readonly semanticsLabel?: string;
    readonly color?: CupertinoColor;
    readonly foregroundColor?: CupertinoColor;
    readonly disabledColor?: CupertinoColor;
    readonly sizeStyle?: CupertinoButtonSize;
    readonly padding?: Insets;
    readonly minimumSize?: Size;
    readonly pressedOpacity?: number | null;
    readonly borderRadius?: number;
}
/** Plain/filled/tinted functional button on the common input owner. */
export class CupertinoButton extends StatelessWidget {
    readonly options: Readonly<CupertinoButtonOptions>;
    private variant: 'plain' | 'filled' | 'tinted' = 'plain';
    constructor(options: CupertinoButtonOptions);
    constructor(id: string, label: string, onPressed: (() => void) | undefined);
    constructor(first: CupertinoButtonOptions | string, label?: string, onPressed?: (() => void)) {
        const options: CupertinoButtonOptions = typeof first === 'string' ? {
            id: first, semanticsLabel: label ?? '', child: new Text(label ?? ''), onPressed: onPressed ?? null
        } : first;
        super(options.key ?? null);
        this.options = Object.freeze({ ...options });
        const opacity = options.pressedOpacity;
        if (opacity != null && (!Number.isFinite(opacity) || opacity < 0 || opacity > 1))
            throw new RangeError('pressedOpacity must be within [0,1]');
    }
    static filled(options: CupertinoButtonOptions): CupertinoButton {
        const button = new CupertinoButton(options);
        button.variant = 'filled';
        return button;
    }
    static tinted(options: CupertinoButtonOptions): CupertinoButton {
        const button = new CupertinoButton(options);
        button.variant = 'tinted';
        return button;
    }
    get id(): string {
        if (this.options.id === undefined)
            throw new TypeError('No string button id was supplied');
        return this.options.id;
    }
    get label(): string {
        if (this.options.semanticsLabel === undefined)
            throw new TypeError('No string button label was supplied; read options.child');
        return this.options.semanticsLabel;
    }
    get onPressed(): (() => void) | undefined {
        return this.options.onPressed ?? undefined;
    }
    get enabled(): boolean {
        return (this.options.enabled ?? true) && (this.options.onPressed != null || this.options.onLongPress != null);
    }
    build(context: BuildContext): Widget {
        const options = this.options, theme = CupertinoTheme.of(context), enabled = this.enabled, filled = this.variant === 'filled', tinted = this.variant === 'tinted', base = options.color === undefined ? new Color(theme.primaryColor) : resolveCupertinoColor(options.color, context), foreground = options.foregroundColor !== undefined ? resolveCupertinoColor(options.foregroundColor, context) : filled ? new Color(theme.primaryContrastingColor) : enabled ? new Color(theme.primaryColor) : resolveCupertinoColor(CupertinoColors.tertiaryLabel, context), background = enabled ? (filled ? base : tinted ? base.withOpacity(theme.brightness === 'dark' ? .26 : .12) : options.color === undefined ? new Color(0) : base) : resolveCupertinoColor(options.disabledColor ?? CupertinoColors.tertiarySystemFill, context);
        const size = options.sizeStyle ?? 'large', minimum = options.minimumSize ?? { width: size === 'large' ? 44 : size === 'medium' ? 32 : 28, height: size === 'large' ? 44 : size === 'medium' ? 32 : 28 }, padding = options.padding ?? {
            left: size === 'large' ? 20 : size === 'medium' ? 15 : 12, right: size === 'large' ? 20 : size === 'medium' ? 15 : 12, top: size === 'large' ? 16 : size === 'medium' ? 10 : 6, bottom: size === 'large' ? 16 : size === 'medium' ? 10 : 6
        }, radius = options.borderRadius ?? (size === 'large' ? 12 : 40);
        const { key: _, child, id, semanticsLabel, color: __, foregroundColor: ___, disabledColor: ____, sizeStyle: _____, padding: ______, minimumSize: _______, pressedOpacity: ________, borderRadius: _________, ...interaction } = options;
        return new ControlInteraction((_context, state) => {
            const text = (size === 'small' ? theme.textTheme.actionSmallTextStyle : theme.textTheme.actionTextStyle).copyWith({ color: foreground.toARGB32() }), body = new ConstrainedBox(new Center(new Padding(padding, new DefaultTextStyle(text, child)), { widthFactor: 1, heightFactor: 1 }), new BoxConstraints(minimum.width, Infinity, minimum.height, Infinity));
            return new Opacity(new DecoratedBox(body, filled || tinted || options.color !== undefined ? background.toARGB32() : 0, radius), { opacity: 1 - state.pressProgress * (1 - (options.pressedOpacity === null ? 1 : options.pressedOpacity ?? .4)) });
        }, {
            ...interaction, enabled, semantics: {
                button: true, label: semanticsLabel ?? null, excludeSemantics: semanticsLabel !== undefined, identifier: id ?? null, transportId: id ?? null
            }
        });
    }
}
