import type { RuntimeInventory, RuntimeModuleInput } from './runtime-inventory.mjs';
import type { AutomaticPartition } from './type-policy.mjs';
export interface RuntimeCapture {
  readonly inventory: RuntimeInventory;
  readonly code: string;
  readonly map: string;
  readonly records: readonly (RuntimeModuleInput & {
    readonly mappings?: readonly (readonly number[])[];
    readonly originalMap?: unknown;
    readonly transformSourceSha256?: string;
    readonly frontendElimination?: Readonly<Record<string, unknown>>;
    readonly nativeEvidence?: {
      readonly schema: 'nelyx.metro-native-evidence/v1';
      readonly elimination: Readonly<Record<string, unknown>>;
      readonly consumed: null | { readonly sha256: string; readonly bindings: readonly string[] };
    };
  })[];
  readonly spans: readonly { readonly id: string; readonly offset: number; readonly end: number }[];
}
export interface NativeScriptInput {
  readonly unit: string;
  readonly input: string;
  readonly source: string;
  readonly sourceSha256: string;
  readonly sourceFile: string;
  readonly owner: RuntimeModuleInput['owner'];
  readonly originalSha256: string;
  readonly line: number;
}
export interface ExecutionPlan {
  readonly schema: 'nelyx.static-aot-execution-plan/v2';
  readonly sha256: string;
  readonly inventorySha256: string;
  readonly typePolicySha256: string;
  readonly sourceGraphSha256: string;
  readonly partitionSha256: string;
  readonly nativeSourceSha256: string;
  readonly typedSourceSha256: string;
  readonly modules: readonly Readonly<Record<string, unknown>>[];
  readonly unresolved: readonly Readonly<Record<string, unknown>>[];
  readonly dependencyFailures: readonly Readonly<Record<string, unknown>>[];
  readonly dynamicCodeCandidates: readonly Readonly<Record<string, unknown>>[];
  readonly summary: Readonly<Record<string, unknown>> & {
    readonly wholeAppNativeAot: boolean;
    readonly typePolicyAccepted: boolean | 'notVerified';
  };
}
export declare function createExecutionPlan(
  capture: RuntimeCapture,
  partition: AutomaticPartition,
  prefix?: string,
  nativeScripts?: readonly NativeScriptInput[],
): ExecutionPlan;
export declare function bindNativeCoverage(
  plan: ExecutionPlan,
  build: Readonly<Record<string, unknown>>,
  identity: Readonly<Record<string, unknown>>,
): ExecutionPlan;
export declare function verifyFrontendPlan(plan: ExecutionPlan): ExecutionPlan;
