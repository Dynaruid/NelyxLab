export interface WindowsV8File {readonly path:string;readonly bytes:number;readonly sha256:string}
export interface WindowsV8Manifest {readonly schema:'nelyx.windows-v8/v1';readonly rnw:'0.83.2';readonly nativeReactNative:'0.83.4';readonly jsi:21;readonly architecture:'x64';readonly crt:'MD';readonly version:string;readonly revision:string;readonly archiveSha256:string;readonly bridgeSha256:string;readonly patchedHostSha256:string;readonly microtaskAdapterSha256:string;readonly qualification:'notVerified';readonly files:readonly WindowsV8File[]}
export interface WindowsV8Supply {readonly directory:string;readonly manifest:WindowsV8Manifest;readonly sha256:string}
export const windowsV8Pin:Readonly<{version:string;revision:string;package:string;sha256:string;url:string}>;
export function patchWindowsV8Source(source:string):string;
export function patchV8Microtasks(source:string):string;
export function verifyWindowsV8(directory:string,options?:{readonly embedded?:boolean}):WindowsV8Supply;
export function prepareWindowsV8(options:{readonly runner:string;readonly output:string;readonly signal?:AbortSignal;readonly bridgeHeader?:string}):Promise<WindowsV8Supply>;
