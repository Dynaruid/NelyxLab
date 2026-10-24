// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from BindingBase._initListenable at the recorded Flutter pin.
import {Listenable} from './notifier.ts';
import { FlutterError } from "./flutter-error.ts";
import { FlutterErrorDetails } from "./assertions.ts";
import { ErrorDescription } from "./diagnostics.ts";
import {NelyxError,invariant} from './errors.ts';
let initialized=false;
/** Install the framework's application-wide listener bridge once, preserving later custom hooks. */
export function initializeFoundationBindings():boolean{
  if(initialized)return false;
  Listenable.onError=(error,stack,context)=>{
    if(context==='assertion'){
      if(error instanceof FlutterError)throw error;
      let message:string;
      if(error instanceof NelyxError||error instanceof Error&&error.name==='StateError')message=error.message;
      else if(error instanceof Error&&(error.name==='AssertionError'||error.constructor.name==='AssertionError')){const value=(error as {message:unknown}).message;message=value===null||value===undefined?String(error):String(value);}
      else message=String(error);
      throw new FlutterError(message);
    }
    invariant(context==='listener','invalid-listener-error-context','Unknown notifier error context');
    FlutterError.reportError(new FlutterErrorDetails({exception:error,...(stack?{stack}:{}),library:'foundation library',context:new ErrorDescription('while dispatching notifications for Listenable')}));
  };
  initialized=true;return true;
}
