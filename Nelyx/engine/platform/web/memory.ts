// SPDX-License-Identifier: BSD-3-Clause
import {body,packet,protocol as p,response} from '../../../runtime/engine-client/index.ts';
import {exchange,sessionOwner} from './common.ts';
import type {BrowserModule} from './common.ts';
/** Host-only, absolute accounts in the shared C++ session ledger. */
export class ProviderBudget {
  private accounts=[0,0,0,0,0,0];
  private closed=false;
  constructor(private module:BrowserModule,private engine:number,private owner:number){}
  set(kind:number,bytes:number):void {
    if(this.closed||!Number.isSafeInteger(bytes)||bytes<0)throw new Error('Invalid memory account');
    const result=response(exchange(this.module,this.engine,packet(p.opcodes.memoryReport,sessionOwner,body(16,v=>{
      v.setUint32(0,this.owner,true);v.setUint32(4,kind,true);v.setBigUint64(8,BigInt(bytes),true);
    }))));
    if(result.status!==p.statuses.ok)throw new Error(`Unified memory budget rejected (${result.status})`);
    this.accounts[kind]=bytes;
  }
  reserve(kind:number,bytes:number):()=>void {
    this.set(kind,this.accounts[kind]!+bytes);let held=true;
    return ()=>{if(held){held=false;this.set(kind,this.accounts[kind]!-bytes);}};
  }
  close():void {if(this.closed)return;for(let kind=1;kind<6;++kind)this.set(kind,0);this.closed=true;}
}
