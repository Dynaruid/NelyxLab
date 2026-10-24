// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import type {TextPosition} from '../ui/text-position.ts';
import type {TextRange} from '../ui/text-range.ts';
import type {TextSelection} from './text-editing.ts';
export {TextPosition} from '../ui/text-position.ts';
export {TextRange} from '../ui/text-range.ts';
export {TextSelection} from './text-editing.ts';
export abstract class TextLayoutMetrics {
  static isWhitespace(codeUnit:number):boolean{return codeUnit>=0x9&&codeUnit<=0xd||codeUnit>=0x1c&&codeUnit<=0x20||codeUnit===0xa0||codeUnit===0x1680||codeUnit>=0x2000&&codeUnit<=0x200a||codeUnit===0x202f||codeUnit===0x205f||codeUnit===0x3000;}
  static isLineTerminator(codeUnit:number):boolean{return codeUnit>=0xa&&codeUnit<=0xd||codeUnit===0x85||codeUnit===0x2028||codeUnit===0x2029;}
  abstract getLineAtOffset(position:TextPosition):TextSelection;
  abstract getWordBoundary(position:TextPosition):TextRange;
  abstract getTextPositionAbove(position:TextPosition):TextPosition;
  abstract getTextPositionBelow(position:TextPosition):TextPosition;
}
