// SPDX-License-Identifier: BSD-3-Clause
import { build } from 'esbuild';
const watchdog = setTimeout(() => {
  throw Error('Scene blob hash checks exceeded 20 minutes');
}, 1_200_000);
try {
  const result = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: 'ts',
      contents: `
        import assert from 'node:assert/strict';
        import {SceneBlobJournal} from './Nelyx/runtime/engine-client/scene-blobs.ts';
        import {body,writeHandle,commands as c,protocol as p} from './Nelyx/runtime/engine-client/codec.ts';
        const referenceHash=bytes=>{
          let hash=2166136261;
          for(const value of bytes)hash=Math.imul(hash^value,16777619);
          return hash>>>0;
        },reference=new SceneBlobJournal(referenceHash),actual=new SceneBlobJournal();
        const rawHash=(actual as unknown as {hashBytes:(bytes:Uint8Array)=>number}).hashBytes;
        assert.equal(rawHash(new Uint8Array()),2166136261);
        assert.equal(rawHash(new Uint8Array([97])),0xe40c292c);
        assert.equal(rawHash(new Uint8Array([102,111,111,98,97,114])),0xbf9cf968);
        const bigintHash=bytes=>{
          let hash=2166136261n;
          for(const byte of bytes)hash=((hash^BigInt(byte))*16777619n)&0xffffffffn;
          return Number(hash);
        };
        let vectors=0;
        for(const length of [0,1,7,64,255,257,513,4096])for(const pattern of [0,1,31]){
          const backing=new Uint8Array(length+11);
          for(let i=0;i<backing.length;i++)backing[i]=pattern===0?255:(i*pattern+length)&255;
          const bytes=backing.subarray(11);
          assert.equal(rawHash(bytes),bigintHash(bytes),'Independent modulo-2^32 FNV differs');
          assert.equal(rawHash(bytes),referenceHash(bytes),'Historical imul FNV differs');
          vectors++;
        }
        for(const length of [1,7,64,257,513]){
          const bytes=new Uint8Array(length+9);
          for(let i=0;i<bytes.length;i++)bytes[i]=(i*31+length)&255;
          assert.equal(rawHash(bytes.subarray(9)),referenceHash(bytes.subarray(9)),'FNV value/offset differs');
        }
        const a={slot:1,generation:1},b={slot:2,generation:1};
        // Nonzero offset, all byte values, zeros and repeated bytes cross the
        // threshold without depending on a particular payload decoder.
        const config=(node,kind,seed,length=512)=>{
          const backing=body(7+16+length,v=>{
            v.setUint16(7,kind,true);v.setUint32(11,16+length,true);
            writeHandle(v,15,node);
          }),bytes=backing.subarray(7);
          for(let i=16;i<bytes.length;i++)bytes[i]=(i*seed+seed)&255;
          return bytes;
        };
        const descriptor=Object.getOwnPropertyDescriptor(Uint8Array.prototype,Symbol.iterator),
          iterate=Uint8Array.prototype[Symbol.iterator];
        let iterators=0,results=0;
        const prepare=(journal,changes)=>{
          iterators=results=0;
          Object.defineProperty(Uint8Array.prototype,Symbol.iterator,{configurable:true,writable:true,
            value:function(){
              ++iterators;const iterator=iterate.call(this);
              return {next(){++results;return iterator.next();}};
            }});
          try{return {plan:journal.prepare(changes),iterators,results};}
          finally{
            if(descriptor)Object.defineProperty(Uint8Array.prototype,Symbol.iterator,descriptor);
            else delete Uint8Array.prototype[Symbol.iterator];
          }
        };
        let stages=0,referenceResults=0,actualResults=0;
        const step=(changes,accept=true)=>{
          const expected=prepare(reference,changes),got=prepare(actual,changes);
          referenceResults+=expected.results;actualResults+=got.results;
          assert.deepEqual(got.plan.commands,expected.plan.commands,'Canonical blob wire/ID differs at '+stages);
          assert.equal(got.iterators,0,'Default raw byte hash consulted a typed-array iterator');
          const before=actual.diagnostics();
          for(const plan of [expected.plan,got.plan]){
            if(accept){plan.accept();plan.accept();plan.reject();}
            else{plan.reject();plan.reject();plan.accept();}
          }
          assert.deepEqual(actual.diagnostics(),reference.diagnostics(),'Accept/reject ownership differs');
          if(!accept)assert.deepEqual(actual.diagnostics(),before,'Rejected plan was adopted');
          ++stages;
        };
        step([config(a,p.commands.paragraphOptions,1),config(b,p.commands.paragraphOptions,1)]);
        assert.equal(actual.diagnostics().registrations,1,'Equal wire bytes were not shared');
        step([config(a,p.commands.semantics,3),config(b,p.commands.nativePaint,5)]);
        step([]);
        step([config(a,p.commands.paragraphOptions,7),config(b,p.commands.paragraphOptions,7)],false);
        step([config(a,p.commands.paragraphOptions,9)]);
        step([config(b,p.commands.paragraphOptions,1)]);
        step([config(a,p.commands.semantics,11,1)]);
        step([c.destroy(a,true)]);
        step([config({slot:1,generation:2},p.commands.paragraphOptions,13)]);
        step([c.paint(b,0xffabcdef)]);
        step([config(b,p.commands.nativePaint,15)],false);
        step([c.destroy({slot:1,generation:2},true),c.destroy(b,true)]);
        assert.equal(actual.diagnostics().bytes,0,'Blob bytes survived terminal retirement');
        assert.equal(actualResults,0);
        assert(referenceResults>5000,'Reference did not exercise per-byte iterator results');
        console.log('Scene blob hash: '+vectors+' independent BigInt/imul vectors and '+stages+' wire/ID/sharing/offset/rollback/recycle/retirement stages PASS; typed-array iterator results '+referenceResults+' -> '+actualResults+'.');
      `,
    },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    logLevel: 'silent',
  });
  await import(
    'data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].contents).toString('base64')
  );
} catch (error) {
  console.error('Scene blob hash: ' + String(error.message ?? error).slice(0, 1800));
  process.exitCode = 1;
} finally {
  clearTimeout(watchdog);
}
