// SPDX-License-Identifier: BSD-3-Clause
// Fixture-only, synchronous attribution. Categories overlap and must not be
// added; self wall subtracts nested calls in the SAME category only.
export class RnwWorkProbe {
  constructor(now) {
    this.now = now;
    this.restores = [];
    this.active = null;
    this.errors = 0;
  }
  timestamp() {
    try {
      return this.now();
    } catch {
      return NaN;
    }
  }
  wrap(target, method, category, label = (value) => value.constructor.name) {
    const original = target?.[method],
      probe = this;
    if (typeof original !== 'function') throw Error(`Missing diagnostic method ${method}`);
    const own = Object.getOwnPropertyDescriptor(target, method);
    const wrapped = function (...args) {
      const active = probe.active;
      if (!active) return original.apply(this, args);
      const start = probe.timestamp(),
        parent = active.stack.get(category),
        scope = { child: 0 };
      active.stack.set(category, scope);
      try {
        return original.apply(this, args);
      } finally {
        active.stack.set(category, parent);
        try {
          const wall = probe.timestamp() - start;
          if (!Number.isFinite(wall) || wall < 0) probe.errors++;
          else {
            if (parent) parent.child += wall;
            const group = (active.groups[category] ??= {
              count: 0,
              total: 0,
              max: 0,
              names: Object.create(null),
            });
            group.count++;
            if (!parent) group.total += wall;
            group.max = Math.max(group.max, wall);
            let name = String(label(this, args)).slice(0, 80);
            if (!Object.hasOwn(group.names, name) && Object.keys(group.names).length >= 23)
              name = 'other';
            const row = (group.names[name] ??= [0, 0, 0, 0]);
            row[0]++;
            row[1] += wall;
            row[2] += Math.max(0, wall - scope.child);
            row[3] = Math.max(row[3], wall);
          }
        } catch {
          probe.errors++;
        }
      }
    };
    target[method] = wrapped;
    this.restores.push(() => {
      if (target[method] !== wrapped) return;
      if (own) Object.defineProperty(target, method, own);
      else delete target[method];
    });
  }
  begin() {
    this.active = { groups: {}, stack: new Map() };
  }
  finish() {
    const active = this.active;
    this.active = null;
    if (!active) return null;
    for (const group of Object.values(active.groups)) {
      const names = Object.entries(group.names).sort((a, b) => b[1][2] - a[1][2]);
      group.omittedNames = Math.max(0, names.length - 4);
      group.names = Object.fromEntries(names.slice(0, 4));
    }
    return active.groups;
  }
  dispose() {
    this.active = null;
    for (const restore of this.restores.reverse()) restore();
    this.restores.length = 0;
  }
}
