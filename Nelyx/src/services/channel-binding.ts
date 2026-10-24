// SPDX-License-Identifier: BSD-3-Clause
import {FlutterError} from '../foundation/flutter-error.ts';
import type {BinaryMessenger} from './binary-messenger.ts';
/** Explicit per-realm root/worker binding; concurrent different owners must inject. */
export class PlatformChannelBinding{
  private static messenger:BinaryMessenger|undefined;
  private static readonly leases=new Set<object>();
  static get initialized():boolean{return this.messenger!==undefined;}
  static get binaryMessenger():BinaryMessenger{if(!this.messenger)throw new FlutterError('Platform channels require an initialized binary messenger. Bind the embedding messenger or pass a BinaryMessenger explicitly.');return this.messenger;}
  static bind(messenger:BinaryMessenger):{dispose():void}{if(this.messenger&&this.messenger!==messenger)throw new FlutterError('A different default binary messenger already owns this realm. Pass an explicit BinaryMessenger for concurrent applications.');const lease={};this.messenger=messenger;this.leases.add(lease);return {dispose:()=>{if(!this.leases.delete(lease))return;if(!this.leases.size)this.messenger=undefined;}};}
}
