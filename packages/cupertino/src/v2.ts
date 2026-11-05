// SPDX-License-Identifier: BSD-3-Clause
import {
  Box,
  Column,
  Row,
  Text,
  EditableText,
  InheritedWidget,
  StatelessWidget,
  NodeWidget,
  protocol as p,
} from '@nelyx/core/v2';
import type { Widget, NodeOptions, BuildContext, EditingController } from '@nelyx/core/v2';
export {
  ListView,
  GestureDetector,
  EditingController,
  Navigator,
  NavigatorController,
} from '@nelyx/core/v2';
export class CupertinoThemeData {
  constructor(
    readonly primaryColor = 0xff007aff,
    readonly brightness: 'light' | 'dark' = 'light',
  ) {}
  get background(): number {
    return this.brightness === 'dark' ? 0xff000000 : 0xfff2f2f7;
  }
}
export class CupertinoTheme extends InheritedWidget {
  constructor(
    readonly data: CupertinoThemeData,
    child: Widget,
  ) {
    super(child);
  }
  updateShouldNotify(old: CupertinoTheme): boolean {
    return this.data !== old.data;
  }
  static of(context: BuildContext): CupertinoThemeData {
    return context.dependOn(CupertinoTheme)?.data ?? new CupertinoThemeData();
  }
}
class CupertinoNode extends NodeWidget {
  resolveOptions(context: BuildContext): NodeOptions {
    const o = super.resolveOptions(context),
      data = CupertinoTheme.of(context);
    return {
      ...o,
      ...(o.control
        ? {
            control: {
              ...o.control,
              foreground:
                o.control.foreground === 0xff007aff
                  ? data.primaryColor
                  : (o.control.foreground ?? data.primaryColor),
            },
          }
        : {}),
    };
  }
}
class CupertinoText extends Text {
  resolveTextColor(context: BuildContext): number {
    const color = super.resolveTextColor(context);
    return color === 0xff007aff ? CupertinoTheme.of(context).primaryColor : color;
  }
}
export class CupertinoApp extends StatelessWidget {
  constructor(
    readonly home: Widget,
    readonly theme = new CupertinoThemeData(),
  ) {
    super();
  }
  build(): Widget {
    return new CupertinoTheme(this.theme, this.home);
  }
}
export class CupertinoButton extends CupertinoNode {
  constructor(label: string, onPressed: (() => void) | null, options: NodeOptions = {}) {
    super(
      'box',
      [
        new CupertinoText(label, {
          textColor: options.control?.appearance === 'filled' ? 0xffffffff : 0xff007aff,
        }),
      ],
      {
        layout: { padding: { left: 16, right: 16, top: 12, bottom: 12 } },
        ...options,
        control: {
          kind: 'button',
          appearance: 'text',
          foreground: 0xff007aff,
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
  static filled(
    label: string,
    pressed: (() => void) | null,
    options: NodeOptions = {},
  ): CupertinoButton {
    return new CupertinoButton(label, pressed, {
      ...options,
      control: { kind: 'button', appearance: 'filled', ...options.control },
    });
  }
}
export class CupertinoSwitch extends CupertinoNode {
  constructor(
    value: boolean,
    onChanged: ((value: boolean) => void) | null,
    options: NodeOptions = {},
  ) {
    super('box', [], {
      properties: { width: 51, height: 31 },
      ...options,
      control: {
        kind: 'toggle',
        value: value ? 1 : 0,
        disabled: !onChanged,
        foreground: 0xff34c759,
        track: 0xffd1d1d6,
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
export class CupertinoCheckbox extends CupertinoNode {
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
        foreground: 0xff007aff,
        ...options.control,
      },
      semantics: {
        role: 'checkbox',
        label: 'Checkbox',
        flags: p.semanticsFlags.focusable | (value ? p.semanticsFlags.checked : 0),
        actions: onChanged ? p.semanticsActions.activate | p.semanticsActions.focus : 0,
        ...options.semantics,
      },
      onValue: (v) => onChanged?.(v > 0),
    });
  }
}
export class CupertinoRadio<T> extends CupertinoNode {
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
        foreground: 0xff007aff,
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
export class CupertinoSlider extends CupertinoNode {
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
        value,
        minimum: min,
        maximum: max,
        step: options.divisions ? (max - min) / options.divisions : 0,
        disabled: !onChanged,
        foreground: 0xff007aff,
        ...options.control,
      },
      semantics: {
        role: 'slider',
        label: 'Slider',
        flags: p.semanticsFlags.focusable,
        actions: onChanged ? p.semanticsActions.focus : 0,
        ...options.semantics,
      },
      onValue: (v) => onChanged?.(v),
    });
  }
}
export class CupertinoActivityIndicator extends CupertinoNode {
  constructor(options: NodeOptions = {}) {
    super('box', [], {
      properties: { width: 24, height: 24 },
      ...options,
      control: { kind: 'activity', foreground: 0xff8e8e93, ...options.control },
    });
  }
}
export class CupertinoTextField extends EditableText {
  constructor(
    controller: EditingController,
    options: NonNullable<ConstructorParameters<typeof EditableText>[1]> = {},
  ) {
    super(controller, {
      properties: { width: 240, height: 40 },
      layout: { padding: { left: 8, right: 8, top: 6, bottom: 6 } },
      ...options,
    });
  }
}
export class CupertinoTextFormFieldRow extends CupertinoTextField {}
export class CupertinoPageScaffold extends Box {
  constructor(child: Widget, options: NodeOptions = {}) {
    super([child], { color: 0xfff2f2f7, ...options });
  }
}
export class CupertinoListTile extends Box {
  constructor(title: string, subtitle?: string, options: NodeOptions = {}) {
    super(
      [
        new Column([
          new Text(title),
          ...(subtitle ? [new Text(subtitle, { fontSize: 14, textColor: 0xff8e8e93 })] : []),
        ]),
      ],
      {
        color: 0xffffffff,
        layout: { padding: { left: 16, right: 16, top: 12, bottom: 12 } },
        ...options,
      },
    );
  }
}
export class CupertinoListTileChevron extends Text {
  constructor() {
    super('›', { fontSize: 24, textColor: 0xffc7c7cc });
  }
}
export class CupertinoListSection extends Column {
  constructor(children: readonly Widget[], options: NodeOptions = {}) {
    super(children, { layout: { gap: 1 }, ...options });
  }
}
export class CupertinoFormSection extends CupertinoListSection {}
export class CupertinoAlertDialog extends Box {
  constructor(
    title: string,
    content: Widget,
    actions: readonly Widget[] = [],
    options: NodeOptions = {},
  ) {
    super(
      [
        new Column(
          [new Text(title, { fontSize: 20 }), content, new Row(actions, { layout: { gap: 8 } })],
          { layout: { direction: 'vertical', gap: 12 } },
        ),
      ],
      {
        properties: { width: 280 },
        color: 0xfff2f2f7,
        radius: 14,
        layout: { padding: { left: 16, right: 16, top: 16, bottom: 16 } },
        ...options,
      },
    );
  }
}
