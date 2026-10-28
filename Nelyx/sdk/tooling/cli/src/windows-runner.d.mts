import type {ProviderCohort} from '@nelyx/sdk/runtime/cohorts';
import type {WindowsHermesProfile} from './windows-hermes-policy.mjs';
export interface WindowsPackageFile {readonly path:string;readonly bytes:number;readonly sha256:string;}
export interface WindowsPackageManifest {
  readonly schema:'nelyx.rnw-package/v1';readonly target:'windows';readonly profile:'rn-graphite-vulkan'|'rn-v8-graphite-vulkan'|'rn-jsc-graphite-vulkan';readonly architecture:'x64';readonly configuration:'Debug'|'Release';
  readonly app:string;readonly cohort:ProviderCohort;readonly executable:'NelyxRNHost.exe';readonly bundle:'Bundle/index.windows.bundle';readonly nativeInputsSha256:string;
  readonly nativeBindingConfiguration:'Release';readonly crt:'MD';readonly iteratorDebugLevel:0;
  readonly hermesCompilerFlags:string|null;readonly hermesCompilerProfile?:WindowsHermesProfile|null;readonly hermesCompilerPolicy?:string|null;
  readonly hermesExecutionMode?:'bytecode'|'static-aot';readonly jscExecutionMode?:'jit'|'interpreter'|null;readonly jscCompilerPolicy?:string|null;
  readonly qualification:'notVerified';readonly files:readonly WindowsPackageFile[];
  readonly sdkInputsSha256?:string;
}
export declare function verifyWindowsPackage(directory:string):{readonly directory:string;readonly manifest:WindowsPackageManifest;readonly files:number;readonly bytes:number;readonly sourceMap:{readonly modules:number;readonly sourceFiles:number}};
export declare function doctorWindows(options:{readonly app:string}):Promise<Readonly<Record<string,unknown>>>;
export declare function prepareWindows(options:{readonly app:string;readonly nativeInputs?:string;readonly engine?:'hermes'|'v8'|'jsc';readonly engineInputs?:string;readonly jscMode?:'jit'|'interpreter';readonly hermesMode?:'bytecode'|'static-aot'}):Promise<{readonly schema:'nelyx.rnw-prepared/v1';readonly input:string;readonly sha256:string;readonly files:number;readonly bytes:number;readonly engine?:'hermes'|'v8'|'jsc';readonly hermesExecutionMode?:'static-aot';readonly engineInputs?:string;readonly jscExecutionMode?:'jit'|'interpreter';readonly engineInputsSha256?:string}>;
export declare function buildWindows(options:{readonly app:string;readonly nativeInputs?:string;readonly output?:string;readonly configuration?:'Debug'|'Release';readonly signal?:AbortSignal;readonly engine?:'hermes'|'v8'|'jsc';readonly engineInputs?:string;readonly jscMode?:'jit'|'interpreter';readonly hermesProfile?:'debug'|'optimized';readonly hermesMode?:'bytecode'|'static-aot'}):Promise<{readonly schema:'nelyx.build/v2';readonly target:'windows';readonly profile:string;readonly directory:string;readonly files:number;readonly bytes:number;readonly exeSha256:string;readonly qualification:'notVerified';readonly cleanup:{readonly removed:readonly string[];readonly retained:readonly {readonly directory:string;readonly reason:string}[]}}>;
export declare function runWindows(options:{readonly app:string;readonly directory?:string;readonly hermesMode?:'bytecode'|'static-aot';readonly arguments?:readonly string[]}):Promise<{readonly schema:'nelyx.run/v2';readonly target:'windows';readonly exitCode:number}>;
export declare function packWindows(options:{readonly app:string;readonly directory?:string;readonly output?:string}):Promise<{readonly schema:'nelyx.pack/v2';readonly target:'windows';readonly file:string;readonly sha256:string;readonly files:number;readonly qualification:'notVerified'}>;
