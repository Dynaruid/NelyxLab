// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EngineClient,
  EngineError,
  ImageResource,
  rasterImageHeader,
  protocol as p,
} from '../../runtime/engine-client/index.ts';
import { OriginalWidgetHost } from '../../runtime/engine-client/original.ts';
import { ResourceRegistry } from '@nelyx/core/hosting/resources';
import { Image } from '@nelyx/core/ui/image';
import { resourceKey } from '@nelyx/core/ui/resource-retention';
import { RawImage } from '@nelyx/core/framework/widgets/raw-image';
import { SizedBox } from '@nelyx/core/framework/widgets/basic';

// Credit-observing App source control. Native/Wasm still own every transaction;
// actual decoder/storage credits and Picture pixels have separate provider tests.
function source(width = 1) {
  const resources = new ResourceRegistry(),
    snapshots = new Map(),
    inputs = [];
  const create = (id) => {
    const resource = { id, generation: 1, kind: 'image' };
    resources.register(resource, () => {});
    const image = Image.fromResource(resources, resource, width, width);
    resources.releaseProducer(resource);
    inputs.push(image);
    return image;
  };
  const owner = {
    bindClock() {
      return { dispose() {} };
    },
    resources,
    service: {},
    capture(image) {
      const key = resourceKey(resources.captureResource(image.resource));
      let value = snapshots.get(key);
      if (!value) {
        const bytes = new Uint8Array(32 + width * width * 4);
        bytes.set(rasterImageHeader(width, width));
        value = { resource: new ImageResource(bytes), holds: 0 };
        snapshots.set(key, value);
      }
      ++value.holds;
      let held = true;
      return {
        key,
        resource: value.resource,
        release() {
          assert.equal(held, true);
          held = false;
          if (!--value.holds) snapshots.delete(key);
        },
      };
    },
  };
  return {
    owner,
    create,
    has: (image) => snapshots.has(resourceKey(image.resource)),
    get count() {
      return snapshots.size;
    },
    close() {
      for (const image of inputs) if (!image.debugDisposed) image.dispose();
      resources.dispose();
      assert.equal(snapshots.size, 0);
    },
  };
}
export function originalImageContracts({ using, timeout }) {
  for (const profile of ['native', 'single-worker', 'threaded']) {
    test(
      `${profile}: Original RawImage Scene credit keeps the accepted older tree through successive known NACKs`,
      { timeout },
      () =>
        using(profile, async (f, transport) => {
          let reject = false;
          const app = source(),
            client = await EngineClient.connect({
              exchange(bytes) {
                if (
                  reject &&
                  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(
                    p.headerFields.opcode,
                    true,
                  ) === p.opcodes.transaction
                ) {
                  reject = false;
                  bytes = bytes.slice();
                  new DataView(bytes.buffer).setUint16(p.headerBytes, 0xffff, true);
                }
                return transport.exchange(bytes);
              },
              close: () => transport.close(),
            }),
            view = await client.openView(1),
            host = new OriginalWidgetHost(view, { pollEvents: false, appImages: app.owner }),
            [a, b, c] = ['A', 'B', 'C'].map(app.create);
          try {
            await f.resize(100, 80);
            await host.mount(new RawImage({ image: a, width: 32, height: 32 }));
            assert.equal(app.count, 1);
            reject = true;
            await assert.rejects(
              host.update(new RawImage({ image: b, width: 32, height: 32 })),
              (error) => error instanceof EngineError,
            );
            assert.equal(view.hasPendingTransaction, false);
            assert.equal(app.count, 2);
            assert.equal(app.has(a), true);
            reject = true;
            await assert.rejects(
              host.update(new RawImage({ image: c, width: 32, height: 32 })),
              (error) => error instanceof EngineError,
            );
            assert.equal(
              app.has(a),
              true,
              'The accepted Native document still holds A after B and C NACK',
            );
            assert.equal(app.has(b), false);
            assert.equal(app.has(c), true);
            await host.update(new SizedBox(1, 1));
            assert.equal(
              app.count,
              0,
              'Only an accepted replacement drops the old Scene snapshots',
            );
            await host.close();
            await client.close();
          } finally {
            await host.close();
            await client.close();
            app.close();
          }
        }),
    );
    for (const replacement of [false, true])
      test(
        `${profile}: Original RawImage retains an uncertain large upload through ${replacement ? 'replacement' : 'close'}`,
        { timeout },
        () =>
          using(profile, async (f, transport) => {
            let lost = 0;
            const app = source(300),
              client = await EngineClient.connect({
                async exchange(bytes) {
                  const op = new DataView(
                      bytes.buffer,
                      bytes.byteOffset,
                      bytes.byteLength,
                    ).getUint16(p.headerFields.opcode, true),
                    result = await transport.exchange(bytes);
                  if (op === p.opcodes.imageUploadChunk && lost++ < 2)
                    throw Error('Raw image chunk ACK lost');
                  return result;
                },
                close: () => transport.close(),
              }),
              view = await client.openView(1),
              host = new OriginalWidgetHost(view, { pollEvents: false, appImages: app.owner }),
              a = app.create('large-A'),
              b = app.create('large-B');
            try {
              await f.resize(100, 80);
              await assert.rejects(
                host.mount(new RawImage({ image: a, width: 32, height: 32 })),
                /Raw image chunk ACK lost/,
              );
              assert.equal(app.count, 1);
              assert.equal(view.hasPendingTransaction, false);
              if (replacement) {
                await host.update(new RawImage({ image: b, width: 32, height: 32 }));
                assert.equal(app.has(a), false);
                assert.equal(app.has(b), true);
              }
              await host.close();
              assert.equal(app.count, 0);
              await client.close();
            } finally {
              await host.close();
              await client.close();
              app.close();
            }
          }),
      );
  }
}
