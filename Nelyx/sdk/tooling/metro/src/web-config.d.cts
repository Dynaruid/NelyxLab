import type {ConfigT} from 'metro-config';
export declare function createWebConfig(options:{readonly projectRoot:string;readonly watchFolders?:readonly string[];readonly nodeModulesPaths?:readonly string[]}):Promise<ConfigT>;
export interface WebRunnerCohort {readonly runnerRoot:string;readonly nodeModules:string;readonly react:'19.2.0';readonly reactDom:'19.2.0';readonly reactNativeWeb:'0.21.3';readonly canvasKit:'0.41.0';readonly roots:Readonly<Record<string,string>>;}
export declare function inspectWebRunnerCohort(options:{readonly runnerRoot:string}):WebRunnerCohort;
export declare function createWebRunnerConfig(options:{readonly runnerRoot:string;readonly appRoot:string}):Promise<ConfigT>;
export declare function createWebRunnerTypeScriptConfig(options:{readonly runnerRoot:string;readonly appRoot:string}):{compilerOptions:Record<string,unknown>;include:string[];exclude:string[]};
