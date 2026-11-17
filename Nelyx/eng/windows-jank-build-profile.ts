// Inlined only for an explicit diagnostic run. It does not enter the ordinary
// probe entry, and runs with this observer are excluded from FPS comparisons.
export function installBuildProfile(root, host, active) {
  const children = installChildReuseProfile(root, host, active),
    work = installFrameworkWorkProfile(root, host, active);
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
      children.reset();
      work.reset();
    },
    snapshot() {
      if (invalid || names.length || scopeDepth) throw Error('Build profile snapshot incomplete');
      return {
        scopes,
        types: [...values].sort((a, b) => b[1].totalMs - a[1].totalMs),
        children: children.snapshot(),
        work: work.snapshot(),
      };
    },
    log(name, text, stages) {
      const { scopes, types, children, work } = this.snapshot(),
        { pages, events, ...childSummary } = children;
      // NativeHost.log truncates at 8,192 UTF-8 bytes. Keep every record below
      // that bound even for non-ASCII constructor names; never lose a JSON tail.
      const emit = (prefix, value) => {
        const line = prefix + ' ' + JSON.stringify(value);
        if (line.length > 2700) throw Error('Build profile log record exceeds native bound');
        host.log(line);
      };
      emit('FAST_BUILD_PROFILE', { name, scopes, text, stages });
      emit('FAST_FRAMEWORK_PROFILE', { name, scope: work.scope, counters: work.counters });
      for (const [kind, value] of Object.entries(work.intervals))
        emit('FAST_FRAMEWORK_INTERVAL', { name, kind, ...value });
      for (let index = 0; index < types.length; index += 8)
        emit('FAST_BUILD_TYPES', { name, index, types: types.slice(index, index + 8) });
      emit('FAST_CHILD_PROFILE', {
        name,
        ...childSummary,
        pageCount: pages.length,
        eligiblePages: pages.filter((page) => page.eligible).length,
        eventCount: events.length,
      });
      for (const page of pages) emit('FAST_CHILD_PAGE', { name, ...page });
      for (let index = 0; index < events.length; index += 16)
        emit('FAST_CHILD_EVENTS', { name, index, events: events.slice(index, index + 16) });
    },
    dispose() {
      work.dispose();
      children.dispose();
      root.buildOwner._setElementBuildObserver(undefined);
      if (previousScope) Object.defineProperty(owner, 'buildScope', previousScope);
      else delete owner.buildScope;
    },
  };
}
