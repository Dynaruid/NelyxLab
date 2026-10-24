// SPDX-License-Identifier: BSD-3-Clause
import {invariant} from '../../foundation/errors.ts';
let paintDepth=0;
/** Synchronous callbacks cannot reopen layout or build after frame painting starts. */
export function withRenderPaint<T>(callback:()=>T):T{paintDepth++;try{return callback();}finally{paintDepth--;}}
export function assertOutsideRenderPaint():void{invariant(paintDepth===0,'mutation-during-paint','Build, layout and render tree mutations are forbidden during paint callbacks');}
