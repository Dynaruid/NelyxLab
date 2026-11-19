// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from Flutter packages/flutter/lib/src/material/dropdown_menu_form_field.dart
// at 71e4717a61786faab4c7aa39825989305ed29e8a.
import { valueEquals } from '@nelyx/core/framework/painting/value-equality';
import { TextEditingController } from '@nelyx/core/framework/widgets/editable-text';
import { FormField, FormFieldState } from '@nelyx/core/framework/widgets/form';
import type { AutovalidateMode } from '@nelyx/core/framework/widgets/form';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import {
  RestorationOwner,
  UnmanagedRestorationScope,
} from '@nelyx/core/framework/widgets/restoration';
import { DropdownMenu } from './dropdown-menu.ts';
import type { DropdownMenuEntry, DropdownMenuOptions } from './dropdown-menu.ts';
import { InputDecoration } from './input-decoration.ts';
import type { MenuController } from './menu-anchor.ts';

export interface DropdownMenuFormFieldOptions<T> extends Omit<DropdownMenuOptions<T>, 'errorText'> {
  readonly onSaved?: ((value: T | null) => void) | null;
  readonly validator?: ((value: T | null) => string | null) | null;
  readonly forceErrorText?: string | null;
  readonly errorBuilder?: ((context: BuildContext, errorText: string) => Widget) | null;
  readonly autovalidateMode?: AutovalidateMode;
}

export class DropdownMenuFormField<T> extends FormField<T | null> {
  constructor(readonly menuOptions: DropdownMenuFormFieldOptions<T>) {
    super({
      key: menuOptions.key ?? null,
      initialValue: menuOptions.initialSelection ?? null,
      autovalidateMode: menuOptions.autovalidateMode ?? 'disabled',
      forceErrorText: menuOptions.forceErrorText ?? null,
      ...(menuOptions.validator ? { validator: menuOptions.validator } : {}),
      ...(menuOptions.onSaved ? { onSaved: menuOptions.onSaved } : {}),
      builder: (field) => (field as DropdownMenuFormFieldState<T>).buildMenu(),
    });
  }

  get controller(): TextEditingController | null {
    return this.menuOptions.controller ?? null;
  }

  get onSelected(): ((value: T | null) => void) | null {
    return this.menuOptions.onSelected ?? null;
  }

  get dropdownMenuEntries(): readonly DropdownMenuEntry<T>[] {
    return this.menuOptions.dropdownMenuEntries;
  }

  override createState(): FormFieldState<T | null> {
    return new DropdownMenuFormFieldState<T>();
  }
}

class DropdownMenuFormFieldState<T> extends FormFieldState<T | null> {
  private readonly localText = new TextEditingController();
  private readonly selectionRestoration = new RestorationOwner(
    this,
    (bucket, _initial, restore) => {
      if (restore) {
        const label = bucket?.read('controller');
        if (typeof label === 'string') {
          const selected = this.field.dropdownMenuEntries.find((entry) => entry.label === label);
          if (selected) this.setValue(selected.value);
        }
      }
      this.saveSelection();
    },
  );

  private get field(): DropdownMenuFormField<T> {
    return this.widget as DropdownMenuFormField<T>;
  }

  private get text(): TextEditingController {
    return this.field.controller ?? this.localText;
  }

  private findLabel(value: T | null): string | null {
    const entry = this.field.dropdownMenuEntries.find((item) => valueEquals(item.value, value));
    return entry?.label ?? null;
  }

  private saveSelection(): void {
    this.selectionRestoration.bucket?.write('controller', this.findLabel(this.value));
  }

  override didChangeDependencies(): void {
    super.didChangeDependencies();
    this.selectionRestoration.update(this.context, this.field.menuOptions.restorationId ?? null);
  }

  override didUpdateWidget(old: FormField<T | null>): void {
    super.didUpdateWidget(old);
    if (
      !this.hasInteractedByUser &&
      !valueEquals(old.options.initialValue, this.widget.options.initialValue)
    ) {
      this.setValue(this.widget.options.initialValue);
    }
    this.selectionRestoration.update(this.context, this.field.menuOptions.restorationId ?? null);
    this.saveSelection();
  }

  override didChange(value: T | null): void {
    super.didChange(value);
    this.saveSelection();
    this.field.onSelected?.(value);
  }

  override reset(): void {
    super.reset();
    this.text.text = this.findLabel(this.value) ?? '';
    this.saveSelection();
    this.field.onSelected?.(this.value);
  }

  private readonly decorate = (context: BuildContext, menu: MenuController): InputDecoration => {
    const { decorationBuilder, label, hintText, helperText, errorBuilder } = this.field.menuOptions;
    const decoration = (decorationBuilder?.(context, menu) ?? new InputDecoration()).copyWith({
      label: label ?? null,
      hintText: hintText ?? null,
      helperText: helperText ?? null,
    });
    const error = this.errorText;
    return error === null
      ? decoration
      : new InputDecoration({
          ...decoration,
          error: errorBuilder?.(this.context, error) ?? null,
          errorText: errorBuilder ? null : error,
        });
  };

  buildMenu(): Widget {
    const {
      key,
      label,
      hintText,
      helperText,
      onSaved,
      validator,
      forceErrorText,
      errorBuilder,
      autovalidateMode,
      ...menu
    } = this.field.menuOptions;
    return new UnmanagedRestorationScope({
      bucket: this.selectionRestoration.bucket,
      child: new DropdownMenu({
        ...menu,
        initialSelection: this.value,
        controller: this.text,
        decorationBuilder: this.decorate,
        onSelected: (value) => this.didChange(value),
      }),
    });
  }

  override dispose(): void {
    this.selectionRestoration.dispose();
    this.localText.dispose();
    super.dispose();
  }
}
