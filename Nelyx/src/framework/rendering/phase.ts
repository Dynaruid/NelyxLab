// SPDX-License-Identifier: BSD-3-Clause
import {invariant} from '../../foundation/errors.ts';
let paintDepth=0;
/** Synchronous callbacks cannot reopen layout or build after frame painting starts. */
export function withRenderPaint<T>(callback:()=>T):T{paintDepth++;try{return callback();}finally{paintDepth--;}}
export function assertOutsideRenderPaint():void{
  // Keep the constant error path out of successful render and mount calls.
  if(paintDepth!==0)invariant(false,'mutation-during-paint','Build, layout and render tree mutations are forbidden during paint callbacks');
}
