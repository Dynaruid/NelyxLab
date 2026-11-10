// SPDX-License-Identifier: BSD-3-Clause
import { TextEditingController } from '@nelyx/core/framework/widgets/editable-text';
import { TextEditingValue } from '@nelyx/core/services/text-input';
import { TextSelection } from '@nelyx/core/services/text-editing';
import { TextRange } from '@nelyx/core/ui/text-range';
import type { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { TextFormField } from '../../text-form-field.ts';
import type { TextFormFieldOptions } from '../../text-form-field.ts';
/** Desktop date input uses the text keyboard; date parsing stays in original Dart. */
export const TextInputType = Object.freeze({ datetime: 'datetime' } as const);
export type TextInputType = 'datetime' | 'text' | 'number' | 'decimal' | 'phone' | 'email' | 'url';
export class SourceDateEditingController {
  readonly core: TextEditingController;
  constructor({ text = '' }: { text?: string | null } = {}) {
    this.core = new TextEditingController(text ?? '');
  }
  get value(): TextEditingValue {
    const selection = this.core.selection;
    return new TextEditingValue({
      text: this.core.text,
      selection: new TextSelection({ baseOffset: selection.anchor, extentOffset: selection.focus }),
      composing: TextRange.empty,
    });
  }
  set value(value: TextEditingValue) {
    if (!value.composing.isCollapsed)
      throw Error('Programmatic date input cannot create an OS composition');
    this.core.replace(value.text, {
      anchor: Math.max(0, value.selection.baseOffset),
      focus: Math.max(0, value.selection.extentOffset),
    });
  }
  dispose(): void {
    this.core.dispose();
  }
}
let nextDateField = 0;
const ids = new WeakMap<SourceDateEditingController, string>();
export function dateTextFormField({
  controller,
  keyboardType,
  onFieldSubmitted,
  focusNode,
  ...options
}: Omit<TextFormFieldOptions, 'id' | 'controller' | 'keyboardType' | 'focusNode'> & {
  controller: SourceDateEditingController;
  keyboardType: TextInputType;
  onFieldSubmitted: (text: string) => void;
  focusNode: FocusNode | null;
}): TextFormField {
  let id = ids.get(controller);
  if (!id) {
    id = 'nelyx-source-date-' + ++nextDateField;
    ids.set(controller, id);
  }
  return new TextFormField({
    ...options,
    id,
    controller: controller.core,
    keyboardType: keyboardType === 'datetime' ? 'text' : keyboardType,
    onSubmitted: onFieldSubmitted,
    ...(focusNode ? { focusNode } : {}),
  });
}
