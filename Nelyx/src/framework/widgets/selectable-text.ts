// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Selected read-only body/selection intent from pinned material/selectable_text.dart.
import { StatefulWidget, State, RenderObjectWidget, LeafRenderObjectElement } from './framework.ts';
import type { BuildContext, Widget } from './framework.ts';
import type { TextOptions } from './basic.ts';
import './app-data.ts';
import { Focus } from './focus-scope.ts';
import { FocusNode } from './focus.ts';
import { TextSelectionController } from '../painting/text-selection-controller.ts';
import { RenderSelectableParagraph } from '../rendering/selectable-paragraph.ts';
import type { RenderBox } from '../rendering/object.ts';
import type { TextSelection } from '../../ui/types.ts';
import type { RichParagraphConfiguration } from '../rendering/paragraph.ts';
import '../../ui/text.ts';
import { Clipboard, ClipboardData } from '../../services/clipboard.ts';
import { invariant } from '../../foundation/errors.ts';
import { Element } from './framework.ts';
import { resolveTextConfiguration } from './text-input.ts';
import { TextSpan } from '../painting/text-span.ts';
export interface SelectableTextOptions extends TextOptions {
  readonly controller?: TextSelectionController;
  readonly focusNode?: FocusNode;
  readonly selectionColor?: number;
  readonly onSelectionChanged?: (selection: TextSelection) => void;
  readonly onCopyError?: (error: unknown) => void;
}
/** Read-only text with shaped range highlights; advanced selection menus remain separate. */
export class SelectableText extends StatefulWidget {
  readonly text: string;
  readonly textSpan: TextSpan | null;
  constructor(
    text: string | TextSpan,
    readonly options: SelectableTextOptions = {},
  ) {
    super(options.key ?? null);
    this.textSpan = typeof text === 'string' ? null : text;
    this.text =
      typeof text === 'string' ? text : text.toPlainText({ includeSemanticsLabels: false });
    if (this.textSpan)
      this.textSpan.visitChildren((span) => {
        invariant(
          span instanceof TextSpan,
          'selectable-span-kind',
          'SelectableText.rich requires TextSpan descendants; inline widget selection uses a selection region',
        );
        return true;
      });
  }
  static rich(textSpan: TextSpan, options: SelectableTextOptions = {}): SelectableText {
    return new SelectableText(textSpan, options);
  }
  createState(): State {
    return new SelectableTextState();
  }
}
class SelectableTextState extends State<SelectableText> {
  private controller!: TextSelectionController;
  private ownController = false;
  private focus!: FocusNode;
  private ownFocus = false;
  private epoch = 0;
  private lastSelection: TextSelection = { anchor: 0, focus: 0 };
  override initState(): void {
    this.connect();
  }
  private connect(): void {
    this.controller =
      this.widget.options.controller ?? new TextSelectionController(this.widget.text);
    this.ownController = !this.widget.options.controller;
    invariant(
      this.controller.text === this.widget.text,
      'selection-text-mismatch',
      'Initial controller text must match SelectableText',
    );
    this.lastSelection = this.controller.selection;
    this.focus = this.widget.options.focusNode ?? new FocusNode();
    this.ownFocus = !this.widget.options.focusNode;
    this.controller.addListener(this.changed);
  }
  private readonly changed = () => {
    const next = this.controller.selection;
    if (next.anchor === this.lastSelection.anchor && next.focus === this.lastSelection.focus)
      return;
    this.lastSelection = next;
    const epoch = this.epoch,
      notify = () => {
        if (this.mounted && epoch === this.epoch) this.widget.options.onSelectionChanged?.(next);
      };
    if (this.context instanceof Element && this.context.owner.building)
      this.context.owner.postFrame(notify);
    else notify();
  };
  private disconnect(): void {
    this.epoch++;
    this.controller.removeListener(this.changed);
    if (this.ownController) this.controller.dispose();
    if (this.ownFocus) this.focus.dispose();
  }
  override didUpdateWidget(old: SelectableText): void {
    if (
      old.options.controller !== this.widget.options.controller ||
      old.options.focusNode !== this.widget.options.focusNode
    ) {
      // The old RenderObject releases its controller when the keyed child is replaced.
      const controller = this.controller,
        own = this.ownController,
        focus = this.focus,
        ownFocus = this.ownFocus;
      this.epoch++;
      controller.removeListener(this.changed);
      this.connect();
      invariant(
        this.context instanceof Element,
        'invalid-context',
        'SelectableText needs Element context',
      );
      this.context.owner.postFrame(() => {
        if (own) controller.dispose();
        if (ownFocus) focus.dispose();
      });
    } else if (old.text !== this.widget.text) this.controller.text = this.widget.text;
  }
  override dispose(): void {
    this.disconnect();
  }
  private copy(): void {
    const messenger = this.context.services.binaryMessenger;
    invariant(
      messenger,
      'missing-binary-messenger',
      'SelectableText copy requires this app binary messenger',
    );
    const epoch = this.epoch;
    void this.controller
      .copy({ writeText: (text) => Clipboard.setData(new ClipboardData(text), messenger) })
      .catch((error) => {
        if (!this.mounted || epoch !== this.epoch) return;
        if (this.widget.options.onCopyError) this.widget.options.onCopyError(error);
        else this.context.services.reportError?.(error);
      });
  }
  build(_context: BuildContext): Widget {
    return new Focus(
      new SelectableParagraphWidget(
        this.controller,
        this.widget.options,
        () => this.focus.requestFocus(),
        this.widget.textSpan,
      ),
      {
        focusNode: this.focus,
        includeSemantics: false,
        onKeyEvent: (_node, event) => {
          if (event.kind !== 'down' || event.alt) return 'ignored';
          if ((event.control || event.meta) && event.key.toLowerCase() === 'a') {
            this.controller.selectAll();
            return 'handled';
          }
          if ((event.control || event.meta) && event.key.toLowerCase() === 'c') {
            this.copy();
            return 'handled';
          }
          return this.controller.handleKey(event) ? 'handled' : 'ignored';
        },
      },
    );
  }
}
class SelectableParagraphWidget extends RenderObjectWidget {
  constructor(
    readonly controller: TextSelectionController,
    readonly options: SelectableTextOptions,
    readonly focus: () => void,
    readonly span: TextSpan | null,
  ) {
    super();
  }
  override get typeToken(): object {
    return this.controller;
  }
  override createElement(): LeafRenderObjectElement {
    return new LeafRenderObjectElement(this);
  }
  get childWidgets(): readonly Widget[] {
    return [];
  }
  private configuration(context: BuildContext): RichParagraphConfiguration {
    const resolved = resolveTextConfiguration(context, this.options),
      span = this.span ?? new TextSpan({ text: this.controller.text });
    invariant(
      span.toPlainText({ includeSemanticsLabels: false }) === this.controller.text,
      'selection-text-mismatch',
      'Rich span text must match its controller',
    );
    return {
      span,
      style: resolved.style,
      scaler: resolved.scaler,
      placeholderCount: 0,
      font: resolved.font,
      scale: resolved.scale,
      paragraphOptions: resolved.paragraphOptions,
      painterOptions: resolved.painterOptions,
    };
  }
  createRenderObject(context: BuildContext): RenderBox {
    invariant(
      context instanceof Element,
      'invalid-context',
      'SelectableText needs Element context',
    );
    const config = this.configuration(context);
    return new RenderSelectableParagraph(
      config,
      {
        text: context.services.text,
        resources: context.services.resources,
        font: config.font,
        scale: config.scale,
      },
      this.controller,
      context.owner.gestures,
    );
  }
  updateRenderObject(context: BuildContext, object: RenderBox): void {
    const render = object as RenderSelectableParagraph;
    render.config = this.configuration(context);
    render.devicePixelRatio = render.config.scale;
    render.selectionColor = this.options.selectionColor ?? 0x667aaaff;
    render.requestFocus = this.focus;
    render.semantics = {
      id: render.semanticsId,
      role: 'text',
      name: this.controller.text,
      enabled: true,
      focusable: true,
      activate: this.focus,
      actions: { focus: this.focus },
    };
    render.markNeedsPaint();
  }
}
