// SPDX-License-Identifier: BSD-3-Clause
// Explicit installed-VM diagnostic, outside the measured frame callbacks.
export function verifyRetainedGeometryApi(api, owner, metrics) {
  const Array64 = globalThis.Float64Array,
    sessions = [];
  let sequence = 700000,
    result;
  const errors = [];
  const open = () => {
      const id = ++sequence,
        native = api.nelyxRetainedInputGeometrySession(id, owner.generation);
      sessions.push(native);
      return { id, native };
    },
    packet = (id, revision = 1, base = 0) =>
      Array64.of(
        0x4e4c5247,
        1,
        id,
        owner.generation,
        revision,
        metrics.viewportGeneration,
        metrics.nativeSurfaceGeneration ?? -1,
        metrics.scale,
        metrics.logicalWidth,
        metrics.logicalHeight,
        0,
        0,
        0,
        20,
        0,
        base,
        0,
        0,
        0,
        0,
      ),
    expectFailure = (work) => {
      let failed = false;
      try {
        work();
      } catch {
        failed = true;
      }
      if (!failed) throw Error('Retained JSI accepted a stale/reentrant/malformed operation');
    };
  try {
    const { id, native } = open(),
      input = packet(id),
      projection = new Array64(native.prepare(input.buffer));
    native.commit(1);
    expectFailure(() => native.commit(1));
    expectFailure(() => native.prepare(input.buffer));
    input[4] = 2;
    input[15] = 1;
    native.prepare(input.buffer);
    native.discard(2);
    native.prepare(input.buffer);
    native.commit(2);
    if (projection[4] !== 1) throw Error('Retained JSI overwrote an earlier VM-owned result');
    const reentrant = open();
    let rejected = false;
    globalThis.Float64Array = function (length) {
      try {
        reentrant.native.prepare(packet(reentrant.id).buffer);
      } catch {
        rejected = true;
      }
      return new Array64(length);
    };
    reentrant.native.prepare(packet(reentrant.id).buffer);
    globalThis.Float64Array = Array64;
    if (!rejected) throw Error('Retained JSI allowed nested preparation');
    reentrant.native.discard(1);
    const closing = open();
    globalThis.Float64Array = function (length) {
      closing.native.close();
      return new Array64(length);
    };
    expectFailure(() => closing.native.prepare(packet(closing.id).buffer));
    globalThis.Float64Array = Array64;
    const allocating = open();
    globalThis.Float64Array = function () {
      throw Error('diagnostic allocation failure');
    };
    expectFailure(() => allocating.native.prepare(packet(allocating.id).buffer));
    globalThis.Float64Array = Array64;
    allocating.native.prepare(packet(allocating.id).buffer);
    allocating.native.discard(1);
    result = {
      status: 'PASS-scoped',
      cases: 4,
      scope:
        'installed JSI transaction, reentry, allocation rollback and VM-owned results; no timing/scanout claim',
    };
  } catch (error) {
    errors.push(error);
  } finally {
    globalThis.Float64Array = Array64;
    for (const native of sessions) {
      try {
        native.close();
        const stats = new Array64(native.stats());
        if (stats[5] !== 1 || stats.some((value, index) => index !== 5 && value !== 0))
          errors.push(Error('Retained JSI metadata survived close'));
      } catch (error) {
        errors.push(error);
      }
    }
  }
  if (errors.length)
    throw new AggregateError(errors, 'Installed retained geometry JSI diagnostic failed');
  return result;
}
