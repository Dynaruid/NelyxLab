import type {RuntimeInventory} from '@nelyx/static-aot/runtime-inventory';
import type {RuntimeCapture} from '@nelyx/static-aot/execution-plan';
export declare function inspectRuntimeInventory(options:{readonly runner:string;readonly appRoot:string;readonly signal?:AbortSignal;readonly entry?:string;readonly config?:import('metro-config').ConfigT;readonly customTransformOptions?:Readonly<Record<string,string>>;readonly sourceMapUrl?:string;readonly onCapture?:(capture:RuntimeCapture)=>void}):Promise<RuntimeInventory>;
