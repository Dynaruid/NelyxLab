// SPDX-License-Identifier: BSD-3-Clause
import { build } from 'esbuild';
const watchdog = setTimeout(() => {
  throw Error('Live paint reuse checks exceeded 20 minutes');
}, 1200000);
try {
  const result = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: 'ts',
      contents: `
      import assert from 'node:assert/strict';import path from 'node:path';import {pathToFileURL} from 'node:url';
      import {CanvasKitProvider} from './Nelyx/engine/render/canvaskit-web/provider.ts';
      import {EngineClient} from './Nelyx/runtime/engine-client/client.ts';
      import {createWasmTransport} from './Nelyx/runtime/engine-client/wasm.ts';
      import {protocol as p,commands as c,body} from './Nelyx/runtime/engine-client/codec.ts';
      const factory=(await import(pathToFileURL(path.resolve('Nelyx/engine/dist/single-worker/engine.mjs')).href)).default;
      const client=await EngineClient.connect(createWasmTransport(await factory()));
      try {
        const view=await client.openView(1),node={slot:1,generation:1};let clock=0;
        await view.request(p.opcodes.metrics,body(40,v=>{v.setBigUint64(0,2n,true);v.setFloat64(8,100,true);v.setFloat64(16,100,true);v.setFloat64(24,1,true);}));
        const paint=color=>c.nativePaint(node,[{kind:'shape',color,shape:{kind:'rrect',radii:Array(8).fill(0),strokeWidth:0,strokeColor:0,strokeAlign:0}}]);
        await view.commit([c.create(node,'box'),c.properties(node,{width:20,height:20}),paint(0xff123456)]);
        const activate=async()=>{for(let i=0;i<20;++i){const s=await view.request(p.opcodes.contentStep,body(8,v=>v.setUint32(0,p.limits.contentPerStep,true)));if(s.preparationReady)break;}await view.request(p.opcodes.tick,body(8,v=>v.setFloat64(0,++clock,true)));};
        await activate();const first=await view.layoutSnapshot();
        await view.commit([paint(0xff654321)]);await activate();const changed=await view.layoutSnapshot();
        const colors=[],canvas=new Proxy({getSaveCount:()=>1},{get:(target,key)=>target[key]??(()=>{})}),provider=Object.create(CanvasKitProvider.prototype) as any;
        let credit=0;
        Object.assign(provider,{recorded:new Map(),preparedRecords:new Map(),measurePreparation:0n,
          measuredParagraphs:new Map(),paragraphCollections:new Map(),regularTypefaces:new Map(),nextRecordToken:0,
          pictureOwners:new Map(),resourceFonts:new Map(),holdFontEntries:()=>()=>{},
          budget:{reserve(_kind,bytes){credit+=bytes;return()=>{credit-=bytes;};}},
          counters:new Proxy({},{get:(target,key)=>target[key]??0,set:(target,key,value)=>{target[key]=value;return true;}}),
          ck:{PictureRecorder:class {beginRecording(){return canvas;}finishRecordingAsPicture(){return {serialize:()=>new Uint8Array([1,2,3]),delete(){}};}delete(){}}
            ,Paint:class {constructor(){return new Proxy({setColor(value){colors.push([...value]);}},{get:(target,key)=>target[key]??(()=>{})});}},
            XYWHRect:(...values)=>new Float32Array(values),Color:(...values)=>new Float32Array(values),PaintStyle:{Fill:0,Stroke:1},BlendMode:{SrcOver:0},ClipOp:{Intersect:0}},
        });
        let preparation=0n;
        const scene=(source,live)=>({...source,preparation:++preparation,activePreparation:0n,preparationDocument:source.document,
          nodes:source.nodes.map(node=>({...node,flags:(node.flags&~p.nodeFlags.livePaint)|(live?p.nodeFlags.livePaint:0)}))});
        provider.prepareInner(scene(first,false),false,()=>{},[]);const pictures=provider.counters.pictures;
        provider.prepareInner(scene(first,false),false,()=>{},[]);assert.equal(provider.counters.pictures,pictures);
        provider.prepareInner(scene(changed,false),false,()=>{},[]);
        assert.equal(provider.counters.pictures,pictures+1,'Changed static paint reused a stale Picture');assert.equal(colors.at(-1)[0],0x65);
        provider.prepareInner(scene(changed,true),false,()=>{},[]);const livePictures=provider.counters.pictures,live=scene(first,true);
        provider.prepareInner(live,false,()=>{},[]);assert.equal(provider.counters.pictures,livePictures,'Live-only values rebuilt the separately recorded base Picture');
        provider.drawPaint(canvas,new Map(),new Map(),live.nodes[0],1,false);assert.equal(colors.at(-1)[0],0x12,'Reused base Picture suppressed the current live paint');
        provider.trimCache();assert.equal(credit,0);
        console.log('Live paint reuse: static changes rebuild the Picture, live-only changes reuse its base and draw the current value; cache credit drains to zero PASS.');
      }finally{await client.close();}
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
  console.error(error.message);
  process.exitCode = 1;
} finally {
  clearTimeout(watchdog);
}
