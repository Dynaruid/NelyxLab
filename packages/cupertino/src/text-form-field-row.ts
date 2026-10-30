// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {
  TextFormField as CoreTextFormField,
  TextFormFieldState,
} from '@nelyx/core/framework/widgets/text-form-field';
import type { AutovalidateMode } from '@nelyx/core/framework/widgets/form';
import { Text } from '@nelyx/core/framework/widgets/basic';
import type { Widget } from '@nelyx/core/framework/widgets/framework';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { CupertinoTextField } from './text-field.ts';
import type { CupertinoTextFieldOptions } from './text-field.ts';
import { CupertinoFormRow } from './form-row.ts';
export interface CupertinoTextFormFieldRowOptions extends Omit<
  CupertinoTextFieldOptions,
  | 'prefix'
  | 'padding'
  | 'suffix'
  | 'prefixMode'
  | 'suffixMode'
  | 'clearButtonMode'
  | 'clearButtonSemanticLabel'
  | 'onSubmitted'
  | 'crossAxisAlignment'
> {
  readonly prefix?: Widget | null;
  readonly padding?: EdgeInsetsGeometry | null;
  readonly initialValue?: string;
  readonly validator?: (value: string) => string | null;
  readonly onSaved?: (value: string) => void;
  readonly onReset?: () => void;
  readonly autovalidateMode?: AutovalidateMode;
  readonly onFieldSubmitted?: (value: string) => void;
}
/** Source design composition; Core retains Form registration and controller lifetime. */
export class CupertinoTextFormFieldRow extends CoreTextFormField {
  constructor(readonly cupertinoOptions: CupertinoTextFormFieldRowOptions) {
    const options = cupertinoOptions;
    const {
      prefix,
      padding,
      initialValue,
      validator,
      onSaved,
      onReset,
      autovalidateMode,
      onFieldSubmitted,
      ...input
    } = options;
    super({
      id: input.id,
      label: input.placeholder ?? '',
      key: input.key ?? null,
      enabled: input.enabled ?? true,
      ...(input.controller ? { controller: input.controller } : {}),
      ...(initialValue === undefined ? {} : { initialValue }),
      ...(validator ? { validator } : {}),
      ...(onSaved ? { onSaved } : {}),
      ...(onReset ? { onReset } : {}),
      ...(autovalidateMode ? { autovalidateMode } : {}),
      fieldBuilder: (field) =>
        new CupertinoFormRow({
          prefix: prefix ?? null,
          padding: padding ?? null,
          error: field.errorText === null ? null : new Text(field.errorText),
          child: CupertinoTextField.borderless({
            ...input,
            key: null,
            controller: field.controller,
            ...(onFieldSubmitted ? { onSubmitted: onFieldSubmitted } : {}),
          }),
        }),
    });
  }
  override createState(): TextFormFieldState {
    return new CupertinoTextFormFieldRowState();
  }
}
class CupertinoTextFormFieldRowState extends TextFormFieldState {
  protected override didApplyReset(): void {
    super.didApplyReset();
    (this.widget as CupertinoTextFormFieldRow).cupertinoOptions.onChanged?.(this.controller.text);
  }
}
