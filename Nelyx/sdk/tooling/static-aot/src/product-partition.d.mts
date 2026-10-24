import type {TypedPartition,PartitionBinding} from './partition.mjs';
import type {AutomaticPartition} from './type-policy.mjs';
export interface ProductPartition extends AutomaticPartition {readonly metroPlan:{readonly schema:'nelyx.typed-metro-plan/v1';readonly irSha256:string;readonly files:readonly {readonly file:string;readonly sha256:string;readonly bindings:readonly PartitionBinding[]}[]};}
export declare function productPartition(options:{readonly runner:string;readonly entry:string;readonly runtimeFiles?:readonly string[]}):ProductPartition;
export declare function typedBootstrapPrefix(partition:TypedPartition):string;
