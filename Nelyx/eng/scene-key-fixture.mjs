// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/** Exercise the current private function without exporting a production API. */
export function sceneKeyFixture() {
  const file = path.resolve(import.meta.dirname, '../runtime/engine-client/scene.ts'),
    source = fs.readFileSync(file, 'utf8'),
    tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS),
    identity = tree.statements.find(
      (node) => ts.isFunctionDeclaration(node) && node.name?.text === 'id',
    );
  if (!identity) throw Error('Current Scene registry identity function is missing');
  return `
    const sceneKeyResult=(()=>{
      ${identity.getText(tree)}
      const check=(condition,label)=>{if(!condition)throw Error('Scene keys: '+label);};
      const handles=[[0,0],[1,1],[1,2],[0xffffffff,1],[1,0x1fffff],[0xffffffff,0x1fffff],[0,0x200000],[1,0x200000],[0xffffffff,0x200000],[0xffffffff,0xffffffff]];
      const keys=new Set();
      for(const [slot,generation]of handles){const key=id({slot,generation});check(key===id({slot,generation}),'same full handle');keys.add(key);}
      check(keys.size===handles.length,'distinct generations/slots collided at uint32 and safe-integer boundaries');
      check(id({slot:0xffffffff,generation:0x1fffff})===Number.MAX_SAFE_INTEGER,'last exact integer');
      check(id({slot:1,generation:0})===id({slot:1,generation:-0}),'signed-zero generation identity');
      const sentinel={keyGetter:true},reference=h=>\`\${h.slot}:\${h.generation}\`;
      const factories=[
        log=>({get slot(){log.push('slot');return 3;},get generation(){log.push('generation');return 4;}}),
        log=>({get slot(){log.push('slot');return {toString(){log.push('slot-string');return '3';}};},get generation(){log.push('generation');return 4;}}),
        log=>({get slot(){log.push('slot');return Symbol('slot');},get generation(){log.push('generation');throw sentinel;}}),
        log=>({get slot(){log.push('slot');throw sentinel;},get generation(){log.push('generation');return 4;}}),
        log=>({get slot(){log.push('slot');return 3;},get generation(){log.push('generation');throw sentinel;}}),
        log=>({get slot(){log.push('slot');return 3;},get generation(){log.push('generation');return {toString(){log.push('generation-string');return '4';}};}}),
        log=>({get slot(){log.push('slot');return NaN;},get generation(){log.push('generation');return 4;}}),
      ];
      const outcome=(encode,factory)=>{const log=[];let value,error;try{value=encode(factory(log));}catch(e){error=e===sentinel?'sentinel':e.constructor.name;}return {log,value,error};};
      for(const factory of factories){const before=outcome(reference,factory),after=outcome(id,factory);check(JSON.stringify(before.log)===JSON.stringify(after.log)&&before.error===after.error,'getter/conversion/exception order');if(typeof after.value==='string')check(after.value===before.value,'fallback pair');}
      return {cases:handles.length+factories.length,distinct:keys.size,ordinaryType:typeof id({slot:1,generation:1})};
    })();
  `;
}
