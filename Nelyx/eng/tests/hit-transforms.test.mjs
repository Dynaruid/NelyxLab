// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';
import {HitTestResult,HitTestEntry} from '@nelyx/core/framework/gestures/hit-test';
import {captureTransform,multiply,fullTransform,translate,identity,inverse,inversePaintTransform} from '@nelyx/core/ui/geometry';
import {RenderBox,BoxParentData} from '@nelyx/core/framework/rendering/object';
import {matrix4Identity,captureMatrix4,multiplyMatrix4} from '@nelyx/core/ui/matrix4';
import {Offset} from '@nelyx/core/ui/offset';
const timeout=1_200_000,target={handleEvent(){}};
class Builder extends HitTestResult{push(matrix){this.pushTransform(matrix);}offset(value){this.pushOffset(value);}pop(){this.popTransform();}}

test('owned box translations reuse paint inverses and reread offsets and virtual mutable transforms',{timeout},()=>{
  class Box extends RenderBox{get childMatrix(){return this.current??identity;}get localTransform(){return this.childMatrix;}matrix(child){return this.childTransform(child);}}
  class MutableData extends BoxParentData{value={x:0,y:0};get offset(){return this.value;}set offset(value){this.value=value;}}
  const parent=new Box(),child=new Box();child.parentData=new MutableData();
  const first=parent.matrix(child),firstInverse=inversePaintTransform(first);assert(Object.isFrozen(first));assert.equal(parent.matrix(child),first);assert.equal(inversePaintTransform(first),firstInverse);assert.deepEqual(firstInverse,inverse(first));
  child.parentData.offset={x:13,y:-17};const moved=parent.matrix(child);assert.notEqual(moved,first);assert.deepEqual(moved,multiply(translate(13,-17),identity));assert.equal(parent.matrix(child),moved);
  child.parentData.offset.x=29;assert.equal(parent.matrix(child)[4],29);assert.equal(moved[4],13);
  child.current=[1,0,0,1,3,4];assert.equal(parent.matrix(child)[4],32);child.current[4]=8;assert.equal(parent.matrix(child)[4],37);
  for(const matrix of [[1,-0,0,1,-0,0],[0,0,0,0,0,0],[1e-309,0,0,1,0,0]]){const owned=captureTransform(matrix);assert.deepEqual(inversePaintTransform(owned),inverse(matrix));}
  const external=[1,0,0,1,5,6];assert.equal(inversePaintTransform(external)[4],-5);external[4]=18;assert.equal(inversePaintTransform(external)[4],-18);
  const a=captureTransform([1,-0,.3,2,13,-17]),b=captureTransform([2,.1,-.4,3,0,0]),product=multiply(a,b);assert.equal(multiply(a,b),product);assert(Object.isFrozen(product));assert.deepEqual(product,multiply([...a],[...b]));
  const changing=[...b];multiply(a,changing);changing[4]=31;assert.deepEqual(multiply(a,changing),multiply([...a],[...changing]));
  const huge=captureTransform([1e308,0,0,1,0,0]),twice=captureTransform([2,0,0,1,0,0]);assert.equal(multiply(huge,twice)[0],Infinity);
});

test('captured transforms retain owned immutable storage while external and arithmetic arrays remain independent',{timeout},()=>{
  for(const external of [[1,-0,0,1,13,-17],new Float64Array(matrix4Identity),Object.freeze([...matrix4Identity])]){
    const captured=captureTransform(external);assert.notEqual(captured,external);assert(Object.isFrozen(captured));assert.equal(captureTransform(captured),captured);
    if(captured.length===16)assert.equal(captureMatrix4(captured),captured);
    else{assert.equal(fullTransform(captured),fullTransform(captured));assert(Object.is(fullTransform(captured)[1],-0));}
    if(!Object.isFrozen(external)){external[0]=8;assert.equal(captured[0],1);assert.equal(captureTransform(external)[0],8);}
  }
  assert.equal(captureTransform(identity),identity);assert.equal(captureMatrix4(matrix4Identity),matrix4Identity);
  const product=multiplyMatrix4(matrix4Identity,matrix4Identity);assert.equal(captureTransform(product),product);
  for(const value of [translate(2,3),multiply(identity,[1,0,0,1,2,3])]){const captured=captureTransform(value),expanded=fullTransform(value);value[4]=41;assert.equal(captured[4],2);assert.equal(expanded[12],2);assert.equal(fullTransform(value)[12],41);assert.equal(captureTransform(value)[4],41);}
});

test('matrix admission checks actual iterable storage and rejects malformed or nonfinite captured values',{timeout},()=>{
  for(const length of [6,16])for(const count of [length-1,length+1]){const input={length,*[Symbol.iterator](){yield* Array(count).fill(1);}};assert.throws(()=>captureTransform(input),/six|sixteen/);if(length===16)assert.throws(()=>captureMatrix4(input),/sixteen/);}
  for(const length of [6,16]){const matrix=Array(length).fill(0);matrix[0]=NaN;assert.throws(()=>captureTransform(Object.freeze(matrix)),/finite/);}
});
test('root hit entries retain the exact full matrix product, signed-zero normalization and captured caller values',{timeout},()=>{
  const matrices=[[1,0,0,1,0,0],[-0,-0,0,-0,-0,0],[.75,-.3,.2,-2,400,-50],[1e-120,1e120,-1e120,1e-120,-1e100,1e100],
    [...matrix4Identity],[1,-0,5e-11,.01,0,-1,0,-.02,0,0,1,0,-0,50,0,2],[-0,-0,-0,-0,-0,-0,-0,-0,-0,-0,1,-0,-0,-0,-0,-0]];
  const result=new Builder();for(const input of matrices){const expected=multiply(captureTransform(input),matrix4Identity);result.push(input);input[0]=7;const entry=new HitTestEntry(target);result.add(entry);assert.equal(entry.transform.length,16);assert.deepEqual(entry.transform,expected);assert(Object.isFrozen(entry.transform));result.pop();}
  const root=new HitTestEntry(target);result.add(root);assert.equal(root.transform,matrix4Identity);assert.throws(()=>result.add(root),/only be added once/);
});
test('nested matrix/offset parts, wrapped results and later sibling entries preserve independent accumulated transforms',{timeout},()=>{
  const result=new Builder(),wrapped=new Builder(result),first=[1,0,0,1,20,-10],second=[2,.1,-.4,3,0,0];let expected=matrix4Identity;
  result.push(first);expected=multiply(captureTransform(first),expected);wrapped.offset(new Offset(-3,4));expected=multiply([1,0,0,1,-3,4],expected);wrapped.push(second);expected=multiply(captureTransform(second),expected);
  const nested=new HitTestEntry(target);wrapped.add(nested);assert.deepEqual(nested.transform,expected);wrapped.pop();result.pop();
  const sibling=new HitTestEntry(target);result.add(sibling);assert.deepEqual(sibling.transform,multiply(captureTransform(first),matrix4Identity));assert.deepEqual(nested.transform,expected);result.pop();
  assert.deepEqual(result.path,[nested,sibling]);assert(Object.isFrozen(result.path));assert.throws(()=>result.pop(),/base hit-test/);
  const outside=[...matrix4Identity];outside[2]=1;assert.throws(()=>result.push(outside),/isolated XY plane/);assert.throws(()=>result.push([1,0,0,1,NaN,0]),/finite/);
});
test('unconsumed root hit paths defer full matrix storage while nested consumers share the captured result',{timeout},()=>{
  const result=new Builder(),matrix=[1,0,0,1,13,17],freeze=Object.freeze;let matrices=0;
  Object.freeze=value=>{if(Array.isArray(value)&&value.length===16)matrices++;return freeze(value);};
  try{result.push(matrix);const first=new HitTestEntry(target),second=new HitTestEntry(target);result.add(first);result.add(second);assert.equal(matrices,0,'Unused no-op hit targets must not allocate full identity products');matrix[4]=100;
    const initial=first.transform;assert.equal(matrices,1);assert.equal(second.transform,initial);assert.equal(first.transform,initial);assert.equal(initial[12],13);
    result.push([2,0,0,2,0,0]);const nested=new HitTestEntry(target);result.add(nested);assert.deepEqual(nested.transform,multiply(captureTransform([2,0,0,2,0,0]),initial));result.pop();result.pop();assert.equal(second.transform,initial);assert.equal(initial[13],17);
  }finally{Object.freeze=freeze;}
});
test('a deferred first entry preserves immediate nested overflow failure and the caller pop protocol',{timeout},()=>{
  const result=new Builder(),first=new HitTestEntry(target);result.push([1e308,0,0,1,0,0]);result.add(first);result.push([2,0,0,1,0,0]);assert.throws(()=>result.add(new HitTestEntry(target)),/finite/);result.pop();result.pop();
  const root=new HitTestEntry(target);result.add(root);assert.equal(root.transform,matrix4Identity);assert.equal(first.transform[0],1e308);assert.deepEqual(result.path,[first,root]);
});
