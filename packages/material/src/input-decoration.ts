// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Product adaptation of the pinned InputDecoration value contract; M3 only.
import type {Widget} from '@nelyx/core/framework/widgets/framework';
import type {Color} from '@nelyx/core/ui/color';
import type {TextStyle} from '@nelyx/core/framework/painting/text-style';
import {EdgeInsets} from '@nelyx/core/framework/painting/edge-insets';
import type {EdgeInsetsGeometry} from '@nelyx/core/framework/painting/edge-insets';
import type {BoxConstraints} from '@nelyx/core/framework/rendering/constraints';
import {invariant} from '@nelyx/core/foundation/errors';
import {valueEquals,hashValues} from '@nelyx/core/framework/painting/value-equality';
import {Diagnosticable} from '@nelyx/core/foundation/diagnosticable';
import {DiagnosticsProperty} from '@nelyx/core/foundation/diagnostics';
import type {DiagnosticPropertiesBuilder} from '@nelyx/core/foundation/diagnostics';
import type {VisualDensity} from './theme-data.ts';
import type {FloatingLabelBehavior} from './floating-label-behavior.ts';
import type {FloatingLabelAlignment} from './floating-label-alignment.ts';
import {InputBorder} from './input-border.ts';
import {InputDecorationTheme} from './input-decoration-theme.ts';
import {InputDecorationThemeData} from './input-decoration-theme-data.ts';

interface DecorationValues {
    readonly icon:Widget|null;readonly iconColor:Color|null;
    readonly label:Widget|null;readonly labelText:string|null;readonly labelStyle:TextStyle|null;readonly floatingLabelStyle:TextStyle|null;
    readonly helper:Widget|null;readonly helperText:string|null;readonly helperStyle:TextStyle|null;
    readonly helperMaxLines:InputDecorationThemeData['helperMaxLines'];
    readonly hint:Widget|null;readonly hintText:string|null;readonly hintStyle:TextStyle|null;readonly hintTextDirection:'ltr'|'rtl'|null;
    readonly hintMaxLines:InputDecorationThemeData['hintMaxLines'];readonly hintFadeDuration:number|null;
    readonly maintainHintSize:boolean;readonly maintainLabelSize:boolean;
    readonly error:Widget|null;readonly errorText:string|null;readonly errorStyle:TextStyle|null;
    readonly errorMaxLines:InputDecorationThemeData['errorMaxLines'];
    readonly floatingLabelBehavior:FloatingLabelBehavior|null;readonly floatingLabelAlignment:FloatingLabelAlignment|null;
    readonly isDense:boolean|null;readonly isCollapsed:boolean|null;readonly contentPadding:EdgeInsetsGeometry|null;
    readonly prefixIcon:Widget|null;readonly prefixIconConstraints:BoxConstraints|null;readonly prefixIconColor:Color|null;
    readonly prefix:Widget|null;readonly prefixText:string|null;readonly prefixStyle:TextStyle|null;
    readonly suffixIcon:Widget|null;readonly suffixIconConstraints:BoxConstraints|null;readonly suffixIconColor:Color|null;
    readonly suffix:Widget|null;readonly suffixText:string|null;readonly suffixStyle:TextStyle|null;
    readonly counter:Widget|null;readonly counterText:string|null;readonly counterStyle:TextStyle|null;
    readonly filled:boolean|null;readonly fillColor:Color|null;readonly focusColor:Color|null;readonly hoverColor:Color|null;
    readonly errorBorder:InputBorder|null;readonly focusedBorder:InputBorder|null;readonly focusedErrorBorder:InputBorder|null;
    readonly disabledBorder:InputBorder|null;readonly enabledBorder:InputBorder|null;readonly border:InputBorder|null;
    readonly enabled:boolean;readonly semanticCounterText:string|null;readonly alignLabelWithHint:boolean|null;
    readonly constraints:BoxConstraints|null;readonly visualDensity:VisualDensity|null;
}
export interface InputDecorationOptions extends Partial<DecorationValues> {}
export type CollapsedInputDecorationOptions=Pick<InputDecorationOptions,'hint'|'hintStyle'|'hintTextDirection'|'hintMaxLines'|'hintFadeDuration'|'maintainHintSize'|'maintainLabelSize'|'filled'|'fillColor'|'focusColor'|'hoverColor'|'border'|'enabled'|'constraints'>&{readonly hintText:string|null};
const defaults:DecorationValues={
    icon:null,iconColor:null,label:null,labelText:null,labelStyle:null,floatingLabelStyle:null,
    helper:null,helperText:null,helperStyle:null,helperMaxLines:null,hint:null,hintText:null,hintStyle:null,hintTextDirection:null,
    hintMaxLines:null,hintFadeDuration:null,maintainHintSize:true,maintainLabelSize:false,error:null,errorText:null,errorStyle:null,errorMaxLines:null,
    floatingLabelBehavior:null,floatingLabelAlignment:null,isDense:null,isCollapsed:null,contentPadding:null,
    prefixIcon:null,prefixIconConstraints:null,prefixIconColor:null,prefix:null,prefixText:null,prefixStyle:null,
    suffixIcon:null,suffixIconConstraints:null,suffixIconColor:null,suffix:null,suffixText:null,suffixStyle:null,
    counter:null,counterText:null,counterStyle:null,filled:null,fillColor:null,focusColor:null,hoverColor:null,
    errorBorder:null,focusedBorder:null,focusedErrorBorder:null,disabledBorder:null,enabledBorder:null,border:null,
    enabled:true,semanticCounterText:null,alignLabelWithHint:null,constraints:null,visualDensity:null,
};
const fields=Object.freeze(Object.keys(defaults) as (keyof DecorationValues)[]);
const themedFields=Object.freeze([
    'labelStyle','floatingLabelStyle','helperStyle','helperMaxLines','hintStyle','hintFadeDuration','hintMaxLines','errorStyle','errorMaxLines',
    'floatingLabelBehavior','floatingLabelAlignment','isDense','contentPadding','isCollapsed','iconColor','prefixStyle','prefixIconColor','prefixIconConstraints',
    'suffixStyle','suffixIconColor','suffixIconConstraints','counterStyle','filled','fillColor','focusColor','hoverColor',
    'errorBorder','focusedBorder','focusedErrorBorder','disabledBorder','enabledBorder','border','alignLabelWithHint','constraints','visualDensity',
] as const);
export interface InputDecoration extends Readonly<DecorationValues> {}
/** Immutable decoration specification. Widget and text forms of the same slot are exclusive. */
export class InputDecoration extends Diagnosticable(class {}) {
    constructor(options:InputDecorationOptions={}) {
        super();
        invariant(Object.keys(options).every(key=>Object.hasOwn(defaults,key)),'unknown-input-decoration-option','Unknown or deprecated InputDecoration option');
        Object.assign(this,Object.fromEntries(fields.map(key=>[key,options[key]??defaults[key]])));
        for(const [widget,text]of [['label','labelText'],['hint','hintText'],['helper','helperText'],['error','errorText'],['prefix','prefixText'],['suffix','suffixText']] as const)
            invariant(this[widget]===null||this[text]===null,'ambiguous-input-decoration-slot','Choose '+widget+' or '+text);
        for(const name of ['helperMaxLines','hintMaxLines','errorMaxLines'] as const)invariant(this[name]===null||Number.isSafeInteger(this[name])&&this[name]!>0,'invalid-decoration-lines','Decoration line counts must be positive');
        invariant(this.hintFadeDuration===null||Number.isFinite(this.hintFadeDuration)&&this.hintFadeDuration>=0,'invalid-decoration-duration','Hint fade duration must be nonnegative milliseconds');
        Object.freeze(this);
    }
    static collapsed(options:CollapsedInputDecorationOptions):InputDecoration {
        invariant(Object.keys(options).every(key=>['hintText','hint','hintStyle','hintTextDirection','hintMaxLines','hintFadeDuration','maintainHintSize','maintainLabelSize','filled','fillColor','focusColor','hoverColor','border','enabled','constraints'].includes(key)),'invalid-collapsed-decoration','Collapsed decoration supports hint, fill, border and constraints only');
        return new InputDecoration({...options,isCollapsed:true,contentPadding:EdgeInsets.zero,filled:options.filled===undefined?false:options.filled,border:options.border===undefined?InputBorder.none:options.border});
    }
    copyWith(options:InputDecorationOptions={}):InputDecoration {
        invariant(Object.keys(options).every(key=>Object.hasOwn(defaults,key)),'unknown-input-decoration-option','Unknown or deprecated InputDecoration option');
        return new InputDecoration(Object.fromEntries(fields.map(key=>[key,options[key]??this[key]])));
    }
    applyDefaults(input:InputDecorationThemeData|InputDecorationTheme):InputDecoration {
        invariant(input instanceof InputDecorationThemeData||input instanceof InputDecorationTheme,'invalid-decoration-theme','Use canonical InputDecorationThemeData or InputDecorationTheme');
        const theme=input instanceof InputDecorationTheme?input.data:input;
        return this.copyWith(Object.fromEntries(themedFields.map(key=>[key,this[key]??theme[key]])));
    }
    equals(other:unknown):boolean{return this===other||other instanceof InputDecoration&&other.constructor===this.constructor&&fields.every(key=>valueEquals(this[key],other[key]));}
    get hashCode():number{return hashValues(...fields.map(key=>this[key]));}
    override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);for(const key of fields)properties.add(new DiagnosticsProperty(key,this[key],{defaultValue:defaults[key]}));}
}
