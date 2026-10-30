// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import type { DiagnosticsNode } from './diagnostics.ts';
export type JsonDiagnosticsNode = Record<string, unknown>;
export interface DiagnosticsSerializationOptions {
  readonly subtreeDepth?: number;
  readonly includeProperties?: boolean;
}
/** Constructible TypeScript adaptation of the source abstract default factory. */
export class DiagnosticsSerializationDelegate {
  readonly subtreeDepth!: number;
  readonly includeProperties!: boolean;
  constructor(o: DiagnosticsSerializationOptions = {}) {
    if (new.target === DiagnosticsSerializationDelegate)
      return new _DefaultDiagnosticsSerializationDelegate(o);
    this.subtreeDepth = o.subtreeDepth ?? 0;
    this.includeProperties = o.includeProperties ?? false;
  }
  additionalNodeProperties(
    _node: DiagnosticsNode,
    _options: { readonly fullDetails?: boolean } = {},
  ): JsonDiagnosticsNode {
    return {};
  }
  filterChildren(
    nodes: readonly DiagnosticsNode[],
    _owner: DiagnosticsNode,
  ): readonly DiagnosticsNode[] {
    return nodes;
  }
  filterProperties(
    nodes: readonly DiagnosticsNode[],
    _owner: DiagnosticsNode,
  ): readonly DiagnosticsNode[] {
    return nodes;
  }
  /** The source serializer may append its truncation marker to this returned list. */
  truncateNodesList(
    nodes: readonly DiagnosticsNode[],
    _owner: DiagnosticsNode | null,
  ): DiagnosticsNode[] {
    return nodes as DiagnosticsNode[];
  }
  delegateForNode(_node: DiagnosticsNode): DiagnosticsSerializationDelegate {
    return this.subtreeDepth > 0 ? this.copyWith({ subtreeDepth: this.subtreeDepth - 1 }) : this;
  }
  get expandPropertyValues(): boolean {
    return false;
  }
  copyWith(o: DiagnosticsSerializationOptions = {}): DiagnosticsSerializationDelegate {
    return new DiagnosticsSerializationDelegate({
      subtreeDepth: o.subtreeDepth ?? this.subtreeDepth,
      includeProperties: o.includeProperties ?? this.includeProperties,
    });
  }
}
class _DefaultDiagnosticsSerializationDelegate extends DiagnosticsSerializationDelegate {}
