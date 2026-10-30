/** Stable versions only. Ranges use exact versions or conjunctions of comparisons. */
function parse(value: string, tool = false): readonly number[] {
  const match = (
    tool
      ? /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\.(0|[1-9]\d*))?$/
      : /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
  ).exec(value);
  if (!match) throw new Error(`Invalid stable version: ${value}`);
  const parts = match
    .slice(1)
    .filter((part) => part !== undefined)
    .map(Number);
  if (parts.some((part) => !Number.isSafeInteger(part)))
    throw new Error(`Invalid stable version: ${value}`);
  return parts;
}
function compare(left: readonly number[], right: readonly number[]): number {
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const l = left[index] ?? 0,
      r = right[index] ?? 0;
    if (l !== r) return l < r ? -1 : 1;
  }
  return 0;
}
export function matchesVersion(version: string, range: string): boolean {
  return matches(version, range, false);
}
export function matchesToolVersion(version: string, range: string): boolean {
  return matches(version, range, true);
}
function matches(version: string, range: string, tool: boolean): boolean {
  const actual = parse(version, tool);
  if (typeof range !== 'string' || !range || range.trim() !== range)
    throw new Error('Invalid version range');
  return range
    .split(/ +/)
    .map((term) => {
      const match = /^(>=|<=|>|<|=)?([0-9.]+)$/.exec(term);
      if (!match) throw new Error(`Invalid version range: ${range}`);
      const result = compare(actual, parse(match[2]!, tool));
      switch (match[1] ?? '=') {
        case '>=':
          return result >= 0;
        case '<=':
          return result <= 0;
        case '>':
          return result > 0;
        case '<':
          return result < 0;
        default:
          return result === 0;
      }
    })
    .every(Boolean);
}
