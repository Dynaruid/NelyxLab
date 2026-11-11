// SPDX-License-Identifier: BSD-3-Clause
import { build } from 'esbuild';
const watchdog = setTimeout(() => {
  throw Error('Prepared resource checks exceeded 20 minutes');
}, 1200000);
try {
  const result = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: 'ts',
      contents: `
      import assert from 'node:assert/strict';
      import {CanvasKitProvider} from './Nelyx/engine/render/canvaskit-web/provider.ts';
      import {protocol as p} from './Nelyx/runtime/engine-client/schema.ts';
      for (const count of [64,2048]) {
        let credit=0;
        const source=Object.create(CanvasKitProvider.prototype) as any;
        const scene={preparation:1n,activePreparation:0n,preparationDocument:1n,metrics:1n,device:1n,fontRevision:1n,
          blobs:[],nodes:Array.from({length:count},(_,i)=>({node:{slot:i+1,generation:1},kind:p.kinds.box,
            width:20,height:20,color:0xff123456,radius:0,fontSize:14,flags:0}))};
        Object.assign(source,{recorded:new Map(),preparedRecords:new Map(),measurePreparation:0n,
          measuredParagraphs:new Map(),paragraphCollections:new Map(),regularTypefaces:new Map(),
          nextRecordToken:0,pictureOwners:new Map(),resourceFonts:new Map(),
          ck:{PictureRecorder:class {beginRecording(){return {drawRRect(){}};}
            finishRecordingAsPicture(){return {serialize:()=>new Uint8Array([1,2,3]),delete(){}};}delete(){}},
            Paint:class {setAntiAlias(){}setColor(){}delete(){}},XYWHRect:()=>new Float32Array(4),
            Color:(...values)=>values,RRectXY:(rect)=>rect},
          counters:new Proxy({},{get:(target,key)=>target[key]??0,set:(target,key,value)=>{target[key]=value;return true;}}),
          budget:{reserve(_kind,bytes){credit+=bytes;return()=>{credit-=bytes;};}},
          holdFontEntries:()=>()=>{},
        });
        source.prepareInner(scene,false,()=>{},[]);
        source.rememberPreparedRecords(1n,source.recorded,[]);
        const previous=source.recorded,before=credit,reservations=[];
        const next={...scene,preparation:2n,activePreparation:1n,preparationDocument:2n};
        assert.throws(()=>source.prepareInner(next,false,()=>{throw Error('transport quota');},[]),/transport quota/);
        assert.equal(source.recorded,previous,'Failed grouped credit adopted a new record baseline');
        assert.equal(credit,before,'Failed grouped credit leaked cached records');
        const packet=source.prepareInner(next,false,bytes=>reservations.push(bytes),[]);
        assert.equal(packet.reused.length,count);assert.equal(packet.pictures.length,0);
        assert.equal(reservations.length,1,'Unchanged nodes dispatched individual transport reservations');
        assert(reservations[0]>=count*16,'Reference transport credit omitted entries');
        const pictures=source.counters.pictures,oldRecord=source.recorded.get('1:1');
        const nodes=scene.nodes.map((node,i)=>i?node:{...node,width:21});
        const changed=source.prepareInner({...next,preparation:3n,nodes},false,()=>{},[]);
        assert.equal(source.counters.pictures,pictures+1,'Changed geometry reused an old immutable preparation key');
        assert.notEqual(source.recorded.get('1:1').token,oldRecord.token);assert.equal(changed.reused.length,count-1);
        source.forgetPreparedRecords(1n);source.trimCache();assert.equal(credit,0);
      }
      let reserved=0,fontHolds=0,deleted=0;
      const picture={delete(){++deleted;}},font={resource:{slot:8,generation:1},bytes:new Uint8Array(32),catalog:{faces:[]}};
      const provider=Object.create(CanvasKitProvider.prototype) as any;
      const hold=(entries)=>{fontHolds+=entries.length;let live=true;return()=>{assert(live);live=false;fontHolds-=entries.length;};};
      Object.assign(provider,{
        tables:new Map([[1n,new Map([['1:2',picture]])]]),pathTables:new Map(),
        tableFonts:new Map([[1n,hold([font])]]),preparedRecords:new Map(),
        pictureOwners:new Map([[picture,1]]),typefaces:new Map(),resourceFonts:new Map([['1:8',font]]),
        counters:{livePictures:1,referencedImports:0},holdFontEntries:hold,
        budget:{reserve(_kind,bytes){reserved+=bytes;let live=true;return()=>{assert(live);live=false;reserved-=bytes;};}},
      });
      provider.rememberPreparedRecords(1n,new Map(),[font]);
      const baseline=reserved;
      const packet={preparation:2n,basePreparation:1n,document:2n,metrics:1n,device:1n,
        pictures:[],texts:[],paths:[],reused:['1:2'],fontReferences:[font.resource]};
      for(const malformed of [
        {...packet,basePreparation:99n},
        {...packet,reused:['1:2','1:2']},
        {...packet,fontReferences:[font.resource,font.resource]},
        {...packet,fontReferences:[{slot:9,generation:1}]},
      ]) {
        assert.throws(()=>provider.importInner(malformed),/reference|base/);
        assert.equal(provider.tables.size,1);assert.equal(provider.pictureOwners.get(picture),1);
        assert.equal(fontHolds,1);assert.equal(reserved,baseline);assert.equal(deleted,0);
      }
      provider.importInner(packet);
      assert.equal(provider.tables.get(2n).get('1:2'),picture,'Reuse must retain the exact imported Picture');
      assert.equal(provider.pictureOwners.get(picture),2);assert.equal(fontHolds,2);
      provider.retireExcept(2n);
      assert.equal(provider.pictureOwners.get(picture),1);assert.equal(deleted,0);
      assert.equal(provider.tables.get(2n).get('1:2'),picture);
      provider.retireExcept(-1n);
      assert.equal(deleted,1);assert.equal(fontHolds,0);assert.equal(reserved,0);
      assert.equal(provider.preparedRecords.size,0);
      console.log('Prepared resources: grouped credit at 64/2048 nodes, quota rollback, exact base, Picture/font references, independent readers and retirement PASS.');
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
