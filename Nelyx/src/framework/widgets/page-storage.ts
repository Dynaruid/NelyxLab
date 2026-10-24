// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {Key,ValueKey} from '../../foundation/key.ts';
import {invariant} from '../../foundation/errors.ts';
import {StatelessWidget} from './framework.ts';
import type {BuildContext,Widget,WidgetOptions} from './framework.ts';
export class PageStorageKey<T> extends ValueKey<T> {}
class _StorageEntryIdentifier {
  constructor(readonly keys:readonly PageStorageKey<unknown>[]){}
  get isNotEmpty():boolean{return this.keys.length>0;}
  equals(other:unknown):boolean{return other instanceof _StorageEntryIdentifier&&other.keys.length===this.keys.length&&this.keys.every((key,i)=>key.equals(other.keys[i]!));}
  toString():string{return `StorageEntryIdentifier(${this.keys.join(':')})`;}
}
/** Equality-aware entries preserve Source ValueKey semantics rather than JS object identity. */
export class PageStorageBucket {
  private storage:{identifier:unknown;data:unknown}[]|null=null;
  private computeIdentifier(context:BuildContext):_StorageEntryIdentifier{
    const keys:PageStorageKey<unknown>[]=[];const add=(context:BuildContext)=>{const widget=context.widget;if(widget.key instanceof PageStorageKey)keys.push(widget.key);return !(widget instanceof PageStorage);};
    if(add(context))context.visitAncestorElements(add);return new _StorageEntryIdentifier(keys);
  }
  private same(a:unknown,b:unknown):boolean{return a instanceof _StorageEntryIdentifier?a.equals(b):a instanceof Key?b instanceof Key&&a.equals(b):Object.is(a,b);}
  writeState(context:BuildContext,data:unknown,{identifier=null}:{readonly identifier?:unknown}={}):void{
    const key=identifier??this.computeIdentifier(context);if(key instanceof _StorageEntryIdentifier&&!key.isNotEmpty)return;this.storage??=[];const entry=this.storage.find(entry=>this.same(entry.identifier,key));if(entry)entry.data=data;else this.storage.push({identifier:key,data});
  }
  readState(context:BuildContext,{identifier=null}:{readonly identifier?:unknown}={}):unknown{
    if(this.storage===null)return null;const key=identifier??this.computeIdentifier(context);return key instanceof _StorageEntryIdentifier&&!key.isNotEmpty?null:this.storage.find(entry=>this.same(entry.identifier,key))?.data??null;
  }
}
export class PageStorage extends StatelessWidget {
  readonly bucket:PageStorageBucket;readonly child:Widget;
  constructor({bucket,child,...options}:WidgetOptions&{readonly bucket:PageStorageBucket;readonly child:Widget}){super(options.key??null);this.bucket=bucket;this.child=child;}
  static maybeOf(context:BuildContext):PageStorageBucket|null{return context.findAncestorWidgetOfExactType(PageStorage)?.bucket??null;}
  static of(context:BuildContext):PageStorageBucket{const bucket=this.maybeOf(context);invariant(bucket,'missing-page-storage','PageStorage.of requires a PageStorage ancestor');return bucket;}
  build(_context:BuildContext):Widget{return this.child;}
}
