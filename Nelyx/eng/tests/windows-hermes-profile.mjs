// SPDX-License-Identifier: BSD-3-Clause
import {windowsHermesPolicy} from '../../sdk/tooling/cli/src/windows-hermes-policy.mjs';
import {nativeCohort} from '../../sdk/dist/runtime/cohorts.js';
// Pinned Hermes 94aa5e1d: the Testbed Hermes fallback uses the owned policy.
// This is its registered -O pass order, excluding SimplifyCFG. The internal
// LowerBuiltinCallsOptimized pass is unavailable through -Xcustom-opt and is
// omitted too. Keep this independent diagnostic list as a policy control.
const noCfgPasses=[
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
];
export function windowsHermesProfileFlags(profile){
  if(profile==='optimized')return [...windowsHermesPolicy('optimized',nativeCohort('windows')).flags];
  if(profile==='Og'||profile==='O')return ['-'+profile];
  if(profile==='O-no-inline')return ['-O','-fno-inline'];
  if(profile==='O-no-cfg')return ['-O','-fno-inline','-Xcustom-opt='+noCfgPasses.join(',')];
  if(profile==='O-no-cfg-inline')return ['-O','-Xcustom-opt='+noCfgPasses.join(',')];
  throw new RangeError('Unknown Windows Hermes diagnostic profile: '+profile);
}
