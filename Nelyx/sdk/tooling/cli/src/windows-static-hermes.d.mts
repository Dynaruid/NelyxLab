import type {ProviderCohort} from '@nelyx/sdk/runtime/cohorts';
export interface StaticHermesFile {readonly path:string;readonly bytes:number;readonly sha256:string;}
export interface NativeInternalJavaScript {readonly mode:'native';readonly sourceSha256:string;readonly unitSha256:string;readonly compilerPolicy:string;readonly nativeFunctions:number;}
export interface StaticHermesToolchain {
  readonly directory:string;readonly sha256:string;
  readonly manifest:{readonly schema:'nelyx.windows-static-hermes/v1';readonly revision:string;readonly runtimeSha256:string;readonly bridgeSha256:string;readonly internalJavaScript:NativeInternalJavaScript;readonly files:readonly StaticHermesFile[]};
}
export interface StaticHermesCompilation {
  readonly mode:'untyped-native';readonly revision:string;readonly toolchainSha256:string;readonly sourceSha256:string;
  readonly librarySha256:string;readonly libraryBytes:number;readonly compilerPolicy:string;readonly compilerFlags:readonly string[];
}
export declare const windowsStaticHermesPin:Readonly<{internalJavaScriptSha256:string;revision:string;sourceSha256:string;sourceUrl:string;runtimeSha256:string;unit:'nelyx_app';library:'NelyxApp.aot.dll';mode:'untyped-native'}>;
export declare const staticHermesBootstrap:string;
export declare const staticHermesBridgeSha256:()=>string;
export declare function patchStaticHermesRuntime(source:string):string;
export declare function windowsCompilerEnvironment():Record<string,string|undefined>;
export declare function verifyWindowsStaticHermes(directory:string):StaticHermesToolchain;
export declare function prepareWindowsStaticHermes(options?:{readonly output?:string;readonly signal?:AbortSignal}):Promise<StaticHermesToolchain>;
export declare function compileWindowsStaticHermes(options:{readonly toolchain:string;readonly source:string;readonly output:string;readonly hermesDirectory:string;readonly cohort:ProviderCohort;readonly signal?:AbortSignal}):Promise<StaticHermesCompilation>;
