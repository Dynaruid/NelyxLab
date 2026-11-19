// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/text_form_field.dart
// Revision: 71e4717a61786faab4c7aa39825989305ed29e8a
import {
  TextFormField as CoreTextFormField,
  TextFormFieldState,
} from '@nelyx/core/framework/widgets/text-form-field';
import type { AutovalidateMode } from '@nelyx/core/framework/widgets/form';
import type { Widget } from '@nelyx/core/framework/widgets/framework';
import { TextField } from './text-field.ts';
import type { TextFieldOptions } from './text-field.ts';
import { InputDecoration } from './input-decoration.ts';
export interface TextFormFieldOptions extends TextFieldOptions {
  readonly initialValue?: string;
  readonly validator?: (value: string) => string | null;
  readonly onSaved?: (value: string) => void;
  readonly onReset?: () => void;
  readonly autovalidateMode?: AutovalidateMode;
  readonly errorBuilder?: (error: string) => Widget;
  readonly forceErrorText?: string | null;
  readonly onFieldSubmitted?: (value: string) => void;
}
/** Validation and controller lifetime use the same Core TextFormField state. */
export class TextFormField extends CoreTextFormField {
  constructor(readonly materialOptions: TextFormFieldOptions) {
    const options = materialOptions;
    const {
      initialValue,
      validator,
      onSaved,
      onReset,
      autovalidateMode,
      errorBuilder,
      forceErrorText,
      onFieldSubmitted,
      ...fieldOptions
    } = options;
    super({
      id: options.id,
      label: options.decoration?.labelText ?? options.decoration?.hintText ?? '',
      key: options.key ?? null,
      restorationId: options.restorationId ?? null,
      forceErrorText: forceErrorText ?? null,
      ...(options.controller ? { controller: options.controller } : {}),
      ...(initialValue === undefined ? {} : { initialValue }),
      ...(validator ? { validator } : {}),
      ...(onSaved ? { onSaved } : {}),
      ...(onReset ? { onReset } : {}),
      ...(autovalidateMode ? { autovalidateMode } : {}),
      enabled: options.enabled ?? options.decoration?.enabled ?? true,
      fieldBuilder: (field) => {
        let decoration =
          fieldOptions.decoration === undefined ? new InputDecoration() : fieldOptions.decoration;
        if (decoration && field.errorText !== null)
          decoration = errorBuilder
            ? new InputDecoration({
                ...decoration,
                error: errorBuilder(field.errorText),
                errorText: null,
              })
            : new InputDecoration({ ...decoration, error: null, errorText: field.errorText });
        return new TextField({
          ...fieldOptions,
          key: null,
          controller: field.controller,
          decoration,
          ...(onFieldSubmitted ? { onSubmitted: onFieldSubmitted } : {}),
        });
      },
    });
  }
  override createState(): TextFormFieldState {
    return new MaterialTextFormFieldState();
  }
}

class MaterialTextFormFieldState extends TextFormFieldState {
  private initialText = '';
  override initState(): void {
    super.initState();
    this.initialText = this.controller.text;
  }
  protected override get resetText(): string {
    return this.initialText;
  }
  protected override didApplyReset(): void {
    (this.widget as TextFormField).materialOptions.onChanged?.(this.controller.text);
  }
}
