// SPDX-License-Identifier: BSD-3-Clause
// Resolved class relationships and construction safety, independent of TS printing.
import { createHash } from 'node:crypto';
import type { Declaration, Reference, Expression, ClassField } from './body-ir.ts';

export class BlockedSemantic extends Error {}
export type ClassDeclaration = Declaration & { kind: 'class' };
const library = (reference: Reference) => reference.id.split('::')[0]!;
export function memberKey(reference: Reference): string {
  return reference.id
    .replace(/:(FIELD|GETTER|SETTER)$/, ':PROPERTY')
    .replace(/=(:PROPERTY)$/, '$1');
}
/** Dart privacy belongs to the library, not the class. Stable across modules. */
export function privateName(name: string, reference: Reference): string {
  return name.startsWith('_')
    ? '_dart_' + createHash('sha256').update(library(reference)).digest('hex').slice(0, 16) + name
    : name;
}

export class ClassModel {
  readonly classes: Map<string, ClassDeclaration>;
  readonly sourceMixins = new Set<string>();
  readonly sourceEnums = new Set<string>();
  readonly ordered: ClassDeclaration[] = [];
  constructor(declarations: Declaration[]) {
    this.classes = new Map(
      declarations
        .filter((n): n is ClassDeclaration => n.kind === 'class')
        .map((n) => [n.reference.id, n]),
    );
    for (const n of this.classes.values()) if (n.mixinClass) this.sourceMixins.add(n.reference.id);
    for (const n of declarations)
      if (n.kind === 'mixin') {
        if (
          n.typeParameters?.length ||
          n.onConstraints?.length ||
          n.interfaces?.length ||
          n.fields?.length ||
          n.methods.some((method) => method.static)
        )
          throw new BlockedSemantic(
            'Generic/constrained/stateful/static source mixin requires a qualified application lowering: ' +
              n.reference.id,
          );
        this.sourceMixins.add(n.reference.id);
        this.classes.set(n.reference.id, {
          ...n,
          kind: 'class',
          abstract: true,
          typeParameters: [],
          fields: [],
          constructor: {
            parameters: [],
            assertions: [],
            body: null,
            const: false,
            offset: n.offset,
            length: 0,
          },
        });
      }
    for (const n of declarations)
      if (n.kind === 'enum' && (n.methods?.length || n.fields?.length || n.mixins?.length)) {
        this.sourceEnums.add(n.reference.id);
        this.classes.set(n.reference.id, {
          kind: 'class',
          name: n.name,
          reference: n.reference,
          offset: n.offset,
          length: n.length,
          typeParameters: [],
          fields: n.fields ?? [],
          methods: n.methods ?? [],
          constructor: {
            parameters: [],
            assertions: [],
            body: null,
            const: false,
            offset: n.offset,
            length: 0,
          },
        });
      }
    const visiting = new Set<string>(),
      visited = new Set<string>();
    const visit = (n: ClassDeclaration) => {
      if (visited.has(n.reference.id)) return;
      if (visiting.has(n.reference.id))
        throw new BlockedSemantic('Cyclic generated inheritance: ' + n.reference.id);
      visiting.add(n.reference.id);
      const parent = this.parent(n);
      if (parent) visit(parent);
      visiting.delete(n.reference.id);
      visited.add(n.reference.id);
      this.ordered.push(n);
    };
    for (const n of this.classes.values()) visit(n);
    for (const n of this.ordered) {
      const inherited = this.ancestors(n)
        .slice(1)
        .flatMap((parent) => parent.fields.filter((field) => !field.static));
      for (const member of [...n.fields, ...(n.methods ?? [])])
        if (!('static' in member && member.static)) {
          const storage = inherited.filter(
            (field) =>
              privateName(field.name, field.reference) ===
              privateName(member.name, member.reference),
          );
          if (
            storage.length &&
            (!('getter' in member && member.getter && !member.setter) ||
              storage.some((field) => !field.final || !field.accessorOverrides?.length))
          )
            throw new BlockedSemantic(
              'Generated inherited field override needs an accessor/storage adapter: ' +
                member.reference.id,
            );
        }
      const inheritedMethods = this.ancestors(n)
        .slice(1)
        .flatMap((parent) => parent.methods ?? []);
      for (const field of n.fields.filter((field) => !field.static)) {
        const accessors = inheritedMethods.filter(
          (method) =>
            !method.static &&
            (method.getter || method.setter) &&
            privateName(method.name, method.reference) === privateName(field.name, field.reference),
        );
        const expected = [...new Set(accessors.map((method) => method.reference.id))].sort(),
          actual = (field.accessorOverrides ?? []).map((ref) => ref.id).sort();
        if (JSON.stringify(actual) !== JSON.stringify(expected))
          throw new BlockedSemantic(
            'Source field requires every exact owned inherited accessor: ' + field.reference.id,
          );
        if (field.final && accessors.some((method) => method.setter))
          throw new BlockedSemantic(
            'Final source field cannot implement an inherited setter: ' + field.reference.id,
          );
      }
      for (const method of n.methods ?? [])
        if (
          (method.getter || method.setter) &&
          inheritedMethods.some(
            (base) => base.name === method.name && Boolean(base.getter) !== Boolean(method.getter),
          ) &&
          !(n.methods ?? []).some(
            (other) =>
              other.name === method.name && Boolean(other.getter) !== Boolean(method.getter),
          )
        )
          throw new BlockedSemantic(
            'Partial accessor override needs forwarding of the inherited accessor: ' +
              method.reference.id,
          );
    }
  }
  parent(n: ClassDeclaration): ClassDeclaration | undefined {
    const mixed = this.mixinParent(n);
    if (mixed) return mixed;
    return n.superclass?.type.kind === 'interface'
      ? this.classes.get(n.superclass.type.reference.id)
      : undefined;
  }
  /** A stateless, unconstrained source mixin on Object is a generated base body. */
  mixinParent(n: ClassDeclaration): ClassDeclaration | undefined {
    if (!n.mixins?.some((t) => t.kind === 'interface' && this.sourceMixins.has(t.reference.id)))
      return;
    const mixin = n.mixins[0],
      base = n.superclass;
    if (
      n.mixins.length !== 1 ||
      mixin?.kind !== 'interface' ||
      mixin.nullable ||
      mixin.arguments.length ||
      !this.sourceMixins.has(mixin.reference.id) ||
      base?.type.kind !== 'interface' ||
      base.type.reference.id !== 'dart:core::Object:CLASS' ||
      base.type.nullable ||
      base.type.arguments.length ||
      base.constructor.id !== 'dart:core::Object.Object.new:CONSTRUCTOR' ||
      base.args?.length
    )
      throw new BlockedSemantic(
        'Generated stateless mixin requires one monomorphic application on the resolved empty Object constructor',
      );
    const owner = this.classes.get(mixin.reference.id)!;
    if (
      owner.mixinClass &&
      (owner.typeParameters.length ||
        owner.fields.length ||
        owner.interfaces?.length ||
        owner.superclass ||
        owner.mixins?.length ||
        owner.constructor.parameters.length ||
        owner.constructor.body ||
        owner.methods?.some((method) => method.static))
    )
      throw new BlockedSemantic(
        'Stateful/generic/constrained mixin class application requires qualified application lowering: ' +
          owner.reference.id,
      );
    return owner;
  }
  ancestors(n: ClassDeclaration): ClassDeclaration[] {
    const parent = this.parent(n);
    return [n, ...(parent ? this.ancestors(parent) : [])];
  }
  member(
    reference: Reference,
    n?: ClassDeclaration | null,
  ): ClassField | NonNullable<ClassDeclaration['methods']>[number] | undefined {
    const scope = n ? this.ancestors(n) : [...this.classes.values()];
    return scope
      .flatMap((c) => [...c.fields, ...(c.methods ?? [])])
      .find((member) => memberKey(member.reference) === memberKey(reference));
  }
  /** JS cannot commit derived fields before super(). Prove generated base
   * constructors neither publish this nor invoke overridable behavior. Host
   * constructors require the explicit equivalent recipe contract. */
  assertSafeBase(
    n: ClassDeclaration,
    constants?: Record<string, number | string | boolean | null>,
  ): void {
    // A projected field is an overridable accessor in JS as well as Dart.
    // Reading it in a base constructor can observe a derived source getter.
    const fields = new Set(
      this.ancestors(n).flatMap((c) =>
        c.fields
          .filter((field) => !field.accessorOverrides?.length)
          .map((field) => memberKey(field.reference)),
      ),
    );
    const inspect = (value: unknown): void => {
      if (Array.isArray(value)) {
        value.forEach(inspect);
        return;
      }
      if (!value || typeof value !== 'object') return;
      const conditional = value as {
        kind?: string;
        test?: Expression;
        then?: unknown;
        else?: unknown;
      };
      if (conditional.kind === 'if' && conditional.test) {
        const test = conditional.test,
          constant =
            test.kind === 'literal'
              ? test.value
              : (test.kind === 'identifier' || test.kind === 'property') && test.reference
                ? constants?.[test.reference.id]
                : undefined;
        if (typeof constant === 'boolean') {
          inspect(constant ? conditional.then : conditional.else);
          return;
        }
      }
      const node = value as Expression;
      if (node.kind === 'this' || node.kind === 'super')
        throw new BlockedSemantic(
          'Base constructor may expose derived state before initialization: ' + n.reference.id,
        );
      if (
        node.kind === 'identifier' &&
        node.reference?.owner &&
        !node.reference.static &&
        !node.reference.local &&
        !fields.has(memberKey(node.reference))
      )
        throw new BlockedSemantic(
          'Base constructor may dispatch an override before derived initialization: ' +
            node.reference.id,
        );
      if (
        node.kind === 'property' &&
        node.target.kind === 'this' &&
        node.reference &&
        fields.has(memberKey(node.reference))
      )
        return;
      if (node.kind === 'call' && node.reference?.owner && !node.reference.static)
        throw new BlockedSemantic(
          'Base constructor instance dispatch needs a construction adapter: ' + node.reference.id,
        );
      Object.entries(value)
        .filter(([key]) => !['reference', 'numeric', 'resolvedType'].includes(key))
        .forEach(([, child]) => inspect(child));
    };
    inspect(n.constructor.body);
    const parent = this.parent(n);
    if (parent) this.assertSafeBase(parent, constants);
  }
}
