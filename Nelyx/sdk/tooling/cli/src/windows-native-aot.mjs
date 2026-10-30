// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { buildStaticAotMetroBundle } from './windows-static-aot.mjs';
import { compileHermesImage } from './windows-hermes-image.mjs';
import { windowsTypedHermesPolicy } from './windows-typed-hermes-policy.mjs';
import { windowsHermesPolicy } from './windows-hermes-policy.mjs';
import { nativeCohort } from '@nelyx/sdk/runtime/cohorts';
import { bindNativeCoverage, verifyFrontendPlan } from '@nelyx/static-aot/execution-plan';
import { verifyTypePolicy } from '@nelyx/static-aot/type-policy';
import { sha256, localFile } from './files.mjs';

/** The same automatic type policy and complete frontend/backend body audit as
 * RNW, with two direct SHUnits and no RNW PAL or bytecode bootstrap. */
export async function buildNativeAot({
  app,
  runner = app,
  root,
  entry,
  source,
  map,
  config,
  roots,
  checked,
  env,
  stage,
  signal,
  cacheDirectory = path.join(app, '.nelyx/native-windows/static-aot-cache'),
}) {
  const partition = await buildStaticAotMetroBundle({
    runner,
    applicationRoot: root,
    packageRoots: Object.values(roots),
    entry,
    source,
    map,
    config,
    signal,
    nativeHost: true,
  });
  const typedSource = path.join(stage, 'index.windows.typed.ts'),
    cohort = nativeCohort('windows'),
    policy = windowsTypedHermesPolicy(cohort);
  const nativePlan = {
    schema: 'nelyx.native-shunit-plan/v1',
    revision: checked.manifest.revision,
    units: ['nelyx_typed', 'nelyx_app'],
    compilerPolicy: policy.id,
    partitionSha256: partition.irSha256,
    sourceSha256: sha256(source),
    typedSourceSha256: sha256(typedSource),
    executionPlanSha256: partition.executionPlan.sha256,
    typePolicySha256: partition.typePolicy.sha256,
    internalJavaScriptSha256: checked.manifest.internalJavaScript.sourceSha256,
    toolchainSha256: checked.sha256,
  };
  const descriptor =
    '__declspec(dllexport) const char* nelyx_native_plan_v1(void){return ' +
    JSON.stringify(JSON.stringify(nativePlan)) +
    ';}\n';
  const output = path.join(stage, 'NelyxApp.aot.dll');
  const build = await compileHermesImage({
    checked,
    env,
    signal,
    output,
    descriptor,
    cacheDirectory,
    descriptorExport: 'nelyx_native_plan_v1',
    runtimeLibrary: path.join(checked.directory, 'build/lib/hermesvm.lib'),
    units: [
      {
        name: 'nelyx_typed',
        source: typedSource,
        flags: policy.flags,
        typed: true,
        requireNumeric: partition.bindings.length !== 0,
        diagnosticMap: partition,
        evidence: true,
      },
      {
        name: 'nelyx_app',
        source,
        flags: windowsHermesPolicy('optimized', cohort).flags,
        evidence: true,
      },
    ],
  });
  const identity = { ...nativePlan, librarySha256: sha256(output) },
    execution = bindNativeCoverage(partition.executionPlan, build, identity);
  if (execution.summary.wholeAppNativeAot !== true || execution.summary.typePolicyAccepted !== true)
    throw Error(
      'Direct Static Hermes coverage is incomplete: ' + JSON.stringify(execution.summary),
    );
  fs.writeFileSync(path.join(stage, 'native-aot-plan.json'), JSON.stringify(nativePlan));
  fs.writeFileSync(path.join(stage, 'native-aot-execution.json'), JSON.stringify(execution));
  fs.writeFileSync(
    path.join(stage, 'native-aot-type-policy.json'),
    JSON.stringify(partition.typePolicy),
  );
  return {
    nativeFunctions: build.units.reduce(
      (sum, unit) => sum + unit.nativeFunctions.functions.length,
      0,
    ),
    nativePlan,
    acceptance: execution.summary,
    execution,
  };
}
export function verifyNativeAot(directory, manifest) {
  const read = (name) => JSON.parse(fs.readFileSync(localFile(directory, name), 'utf8'));
  const plan = read('native-aot-plan.json'),
    execution = read('native-aot-execution.json'),
    policy = read('native-aot-type-policy.json');
  verifyTypePolicy(policy);
  verifyFrontendPlan(execution);
  if (
    plan.schema !== 'nelyx.native-shunit-plan/v1' ||
    JSON.stringify(plan) !== JSON.stringify(manifest.nativePlan) ||
    JSON.stringify(plan.units) !== '["nelyx_typed","nelyx_app"]' ||
    plan.sourceSha256 !== sha256(localFile(directory, 'app.js')) ||
    plan.typedSourceSha256 !== sha256(localFile(directory, 'index.windows.typed.ts')) ||
    plan.toolchainSha256 !== manifest.toolchainSha256 ||
    execution.typePolicySha256 !== policy.sha256 ||
    execution.frontendPlanSha256 !== plan.executionPlanSha256 ||
    execution.typePolicySha256 !== plan.typePolicySha256 ||
    execution.nativeImageSha256 !== sha256(localFile(directory, 'NelyxApp.aot.dll')) ||
    execution.compiler.toolchainSha256 !== manifest.toolchainSha256
  )
    throw Error('Direct Static Hermes plan/source/image identity differs');
  const repeated = bindNativeCoverage(
    execution,
    {
      units: execution.compiler.units.map((nativeFunctions) => ({
        unit: nativeFunctions.unit,
        nativeFunctions,
      })),
    },
    { ...plan, librarySha256: execution.nativeImageSha256 },
  );
  if (
    repeated.sha256 !== execution.sha256 ||
    execution.summary.wholeAppNativeAot !== true ||
    execution.summary.typePolicyAccepted !== true ||
    JSON.stringify(execution.summary) !== JSON.stringify(manifest.acceptance)
  )
    throw Error('Direct Static Hermes coverage/type policy differs');
  return execution.summary;
}
