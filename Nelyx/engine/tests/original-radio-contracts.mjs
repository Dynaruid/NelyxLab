// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EngineClient,
  EngineError,
  commands as c,
  protocol as p,
  semanticActionBody,
} from '../../runtime/engine-client/index.ts';
import { OriginalWidgetHost } from '../../runtime/engine-client/original.ts';
import { RawRadio, RadioGroupRegistry } from '@nelyx/core/framework/widgets/radio-group';
import { Directionality } from '@nelyx/core/framework/widgets/app-data';
import { SizedBox } from '@nelyx/core/framework/widgets/basic';
import { FlutterError } from '@nelyx/core/foundation/flutter-error';

export function originalRadioContracts({ using, timeout, h }) {
  for (const profile of ['native', 'single-worker', 'threaded']) {
    test(
      `${profile}: Source Radio deselection preserves controlled callbacks, capability changes and retirement`,
      { timeout },
      () =>
        using(profile, async (f, transport) => {
          const calls = [],
            clients = new Set(),
            errors = [];
          class Registry extends RadioGroupRegistry {
            groupValue = 'a';
            onChanged = (value) => calls.push(value);
            registerClient(client) {
              clients.add(client);
            }
            unregisterClient(client) {
              clients.delete(client);
            }
          }
          const registry = new Registry(),
            client = await EngineClient.connect(transport),
            view = await client.openView(1),
            host = new OriginalWidgetHost(view, {
              pollEvents: false,
              platform: { kind: 'native', operatingSystem: 'windows' },
              onError: (error) => errors.push(error),
            });
          const previous = FlutterError.onError;
          FlutterError.onError = (details) => errors.push(details.exception);
          const tree = ({ toggleable = true, enabled = true } = {}) =>
            new Directionality(
              'ltr',
              new RawRadio({
                value: 'a',
                groupRegistry: registry,
                toggleable,
                enabled,
                builder: () => new SizedBox(24, 24),
              }),
            );
          let clock = 0;
          const prepare = async () => {
            for (let attempt = 0; attempt < 20; ++attempt) {
              await host.flush();
              const state = await f.inspect();
              if (
                state.preparation ||
                state.contentWake ||
                state.document !== state.activeDocument ||
                state.metrics !== state.layoutMetrics
              )
                await f.ready();
              await f.tick(++clock);
              if ((await f.inspect()).renderWake) await f.present();
              await host.pollEvents();
              const frame = await view.semanticsSnapshot();
              if (
                frame.publication &&
                frame.document === frame.publishedDocument &&
                frame.metrics === frame.publishedMetrics &&
                !frame.interactionCount
              )
                return frame;
            }
            throw Error('Source Radio did not publish');
          };
          const peer = (frame) =>
            frame.nodes.find((node) => node.semantics?.role === p.semanticsRoles.radio);
          const rejected = async (frame, status = p.statuses.capabilityMissing) => {
            await assert.rejects(
              view.semanticAction(peer(frame).node, frame.publication, 'deselect'),
              (error) => error instanceof EngineError && error.status === status,
            );
          };
          try {
            await f.resize(200, 100);
            await host.mount(tree());
            let frame = await prepare();
            assert.ok(frame.capabilities & p.capabilities.canonicalSelection);
            assert.ok(peer(frame).semantics.actions & p.semanticsActions.deselect);
            assert.equal(clients.size, 1);
            await view.semanticAction(peer(frame).node, frame.publication, 'deselect');
            assert.deepEqual(calls, [], 'Core does not invoke or duplicate the Source policy');
            assert.ok(
              peer(await view.semanticsSnapshot()).semantics.flags & p.semanticsFlags.checked,
            );
            await host.pollEvents();
            assert.deepEqual(calls, [null]);
            frame = await prepare();
            assert.ok(peer(frame).semantics.flags & p.semanticsFlags.checked);
            assert.equal(
              registry.groupValue,
              'a',
              'A controlled rejection leaves selection intact',
            );
            await view.semanticAction(peer(frame).node, frame.publication, 'deselect');
            registry.groupValue = null;
            await host.pollEvents();
            assert.deepEqual(
              calls,
              [null],
              'A queued deselection cannot reselect a newer Source value',
            );
            await host.update(tree());
            frame = await prepare();
            assert.equal(peer(frame).semantics.actions & p.semanticsActions.deselect, 0);
            await rejected(frame);
            registry.groupValue = 'a';
            await host.update(tree({ toggleable: false }));
            frame = await prepare();
            assert.ok(peer(frame).semantics.flags & p.semanticsFlags.checked);
            assert.equal(peer(frame).semantics.actions & p.semanticsActions.deselect, 0);
            await rejected(frame);
            await view.semanticAction(peer(frame).node, frame.publication, 'activate');
            await host.pollEvents();
            assert.deepEqual(calls, [null], 'Normal Radio activation keeps its Source selection');
            await host.update(tree());
            const oldFrame = await prepare();
            await host.update(tree({ toggleable: false }));
            await rejected(oldFrame);
            frame = await prepare();
            await host.update(tree({ enabled: false }));
            frame = await prepare();
            assert.ok(peer(frame).semantics.flags & p.semanticsFlags.disabled);
            await rejected(frame);
            await host.update(tree());
            frame = await prepare();
            await view.semanticAction(peer(frame).node, frame.publication, 'deselect');
            await host.pollEvents();
            assert.deepEqual(calls, [null, null]);
            frame = await prepare();
            assert.equal(frame.transactionWork, BigInt(host.counters.commands));
            assert.ok(frame.semanticsWork >= 3n);
            assert.equal(frame.controlWork, 0n);
            assert.equal(host.execution.tsLayoutFallbacks, 0);
            assert.equal(host.execution.rejectedFallbacks, 0);
            assert.deepEqual(errors, []);
            const retired = peer(frame).node;
            await host.close();
            assert.equal(clients.size, 0);
            await assert.rejects(view.semanticAction(retired, frame.publication, 'deselect'));
            assert.equal(
              (
                await f.send(
                  p.opcodes.semanticsAction,
                  semanticActionBody(retired, frame.publication, 'deselect'),
                )
              ).status,
              p.statuses.closed,
            );
            assert.deepEqual(calls, [null, null]);
          } finally {
            FlutterError.onError = previous;
            await host.close();
            await client.close();
          }
        }),
    );
    test(
      `${profile}: malformed Radio deselection metadata rolls back the complete transaction`,
      { timeout },
      () =>
        using(profile, async (f) => {
          const selected = {
            role: 'radio',
            flags: p.semanticsFlags.checked,
            actions: p.semanticsActions.activate | p.semanticsActions.deselect,
          };
          await f.start([
            c.create(h(1), 'box'),
            c.properties(h(1), { width: 24, height: 24 }),
            c.semantics(h(1), selected),
          ]);
          const before = await f.inspect();
          for (const config of [
            { ...selected, role: 'checkbox' },
            { ...selected, flags: 0 },
            { ...selected, actions: p.semanticsActions.deselect },
            { ...selected, actions: selected.actions | 256 },
          ]) {
            const result = await f.commit([
              c.properties(h(1), { width: 80, height: 60 }),
              c.semantics(h(1), config),
            ]);
            assert.equal(result.status, p.statuses.invalidValue);
            const state = await f.inspect();
            assert.equal(state.document, before.document);
            assert.equal(state.transactionWork, before.transactionWork);
            assert.equal(state.nodes[0].width, 24);
          }
          assert.equal((await f.commit([c.semantics(h(1), selected)])).status, p.statuses.accepted);
        }),
    );
  }
}
