// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { FormField, FormFieldState } from './form.ts';
import type { AutovalidateMode } from './form.ts';
import { EditableText, TextEditingController } from './editable-text.ts';
import type { EditableTextOptions } from './editable-text.ts';
import type { FocusNode } from './focus.ts';
import { Element } from './framework.ts';
import type { Widget, WidgetOptions } from './framework.ts';
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
          options.inputOptions,
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
  private owned = false;
  private resetting = false;
  get controller(): TextEditingController {
    return this.currentController;
  }
  private readonly changed = () => {
    if (!this.resetting && this.controller.text !== this.value)
      this.didChange(this.controller.text);
  };
  override initState(): void {
    super.initState();
    this.connect();
  }
  private connect(previous?: TextEditingController): void {
    const options = (this.widget as TextFormField).textOptions;
    this.owned = options.controller === undefined;
    this.currentController =
      options.controller ?? new TextEditingController(previous?.text ?? this.value);
    if (this.owned && previous) {
      this.controller.selection = previous.selection;
      this.controller.clearHistory();
    }
    this.setValue(this.controller.text);
    this.controller.addListener(this.changed);
  }
  override didUpdateWidget(old: FormField<string>): void {
    super.didUpdateWidget(old);
    if (
      (old as TextFormField).textOptions.controller !==
      (this.widget as TextFormField).textOptions.controller
    ) {
      const previous = this.controller,
        owned = this.owned;
      previous.removeListener(this.changed);
      this.connect(previous);
      // The child releases the old controller while rebuilding this subtree.
      if (owned) {
        const context = this.context;
        invariant(
          context instanceof Element,
          'invalid-field-context',
          'TextFormField requires an Element',
        );
        context.owner.postFrame(() => previous.dispose());
      }
    }
  }
  override didChange(value: string): void {
    if (value !== this.controller.text) {
      this.controller.text = value;
      return;
    }
    super.didChange(value);
  }
  override reset(): void {
    const controller = this.controller;
    controller.reset(this.widget.options.initialValue, () => {
      if (!this.mounted || this.controller !== controller) return;
      this.resetting = true;
      try {
        super.reset();
        this.didApplyReset();
      } finally {
        this.resetting = false;
      }
    });
  }
  protected didApplyReset(): void {}
  override dispose(): void {
    this.controller.removeListener(this.changed);
    if (this.owned) this.controller.dispose();
    super.dispose();
  }
}
