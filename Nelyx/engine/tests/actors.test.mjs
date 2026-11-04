// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { engineRoot, timeout } from '../tools/build.mjs';
import { wasmFactory } from './transports.mjs';
import { ContentActor } from '../platform/web/actors.ts';
import { exchange, request } from '../platform/web/common.ts';
import {
  protocol as p,
  commands,
  transaction,
  packet,
  body,
  response,
} from '../../runtime/engine-client/index.ts';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
test(
  'Zero-size Content waits for a host wake and resumes on the actual C++ Wasm core',
  { timeout },
  async () => {
    const { module } = await wasmFactory(path.join(engineRoot, 'dist/single-worker'));
    const engine = module._nelyx_wasm_open(1, 1, p.schema, 15),
      owner = { session: 1, app: 1, view: 1, generation: 1 };
    let steps = 0,
      prepared = 0;
    const dispatch = module._nelyx_wasm_dispatch;
    module._nelyx_wasm_dispatch = (engine, pointer, length) => {
      if (
        new DataView(module.HEAPU8.buffer).getUint16(pointer + 12, true) === p.opcodes.contentStep
      )
        ++steps;
      return dispatch(engine, pointer, length);
    };
    const actor = new ContentActor(
      module,
      engine,
      {
        counters: {},
        discardMeasurements() {},
        prepare(scene) {
          ++prepared;
          return {
            preparation: scene.preparation,
            metrics: scene.metrics,
            device: scene.device,
            document: scene.preparationDocument,
            pictures: [],
            texts: [],
          };
        },
      },
      () => {},
      true,
    );
    try {
      exchange(module, engine, packet(p.opcodes.openView, owner));
      exchange(
        module,
        engine,
        transaction(owner, 1n, 0n, [commands.create({ slot: 1, generation: 1 }, 'box')]),
      );
      actor.kick();
      await sleep(30);
      assert.equal(steps, 1);
      assert.equal(prepared, 0);
      request(
        module,
        engine,
        p.opcodes.metrics,
        body(40, (v) => {
          v.setBigUint64(0, 2n, true);
          v.setFloat64(8, 300, true);
          v.setFloat64(16, 200, true);
          v.setFloat64(24, 1, true);
        }),
      );
      actor.kick();
      await sleep(30);
      assert.equal(steps, 2);
      assert.equal(prepared, 1);
    } finally {
      actor.stop();
      module._nelyx_engine_destroy(engine);
    }
  },
);
test(
  'A failed Content provider preserves the active scene and the next document recovers',
  { timeout },
  async () => {
    const { module } = await wasmFactory(path.join(engineRoot, 'dist/single-worker'));
    const engine = module._nelyx_wasm_open(1, 1, p.schema, 15),
      owner = { session: 1, app: 1, view: 1, generation: 1 };
    const messages = [];
    const actor = new ContentActor(
      module,
      engine,
      {
        counters: {},
        discardMeasurements() {},
        measure() {
          throw new Error('Injected image decode failure');
        },
        prepare(scene) {
          return {
            preparation: scene.preparation,
            metrics: scene.metrics,
            device: scene.device,
            document: scene.preparationDocument,
            pictures: [],
            texts: [],
          };
        },
      },
      (value) => messages.push(value),
      true,
    );
    const waitFor = async (predicate) => {
      for (let i = 0; i < 30; ++i) {
        if (predicate()) return;
        await sleep(10);
      }
      assert.fail('Content did not settle');
    };
    const h = (slot) => ({ slot, generation: 1 });
    const tick = () =>
      request(
        module,
        engine,
        p.opcodes.tick,
        body(8, (v) => v.setFloat64(0, 1, true)),
      );
    try {
      exchange(module, engine, packet(p.opcodes.openView, owner));
      request(
        module,
        engine,
        p.opcodes.metrics,
        body(40, (v) => {
          v.setBigUint64(0, 2n, true);
          v.setFloat64(8, 300, true);
          v.setFloat64(16, 200, true);
          v.setFloat64(24, 1, true);
        }),
      );
      actor.packet(transaction(owner, 1n, 0n, [commands.create(h(1), 'box')]));
      await waitFor(() => messages.some((m) => m.kind === 'prepared'));
      tick();
      actor.packet(
        transaction(owner, 2n, 1n, [
          commands.create(h(2), 'image'),
          commands.layout(h(2)),
          commands.acquireResource(h(1), new Uint8Array([0])),
          commands.bindResource(h(2), h(1)),
        ]),
      );
      await waitFor(() => messages.some((m) => m.kind === 'preparation-error'));
      let state = request(module, engine, p.opcodes.inspect);
      assert.equal(state.activeDocument, 1n);
      assert.equal(state.document, 2n);
      assert.equal(state.failedDocument, 2n);
      actor.packet(
        transaction(owner, 3n, 2n, [commands.destroy(h(2)), commands.releaseResource(h(1))]),
      );
      await waitFor(() => messages.filter((m) => m.kind === 'prepared').length === 2);
      tick();
      state = request(module, engine, p.opcodes.inspect);
      assert.equal(state.activeDocument, 3n);
      assert.equal(
        messages.some((m) => m.kind === 'provider-error'),
        false,
      );
      const closed = response(
        exchange(
          module,
          engine,
          packet(p.opcodes.closeSession, { ...owner, view: 0, generation: 0 }),
        ),
      );
      assert.equal(closed.reservedBytes, 0n);
    } finally {
      actor.stop();
      module._nelyx_engine_destroy(engine);
    }
  },
);
