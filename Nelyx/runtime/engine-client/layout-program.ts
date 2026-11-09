// SPDX-License-Identifier: BSD-3-Clause
import type {
  NativeLayoutProgram,
  NativeLayoutScalar,
} from '@nelyx/core/framework/rendering/object';
import { protocol as p } from './schema.ts';
const modes = ['layout', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight'] as const;
const kinds = [
  'set',
  'layout',
  'query',
  'position',
  'size',
  'baseline',
  'assert',
  'result',
  'scale',
  'paintValue',
  'hitRoute',
  'hitProjection',
  'hitSelf',
  'semanticsRect',
] as const;
const operations = [
  'constant',
  'input',
  'unbounded',
  'variable',
  'add',
  'subtract',
  'multiply',
  'divide',
  'min',
  'max',
  'clamp',
  'less',
  'lessEqual',
  'greater',
  'greaterEqual',
  'equal',
  'select',
  'finite',
] as const;
const arities = [0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 3, 2, 2, 2, 2, 2, 3, 1];
export function layoutProgramBytes(program?: NativeLayoutProgram): Uint8Array {
  if (!program) return new Uint8Array();
  if (program.forwardHitTest !== undefined && typeof program.forwardHitTest !== 'boolean')
    throw Error('Invalid native layout hit order');
  if (
    !Number.isInteger(program.children) ||
    program.children < 0 ||
    program.children > p.limits.layoutProgramChildren
  )
    throw Error('Native layout child budget');
  const expressions: { op: number; a: number; b: number; c: number; value: number }[] = [],
    memo = new Map<NativeLayoutScalar, number>(),
    structural = new Map<string, number>();
  const read = (value: NativeLayoutScalar, depth = 0): number => {
    if (depth > 64) throw Error('Native layout expression depth');
    const known = memo.get(value);
    if (known !== undefined) return known;
    const op = typeof value === 'number' ? 0 : operations.indexOf(value.op);
    if (op < 0) throw Error('Unknown native layout operation');
    const args = typeof value === 'number' ? [] : (value.args ?? []);
    if (args.length !== arities[op]) throw Error('Invalid native layout expression arity');
    const operands = args.map((argument) => read(argument, depth + 1));
    const index = typeof value === 'number' ? 0 : (value.index ?? 0);
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= (op === 1 ? 5 : op === 3 ? p.limits.layoutProgramVariables : 1)
    )
      throw Error('Invalid native layout variable/input');
    if (typeof value === 'number' && (!Number.isFinite(value) || Math.abs(value) > 1e12))
      throw Error('Invalid native layout constant');
    const expression = {
      op,
      a: op === 1 || op === 3 ? index : (operands[0] ?? 0),
      b: operands[1] ?? 0,
      c: operands[2] ?? 0,
      value: typeof value === 'number' ? value : 0,
    };
    const signature = [
        expression.op,
        expression.a,
        expression.b,
        expression.c,
        Object.is(expression.value, -0) ? '-0' : expression.value,
      ].join(','),
      shared = structural.get(signature);
    if (shared !== undefined) {
      memo.set(value, shared);
      return shared;
    }
    const reference = expressions.length;
    if (reference >= p.limits.layoutProgramExpressions)
      throw Error('Native layout expression budget');
    expressions.push(expression);
    structural.set(signature, reference);
    memo.set(value, reference);
    return reference;
  };
  const ranges: { begin: number; count: number }[] = [],
    commands: {
      kind: number;
      child: number;
      target: number;
      query: number;
      refs: number[];
      condition: number;
    }[] = [];
  for (const mode of modes) {
    const source = program[mode];
    if (!Array.isArray(source) || !source.length) throw Error('Native layout mode is missing');
    ranges.push({ begin: commands.length, count: source.length });
    for (const command of source) {
      const kind = kinds.indexOf(command.kind),
        child = command.child ?? 0,
        target = command.target ?? 0,
        query = command.query ? modes.indexOf(command.query) : 0;
      if (kind < 0 || command.values.length !== [1, 4, 1, 2, 2, 4, 1, 1, 2, 1, 4, 4, 4, 4][kind])
        throw Error('Invalid native layout command');
      if (
        !Number.isInteger(child) ||
        child < 0 ||
        (kind === 1 || kind === 2 || kind === 3 || kind === 8 || kind === 10 || kind === 11
          ? child >= program.children
          : child !== 0)
      )
        throw Error('Invalid native layout child');
      if (
        !Number.isInteger(target) ||
        target < 0 ||
        (kind === 0 || kind === 1 || kind === 2
          ? target > p.limits.layoutProgramVariables - (kind === 1 ? 6 : 1)
          : kind === 9
            ? target >= p.limits.layoutProgramPaintValues
            : target !== 0)
      )
        throw Error('Invalid native layout target');
      if (kind === 2 ? query < 1 || query > 4 : query !== 0)
        throw Error('Invalid native layout child query');
      if (command.when !== undefined && kind !== 2)
        throw Error('Only native layout queries may be conditional');
      commands.push({
        kind: kind + 1,
        child,
        target,
        query,
        refs: command.values.map((value: NativeLayoutScalar) => read(value)),
        condition: command.when === undefined ? 0 : read(command.when) + 1,
      });
    }
  }
  if (commands.length > p.limits.layoutProgramCommands) throw Error('Native layout command budget');
  const bytes = new Uint8Array(
      p.layoutProgramHeaderBytes +
        expressions.length * p.layoutProgramExpressionBytes +
        commands.length * p.layoutProgramCommandBytes,
    ),
    view = new DataView(bytes.buffer);
  view.setUint32(0, program.children, true);
  view.setUint32(
    4,
    (program.forwardHitTest ? 1 : 0) | (commands.some((command) => command.kind >= 11) ? 2 : 0),
    true,
  );
  view.setUint32(8, expressions.length, true);
  view.setUint32(12, commands.length, true);
  ranges.forEach((range, index) => {
    view.setUint32(16 + index * 8, range.begin, true);
    view.setUint32(20 + index * 8, range.count, true);
  });
  expressions.forEach((expression, index) => {
    const at = p.layoutProgramHeaderBytes + index * p.layoutProgramExpressionBytes;
    [expression.op, expression.a, expression.b, expression.c].forEach((value, i) =>
      view.setUint32(at + i * 4, value, true),
    );
    view.setFloat64(at + 16, expression.value, true);
  });
  commands.forEach((command, index) => {
    const at =
      p.layoutProgramHeaderBytes +
      expressions.length * p.layoutProgramExpressionBytes +
      index * p.layoutProgramCommandBytes;
    [command.kind, command.child, command.target, command.query, ...command.refs].forEach(
      (value, i) => view.setUint32(at + i * 4, value, true),
    );
    view.setUint32(at + 32, command.condition, true);
  });
  return bytes;
}
