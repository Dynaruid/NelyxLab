// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from dart:ui/platform_dispatcher.dart. Tokens identify an SDK root,
// not a Dart VM isolate or an authorization credential.
import {PlatformDispatcher} from './platform-dispatcher.ts';
export class RootIsolateToken {
  private constructor(private readonly _token:string){Object.freeze(this);}
  private static __getRootIsolateToken():RootIsolateToken|null{return PlatformDispatcher.initialized?PlatformDispatcher.instance.rootIsolateToken:null;}
  static get instance():RootIsolateToken|null{return this.__getRootIsolateToken();}
  /** Cloneable embedding identity; access requires an independently transferred port. */
  get owner():string{return this._token;}
  toMessage():Readonly<{owner:string}>{return Object.freeze({owner:this._token});}
  static fromMessage(value:{readonly owner:string}):RootIsolateToken {
    if(!value||typeof value.owner!=='string'||!value.owner||value.owner.length>1024||value.owner.includes('\0'))throw new TypeError('Invalid root isolate token');
    return new RootIsolateToken(value.owner);
  }
}
