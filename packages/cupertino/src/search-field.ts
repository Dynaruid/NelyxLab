// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { StatefulWidget, Element } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import { Padding } from '@nelyx/core/framework/widgets/basic';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { ControlInteraction } from '@nelyx/core/framework/widgets/control-interaction';
import { TextEditingController } from '@nelyx/core/framework/widgets/editable-text';
import { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { Icon } from '@nelyx/core/framework/widgets/icon';
import { IconTheme } from '@nelyx/core/framework/widgets/icon-theme';
import { IconThemeData } from '@nelyx/core/framework/widgets/icon-theme-data';
import { ListenableBuilder } from '@nelyx/core/framework/widgets/listenable-builder';
import { RestorableProperty, RestorationMixin } from '@nelyx/core/framework/widgets/restoration';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { BoxDecoration } from '@nelyx/core/framework/painting/box-decoration';
import { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { invariant } from '@nelyx/core/foundation/errors';
import type { Color } from '@nelyx/core/ui/color';
import { CupertinoColors, CupertinoDynamicColor } from './colors.ts';
import { CupertinoIcons } from './icons.ts';
import { CupertinoLocalizations } from './cupertino-localizations.ts';
import { CupertinoTextField, OverlayVisibilityMode } from './text-field.ts';
import type { CupertinoTextFieldOptions } from './text-field.ts';

export interface CupertinoSearchTextFieldOptions extends Pick<
  CupertinoTextFieldOptions,
  | 'id'
  | 'key'
  | 'controller'
  | 'onChanged'
  | 'onSubmitted'
  | 'style'
  | 'placeholder'
  | 'placeholderStyle'
  | 'decoration'
  | 'keyboardType'
  | 'padding'
  | 'suffixMode'
  | 'focusNode'
  | 'autofocus'
  | 'onTap'
  | 'autocorrect'
  | 'enabled'
  | 'cursorWidth'
  | 'cursorHeight'
  | 'cursorColor'
> {
  readonly backgroundColor?: Color | null;
  readonly borderRadius?: BorderRadius | null;
  readonly itemColor?: Color;
  readonly itemSize?: number;
  readonly prefixInsets?: EdgeInsetsGeometry;
  readonly prefixIcon?: Widget;
  readonly suffixInsets?: EdgeInsetsGeometry;
  readonly suffixIcon?: Icon;
  readonly onSuffixTap?: () => void;
  readonly restorationId?: string | null;
}

export class CupertinoSearchTextField extends StatefulWidget {
  constructor(readonly options: CupertinoSearchTextFieldOptions) {
    super(options.key ?? null);
    invariant(
      options.decoration == null ||
        (options.backgroundColor == null && options.borderRadius == null),
      'invalid-search-field-decoration',
      'Specify a decoration or its backgroundColor and borderRadius shorthands, not both',
    );
  }
  createState(): RestorationMixin<CupertinoSearchTextField> {
    return new CupertinoSearchTextFieldState();
  }
}

const inputPadding = EdgeInsetsGeometry.fromSTEB(5.5, 8, 5.5, 8);
const prefixInsets = EdgeInsetsGeometry.fromSTEB(6, 8, 0, 8);
const suffixInsets = EdgeInsetsGeometry.fromSTEB(0, 8, 5, 8);
const defaultRadius = BorderRadius.circular(9);

class SearchTextRestoration extends RestorableProperty<string> {
  readonly controller: TextEditingController;
  private readonly changed = () => this.notifyListeners();
  constructor(private readonly initial?: TextEditingController['value']) {
    super();
    this.controller = new TextEditingController(initial?.text);
    if (initial) {
      this.controller.selection = initial.selection;
      this.controller.clearHistory();
    }
    this.controller.addListener(this.changed);
  }
  get value(): string {
    return this.controller.text;
  }
  set value(text: string) {
    this.controller.text = text;
  }
  toPrimitives(): string {
    return this.value;
  }
  restore(value: unknown): void {
    invariant(
      typeof value === 'string',
      'invalid-search-restoration',
      'Expected restored search text',
    );
    this.controller.reset(value);
  }
  reset(): void {
    this.controller.reset(this.initial?.text ?? '');
    if (this.initial) this.controller.selection = this.initial.selection;
  }
  override dispose(): void {
    this.controller.removeListener(this.changed);
    this.controller.dispose();
    super.dispose();
  }
}

class CupertinoSearchTextFieldState extends RestorationMixin<CupertinoSearchTextField> {
  private localText: SearchTextRestoration | null = null;
  private localFocus: FocusNode | null = null;
  get restorationId(): string | null {
    return this.widget.options.restorationId ?? null;
  }
  private get controller(): TextEditingController {
    return this.widget.options.controller ?? this.localText!.controller;
  }
  override initState(): void {
    super.initState();
    if (!this.widget.options.controller) this.localText = new SearchTextRestoration();
    if (!this.widget.options.focusNode) this.localFocus = new FocusNode();
  }
  restoreState(): void {
    if (this.localText) this.registerForRestoration(this.localText, 'controller');
  }
  override didUpdateWidget(old: CupertinoSearchTextField): void {
    const options = this.widget.options;
    const retiredText = options.controller ? this.localText : null;
    if (retiredText) {
      this.unregisterFromRestoration(retiredText);
      this.localText = null;
    }
    const retiredFocus = options.focusNode ? this.localFocus : null;
    if (options.focusNode) this.localFocus = null;
    else this.localFocus ??= new FocusNode();
    super.didUpdateWidget(old);
    if (!options.controller && !this.localText) {
      this.localText = new SearchTextRestoration(old.options.controller?.value);
      this.registerForRestoration(this.localText, 'controller');
    }
    if ((retiredText || retiredFocus) && this.context instanceof Element) {
      this.context.owner.postFrame(() => {
        retiredText?.dispose();
        retiredFocus?.dispose();
      });
    }
  }
  override dispose(): void {
    super.dispose();
    this.localText?.dispose();
    this.localFocus?.dispose();
  }
  private readonly tapSuffix = (): void => {
    if (!this.mounted || !(this.context instanceof Element) || !this.context.active) return;
    const { enabled, onSuffixTap } = this.widget.options;
    if (enabled === false) return;
    if (onSuffixTap) {
      onSuffixTap();
      return;
    }
    const controller = this.controller;
    const hadText = controller.text.length > 0;
    controller.clear(() => {
      if (
        hadText &&
        this.mounted &&
        this.context instanceof Element &&
        this.context.active &&
        this.controller === controller
      ) {
        this.widget.options.onChanged?.(controller.text);
      }
    });
  };
  build(context: BuildContext): Widget {
    const o = this.widget.options;
    const focus = o.focusNode ?? this.localFocus!;
    const size = MediaQuery.textScalerOf(context).scale(o.itemSize ?? 20);
    const color = CupertinoDynamicColor.resolve(
      o.itemColor ?? CupertinoColors.secondaryLabel,
      context,
    );
    const strings = CupertinoLocalizations.of(context);
    const decoration =
      o.decoration ??
      new BoxDecoration({
        color: CupertinoDynamicColor.resolve(
          o.backgroundColor ?? CupertinoColors.tertiarySystemFill,
          context,
        ).toARGB32(),
        borderRadius: o.borderRadius ?? defaultRadius,
      });
    return new ListenableBuilder(
      focus,
      () =>
        new CupertinoTextField({
          id: o.id,
          ...(o.onChanged ? { onChanged: o.onChanged } : {}),
          ...(o.onSubmitted ? { onSubmitted: o.onSubmitted } : {}),
          ...(o.style ? { style: o.style } : {}),
          ...(o.keyboardType ? { keyboardType: o.keyboardType } : {}),
          ...(o.autofocus === undefined ? {} : { autofocus: o.autofocus }),
          ...(o.onTap ? { onTap: o.onTap } : {}),
          ...(o.autocorrect === undefined ? {} : { autocorrect: o.autocorrect }),
          ...(o.enabled === undefined ? {} : { enabled: o.enabled }),
          ...(o.cursorWidth === undefined ? {} : { cursorWidth: o.cursorWidth }),
          ...(o.cursorHeight === undefined ? {} : { cursorHeight: o.cursorHeight }),
          ...(o.cursorColor ? { cursorColor: o.cursorColor } : {}),
          controller: this.controller,
          focusNode: focus,
          decoration,
          padding: o.padding ?? inputPadding,
          placeholder: o.placeholder ?? strings.searchTextFieldPlaceholderLabel,
          placeholderStyle:
            o.placeholderStyle ??
            new TextStyle({
              color: CupertinoColors.secondaryLabel.resolveFrom(context).toARGB32(),
            }),
          prefix: new Padding(
            o.prefixInsets ?? prefixInsets,
            new IconTheme(
              new IconThemeData({
                color,
                size: size >= 30 && focus.hasFocus ? 0 : size,
                applyTextScaling: false,
              }),
              o.prefixIcon ?? new Icon(CupertinoIcons.search),
            ),
          ),
          suffix: new Padding(
            o.suffixInsets ?? suffixInsets,
            new ControlInteraction(
              () =>
                new IconTheme(
                  new IconThemeData({ color, size, applyTextScaling: false }),
                  o.suffixIcon ?? new Icon(CupertinoIcons.xmark_circle_fill),
                ),
              {
                enabled: o.enabled !== false,
                onPressed: this.tapSuffix,
                requestFocusOnPointer: false,
                semantics: {
                  transportId: o.id + '-suffix',
                  button: true,
                  ...(o.onSuffixTap ? {} : { label: strings.clearButtonLabel }),
                },
              },
            ),
          ),
          suffixMode: o.suffixMode ?? OverlayVisibilityMode.editing,
          textInputAction: 'search',
        }),
    );
  }
}
