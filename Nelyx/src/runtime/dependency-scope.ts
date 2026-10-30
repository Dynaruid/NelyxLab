// SPDX-License-Identifier: BSD-3-Clause

/** A canonical provider adds one immutable link instead of copying every
 * ancestor's Map. Only framework-owned, stable type tokens enter this index;
 * user-defined live tokens keep the Element ancestor lookup path. */
export class DependencyScope<T extends object> {
  private queries: Map<object, T | null> | undefined;
  constructor(
    readonly parent: DependencyScope<T> | undefined,
    readonly token: object,
    readonly value: T,
  ) {}
  get(token: object): T | undefined {
    if (this.token === token) return this.value;
    const cached = this.queries?.get(token);
    if (cached !== undefined) return cached ?? undefined;
    let found: T | undefined;
    for (let scope = this.parent; scope; scope = scope.parent) {
      if (scope.token === token) {
        found = scope.value;
        break;
      }
      const known = scope.queries?.get(token);
      if (known !== undefined) {
        found = known ?? undefined;
        break;
      }
    }
    // Queries may include arbitrarily many missing user types. Bound memoized
    // results independently of provider count, including negative lookups.
    const queries = (this.queries ??= new Map<object, T | null>());
    if (queries.size === 4) queries.delete(queries.keys().next().value!);
    queries.set(token, found ?? null);
    return found;
  }
}
