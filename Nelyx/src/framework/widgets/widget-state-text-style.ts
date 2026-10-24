// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {TextStyle} from '../painting/text-style.ts';
import {sourceTextStyleType,captureSourceTextStyle} from '../painting/source-value-types.ts';
import {SourceWidgetStateProperty as Property,SourceWidgetStateMapper,SourceWidgetState,SourceWidgetStatesConstraint} from './widget-state.generated.ts';
import type {DartSet,DartMap} from '../../foundation/dart-collections.ts';
import {applyDartType,captureDartType} from '../../foundation/dart-type-witness.ts';
import {registerDartValueSemantics} from '../../foundation/dart-value.ts';
import {DartMapHash} from '../../foundation/dart-map-equality.ts';
import {FlutterError} from '../../foundation/flutter-error.ts';
import {widgetStateDiagnosticableType} from './widget-state-diagnostic-source-adapter.ts';
const propertyType=applyDartType<Property<TextStyle>>(Property,'WidgetStateProperty',[sourceTextStyleType],[]);
const mapperType=applyDartType<SourceWidgetStateMapper<TextStyle>>(SourceWidgetStateMapper,'WidgetStateMapper',[sourceTextStyleType],[propertyType,widgetStateDiagnosticableType]);
function admitted(value:unknown):TextStyle{if(!(value instanceof TextStyle))throw new TypeError('WidgetStateTextStyle requires the canonical Core TextStyle');return captureSourceTextStyle(value);}
/** A resolver is an empty TextStyle outside a widget that explicitly resolves it. */
export abstract class WidgetStateTextStyle extends TextStyle implements Property<TextStyle> {
  constructor(){super();captureDartType(this,stateStyleType);}
  abstract resolve(states:DartSet<SourceWidgetState>):TextStyle;
  static resolveWith(callback:(states:DartSet<SourceWidgetState>)=>TextStyle):WidgetStateTextStyle{return new ResolvedStyle(callback);}
  static fromMap(map:DartMap<SourceWidgetStatesConstraint,TextStyle>):WidgetStateTextStyle {
    const target=new MappedStyle(map),blocked=new Set<PropertyKey>([...Object.keys(new TextStyle()),'fontFamilyFallback','copyWith','merge','apply','getTextStyle','getParagraphStyle','compareTo']);
    const proxy=new Proxy(target,{get(object,key,receiver){if(blocked.has(key))throw new FlutterError('WidgetStateTextStyle.fromMap must be resolved by a supporting widget before reading TextStyle fields.');return Reflect.get(object,key,receiver);}});
    captureDartType(proxy,stateStyleType);captureDartType(proxy,mappedStyleType);return proxy;
  }
}
const stateStyleType=applyDartType<WidgetStateTextStyle>(WidgetStateTextStyle,'WidgetStateTextStyle',[],[sourceTextStyleType,propertyType]);
class ResolvedStyle extends WidgetStateTextStyle {
  constructor(private readonly callback:(states:DartSet<SourceWidgetState>)=>TextStyle){super();}
  resolve(states:DartSet<SourceWidgetState>):TextStyle{return admitted(this.callback(states));}
}
class MappedStyle extends WidgetStateTextStyle {
  readonly mapper:SourceWidgetStateMapper<TextStyle>;
  constructor(private readonly map:DartMap<SourceWidgetStatesConstraint,TextStyle>){super();this.mapper=new SourceWidgetStateMapper(sourceTextStyleType,map);Object.defineProperties(this,Object.getOwnPropertyDescriptors(this.mapper));captureDartType(this,mappedStyleType);}
  resolve(states:DartSet<SourceWidgetState>):TextStyle{return admitted(this.mapper.resolve(states));}
  override equals(other:unknown):boolean{return other!==null&&other!==undefined&&this.mapper.equals(other as {});}
  override get hashCode():number{return new DartMapHash<TextStyle>(admitted).hash(this.map);}
  override toString():string{return this.mapper.toString();}
}
const mappedStyleType=applyDartType<MappedStyle>(MappedStyle,'_WidgetTextStyleMapper',[],[stateStyleType,mapperType]);
registerDartValueSemantics(WidgetStateTextStyle,{accepts:(value:unknown):value is WidgetStateTextStyle=>value instanceof WidgetStateTextStyle,equals:(value,other)=>value.equals(other),hash:value=>value.hashCode,string:value=>value.toString()});
