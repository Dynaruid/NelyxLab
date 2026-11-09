// SPDX-License-Identifier: BSD-3-Clause
/** Module-owned numeric policy. Only Content evaluates dimensions or measures children. */
export type NativeLayoutScalar =
  | number
  | {
      readonly op:
        | 'input'
        | 'unbounded'
        | 'variable'
        | 'add'
        | 'subtract'
        | 'multiply'
        | 'divide'
        | 'min'
        | 'max'
        | 'clamp'
        | 'less'
        | 'lessEqual'
        | 'greater'
        | 'greaterEqual'
        | 'equal'
        | 'select'
        | 'finite';
      readonly index?: number;
      readonly args?: readonly NativeLayoutScalar[];
    };
export interface NativeLayoutCommand {
  readonly kind:
    | 'set'
    | 'layout'
    | 'query'
    | 'position'
    | 'size'
    | 'baseline'
    | 'assert'
    | 'result'
    | 'scale'
    | 'paintValue'
    | 'hitRoute'
    | 'hitProjection'
    | 'hitSelf'
    | 'semanticsRect';
  readonly child?: number;
  readonly target?: number;
  readonly query?: 'minWidth' | 'maxWidth' | 'minHeight' | 'maxHeight';
  /** Only queries may be skipped; a skipped query defines its result as zero. */
  readonly when?: NativeLayoutScalar;
  readonly values: readonly NativeLayoutScalar[];
}
export interface NativeLayoutProgram {
  readonly children: number;
  readonly forwardHitTest?: boolean;
  readonly layout: readonly NativeLayoutCommand[];
  readonly minWidth: readonly NativeLayoutCommand[];
  readonly maxWidth: readonly NativeLayoutCommand[];
  readonly minHeight: readonly NativeLayoutCommand[];
  readonly maxHeight: readonly NativeLayoutCommand[];
}
export const nativeLayoutInput = Object.freeze({
  minWidth: { op: 'input', index: 0 },
  maxWidth: { op: 'input', index: 1 },
  minHeight: { op: 'input', index: 2 },
  maxHeight: { op: 'input', index: 3 },
  extent: { op: 'input', index: 4 },
  unbounded: { op: 'unbounded' },
} satisfies Record<string, NativeLayoutScalar>);
export function nativeLayoutExpression(
  op: Exclude<Exclude<NativeLayoutScalar, number>['op'], 'input' | 'variable' | 'unbounded'>,
  ...args: readonly NativeLayoutScalar[]
): NativeLayoutScalar {
  return { op, args };
}
/** Records declarations; this builder never receives native geometry or calls a RenderBox. */
export class NativeLayoutBuilder {
  readonly commands: NativeLayoutCommand[] = [];
  private next = 0;
  private variables(count: number): NativeLayoutScalar[] {
    if (this.next + count > 128) throw Error('Native layout variable budget');
    return Array.from({ length: count }, () => ({ op: 'variable', index: this.next++ }));
  }
  value(value: NativeLayoutScalar): NativeLayoutScalar {
    const [reference] = this.variables(1);
    this.commands.push({
      kind: 'set',
      target: (reference as Exclude<NativeLayoutScalar, number>).index!,
      values: [value],
    });
    return reference!;
  }
  child(
    child: number,
    bounds: readonly [
      NativeLayoutScalar,
      NativeLayoutScalar,
      NativeLayoutScalar,
      NativeLayoutScalar,
    ],
  ) {
    const [width, height, baseline, ideographicBaseline, hasBaseline, hasIdeographicBaseline] =
      this.variables(6);
    this.commands.push({
      kind: 'layout',
      child,
      target: (width as Exclude<NativeLayoutScalar, number>).index!,
      values: bounds,
    });
    return {
      width: width!,
      height: height!,
      baseline: baseline!,
      ideographicBaseline: ideographicBaseline!,
      hasBaseline: hasBaseline!,
      hasIdeographicBaseline: hasIdeographicBaseline!,
    };
  }
  query(
    child: number,
    query: NonNullable<NativeLayoutCommand['query']>,
    extent: NativeLayoutScalar,
    when?: NativeLayoutScalar,
  ): NativeLayoutScalar {
    const [reference] = this.variables(1);
    this.commands.push({
      kind: 'query',
      child,
      query,
      target: (reference as Exclude<NativeLayoutScalar, number>).index!,
      values: [extent],
      ...(when === undefined ? {} : { when }),
    });
    return reference!;
  }
  place(child: number, x: NativeLayoutScalar, y: NativeLayoutScalar): void {
    this.commands.push({ kind: 'position', child, values: [x, y] });
  }
  scale(child: number, x: NativeLayoutScalar, y: NativeLayoutScalar): void {
    this.commands.push({ kind: 'scale', child, values: [x, y] });
  }
  /** Bounded Content-owned results consumed by a paint entry referencing this box. */
  paintValue(index: number, value: NativeLayoutScalar): void {
    this.commands.push({ kind: 'paintValue', target: index, values: [value] });
  }
  /** First matching route in hit order selects one child. Route rectangles
   * include shared edges; the containing render box still uses half-open bounds.
   * Projection maps the collected parent-local point into that child's local
   * space. The retained contact keeps that point, including zero-axis maps. */
  hitRoute(
    child: number,
    rect: readonly [NativeLayoutScalar, NativeLayoutScalar, NativeLayoutScalar, NativeLayoutScalar],
    projection: readonly [
      NativeLayoutScalar,
      NativeLayoutScalar,
      NativeLayoutScalar,
      NativeLayoutScalar,
    ],
  ): void {
    this.commands.push({ kind: 'hitRoute', child, values: rect });
    // x' = xScale*x + xOffset; y' = yScale*y + yOffset. Zero scales are valid.
    this.commands.push({ kind: 'hitProjection', child, values: projection });
  }
  /** Overrides self admission with the union of these half-open rectangles. */
  hitSelf(
    rect: readonly [NativeLayoutScalar, NativeLayoutScalar, NativeLayoutScalar, NativeLayoutScalar],
  ): void {
    this.commands.push({ kind: 'hitSelf', values: rect });
  }
  semanticsRect(
    rect: readonly [NativeLayoutScalar, NativeLayoutScalar, NativeLayoutScalar, NativeLayoutScalar],
  ): void {
    this.commands.push({ kind: 'semanticsRect', values: rect });
  }
  size(width: NativeLayoutScalar, height: NativeLayoutScalar): void {
    this.commands.push({ kind: 'size', values: [width, height] });
  }
  baseline(
    alphabetic: NativeLayoutScalar,
    hasAlphabetic: NativeLayoutScalar,
    ideographic: NativeLayoutScalar,
    hasIdeographic: NativeLayoutScalar,
  ): void {
    this.commands.push({
      kind: 'baseline',
      values: [alphabetic, hasAlphabetic, ideographic, hasIdeographic],
    });
  }
  assert(value: NativeLayoutScalar): void {
    this.commands.push({ kind: 'assert', values: [value] });
  }
  result(value: NativeLayoutScalar): void {
    this.commands.push({ kind: 'result', values: [value] });
  }
}
