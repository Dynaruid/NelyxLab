// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/text_field.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
// M3 field composition. Core owns the editor, focus, formatting and controller.
import { StatefulWidget, Element } from '@nelyx/core/framework/widgets/framework';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import type {
  Widget,
  WidgetOptions,
  BuildContext,
  State,
} from '@nelyx/core/framework/widgets/framework';
import { EditableText, EditorTextRestoration } from '@nelyx/core/framework/widgets/editable-text';
import type {
  EditableTextOptions,
  EditableTextState,
  TextEditingController,
} from '@nelyx/core/framework/widgets/editable-text';
import {
  RestorationMixin,
  UnmanagedRestorationScope,
} from '@nelyx/core/framework/widgets/restoration';
import {
  materialTextSelectionHandleControls,
  desktopTextSelectionHandleControls,
} from './text-selection.ts';
import {
  cupertinoTextSelectionHandleControls,
  cupertinoDesktopTextSelectionHandleControls,
} from '@nelyx/cupertino/text-selection';
import { AdaptiveTextSelectionToolbar } from './adaptive-text-selection-toolbar.ts';
import { SpellCheckSuggestionsToolbar } from './spell-check-suggestions-toolbar.ts';
import { CupertinoSpellCheckSuggestionsToolbar } from '@nelyx/cupertino/spell-check-suggestions-toolbar';
import { CupertinoTextField } from '@nelyx/cupertino/text-field';
import { SpellCheckConfiguration } from '@nelyx/core/framework/widgets/spell-check';
import { TextMagnifier } from './magnifier.ts';
import { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { Directionality } from '@nelyx/core/framework/widgets/app-data';
import { ExcludeFocus } from '@nelyx/core/framework/widgets/focus-scope';
import { TextFieldTapRegion } from '@nelyx/core/framework/widgets/tap-region';
import { GestureDetector } from '@nelyx/core/framework/widgets/gesture-detector';
import { MouseRegion } from '@nelyx/core/framework/widgets/mouse-region';
import { RepaintBoundary } from '@nelyx/core/framework/widgets/repaint-boundary';
import { HitTestBehavior } from '@nelyx/core/framework/rendering/pointer-listener';
import { validateEditableLinePolicy } from '@nelyx/core/framework/rendering/editable';
import { SystemMouseCursors } from '@nelyx/core/services/mouse-cursor';
import type { MouseCursor } from '@nelyx/core/services/mouse-cursor';
import type { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import type { TextAlignVertical } from '@nelyx/core/framework/painting/text-align-vertical';
import type { TextAlign } from '@nelyx/core/ui/typography';
import { TextDecoration } from '@nelyx/core/ui/typography';
import type { TextInputAction } from '@nelyx/core/hosting/interaction';
import type { EditingKeyboardType, EditingCapitalization } from '@nelyx/core/hosting/interaction';
import { LengthLimitingTextInputFormatter } from '@nelyx/core/services/input-formatters';
import type {
  MaxLengthEnforcement,
  TextInputFormatter,
} from '@nelyx/core/services/input-formatters';
import type { SmartDashesType, SmartQuotesType } from '@nelyx/core/services/text-input';
import { graphemeBoundaries } from '@nelyx/core/foundation/grapheme-boundaries';
import { WidgetState, WidgetStateTextStyle } from '@nelyx/core/framework/widgets/widget-state';
import { emptyWidgetStateSet } from '@nelyx/core/framework/widgets/widget-state';
import { Color } from '@nelyx/core/ui/color';
import { invariant } from '@nelyx/core/foundation/errors';
import { ValueNotifier } from '@nelyx/core/foundation/notifier';
import {
  DiagnosticPropertiesBuilder,
  DiagnosticsProperty,
} from '@nelyx/core/foundation/diagnostics';
import { InputDecoration } from './input-decoration.ts';
import { InputDecorator } from './input-decorator.ts';
import { Theme } from './theme.ts';
import { TextSelectionTheme } from './text-selection-theme.ts';

export type InputCounterWidgetBuilder = (
  context: BuildContext,
  details: {
    readonly currentLength: number;
    readonly maxLength: number | null;
    readonly isFocused: boolean;
  },
) => Widget | null;
export type { MaxLengthEnforcement } from '@nelyx/core/services/input-formatters';

/** M3 field composed with shared Core/Skia layout and editing state. */
export interface TextFieldOptions extends WidgetOptions {
  readonly id: string;
  readonly restorationId?: string | null;
  readonly controller?: TextEditingController | null;
  readonly focusNode?: FocusNode | null;
  readonly canRequestFocus?: boolean;
  readonly mouseCursor?: MouseCursor | null;
  readonly scrollPadding?: EdgeInsets;
  readonly groupId?: EditableTextOptions['groupId'];
  readonly onTapOutside?: EditableTextOptions['onTapOutside'];
  readonly onTapUpOutside?: EditableTextOptions['onTapUpOutside'];
  readonly decoration?: InputDecoration | null;
  /** Accessible name when the visible label is supplied separately. */
  readonly semanticsLabel?: string;
  readonly style?: TextStyle | null;
  readonly textAlign?: TextAlign;
  readonly textAlignVertical?: TextAlignVertical | null;
  readonly textDirection?: 'ltr' | 'rtl';
  readonly enabled?: boolean | null;
  readonly readOnly?: boolean;
  readonly autofocus?: boolean;
  readonly obscureText?: boolean;
  readonly autocorrect?: boolean;
  readonly enableSuggestions?: boolean;
  readonly keyboardType?: EditingKeyboardType;
  readonly keyboardAppearance?: 'light' | 'dark' | null;
  readonly smartDashesType?: SmartDashesType | null;
  readonly smartQuotesType?: SmartQuotesType | null;
  /** @deprecated Use stylusHandwritingEnabled. */
  readonly scribbleEnabled?: boolean;
  readonly stylusHandwritingEnabled?: boolean;
  readonly textCapitalization?: EditingCapitalization;
  readonly autofillHints?: readonly string[] | null;
  readonly textInputAction?: TextInputAction;
  readonly inputFormatters?: readonly TextInputFormatter[];
  readonly maxLength?: number | null;
  readonly maxLengthEnforcement?: MaxLengthEnforcement | null;
  readonly minLines?: number | null;
  readonly maxLines?: number | null;
  readonly expands?: boolean;
  readonly scrollController?: EditableTextOptions['scrollController'];
  readonly scrollPhysics?: EditableTextOptions['scrollPhysics'];
  readonly scrollBehavior?: EditableTextOptions['scrollBehavior'];
  readonly cursorColor?: Color | null;
  readonly cursorErrorColor?: Color | null;
  readonly cursorWidth?: number;
  readonly cursorHeight?: number;
  readonly cursorRadius?: EditableTextOptions['cursorRadius'];
  readonly showCursor?: boolean | null;
  readonly strutStyle?: EditableTextOptions['strutStyle'];
  readonly textScaler?: EditableTextOptions['textScaler'];
  readonly enableInteractiveSelection?: boolean | null;
  readonly selectionControls?: EditableTextOptions['selectionControls'];
  readonly selectionHeightStyle?: EditableTextOptions['selectionHeightStyle'];
  readonly selectionWidthStyle?: EditableTextOptions['selectionWidthStyle'];
  readonly dragStartBehavior?: EditableTextOptions['dragStartBehavior'];
  readonly onSelectionChanged?: EditableTextOptions['onSelectionChanged'];
  readonly contextMenuBuilder?: EditableTextOptions['contextMenuBuilder'];
  readonly spellCheckConfiguration?: SpellCheckConfiguration | null;
  readonly magnifierConfiguration?: EditableTextOptions['magnifierConfiguration'];
  readonly onChanged?: (text: string) => void;
  readonly onEditingComplete?: () => void;
  readonly onSubmitted?: (text: string) => void;
  readonly onTap?: () => void;
  readonly onTapAlwaysCalled?: boolean;
  readonly buildCounter?: InputCounterWidgetBuilder | null;
}
export class TextField extends StatefulWidget {
  static readonly materialMisspelledTextStyle = new TextStyle({
    decoration: TextDecoration.underline,
    decorationColor: 0xfff44336,
    decorationStyle: 'wavy',
  });

  static defaultSpellCheckSuggestionsToolbarBuilder(
    _context: BuildContext,
    editableTextState: EditableTextState,
  ): Widget {
    return ['iOS', 'macOS'].includes(FoundationPlatform.defaultTargetPlatform)
      ? CupertinoSpellCheckSuggestionsToolbar.editableText({ editableTextState })
      : SpellCheckSuggestionsToolbar.editableText({ editableTextState });
  }

  static inferAndroidSpellCheckConfiguration(
    configuration?: SpellCheckConfiguration | null,
  ): SpellCheckConfiguration {
    if (!configuration?.spellCheckEnabled) return SpellCheckConfiguration.disabled();
    return configuration.copyWith({
      misspelledTextStyle: configuration.misspelledTextStyle ?? this.materialMisspelledTextStyle,
      spellCheckSuggestionsToolbarBuilder:
        configuration.spellCheckSuggestionsToolbarBuilder ??
        this.defaultSpellCheckSuggestionsToolbarBuilder,
    });
  }
  get enableInteractiveSelection(): boolean {
    return (
      this.options.enableInteractiveSelection ??
      (!this.options.readOnly || !this.options.obscureText)
    );
  }
  get selectionEnabled(): boolean {
    return this.enableInteractiveSelection;
  }
  static defaultContextMenuBuilder(_context: BuildContext, state: EditableTextState): Widget {
    return AdaptiveTextSelectionToolbar.buttonItems({
      anchors: state.contextMenuAnchors,
      buttonItems: state.contextMenuButtonItems,
    });
  }
  static readonly noMaxLength = -1;
  readonly options: Readonly<TextFieldOptions>;
  constructor(options: TextFieldOptions) {
    super(options.key ?? null);
    invariant(
      options.groupId !== null,
      'invalid-editor-group',
      'TextField groupId must not be null',
    );
    invariant(
      typeof options.id === 'string' && options.id.length > 0,
      'invalid-editor-id',
      'TextField requires a stable editor id',
    );
    invariant(
      options.maxLength == null ||
        options.maxLength === TextField.noMaxLength ||
        (Number.isSafeInteger(options.maxLength) && options.maxLength > 0),
      'invalid-text-limit',
      'TextField maxLength must be positive or noMaxLength',
    );
    invariant(
      options.decoration == null || options.decoration instanceof InputDecoration,
      'invalid-input-decoration',
      'TextField decoration must be canonical',
    );
    const maxLines = options.maxLines === undefined ? 1 : options.maxLines;
    validateEditableLinePolicy({
      maxLines,
      minLines: options.minLines ?? null,
      expands: options.expands ?? false,
    });
    invariant(
      !options.obscureText || maxLines === 1,
      'obscured-multiline-editor',
      'Obscured fields must be single-line',
    );
    this.options = Object.freeze({
      ...options,
      ...(options.inputFormatters
        ? { inputFormatters: Object.freeze([...options.inputFormatters]) }
        : {}),
      ...(options.autofillHints
        ? { autofillHints: Object.freeze([...options.autofillHints]) }
        : {}),
    });
  }
  get enabled(): boolean {
    return this.options.enabled ?? this.options.decoration?.enabled ?? true;
  }
  get groupId(): NonNullable<unknown> {
    return this.options.groupId ?? EditableText;
  }
  get id(): string {
    return this.options.id;
  }
  get controller(): TextEditingController | null {
    return this.options.controller ?? null;
  }
  get focusNode(): FocusNode | null {
    return this.options.focusNode ?? null;
  }
  get decoration(): InputDecoration | null {
    return this.options.decoration === undefined ? new InputDecoration() : this.options.decoration;
  }
  get minLines(): number | null {
    return this.options.minLines ?? null;
  }
  get maxLines(): number | null {
    return this.options.maxLines === undefined ? 1 : this.options.maxLines;
  }
  get expands(): boolean {
    return this.options.expands ?? false;
  }
  override createState(): State<TextField> {
    return new TextFieldState();
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    for (const name of [
      'id',
      'controller',
      'focusNode',
      'decoration',
      'style',
      'readOnly',
      'maxLength',
    ] as const)
      properties.add(new DiagnosticsProperty(name, this.options[name] ?? null));
    for (const name of ['enabled', 'minLines', 'maxLines', 'expands'] as const)
      properties.add(new DiagnosticsProperty(name, this[name]));
  }
}
class TextFieldState extends RestorationMixin<TextField> {
  private readonly editorKey = new GlobalKey('Material TextField editor');
  private controller!: TextEditingController;
  private localText: EditorTextRestoration | null = null;
  private focus!: FocusNode;
  private ownsFocus = false;
  private readonly hovering = new ValueNotifier(false);
  private queued = false;
  private editorCache:
    | {
        readonly widget: TextField;
        readonly style: TextStyle;
        readonly controller: TextEditingController;
        readonly focus: FocusNode;
        readonly hasError: boolean;
        readonly editor: EditableText;
      }
    | undefined;
  private readonly changed = () => {
    if (!this.mounted || !(this.context instanceof Element) || !this.context.active) return;
    if (this.context.owner.building) {
      if (!this.queued) {
        this.queued = true;
        this.context.owner.postFrame(() => {
          this.queued = false;
          if (this.mounted && this.context instanceof Element && this.context.active)
            this.setState(() => {});
        });
      }
    } else this.setState(() => {});
  };
  private setHovering(value: boolean): void {
    if (this.hovering.value === value || !this.mounted || !(this.context as Element).active) return;
    this.hovering.value = value;
    if (this.widget.options.style instanceof WidgetStateTextStyle) this.changed();
  }
  override get restorationId(): string | null {
    return this.widget.options.restorationId ?? null;
  }
  override restoreState(): void {
    if (this.localText) this.registerForRestoration(this.localText, 'controller');
  }
  private connectController(previous?: TextEditingController): void {
    this.localText = this.widget.controller
      ? null
      : new EditorTextRestoration(previous?.text, previous?.selection);
    this.controller = this.widget.controller ?? this.localText!.controller;
    this.controller.addListener(this.changed);
  }
  private connectFocus(): void {
    this.ownsFocus = this.widget.options.focusNode == null;
    this.focus = this.widget.options.focusNode ?? new FocusNode();
    this.focus.addListener(this.changed);
  }
  override initState(): void {
    super.initState();
    this.connectController();
    this.connectFocus();
  }
  override didChangeDependencies(): void {
    super.didChangeDependencies();
    this.editorCache = undefined;
  }
  override didUpdateWidget(old: TextField): void {
    const changedController = old.controller !== this.widget.controller;
    const retiredText = changedController ? this.localText : null;
    if (retiredText) {
      this.unregisterFromRestoration(retiredText);
      this.localText = null;
    }
    super.didUpdateWidget(old);
    const context = this.context;
    invariant(context instanceof Element, 'invalid-field-context', 'TextField requires an Element');
    if (changedController) {
      const previous = this.controller;
      previous.removeListener(this.changed);
      this.connectController(previous);
      if (retiredText) context.owner.postFrame(() => retiredText.dispose());
      if (this.localText) this.registerForRestoration(this.localText, 'controller');
    }
    if (old.focusNode !== this.widget.focusNode) {
      const previous = this.focus,
        owned = this.ownsFocus;
      previous.removeListener(this.changed);
      this.connectFocus();
      if (owned) context.owner.postFrame(() => previous.dispose());
    }
  }
  override dispose(): void {
    try {
      this.controller.removeListener(this.changed);
      this.focus.removeListener(this.changed);
      this.localText?.dispose();
      if (this.ownsFocus) this.focus.dispose();
      this.hovering.dispose();
    } finally {
      this.editorCache = undefined;
      super.dispose();
    }
  }
  build(context: BuildContext): Widget {
    const o = this.widget.options,
      theme = Theme.of(context),
      selection = TextSelectionTheme.of(context),
      enabled = this.widget.enabled,
      states = emptyWidgetStateSet();
    if (!enabled) states.add(WidgetState.disabled);
    if (this.focus.hasFocus) states.add(WidgetState.focused);
    if (this.hovering.value) states.add(WidgetState.hovered);
    let decoration = o.decoration === undefined ? new InputDecoration() : o.decoration;
    const currentLength = graphemeBoundaries(this.controller.text).length - 1;
    const maxLength = o.maxLength ?? null;
    const overLimit = maxLength !== null && maxLength > 0 && currentLength > maxLength;
    const hasError =
      decoration !== null &&
      (decoration.error !== null || decoration.errorText !== null || overLimit);
    if (hasError) states.add(WidgetState.error);
    const given = o.style instanceof WidgetStateTextStyle ? o.style.resolve(states) : o.style;
    const defaultStyle =
      (theme.useMaterial3 ? theme.textTheme.bodyLarge : theme.textTheme.titleMedium) ??
      new TextStyle({ fontSize: 16 });
    const style = (
      enabled
        ? defaultStyle
        : defaultStyle.copyWith({
            color: theme.useMaterial3
              ? defaultStyle.color == null
                ? null
                : new Color(defaultStyle.color).withOpacity(0.38).toARGB32()
              : theme.disabledColor.toARGB32(),
          })
    ).merge(given);
    if (decoration) {
      decoration = decoration.copyWith({ enabled });
      if (overLimit) {
        decoration = decoration.copyWith({
          ...(decoration.error === null ? { errorText: decoration.errorText ?? '' } : {}),
          counterStyle:
            decoration.errorStyle ??
            (theme.textTheme.bodySmall ?? new TextStyle({ fontSize: 12 })).copyWith({
              color: theme.colorScheme.error,
            }),
        });
      }
      if (decoration.counter === null && decoration.counterText === null) {
        if (o.buildCounter) {
          const counter = o.buildCounter(context, {
            currentLength,
            maxLength,
            isFocused: this.focus.hasFocus,
          });
          decoration = counter ? decoration.copyWith({ counter }) : decoration;
        } else if (maxLength !== null)
          decoration = decoration.copyWith({
            counterText:
              maxLength === TextField.noMaxLength
                ? String(currentLength)
                : `${currentLength}/${maxLength}`,
            semanticCounterText:
              maxLength === TextField.noMaxLength
                ? String(currentLength)
                : `${currentLength} of ${maxLength}`,
          });
      }
    }
    const formatters = [
      ...(o.inputFormatters ?? []),
      ...(maxLength !== null && maxLength > 0 && o.maxLengthEnforcement !== 'none'
        ? [
            new LengthLimitingTextInputFormatter(
              maxLength,
              o.maxLengthEnforcement ??
                LengthLimitingTextInputFormatter.getDefaultMaxLengthEnforcement(theme.platform),
            ),
          ]
        : []),
    ];
    // Hover decoration can change while the editor's inputs stay identical.
    // The editor listens to its controller/focus and inherited dependencies;
    // retain its Widget instead of reconfiguring that subtree for each enter.
    const cached = this.editorCache,
      reuse =
        cached?.widget === this.widget &&
        cached.controller === this.controller &&
        cached.focus === this.focus &&
        cached.hasError === hasError &&
        cached.style.equals(style);
    const editor = reuse
      ? cached.editor
      : new EditableText(
          o.id,
          this.controller,
          o.semanticsLabel ?? decoration?.labelText ?? decoration?.hintText ?? '',
          this.focus,
          0,
          this.editorKey,
          {
            selectionControls:
              o.selectionControls ??
              (theme.platform === 'iOS'
                ? cupertinoTextSelectionHandleControls
                : theme.platform === 'macOS'
                  ? cupertinoDesktopTextSelectionHandleControls
                  : theme.platform === 'android' || theme.platform === 'fuchsia'
                    ? materialTextSelectionHandleControls
                    : desktopTextSelectionHandleControls),
            contextMenuBuilder:
              o.contextMenuBuilder === undefined
                ? TextField.defaultContextMenuBuilder
                : o.contextMenuBuilder,
            spellCheckConfiguration: ['iOS', 'macOS'].includes(
              FoundationPlatform.defaultTargetPlatform,
            )
              ? CupertinoTextField.inferIOSSpellCheckConfiguration(
                  o.spellCheckConfiguration,
                  context,
                )
              : TextField.inferAndroidSpellCheckConfiguration(o.spellCheckConfiguration),
            magnifierConfiguration:
              o.magnifierConfiguration ?? TextMagnifier.adaptiveMagnifierConfiguration,
            cursorWidth: o.cursorWidth ?? 2,
            ...(o.cursorHeight !== undefined ? { cursorHeight: o.cursorHeight } : {}),
            ...(o.cursorRadius !== undefined ? { cursorRadius: o.cursorRadius } : {}),
            showCursor: o.showCursor ?? null,
            ...(o.selectionHeightStyle ? { selectionHeightStyle: o.selectionHeightStyle } : {}),
            ...(o.selectionWidthStyle ? { selectionWidthStyle: o.selectionWidthStyle } : {}),
            ...(o.dragStartBehavior ? { dragStartBehavior: o.dragStartBehavior } : {}),
            ...(o.onSelectionChanged ? { onSelectionChanged: o.onSelectionChanged } : {}),
            forcePressEnabled: theme.platform === 'iOS',
            restorationId: 'editable',
            ...(o.scrollPadding ? { scrollPadding: o.scrollPadding } : {}),
            ...(o.strutStyle ? { strutStyle: o.strutStyle } : {}),
            ...(o.textScaler ? { textScaler: o.textScaler } : {}),
            enableInteractiveSelection: this.widget.enableInteractiveSelection,
            groupId: this.widget.groupId,
            ...(o.onTapOutside !== undefined ? { onTapOutside: o.onTapOutside } : {}),
            ...(o.onTapUpOutside !== undefined ? { onTapUpOutside: o.onTapUpOutside } : {}),
            ...(o.onTap ? { onTap: o.onTap, onTapAlwaysCalled: o.onTapAlwaysCalled ?? false } : {}),
            configuration: {
              readOnly: o.readOnly ?? false,
              obscureText: o.obscureText ?? false,
              autocorrect: o.autocorrect ?? true,
              enableSuggestions: o.enableSuggestions ?? true,
              keyboardType: o.keyboardType ?? 'text',
              keyboardAppearance: o.keyboardAppearance ?? theme.brightness,
              smartDashesType: o.smartDashesType ?? null,
              smartQuotesType: o.smartQuotesType ?? null,
              stylusHandwritingEnabled:
                (o.scribbleEnabled ?? true) && (o.stylusHandwritingEnabled ?? true),
              capitalization: o.textCapitalization ?? 'none',
              autofillHints: o.autofillHints ?? null,
            },
            textStyle: style,
            textAlign: o.textAlign ?? 'start',
            ...(o.textDirection ? { textDirection: o.textDirection } : {}),
            minHeight: 0,
            enabled,
            autofocus: o.autofocus ?? false,
            minLines: o.minLines ?? null,
            maxLines: o.maxLines === undefined ? 1 : o.maxLines,
            expands: o.expands ?? false,
            scrollController: o.scrollController ?? null,
            scrollPhysics: o.scrollPhysics ?? null,
            scrollBehavior: o.scrollBehavior ?? null,
            cursorColor: hasError
              ? (o.cursorErrorColor?.toARGB32() ?? theme.colorScheme.error)
              : (o.cursorColor?.toARGB32() ?? selection.cursorColor ?? theme.colorScheme.primary),
            selectionColor:
              selection.selectionColor ??
              new Color(theme.colorScheme.primary).withOpacity(0.4).toARGB32(),
            ...(o.textInputAction ? { action: o.textInputAction } : {}),
            inputFormatters: formatters,
            ...(o.onChanged ? { onChanged: o.onChanged } : {}),
            ...(o.onEditingComplete ? { onEditingComplete: o.onEditingComplete } : {}),
            ...(o.onSubmitted ? { onSubmitted: o.onSubmitted } : {}),
          },
        );
    if (!reuse)
      this.editorCache = {
        widget: this.widget,
        style,
        controller: this.controller,
        focus: this.focus,
        hasError,
        editor,
      };
    const editorScope = new UnmanagedRestorationScope({ bucket: this.bucket, child: editor });
    const input = o.canRequestFocus === false ? new ExcludeFocus(editorScope) : editorScope;
    const child = decoration
      ? new InputDecorator({
          decoration,
          baseStyle: style,
          textAlign: o.textAlign ?? 'start',
          textAlignVertical: o.textAlignVertical ?? null,
          expands: o.expands ?? false,
          isFocused: this.focus.hasFocus,
          isHovering: this.hovering.value,
          hoverListenable: o.style instanceof WidgetStateTextStyle ? null : this.hovering,
          isEmpty: this.controller.text.length === 0,
          child: input,
        })
      : input;
    // Keep other controls' retained recordings intact while this field's
    // hover border, selection or caret changes.
    return new RepaintBoundary(
      new Directionality(
        o.textDirection ?? Directionality.of(context),
        new TextFieldTapRegion(
          new ExcludeFocus(
            new MouseRegion(
              new GestureDetector(child, {
                behavior: HitTestBehavior.translucent,
                excludeFromSemantics: true,
                onTap: enabled
                  ? () => {
                      if (o.canRequestFocus !== false) this.focus.requestFocus();
                      o.onTap?.();
                    }
                  : null,
              }),
              {
                cursor: enabled
                  ? (o.mouseCursor ?? SystemMouseCursors.text)
                  : SystemMouseCursors.basic,
                onEnter: () => this.setHovering(true),
                onExit: () => this.setHovering(false),
              },
            ),
            { excluding: !enabled },
          ),
          { groupId: this.widget.groupId },
        ),
      ),
    );
  }
}
