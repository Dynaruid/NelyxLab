import type { SourceGraphOptions, SourcePosition } from './source-graph.mjs';
export interface NumericSelection {
  readonly module: string;
  readonly name: string;
  readonly className?: string;
}
export interface NumericExpression extends SourcePosition {
  readonly kind: 'literal' | 'parameter' | 'unary' | 'binary';
  readonly type: 'number';
  readonly text?: string;
  readonly index?: number;
  readonly operator?: string;
  readonly left?: NumericExpression;
  readonly right?: NumericExpression;
  readonly operand?: NumericExpression;
}
export interface NumericPartition {
  readonly ir: {
    readonly schema: 'nelyx.typed-numeric-ir/v1';
    readonly graphSha256: string;
    readonly checkerSha256: string;
    readonly functions: readonly (SourcePosition & {
      readonly id: string;
      readonly sourceSha256: string;
      readonly receiver: 'none' | 'excluded-from-kernel';
      readonly parameters: readonly (SourcePosition & {
        readonly name: string;
        readonly type: 'number';
      })[];
      readonly returnType: 'number';
      readonly body: NumericExpression;
    })[];
  };
  readonly irSha256: string;
  readonly source: string;
  readonly sourceSha256: string;
  readonly qualification: 'prototype';
  readonly bindings: readonly { readonly id: string; readonly globalName: string }[];
  readonly segments: readonly {
    readonly generatedOffset: number;
    readonly module: string;
    readonly sourceOffset: number;
    readonly line: number;
    readonly column: number;
  }[];
  readonly graphDiagnostics: readonly {
    readonly code: number;
    readonly category: string;
    readonly module: string | null;
    readonly offset: number;
    readonly message: string;
  }[];
}
export declare function lowerNumericPartition(
  options: SourceGraphOptions,
  selections: readonly NumericSelection[],
): NumericPartition;
