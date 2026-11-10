// SPDX-License-Identifier: BSD-3-Clause
import { build } from 'esbuild';
const watchdog = setTimeout(() => {
  throw Error('Render clip checks exceeded 20 minutes');
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
      const identity=[1,0,0,1,0,0],visible={x:0,y:0,width:100,height:100},empty={...visible,width:0};
      const node=(slot,depth,clip)=>({node:{slot,generation:1},depth,clip,matrix:identity,
        width:100,height:100,opacity:1,localOpacity:1,kind:p.kinds.box,flags:0});
      const draws={live:[],record:[]},foregrounds={live:[],record:[]},depths={live:0,record:0},shadows={live:0,record:0};
      const canvas=name=>({name,clear(){},scale(){},concat(){},drawImageRectOptions(){},clipPath(){},drawShadow(){++shadows[name];},
        save(){++depths[name];},restore(){assert(depths[name]>0);--depths[name];}});
      const live=canvas('live'),record=canvas('record'),provider=Object.create(CanvasKitProvider.prototype) as any;
      const decision={action:1,token:1n,ratio:1,pixelWidth:100,pixelHeight:100,background:0,
        matrix:identity,opacity:1,sourceRectWidth:100,sourceRectHeight:100,destinationWidth:100,destinationHeight:100};
      Object.assign(provider,{tables:new Map([[1n,new Map()]]),pathTables:new Map(),snapshots:new Map(),
        counters:{draws:0,clipCulledNodes:0},surface:{getCanvas:()=>live,flush(){}},resize(){},pruneSnapshots(){},
        snapshotAccess:(_submission,phase)=>phase?decision:{},
        captureSnapshot(_submission,_node,_decision,draw){draw(record);provider.snapshots.set(1n,{image:{}});},
        drawItem(target,_table,_nodes,item){draws[target.name].push(item.node.slot);},
        drawPaint(target,_table,_nodes,item,_scale,foreground){if(foreground)foregrounds[target.name].push(item.node.slot);},
        ck:{Color(){},computeTonalColors:()=>({ambient:[],spot:[]}),ClipOp:{Intersect:1},XYWHRect:()=>new Float32Array(4),Paint:class {setAlphaf(){}delete(){}},FilterMode:{Linear:1},MipmapMode:{Linear:1}},
      });
      const frame={activePreparation:1n,submission:1n,nodes:[node(1,0,visible),node(2,1,empty),node(3,2,empty),node(4,1,visible)]};
      provider.drawInner(frame,100,100,1);
      assert.deepEqual(draws.live,[1,4],'The empty live paint clip still entered descendant CanvasKit drawing');
      assert.equal(provider.counters.clipCulledNodes,2);
      assert.deepEqual(foregrounds.live,[4,1],'Culling changed the visible sibling/ancestor foreground order');
      assert.deepEqual(depths,{live:0,record:0});
      draws.live.length=0;
      provider.pathTables.set(1n,new Map([['1:2',{}]]));
      const physical={...frame.nodes[1],flags:p.nodeFlags.clipsChildren,
        nativePaint:[{kind:'physical',elevation:8,shadowColor:0xff000000,color:0xffffffff}]};
      provider.drawInner({...frame,nodes:[frame.nodes[0],physical,...frame.nodes.slice(2)]},100,100,1);
      assert.equal(shadows.live,1,'A physical shadow painted before its own clip disappeared at the viewport edge');
      assert.deepEqual(draws.live,[1,2,4]);assert.deepEqual(depths,{live:0,record:0});
      draws.live.length=0;
      provider.drawInner({...frame,nodes:[{...frame.nodes[0],snapshot:{}},...frame.nodes.slice(1)]},100,100,1);
      assert.deepEqual(draws.live,[1]);
      assert.deepEqual(draws.record,[2,3,4],'Live viewport clipping discarded content needed by a later Snapshot replay');
      assert.deepEqual(depths,{live:0,record:0});
      console.log('Render clips: empty live subtree skipped, visible sibling/foreground and edge shadow preserved, off-viewport Snapshot recording and balanced canvas state PASS.');
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
