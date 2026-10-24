import type {ConfigT,InputConfigT} from 'metro-config';
export interface RnRunnerOptions {
  readonly target:'android'|'ios'|'windows'|'macos'|'linux';
  readonly runnerRoot:string;
  readonly appRoot?:string;
  readonly javaScriptEngine?:'hermes'|'v8'|'jsc';
  readonly packageRoots?:Readonly<Record<string,string>>;
}
export interface RnRunnerCohort {
  readonly target:RnRunnerOptions['target'];readonly runnerRoot:string;readonly nodeModules:string;
  readonly react:string;readonly reactNative:string;readonly reactRoot:string;readonly reactNativeRoot:string;readonly reactNativeFacadeRoot:string;readonly reactNativeEntry:string;
  readonly framework:string;readonly frameworkVersion:string;readonly frameworkRoot:string;
}
export declare function inspectRunnerCohort(options:RnRunnerOptions):RnRunnerCohort;
export declare function createRunnerConfig(options:RnRunnerOptions,overrides?:InputConfigT):ConfigT;
export declare function createRunnerTypeScriptConfig(options:RnRunnerOptions):{
  compilerOptions:{target:'ES2022';module:'NodeNext';moduleResolution:'NodeNext';jsx:'react-jsx';strict:true;noEmit:true;allowImportingTsExtensions:true;skipLibCheck:true;lib:string[];types:string[];baseUrl:'.';paths:Record<string,string[]>};include:string[];exclude:string[];
};
