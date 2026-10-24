// SPDX-License-Identifier: BSD-3-Clause
import ts from 'typescript';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {buildSourceGraph} from './source-graph.mjs';
import {lowerSourcePartition} from './partition.mjs';
const hash = value => createHash('sha256').update(value).digest('hex');
export function verifyTypePolicy(policy){
  const {sha256,...body}=policy;
  if(policy.schema!=='nelyx.static-aot-type-policy/v1'||policy.id!=='guarded-closed-scalar-v2'||sha256!==hash(JSON.stringify(body))||policy.decisions.some(decision=>!['specialize','dynamic-js-with-reason'].includes(decision.decision)||!decision.reason||decision.decision==='specialize'&&!decision.evidence))throw Error('Automatic type policy evidence differs');
  if(policy.summary.callables!==policy.decisions.length||policy.summary.specialize!==policy.decisions.filter(decision=>decision.decision==='specialize').length||policy.summary.dynamic!==policy.decisions.filter(decision=>decision.decision==='dynamic-js-with-reason').length)throw Error('Automatic type policy counts differ');
  return policy;
}

/** Specialize only explicit scalar contracts that the checked lowering admits.
 * Rejected candidates remain in their original Metro module, with a reason.
 * No function/package names select product optimizations. */
export function automaticPartition(options) {
  const frontend = buildSourceGraph(options), {graph, program, checker, owners} = frontend;
  const decisions = [], selections = [];
  const runtimeFiles=options.runtimeFiles?new Set(options.runtimeFiles.map(file=>path.resolve(file).toLowerCase())):null;
  for (const module of graph.modules) {
    if (!module.evaluationRoutes.length) continue; // Checker-only dependency.
    const owner = owners.find(owner => owner.name === module.owner);
    const file = path.join(owner.root, module.id.slice(module.owner.length + 1));
    if(runtimeFiles&&!runtimeFiles.has(path.resolve(file).toLowerCase()))continue;
    const source = program.getSourceFile(file);
    if (!source) throw Error('Type policy source unavailable: ' + module.id);
    const visit = node => {
      if (ts.isFunctionLike(node) && node.body) {
        const offset = node.getStart(source), at = source.getLineAndCharacterOfPosition(offset);
        const topFunction = ts.isFunctionDeclaration(node) && node.parent === source && node.name;
        const topMethod = ts.isMethodDeclaration(node) && ts.isClassDeclaration(node.parent) && node.parent.parent === source && node.parent.name && ts.isIdentifier(node.name);
        const selection = topFunction ? {module: module.id, name: node.name.text} : topMethod ? {module: module.id, className: node.parent.name.text, name: node.name.text} : null;
        let reason = 'dynamic-callable-shape';
        let evidence = null;
        if (selection) {
          reason = 'explicit-scalar-contract-required';
          // Inferred or any-valued public parameters do not authorize a typed ABI.
          if (node.type?.kind === ts.SyntaxKind.NumberKeyword && node.parameters.every(parameter => [ts.SyntaxKind.NumberKeyword, ts.SyntaxKind.BooleanKeyword].includes(parameter.type?.kind))) {
            evidence = {returnAnnotation: node.type.getText(source), parameters: node.parameters.map(parameter => ({name: parameter.name.getText(source), annotation: parameter.type.getText(source), checkerType: checker.typeToString(checker.getTypeAtLocation(parameter))}))};
            try {
              const candidate=lowerSourcePartition(frontend, [selection]);
              // An annotation does not prove a property/getter/callback result.
              // Keep those observations in the dynamic native module. Scalar
              // entry values are guarded before the original body does work.
              const unsafe=value=>value&&typeof value==='object'&&(Object.hasOwn(value,'kind')&&['receiver','external','property','call','new'].includes(value.kind)||Object.values(value).some(child=>Array.isArray(child)?child.some(unsafe):unsafe(child)));
              if(unsafe(candidate.ir.functions[0].body))throw Object.assign(Error('static-aot: dynamic observations require their original JS representation'),{code:'NELYX_TYPED_UNSUPPORTED'});
              if (selections.length >= 4096) reason = 'specialization-code-size-bound';
              else {selections.push(selection); reason = 'checked-scalar-ir';}
            } catch (error) {
              if (error.code !== 'NELYX_TYPED_UNSUPPORTED') throw error;
              reason = 'dynamic-ir-eligibility: ' + error.message.slice(error.message.indexOf('static-aot: ') + 12);
            }
          }
        }
        decisions.push({module: module.id, sourceSha256: module.sourceSha256, offset, end: node.end, line: at.line + 1, column: at.character + 1,
          name: node.name?.getText(source) ?? '<closure>', selection, decision: reason === 'checked-scalar-ir' ? 'specialize' : 'dynamic-js-with-reason', reason, evidence});
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  const partition = lowerSourcePartition(frontend, selections);
  partition.bindings=partition.bindings.map((binding,index)=>({...binding,guard:partition.ir.functions[index].parameters.map(parameter=>'typeof '+parameter.originalName+'==='+JSON.stringify(parameter.type)).join('&&')||'true'}));
  const policy = {schema: 'nelyx.static-aot-type-policy/v1', id: 'guarded-closed-scalar-v2', graphSha256: graph.sha256, checkerSha256: graph.checkerSha256,
    sourceModules: [...new Set(decisions.map(decision=>decision.module))].map(id=>({id,sourceSha256:graph.modules.find(module=>module.id===id).sourceSha256})), decisions,
    summary: {callables: decisions.length, specialize: selections.length, dynamic: decisions.length - selections.length}};
  return {...partition, typePolicy: {...policy, sha256: hash(JSON.stringify(policy))}};
}
