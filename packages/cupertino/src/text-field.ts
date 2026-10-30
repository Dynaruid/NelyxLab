// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Cupertino composition of selected pinned behavior; Core owns editing and paint.
import { StatefulWidget, State, Element } from '@nelyx/core/framework/widgets/framework';
import type { Widget, WidgetOptions, BuildContext } from '@nelyx/core/framework/widgets/framework';
import { Align, Expanded, Padding, Row, SizedBox, Text } from '@nelyx/core/framework/widgets/basic';
import { Container } from '@nelyx/core/framework/widgets/container';
import { Directionality } from '@nelyx/core/framework/widgets/app-data';
import { Visibility } from '@nelyx/core/framework/widgets/visibility';
import { IgnorePointer } from '@nelyx/core/framework/widgets/pointer-blocking';
import { ExcludeFocus } from '@nelyx/core/framework/widgets/focus-scope';
import { TextFieldTapRegion } from '@nelyx/core/framework/widgets/tap-region';
import { EditableText, TextEditingController } from '@nelyx/core/framework/widgets/editable-text';
import type {
  EditableTextOptions,
  EditableTextState,
} from '@nelyx/core/framework/widgets/editable-text';
import {
  cupertinoTextSelectionHandleControls,
  cupertinoDesktopTextSelectionHandleControls,
} from './text-selection.ts';
import { CupertinoAdaptiveTextSelectionToolbar } from './adaptive-text-selection-toolbar.ts';
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
import { FontWeight } from '@nelyx/core/ui/typography';
import type { TextAlign } from '@nelyx/core/ui/typography';
import type {
  TextInputAction,
  EditingKeyboardType,
  EditingCapitalization,
} from '@nelyx/core/hosting/interaction';
import { LengthLimitingTextInputFormatter } from '@nelyx/core/services/input-formatters';
import type { TextInputFormatter } from '@nelyx/core/services/input-formatters';
import { invariant } from '@nelyx/core/foundation/errors';
import { CupertinoTheme } from './theme.ts';
import { CupertinoColors } from './colors.ts';
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
const defaultDecoration = new BoxDecoration({
  color: 0xffffffff,
  border: Border.fromBorderSide(new BorderSide({ color: 0x33000000, width: 0 })),
  borderRadius: BorderRadius.circular(5),
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
  readonly textCapitalization?: EditingCapitalization;
  readonly autofillHints?: readonly string[] | null;
  readonly textInputAction?: TextInputAction;
  readonly minLines?: number | null;
  readonly maxLines?: number | null;
  readonly expands?: boolean;
  readonly maxLength?: number | null;
  readonly inputFormatters?: readonly TextInputFormatter[];
  readonly cursorColor?: Color | null;
  readonly scrollController?: EditableTextOptions['scrollController'];
  readonly scrollPhysics?: EditableTextOptions['scrollPhysics'];
  readonly cursorWidth?: number;
  readonly cursorHeight?: number;
  readonly strutStyle?: EditableTextOptions['strutStyle'];
  readonly textScaler?: EditableTextOptions['textScaler'];
  readonly enableInteractiveSelection?: boolean | null;
  readonly selectionControls?: EditableTextOptions['selectionControls'];
  readonly contextMenuBuilder?: EditableTextOptions['contextMenuBuilder'];
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
class CupertinoTextFieldState extends State<CupertinoTextField> {
  private readonly editorKey = new GlobalKey('Cupertino TextField editor');
  private controller!: TextEditingController;
  private focus!: FocusNode;
  private ownsController = false;
  private ownsFocus = false;
  private queued = false;
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
    this.ownsController = this.widget.controller === null;
    this.controller = this.widget.controller ?? new TextEditingController(previous?.text ?? '');
    if (this.ownsController && previous) {
      this.controller.selection = previous.selection;
      this.controller.clearHistory();
    }
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
  override didUpdateWidget(old: CupertinoTextField): void {
    super.didUpdateWidget(old);
    const context = this.context;
    invariant(
      context instanceof Element,
      'invalid-field-context',
      'CupertinoTextField requires an Element',
    );
    if (old.controller !== this.widget.controller) {
      const previous = this.controller,
        owned = this.ownsController;
      previous.removeListener(this.changed);
      this.connectController(previous);
      if (owned) context.owner.postFrame(() => previous.dispose());
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
      if (this.ownsController) this.controller.dispose();
      if (this.ownsFocus) this.focus.dispose();
    } finally {
      super.dispose();
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
  private clearButton(context: BuildContext, dark: boolean): Widget {
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
            color: new Color(dark ? 0x33ffffff : 0x33000000),
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
      dark = theme.brightness === 'dark',
      enabled = o.enabled !== false,
      hasText = this.controller.text.length > 0;
    const style = theme.textTheme.textStyle.merge(o.style),
      placeholderStyle = style.merge(
        o.placeholderStyle === undefined
          ? new TextStyle({
              fontWeight: FontWeight.w400,
              color: CupertinoColors.placeholderText.resolveFrom(context).toARGB32(),
            })
          : o.placeholderStyle,
      );
    const selection = DefaultSelectionStyle.of(context),
      cursorColor = o.cursorColor?.toARGB32() ?? selection.cursorColor ?? theme.primaryColor;
    const editor = new Padding(
      this.widget.padding,
      new EditableText(o.id, this.controller, o.placeholder ?? '', this.focus, 0, this.editorKey, {
        selectionControls:
          o.selectionControls ??
          (['android', 'iOS', 'fuchsia'].includes(FoundationPlatform.defaultTargetPlatform)
            ? cupertinoTextSelectionHandleControls
            : cupertinoDesktopTextSelectionHandleControls),
        contextMenuBuilder:
          o.contextMenuBuilder === undefined
            ? CupertinoTextField.defaultContextMenuBuilder
            : o.contextMenuBuilder,
        magnifierConfiguration: o.magnifierConfiguration ?? defaultMagnifier,
        cursorWidth: o.cursorWidth ?? 2,
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
          ...(o.maxLength == null ? [] : [new LengthLimitingTextInputFormatter(o.maxLength)]),
        ],
        ...(o.textInputAction ? { action: o.textInputAction } : {}),
        ...(o.onChanged ? { onChanged: o.onChanged } : {}),
        ...(o.onEditingComplete ? { onEditingComplete: o.onEditingComplete } : {}),
        ...(o.onSubmitted ? { onSubmitted: o.onSubmitted } : {}),
      }),
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
          ...(suffix ? [suffix] : clear ? [this.clearButton(context, dark)] : []),
        ],
        { crossAxisAlignment: o.crossAxisAlignment ?? 'center' },
      );
    }
    let decoration = this.widget.decoration;
    if (decoration === defaultDecoration)
      decoration = new BoxDecoration({
        color: enabled ? (dark ? 0xff000000 : 0xffffffff) : dark ? 0xff050505 : 0xfffafafa,
        border: Border.fromBorderSide(
          new BorderSide({ color: dark ? 0x33ffffff : 0x33000000, width: 0 }),
        ),
        borderRadius: BorderRadius.circular(5),
      });
    return new TextFieldTapRegion(
      new ExcludeFocus(
        new IgnorePointer(
          new Container({
            decoration,
            ...(!enabled && decoration === null ? { color: dark ? 0xff050505 : 0xfffafafa } : {}),
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
                      this.focus.requestFocus();
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
