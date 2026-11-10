// SPDX-License-Identifier: BSD-3-Clause
import { build } from 'esbuild';
const watchdog = setTimeout(() => {
  throw Error('Web exchange checks exceeded 20 minutes');
}, 1200000);
try {
  const result = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: 'ts',
      contents: `
      import assert from 'node:assert/strict';
      import {exchange,forgetHeapReport,sessionOwner,CommittedMemoryError} from './Nelyx/engine/platform/web/common.ts';
      import {packet,protocol as p} from './Nelyx/runtime/engine-client/codec.ts';
      function fixture(){
        const memory=new WebAssembly.Memory({initial:1}),reports=[];
        const state={payloads:0,frees:0,releases:0,grow:false,fail:false,reject:false};
        const module={HEAPU8:new Uint8Array(memory.buffer),_nelyx_wasm_refresh_heap(){this.HEAPU8=new Uint8Array(memory.buffer);},
          _malloc(){return 64;},_free(){++state.frees;},_nelyx_wasm_release(){++state.releases;},
          _nelyx_wasm_buffer_data(){return 8192;},_nelyx_wasm_buffer_length(){return p.headerBytes;},
          _nelyx_wasm_dispatch(_engine,pointer,length){
            const request=new DataView(this.HEAPU8.buffer,pointer,length),op=request.getUint16(p.headerFields.opcode,true);
            if(op===p.opcodes.memoryReport)reports.push(Number(request.getBigUint64(p.headerBytes+8,true)));
            else{++state.payloads;if(state.grow){memory.grow(1);state.grow=false;}if(state.fail){state.fail=false;throw Error('dispatch rejected');}}
            this._nelyx_wasm_refresh_heap();this.HEAPU8.fill(0,8192,8192+p.headerBytes);
            new DataView(this.HEAPU8.buffer,8192,p.headerBytes).setUint16(p.headerFields.status,
              op===p.opcodes.memoryReport&&state.reject?p.statuses.budgetExceeded:p.statuses.ok,true);
            return 1;
          }};
        return {module,memory,reports,state};
      }
      const {module,memory,reports,state}=fixture(),request=packet(p.opcodes.inspect,sessionOwner);
      for(let i=0;i<8;++i)exchange(module as any,1,request);
      assert.equal(reports.length,1,'Unchanged heap dispatched repeated Core memory reports');
      assert.equal(state.payloads,8);
      state.grow=true;const owned=exchange(module as any,1,request),before=owned.slice();
      assert.equal(reports.length,2);assert.equal(reports.at(-1),memory.buffer.byteLength);
      memory.grow(1);exchange(module as any,1,request);
      assert.equal(reports.length,3,'A grow by another owner was hidden by a stale view');
      module.HEAPU8.fill(255,8192,8192+p.headerBytes);assert.deepEqual(owned,before,'Output borrowed the refreshed/grown heap');
      state.grow=true;state.fail=true;assert.throws(()=>exchange(module as any,1,request),/dispatch rejected/);
      assert.equal(reports.at(-1),memory.buffer.byteLength,'Failed dispatch left growth unreported');
      const payloads=state.payloads;memory.grow(1);state.reject=true;
      assert.throws(()=>exchange(module as any,1,request),CommittedMemoryError);
      assert.equal(state.payloads,payloads,'Rejected committed memory admitted ordinary work');
      const rejectedCount=reports.length;state.reject=false;exchange(module as any,1,request);
      assert.equal(reports.length,rejectedCount+1,'Rejected memory report became a cached acknowledgement');
      const count=reports.length;exchange(module as any,2,request);assert.equal(reports.length,count+1,'Engine instances shared an acknowledgement');
      forgetHeapReport(module as any,1);exchange(module as any,1,request);assert.equal(reports.length,count+2);
      exchange(module as any,1,packet(p.opcodes.closeSession,sessionOwner));exchange(module as any,1,request);
      assert.equal(reports.length,count+3,'Reused engine address retained the closed session acknowledgement');
      const other=fixture();exchange(other.module as any,1,request);assert.equal(other.reports.length,1,'Module owners shared an acknowledgement');
      assert.equal(state.frees,state.releases+1,'A failed dispatch leaked its input allocation');
      console.log('Web exchange: one report for stable heap, local/foreign growth, failure accounting, owned output, budget rejection, instance isolation and close/reset PASS.');
      `,
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    target: 'node24',
    logLevel: 'silent',
  });
  await import(
    'data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].contents).toString('base64')
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  clearTimeout(watchdog);
}
