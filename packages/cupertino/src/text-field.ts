// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/cupertino/text_field.dart
// Revision: 71e4717a61786faab4c7aa39825989305ed29e8a
import { StatefulWidget, State, Element } from '@nelyx/core/framework/widgets/framework';
import type { Widget, WidgetOptions, BuildContext } from '@nelyx/core/framework/widgets/framework';
import { Align, Expanded, Padding, Row, SizedBox, Text } from '@nelyx/core/framework/widgets/basic';
import { Container } from '@nelyx/core/framework/widgets/container';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { Visibility } from '@nelyx/core/framework/widgets/visibility';
import { IgnorePointer } from '@nelyx/core/framework/widgets/pointer-blocking';
import { ExcludeFocus } from '@nelyx/core/framework/widgets/focus-scope';
import { TextFieldTapRegion } from '@nelyx/core/framework/widgets/tap-region';
import {
  EditableText,
  EditorTextRestoration,
  TextEditingController,
} from '@nelyx/core/framework/widgets/editable-text';
import { SpellCheckConfiguration } from '@nelyx/core/framework/widgets/spell-check';
import type {
  EditableTextOptions,
  EditableTextState,
} from '@nelyx/core/framework/widgets/editable-text';
import {
  RestorationMixin,
  UnmanagedRestorationScope,
} from '@nelyx/core/framework/widgets/restoration';
import {
  cupertinoTextSelectionHandleControls,
  cupertinoDesktopTextSelectionHandleControls,
} from './text-selection.ts';
import { CupertinoAdaptiveTextSelectionToolbar } from './adaptive-text-selection-toolbar.ts';
import { CupertinoSpellCheckSuggestionsToolbar } from './spell-check-suggestions-toolbar.ts';
import { CupertinoTextMagnifier } from './magnifier.ts';
import { TextMagnifierConfiguration } from '@nelyx/core/framework/widgets/magnifier';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { GestureDetector } from '@nelyx/core/framework/widgets/gesture-detector';
import { ControlInteraction } from '@nelyx/core/framework/widgets/control-interaction';
import { DefaultSelectionStyle } from '@nelyx/core/framework/widgets/default-selection-style';
import { Icon } from '@nelyx/core/framework/widgets/icon';
import { HitTestBehavior } from '@nelyx/core/framework/rendering/pointer-listener';
import { validateEditableLinePolicy } from '@nelyx/core/framework/rendering/editable';
import type { CrossAxisAlignment } from '@nelyx/core/framework/rendering/boxes';
import { Alignment } from '@nelyx/core/framework/painting/alignment';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { TextAlignVertical } from '@nelyx/core/framework/painting/text-align-vertical';
import { BoxDecoration } from '@nelyx/core/framework/painting/box-decoration';
import { Border } from '@nelyx/core/framework/painting/box-border';
import { BorderSide } from '@nelyx/core/framework/painting/borders';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { Color } from '@nelyx/core/ui/color';
import { Offset } from '@nelyx/core/ui/offset';
import { Radius } from '@nelyx/core/ui/radius';
import { FontWeight, TextDecoration } from '@nelyx/core/ui/typography';
import type { TextAlign } from '@nelyx/core/ui/typography';
import type {
  TextInputAction,
  EditingKeyboardType,
  EditingCapitalization,
} from '@nelyx/core/hosting/interaction';
import { LengthLimitingTextInputFormatter } from '@nelyx/core/services/input-formatters';
import type {
  MaxLengthEnforcement,
  TextInputFormatter,
} from '@nelyx/core/services/input-formatters';
import type { SmartDashesType, SmartQuotesType } from '@nelyx/core/services/text-input';
import { invariant } from '@nelyx/core/foundation/errors';
import { CupertinoTheme } from './theme.ts';
import { CupertinoColors, CupertinoDynamicColor } from './colors.ts';
import { CupertinoIcons } from './icons.ts';
import { CupertinoLocalizations } from './cupertino-localizations.ts';
import { BaselineAlignedStack } from './internal/input/baseline-aligned-stack.ts';

export class OverlayVisibilityMode {
  static readonly never = new OverlayVisibilityMode(0, 'never');
  static readonly editing = new OverlayVisibilityMode(1, 'editing');
  static readonly notEditing = new OverlayVisibilityMode(2, 'notEditing');
  static readonly always = new OverlayVisibilityMode(3, 'always');
  static readonly values: readonly OverlayVisibilityMode[] = Object.freeze([
    this.never,
    this.editing,
    this.notEditing,
    this.always,
  ]);
  private constructor(
    readonly index: number,
    readonly name: string,
  ) {
    Object.freeze(this);
  }
  toString(): string {
    return 'OverlayVisibilityMode.' + this.name;
  }
}
const defaultPlaceholderStyle = new TextStyle({ fontWeight: FontWeight.w400 });
const roundedBorderRadius = BorderRadius.circular(5);
const cursorRadius = Radius.circular(2);
const horizontalCursorOffsetPixels = -2;
const defaultScrollPadding = EdgeInsets.fromLTRB(20, 20, 20, 20);
const roundedBorderColor = CupertinoDynamicColor.withBrightness({
  color: new Color(0x33000000),
  darkColor: new Color(0x33ffffff),
});
const roundedBackground = CupertinoDynamicColor.withBrightness({
  color: CupertinoColors.white,
  darkColor: CupertinoColors.black,
});
const disabledBackground = CupertinoDynamicColor.withBrightness({
  color: new Color(0xfffafafa),
  darkColor: new Color(0xff050505),
});
const clearButtonColor = CupertinoDynamicColor.withBrightness({
  color: new Color(0x33000000),
  darkColor: new Color(0x33ffffff),
});
const roundedBorder = (color: Color) =>
  Border.fromBorderSide(new BorderSide({ color: color.toARGB32(), width: 0 }));
const defaultDecoration = new BoxDecoration({
  color: CupertinoColors.white.toARGB32(),
  border: roundedBorder(new Color(0x33000000)),
  borderRadius: roundedBorderRadius,
});
const show = (mode: OverlayVisibilityMode, hasText: boolean) =>
  mode === OverlayVisibilityMode.always ||
  mode === (hasText ? OverlayVisibilityMode.editing : OverlayVisibilityMode.notEditing);
export interface CupertinoTextFieldOptions extends WidgetOptions {
  readonly id: string;
  readonly controller?: TextEditingController | null;
  readonly focusNode?: FocusNode | null;
  readonly groupId?: EditableTextOptions['groupId'];
  readonly onTapOutside?: EditableTextOptions['onTapOutside'];
  readonly onTapUpOutside?: EditableTextOptions['onTapUpOutside'];
  readonly decoration?: BoxDecoration | null;
  readonly padding?: EdgeInsetsGeometry;
  readonly placeholder?: string | null;
  readonly placeholderStyle?: TextStyle | null;
  readonly prefix?: Widget | null;
  readonly prefixMode?: OverlayVisibilityMode;
  readonly suffix?: Widget | null;
  readonly suffixMode?: OverlayVisibilityMode;
  readonly clearButtonMode?: OverlayVisibilityMode;
  readonly clearButtonSemanticLabel?: string | null;
  readonly crossAxisAlignment?: CrossAxisAlignment;
  readonly style?: TextStyle | null;
  readonly textAlign?: TextAlign;
  readonly textAlignVertical?: TextAlignVertical | null;
  readonly textDirection?: 'ltr' | 'rtl';
  readonly enabled?: boolean;
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
  readonly minLines?: number | null;
  readonly maxLines?: number | null;
  readonly expands?: boolean;
  readonly maxLength?: number | null;
  readonly maxLengthEnforcement?: MaxLengthEnforcement | null;
  readonly inputFormatters?: readonly TextInputFormatter[];
  readonly cursorColor?: Color | null;
  readonly scrollController?: EditableTextOptions['scrollController'];
  readonly scrollPhysics?: EditableTextOptions['scrollPhysics'];
  readonly cursorWidth?: number;
  readonly cursorHeight?: number;
  readonly cursorRadius?: Radius | null;
  readonly showCursor?: boolean | null;
  readonly scrollPadding?: EditableTextOptions['scrollPadding'];
  readonly restorationId?: string | null;
  readonly strutStyle?: EditableTextOptions['strutStyle'];
  readonly textScaler?: EditableTextOptions['textScaler'];
  readonly enableInteractiveSelection?: boolean | null;
  readonly selectionControls?: EditableTextOptions['selectionControls'];
  readonly contextMenuBuilder?: EditableTextOptions['contextMenuBuilder'];
  readonly spellCheckConfiguration?: SpellCheckConfiguration | null;
  readonly magnifierConfiguration?: EditableTextOptions['magnifierConfiguration'];
  readonly onChanged?: (text: string) => void;
  readonly onEditingComplete?: () => void;
  readonly onSubmitted?: (text: string) => void;
  readonly onTap?: () => void;
}
const defaultMagnifier = new TextMagnifierConfiguration({
  magnifierBuilder: (_context, controller, magnifierInfo) =>
    ['android', 'iOS', 'fuchsia'].includes(FoundationPlatform.defaultTargetPlatform)
      ? new CupertinoTextMagnifier({ controller, magnifierInfo })
      : null,
});
export class CupertinoTextField extends StatefulWidget {
  static readonly cupertinoMisspelledTextStyle = new TextStyle({
    decoration: TextDecoration.underline,
    decorationColor: CupertinoColors.systemRed.toARGB32(),
    decorationStyle: 'dotted',
  });
  static readonly kMisspelledSelectionColor = new Color(0x62ff9699);

  static defaultSpellCheckSuggestionsToolbarBuilder(
    _context: BuildContext,
    editableTextState: EditableTextState,
  ): Widget {
    return CupertinoSpellCheckSuggestionsToolbar.editableText({ editableTextState });
  }

  static inferIOSSpellCheckConfiguration(
    configuration?: SpellCheckConfiguration | null,
    context?: BuildContext,
  ): SpellCheckConfiguration {
    if (!configuration?.spellCheckEnabled) return SpellCheckConfiguration.disabled();
    const defaultStyle = this.cupertinoMisspelledTextStyle;
    return configuration.copyWith({
      misspelledTextStyle:
        configuration.misspelledTextStyle ??
        (context
          ? defaultStyle.copyWith({
              decorationColor: CupertinoDynamicColor.resolve(
                CupertinoColors.systemRed,
                context,
              ).toARGB32(),
            })
          : defaultStyle),
      misspelledSelectionColor:
        configuration.misspelledSelectionColor ?? this.kMisspelledSelectionColor,
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
    return CupertinoAdaptiveTextSelectionToolbar.buttonItems({
      anchors: state.contextMenuAnchors,
      buttonItems: state.contextMenuButtonItems,
    });
  }
  readonly options: Readonly<CupertinoTextFieldOptions>;
  constructor(options: CupertinoTextFieldOptions) {
    super(options.key ?? null);
    invariant(
      options.groupId !== null,
      'invalid-editor-group',
      'TextField groupId must not be null',
    );
    invariant(
      typeof options.id === 'string' && options.id.length > 0,
      'invalid-editor-id',
      'CupertinoTextField requires a stable editor id',
    );
    validateEditableLinePolicy({
      minLines: options.minLines ?? null,
      maxLines: options.maxLines === undefined ? 1 : options.maxLines,
      expands: options.expands ?? false,
    });
    invariant(
      !options.obscureText || (options.maxLines === undefined ? 1 : options.maxLines) === 1,
      'obscured-multiline-editor',
      'Obscured fields must be single-line',
    );
    invariant(
      options.maxLength == null ||
        (Number.isSafeInteger(options.maxLength) && options.maxLength > 0),
      'invalid-text-limit',
      'Cupertino maxLength must be positive',
    );
    for (const mode of [options.prefixMode, options.suffixMode, options.clearButtonMode])
      invariant(
        mode === undefined || OverlayVisibilityMode.values.includes(mode),
        'invalid-overlay-mode',
        'Expected canonical OverlayVisibilityMode',
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
  static borderless(options: CupertinoTextFieldOptions): CupertinoTextField {
    return new CupertinoTextField({ ...options, decoration: options.decoration ?? null });
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
  get decoration(): BoxDecoration | null {
    return this.options.decoration === undefined ? defaultDecoration : this.options.decoration;
  }
  get padding(): EdgeInsetsGeometry {
    return this.options.padding ?? EdgeInsets.all(7);
  }
  get placeholder(): string | null {
    return this.options.placeholder ?? null;
  }
  get prefixMode(): OverlayVisibilityMode {
    return this.options.prefixMode ?? OverlayVisibilityMode.always;
  }
  get suffixMode(): OverlayVisibilityMode {
    return this.options.suffixMode ?? OverlayVisibilityMode.always;
  }
  get clearButtonMode(): OverlayVisibilityMode {
    return this.options.clearButtonMode ?? OverlayVisibilityMode.never;
  }
  get maxLines(): number | null {
    return this.options.maxLines === undefined ? 1 : this.options.maxLines;
  }
  get minLines(): number | null {
    return this.options.minLines ?? null;
  }
  get expands(): boolean {
    return this.options.expands ?? false;
  }
  override createState(): State<CupertinoTextField> {
    return new CupertinoTextFieldState();
  }
}
class CupertinoTextFieldState extends RestorationMixin<CupertinoTextField> {
  private readonly editorKey = new GlobalKey<EditableTextState>('Cupertino TextField editor');
  private controller!: TextEditingController;
  private focus!: FocusNode;
  private localText: EditorTextRestoration | null = null;
  private ownsFocus = false;
  private queued = false;
  override get restorationId(): string | null {
    return this.widget.options.restorationId ?? null;
  }
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
  private connectController(previous?: TextEditingController): void {
    this.localText = this.widget.controller
      ? null
      : new EditorTextRestoration(previous?.text, previous?.selection);
    this.controller = this.widget.controller ?? this.localText!.controller;
    this.controller.addListener(this.changed);
  }
  private connectFocus(): void {
    this.ownsFocus = this.widget.focusNode === null;
    this.focus = this.widget.focusNode ?? new FocusNode();
    this.focus.addListener(this.changed);
  }
  override initState(): void {
    super.initState();
    this.connectController();
    this.connectFocus();
  }
  override restoreState(): void {
    if (this.localText) this.registerForRestoration(this.localText, 'controller');
  }
  override didUpdateWidget(old: CupertinoTextField): void {
    const retiredText = old.controller !== this.widget.controller ? this.localText : null;
    if (retiredText) {
      this.unregisterFromRestoration(retiredText);
      this.localText = null;
    }
    super.didUpdateWidget(old);
    const context = this.context;
    invariant(
      context instanceof Element,
      'invalid-field-context',
      'CupertinoTextField requires an Element',
    );
    if (old.controller !== this.widget.controller) {
      const previous = this.controller;
      previous.removeListener(this.changed);
      this.connectController(previous);
      if (this.localText) this.registerForRestoration(this.localText, 'controller');
      if (retiredText) context.owner.postFrame(() => retiredText.dispose());
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
    this.controller.removeListener(this.changed);
    this.focus.removeListener(this.changed);
    try {
      super.dispose();
    } finally {
      this.localText?.dispose();
      if (this.ownsFocus) this.focus.dispose();
    }
  }
  private readonly clear = () => {
    if (
      !this.mounted ||
      !(this.context instanceof Element) ||
      !this.context.active ||
      this.widget.options.enabled === false
    )
      return;
    const controller = this.controller,
      hadText = controller.text.length > 0;
    controller.clear(() => {
      if (
        hadText &&
        this.mounted &&
        this.controller === controller &&
        this.context instanceof Element &&
        this.context.active
      )
        this.widget.options.onChanged?.(controller.text);
    });
  };
  private clearButton(context: BuildContext): Widget {
    const enabled = this.widget.options.enabled !== false,
      label =
        this.widget.options.clearButtonSemanticLabel ??
        CupertinoLocalizations.of(context).clearButtonLabel;
    return new ControlInteraction(
      () =>
        new Padding(
          EdgeInsets.symmetric({ horizontal: 6 }),
          new Icon(CupertinoIcons.clear_thick_circled, {
            size: 18,
            color: CupertinoDynamicColor.resolve(clearButtonColor, context),
          }),
        ),
      {
        enabled,
        onPressed: this.clear,
        requestFocusOnPointer: false,
        semantics: { transportId: this.widget.id + '-clear', button: true, label },
      },
    );
  }
  build(context: BuildContext): Widget {
    const o = this.widget.options,
      theme = CupertinoTheme.of(context),
      enabled = o.enabled !== false,
      hasText = this.controller.text.length > 0;
    const style = theme.textTheme.textStyle.merge(o.style),
      placeholderStyle = style.merge(
        o.placeholderStyle === undefined
          ? defaultPlaceholderStyle.copyWith({
              color: CupertinoColors.placeholderText.resolveFrom(context).toARGB32(),
            })
          : o.placeholderStyle,
      );
    const selection = DefaultSelectionStyle.of(context),
      cursorColor =
        (o.cursorColor && CupertinoDynamicColor.resolve(o.cursorColor, context).toARGB32()) ??
        selection.cursorColor ??
        theme.primaryColor;
    const editable = new EditableText(
      o.id,
      this.controller,
      o.placeholder ?? '',
      this.focus,
      0,
      this.editorKey,
      {
        selectionControls:
          o.selectionControls ??
          (['android', 'iOS', 'fuchsia'].includes(FoundationPlatform.defaultTargetPlatform)
            ? cupertinoTextSelectionHandleControls
            : cupertinoDesktopTextSelectionHandleControls),
        contextMenuBuilder:
          o.contextMenuBuilder === undefined
            ? CupertinoTextField.defaultContextMenuBuilder
            : o.contextMenuBuilder,
        spellCheckConfiguration: CupertinoTextField.inferIOSSpellCheckConfiguration(
          o.spellCheckConfiguration,
          context,
        ),
        magnifierConfiguration: o.magnifierConfiguration ?? defaultMagnifier,
        cursorWidth: o.cursorWidth ?? 2,
        cursorRadius: o.cursorRadius === undefined ? cursorRadius : o.cursorRadius,
        cursorOffset: new Offset(
          horizontalCursorOffsetPixels / MediaQuery.devicePixelRatioOf(context),
          0,
        ),
        showCursor: o.showCursor ?? !o.readOnly,
        scrollPadding: o.scrollPadding ?? defaultScrollPadding,
        restorationId: 'editable',
        ...(o.cursorHeight !== undefined ? { cursorHeight: o.cursorHeight } : {}),
        ...(o.strutStyle ? { strutStyle: o.strutStyle } : {}),
        ...(o.textScaler ? { textScaler: o.textScaler } : {}),
        enableInteractiveSelection: this.widget.enableInteractiveSelection,
        groupId: this.widget.groupId,
        ...(o.onTapOutside !== undefined ? { onTapOutside: o.onTapOutside } : {}),
        ...(o.onTapUpOutside !== undefined ? { onTapUpOutside: o.onTapUpOutside } : {}),
        configuration: {
          readOnly: o.readOnly ?? false,
          obscureText: o.obscureText ?? false,
          autocorrect: o.autocorrect ?? true,
          enableSuggestions: o.enableSuggestions ?? true,
          keyboardType: o.keyboardType ?? 'text',
          keyboardAppearance: o.keyboardAppearance ?? CupertinoTheme.brightnessOf(context),
          smartDashesType: o.smartDashesType ?? null,
          smartQuotesType: o.smartQuotesType ?? null,
          stylusHandwritingEnabled:
            (o.scribbleEnabled ?? true) && (o.stylusHandwritingEnabled ?? true),
          capitalization: o.textCapitalization ?? 'none',
          autofillHints: o.autofillHints === undefined ? [] : o.autofillHints,
        },
        textStyle: style,
        textAlign: o.textAlign ?? 'start',
        ...(o.textDirection ? { textDirection: o.textDirection } : {}),
        enabled,
        minHeight: 0,
        autofocus: o.autofocus ?? false,
        maxLines: this.widget.maxLines,
        minLines: this.widget.minLines,
        expands: this.widget.expands,
        scrollController: o.scrollController ?? null,
        scrollPhysics: o.scrollPhysics ?? null,
        cursorColor,
        selectionColor: this.focus.hasFocus
          ? (selection.selectionColor ?? new Color(theme.primaryColor).withOpacity(0.2).toARGB32())
          : 0,
        inputFormatters: [
          ...(o.inputFormatters ?? []),
          ...(o.maxLength == null || o.maxLengthEnforcement === 'none'
            ? []
            : [
                new LengthLimitingTextInputFormatter(
                  o.maxLength,
                  o.maxLengthEnforcement ??
                    LengthLimitingTextInputFormatter.getDefaultMaxLengthEnforcement(),
                ),
              ]),
        ],
        ...(o.textInputAction ? { action: o.textInputAction } : {}),
        ...(o.onChanged ? { onChanged: o.onChanged } : {}),
        ...(o.onEditingComplete ? { onEditingComplete: o.onEditingComplete } : {}),
        ...(o.onSubmitted ? { onSubmitted: o.onSubmitted } : {}),
        ...(o.onTap ? { onTap: o.onTap } : {}),
      },
    );
    const editor = new Padding(
      this.widget.padding,
      new UnmanagedRestorationScope({ bucket: this.bucket, child: editable }),
    );
    const attachments =
        o.placeholder != null ||
        o.prefix != null ||
        o.suffix != null ||
        this.widget.clearButtonMode !== OverlayVisibilityMode.never,
      vertical =
        o.textAlignVertical ?? (attachments ? TextAlignVertical.center : TextAlignVertical.top);
    let child: Widget = editor;
    if (attachments) {
      const placeholder =
        o.placeholder == null
          ? null
          : new IgnorePointer(
              new Visibility(
                new SizedBox(
                  Infinity,
                  undefined,
                  new Padding(
                    this.widget.padding,
                    new Text(o.placeholder, {
                      style: placeholderStyle,
                      textAlign: o.textAlign ?? 'start',
                      ...(hasText
                        ? { maxLines: 1 }
                        : this.widget.maxLines === null
                          ? {}
                          : { maxLines: this.widget.maxLines }),
                      overflow: placeholderStyle.overflow ?? 'clip',
                    }),
                  ),
                ),
                {
                  visible: !hasText,
                  maintainAnimation: true,
                  maintainSize: true,
                  maintainState: true,
                },
              ),
            );
      const prefix = show(this.widget.prefixMode, hasText) ? o.prefix : null,
        suffix = show(this.widget.suffixMode, hasText) ? o.suffix : null,
        clear = show(this.widget.clearButtonMode, hasText);
      child = new Row(
        [
          ...(prefix ? [prefix] : []),
          new Expanded(
            new Directionality(
              o.textDirection ?? Directionality.of(context),
              new BaselineAlignedStack(editor, placeholder, {
                vertical,
                editorBaseline: style.textBaseline ?? 'alphabetic',
                placeholderBaseline: placeholderStyle.textBaseline ?? 'alphabetic',
              }),
            ),
          ),
          ...(suffix ? [suffix] : clear ? [this.clearButton(context)] : []),
        ],
        { crossAxisAlignment: o.crossAxisAlignment ?? 'center' },
      );
    }
    let decoration = this.widget.decoration;
    const disabledColor = CupertinoDynamicColor.resolve(disabledBackground, context).toARGB32();
    if (decoration === defaultDecoration)
      decoration = new BoxDecoration({
        color: enabled
          ? CupertinoDynamicColor.resolve(roundedBackground, context).toARGB32()
          : disabledColor,
        border: roundedBorder(CupertinoDynamicColor.resolve(roundedBorderColor, context)),
        borderRadius: roundedBorderRadius,
      });
    return new TextFieldTapRegion(
      new ExcludeFocus(
        new IgnorePointer(
          new Container({
            decoration,
            ...(!enabled && decoration === null ? { color: disabledColor } : {}),
            child: new GestureDetector(
              new Align(child, {
                alignment: new Alignment(-1, vertical.y),
                widthFactor: 1,
                heightFactor: 1,
              }),
              {
                behavior: HitTestBehavior.translucent,
                excludeFromSemantics: true,
                onTap: enabled
                  ? () => {
                      const editor = this.editorKey.currentState;
                      if (editor) editor.requestKeyboard();
                      else this.focus.requestFocus();
                      o.onTap?.();
                    }
                  : null,
              },
            ),
          }),
          { ignoring: !enabled },
        ),
        { excluding: !enabled },
      ),
      { groupId: this.widget.groupId },
    );
  }
}
