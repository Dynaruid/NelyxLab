export interface AndroidRunnerOptions {readonly app:string;readonly directory?:string;readonly output?:string;readonly configuration?:'Release';readonly architecture?:'arm64-v8a'|'x86_64';readonly androidSdk?:string;readonly device?:string;readonly port?:number;}
export function doctorAndroid(options:AndroidRunnerOptions):Promise<unknown>;
export function prepareAndroid(options:Pick<AndroidRunnerOptions,'app'>):Promise<unknown>;
export function buildAndroid(options:AndroidRunnerOptions):Promise<unknown>;
export function verifyAndroidPackage(directory:string):{readonly directory:string;readonly files:number;readonly bytes:number;readonly apk:{readonly entries:number;readonly nativeLibraries:number;readonly architecture:string;readonly bytecodeVersion:number};readonly manifest:Readonly<Record<string,unknown>>};
export function runAndroid(options:AndroidRunnerOptions):Promise<{schema:'nelyx.run/v3';target:'android';exitCode:number;device:string;applicationId:string;activity:string;scope:string;qualification:'notVerified'}>;
export function packAndroid(options:AndroidRunnerOptions):unknown;
