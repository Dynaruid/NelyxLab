// SPDX-License-Identifier: BSD-3-Clause
// Diagnostic upper bound before ownership/admission work. Never inspect the
// group or its fragments; a Proxy/getter must not receive a new observation.
export function installSemanticsConflictProfile(prototype, clock) {
  const original = Object.getOwnPropertyDescriptor(prototype, 'markConflicts');
  if (typeof original?.value !== 'function' || !original.configurable)
    throw Error('Semantics conflict diagnostic method differs');
  let current,
    depth = 0,
    disposed = false;
  const wrapper = function (...args) {
    if (!current) return original.value.apply(this, args);
    const frame = current,
      outer = depth === 0,
      merge = args[1] === true;
    const began = outer ? clock() : 0;
    depth++;
    frame.groups++;
    frame[merge ? 'mergeUpGroups' : 'siblingGroups']++;
    frame[outer ? 'outerGroups' : 'nestedGroups']++;
    let failed = true;
    try {
      const result = original.value.apply(this, args);
      failed = false;
      return result;
    } finally {
      depth--;
      frame.failed += Number(failed);
      if (outer) {
        const elapsed = clock() - began;
        if (!Number.isFinite(elapsed) || elapsed < 0) frame.invalidClock = true;
        else {
          frame.outerMs += elapsed;
          frame[merge ? 'mergeUpMs' : 'siblingMs'] += elapsed;
          frame.maxMs = Math.max(frame.maxMs, elapsed);
        }
      }
    }
  };
  Object.defineProperty(prototype, 'markConflicts', { ...original, value: wrapper });
  return {
    beginFrame() {
      if (disposed || current || depth) throw Error('Semantics conflict frame already active');
      current = {
        groups: 0,
        outerGroups: 0,
        nestedGroups: 0,
        mergeUpGroups: 0,
        siblingGroups: 0,
        failed: 0,
        outerMs: 0,
        mergeUpMs: 0,
        siblingMs: 0,
        maxMs: 0,
      };
    },
    endFrame() {
      if (disposed || !current || depth) throw Error('Semantics conflict frame incomplete');
      const result = current;
      current = undefined;
      if (result.invalidClock) throw Error('Semantics conflict diagnostic clock differs');
      return result;
    },
    dispose() {
      if (disposed) return;
      if (Object.getOwnPropertyDescriptor(prototype, 'markConflicts')?.value !== wrapper)
        throw Error('Semantics conflict diagnostic hook replaced');
      Object.defineProperty(prototype, 'markConflicts', original);
      const incomplete = current || depth;
      current = undefined;
      depth = 0;
      disposed = true;
      if (incomplete) throw Error('Semantics conflict frame disposed before completion');
    },
  };
}
