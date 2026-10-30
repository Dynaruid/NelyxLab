import type { SourceGraphOptions } from './source-graph.mjs';
import type { TypedPartition } from './partition.mjs';
export interface TypeDecision {
  readonly module: string;
  readonly sourceSha256: string;
  readonly offset: number;
  readonly end: number;
  readonly line: number;
  readonly column: number;
  readonly name: string;
  readonly selection: {
    readonly module: string;
    readonly name: string;
    readonly className?: string;
  } | null;
  readonly decision: 'specialize' | 'dynamic-js-with-reason';
  readonly reason: string;
  readonly evidence: {
    readonly returnAnnotation: string;
    readonly parameters: readonly {
      readonly name: string;
      readonly annotation: string;
      readonly checkerType: string;
    }[];
  } | null;
}
export interface TypePolicy {
  readonly schema: 'nelyx.static-aot-type-policy/v1';
  readonly id: 'guarded-closed-scalar-v2';
  readonly sha256: string;
  readonly graphSha256: string;
  readonly checkerSha256: string;
  readonly sourceModules: readonly { readonly id: string; readonly sourceSha256: string }[];
  readonly decisions: readonly TypeDecision[];
  readonly summary: {
    readonly callables: number;
    readonly specialize: number;
    readonly dynamic: number;
  };
}
export interface AutomaticPartition extends TypedPartition {
  readonly typePolicy: TypePolicy;
}
export declare function automaticPartition(
  options: SourceGraphOptions & { readonly runtimeFiles?: readonly string[] },
): AutomaticPartition;
export declare function verifyTypePolicy(policy: TypePolicy): TypePolicy;
