// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { invariant } from '@nelyx/core/foundation/errors';
import { StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import type { Color } from '@nelyx/core/ui/color';
import type { WidgetStateProperty } from '@nelyx/core/framework/widgets/widget-state';
import type { DartDouble } from '@nelyx/core/foundation/dart-numeric';
import type { ImageProvider } from '@nelyx/core/framework/painting/image-provider';
import type { ImageErrorListener } from '@nelyx/core/framework/painting/image-stream';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import type { Icon } from '@nelyx/core/framework/widgets/icon';
import type { MouseCursor } from '@nelyx/core/services/mouse-cursor';
import { DragStartBehavior } from '@nelyx/core/framework/gestures/recognizer';
import type { MaterialTapTargetSize } from './theme-data.ts';
import type { BaseOptions } from './internal/toggle/control-values.ts';
import { MaterialSwitch } from './internal/switch/switch-build.ts';
import { switchSize } from './internal/switch/switch-values.ts';
import { FlagProperty, ObjectFlagProperty } from '@nelyx/core/foundation/diagnostic-properties';
import type { DiagnosticPropertiesBuilder } from '@nelyx/core/foundation/diagnostics';
export interface SwitchOptions extends Omit<BaseOptions, 'mouseCursor' | 'onFocusChange'> {
    readonly value: boolean;
    readonly onChanged: ((value: boolean) => void) | null;
    readonly semanticLabel?: string | null;
    readonly id?: string;
    readonly activeThumbColor?: Color | null;
    readonly activeTrackColor?: Color | null;
    readonly inactiveThumbColor?: Color | null;
    readonly inactiveTrackColor?: Color | null;
    readonly activeThumbImage?: ImageProvider | null;
    readonly onActiveThumbImageError?: ImageErrorListener | null;
    readonly inactiveThumbImage?: ImageProvider | null;
    readonly onInactiveThumbImageError?: ImageErrorListener | null;
    readonly thumbColor?: WidgetStateProperty<Color | null> | null;
    readonly trackColor?: WidgetStateProperty<Color | null> | null;
    readonly trackOutlineColor?: WidgetStateProperty<Color | null> | null;
    /** @dartType WidgetStateProperty<double?>? */
    readonly trackOutlineWidth?: WidgetStateProperty<DartDouble | null> | null;
    readonly thumbIcon?: WidgetStateProperty<Icon | null> | null;
    readonly materialTapTargetSize?: MaterialTapTargetSize | null;
    readonly dragStartBehavior?: DragStartBehavior;
    readonly mouseCursor?: MouseCursor | null;
    readonly focusColor?: Color | null;
    readonly hoverColor?: Color | null;
    readonly overlayColor?: WidgetStateProperty<Color | null> | null;
    /** @dartType double? */
    readonly splashRadius?: number | null;
    readonly onFocusChange?: ((focused: boolean) => void) | null;
    readonly padding?: EdgeInsetsGeometry | null;
}
export interface SwitchAdaptiveOptions extends SwitchOptions { readonly applyCupertinoTheme?: boolean | null; }
const adaptiveSwitches = new WeakMap<Widget, boolean | null>();
export class Switch extends StatelessWidget {
    readonly options: Readonly<SwitchOptions>;
    /**
     * @dartParam trackOutlineWidth WidgetStateProperty<double?>?
     * @dartParam splashRadius double?
     */
    constructor(options: SwitchOptions) {
        super(options.key ?? null);
        invariant(!('activeColor' in options), 'deprecated-switch-option', 'Switch uses activeThumbColor and activeTrackColor');
        invariant(typeof options.value === 'boolean', 'invalid-switch-value', 'Switch value must be boolean');
        invariant(options.onChanged === null || typeof options.onChanged === 'function', 'invalid-switch-callback', 'Switch requires an explicit nullable callback');
        invariant(options.activeThumbImage != null || options.onActiveThumbImageError == null, 'invalid-switch-image-handler', 'An active thumb image is required for its error listener');
        invariant(options.inactiveThumbImage != null || options.onInactiveThumbImageError == null, 'invalid-switch-image-handler', 'An inactive thumb image is required for its error listener');
        invariant(options.splashRadius == null || Number.isFinite(options.splashRadius) && options.splashRadius >= 0, 'invalid-switch-splash', 'Switch splashRadius must be finite and nonnegative');
        this.options = Object.freeze({ ...options });
    }
    /**
     * @dartParam trackOutlineWidth WidgetStateProperty<double?>?
     * @dartParam splashRadius double?
     */
    static adaptive(options: SwitchAdaptiveOptions): Switch {
        const { applyCupertinoTheme = null, ...standard } = options, result = new Switch(standard);
        adaptiveSwitches.set(result, applyCupertinoTheme); return result;
    }
    get value(): boolean { return this.options.value; }
    get onChanged(): ((value: boolean) => void) | null { return this.options.onChanged; }
    get activeThumbColor(): Color | null { return this.options.activeThumbColor ?? null; }
    get activeTrackColor(): Color | null { return this.options.activeTrackColor ?? null; }
    get inactiveThumbColor(): Color | null { return this.options.inactiveThumbColor ?? null; }
    get inactiveTrackColor(): Color | null { return this.options.inactiveTrackColor ?? null; }
    get activeThumbImage(): ImageProvider | null { return this.options.activeThumbImage ?? null; }
    get onActiveThumbImageError(): ImageErrorListener | null { return this.options.onActiveThumbImageError ?? null; }
    get inactiveThumbImage(): ImageProvider | null { return this.options.inactiveThumbImage ?? null; }
    get onInactiveThumbImageError(): ImageErrorListener | null { return this.options.onInactiveThumbImageError ?? null; }
    get thumbColor(): WidgetStateProperty<Color | null> | null { return this.options.thumbColor ?? null; }
    get trackColor(): WidgetStateProperty<Color | null> | null { return this.options.trackColor ?? null; }
    get trackOutlineColor(): WidgetStateProperty<Color | null> | null { return this.options.trackOutlineColor ?? null; }
    /** @dartType WidgetStateProperty<double?>? */
    get trackOutlineWidth(): WidgetStateProperty<DartDouble | null> | null { return this.options.trackOutlineWidth ?? null; }
    get thumbIcon(): WidgetStateProperty<Icon | null> | null { return this.options.thumbIcon ?? null; }
    get materialTapTargetSize(): MaterialTapTargetSize | null { return this.options.materialTapTargetSize ?? null; }
    get dragStartBehavior(): DragStartBehavior { return this.options.dragStartBehavior ?? DragStartBehavior.start; }
    get mouseCursor(): MouseCursor | null { return this.options.mouseCursor ?? null; }
    get focusColor(): Color | null { return this.options.focusColor ?? null; }
    get hoverColor(): Color | null { return this.options.hoverColor ?? null; }
    get overlayColor(): WidgetStateProperty<Color | null> | null { return this.options.overlayColor ?? null; }
    /** @dartType double? */
    get splashRadius(): number | null { return this.options.splashRadius ?? null; }
    get focusNode() { return this.options.focusNode ?? null; }
    get onFocusChange(): ((focused: boolean) => void) | null { return this.options.onFocusChange ?? null; }
    get autofocus(): boolean { return this.options.autofocus ?? false; }
    get padding(): EdgeInsetsGeometry | null { return this.options.padding ?? null; }
    get applyCupertinoTheme(): boolean | null { return adaptiveSwitches.get(this) ?? null; }
    build(context: BuildContext): Widget {
        const adaptive = adaptiveSwitches.has(this);
        return new MaterialSwitch(this, adaptive, switchSize(this, context, adaptive));
    }
    override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
        super.debugFillProperties(properties);
        properties.add(new FlagProperty('value', this.value, { ifTrue: 'on', ifFalse: 'off', showName: true }));
        properties.add(new ObjectFlagProperty('onChanged', this.onChanged, { ifNull: 'disabled' }));
    }
}
