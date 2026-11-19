// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from Flutter packages/flutter/lib/src/material/selectable_text.dart
// at 71e4717a61786faab4c7aa39825989305ed29e8a.
import { CupertinoTheme } from '@nelyx/cupertino/theme';
import {
  cupertinoTextSelectionHandleControls,
  cupertinoDesktopTextSelectionHandleControls,
} from '@nelyx/cupertino/text-selection';
import { invariant } from '@nelyx/core/foundation/errors';
import { DragStartBehavior } from '@nelyx/core/framework/gestures/recognizer';
import { TextScaler } from '@nelyx/core/framework/painting/text-scaler';
import { TextSpan } from '@nelyx/core/framework/painting/text-span';
import type { TextStyle } from '@nelyx/core/framework/painting/text-style';
import type { StrutStyle } from '@nelyx/core/framework/painting/strut-style';
import type { TextWidthBasis } from '@nelyx/core/framework/painting/text-painter';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { DefaultSelectionStyle } from '@nelyx/core/framework/widgets/default-selection-style';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import { EditableText, TextEditingController } from '@nelyx/core/framework/widgets/editable-text';
import type {
  EditableTextOptions,
  EditableTextState,
} from '@nelyx/core/framework/widgets/editable-text';
import { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { RepaintBoundary } from '@nelyx/core/framework/widgets/repaint-boundary';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import type { TextSelectionControls } from '@nelyx/core/framework/widgets/text-selection';
import { SelectionChangedCause } from '@nelyx/core/services/text-input';
import { Color } from '@nelyx/core/ui/color';
import { Offset } from '@nelyx/core/ui/offset';
import { Radius } from '@nelyx/core/ui/radius';
import type { BoxHeightStyle, BoxWidthStyle } from '@nelyx/core/ui/text-box';
import type { TextAlign, TextHeightBehavior } from '@nelyx/core/ui/typography';
import { AdaptiveTextSelectionToolbar } from './adaptive-text-selection-toolbar.ts';
import { TextMagnifier } from './magnifier.ts';
import {
  desktopTextSelectionHandleControls,
  materialTextSelectionHandleControls,
} from './text-selection.ts';
import { Theme } from './theme.ts';

/** iOS caret displacement in physical pixels. */
export const iOSHorizontalOffset = -2;
const appleCursorRadius = Radius.circular(2);
let nextSelectableTextId = 0;

export interface SelectableTextOptions extends WidgetOptions {
  readonly focusNode?: FocusNode | null;
  readonly style?: TextStyle | null;
  readonly strutStyle?: StrutStyle | null;
  readonly textAlign?: TextAlign | null;
  readonly textDirection?: 'ltr' | 'rtl' | null;
  /** @deprecated Use textScaler. */
  readonly textScaleFactor?: number | null;
  readonly textScaler?: TextScaler | null;
  readonly showCursor?: boolean;
  readonly autofocus?: boolean;
  /** @deprecated Use contextMenuBuilder. */
  readonly toolbarOptions?: { readonly copy?: boolean; readonly selectAll?: boolean } | null;
  readonly minLines?: number | null;
  readonly maxLines?: number | null;
  readonly cursorWidth?: number;
  readonly cursorHeight?: number | null;
  readonly cursorRadius?: Radius | null;
  readonly cursorColor?: Color | null;
  readonly selectionColor?: Color | null;
  readonly selectionHeightStyle?: BoxHeightStyle;
  readonly selectionWidthStyle?: BoxWidthStyle;
  readonly dragStartBehavior?: DragStartBehavior;
  readonly enableInteractiveSelection?: boolean;
  readonly selectionControls?: TextSelectionControls | null;
  readonly onTap?: (() => void) | null;
  readonly scrollPhysics?: EditableTextOptions['scrollPhysics'];
  readonly scrollBehavior?: EditableTextOptions['scrollBehavior'];
  readonly semanticsLabel?: string | null;
  readonly textHeightBehavior?: TextHeightBehavior | null;
  readonly textWidthBasis?: TextWidthBasis | null;
  readonly onSelectionChanged?: EditableTextOptions['onSelectionChanged'];
  readonly contextMenuBuilder?: EditableTextOptions['contextMenuBuilder'];
  readonly magnifierConfiguration?: EditableTextOptions['magnifierConfiguration'];
}

export class SelectableText extends StatefulWidget {
  readonly data: string | null;
  readonly textSpan: TextSpan | null;

  constructor(
    text: string | TextSpan,
    readonly options: Readonly<SelectableTextOptions> = {},
  ) {
    super(options.key ?? null);
    this.data = typeof text === 'string' ? text : null;
    this.textSpan = typeof text === 'string' ? null : text;
    this.textSpan?.visitChildren((span) => {
      invariant(
        span instanceof TextSpan,
        'selectable-inline-widget',
        'SelectableText.rich requires TextSpan children',
      );
      return true;
    });
    invariant(
      options.textScaleFactor == null || options.textScaler == null,
      'selectable-text-scale',
      'Choose textScaler or textScaleFactor',
    );
    invariant(
      options.minLines == null || options.maxLines == null || options.minLines <= options.maxLines,
      'selectable-text-lines',
      'SelectableText minLines must not exceed maxLines',
    );
  }

  static rich(textSpan: TextSpan, options: SelectableTextOptions = {}): SelectableText {
    return new SelectableText(textSpan, options);
  }

  get selectionEnabled(): boolean {
    return this.options.enableInteractiveSelection ?? true;
  }

  override createState(): State<SelectableText> {
    return new SelectableTextState();
  }
}

function plainText(widget: SelectableText): string {
  return widget.data ?? widget.textSpan!.toPlainText({ includeSemanticsLabels: false });
}

class SelectableTextState extends State<SelectableText> {
  private readonly id = 'material-selectable-text-' + ++nextSelectableTextId;
  private readonly editorKey = new GlobalKey<EditableTextState>('Material selectable text');
  private readonly defaultFocus = new FocusNode({ debugLabel: 'SelectableText' });
  private controller!: TextEditingController;

  private get focus(): FocusNode {
    return this.widget.options.focusNode ?? this.defaultFocus;
  }

  private readonly handleFocusChange = (): void => {
    const lifecycle = this.context.services.platformServices?.lifecycleState ?? 'resumed';
    if (!this.focus.hasFocus && lifecycle === 'resumed') {
      this.controller.selection = { anchor: 0, focus: 0 };
    }
  };

  override initState(): void {
    super.initState();
    this.controller = new TextEditingController(plainText(this.widget));
    this.focus.addListener(this.handleFocusChange);
  }

  override didUpdateWidget(old: SelectableText): void {
    super.didUpdateWidget(old);
    if (old.data !== this.widget.data || old.textSpan !== this.widget.textSpan) {
      const text = plainText(this.widget);
      this.controller.replace(text, { anchor: 0, focus: 0 });
    }
    const previous = old.options.focusNode ?? this.defaultFocus;
    if (previous !== this.focus) {
      previous.removeListener(this.handleFocusChange);
      this.focus.addListener(this.handleFocusChange);
    }
  }

  private readonly handleSelection: NonNullable<EditableTextOptions['onSelectionChanged']> = (
    selection,
    cause,
  ) => {
    this.widget.options.onSelectionChanged?.(selection, cause);
    const platform = Theme.of(this.context).platform;
    if (cause === SelectionChangedCause.longPress && (platform === 'iOS' || platform === 'macOS')) {
      this.editorKey.currentState?.bringIntoView(selection.base);
    }
  };

  private readonly contextMenu = (_context: BuildContext, state: EditableTextState): Widget => {
    const options = this.widget.options.toolbarOptions;
    return AdaptiveTextSelectionToolbar.editableText({
      editableTextState: {
        contextMenuAnchors: state.contextMenuAnchors,
        contextMenuButtonItems: state.contextMenuButtonItems.filter(
          (item) =>
            (item.type.name !== 'copy' || options?.copy !== false) &&
            (item.type.name !== 'selectAll' || options?.selectAll !== false),
        ),
      },
    });
  };

  override build(context: BuildContext): Widget {
    const { options, textSpan, selectionEnabled } = this.widget;
    const theme = Theme.of(context);
    const platform = theme.platform;
    const apple = platform === 'iOS' || platform === 'macOS';
    const primary = apple ? CupertinoTheme.of(context).primaryColor : theme.colorScheme.primary;
    const selectionStyle = DefaultSelectionStyle.of(context);
    const textDefaults = DefaultTextStyle.of(context);
    const style = options.style ?? textSpan?.style ?? null;
    invariant(
      style?.inherit !== false || (style.fontSize !== null && style.textBaseline !== null),
      'selectable-text-style',
      'An independent TextStyle needs a font size and a baseline',
    );
    const controls =
      options.selectionControls ??
      (platform === 'iOS'
        ? cupertinoTextSelectionHandleControls
        : platform === 'macOS'
          ? cupertinoDesktopTextSelectionHandleControls
          : platform === 'windows' || platform === 'linux'
            ? desktopTextSelectionHandleControls
            : materialTextSelectionHandleControls);
    const scaler =
      options.textScaler ??
      (options.textScaleFactor == null ? null : TextScaler.linear(options.textScaleFactor));
    const textHeightBehavior = options.textHeightBehavior ?? textDefaults?.textHeightBehavior;
    const editor = new EditableText(
      this.id,
      this.controller,
      options.semanticsLabel ?? '',
      this.focus,
      0,
      this.editorKey,
      {
        configuration: { readOnly: true },
        minHeight: 0,
        minLines: options.minLines ?? null,
        maxLines: options.maxLines ?? textDefaults?.maxLines ?? null,
        ...(style ? { textStyle: style } : {}),
        ...(textSpan ? { textSpan } : {}),
        textAlign: options.textAlign ?? textDefaults?.textAlign ?? 'start',
        ...(options.textDirection ? { textDirection: options.textDirection } : {}),
        ...(scaler ? { textScaler: scaler } : {}),
        ...(options.strutStyle ? { strutStyle: options.strutStyle } : {}),
        ...(textHeightBehavior ? { textHeightBehavior } : {}),
        textWidthBasis: options.textWidthBasis ?? textDefaults?.textWidthBasis ?? 'parent',
        forceLine: false,
        autofocus: options.autofocus ?? false,
        showCursor: options.showCursor ?? false,
        cursorWidth: options.cursorWidth ?? 2,
        ...(options.cursorHeight == null ? {} : { cursorHeight: options.cursorHeight }),
        cursorColor: options.cursorColor?.toARGB32() ?? selectionStyle.cursorColor ?? primary,
        cursorRadius: options.cursorRadius ?? (apple ? appleCursorRadius : null),
        ...(apple
          ? { cursorOffset: new Offset(iOSHorizontalOffset / MediaQuery.of(context).scale, 0) }
          : {}),
        paintCursorAboveText: apple,
        selectionColor:
          options.selectionColor?.toARGB32() ??
          selectionStyle.selectionColor ??
          new Color(primary).withOpacity(0.4).toARGB32(),
        ...(options.selectionHeightStyle
          ? { selectionHeightStyle: options.selectionHeightStyle }
          : {}),
        ...(options.selectionWidthStyle
          ? { selectionWidthStyle: options.selectionWidthStyle }
          : {}),
        dragStartBehavior: options.dragStartBehavior ?? DragStartBehavior.start,
        forcePressEnabled: platform === 'iOS',
        enableInteractiveSelection: selectionEnabled,
        selectionControls: selectionEnabled ? controls : null,
        showCollapsedSelectionHandles: false,
        ...(selectionEnabled && options.onTap ? { onTap: options.onTap } : {}),
        scrollPhysics: options.scrollPhysics ?? null,
        scrollBehavior: options.scrollBehavior ?? null,
        magnifierConfiguration:
          options.magnifierConfiguration ?? TextMagnifier.adaptiveMagnifierConfiguration,
        onSelectionChanged: this.handleSelection,
        contextMenuBuilder:
          options.contextMenuBuilder === undefined ? this.contextMenu : options.contextMenuBuilder,
      },
    );
    return new Semantics({
      label: options.semanticsLabel ?? null,
      excludeSemantics: options.semanticsLabel != null,
      onLongPress: () => this.focus.requestFocus(),
      child: new RepaintBoundary(editor),
    });
  }

  override dispose(): void {
    this.focus.removeListener(this.handleFocusChange);
    this.defaultFocus.dispose();
    this.controller.dispose();
    super.dispose();
  }
}
