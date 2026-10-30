// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { State } from '@nelyx/core/framework/widgets/framework';
import { invariant } from '@nelyx/core/foundation/errors';
import type { DiagnosticPropertiesBuilder } from '@nelyx/core/foundation/diagnostics';
import { FlagProperty, ObjectFlagProperty } from '@nelyx/core/foundation/diagnostic-properties';
import type { Color } from '@nelyx/core/ui/color';
import type { DartDouble } from '@nelyx/core/foundation/dart-numeric';
import type { WidgetStateProperty } from '@nelyx/core/framework/widgets/widget-state';
import type { Icon } from '@nelyx/core/framework/widgets/icon';
import type { ImageProvider } from '@nelyx/core/framework/painting/image-provider';
import type { ImageErrorListener } from '@nelyx/core/framework/painting/image-stream';
import type { MouseCursor } from '@nelyx/core/services/mouse-cursor';
import type { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { DragStartBehavior } from '@nelyx/core/framework/gestures/recognizer';
import type { CupertinoColor } from './internal/colors/color-values.ts';
import type { BaseOptions } from './internal/toggle/control-values.ts';
import { CupertinoSwitchState } from './internal/switch/switch-state.ts';
export interface CupertinoSwitchOptions extends Omit<
  BaseOptions,
  'mouseCursor' | 'onFocusChange' | 'dragStartBehavior'
> {
  readonly value: boolean;
  readonly onChanged: ((value: boolean) => void) | null;
  readonly semanticLabel?: string | null;
  readonly id?: string;
  readonly activeTrackColor?: CupertinoColor | null;
  readonly inactiveTrackColor?: CupertinoColor | null;
  readonly thumbColor?: CupertinoColor | null;
  readonly inactiveThumbColor?: CupertinoColor | null;
  readonly focusColor?: CupertinoColor | null;
  readonly onLabelColor?: CupertinoColor | null;
  readonly offLabelColor?: CupertinoColor | null;
  readonly activeThumbImage?: ImageProvider | null;
  readonly onActiveThumbImageError?: ImageErrorListener | null;
  readonly inactiveThumbImage?: ImageProvider | null;
  readonly onInactiveThumbImageError?: ImageErrorListener | null;
  readonly trackOutlineColor?: WidgetStateProperty<Color | null> | null;
  /** @dartType WidgetStateProperty<double?>? */ readonly trackOutlineWidth?: WidgetStateProperty<DartDouble | null> | null;
  readonly thumbIcon?: WidgetStateProperty<Icon | null> | null;
  readonly mouseCursor?: WidgetStateProperty<MouseCursor> | null;
  readonly focusNode?: FocusNode | null;
  readonly onFocusChange?: ((focused: boolean) => void) | null;
  readonly autofocus?: boolean;
  readonly applyTheme?: boolean | null;
  readonly dragStartBehavior?: DragStartBehavior;
}
export class CupertinoSwitch extends StatefulWidget {
  readonly options: Readonly<CupertinoSwitchOptions>;
  /** @dartParam trackOutlineWidth WidgetStateProperty<double?>? */
  constructor(options: CupertinoSwitchOptions) {
    super(options.key ?? null);
    if (Object.hasOwn(options, 'activeColor') || Object.hasOwn(options, 'trackColor'))
      throw new TypeError('Deprecated CupertinoSwitch activeColor/trackColor have been removed');
    invariant(
      typeof options.value === 'boolean',
      'invalid-switch-value',
      'Switch value must be boolean',
    );
    invariant(
      Object.hasOwn(options, 'onChanged'),
      'missing-switch-onChanged',
      'CupertinoSwitch requires the nullable onChanged argument',
    );
    invariant(
      options.activeThumbImage != null || options.onActiveThumbImageError == null,
      'invalid-switch-image-error',
      'Active image error callback requires an image',
    );
    invariant(
      options.inactiveThumbImage != null || options.onInactiveThumbImageError == null,
      'invalid-switch-image-error',
      'Inactive image error callback requires an image',
    );
    this.options = Object.freeze({ ...options });
  }
  get value(): boolean {
    return this.options.value;
  }
  get onChanged(): ((value: boolean) => void) | null {
    return this.options.onChanged;
  }
  get activeTrackColor(): CupertinoColor | null {
    return this.options.activeTrackColor ?? null;
  }
  get inactiveTrackColor(): CupertinoColor | null {
    return this.options.inactiveTrackColor ?? null;
  }
  get thumbColor(): CupertinoColor | null {
    return this.options.thumbColor ?? null;
  }
  get inactiveThumbColor(): CupertinoColor | null {
    return this.options.inactiveThumbColor ?? null;
  }
  get focusColor(): CupertinoColor | null {
    return this.options.focusColor ?? null;
  }
  get onLabelColor(): CupertinoColor | null {
    return this.options.onLabelColor ?? null;
  }
  get offLabelColor(): CupertinoColor | null {
    return this.options.offLabelColor ?? null;
  }
  get activeThumbImage(): ImageProvider | null {
    return this.options.activeThumbImage ?? null;
  }
  get onActiveThumbImageError(): ImageErrorListener | null {
    return this.options.onActiveThumbImageError ?? null;
  }
  get inactiveThumbImage(): ImageProvider | null {
    return this.options.inactiveThumbImage ?? null;
  }
  get onInactiveThumbImageError(): ImageErrorListener | null {
    return this.options.onInactiveThumbImageError ?? null;
  }
  get trackOutlineColor(): WidgetStateProperty<Color | null> | null {
    return this.options.trackOutlineColor ?? null;
  }
  /** @dartType WidgetStateProperty<double?>? */
  get trackOutlineWidth(): WidgetStateProperty<DartDouble | null> | null {
    return this.options.trackOutlineWidth ?? null;
  }
  get thumbIcon(): WidgetStateProperty<Icon | null> | null {
    return this.options.thumbIcon ?? null;
  }
  get mouseCursor(): WidgetStateProperty<MouseCursor> | null {
    return this.options.mouseCursor ?? null;
  }
  get focusNode(): FocusNode | null {
    return this.options.focusNode ?? null;
  }
  get onFocusChange(): ((focused: boolean) => void) | null {
    return this.options.onFocusChange ?? null;
  }
  get autofocus(): boolean {
    return this.options.autofocus ?? false;
  }
  get applyTheme(): boolean | null {
    return this.options.applyTheme ?? null;
  }
  get dragStartBehavior(): DragStartBehavior {
    return this.options.dragStartBehavior ?? DragStartBehavior.start;
  }
  createState(): State<CupertinoSwitch> {
    return new CupertinoSwitchState();
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(
      new FlagProperty('value', this.value, { ifTrue: 'on', ifFalse: 'off', showName: true }),
    );
    properties.add(new ObjectFlagProperty('onChanged', this.onChanged, { ifNull: 'disabled' }));
  }
}
