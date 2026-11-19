// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/cupertino/search_field.dart
// Revision: 71e4717a61786faab4c7aa39825989305ed29e8a
import { StatefulWidget, Element } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import { Padding } from '@nelyx/core/framework/widgets/basic';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { ControlInteraction } from '@nelyx/core/framework/widgets/control-interaction';
import type { TextEditingController } from '@nelyx/core/framework/widgets/editable-text';
import { EditorTextRestoration } from '@nelyx/core/framework/widgets/editable-text';
import { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { Icon } from '@nelyx/core/framework/widgets/icon';
import { IconTheme } from '@nelyx/core/framework/widgets/icon-theme';
import { IconThemeData } from '@nelyx/core/framework/widgets/icon-theme-data';
import { ListenableBuilder } from '@nelyx/core/framework/widgets/listenable-builder';
import { Opacity } from '@nelyx/core/framework/widgets/opacity';
import { RestorationMixin } from '@nelyx/core/framework/widgets/restoration';
import { ScrollUpdateNotification } from '@nelyx/core/framework/widgets/scroll-notification';
import type { ScrollNotification } from '@nelyx/core/framework/widgets/scroll-notification';
import { ScrollNotificationObserver } from '@nelyx/core/framework/widgets/scroll-notification-observer';
import type { ScrollNotificationObserverState } from '@nelyx/core/framework/widgets/scroll-notification-observer';
import { RenderBox } from '@nelyx/core/framework/rendering/object';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { BoxDecoration } from '@nelyx/core/framework/painting/box-decoration';
import { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { invariant } from '@nelyx/core/foundation/errors';
import type { Color } from '@nelyx/core/ui/color';
import { clampDouble } from '@nelyx/core/ui/math';
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
  | 'smartDashesType'
  | 'smartQuotesType'
  | 'enabled'
  | 'cursorWidth'
  | 'cursorHeight'
  | 'cursorRadius'
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
const minimumVisibleHeightFraction = 4 / 5;

class CupertinoSearchTextFieldState extends RestorationMixin<CupertinoSearchTextField> {
  private localText: EditorTextRestoration | null = null;
  private localFocus: FocusNode | null = null;
  private observer: ScrollNotificationObserverState | null = null;
  private fadeExtent = 0;
  private measureQueued = false;
  private maximumIconHeight = 0;
  get restorationId(): string | null {
    return this.widget.options.restorationId ?? null;
  }
  private get controller(): TextEditingController {
    return this.widget.options.controller ?? this.localText!.controller;
  }
  override initState(): void {
    super.initState();
    if (!this.widget.options.controller) this.localText = new EditorTextRestoration();
    if (!this.widget.options.focusNode) this.localFocus = new FocusNode();
  }
  override didChangeDependencies(): void {
    super.didChangeDependencies();
    const observer = ScrollNotificationObserver.maybeOf(this.context);
    if (observer === this.observer) return;
    this.observer?.removeListener(this.onScroll);
    this.observer = observer;
    observer?.addListener(this.onScroll);
    if (!observer) this.fadeExtent = 0;
  }
  private readonly onScroll = (notification: ScrollNotification): void => {
    if (
      !(notification instanceof ScrollUpdateNotification) ||
      this.measureQueued ||
      !(this.context instanceof Element)
    )
      return;
    this.measureQueued = true;
    this.context.owner.postFrame(() => {
      this.measureQueued = false;
      if (!this.mounted || !this.observer || this.maximumIconHeight <= 0) return;
      const render = this.context.findRenderObject();
      if (!(render instanceof RenderBox) || !render.hasSize) return;
      const threshold = this.maximumIconHeight * minimumVisibleHeightFraction;
      const fade =
        1 -
        clampDouble((render.size.height - threshold) / (this.maximumIconHeight - threshold), 0, 1);
      if (this.fadeExtent !== fade)
        this.setState(() => {
          this.fadeExtent = fade;
        });
    });
  };
  private animatedInsets(context: BuildContext, insets: EdgeInsetsGeometry): EdgeInsetsGeometry {
    if (this.fadeExtent === 0) return insets;
    const resolved = insets.resolve(Directionality.of(context));
    return EdgeInsetsGeometry.lerp(
      insets,
      resolved.copyWith({ top: resolved.top / 2 }),
      this.fadeExtent,
    )!;
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
      const previous = old.options.controller;
      this.localText = new EditorTextRestoration(previous?.text, previous?.selection);
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
    this.observer?.removeListener(this.onScroll);
    this.observer = null;
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
    const prefixPadding = o.prefixInsets ?? prefixInsets;
    const suffixPadding = o.suffixInsets ?? suffixInsets;
    this.maximumIconHeight = size + Math.max(prefixPadding.vertical, suffixPadding.vertical);
    const opacity = 1 - this.fadeExtent;
    const placeholderColor = CupertinoColors.secondaryLabel.resolveFrom(context);
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
          smartDashesType: o.smartDashesType ?? null,
          smartQuotesType: o.smartQuotesType ?? null,
          ...(o.enabled === undefined ? {} : { enabled: o.enabled }),
          ...(o.cursorWidth === undefined ? {} : { cursorWidth: o.cursorWidth }),
          ...(o.cursorHeight === undefined ? {} : { cursorHeight: o.cursorHeight }),
          ...(o.cursorRadius === undefined ? {} : { cursorRadius: o.cursorRadius }),
          ...(o.cursorColor ? { cursorColor: o.cursorColor } : {}),
          controller: this.controller,
          focusNode: focus,
          decoration,
          padding: this.animatedInsets(context, o.padding ?? inputPadding),
          placeholder: o.placeholder ?? strings.searchTextFieldPlaceholderLabel,
          placeholderStyle:
            o.placeholderStyle ??
            new TextStyle({
              color: placeholderColor.withOpacity(placeholderColor.a * opacity).toARGB32(),
            }),
          prefix: new Opacity(
            new Padding(
              this.animatedInsets(context, prefixPadding),
              new IconTheme(
                new IconThemeData({
                  color,
                  size: size >= 30 && focus.hasFocus ? 0 : size,
                  applyTextScaling: false,
                }),
                o.prefixIcon ?? new Icon(CupertinoIcons.search),
              ),
            ),
            { opacity },
          ),
          suffix: new Opacity(
            new Padding(
              this.animatedInsets(context, suffixPadding),
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
            { opacity },
          ),
          suffixMode: o.suffixMode ?? OverlayVisibilityMode.editing,
          textInputAction: 'search',
        }),
    );
  }
}
