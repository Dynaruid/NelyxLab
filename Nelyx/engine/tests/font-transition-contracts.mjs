// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  protocol as p,
  EngineClient,
  fontTransitionResourceBytes,
  fontTransitionReadyBytes,
  fontTransitionCommitBytes,
  fontResourceReadBytes,
  readFontResourceSlice,
  fontUploadBeginBytes,
} from '../../runtime/engine-client/index.ts';
import { fontCatalogBytes } from '../../runtime/engine-client/font-catalog.ts';

// Core validates the catalog container. Actual owner face decoding is exercised
// separately with the owned C++ providers, rather than faked by this protocol test.
const catalog = fontCatalogBytes({ fonts: [{ family: 'Transition', bytes: new Uint8Array(16) }] });
async function upload(view, resource, token) {
  await view.beginFontUpload(resource, catalog.length, token);
  await view.appendFontUpload(token, 0, catalog);
  await view.finishFontUpload(token, true);
}
export function fontTransitionContracts({ using, timeout, h }) {
  for (const profile of ['native', 'single-worker', 'threaded']) {
    test(
      `${profile}: SDK views share image/font producer slots and recycle only known releases`,
      { timeout },
      () =>
        using(profile, async (_f, transport) => {
          const client = await EngineClient.connect(transport),
            a = await client.openView(1),
            b = await client.openView(2),
            imageA = a.allocateResource(),
            imageB = b.allocateResource(),
            font = a.allocateResource();
          assert.deepEqual([imageA.slot, imageB.slot, font.slot], [1, 2, 3]);
          const { commands: c } = await import('../../runtime/engine-client/index.ts');
          await a.commit([c.acquireResource(imageA, new Uint8Array([1]))]);
          await b.commit([c.acquireResource(imageB, new Uint8Array([2]))]);
          await upload(a, font, 1n);
          assert.throws(() => b.recycleResource(imageA, false), /Foreign/);
          await a.commit([c.releaseResource(imageA)]);
          a.recycleResource(imageA, true);
          const replacement = b.allocateResource();
          assert.deepEqual(replacement, { slot: 1, generation: 2 });
          assert.throws(() => a.recycleResource(imageA, true), /Foreign|retired/);
          b.recycleResource(replacement, false);
          assert.equal(b.allocateResource(), replacement);
          await b.commit([c.releaseResource(imageB)]);
          b.recycleResource(imageB, true);
          await a.releaseFontResource(font);
          a.recycleResource(font, true);
          const closed = await client.close();
          void closed;
        }),
    );
    test(
      `${profile}: font transition requires every owner, fences input and retries a known commit`,
      { timeout },
      () =>
        using(profile, async (f, transport) => {
          await f.start();
          const client = await EngineClient.connect(transport),
            view = await client.openView(2),
            resource = h(50);
          await upload(view, resource, 1n);
          const begin = (token, target = resource) =>
            f.send(p.opcodes.fontTransitionBegin, fontTransitionResourceBytes(target), {
              id: token,
            });
          const ready = (owner, token = 10n, failure = 0) =>
            f.send(p.opcodes.fontTransitionReady, fontTransitionReadyBytes(owner, failure), {
              id: token,
            });
          const commit = (revision, afterInput = 0n) =>
            f.send(
              p.opcodes.fontTransitionCommit,
              fontTransitionCommitBytes(revision, afterInput),
              { id: 10n },
            );
          assert.equal((await begin(0n)).status, p.statuses.invalidValue);
          assert.equal((await begin(10n)).fontTransition.phase, 'preparing');
          assert.equal((await begin(10n)).fontTransition.ready, 0);
          assert.equal((await begin(10n, null)).status, p.statuses.idReused);
          assert.equal((await begin(9n)).status, p.statuses.stale);
          assert.equal((await begin(11n)).status, p.statuses.busy);
          assert.equal((await ready('render', 9n)).status, p.statuses.stale);
          assert.equal(
            (
              await f.send(p.opcodes.fontUploadBegin, fontUploadBeginBytes(h(51), catalog.length), {
                id: 1n,
              })
            ).status,
            p.statuses.busy,
          );
          assert.equal(
            (await f.send(p.opcodes.fontRevision, new Uint8Array(16))).status,
            p.statuses.busy,
          );
          assert.equal((await commit(2n)).status, p.statuses.pending);
          assert.equal((await ready('app')).fontTransition.ready, 1);
          assert.equal((await ready('app')).fontTransition.ready, 1);
          assert.equal((await ready('render')).fontTransition.ready, 5);
          assert.equal((await commit(2n)).status, p.statuses.pending);
          assert.equal((await ready('content')).fontTransition.ready, 7);
          await f.input('begin');
          const state = await f.inspect();
          assert.equal(state.fontRevision, 1n);
          assert.equal((await commit(2n, state.lastInput + 1n)).status, p.statuses.stale);
          const committed = await commit(2n, state.lastInput);
          assert.equal(committed.status, p.statuses.ok);
          assert.equal(committed.fontRevision, 2n);
          assert.equal(committed.fontTransition.phase, 'committed');
          assert.equal(committed.fontTransition.fontRevision, 2n);
          await f.input('update', 1);
          assert.equal((await commit(2n, state.lastInput)).status, p.statuses.ok);
          assert.equal((await commit(3n, state.lastInput)).status, p.statuses.idReused);
          assert.equal((await ready('content')).status, p.statuses.ok);
          assert.equal(
            (await ready('render', 10n, p.statuses.invalidValue)).status,
            p.statuses.stale,
          );
          assert.equal(
            (await f.send(p.opcodes.fontTransitionAbort, undefined, { id: 10n })).status,
            p.statuses.stale,
          );
          assert.equal((await begin(11n, null)).fontTransition.ready, 0);
          assert.equal(
            (await f.send(p.opcodes.fontTransitionAbort, undefined, { id: 11n })).fontTransition
              .phase,
            'aborted',
          );
        }),
    );
    test(
      `${profile}: font preparation owns released bytes, first NACK wins and cancellation rejects late ACKs`,
      { timeout },
      () =>
        using(profile, async (f, transport) => {
          await f.start([]);
          const client = await EngineClient.connect(transport),
            view = await client.openView(2),
            resource = h(50);
          await upload(view, resource, 1n);
          const begin = (token, target = resource) =>
            f.send(p.opcodes.fontTransitionBegin, fontTransitionResourceBytes(target), {
              id: token,
            });
          const ready = (token, owner, failure = 0) =>
            f.send(p.opcodes.fontTransitionReady, fontTransitionReadyBytes(owner, failure), {
              id: token,
            });
          await begin(1n);
          await view.releaseFontResource(resource);
          await view.releaseFontResource(resource);
          const staged = await f.send(
            p.opcodes.fontResourceRead,
            fontResourceReadBytes(resource, 0, catalog.length, 0n, 1n),
          );
          assert.equal(staged.status, p.statuses.ok);
          assert.deepEqual(readFontResourceSlice(staged).bytes, catalog);
          assert.equal(
            (
              await f.send(
                p.opcodes.fontResourceRead,
                fontResourceReadBytes(resource, 0, catalog.length),
              )
            ).status,
            p.statuses.invalidHandle,
          );
          assert.equal((await ready(1n, 'app')).fontTransition.ready, 1);
          const failed = await ready(1n, 'render', p.statuses.budgetExceeded);
          assert.equal(failed.status, p.statuses.ok);
          assert.equal(failed.fontTransition.phase, 'failed');
          assert.equal(failed.fontRevision, 1n);
          assert.equal(failed.fontTransition.failedOwner, 4);
          assert.equal(failed.fontTransition.failedStatus, p.statuses.budgetExceeded);
          assert.deepEqual(
            (await ready(1n, 'content', p.statuses.invalidValue)).fontTransition,
            failed.fontTransition,
          );
          assert.equal(
            (
              await f.send(
                p.opcodes.fontResourceRead,
                fontResourceReadBytes(resource, 0, catalog.length, 0n, 1n),
              )
            ).status,
            p.statuses.stale,
          );
          assert.equal(
            (
              await f.send(p.opcodes.fontTransitionCommit, fontTransitionCommitBytes(2n, 0n), {
                id: 1n,
              })
            ).status,
            p.statuses.stale,
          );
          assert.equal(
            (await f.send(p.opcodes.fontTransitionAbort, undefined, { id: 1n })).fontTransition
              .phase,
            'aborted',
          );
          assert.equal(
            (await f.send(p.opcodes.fontTransitionAbort, undefined, { id: 1n })).status,
            p.statuses.ok,
          );
          assert.equal((await ready(1n, 'app')).status, p.statuses.stale);
          assert.equal((await begin(1n)).status, p.statuses.stale);
          assert.equal((await f.inspect()).resourceBytes, 0n);
          const next = h(50, 2);
          await upload(view, next, 2n);
          await view.releaseFontResource(resource);
          assert.deepEqual(
            (await view.readFontResource(next, 0, catalog.length)).bytes,
            catalog,
            'A duplicate old release cannot remove a newer generation',
          );
          assert.equal((await begin(2n, next)).status, p.statuses.ok);
          await view.releaseFontResource(next);
          assert.ok((await f.inspect()).resourceBytes > 0n);
          const closed = await f.send(p.opcodes.closeView);
          assert.equal(closed.fontTransition.phase, 'aborted');
          assert.equal(closed.resourceBytes, 0n);
          assert.equal((await ready(2n, 'content')).status, p.statuses.closed);
        }),
    );
    test(
      `${profile}: SDK font transition methods preserve receipts and reject invalid owner/input payloads`,
      { timeout },
      () =>
        using(profile, async (_f, transport) => {
          const client = await EngineClient.connect(transport),
            view = await client.openView(1);
          assert.equal((await view.beginFontTransition(null, 1n)).resource, null);
          assert.equal((await view.fontTransitionReady(1n, 'app')).ready, 1);
          await assert.rejects(
            view.commitFontTransition(1n, 2n),
            (error) => error.status === p.statuses.pending,
          );
          await view.fontTransitionReady(1n, 'content');
          await view.fontTransitionReady(1n, 'render');
          assert.equal((await view.commitFontTransition(1n, 2n)).phase, 'committed');
          assert.equal((await view.commitFontTransition(1n, 2n)).fontRevision, 2n);
          await view.beginFontTransition(null, 2n);
          assert.equal((await view.abortFontTransition(2n)).phase, 'aborted');
          assert.throws(() => fontTransitionReadyBytes('unknown'), /Invalid font preparation/);
          assert.throws(
            () => fontTransitionReadyBytes('app', p.statuses.pending),
            /Invalid font preparation/,
          );
          assert.throws(() => fontTransitionCommitBytes(1n, 0n), /Invalid font transition/);
          assert.throws(
            () => fontResourceReadBytes({ slot: 1, generation: 1 }, 0, 1, 1n, 1n),
            /Invalid/,
          );
          await view.close();
        }),
    );
  }
}
