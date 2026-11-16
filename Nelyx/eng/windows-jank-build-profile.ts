// Inlined only for an explicit diagnostic run. It does not enter the ordinary
// probe entry, and runs with this observer are excluded from FPS comparisons.
export function installBuildProfile(root, host, active) {
  const names = [],
    times = [],
    values = new Map();
  const owner = root.buildOwner,
    buildScope = owner.buildScope,
    previousScope = Object.getOwnPropertyDescriptor(owner, 'buildScope');
  let scopeDepth = 0,
    invalid = false,
    scopes = { count: 0, totalMs: 0, dirtyFlushMs: 0, renderCommitMs: 0 };
  owner.buildScope = function (context, callback, costs) {
    if (!active()) return buildScope.call(this, context, callback, costs);
    const observed = costs ?? { dirtyFlushMs: 0, renderCommitMs: 0 },
      dirty = observed.dirtyFlushMs,
      commit = observed.renderCommitMs,
      began = host.now(),
      outer = scopeDepth++ === 0;
    try {
      return buildScope.call(this, context, callback, observed);
    } finally {
      scopeDepth--;
      if (outer) {
        scopes.count++;
        scopes.totalMs += host.now() - began;
        scopes.dirtyFlushMs += observed.dirtyFlushMs - dirty;
        scopes.renderCommitMs += observed.renderCommitMs - commit;
      }
    }
  };
  root.buildOwner._setElementBuildObserver({
    active,
    begin(element) {
      if (names.length >= 64) {
        invalid = true;
        throw Error('Build profile nesting budget exceeded');
      }
      const token = names.length;
      names.push(element.widget.constructor.name);
      times.push(host.now());
      return token;
    },
    end(token) {
      if (token !== names.length - 1) {
        invalid = true;
        throw Error('Build profile nesting differs');
      }
      const elapsed = host.now() - times.pop(),
        name = names.pop();
      let value = values.get(name);
      if (!value) {
        if (values.size >= 256) {
          invalid = true;
          throw Error('Build profile type budget exceeded');
        }
        values.set(name, (value = { count: 0, totalMs: 0, maxMs: 0 }));
      }
      value.count++;
      value.totalMs += elapsed;
      value.maxMs = Math.max(value.maxMs, elapsed);
    },
  });
  return {
    reset() {
      if (names.length) throw Error('Build profile reset during rebuild');
      values.clear();
      invalid = false;
      scopes = { count: 0, totalMs: 0, dirtyFlushMs: 0, renderCommitMs: 0 };
    },
    snapshot() {
      if (invalid || names.length || scopeDepth) throw Error('Build profile snapshot incomplete');
      return { scopes, types: [...values].sort((a, b) => b[1].totalMs - a[1].totalMs) };
    },
    dispose() {
      root.buildOwner._setElementBuildObserver(undefined);
      if (previousScope) Object.defineProperty(owner, 'buildScope', previousScope);
      else delete owner.buildScope;
    },
  };
}
