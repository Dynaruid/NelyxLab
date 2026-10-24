// SPDX-License-Identifier: BSD-3-Clause
import {invariant} from '../foundation/errors.ts';
export type EditingKeyboardType='text'|'number'|'decimal'|'phone'|'email'|'url';
export type EditingCapitalization='none'|'sentences'|'words'|'characters';
export interface EditingConfiguration {
  readonly multiline:boolean;readonly readOnly:boolean;readonly obscureText:boolean;
  readonly autocorrect:boolean;readonly enableSuggestions:boolean;
  readonly keyboardType:EditingKeyboardType;readonly capitalization:EditingCapitalization;
  /** Ordered semantic hints; null/empty disables autofill. No field values enter this configuration. */
  readonly autofillHints:readonly string[]|null;
  /** HTML section identity supplied by the owning AutofillGroup; native contexts may be Activity-scoped. */
  readonly autofillSection:string|null;
}
export type EditingConfigurationOptions=Partial<EditingConfiguration>;
const defaults:EditingConfiguration={multiline:false,readOnly:false,obscureText:false,autocorrect:true,enableSuggestions:true,keyboardType:'text',capitalization:'sentences',autofillHints:null,autofillSection:null};
export function freezeEditingConfiguration(options:EditingConfigurationOptions={}):EditingConfiguration{
  invariant(options&&typeof options==='object'&&!Array.isArray(options)&&Object.keys(options).every(key=>Object.hasOwn(defaults,key)),'invalid-editing-configuration','Unknown editing configuration field');
  const value={...defaults,...options};
  for(const key of ['multiline','readOnly','obscureText','autocorrect','enableSuggestions'] as const)invariant(typeof value[key]==='boolean','invalid-editing-configuration','Editing flags must be booleans');
  invariant(!(value.multiline&&value.obscureText),'invalid-editing-configuration','Obscured editing requires a single line');
  invariant(['text','number','decimal','phone','email','url'].includes(value.keyboardType)&&['none','sentences','words','characters'].includes(value.capitalization),'invalid-editing-configuration','Unknown keyboard or capitalization');
  invariant(!value.obscureText||['text','number','decimal'].includes(value.keyboardType),'invalid-editing-configuration','Obscured editing requires a text or numeric keyboard');
  invariant(!value.multiline||value.keyboardType==='text','invalid-editing-configuration','Multiline editing requires a text keyboard');
  invariant(value.autofillSection===null||typeof value.autofillSection==='string'&&value.autofillSection.length>0&&value.autofillSection.length<=8192&&/^[a-zA-Z0-9-]+$/.test(value.autofillSection),'invalid-autofill-section','Autofill section must be a bounded ASCII identity');
  const hints=value.autofillHints;invariant(hints===null||Array.isArray(hints)&&hints.length<=32&&hints.every(hint=>typeof hint==='string'&&hint.length<=100&&/^[a-zA-Z][a-zA-Z0-9-]*$/.test(hint)),'invalid-autofill-hints','Autofill hints must be at most 32 bounded semantic tokens');
  return Object.freeze({...value,...(value.obscureText?{autocorrect:false,enableSuggestions:false,capitalization:'none' as const}:{}),autofillHints:hints?.length?Object.freeze([...hints]):null});
}
export function editingConfigurationKey(value:EditingConfigurationOptions={}):string{return JSON.stringify(freezeEditingConfiguration(value));}
