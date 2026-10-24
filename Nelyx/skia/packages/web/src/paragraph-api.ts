// SPDX-License-Identifier: BSD-3-Clause
import type {CanvasKit,Paragraph} from 'canvaskit-wasm';
/** Additions are supplied by the pinned Nelyx binding, never inferred from npm's version. */
export interface OwnedParagraphRuntime {nelyxParagraphApiVersion?:()=>number}
export interface OwnedParagraph extends Paragraph {nelyxLineNumberAtUTF16?:(offset:number)=>number}
export function paragraphApiVersion(ck:CanvasKit):number{return (ck as CanvasKit&OwnedParagraphRuntime).nelyxParagraphApiVersion?.()??0;}
