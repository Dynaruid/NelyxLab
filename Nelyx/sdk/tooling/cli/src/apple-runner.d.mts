export interface AppleRunnerOptions {readonly app:string;readonly target:'ios'|'macos';readonly directory?:string;readonly output?:string;readonly configuration?:'Release';readonly device?:string;readonly arguments?:readonly string[];}
export function doctorApple(options:AppleRunnerOptions):Promise<unknown>;
export function prepareApple(options:AppleRunnerOptions):Promise<unknown>;
export function buildApple(options:AppleRunnerOptions):Promise<unknown>;
export function verifyApplePackage(directory:string,target:'ios'|'macos'):{readonly directory:string;readonly files:number;readonly bytes:number;readonly manifest:Readonly<Record<string,unknown>>};
export function runApple(options:AppleRunnerOptions):Promise<{schema:'nelyx.run/v3';target:'ios'|'macos';exitCode:number;qualification:'notVerified';scope:string}>;
export function packApple(options:AppleRunnerOptions):unknown;
