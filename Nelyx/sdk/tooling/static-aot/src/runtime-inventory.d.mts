export interface RuntimeModuleInput {
  readonly id:string; readonly metroId:number|string; readonly role:'module'|'prepend'|'append';
  readonly owner:{readonly name:string;readonly version:string;readonly root:string;readonly license:string|null;readonly manifestSha256:string};
  readonly source:string; readonly emitted:string; readonly sourceFile?:string;
  readonly sourceKind?:'code'|'json';
  readonly dialect:'javascript'|'typescript'|'flow'; readonly sourceMapSha256?:string;
  readonly dependencies:readonly {readonly specifier:string;readonly target:string|null;readonly asyncType:string|null;readonly optional?:boolean;readonly position?:unknown}[];
}
export interface RuntimeBody {readonly id:string;readonly kind:string;readonly name:string;readonly parent:string|null;readonly offset:number;readonly end:number;readonly line:number;readonly column:number;readonly sourceSha256:string;readonly annotation:'present-unqualified'|'absent';readonly classification:'unclassified';readonly frontendDisposition?:Readonly<Record<string,unknown>>;}
export interface DependencySite {readonly kind:'import'|'export'|'require'|'dynamic-import';readonly specifier:string|null;readonly offset:number;readonly end:number;readonly line:number;readonly column:number;}
export interface BodyInventory {readonly bodies:readonly RuntimeBody[];readonly features:readonly {readonly kind:string;readonly offset:number;readonly end:number;readonly line:number;readonly column:number}[];readonly dependencies:readonly DependencySite[];}
export declare function inventoryBody(source:string,options:{readonly filename:string;readonly dialect?:'javascript'|'typescript'|'flow';readonly maxBodies?:number;readonly releaseDefines?:{readonly __DEV__:boolean;readonly NODE_ENV:string}|null}):BodyInventory;
export interface RuntimeInventory {
  readonly schema:'nelyx.static-aot-runtime-inventory/v2'; readonly sha256:string;
  readonly identity:Readonly<Record<string,unknown>>;readonly entry:string;
  readonly runtimeComponents:readonly (readonly string[])[];
  readonly evaluationConflicts:readonly (readonly string[])[];
  readonly modules:readonly (Omit<RuntimeModuleInput,'source'|'emitted'|'dependencies'> & {readonly sourceSha256:string;readonly emittedSha256:string;readonly original:BodyInventory;readonly emitted:BodyInventory;readonly dependencies:readonly (RuntimeModuleInput['dependencies'][number]&{readonly sourceSites:readonly DependencySite[]})[];readonly correspondence:'notVerified'})[];
  readonly summary:{readonly modules:number;readonly mappedModules:number;readonly unresolvedDependencies:number;readonly originalBodies:number;readonly emittedBodies:number;readonly features:Readonly<Record<string,number>>;readonly nativeCoverage:'notVerified';readonly typeSpecializationCoverage:'notVerified';readonly wholeAppNativeAot:false;readonly typePolicyAccepted:'notVerified';readonly semanticClosure:'notVerified';readonly nativeLinking:'notImplemented'};
}
export declare function createRuntimeInventory(options:{readonly identity:Readonly<Record<string,unknown>>;readonly entry:string;readonly modules:readonly RuntimeModuleInput[];readonly sourceMapModules:readonly string[];readonly maxModules?:number;readonly maxBytes?:number;readonly maxBodies?:number}):RuntimeInventory;
