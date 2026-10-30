// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {
  DiagnosticableNode,
  DiagnosticableTreeNode,
  DiagnosticPropertiesBuilder,
} from './diagnostics.ts';
import type {
  Diagnosticable as DiagnosticableProtocol,
  DiagnosticableTreeProtocol,
  DiagnosticsNode,
  DiagnosticsOptions,
  DiagnosticsStringOptions,
  DiagnosticLevel,
} from './diagnostics.ts';
import { FoundationBuildMode } from './constants.ts';
import { describeIdentity } from './diagnostics-identity.ts';
/** The unconstrained implementation tuple is required by TypeScript's mixin rule. */
export type DiagnosticConstructor = abstract new (...args: any[]) => object;
export interface DiagnosticableValue extends DiagnosticableProtocol {
  toString(options?: DiagnosticsStringOptions): string;
}
export interface DiagnosticableTreeValue extends DiagnosticableValue, DiagnosticableTreeProtocol {
  toStringShallow(options?: {
    readonly joiner?: string;
    readonly minLevel?: DiagnosticLevel;
  }): string;
  toStringDeep(options?: DiagnosticsStringOptions): string;
}
export type DiagnosticableConstructor<Base extends DiagnosticConstructor> = abstract new (
  ...args: ConstructorParameters<Base>
) => InstanceType<Base> & DiagnosticableValue;
export type DiagnosticableTreeConstructor<Base extends DiagnosticConstructor> = abstract new (
  ...args: ConstructorParameters<Base>
) => InstanceType<Base> & DiagnosticableTreeValue;
export function Diagnosticable<Base extends DiagnosticConstructor>(
  Base: Base,
): DiagnosticableConstructor<Base> {
  abstract class DiagnosticableValue extends Base implements DiagnosticableProtocol {
    toStringShort(): string {
      return describeIdentity(this);
    }
    toString(o: DiagnosticsStringOptions = {}): string {
      return FoundationBuildMode.debug
        ? this.toDiagnosticsNode({ style: 'singleLine' }).toString({
            minLevel: o.minLevel ?? 'info',
          })
        : this.toStringShort();
    }
    toDiagnosticsNode(o: DiagnosticsOptions = {}): DiagnosticsNode {
      return new DiagnosticableNode(this, o);
    }
    debugFillProperties(_properties: DiagnosticPropertiesBuilder): void {}
  }
  return DiagnosticableValue as unknown as DiagnosticableConstructor<Base>;
}
export abstract class DiagnosticableTree
  extends Diagnosticable(class {})
  implements DiagnosticableTreeProtocol
{
  constructor() {
    super();
  }
  toStringShallow({
    joiner = ', ',
    minLevel = 'debug',
  }: { readonly joiner?: string; readonly minLevel?: DiagnosticLevel } = {}): string {
    if (!FoundationBuildMode.debug) return this.toString();
    const text = this.toString() + joiner,
      builder = new DiagnosticPropertiesBuilder();
    this.debugFillProperties(builder);
    return text + builder.properties.filter((n) => !n.isFiltered(minLevel)).join(joiner);
  }
  toStringDeep(o: DiagnosticsStringOptions = {}): string {
    return this.toDiagnosticsNode().toStringDeep(o);
  }
  override toStringShort(): string {
    return describeIdentity(this);
  }
  override toDiagnosticsNode(o: DiagnosticsOptions = {}): DiagnosticsNode {
    return new DiagnosticableTreeNode(this, o);
  }
  debugDescribeChildren(): readonly DiagnosticsNode[] {
    return [];
  }
}
export function DiagnosticableTreeMixin<Base extends DiagnosticConstructor>(
  Base: Base,
): DiagnosticableTreeConstructor<Base> {
  abstract class TreeDiagnosticableValue extends Base implements DiagnosticableTreeValue {
    toString(o: DiagnosticsStringOptions = {}): string {
      return this.toDiagnosticsNode({ style: 'singleLine' }).toString({
        minLevel: o.minLevel ?? 'info',
      });
    }
    toStringShallow({
      joiner = ', ',
      minLevel = 'debug',
    }: { readonly joiner?: string; readonly minLevel?: DiagnosticLevel } = {}): string {
      if (!FoundationBuildMode.debug) return this.toString();
      const builder = new DiagnosticPropertiesBuilder();
      this.debugFillProperties(builder);
      return (
        this.toStringShort() +
        joiner +
        builder.properties.filter((n) => !n.isFiltered(minLevel)).join(joiner)
      );
    }
    toStringDeep(o: DiagnosticsStringOptions = {}): string {
      return this.toDiagnosticsNode().toStringDeep(o);
    }
    toStringShort(): string {
      return describeIdentity(this);
    }
    toDiagnosticsNode(o: DiagnosticsOptions = {}): DiagnosticsNode {
      return new DiagnosticableTreeNode(this, o);
    }
    debugDescribeChildren(): readonly DiagnosticsNode[] {
      return [];
    }
    debugFillProperties(_properties: DiagnosticPropertiesBuilder): void {}
  }
  return TreeDiagnosticableValue as unknown as DiagnosticableTreeConstructor<Base>;
}
