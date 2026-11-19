// SPDX-License-Identifier: BSD-3-Clause
import { expect, test } from 'bun:test';
import { emitDart } from './dart-emitter.ts';
import type { Argument, Declaration, ModuleRecipe, Reference } from './body-ir.ts';

const library = 'package:flutter/src/widgets/framework.dart';
const host = '@nelyx/core/framework/widgets/framework';
const reference = (id: string, name: string, owner: string | null = null): Reference => ({
  id,
  name,
  owner,
  local: false,
  static: false,
});
const base = reference(`${library}::StatelessWidget:CLASS`, 'StatelessWidget');
const constructor = reference(
  `${library}::StatelessWidget.StatelessWidget.new:CONSTRUCTOR`,
  '',
  'StatelessWidget',
);
const location = { offset: 0, length: 1 };
const declaration: Declaration = {
  ...location,
  kind: 'class',
  name: 'ProbeWidget',
  reference: reference('fixture.dart::ProbeWidget:CLASS', 'ProbeWidget'),
  abstract: true,
  superclass: {
    type: { kind: 'interface', reference: base, arguments: [], nullable: false },
    constructor,
    implicit: false,
    args: [{ name: 'key', value: { ...location, kind: 'literal', value: null, type: 'Null' } }],
  },
  typeParameters: [],
  fields: [],
  constructor: { ...location, parameters: [], assertions: [], const: false },
};
const recipe: ModuleRecipe = {
  source: 'fixture.dart',
  sha256: '0'.repeat(64),
  symbols: ['ProbeWidget'],
  destination: 'probe.ts',
  imports: { StatelessWidget: host },
  typeBindings: { [base.id]: 'StatelessWidget' },
  superConstructors: {
    [constructor.id]: {
      target: 'StatelessWidget',
      policy: 'no-derived-state-observation',
      namedArguments: 'core-widget-key',
    },
  },
};

test('forwards the exact Flutter key argument to the positional Core constructor', () => {
  expect(emitDart([declaration], recipe)).toContain('super(null);');
  const baseCall = declaration.superclass!;
  expect(emitDart([{ ...declaration, superclass: { ...baseCall, args: [] } }], recipe)).toContain(
    'super();',
  );
  expect(() =>
    emitDart([declaration], { ...recipe, imports: { StatelessWidget: './other.ts' } }),
  ).toThrow('exact key-only base constructor');
  expect(() =>
    emitDart(
      [
        {
          ...declaration,
          superclass: { ...baseCall, args: [{ ...baseCall.args![0]!, name: 'child' }] },
        },
      ],
      recipe,
    ),
  ).toThrow('exact key-only base constructor');
}, 1_200_000);

test('lowers named child/key without reordering observable reads', () => {
  const emit = (name: string, args: Argument[]) => {
    const theme = name === 'InheritedTheme';
    const ownerLibrary = theme ? 'package:flutter/src/widgets/inherited_theme.dart' : library;
    const targetModule = theme ? '@nelyx/core/framework/widgets/inherited-theme' : host;
    const resolved = reference(`${ownerLibrary}::${name}:CLASS`, name);
    const ctor = reference(`${ownerLibrary}::${name}.${name}.new:CONSTRUCTOR`, '', name);
    return emitDart(
      [
        {
          ...declaration,
          superclass: {
            type: { kind: 'interface', reference: resolved, arguments: [], nullable: false },
            constructor: ctor,
            implicit: false,
            args,
          },
        },
      ],
      {
        ...recipe,
        imports: { [name]: targetModule },
        typeBindings: { [resolved.id]: name },
        superConstructors: {
          [ctor.id]: {
            target: name,
            policy: 'no-derived-state-observation',
            namedArguments: 'core-widget-child',
          },
        },
      },
    );
  };
  const key = declaration.superclass!.args![0]!;
  const child = { ...key, name: 'child' };
  expect(emit('InheritedTheme', [child, key])).toContain('super(null, null);');
  expect(emit('ProxyWidget', [key, child])).toContain('super(null, { key: null });');
  expect(emit('SingleChildRenderObjectWidget', [key])).toContain('super(void 0, { key: null });');
  expect(() => emit('InheritedTheme', [key])).toThrow('exact child/key base constructor');
  const effectful: Argument = {
    name: 'child',
    value: {
      ...location,
      type: 'Widget',
      kind: 'property',
      target: key.value,
      targetType: 'Object',
      name: 'widget',
      reference: null,
    },
  };
  expect(() => emit('ProxyWidget', [key, effectful])).toThrow(
    'cannot reorder effectful super arguments',
  );
}, 1_200_000);
