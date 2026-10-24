import type {SourceGraphOptions,SourceGraph} from './source-graph.mjs';
import type {NumericSelection} from './numeric-partition.mjs';
export interface PartitionBinding {
  readonly id:string;readonly globalName:string;readonly module:string;readonly file:string;
  readonly sourceSha256:string;readonly runtime:string|null;readonly runtimeSha256:string|null;
  readonly name:string;readonly className:string|null;readonly adapter:string;readonly guard?:string;
}
export interface TypedPartition {
  readonly ir:{readonly schema:'nelyx.typed-partition-ir/v1';readonly graphSha256:string;readonly checkerSha256:string;readonly functions:readonly Readonly<Record<string,unknown>>[]};
  readonly irSha256:string;readonly source:string;readonly sourceSha256:string;
  readonly segments:readonly {readonly generatedOffset:number;readonly generatedLength:number;readonly module:string;readonly sourceOffset:number;readonly line:number;readonly column:number}[];
  readonly bindings:readonly PartitionBinding[];readonly graph:SourceGraph;readonly qualification:'experimental';
}
export declare function lowerPartition(options:SourceGraphOptions,selections:readonly NumericSelection[]):TypedPartition;
