export interface LinuxApplicationConfiguration {readonly app:string;readonly runner:string;readonly config:{readonly name:string;readonly profile:string;readonly windowSystem:'x11'|'wayland';readonly assets:readonly import('@nelyx/sdk/runtime/config').ResolvedAppAsset[]};readonly cohort:import('@nelyx/sdk/runtime/cohorts').ProviderCohort;readonly qualification:import('@nelyx/sdk/runtime/providers').ProviderQualification;}
export function configureLinuxApplication(options:{app:string}):Promise<LinuxApplicationConfiguration>;
export function prepareLinux(options:{app:string;nativeInputs:string}):Promise<{schema:'nelyx.linux-prepared/v1';input:string;sha256:string;files:number;bytes:number}>;
export function doctorLinux(options:{app:string;nativeInputs?:string}):Promise<unknown>;
export function locateLinuxInputs(options:{app:string;runner:string;input?:string}):import('./linux-inputs.mjs').LinuxNativeInputs;
export function writeLinuxBundleMap(options:{app:string;directory:string}):{modules:number;sourceFiles:number};
export function verifyLinuxPackage(directory:string):{directory:string;manifest:{executable:string;bundle:string;files:readonly {path:string;bytes:number;sha256:string}[];readonly [name:string]:unknown};files:number;bytes:number;sourceMap:{modules:number;sourceFiles:number}};
export function buildLinux(options:{app:string;nativeInputs?:string;output?:string;configuration?:'Debug'|'Release';hermesSource?:string;buildDirectory?:string;signal?:AbortSignal}):Promise<{directory:string;readonly [name:string]:unknown}>;
export function runLinux(options:{app:string;directory?:string;arguments?:readonly string[]}):Promise<{schema:'nelyx.run/v2';target:'linux';exitCode:number}>;
export function packLinux(options:{app:string;directory?:string;output?:string}):Promise<unknown>;
