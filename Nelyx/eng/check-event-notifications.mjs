// SPDX-License-Identifier: BSD-3-Clause
import { build } from 'esbuild';
import path from 'node:path';

// No generated test bundle, browser profile, or receipt is retained.
const watchdog = setTimeout(() => {
  throw Error('Notification checks exceeded 20 minutes');
}, 1_200_000);
try {
  const result = await build({
    absWorkingDir: path.resolve(import.meta.dirname, '../..'),
    stdin: {
      resolveDir: path.resolve(import.meta.dirname, '../..'),
      loader: 'ts',
      contents: `
      import assert from 'node:assert/strict';
      import { createPacketTransport } from './Nelyx/runtime/engine-client/message-port.ts';
      import { EngineViewClient } from './Nelyx/runtime/engine-client/client.ts';
      import { SceneWriter } from './Nelyx/runtime/engine-client/scene.ts';
      const turn = () => new Promise(resolve => setImmediate(resolve));
      let receive, closed = false;
      const transport = createPacketTransport({ notifications: true,
        subscribe(callback) { receive = callback; return () => { receive = undefined; }; },
        post(message) { receive({ kind: 'packet-result', id: message.id, bytes: message.bytes }); },
        close() { closed = true; }
      });
      let calls = 0;
      const unsubscribe = transport.subscribeChanges(() => ++calls);
      receive({ kind: 'engine-change' });
      assert.equal(calls, 1);
      assert.deepEqual(await transport.exchange(new Uint8Array([1,2,3])), new Uint8Array([1,2,3]));
      assert.equal(calls, 1, 'packet replies must not create a notification feedback loop');
      unsubscribe(); receive({ kind: 'engine-change' }); assert.equal(calls, 1);
      await transport.close(); assert(closed); assert.equal(receive, undefined);
      const listeners = new Set<() => void>();
      const client = { notificationRevision: 0, releaseView() {}, subscribeChanges(callback) {
        listeners.add(callback); return () => listeners.delete(callback);
      }};
      const notify = () => { ++client.notificationRevision; for (const f of [...listeners]) f(); };
      const view = new EngineViewClient(client as any, { session: 1, app: 1, view: 1, generation: 1 });
      const before = view.notificationRevision; notify();
      await view.waitForChange(before); assert.equal(listeners.size, 0, 'early wake is retained by revision');
      const wait = view.waitForChange(view.notificationRevision); assert.equal(listeners.size, 1);
      notify(); await wait; assert.equal(listeners.size, 0);
      const stoppedHost = view.waitForChange(view.notificationRevision);
      view.wakeChangeWaits(); await stoppedHost; assert.equal(listeners.size, 0);
      const canceled = view.waitForChange(view.notificationRevision);
      const cancellationCheck = assert.rejects(canceled); view.sessionClosed(); await cancellationCheck; assert.equal(listeners.size, 0);
      const fallback = new EngineViewClient({ notificationRevision: 0, subscribeChanges() {} } as any,
        { session: 1, app: 1, view: 2, generation: 1 });
      await fallback.waitForChange(0);
      let resolvePoll, polls = 0, delivered = 0;
      const state = { events: [], gestureRequests: [], interactionCount: 0 };
      const writer = new SceneWriter({ subscribeChanges: client.subscribeChanges,
        pollInteractionEvents() { ++polls; return new Promise(resolve => { resolvePoll = resolve; }); }
      } as any, { onAfterEvents() { ++delivered; } });
      (writer as any).startEvents(); assert.equal(polls, 1);
      notify(); notify(); notify();
      resolvePoll(state); await turn(); assert.equal(polls, 2, 'notifications during a poll coalesce into one following poll');
      resolvePoll(state); await turn(); assert(delivered >= 2);
      await turn(); assert.equal(polls, 2, 'idle notification hosts do not poll');
      notify(); assert.equal(polls, 3);
      resolvePoll({ ...state, interactionCount: 1 }); await turn();
      assert.equal(polls, 4, 'bounded interaction batches drain without another host edge');
      await writer.stop(); resolvePoll(state); await turn(); notify();
      assert.equal(polls, 4); assert.equal(listeners.size, 0, 'stop detaches readiness observers');
      console.log('Notification transport, lost wake, coalescing, queue drain, idle and close checks passed.');
    `,
    },
    logOverride: { 'package.json': 'silent' },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    target: 'node24',
  });
  await import(
    'data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].contents).toString('base64')
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  clearTimeout(watchdog);
}
