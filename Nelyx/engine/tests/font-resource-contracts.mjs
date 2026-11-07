// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  commands as c,
  protocol as p,
  body,
  writeHandle,
  measurementBody,
  EngineClient,
  fontUploadBeginBytes,
  fontUploadChunkBytes,
  fontResourceReadBytes,
  readFontUpload,
  readFontResourceSlice,
} from '../../runtime/engine-client/index.ts';
import { fontCatalogBytes } from '../../runtime/engine-client/font-catalog.ts';

const font = new Uint8Array(
    fs.readFileSync(
      new URL(
        '../../sdk/tooling/cli/templates/nelyx-app/assets/NotoSansHebrew.ttf',
        import.meta.url,
      ),
    ),
  ),
  catalog = (count = 1) =>
    fontCatalogBytes({
      fonts: Array.from({ length: count }, () => ({ family: 'StreamHebrew', bytes: font })),
    });
async function upload(f, resource, token, bytes) {
  assert.equal(
    (
      await f.send(p.opcodes.fontUploadBegin, fontUploadBeginBytes(resource, bytes.length), {
        id: token,
      })
    ).status,
    p.statuses.ok,
  );
  for (let at = 0; at < bytes.length; at += p.limits.fontChunkBytes)
    assert.equal(
      (
        await f.send(
          p.opcodes.fontUploadChunk,
          fontUploadChunkBytes(at, bytes.subarray(at, at + p.limits.fontChunkBytes)),
          { id: token },
        )
      ).status,
      p.statuses.ok,
    );
  assert.equal(
    (await f.send(p.opcodes.fontUploadCommit, undefined, { id: token })).status,
    p.statuses.ok,
  );
}
async function select(f, revision, resource) {
  return f.send(
    p.opcodes.fontRevision,
    body(24, (data) => {
      data.setBigUint64(0, revision, true);
      writeHandle(data, 16, resource ?? { slot: 0, generation: 0 });
    }),
  );
}
async function prepare(f) {
  for (let i = 0; i < 30; ++i) {
    const state = await f.step();
    if (state.measureRequest) {
      const request = await f.send(p.opcodes.measureRequest);
      assert.equal(
        (
          await f.send(
            p.opcodes.measureResult,
            measurementBody(request, {
              width: 120,
              height: 24,
              baseline: 18,
              minimum: 80,
              maximum: 120,
            }),
          )
        ).status,
        p.statuses.ok,
      );
    }
    if (state.preparationReady) return state;
  }
  throw Error('Font resource preparation did not complete');
}
export function fontResourceContracts({ using, timeout, h }) {
  for (const profile of ['native', 'single-worker', 'threaded']) {
    test(
      `${profile}: font catalog streaming is bounded, retryable, atomic and independent of document packets`,
      { timeout },
      () =>
        using(profile, async (f, transport) => {
          await f.start([]);
          const client = await EngineClient.connect(transport, {
              requiredCapabilities: p.capabilities.protocol | p.capabilities.fontResources,
            }),
            view = await client.openView(2),
            resource = h(50),
            bytes = catalog(10),
            token = 1n;
          assert.ok(bytes.length > p.limits.packetBytes);
          const initial = await f.inspect(),
            before = await view.beginFontUpload(resource, bytes.length, token);
          assert.equal(before.phase, 'uploading');
          assert.equal(before.filled, 0);
          assert.equal(
            (await f.inspect()).document,
            initial.document,
            'Font staging never accepts an App document',
          );
          assert.equal((await view.beginFontUpload(resource, bytes.length, token)).filled, 0);
          const first = bytes.slice(0, p.limits.fontChunkBytes),
            saved = first.slice();
          assert.equal((await view.appendFontUpload(token, 0, first)).filled, first.length);
          first.fill(0);
          assert.equal((await view.appendFontUpload(token, 0, saved)).filled, saved.length);
          const changed = saved.slice();
          changed[48] ^= 1;
          await assert.rejects(
            view.appendFontUpload(token, 0, changed),
            (error) => error.status === p.statuses.idReused,
          );
          await assert.rejects(
            view.appendFontUpload(token, saved.length + 1, new Uint8Array([1])),
            (error) => error.status === p.statuses.stale,
          );
          await assert.rejects(
            view.finishFontUpload(token, true),
            (error) => error.status === p.statuses.pending,
          );
          const foreign = await f.send(p.opcodes.fontUploadChunk, fontUploadChunkBytes(0, saved), {
            id: token,
          });
          assert.equal(
            foreign.status,
            p.statuses.stale,
            'Another view cannot append to this candidate',
          );
          for (let at = saved.length; at < bytes.length; at += p.limits.fontChunkBytes)
            await view.appendFontUpload(
              token,
              at,
              bytes.subarray(at, at + p.limits.fontChunkBytes),
            );
          assert.equal((await view.finishFontUpload(token, true)).phase, 'committed');
          assert.equal(
            (await view.finishFontUpload(token, true)).phase,
            'committed',
            'A lost terminal ACK is retryable',
          );
          const actual = new Uint8Array(bytes.length);
          for (let at = 0; at < bytes.length; at += p.limits.fontChunkBytes) {
            const slice = await view.readFontResource(
              resource,
              at,
              Math.min(p.limits.fontChunkBytes, bytes.length - at),
            );
            assert.equal(slice.total, bytes.length);
            actual.set(slice.bytes, at);
          }
          assert.deepEqual(
            actual,
            bytes,
            'Copied chunks preserve bytes across subsequent Wasm dispatch/heap growth',
          );
          await assert.rejects(
            view.readFontResource(resource, bytes.length, 1),
            (error) => error.status === p.statuses.invalidValue,
          );
          const rejected = await f.commit([
            c.create(h(1), 'image'),
            c.bindResource(h(1), resource),
          ]);
          assert.equal(
            rejected.status,
            p.statuses.invalidHandle,
            'A font catalog cannot masquerade as encoded image bytes',
          );
          assert.equal((await f.inspect()).document, initial.document);
          assert.equal((await f.commit([c.releaseResource(resource)])).status, p.statuses.accepted);
          await assert.rejects(
            view.readFontResource(resource, 0, 32),
            (error) => error.status === p.statuses.invalidHandle,
          );
          assert.equal(
            (await view.finishFontUpload(token, true)).phase,
            'committed',
            'Replaying a receipt cannot resurrect a released resource',
          );
          assert.equal((await f.inspect()).resourceBytes, 0n);
          await client.close();
        }),
    );
    test(
      `${profile}: font snapshots pin older recordings and in-flight scenes after producer release and revision changes`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start([
            c.create(h(1), 'stack'),
            c.layout(h(1)),
            c.properties(h(1), { width: 200, height: 100 }),
          ]);
          const a = h(50),
            b = h(50, 2),
            bytes = catalog();
          await upload(f, a, 1n, bytes);
          assert.equal((await select(f, 2n, a)).status, p.statuses.ok);
          const placement = {
            fontRevision: 2n,
            width: 120,
            height: 24,
            baseline: 18,
            rect: [0, 32, 120, 24],
          };
          assert.equal(
            (
              await f.commit([
                c.create(h(2), 'paragraph'),
                c.attach(h(2), h(1)),
                c.text(h(2), 'recording'),
                c.layout(h(2), { paintChild: true }),
                c.eventPolicy(
                  h(2),
                  p.eventPolicies.canonicalHitTest | p.eventPolicies.deferToChild,
                ),
                c.constraints(h(2), { kind: 'finite', min: 120, max: 120 }, { kind: 'unbounded' }),
                c.paintPlacement(h(2), placement),
                c.paragraphFont(h(2), { resource: a, fontRevision: 2n }),
                c.create(h(3), 'paragraph'),
                c.attach(h(3), h(1), 1),
                c.layout(h(3), { paragraphSizing: true }),
                c.properties(h(3), { width: 120 }),
                c.text(h(3), 'inherited'),
              ])
            ).status,
            p.statuses.accepted,
          );
          await prepare(f);
          await f.tick();
          const held = await f.send(p.opcodes.takeFrame);
          assert.equal(held.status, p.statuses.ok);
          assert.deepEqual(held.nodes.find((n) => n.node.slot === 2).fontBinding, {
            resource: a,
            fontRevision: 2n,
            pinned: true,
          });
          assert.deepEqual(held.nodes.find((n) => n.node.slot === 3).fontBinding, {
            resource: a,
            fontRevision: 2n,
            pinned: false,
          });
          await f.commit([c.releaseResource(a)]);
          assert.equal(
            (await f.send(p.opcodes.fontResourceRead, fontResourceReadBytes(a, 0, 32))).status,
            p.statuses.invalidHandle,
          );
          const retained = await f.send(
            p.opcodes.fontResourceRead,
            fontResourceReadBytes(a, 0, 32, held.activePreparation),
          );
          assert.equal(retained.status, p.statuses.ok);
          assert.deepEqual(readFontResourceSlice(retained).bytes, bytes.slice(0, 32));
          await upload(f, b, 2n, bytes);
          assert.equal((await select(f, 3n, b)).status, p.statuses.ok);
          await prepare(f);
          await f.tick();
          const next = await f.present();
          assert.deepEqual(next.nodes.find((n) => n.node.slot === 2).fontBinding, {
            resource: a,
            fontRevision: 2n,
            pinned: true,
          });
          assert.deepEqual(next.nodes.find((n) => n.node.slot === 3).fontBinding, {
            resource: b,
            fontRevision: 3n,
            pinned: false,
          });
          const snapshot = await f.send(p.opcodes.layoutSnapshot);
          assert.ok(
            snapshot.blobs.every((blob) => blob.type !== 2),
            'Font snapshots carry identity rather than resending whole files',
          );
          const rejected = await f.commit([
            c.paragraphFont(h(2), { resource: b, fontRevision: 4n }),
          ]);
          assert.equal(
            rejected.status,
            p.statuses.invalidValue,
            'Recording and font binding revisions commit atomically',
          );
          await f.commit([c.detach(h(2)), c.destroy(h(2)), c.releaseResource(b)]);
          assert.equal((await select(f, 4n, null)).status, p.statuses.ok);
          await prepare(f);
          await f.tick();
          const reset = await f.present();
          assert.equal(reset.nodes.find((n) => n.node.slot === 3).fontBinding.resource, null);
          assert.equal(
            (
              await f.send(
                p.opcodes.fontResourceRead,
                fontResourceReadBytes(a, 0, 32, held.activePreparation),
              )
            ).status,
            p.statuses.ok,
          );
          assert.equal(
            (
              await f.send(
                p.opcodes.fontResourceRead,
                fontResourceReadBytes(a, 0, 32, reset.activePreparation),
              )
            ).status,
            p.statuses.stale,
          );
          assert.equal(
            (
              await f.send(
                p.opcodes.releaseFrame,
                body(24, (data) => {
                  data.setBigUint64(0, held.submission, true);
                  data.setBigUint64(8, held.device, true);
                }),
              )
            ).status,
            p.statuses.ok,
          );
          assert.equal(
            (await f.inspect()).resourceBytes,
            0n,
            'The last held scene returns its font bytes',
          );
        }),
    );
    test(
      `${profile}: font upload failure, memory admission, abort and close preserve existing resources`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start([]);
          const resource = h(70),
            data = catalog(),
            before = await f.inspect();
          assert.equal(
            (
              await f.send(p.opcodes.fontUploadBegin, fontUploadBeginBytes(resource, data.length), {
                id: 1n,
              })
            ).status,
            p.statuses.ok,
          );
          const broken = data.slice();
          broken[20] = 1;
          await f.send(p.opcodes.fontUploadChunk, fontUploadChunkBytes(0, broken), { id: 1n });
          const rejected = await f.send(p.opcodes.fontUploadCommit, undefined, { id: 1n });
          assert.notEqual(rejected.status, p.statuses.ok);
          assert.equal(readFontUpload(rejected).phase, 'uploading');
          assert.equal((await f.inspect()).document, before.document);
          assert.equal(
            (await f.send(p.opcodes.fontUploadAbort, undefined, { id: 1n })).status,
            p.statuses.ok,
          );
          assert.equal(
            (await f.send(p.opcodes.fontUploadAbort, undefined, { id: 1n })).status,
            p.statuses.ok,
          );
          assert.equal((await f.inspect()).resourceBytes, 0n);
          assert.equal(
            (
              await f.send(
                p.opcodes.fontUploadBegin,
                fontUploadBeginBytes(resource, p.limits.fontCatalogBytes),
                { id: 2n },
              )
            ).status,
            p.statuses.ok,
          );
          const other = { session: 1, app: 1, view: 2, generation: 1 };
          assert.equal(
            (await f.send(p.opcodes.openView, undefined, { owner: other })).status,
            p.statuses.ok,
          );
          assert.equal(
            (
              await f.send(
                p.opcodes.fontUploadBegin,
                fontUploadBeginBytes(h(71), p.limits.fontCatalogBytes),
                { id: 1n, owner: other },
              )
            ).status,
            p.statuses.budgetExceeded,
          );
          assert.equal(
            readFontUpload(await f.inspect()).token,
            2n,
            'A rejected admission preserves the existing stage',
          );
          await f.send(p.opcodes.fontUploadAbort, undefined, { id: 2n });
          assert.equal(
            (
              await f.send(
                p.opcodes.fontUploadBegin,
                fontUploadBeginBytes(h(71), p.limits.fontCatalogBytes),
                { id: 1n, owner: other },
              )
            ).status,
            p.statuses.ok,
          );
          assert.equal(
            (
              await f.send(p.opcodes.fontUploadChunk, fontUploadChunkBytes(0, data.slice(0, 32)), {
                id: 1n,
              })
            ).status,
            p.statuses.stale,
          );
          const closed = await f.send(p.opcodes.closeSession, undefined, {
            owner: { ...other, view: 0, generation: 0 },
          });
          assert.equal(closed.status, p.statuses.ok);
          assert.equal(closed.resourceBytes, 0n);
          assert.equal(closed.reservedBytes, 0n);
        }),
    );
  }
}
