// SPDX-License-Identifier: BSD-3-Clause
import {ScrollCacheExtent} from '../rendering/viewport.ts';
const constants=new WeakMap<typeof ScrollCacheExtent,Map<number|string,ScrollCacheExtent>>();
/** Exact const pixels constructor; signed zero stays distinct in the table. */
export function constantPixelCacheExtent(owner:typeof ScrollCacheExtent,value:number):ScrollCacheExtent{
  if(typeof value!=='number')throw new TypeError('Cache pixels must be a number');const key=Object.is(value,-0)?'-0':value;
  let values=constants.get(owner);if(!values){values=new Map();constants.set(owner,values);}let result=values.get(key);if(!result){result=owner.pixels(value);values.set(key,result);}return result;
}
