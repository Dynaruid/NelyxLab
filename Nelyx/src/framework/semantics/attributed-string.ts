// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import type {StringAttribute} from '../../ui/string-attribute.ts';
import {TextRange} from '../../ui/text-range.ts';
import {protect} from '../../ui/value-math.ts';
import {FoundationBuildMode} from '../../foundation/constants.ts';
import {invariant} from '../../foundation/errors.ts';
import {objectRuntimeType} from '../../foundation/object.ts';
import {hashValues} from '../painting/value-equality.ts';
export class AttributedString {
  readonly attributes:readonly StringAttribute[];
  constructor(readonly string:string,{attributes=[]}:{readonly attributes?:readonly StringAttribute[]}={}){if(FoundationBuildMode.debug){invariant(string.length>0||attributes.length===0,'empty-attributed-string','Empty text cannot carry attributes');for(const attribute of attributes)invariant(attribute.range.start<=string.length&&attribute.range.end<=string.length,'attributed-range-outside-string','Attribute range exceeds text length');}this.attributes=Object.freeze([...attributes]);if(new.target===AttributedString)Object.freeze(this);else protect(this,['string','attributes']);}
  add(other:AttributedString):AttributedString{if(this.string.length===0)return other;if(other.string.length===0)return this;const offset=this.string.length;return new AttributedString(this.string+other.string,{attributes:[...this.attributes,...other.attributes.map(attribute=>attribute.copy({range:new TextRange({start:attribute.range.start+offset,end:attribute.range.end+offset})}))]});}
  equals(other:unknown):boolean{return other instanceof AttributedString&&other.constructor===this.constructor&&this.string===other.string&&this.attributes.length===other.attributes.length&&this.attributes.every((value,i)=>value===other.attributes[i]);}
  get hashCode():number{return hashValues(this.string,this.attributes);}
  toString():string{return `${objectRuntimeType(this,'AttributedString')}('${this.string}', attributes: [${this.attributes.join(', ')}])`;}
}
