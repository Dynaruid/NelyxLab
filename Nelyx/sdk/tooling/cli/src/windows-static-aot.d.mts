import type {ProviderCohort} from '@nelyx/sdk/runtime/cohorts';
import type {TypedPartition} from '@nelyx/static-aot/partition';
import type {ProductPartition} from '@nelyx/static-aot/product-partition';
import type {ExecutionPlan} from '@nelyx/static-aot/execution-plan';
import type {NativeInternalJavaScript} from './windows-static-hermes.mjs';
export interface NativeExecutionPartition extends ProductPartition {readonly executionPlan:ExecutionPlan;}
export declare const staticAotBootstrap:string;
export interface StaticAotCompilation {
  readonly mode:'static-native-aot';readonly revision:string;readonly toolchainSha256:string;
  readonly sourceSha256:string;readonly typedSourceSha256:string;readonly partitionSha256:string;
  readonly rnwPalSourceSha256:string;readonly librarySha256:string;readonly libraryBytes:number;readonly compilerPolicy:string;readonly compilerFlags:readonly string[];
  readonly unitOrder:readonly ['nelyx_typed','nelyx_app']|readonly ['nelyx_typed','nelyx_app','nelyx_rnw_pal'];
  readonly nativePlan:{readonly schema:'nelyx.shunit-plan/v5';readonly scope:'full-runtime'|'native-probe';readonly revision:string;readonly compilerPolicy:string;readonly partitionSha256:string;readonly graphSha256:string;readonly typePolicySha256:string;readonly executionPlanSha256:string;readonly sourceSha256:string;readonly typedSourceSha256:string;readonly internalJavaScriptSha256:string;readonly rnwPalSourceSha256:string;};
  readonly build:{readonly buildMs:number;readonly cacheHit:boolean;readonly units:readonly {readonly unit:string;readonly cacheHit:boolean;readonly frontendMs:number;readonly baselineMs:number;readonly evidenceMs:number;readonly nativeMs:number;readonly cBytes:number}[]};
}
export interface StaticAotApplication extends Omit<StaticAotCompilation,'build'> {
  readonly schema:'nelyx.windows-static-aot-app/v5';readonly library:'NelyxApp.aot.dll';readonly source:'Bundle/index.windows.aot.js';
  readonly typedSource:'Bundle/index.windows.typed.ts';readonly inputMap:string;readonly inputMapSha256:string;
  readonly runtimeSha256:string;readonly baseRuntimeSha256:string;readonly bridgeSha256:string;readonly bootstrapSha256:string;
  readonly internalJavaScript:NativeInternalJavaScript;readonly rnwPalSource:'Bundle/index.windows.rnw-pal.js';
  readonly bootstrapFormat:'nelyx-static-hermes-native/v5';readonly qualification:'experimental';
  readonly executionPlan:'static-aot-execution.json';readonly executionPlanSha256:string;
  readonly typePolicy:'static-aot-type-policy.json';readonly typePolicySha256:string;readonly acceptance:ExecutionPlan['summary'];
  readonly nativePcMap:'static-aot-native-pc.json';readonly nativePcMapSha256:string;
  readonly partition:readonly {readonly id:string;readonly globalName:string;readonly sourceSha256:string;readonly runtimeSha256:string|null}[];
}
interface CompileOptions {readonly toolchain:string;readonly source:string;readonly typedSource:string;readonly output:string;readonly hermesDirectory:string;readonly cohort:ProviderCohort;readonly signal?:AbortSignal;readonly partitionSha256:string;readonly cacheDirectory?:string;readonly diagnosticMap?:Pick<TypedPartition,'segments'|'bindings'>&{readonly executionPlan?:ExecutionPlan};}
export declare function compileWindowsStaticAot(options:CompileOptions):Promise<StaticAotCompilation>;
export declare function writeStaticAotApplication(options:Omit<CompileOptions,'output'|'partitionSha256'>&{readonly directory:string;readonly bundle:string;readonly partition:NativeExecutionPartition}):Promise<StaticAotApplication>;
export declare function verifyStaticAotApplication(directory:string):StaticAotApplication;
export declare function mapStaticAotPc(directory:string,rva:number):readonly Readonly<Record<string,unknown>>[];
export declare function buildStaticAotMetroBundle(options:{readonly runner:string;readonly entry:string;readonly source:string;readonly map:string;readonly config:import('metro-config').ConfigT;readonly signal?:AbortSignal;readonly nativeHost?:boolean;readonly applicationRoot?:string;readonly packageRoots?:readonly string[]}):Promise<NativeExecutionPartition>;
