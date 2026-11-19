// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Shared form editor lifetime from material/text_form_field.dart and
// cupertino/text_form_field_row.dart at 71e4717a61786faab4c7aa39825989305ed29e8a.
import { FormField, FormFieldState } from './form.ts';
import type { AutovalidateMode } from './form.ts';
import { EditableText, EditorTextRestoration } from './editable-text.ts';
import type { EditableTextOptions, TextEditingController } from './editable-text.ts';
import type { FocusNode } from './focus.ts';
import { Element } from './framework.ts';
import type { BuildContext, Widget, WidgetOptions } from './framework.ts';
import { RestorationScope, UnmanagedRestorationScope } from './restoration.ts';
import { Column, Text } from './basic.ts';
import { invariant } from '../../foundation/errors.ts';

export interface TextFormFieldOptions extends WidgetOptions {
  readonly id: string;
  readonly label: string;
  readonly controller?: TextEditingController;
  readonly initialValue?: string;
  readonly focusNode?: FocusNode;
  readonly height?: number;
  readonly validator?: (value: string) => string | null;
  readonly onSaved?: (value: string) => void;
  readonly autovalidateMode?: AutovalidateMode;
  readonly inputOptions?: EditableTextOptions;
  readonly errorBuilder?: (error: string) => Widget;
  readonly enabled?: boolean;
  readonly forceErrorText?: string | null;
  readonly restorationId?: string | null;
  readonly onReset?: () => void;
  /** Design packages compose their field with this Core-owned controller/Form state. */
  readonly fieldBuilder?: (field: TextFormFieldState) => Widget;
}
export class TextFormField extends FormField<string> {
  constructor(readonly textOptions: TextFormFieldOptions) {
    invariant(
      textOptions.controller === undefined || textOptions.initialValue === undefined,
      'ambiguous-field-value',
      'Choose a controller or initialValue',
    );
    super({
      key: textOptions.key ?? null,
      restorationId: textOptions.restorationId ?? null,
      forceErrorText: textOptions.forceErrorText ?? null,
      ...(textOptions.enabled === undefined ? {} : { enabled: textOptions.enabled }),
      ...(textOptions.onReset ? { onReset: textOptions.onReset } : {}),
      initialValue: textOptions.controller?.text ?? textOptions.initialValue ?? '',
      ...(textOptions.validator ? { validator: textOptions.validator } : {}),
      ...(textOptions.onSaved ? { onSaved: textOptions.onSaved } : {}),
      ...(textOptions.autovalidateMode ? { autovalidateMode: textOptions.autovalidateMode } : {}),
      builder: (field) => {
        const state = field as TextFormFieldState,
          widget = state.widget as TextFormField,
          options = widget.textOptions;
        if (options.fieldBuilder) return options.fieldBuilder(state);
        const editor = new EditableText(
          options.id,
          state.controller,
          options.label,
          options.focusNode,
          options.height ?? 48,
          null,
          state.restorationId === null
            ? options.inputOptions
            : {
                ...options.inputOptions,
                restorationId: options.inputOptions?.restorationId ?? 'editable',
              },
        );
        return new Column(
          [
            editor,
            ...(field.errorText === null
              ? []
              : [options.errorBuilder?.(field.errorText) ?? new Text(field.errorText)]),
          ],
          { mainSize: 'min', crossAlign: 'stretch' },
        );
      },
    });
  }
  override createState(): TextFormFieldState {
    return new TextFormFieldState();
  }
}
export class TextFormFieldState extends FormFieldState<string> {
  private currentController!: TextEditingController;
  private localText: EditorTextRestoration | null = null;
  private resetting = false;
  get controller(): TextEditingController {
    return this.currentController;
  }
  private readonly changed = () => {
    if (!this.resetting && this.controller.text !== this.value)
      this.didChange(this.controller.text);
  };
  private readonly acceptRestoredText = (controller: TextEditingController) => {
    if (this.controller !== controller || controller.text === this.value) return;
    this.setValue(controller.text);
    const context = this.context;
    if (!(context instanceof Element) || !context.active) return;
    if (context.owner.building) {
      context.owner.postFrame(() => {
        if (this.mounted && context.active && this.controller === controller) this.rebuild();
      });
    } else this.rebuild();
  };
  override initState(): void {
    super.initState();
    this.connect();
  }
  private connect(previous?: TextEditingController): void {
    const options = (this.widget as TextFormField).textOptions;
    this.localText = options.controller
      ? null
      : new EditorTextRestoration(
          previous?.text ?? this.value,
          previous?.selection,
          this.acceptRestoredText,
        );
    this.currentController = options.controller ?? this.localText!.controller;
    this.setValue(this.controller.text);
    this.controller.addListener(this.changed);
  }
  override restoreState(): void {
    super.restoreState();
    if (this.localText) this.registerForRestoration(this.localText, 'controller');
    this.setValue(this.controller.text);
  }
  override didUpdateWidget(old: FormField<string>): void {
    const changedController =
      (old as TextFormField).textOptions.controller !==
      (this.widget as TextFormField).textOptions.controller;
    if (changedController) {
      const previous = this.controller;
      previous.removeListener(this.changed);
      const retiredText = this.localText;
      if (retiredText) {
        this.unregisterFromRestoration(retiredText);
        const context = this.context;
        invariant(
          context instanceof Element,
          'invalid-field-context',
          'TextFormField requires an Element',
        );
        // The child releases the old controller while rebuilding this subtree.
        context.owner.postFrame(() => retiredText.dispose());
      }
      this.connect(previous);
    }
    super.didUpdateWidget(old);
    if (changedController && this.localText)
      this.registerForRestoration(this.localText, 'controller');
  }
  override build(): Widget {
    const child = super.build();
    return new UnmanagedRestorationScope({
      bucket: this.restorationId === null ? RestorationScope.maybeOf(this.context) : this.bucket,
      child,
    });
  }
  override didChange(value: string): void {
    if (value !== this.controller.text) {
      this.controller.text = value;
      return;
    }
    super.didChange(value);
  }
  override reset(): void {
    const controller = this.controller,
      text = this.resetText;
    controller.reset(text, () => {
      if (!this.mounted || this.controller !== controller) return;
      this.resetting = true;
      try {
        this.resetValue(text);
        this.didApplyReset();
      } finally {
        this.resetting = false;
      }
    });
  }
  protected get resetText(): string {
    return this.widget.options.initialValue;
  }
  protected didApplyReset(): void {}
  override dispose(): void {
    this.controller.removeListener(this.changed);
    this.localText?.dispose();
    super.dispose();
  }
}
