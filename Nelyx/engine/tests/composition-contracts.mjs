// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EngineClient,
  WidgetHost,
  Stack,
  Box,
  Text,
  Padding,
  EdgeInsets,
  Directionality,
  ValueNotifier,
  ValueListenableBuilder,
  AppDrivenBoundary,
  GlobalKey,
  ValueKey,
  ObjectKey,
  UniqueKey,
  State,
  StatefulWidget,
  protocol as p,
} from '../../runtime/engine-client/index.ts';
import { ValueKey as CanonicalValueKey } from '@nelyx/core/foundation/key';
import { ValueNotifier as CanonicalValueNotifier } from '@nelyx/core/foundation/notifier';
export function compositionContracts({ using, timeout }) {
  for (const profile of ['native', 'single-worker', 'threaded']) {
    test(
      `${profile}: close cancels a pending Widget event poll without hiding active-session errors`,
      { timeout },
      () =>
        using(profile, async (f, transport) => {
          let arrived,
            rejectHeld,
            activeError,
            mode = 'hold';
          const pending = new Promise((resolve) => (arrived = resolve)),
            held = new Promise((_resolve, reject) => (rejectHeld = reject)),
            reported = new Promise((resolve) => (activeError = resolve)),
            errors = [],
            client = await EngineClient.connect({
              exchange(bytes) {
                if (
                  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(
                    p.headerFields.opcode,
                    true,
                  ) === p.opcodes.pollInteractionEvents
                ) {
                  if (mode === 'hold') {
                    arrived();
                    return held;
                  }
                  if (mode === 'active') return Promise.reject(Error('active poll failure'));
                }
                return transport.exchange(bytes);
              },
              close: () => transport.close?.(),
            }),
            view = await client.openView(1),
            host = new WidgetHost(view, { onError: (error) => errors.push(String(error)) });
          void held.catch(() => {});
          let control, scheduledHost, timer;
          const deadline = new Promise(
            (_resolve, reject) =>
              (timer = setTimeout(
                () => reject(Error('Event poll did not reach the transport')),
                5000,
              )),
          );
          try {
            await f.resize(100, 100);
            await host.mount(new Box([], { properties: { width: 20, height: 20 } }));
            await Promise.race([pending, deadline]);
            await host.close();
            rejectHeld(Error('transport closed after Widget disposal'));
            await new Promise((resolve) => setTimeout(resolve, 0));
            assert.deepEqual(errors, [], 'A late cancellation after close is not an App failure');
            mode = 'active';
            control = new WidgetHost(await client.openView(2), {
              onError: (error) => {
                errors.push(String(error));
                activeError();
              },
            });
            await control.mount(new Box([], { properties: { width: 20, height: 20 } }));
            await Promise.race([reported, deadline]);
            await control.close();
            assert.deepEqual(
              errors,
              ['Error: active poll failure'],
              'An active transport failure is still reported',
            );
            mode = 'closed';
            let builds = 0;
            const key = new GlobalKey();
            class Scheduled extends StatefulWidget {
              createState() {
                return new ScheduledState();
              }
            }
            class ScheduledState extends State {
              build() {
                ++builds;
                return new Box([], { properties: { width: 20, height: 20 } });
              }
            }
            scheduledHost = new WidgetHost(await client.openView(3), {
              pollEvents: false,
              onError: (error) => errors.push(String(error)),
            });
            await scheduledHost.mount(new Scheduled(key));
            key.currentState.setState(() => {});
            await scheduledHost.close();
            await Promise.resolve();
            assert.equal(builds, 1, 'A scheduled build does not enter a closed Widget tree');
            assert.equal(errors.length, 1);
          } finally {
            clearTimeout(timer);
            mode = 'closed';
            rejectHeld(Error('test cleanup'));
            await scheduledHost?.close();
            await control?.close();
            await host.close();
            await client.close();
          }
        }),
    );
    test(
      `${profile}: canonical keys retain custom equality and type tokens through native Widget reconciliation`,
      { timeout },
      () =>
        using(profile, async (f, transport) => {
          assert.equal(ValueKey, CanonicalValueKey);
          assert.equal(ValueNotifier, CanonicalValueNotifier);
          const client = await EngineClient.connect(transport),
            view = await client.openView(1),
            host = new WidgetHost(view, { pollEvents: false }),
            token = Symbol('record'),
            otherToken = Symbol('record'),
            identity = {},
            events = { init: 0, dispose: 0 };
          class Child extends StatefulWidget {
            createState() {
              return new ChildState();
            }
          }
          class ChildState extends State {
            initState() {
              ++events.init;
            }
            dispose() {
              ++events.dispose;
            }
            build() {
              return new Box([], { properties: { width: 20, height: 20 } });
            }
          }
          const record = (type = token) =>
            new ValueKey(
              { id: 7 },
              type,
              (a, b) => a.id === b.id,
              (v) => v.id,
            );
          try {
            await f.resize(100, 100);
            await host.mount(new Child(record()));
            await f.ready();
            const epoch = view.documentEpoch;
            await host.update(new Child(record()));
            assert.equal(events.init, 1, 'Custom equality preserves the State');
            assert.equal(view.documentEpoch, epoch);
            await host.update(new Child(record(otherToken)));
            await f.ready();
            assert.deepEqual(
              events,
              { init: 2, dispose: 1 },
              'Different runtime type tokens do not alias',
            );
            await host.update(new Child(new ObjectKey(identity)));
            await f.ready();
            const initialized = events.init;
            await host.update(new Child(new ObjectKey(identity)));
            assert.equal(events.init, initialized);
            await host.update(new Child(new UniqueKey()));
            await f.ready();
            await host.update(new Child(new UniqueKey()));
            await f.ready();
            assert.equal(events.init, initialized + 2, 'Every UniqueKey replaces the State');
            await assert.rejects(
              host.update(new Stack([new Child(record()), new Child(record())])),
              /Duplicate sibling key/,
            );
          } finally {
            await host.close();
            await client.close();
          }
          assert.equal(
            events.init,
            events.dispose,
            'Rollback and close dispose every initialized State',
          );
        }),
    );
    test(
      `${profile}: composition and explicit App geometry preserve native layout, direction, notifier lifetime and build rollback`,
      { timeout },
      () =>
        using(profile, async (f, transport) => {
          const client = await EngineClient.connect(transport),
            view = await client.openView(1),
            host = new WidgetHost(view, { pollEvents: false }),
            notifier = new ValueNotifier(0xff123456),
            field = new GlobalKey();
          await f.resize(300, 200);
          const build = (invalid = false) =>
            new Stack(
              [
                new Padding(
                  new ValueListenableBuilder(
                    notifier,
                    (_context, color) =>
                      new Box([], { properties: { width: 40, height: 20 }, color }),
                  ),
                  EdgeInsets.only({ left: 12, top: 8, right: 6, bottom: 4 }),
                  { properties: { width: 80, height: 40 } },
                ),
                new Directionality(
                  'rtl',
                  new AppDrivenBoundary(
                    80,
                    60,
                    [
                      new Text('RTL', {
                        key: field,
                        properties: invalid ? { width: 50 } : { x: 3, y: 4, width: 50, height: 20 },
                      }),
                    ],
                    { properties: { x: 120, y: 70 } },
                  ),
                ),
              ],
              { properties: { width: 300, height: 200 } },
            );
          try {
            await host.mount(build());
            await f.ready();
            let state = await view.layoutSnapshot();
            const child = state.nodes.find((n) => n.color === 0xff123456);
            assert.equal(child.x, 12);
            assert.equal(child.y, 8);
            const text = state.nodes.find((n) => n.node.slot === field.currentNode.slot);
            assert.equal(text.textDirection, 1);
            assert.equal(text.x, 3);
            assert.equal(text.y, 4);
            assert.equal(text.width, 50);
            notifier.value = 0xffabcdef;
            await host.flush();
            await f.ready();
            state = await view.layoutSnapshot();
            assert.ok(state.nodes.some((n) => n.color === 0xffabcdef));
            const epoch = view.documentEpoch;
            await assert.rejects(host.update(build(true)), /explicit finite/);
            assert.equal(view.documentEpoch, epoch);
            await host.update(build());
            assert.equal(
              view.documentEpoch,
              epoch,
              'Identical recovery does not create a redundant document',
            );
            await host.close();
            const builds = host.counters.builds;
            notifier.value = 0xff000000;
            await Promise.resolve();
            assert.equal(host.counters.builds, builds);
            assert.equal((await f.inspect()).status, p.statuses.ok);
          } finally {
            await host.close();
            await client.close();
            notifier.dispose();
          }
        }),
    );
  }
}
