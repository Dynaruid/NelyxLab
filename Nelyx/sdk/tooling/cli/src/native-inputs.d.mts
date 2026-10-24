export interface WindowsNativeInputs {
  readonly schema:'nelyx.rnw-native-inputs/v1';readonly rnw:'0.83.2';readonly jsi:21;readonly architecture:'x64';readonly configuration:'Release';readonly crt:'MD';
  readonly files:readonly {readonly file:string;readonly sha256:string;readonly bytes:number}[];readonly libraries:readonly string[];readonly icu:string;readonly headers:string;readonly sources:Readonly<Record<string,string>>;
}
export declare function verifyWindowsInputs(options:{readonly runner:string;readonly input:string}):{readonly input:string;readonly root:string;readonly manifest:WindowsNativeInputs;readonly sha256:string;readonly files:number;readonly bytes:number};
export declare function prepareWindowsInputs(options:{readonly app:string;readonly runner:string;readonly input:string}):{readonly schema:'nelyx.rnw-prepared/v1';readonly input:string;readonly sha256:string;readonly files:number;readonly bytes:number};
