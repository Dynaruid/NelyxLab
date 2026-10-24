import type {ConfigT} from 'metro-config';
import type {AppAsset} from '@nelyx/sdk/runtime/config';
export declare function serveWebDevelopment(options:{readonly config:ConfigT;readonly appRoot:string;readonly assets:readonly AppAsset[];readonly readAssets?:()=>Promise<readonly AppAsset[]>;readonly host?:'127.0.0.1'|'localhost';readonly port?:number;readonly runtimeDirectory?:string}):Promise<{readonly url:string;readonly runner:string;close():Promise<void>}>;
