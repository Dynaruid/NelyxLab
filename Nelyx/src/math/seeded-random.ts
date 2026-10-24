// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2012, the Dart project authors. Please see the AUTHORS file
// for details. All rights reserved. Use of this source code is governed by a
// BSD-style license that can be found in licenses/Dart-LICENSE.md.
// Internal deterministic adapter for Curve2D sampling: Dart SDK 3.14.0-296.0.dev
// lib/_internal/vm/lib/math_patch.dart (_Random's seeded MWC and 64-bit seed mix).
import {invariant} from '../foundation/errors.ts';

export class SeededRandom {
  private state:bigint;
  constructor(seed:number|bigint){
    invariant(typeof seed==='bigint'||Number.isSafeInteger(seed),'inexact-random-seed','A numeric random seed must be an exact integer');
    const u64=(v:bigint)=>BigInt.asUintN(64,v);let n=u64(BigInt(seed));
    n=u64((~n)+(n<<21n));n^=n>>24n;n=u64(n*265n);n^=n>>14n;n=u64(n*21n);n^=n>>28n;n=u64(n+(n<<31n));
    this.state=n===0n?0x5a17n:n;for(let i=0;i<4;i++)this.nextState();
  }
  private nextState():void{this.state=0xffffda61n*(this.state&0xffffffffn)+(this.state>>32n);}
  /**
   * @dartParam max int
   * @dartReturn int
   */
  nextInt(max:number):number{
    invariant(Number.isSafeInteger(max)&&max>0&&max<=4294967296,'invalid-random-maximum','Random.nextInt max must be positive and <= 2^32');
    const bound=BigInt(max);
    if((bound&-bound)===bound){this.nextState();return Number(this.state&0xffffffffn&(bound-1n));}
    let value:number,result:number;
    do{this.nextState();value=Number(this.state&0xffffffffn);result=value%max;}while(value-result+max>4294967296);
    return result;
  }
  nextDouble():number{
    this.nextState();const high=Number(this.state&0x3ffffffn);
    this.nextState();return (high*134217728+Number(this.state&0x7ffffffn))/9007199254740992;
  }
}
