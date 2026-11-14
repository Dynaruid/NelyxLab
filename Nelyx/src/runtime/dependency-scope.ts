// SPDX-License-Identifier: BSD-3-Clause

/** A canonical provider adds one immutable link instead of copying every
 * ancestor's Map. Only framework-owned, stable type tokens enter this index;
 * user-defined live tokens keep the Element ancestor lookup path. */
export class DependencyScope<T extends object> {
  private queries: Map<object, T> | undefined;
  private missing: Set<object> | undefined;
  constructor(
    readonly parent: DependencyScope<T> | undefined,
    readonly token: object,
    readonly value: T,
  ) {}
  get(token: object): T | undefined {
    if (this.token === token) return this.value;
    const cached = this.queries?.get(token);
    if (cached !== undefined) return cached;
    if (this.missing?.has(token)) return undefined;
    let found: T | undefined;
    for (let scope = this.parent; scope; scope = scope.parent) {
      if (scope.token === token) {
        found = scope.value;
        break;
      }
      const known = scope.queries?.get(token);
      if (known !== undefined) {
        found = known;
        break;
      }
      if (scope.missing?.has(token)) break;
    }
    // A missing optional provider is common at every day cell. Keep those
    // answers separate: successful Theme/Directionality queries must not evict
    // the same misses and repeat the complete immutable ancestor walk. Both
    // tables are bounded independently, including arbitrary missing user types.
    if (found !== undefined) {
      const queries = (this.queries ??= new Map<object, T>());
      if (queries.size === 4) queries.delete(queries.keys().next().value!);
      queries.set(token, found);
    } else {
      const missing = (this.missing ??= new Set<object>());
      if (missing.size === 4) missing.delete(missing.values().next().value!);
      missing.add(token);
    }
    return found;
  }
}
