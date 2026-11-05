// SPDX-License-Identifier: BSD-3-Clause
import {
  Box,
  Row,
  Column,
  Stack,
  Text,
  EditableText,
  InheritedWidget,
  StatelessWidget,
  NodeWidget,
  ValueKey,
  protocol as p,
} from '@nelyx/core/v2';
import type { Widget, BuildContext, NodeOptions, EditingController } from '@nelyx/core/v2';
export {
  ListView,
  GestureDetector,
  EditingController,
  Navigator,
  NavigatorController,
} from '@nelyx/core/v2';
export class ThemeData {
  constructor(
    readonly primary = 0xff6750a4,
    readonly brightness: 'light' | 'dark' = 'light',
  ) {}
  get surface(): number {
    return this.brightness === 'dark' ? 0xff211f26 : 0xfffff7ff;
  }
  get foreground(): number {
    return this.brightness === 'dark' ? 0xffe6e0e9 : 0xff1d1b20;
  }
}
export class Theme extends InheritedWidget {
  constructor(
    readonly data: ThemeData,
    child: Widget,
  ) {
    super(child);
  }
  updateShouldNotify(old: Theme): boolean {
    return this.data !== old.data;
  }
  static of(context: BuildContext): ThemeData {
    return context.dependOn(Theme)?.data ?? new ThemeData();
  }
}
class MaterialNode extends NodeWidget {
  resolveOptions(context: BuildContext): NodeOptions {
    const o = super.resolveOptions(context),
      data = Theme.of(context);
    return {
      ...o,
      ...(o.control
        ? {
            control: {
              ...o.control,
              foreground:
                o.control.foreground === 0xff6750a4
                  ? data.primary
                  : (o.control.foreground ?? data.primary),
            },
          }
        : {}),
    };
  }
}
class MaterialText extends Text {
  resolveTextColor(context: BuildContext): number {
    const color = super.resolveTextColor(context);
    return color === 0xff6750a4 ? Theme.of(context).primary : color;
  }
}
export class MaterialApp extends StatelessWidget {
  constructor(
    readonly home: Widget,
    readonly theme = new ThemeData(),
  ) {
    super();
  }
  build(): Widget {
    return new Theme(this.theme, this.home);
  }
}
export class Scaffold extends StatelessWidget {
  constructor(
    readonly body: Widget,
    readonly options: NodeOptions & { appBar?: Widget; bottomNavigationBar?: Widget } = {},
  ) {
    super(options.key);
  }
  build(): Widget {
    return new Column(
      [
        ...(this.options.appBar ? [this.options.appBar] : []),
        this.body,
        ...(this.options.bottomNavigationBar ? [this.options.bottomNavigationBar] : []),
      ],
      { ...this.options, key: new ValueKey('scaffold') },
    );
  }
}
export class FilledButton extends MaterialNode {
  constructor(label: string, onPressed: (() => void) | null, options: NodeOptions = {}) {
    super(
      'box',
      [
        new MaterialText(label, {
          textColor:
            options.control?.appearance === 'outlined' || options.control?.appearance === 'text'
              ? (options.color ?? 0xff6750a4)
              : 0xffffffff,
        }),
      ],
      {
        layout: { padding: { left: 16, right: 16, top: 10, bottom: 10 } },
        ...options,
        control: {
          kind: 'button',
          foreground: options.color ?? 0xff6750a4,
          disabled: !onPressed,
          ...options.control,
        },
        semantics: {
          role: 'button',
          label,
          flags: p.semanticsFlags.focusable | (!onPressed ? p.semanticsFlags.disabled : 0),
          actions: onPressed ? p.semanticsActions.activate | p.semanticsActions.focus : 0,
          ...options.semantics,
        },
        onAction: (action) => {
          if (action === 'activate') onPressed?.();
          options.onAction?.(action);
        },
      },
    );
  }
}
export class ElevatedButton extends FilledButton {
  constructor(label: string, pressed: (() => void) | null, options: NodeOptions = {}) {
    super(label, pressed, {
      ...options,
      control: { kind: 'button', appearance: 'elevated', ...options.control },
    });
  }
}
export class OutlinedButton extends FilledButton {
  constructor(label: string, pressed: (() => void) | null, options: NodeOptions = {}) {
    super(label, pressed, {
      ...options,
      control: { kind: 'button', appearance: 'outlined', ...options.control },
    });
  }
}
export class TextButton extends FilledButton {
  constructor(label: string, pressed: (() => void) | null, options: NodeOptions = {}) {
    super(label, pressed, {
      ...options,
      control: { kind: 'button', appearance: 'text', ...options.control },
    });
  }
}
export class IconButton extends FilledButton {}
export class Icon extends Text {
  constructor(symbol: string, options: NodeOptions = {}) {
    super(symbol, { fontSize: 24, ...options });
  }
}
export class Checkbox extends MaterialNode {
  constructor(
    value: boolean,
    onChanged: ((value: boolean) => void) | null,
    options: NodeOptions = {},
  ) {
    super('box', [], {
      properties: { width: 28, height: 28 },
      ...options,
      control: {
        kind: 'checkbox',
        value: value ? 1 : 0,
        disabled: !onChanged,
        foreground: 0xff6750a4,
        ...options.control,
      },
      semantics: {
        role: 'checkbox',
        label: 'Checkbox',
        flags:
          p.semanticsFlags.focusable |
          (value ? p.semanticsFlags.checked : 0) |
          (!onChanged ? p.semanticsFlags.disabled : 0),
        actions: onChanged ? p.semanticsActions.activate | p.semanticsActions.focus : 0,
        ...options.semantics,
      },
      onValue: (v) => onChanged?.(v > 0),
    });
  }
}
export class Switch extends MaterialNode {
  constructor(
    value: boolean,
    onChanged: ((value: boolean) => void) | null,
    options: NodeOptions = {},
  ) {
    super('box', [], {
      properties: { width: 56, height: 32 },
      ...options,
      control: {
        kind: 'toggle',
        value: value ? 1 : 0,
        disabled: !onChanged,
        foreground: 0xff6750a4,
        ...options.control,
      },
      semantics: {
        role: 'checkbox',
        label: 'Switch',
        flags:
          p.semanticsFlags.focusable |
          (value ? p.semanticsFlags.checked : 0) |
          (!onChanged ? p.semanticsFlags.disabled : 0),
        actions: onChanged ? p.semanticsActions.activate | p.semanticsActions.focus : 0,
        ...options.semantics,
      },
      onValue: (v) => onChanged?.(v > 0),
    });
  }
}
export class Radio<T> extends MaterialNode {
  constructor(
    value: T,
    groupValue: T,
    onChanged: ((value: T) => void) | null,
    options: NodeOptions = {},
  ) {
    super('box', [], {
      properties: { width: 28, height: 28 },
      ...options,
      control: {
        kind: 'radio',
        value: Object.is(value, groupValue) ? 1 : 0,
        disabled: !onChanged,
        foreground: 0xff6750a4,
        ...options.control,
      },
      semantics: {
        role: 'checkbox',
        label: 'Radio',
        flags:
          p.semanticsFlags.focusable |
          (Object.is(value, groupValue) ? p.semanticsFlags.checked : 0),
        actions: onChanged ? p.semanticsActions.activate | p.semanticsActions.focus : 0,
        ...options.semantics,
      },
      onValue: () => onChanged?.(value),
    });
  }
}
export class Slider extends MaterialNode {
  constructor(
    value: number,
    onChanged: ((value: number) => void) | null,
    options: NodeOptions & { min?: number; max?: number; divisions?: number } = {},
  ) {
    const min = options.min ?? 0,
      max = options.max ?? 1;
    super('box', [], {
      properties: { width: 200, height: 32 },
      ...options,
      control: {
        kind: 'slider',
        minimum: min,
        maximum: max,
        value,
        step: options.divisions ? (max - min) / options.divisions : 0,
        disabled: !onChanged,
        foreground: 0xff6750a4,
        ...options.control,
      },
      semantics: {
        role: 'slider',
        label: 'Slider',
        flags: p.semanticsFlags.focusable | (!onChanged ? p.semanticsFlags.disabled : 0),
        actions: onChanged ? p.semanticsActions.focus : 0,
        ...options.semantics,
      },
      onValue: (v) => onChanged?.(v),
    });
  }
}
export class RangeValues {
  constructor(
    readonly start: number,
    readonly end: number,
  ) {}
}
export class RangeSlider extends MaterialNode {
  constructor(
    value: RangeValues,
    onChanged: ((value: RangeValues) => void) | null,
    options: NodeOptions & { min?: number; max?: number; divisions?: number } = {},
  ) {
    const min = options.min ?? 0,
      max = options.max ?? 1;
    super('box', [], {
      properties: { width: 200, height: 32 },
      ...options,
      control: {
        kind: 'rangeSlider',
        minimum: min,
        maximum: max,
        value: value.start,
        second: value.end,
        step: options.divisions ? (max - min) / options.divisions : 0,
        disabled: !onChanged,
        foreground: 0xff6750a4,
        ...options.control,
      },
      semantics: {
        role: 'slider',
        label: 'Range slider',
        flags: p.semanticsFlags.focusable,
        actions: onChanged ? p.semanticsActions.focus : 0,
        ...options.semantics,
      },
      onValue: (v, second) => onChanged?.(new RangeValues(v, second)),
    });
  }
}
export class LinearProgressIndicator extends MaterialNode {
  constructor(value: number, options: NodeOptions = {}) {
    super('box', [], {
      properties: { width: 200, height: 8 },
      ...options,
      control: { kind: 'progress', value, foreground: 0xff6750a4, ...options.control },
    });
  }
}
export class CircularProgressIndicator extends MaterialNode {
  constructor(value: number | null = null, options: NodeOptions = {}) {
    super('box', [], {
      properties: { width: 32, height: 32 },
      ...options,
      control: {
        kind: value === null ? 'activity' : 'circularProgress',
        value: value ?? 0,
        foreground: 0xff6750a4,
        ...options.control,
      },
    });
  }
}
export class Card extends Box {
  constructor(child: Widget, options: NodeOptions = {}) {
    super([child], {
      color: 0xfff3edf7,
      radius: 12,
      layout: { padding: { left: 16, right: 16, top: 16, bottom: 16 } },
      ...options,
    });
  }
}
export class Divider extends Box {
  constructor(options: NodeOptions = {}) {
    super([], { properties: { height: 1, width: 200 }, color: 0xffcac4d0, ...options });
  }
}
export class Badge extends Stack {
  constructor(child: Widget, label: string, options: NodeOptions = {}) {
    super(
      [
        child,
        new MaterialText(label, {
          color: 0xffb3261e,
          textColor: 0xffffffff,
          radius: 8,
          layout: { padding: { left: 4, right: 4, top: 2, bottom: 2 } },
        }),
      ],
      options,
    );
  }
}
export class ActionChip extends FilledButton {}
export class ChoiceChip extends MaterialNode {
  constructor(
    label: string,
    selected: boolean,
    onSelected: (selected: boolean) => void,
    options: NodeOptions = {},
  ) {
    super('box', [new MaterialText(label, { textColor: 0xffffffff })], {
      layout: { padding: { left: 12, right: 12, top: 8, bottom: 8 } },
      ...options,
      control: {
        kind: 'toggle',
        appearance: 'chip',
        value: selected ? 1 : 0,
        foreground: 0xff6750a4,
        ...options.control,
      },
      semantics: {
        role: 'checkbox',
        label,
        flags: p.semanticsFlags.focusable | (selected ? p.semanticsFlags.checked : 0),
        actions: p.semanticsActions.activate | p.semanticsActions.focus,
        ...options.semantics,
      },
      onValue: (v) => onSelected(v > 0),
    });
  }
}
export class FilterChip extends ChoiceChip {}
export class TextField extends EditableText {
  constructor(
    controller: EditingController,
    options: NonNullable<ConstructorParameters<typeof EditableText>[1]> = {},
  ) {
    super(controller, {
      properties: { width: 240, height: 48 },
      layout: { padding: { left: 12, right: 12, top: 8, bottom: 8 } },
      ...options,
    });
  }
}
export class TextFormField extends TextField {}
export class AlertDialog extends Card {
  constructor(
    title: string,
    content: Widget,
    actions: readonly Widget[] = [],
    options: NodeOptions = {},
  ) {
    super(
      new Column(
        [new Text(title, { fontSize: 22 }), content, new Row(actions, { layout: { gap: 8 } })],
        { layout: { direction: 'vertical', gap: 16 } },
      ),
      { properties: { width: 320 }, ...options },
    );
  }
}
export { Box, Row, Column, Stack, Text };
