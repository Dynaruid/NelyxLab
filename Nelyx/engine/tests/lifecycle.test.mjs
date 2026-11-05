// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  drainEngineOwners,
  engineDisposer,
  createPacketTransport,
} from '../../runtime/engine-client/index.ts';
const timeout = 1_200_000;
test(
  'Compound App/Widget/transport failures preserve cause, order and one reentrant close terminal',
  { timeout },
  async () => {
    const errors = [Error('App dispose'), Error('Widget close'), Error('Transport close')],
      calls = [];
    let close;
    close = engineDisposer(() =>
      drainEngineOwners(
        'close failed',
        errors.map((error, index) => async () => {
          calls.push(index);
          assert.strictEqual(close(), first);
          throw error;
        }),
      ),
    );
    const first = close();
    assert.strictEqual(first, close());
    await assert.rejects(first, (error) => {
      assert.strictEqual(error.cause, errors[0]);
      assert.deepEqual(error.errors, errors);
      for (const source of errors) assert.ok(String(error).includes(source.message));
      return true;
    });
    assert.deepEqual(calls, [0, 1, 2]);
    assert.strictEqual(first, close());
  },
);
test(
  'A single cleanup error retains its identity, including non-Error throws',
  { timeout },
  async () => {
    const error = { reason: 'original' };
    await assert.rejects(
      drainEngineOwners('close', [
        () => {
          throw error;
        },
        () => {},
      ]),
      (result) => result === error,
    );
  },
);
test(
  'Packet close settles all admitted requests even when both endpoint cleanups throw',
  { timeout },
  async () => {
    let closes = 0,
      unsubscribes = 0;
    const transport = createPacketTransport({
      subscribe() {
        return () => {
          ++unsubscribes;
          throw Error('unsubscribe failure');
        };
      },
      post() {},
      close() {
        ++closes;
        throw Error('endpoint failure');
      },
    });
    const pending = transport.exchange(new Uint8Array([1, 2, 3])),
      result = assert.rejects(pending, /Packet port closed/);
    assert.throws(
      () => transport.close(),
      (error) =>
        error.errors.length === 2 &&
        /unsubscribe failure/.test(String(error)) &&
        /endpoint failure/.test(String(error)),
    );
    await result;
    transport.close();
    assert.equal(closes, 1);
    assert.equal(unsubscribes, 1);
    await assert.rejects(transport.exchange(new Uint8Array()), /closed/);
  },
);
