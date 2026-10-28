// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';
import {resizeStatistics,resizeDistribution} from './windows-resize-statistics.mjs';
const timeout=1_200_000;
test('resize counts consecutive rect changes including A-B-A and excludes repeated notifications',{timeout},()=>{
  const row=(t,w,id=0)=>[t,0,0,w,100,id],rows=[row(10,100),row(20,100),row(30,120),row(40,100)];
  const result=resizeStatistics({began:0,ended:100,injected:[],processed:[],geometry:rows,captureEnabled:false},[]);
  assert.equal(result.geometry.changes,3);assert.equal(result.geometry.fps,30);assert.equal(result.geometry.intervalMs.max,60);assert.equal(result.displayed,null);
});
test('input latency requires both native input identity and matching proposed/actual rect',{timeout},()=>{
  const row=(t,w,id)=>[t,0,0,w,100,id];
  const result=resizeStatistics({began:0,ended:100,injected:[row(5,100,1),row(25,120,2)],processed:[row(10,100,1),row(30,120,1)],geometry:[row(20,100,0),row(40,120,0)],captureEnabled:false},[]);
  assert.deepEqual(result.inputToGeometryMs,{n:1,p50:15,p95:15,max:15});
});
test('vertical resize and movement count while the resting seed and duplicate rects do not',{timeout},()=>{
  const rows=[[0,0,0,100,100,0],[20,0,0,100,110,0],[30,0,0,100,110,0],[50,0,-5,100,110,0],[80,0,0,100,100,0]];
  const result=resizeStatistics({began:0,ended:100,injected:[],processed:[],geometry:rows,displayed:rows,captureEnabled:true},[]);
  assert.equal(result.geometry.changes,3);assert.equal(result.geometry.fps,30);assert.equal(result.geometry.intervalMs.max,30);assert.deepEqual(result.displayed,result.geometry);
});
test('native timing pairs do not combine different views or transaction generations',{timeout},()=>{
  const e=(stage,surfaceGeneration,view,nativeTimestamp)=>({stage,surfaceGeneration,view,nativeTimestamp});
  const result=resizeStatistics({began:0,ended:100,injected:[],processed:[],geometry:[]},[e(14,1,0,10),e(15,2,0,11),e(15,1,3,12),e(15,1,0,15)]);
  assert.deepEqual(result.stagesMs.arrange,{n:1,p50:5,p95:5,max:5});assert.deepEqual(resizeDistribution([]),{n:0,p50:null,p95:null,max:null});
});
