// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  protocol as p,
  commands as c,
  body,
  EngineClient,
  WidgetHost,
  Box,
  Image,
  ImageResource,
  imageUploadChunkBytes,
  imageResourceReadBytes,
  imageUploadBeginBytes,
  readImageUpload,
  readImageResourceSlice,
} from '../../runtime/engine-client/index.ts';

const payload = () =>
  Uint8Array.from({ length: p.limits.packetBytes + 117 }, (_, i) => (i * 37 + 19) & 255);
async function upload(view, resource, token, bytes) {
  await view.beginImageUpload(resource, bytes.length, token);
  for (let offset = 0; offset < bytes.length; offset += p.limits.imageChunkBytes)
    await view.appendImageUpload(
      token,
      offset,
      bytes.subarray(offset, offset + p.limits.imageChunkBytes),
    );
  await view.finishImageUpload(token, true);
}
export function imageResourceContracts({ using, timeout, h }) {
  for (const profile of ['native', 'single-worker', 'threaded']) {
    test(
      `${profile}: image uploads copy chunks, reject mismatched retries and publish only a complete immutable resource`,
      { timeout },
      () =>
        using(profile, async (f, transport) => {
          await f.start([]);
          const client = await EngineClient.connect(transport),
            view = await client.openView(2),
            resource = view.allocateResource(),
            bytes = payload(),
            first = bytes.slice(0, p.limits.imageChunkBytes),
            saved = first.slice();
          await view.beginImageUpload(resource, bytes.length, 1n);
          assert.equal((await view.beginImageUpload(resource, bytes.length, 1n)).filled, 0);
          assert.equal(
            (await f.commit([c.create(h(1), 'image'), c.bindResource(h(1), resource)])).status,
            p.statuses.invalidHandle,
          );
          await view.appendImageUpload(1n, 0, first);
          first.fill(0);
          assert.equal((await view.appendImageUpload(1n, 0, saved)).filled, saved.length);
          const changed = saved.slice();
          changed[27] ^= 1;
          await assert.rejects(
            view.appendImageUpload(1n, 0, changed),
            (error) => error.status === p.statuses.idReused,
          );
          await assert.rejects(
            view.appendImageUpload(1n, saved.length + 1, new Uint8Array([1])),
            (error) => error.status === p.statuses.stale,
          );
          await assert.rejects(
            view.finishImageUpload(1n, true),
            (error) => error.status === p.statuses.pending,
          );
          assert.equal(
            (await f.send(p.opcodes.imageUploadChunk, imageUploadChunkBytes(0, saved), { id: 1n }))
              .status,
            p.statuses.stale,
          );
          for (let offset = saved.length; offset < bytes.length; offset += p.limits.imageChunkBytes)
            await view.appendImageUpload(
              1n,
              offset,
              bytes.subarray(offset, offset + p.limits.imageChunkBytes),
            );
          assert.equal((await view.finishImageUpload(1n, true)).phase, 'committed');
          assert.equal((await view.finishImageUpload(1n, true)).phase, 'committed');
          const actual = new Uint8Array(bytes.length);
          for (let offset = 0; offset < bytes.length; offset += p.limits.imageChunkBytes) {
            const slice = await view.readImageResource(
              resource,
              offset,
              Math.min(p.limits.imageChunkBytes, bytes.length - offset),
            );
            assert.equal(slice.total, bytes.length);
            actual.set(slice.bytes, offset);
            slice.bytes.fill(0);
          }
          assert.deepEqual(actual, bytes);
          assert.deepEqual(
            (await view.readImageResource(resource, 0, 32)).bytes,
            bytes.slice(0, 32),
          );
          await assert.rejects(
            view.readImageResource(resource, bytes.length, 1),
            (error) => error.status === p.statuses.invalidValue,
          );
          await assert.rejects(
            view.readFontResource(resource, 0, 32),
            (error) => error.status === p.statuses.invalidHandle,
          );
          await view.releaseImageResource(resource);
          await view.releaseImageResource(resource);
          await assert.rejects(
            view.readImageResource(resource, 0, 1),
            (error) => error.status === p.statuses.invalidHandle,
          );
          assert.equal((await view.finishImageUpload(1n, true)).phase, 'committed');
          assert.equal(
            (await f.inspect()).resourceBytes,
            0n,
            'Receipt replay cannot resurrect the backing',
          );
          await client.close();
        }),
    );
    test(
      `${profile}: image reads are scoped to a retained preparation across producer release and slot reuse`,
      { timeout },
      () =>
        using(profile, async (f, transport) => {
          await f.start([c.create(h(1), 'stack'), c.properties(h(1), { width: 200, height: 100 })]);
          const client = await EngineClient.connect(transport),
            view = await client.openView(2),
            a = view.allocateResource(),
            bytes = payload();
          await upload(view, a, 1n, bytes);
          assert.equal(
            (
              await f.commit([
                c.create(h(2), 'image'),
                c.attach(h(2), h(1)),
                c.properties(h(2), { width: 100, height: 80 }),
                c.bindResource(h(2), a),
              ])
            ).status,
            p.statuses.accepted,
          );
          let state;
          for (let attempt = 0; attempt < 30; ++attempt) {
            state = await f.step();
            if (state.preparationReady) break;
          }
          assert.equal(state.preparationReady, true);
          const scene = await f.send(p.opcodes.preparationScene);
          assert.equal(scene.status, p.statuses.ok);
          assert.equal(scene.blobs.filter((blob) => blob.type === 2).length, 0);
          assert.equal(scene.blobs.filter((blob) => blob.type === p.imageResourceBlob).length, 1);
          await f.tick();
          const held = await f.send(p.opcodes.takeFrame);
          assert.equal(held.status, p.statuses.ok);
          await view.releaseImageResource(a);
          view.recycleResource(a, true);
          const b = view.allocateResource();
          assert.deepEqual(b, h(a.slot, 2));
          const other = bytes.map((byte) => byte ^ 255);
          await upload(view, b, 2n, other);
          assert.equal((await f.commit([c.bindResource(h(2), b)])).status, p.statuses.accepted);
          await f.ready();
          await f.present();
          const read = await f.send(
            p.opcodes.imageResourceRead,
            imageResourceReadBytes(a, 0, 127, held.activePreparation),
          );
          assert.equal(read.status, p.statuses.ok);
          assert.deepEqual(readImageResourceSlice(read).bytes, bytes.slice(0, 127));
          assert.deepEqual((await view.readImageResource(b, 0, 127)).bytes, other.slice(0, 127));
          const wrong = await f.send(
            p.opcodes.imageResourceRead,
            imageResourceReadBytes(a, 0, 1, 0xffffn),
          );
          assert.equal(wrong.status, p.statuses.stale);
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
          const closed = await f.send(p.opcodes.closeSession, undefined, {
            owner: { session: 1, app: 1, view: 0, generation: 0 },
          });
          assert.equal(closed.status, p.statuses.ok);
          assert.equal(closed.reservedBytes, 0n);
        }),
    );
    test(
      `${profile}: image staging admits memory before allocation and abort/close return all credit`,
      { timeout },
      () =>
        using(profile, async (f) => {
          await f.start([]);
          const other = { session: 1, app: 1, view: 2, generation: 1 },
            size = 17 * 1024 * 1024;
          assert.equal(
            (
              await f.send(p.opcodes.imageUploadBegin, imageUploadBeginBytes(h(70), size), {
                id: 1n,
              })
            ).status,
            p.statuses.ok,
          );
          assert.equal(
            (await f.send(p.opcodes.openView, undefined, { owner: other })).status,
            p.statuses.ok,
          );
          assert.equal(
            (
              await f.send(p.opcodes.imageUploadBegin, imageUploadBeginBytes(h(71), size), {
                id: 1n,
                owner: other,
              })
            ).status,
            p.statuses.budgetExceeded,
          );
          assert.equal(readImageUpload(await f.inspect()).phase, 'uploading');
          assert.equal(
            (await f.send(p.opcodes.imageUploadAbort, undefined, { id: 1n })).status,
            p.statuses.ok,
          );
          assert.equal(
            (await f.send(p.opcodes.imageUploadAbort, undefined, { id: 1n })).status,
            p.statuses.ok,
          );
          assert.equal((await f.inspect()).resourceBytes, 0n);
          assert.equal(
            (
              await f.send(p.opcodes.imageUploadBegin, imageUploadBeginBytes(h(71), size), {
                id: 1n,
                owner: other,
              })
            ).status,
            p.statuses.ok,
          );
          const closed = await f.send(p.opcodes.closeSession, undefined, {
            owner: { ...other, view: 0, generation: 0 },
          });
          assert.equal(closed.status, p.statuses.ok);
          assert.equal(closed.reservedBytes, 0n);
        }),
    );
    for (const replaced of [false, true])
      test(
        `${profile}: WidgetHost preserves an ambiguous image upload snapshot${replaced ? ' while replacing the desired tree' : ''}`,
        { timeout },
        () =>
          using(profile, async (f, transport) => {
            await f.start([]);
            let lost = 0,
              handle;
            const wrapped = {
              async exchange(bytes) {
                const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
                  op = data.getUint16(12, true);
                if (op === p.opcodes.imageUploadBegin)
                  handle = h(
                    data.getUint32(p.headerBytes, true),
                    data.getUint32(p.headerBytes + 4, true),
                  );
                const result = await transport.exchange(bytes);
                if (op === p.opcodes.imageUploadChunk && lost++ < 2)
                  throw Error('Lost image chunk ACK');
                return result;
              },
              close: () => transport.close(),
            };
            const client = await EngineClient.connect(wrapped),
              view = await client.openView(2),
              host = new WidgetHost(view, { pollEvents: false }),
              bytes = payload(),
              resource = new ImageResource(bytes);
            await assert.rejects(
              host.mount(new Image(resource, { properties: { width: 100, height: 80 } })),
              /Lost image chunk ACK/,
            );
            assert.equal(readImageUpload(await view.request(p.opcodes.inspect)).phase, 'uploading');
            resource.bytes.fill(0);
            if (replaced) await host.update(new Box([]));
            else await host.flush();
            assert.equal(view.hasPendingTransaction, false);
            if (replaced) {
              await assert.rejects(
                view.readImageResource(handle, 0, 1),
                (error) => error.status === p.statuses.invalidHandle,
              );
              assert.equal((await view.request(p.opcodes.inspect)).resourceBytes, 0n);
            } else
              assert.deepEqual(
                (await view.readImageResource(handle, 0, 127)).bytes,
                bytes.slice(0, 127),
                'Replay uses the captured snapshot across caller mutation',
              );
            await host.close();
            assert.equal((await f.inspect()).resourceBytes, 0n);
            await client.close();
          }),
      );
  }
}
