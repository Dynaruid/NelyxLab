// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { TextFormField as CoreTextFormField } from '@nelyx/core/framework/widgets/text-form-field';
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
}
/** Validation and controller lifetime use the same Core TextFormField state. */
export class TextFormField extends CoreTextFormField {
  constructor(options: TextFormFieldOptions) {
    const {
      initialValue,
      validator,
      onSaved,
      onReset,
      autovalidateMode,
      errorBuilder,
      ...fieldOptions
    } = options;
    super({
      id: options.id,
      label: options.decoration?.labelText ?? options.decoration?.hintText ?? '',
      key: options.key ?? null,
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
        });
      },
    });
  }
}
