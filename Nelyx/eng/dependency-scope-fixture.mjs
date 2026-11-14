// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/** Exercise the current internal index in Node and the pinned VM/native unit. */
export function dependencyScopeFixture() {
  const file = path.resolve(import.meta.dirname, '../src/runtime/dependency-scope.ts'),
    source = fs.readFileSync(file, 'utf8'),
    tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS),
    declaration = tree.statements.find(
      (node) => ts.isClassDeclaration(node) && node.name?.text === 'DependencyScope',
    );
  if (!declaration) throw Error('Current DependencyScope declaration is missing');
  return `
    const dependencyScopeResult=(()=>{
      ${declaration.getText(tree).replace(/^export\s+/, '')}
      const check=(condition,label)=>{if(!condition)throw Error('Dependency scope: '+label);};
      const tokens=Array.from({length:16},()=>({})),values=Array.from({length:64},(_,index)=>({index})),scopes=[];
      let scope;
      for(let index=0;index<64;index++)scopes.push(scope=new DependencyScope(scope,tokens[index%8],values[index]));
      const reference=(scope,token)=>{for(let at=scope;at;at=at.parent)if(at.token===token)return at.value;return undefined;};
      let queries=0;
      for(let round=0;round<24;round++)for(const at of scopes)for(const token of tokens){check(at.get(token)===reference(at,token),'nearest provider/missing result');queries++;}
      for(const at of scopes)check((at.queries?.size??0)<=4&&(at.missing?.size??0)<=4,'table bound');
      const root=new DependencyScope(undefined,tokens[0],values[0]),leaf=new DependencyScope(root,tokens[1],values[1]);
      const misses=tokens.slice(8,11);
      for(const token of misses)check(leaf.get(token)===undefined,'missing provider');
      for(const token of tokens.slice(2,7)){const next=new DependencyScope(leaf,token,{token});check(next.get(token)===next.value,'self provider');leaf.get(token);}
      check(misses.every(token=>leaf.missing.has(token))===false,'negative eviction fixture');
      const positiveTokens=tokens.slice(0,6);let providers;
      for(const token of positiveTokens)providers=new DependencyScope(providers,token,{token});
      const mixed=new DependencyScope(providers,tokens[7],{tag:'leaf'});
      for(const token of misses)mixed.get(token);
      for(let round=0;round<12;round++)for(const token of positiveTokens)check(mixed.get(token)===reference(mixed,token),'positive eviction');
      check(misses.every(token=>mixed.missing.has(token))&&mixed.missing.size===3&&mixed.queries.size===4,'positive queries evicted negative answers');
      const fourth=tokens[11],fifth=tokens[12];mixed.get(fourth);mixed.get(fifth);
      check(mixed.missing.size===4&&!mixed.missing.has(misses[0])&&mixed.get(misses[0])===undefined,'bounded negative eviction');
      const shadow=new DependencyScope(mixed,misses[0],{tag:'new provider'});
      check(shadow.get(misses[0])===shadow.value,'negative ancestor cache hid new provider');
      const moved=new DependencyScope(root,tokens[7],{tag:'different ancestry'});
      check(moved.get(tokens[0])===values[0]&&moved.get(positiveTokens[5])===undefined,'new ancestry inherited old answers');
      values[0].index=99;check(moved.get(tokens[0]).index===99,'cached a provider value snapshot');
      const alias=new DependencyScope(providers,tokens[7],{tag:'sibling'});
      check(alias.get(positiveTokens[0])===mixed.get(positiveTokens[0])&&alias.queries!==mixed.queries,'sibling table ownership');
      return {queries,depth:scopes.length,positiveBound:4,negativeBound:4,rounds:24};
    })();
  `;
}
