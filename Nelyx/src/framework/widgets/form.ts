// SPDX-License-Identifier: BSD-3-Clause
// Nelyx synchronous form contract: mounted field membership, explicit validation/save/reset.
import {invariant} from '../../foundation/errors.ts';
import {StatefulWidget,State,InheritedWidget} from './framework.ts';
import type {BuildContext,Widget,WidgetOptions} from './framework.ts';

export type AutovalidateMode='disabled'|'always'|'onUserInteraction';
export interface FormOptions extends WidgetOptions {readonly child:Widget;readonly onChanged?:()=>void;readonly autovalidateMode?:AutovalidateMode}
export class Form extends StatefulWidget {
  constructor(readonly options:FormOptions){super(options.key??null);}
  createState():FormState{return new FormState();}
  static maybeOf(context:BuildContext):FormState|null{return context.maybeDependOn(FormScope)?.state??null;}
  static of(context:BuildContext):FormState{const state=this.maybeOf(context);invariant(state,'missing-form','Form.of requires a Form ancestor');return state;}
}
interface RegisteredField {readonly mounted:boolean;readonly enabled:boolean;validate():boolean;save():void;reset():void;rebuild():void}
export class FormState extends State<Form> {
  private readonly fields=new Set<RegisteredField>();
  private resetting=false;
  private interacted=false;
  get hasInteractedByUser():boolean{return this.interacted;}
  get autovalidateMode():AutovalidateMode{return this.widget.options.autovalidateMode??'disabled';}
  /** @internal Registration follows Element activation, including GlobalKey reparenting. */
  register(field:RegisteredField):void{this.fields.add(field);}
  unregister(field:RegisteredField):void{this.fields.delete(field);}
  fieldChanged(user=true):void{if(this.resetting)return;this.interacted ||= user;for(const field of this.fields)if(field.mounted)field.rebuild();this.widget.options.onChanged?.();}
  validate():boolean{invariant(this.mounted,'unmounted-form','Cannot validate an unmounted Form');let valid=true;for(const field of [...this.fields])if(this.fields.has(field)&&field.mounted&&field.enabled)valid=field.validate()&&valid;return valid;}
  save():void{invariant(this.mounted,'unmounted-form','Cannot save an unmounted Form');for(const field of [...this.fields])if(this.fields.has(field)&&field.mounted&&field.enabled)field.save();}
  reset():void{invariant(this.mounted,'unmounted-form','Cannot reset an unmounted Form');this.resetting=true;try{for(const field of [...this.fields])if(this.fields.has(field)&&field.mounted)field.reset();this.interacted=false;}finally{this.resetting=false;}this.widget.options.onChanged?.();}
  /** Validation precedes every save; invalid forms never invoke the submit callback. */
  submit(onValid:()=>void):boolean{if(!this.validate())return false;this.save();onValid();return true;}
  override dispose():void{this.fields.clear();super.dispose();}
  build():Widget{return new FormScope(this,this.widget.options.child);}
}
class FormScope extends InheritedWidget {
  constructor(readonly state:FormState,child:Widget){super(child);}
  updateShouldNotify(old:FormScope):boolean{return old.state!==this.state;}
}
export interface FormFieldOptions<T> extends WidgetOptions {
  readonly initialValue:T;readonly builder:(field:FormFieldState<T>)=>Widget;readonly validator?:(value:T)=>string|null;
  readonly onSaved?:(value:T)=>void;readonly onReset?:()=>void;readonly enabled?:boolean;readonly autovalidateMode?:AutovalidateMode;
}
export class FormField<T> extends StatefulWidget {
  constructor(readonly options:FormFieldOptions<T>){super(options.key??null);}
  createState():FormFieldState<T>{return new FormFieldState<T>();}
}
export class FormFieldState<T> extends State<FormField<T>> implements RegisteredField {
  private current!:T;
  private error:string|null=null;
  private interacted=false;
  private form:FormState|null=null;
  get value():T{return this.current;}
  get errorText():string|null{return this.error;}
  get hasError():boolean{return this.error!==null;}
  get hasInteractedByUser():boolean{return this.interacted;}
  get enabled():boolean{return this.widget.options.enabled??true;}
  override initState():void{super.initState();this.current=this.widget.options.initialValue;}
  override didChangeDependencies():void{super.didChangeDependencies();const form=Form.maybeOf(this.context);if(this.form!==form){this.form?.unregister(this);this.form=form;}this.form?.register(this);}
  override deactivate():void{this.form?.unregister(this);this.form=null;super.deactivate();}
  override dispose():void{this.form?.unregister(this);this.form=null;super.dispose();}
  rebuild():void{if(this.mounted)this.setState(()=>{});}
  didChange(value:T):void{this.setState(()=>{this.current=value;this.interacted=true;});this.form?.fieldChanged();}
  /** Controller replacement updates the value without marking a user interaction. */
  protected setValue(value:T):void{this.current=value;}
  validate():boolean{this.setState(()=>{this.error=this.enabled?this.widget.options.validator?.(this.current)??null:null;});return !this.hasError;}
  save():void{this.widget.options.onSaved?.(this.current);}
  reset():void{this.setState(()=>{this.current=this.widget.options.initialValue;this.error=null;this.interacted=false;});this.widget.options.onReset?.();this.form?.fieldChanged(false);}
  build():Widget{const mode=this.widget.options.autovalidateMode??this.form?.autovalidateMode??'disabled';if(this.enabled&&(mode==='always'||mode==='onUserInteraction'&&(this.interacted||this.form?.hasInteractedByUser)))this.error=this.widget.options.validator?.(this.current)??null;return this.widget.options.builder(this);}
}
