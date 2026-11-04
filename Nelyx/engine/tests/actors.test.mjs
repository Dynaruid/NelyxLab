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
