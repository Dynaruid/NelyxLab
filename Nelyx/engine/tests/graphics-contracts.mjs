// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {commands as c,protocol as p,body} from '../../runtime/engine-client/index.ts';
export function graphicsContracts({using,timeout,h}) {
  for(const profile of ['native','single-worker','threaded']){
    test(`${profile}: affine snapshots, rounded/path clips and singular transforms share hit geometry`,{timeout},()=>using(profile,async f=>{
      await f.start([
        c.create(h(1),'scrollViewport'),c.properties(h(1),{x:10,y:10,width:100,height:100,maximum:1000}),c.paint(h(1),0,20),
        c.graphics(h(1),{transform:[0,1,-1,0,100,0]}),
        c.create(h(2),'clip'),c.properties(h(2),{width:100,height:100}),c.attach(h(2),h(1)),
        c.graphics(h(2),{path:[['move',0,0],['line',100,0],['line',0,100],['close']]}),
        c.create(h(3),'box'),c.properties(h(3),{width:100,height:100}),c.attach(h(3),h(2)),
      ]);
      const before=await f.inspect();
      await f.input('update',0,{source:'wheelUnknown',target:h(0,0),x:100,y:20,dx:-10});await f.tick();
      assert.equal((await f.inspect()).nodes[0].offset,10,'A view-space delta is unprojected into the rotated scroll axis');
      await f.present();
      await f.input('update',40,{source:'wheelUnknown',target:h(0,0),x:109,y:11});await f.tick();
      assert.equal((await f.inspect()).nodes[0].offset,10,'Rounded corner is outside input coverage');
      await f.commit([c.graphics(h(1),{transform:[0,0,0,0,100,0]})]);await f.ready();const frame=await f.present();
      assert.equal(frame.nodes[0].bounds.width,0);assert.equal(frame.nodes[0].bounds.height,0);
      await f.input('update',50,{source:'wheelUnknown',target:h(0,0),x:100,y:20});await f.tick();
      assert.equal((await f.inspect()).nodes[0].offset,10);
      assert.ok((await f.inspect()).transactionWork>before.transactionWork);
    }));
    test(`${profile}: path winding and staged graphics failure preserve the accepted document`,{timeout},()=>using(profile,async f=>{
      await f.start([c.create(h(1),'path'),c.properties(h(1),{width:100,height:100}),
        c.graphics(h(1),{path:[['move',0,0],['line',100,0],['line',0,100],['close']]}),
        c.control(h(1),{kind:'toggle'}),c.gesture(h(1),p.gestures.tap)]);
      for(const point of [[80,80],[20,20]]){
        await f.input('begin',0,{pointer:true,target:h(0,0),x:point[0],y:point[1]});await f.tick();
        await f.input('end',0,{pointer:true,target:h(0,0),x:point[0],y:point[1]});await f.tick();
      }
      assert.equal((await f.inspect()).nodes[0].control.value,1,'Only the filled triangle activates the native control');
      const before=await f.inspect();const failed=await f.commit([c.paint(h(1),0xffabcdef),c.graphics(h(1),{path:[['line',10,10]]})]);
      assert.equal(failed.status,p.statuses.invalidValue);assert.equal((await f.inspect()).document,before.document);
    }));
    test(`${profile}: one memory ceiling covers engine heap, both providers, GPU and staging atomically`,{timeout},()=>using(profile,async f=>{
      await f.start();const global={session:1,app:1,view:0,generation:0};
      const report=(owner,kind,bytes)=>f.send(p.opcodes.memoryReport,body(16,v=>{v.setUint32(0,owner,true);v.setUint32(4,kind,true);v.setBigUint64(8,BigInt(bytes),true);}),{owner:global});
      const mib=1024*1024;
      await report(0,0,32*mib);await report(1,1,64*mib);await report(2,1,64*mib);await report(1,2,48*mib);await report(2,3,100*mib);
      const before=await f.inspect();assert.equal(before.memory.total,308n*BigInt(mib));
      assert.equal((await report(1,4,100*mib)).status,p.statuses.budgetExceeded);
      const after=await f.inspect();assert.equal(after.memory.total,before.memory.total);assert.equal(after.memory.rejected,before.memory.rejected+1n);
      assert.ok(after.memory.peak<=after.memory.limit);
      for(const [owner,kind]of [[0,0],[1,1],[2,1],[1,2],[2,3]])await report(owner,kind,0);
      assert.equal((await f.inspect()).memory.total,(await f.inspect()).reservedBytes);
    }));
  }
}
