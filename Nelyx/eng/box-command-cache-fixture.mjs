// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/** Use the current private implementation in Node, HBC and native-unit probes. */
export function boxCommandCacheFixture() {
  const file = path.resolve(import.meta.dirname, '../runtime/engine-client/scene.ts'),
    source = fs.readFileSync(file, 'utf8'),
    tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS),
    names = new Set([
      'simpleBoxLayouts',
      'simpleBoxLayoutIndices',
      'simpleBoxLayoutCommands',
      'boxConstraintAxis',
      'BoxCommandCache',
    ]),
    declarations = tree.statements.filter((node) => {
      if (ts.isClassDeclaration(node) || ts.isFunctionDeclaration(node))
        return node.name && names.delete(node.name.text);
      return (
        ts.isVariableStatement(node) &&
        node.declarationList.declarations.some(
          (entry) => ts.isIdentifier(entry.name) && names.delete(entry.name.text),
        )
      );
    });
  if (names.size) throw Error('Box command cache declarations missing: ' + [...names].join(','));
  return `
    const boxCommandCacheResult=(()=>{
      const c=layoutCommands,unboundHandle={slot:0,generation:0};
      ${declarations.map((node) => node.getText(tree)).join('\n')}
      const check=(condition,label)=>{if(!condition)throw Error('Box command cache: '+label);};
      const equal=(a,b)=>a.length===b.length&&a.every((byte,index)=>byte===b[index]);
      const cache=new BoxCommandCache(),counts={partEncodes:0,partReuses:0};
      const cases=[[0,20,0,30],[-0,20,0,30],[0,Infinity,0,Infinity],[Infinity,Infinity,Infinity,Infinity],[2,9,3,11],[0,0,0,0],[1,1,2,2],[0,1e12,0,1e12]];
      for(const values of cases){
        const actual=cache.constraints(...values,counts),reference=c.constraints(unboundHandle,boxConstraintAxis(values[0],values[1]),boxConstraintAxis(values[2],values[3]));
        check(equal(actual,reference),'constraints wire');
        check(cache.constraints(...values,counts)===actual,'numeric body was rebuilt');
      }
      check(cache.constraintEntries.length===8,'constraint bound');
      const first=cache.constraintEntries[0].bytes,zero=cache.constraintEntries[1].bytes;
      check(first!==zero&&!equal(first,zero),'signed zero aliased');
      cache.constraints(0,123,0,456,counts);
      check(cache.constraintEntries.length===8&&cache.constraints(...cases[0],counts)!==first,'constraint eviction');
      check(equal(first,c.constraints(unboundHandle,boxConstraintAxis(0,20),boxConstraintAxis(0,30))),'eviction changed an older live body');
      const outcome=callback=>{try{return {bytes:Array.from(callback())};}catch(error){return {error:error.constructor.name,message:error.message};}};
      for(const values of [[NaN,20,0,30],[0,'20',0,30]]){
        check(JSON.stringify(outcome(()=>cache.constraints(...values,counts)))===JSON.stringify(outcome(()=>c.constraints(unboundHandle,boxConstraintAxis(values[0],values[1]),boxConstraintAxis(values[2],values[3])))),'ordinary codec rejection');
        check(cache.constraintEntries.length===8,'failed encode changed cache size');
      }
      for(const layout of simpleBoxLayouts){
        const actual=cache.layout(layout,counts);
        check(equal(actual,c.layout(unboundHandle,layout)),'fixed layout wire');
        check(cache.layout(layout,counts)===actual,'fixed layout was rebuilt');
      }
      let reads=0;const dynamic={get gap(){++reads;return 2;}};
      const before=cache.layout(dynamic,counts),after=cache.layout(dynamic,counts);
      check(before!==after&&equal(before,after)&&reads===2,'arbitrary layout getter was cached');
      const policyCache=new BoxCommandCache();
      for(let value=0;value<9;++value){const actual=policyCache.policy(value,counts);check(equal(actual,c.eventPolicy(unboundHandle,value)),'policy wire');check(policyCache.policy(value,counts)===actual,'policy was rebuilt');}
      check(policyCache.policies.size===8,'policy bound');
      const scalarCases=[[1,0,0,0,0],[1,-0,-0,-0,-0],[1,4,4,4,4],[2,0,0,-1,-1],[2,.2,-.4,2,.5]];
      const scalarCache=new BoxCommandCache();
      for(const values of scalarCases){
        const actual=scalarCache.scalarLayout(...values,counts),reference=c.layout(unboundHandle,values[0]===1?{childConstraints:'inherit',padding:{left:values[1],top:values[2],right:values[3],bottom:values[4]}}:{alignment:{x:values[1],y:values[2]},alignmentSizing:true,widthFactor:values[3],heightFactor:values[4]});
        check(equal(actual,reference),'scalar layout wire');
        check(scalarCache.scalarLayout(...values,counts)===actual,'scalar layout was rebuilt');
      }
      const retained=scalarCache.scalarLayout(1,0,0,0,0,counts);
      for(let left=10;left<19;++left)scalarCache.scalarLayout(1,left,0,0,0,counts);
      check(scalarCache.scalarLayouts.length===8&&scalarCache.scalarLayout(1,0,0,0,0,counts)!==retained,'scalar layout bound/eviction');
      check(equal(retained,c.layout(unboundHandle,{childConstraints:'inherit',padding:{left:0,top:0,right:0,bottom:0}})),'scalar eviction changed an older body');
      return {constraintCases:cases.length,layoutCases:simpleBoxLayouts.length,scalarCases:scalarCases.length,policies:9,mutableReads:reads,bound:8};
    })();
  `;
}
