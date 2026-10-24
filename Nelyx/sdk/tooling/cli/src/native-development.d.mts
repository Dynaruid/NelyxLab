export interface NativeDevelopmentOptions {
  readonly app:string;
  readonly target:'windows'|'linux'|'android'|'ios'|'macos';
  readonly host?:'127.0.0.1'|'localhost';
  readonly port?:number;
  readonly launch?:boolean;
  readonly androidSdk?:string;
  readonly device?:string;
  readonly architecture?:'arm64-v8a'|'x86_64';
  readonly nativeInputs?:string;
  readonly hermesSource?:string;
  readonly buildDirectory?:string;
}
export declare function devNative(options:NativeDevelopmentOptions):Promise<{
  schema:'nelyx.dev/v1';target:NativeDevelopmentOptions['target'];exitCode:number;runner:string;url:string;launch:boolean;
  metro:{exitCode:number|null;signal:NodeJS.Signals|null;error:string|null};device?:string;reverseCreated:boolean;scope:string;qualification:'notVerified';
  native?:{exitCode:number|null;signal:NodeJS.Signals|null;error:string|null};
}>;
