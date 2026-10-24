// SPDX-License-Identifier: BSD-3-Clause
// Pinned Hermes 94aa5e1d: SimplifyCFG corrupts branch-specific loop phis.
// Keep the producer's registered optimization order while omitting that pass
// and the internal-only LowerBuiltinCallsOptimized pass. Inlining remains off.
const noCfgPasses=Object.freeze([
  'lowergeneratorfunction','instsimplify','staticrequire','dce',
  'simplestackpromotion','frameloadstoreopts','simplemem2reg',
  'simplestackpromotion','scopeelimination','functionanalysis','inlining','dce',
  'objectmergenewstores','objectstackpromotion','typeinference',
  'simplestackpromotion','instsimplify','dce','simplemem2reg','functionanalysis',
  'metrorequire','inlining','dce','simplestackpromotion','frameloadstoreopts',
  'simplemem2reg','scopeelimination','functionanalysis','scopehoisting',
  'objectstackpromotion','typeinference','cse','privatebrandcheckdedup',
  'tdzdedup','instsimplify','funcsigopts','dce','frameloadstoreopts',
  'simplemem2reg','auditor','typeinference',
]);
const profiles=Object.freeze({
  debug:Object.freeze({id:'windows-hermes-94aa5e1d-debug-v1',profile:'debug',flags:Object.freeze(['-Og'])}),
  optimized:Object.freeze({id:'windows-hermes-94aa5e1d-no-cfg-v1',profile:'optimized',flags:Object.freeze(['-O','-fno-inline','-Xcustom-opt='+noCfgPasses.join(',')])}),
});
/** An explicit optimized profile never applies to an unqualified engine revision. */
export function windowsHermesPolicy(profile='debug',cohort){
  if(profile!=='debug'&&profile!=='optimized')throw new TypeError('Choose Windows --hermes-profile debug or optimized');
  if(cohort?.engine!=='hermes'||cohort.engineVersion!=='1.0.0'||cohort.engineRevision!=='94aa5e1d40a4ce99df79d951cbe45310ec40680c'||cohort.bytecodeVersion!==99||cohort.framework!=='react-native-windows'||cohort.frameworkVersion!=='0.83.2')throw new TypeError('Windows Hermes compiler policy requires the pinned RNW0.83.2 / Hermes94aa5e1d / HBC99 supplier');
  return profiles[profile];
}
