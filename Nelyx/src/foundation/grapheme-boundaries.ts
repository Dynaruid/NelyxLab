// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2018, the Dart project authors. All rights reserved.
// Whole-string traversal of the pinned characters 1.4.1 forward automaton.
import {graphemeLow,graphemeHigh,graphemeMove} from './grapheme-break-data.ts';
/** @internal UTF-16 offsets, including start and end, independent of host ICU/Intl. */
export function graphemeBoundaries(text:string):readonly number[]{
  const breaks:number[]=[];let state=0x0d*20,cursor=0;
  while(cursor<text.length){
    const at=cursor,char=text.charCodeAt(cursor++),lead=char^0xd800;let category:number;
    if(lead>0x3ff)category=graphemeLow(char);
    else if(cursor<text.length&&(text.charCodeAt(cursor)^0xdc00)<=0x3ff)category=graphemeHigh(lead,text.charCodeAt(cursor++)^0xdc00);
    else category=1;
    state=graphemeMove(state,category);if((state&3)!==0)breaks.push(at);
  }
  state=graphemeMove(state,18);if((state&3)!==0)breaks.push(cursor);
  return Object.freeze(breaks.length?breaks:[0]);
}
