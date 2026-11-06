// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { OriginalWidgetHost } from '../../runtime/engine-client/original.ts';
import { EngineClient, protocol as p } from '../../runtime/engine-client/index.ts';
import { Directionality } from '@nelyx/core/framework/widgets/app-data';
import { Stack, Padding, SizedBox, ColoredBox } from '@nelyx/core/framework/widgets/basic';
import {
  CompositedTransformTarget,
  CompositedTransformFollower,
} from '@nelyx/core/framework/widgets/composited-transform';
import {
  LayerLink,
  LayerHandle,
  LeaderLayer,
  FollowerLayer,
} from '@nelyx/core/framework/rendering/layer';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { Alignment } from '@nelyx/core/framework/painting/alignment';

export function originalLayerContracts({ using, timeout }) {
  test(
    'native: original composited targets and followers retain Source link identities across move, unlink, rejection and close',
    { timeout },
    () =>
      using('native', async (f, transport) => {
        const client = await EngineClient.connect(transport),
          view = await client.openView(1),
          errors = [],
          host = new OriginalWidgetHost(view, {
            pollEvents: false,
            onError: (e) => errors.push(e),
          }),
          link = new LayerLink(),
          leaderKey = new GlobalKey('Source leader'),
          followerKey = new GlobalKey('Source follower');
        const matrix = (x = 0, y = 0) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, 0, 1];
        const colored = (w, h, color) => new SizedBox(w, h, new ColoredBox({ color }));
        const target = (left, key = null, connection = link) =>
          new Padding(
            { left, top: 30 },
            new CompositedTransformTarget(colored(80, 40, 0xff123456), { link: connection, key }),
          );
        const tree = (
          left = 40,
          linked = true,
          showWhenUnlinked = false,
          duplicate = false,
          connection = link,
        ) =>
          new Directionality(
            'ltr',
            new Stack(
              [
                linked ? target(left, leaderKey, connection) : new SizedBox(1, 1),
                new Padding(
                  { left: 200, top: 160 },
                  new CompositedTransformFollower(colored(20, 10, 0xffabcdef), {
                    link: connection,
                    key: followerKey,
                    showWhenUnlinked,
                    offset: { x: 5, y: 7 },
                    targetAnchor: Alignment.bottomRight,
                    followerAnchor: Alignment.center,
                  }),
                ),
                ...(duplicate ? [target(10, null, connection)] : []),
              ],
              {
                textDirection: 'ltr',
                alignment: Alignment.topLeft,
                fit: 'loose',
                clipBehavior: 'none',
              },
            ),
          );
        const prepare = async () => {
          await host.flush();
          let state = await f.inspect();
          if (
            state.contentWake ||
            state.preparation ||
            state.document !== state.activeDocument ||
            state.layoutMetrics !== state.metrics
          )
            await f.ready();
          else await f.tick();
          state = await f.inspect();
          if (state.renderWake) await f.present();
          await host.pollEvents();
          return view.semanticsSnapshot();
        };
        const follower = (frame) => frame.nodes.find((n) => n.color === 0xffabcdef);
        let other, held, stop;
        try {
          await f.resize(300, 200);
          await host.mount(tree());
          const sourceFollower = followerKey.currentContext.findRenderObject();
          assert.equal(sourceFollower.layer, null);
          assert.equal(link.leader, null);
          assert.equal(link.leaderSize, null);
          let frame = await prepare();
          assert.deepEqual(follower(frame).matrix, [1, 0, 0, 1, 115, 72]);
          const leader = leaderKey.currentContext.findRenderObject().layer,
            layer = sourceFollower.layer,
            compositions = [];
          assert.ok(leader instanceof LeaderLayer);
          assert.ok(layer instanceof FollowerLayer);
          assert.equal(link.leader, leader);
          assert.deepEqual(link.leaderSize, { width: 80, height: 40 });
          assert.equal(layer.owner, leader.owner);
          assert.deepEqual(layer.getLastTransform(), matrix(-85, -88));
          assert.deepEqual(sourceFollower.getCurrentTransform(), matrix(-85, -88));
          assert.deepEqual(layer.applyTransform(null), matrix(-85, -88));
          held = new LayerHandle(layer);
          assert.equal(layer.supportsRasterization(), false);
          assert.throws(
            () => {
              layer.linkedOffset = { x: 1, y: 2 };
            },
            (error) => error.code === 'native-layer-mutation',
          );
          assert.throws(
            () => layer.addToScene({}),
            (error) => error.code === 'native-layer-operation',
          );
          stop = layer.addCompositionCallback((observed) => {
            compositions.push({
              transform: observed.getLastTransform(),
              leader: link.leader,
              size: link.leaderSize,
            });
            assert.throws(
              () => {
                observed.linkedOffset = { x: 1, y: 2 };
              },
              (error) => error.code === 'native-layer-mutation' || error.code === 'locked-layer',
            );
          });
          await host.pollEvents();
          assert.equal(
            compositions.length,
            0,
            'Polling one publication does not duplicate composition callbacks',
          );
          await host.update(tree(60));
          assert.deepEqual(
            layer.getLastTransform(),
            matrix(-85, -88),
            'Native ACK does not advance the last composed transform',
          );
          frame = await prepare();
          assert.deepEqual(follower(frame).matrix, [1, 0, 0, 1, 135, 72]);
          assert.equal(sourceFollower.layer, layer);
          assert.equal(compositions.length, 1);
          assert.deepEqual(compositions[0].transform, matrix(-65, -88));
          assert.equal(compositions[0].leader, leader);
          const unchanged = await f.inspect(),
            replacement = new LayerLink();
          await host.update(tree(60, true, false, false, replacement));
          assert.equal(
            (await f.inspect()).document,
            unchanged.document,
            'Replacing only JS link identities preserves an equivalent native graph',
          );
          assert.equal(link.leader, null);
          assert.equal(replacement.leader, leader);
          assert.equal(layer.link, replacement);
          assert.deepEqual(layer.getLastTransform(), matrix(-65, -88));
          assert.equal(compositions.length, 1);
          await host.update(tree(60));
          assert.equal(link.leader, leader);
          assert.equal(replacement.leader, null);
          for (let i = 0; i < 12; i++) await host.update(tree(60 + i));
          await host.pollEvents();
          assert.deepEqual(
            layer.getLastTransform(),
            matrix(-65, -88),
            'A delayed publication remains observable across more than eight ACKs',
          );
          frame = await prepare();
          assert.deepEqual(follower(frame).matrix, [1, 0, 0, 1, 146, 72]);
          assert.deepEqual(layer.getLastTransform(), matrix(-54, -88));
          await host.update(tree(60, false));
          frame = await prepare();
          assert.equal(link.leader, null);
          assert.equal(layer.getLastTransform(), null);
          assert.deepEqual(
            layer.linkedOffset,
            { x: 75, y: 42 },
            'Unlinked Source configuration retains its last laid-out leader size',
          );
          assert.deepEqual(sourceFollower.getCurrentTransform(), matrix());
          assert.equal(!!(follower(frame).flags & 16), false);
          await host.update(tree(60, false, true));
          assert.equal(
            layer.showWhenUnlinked,
            false,
            'Layer configuration stays at its published paint phase until composition',
          );
          frame = await prepare();
          assert.equal(layer.showWhenUnlinked, true);
          assert.deepEqual(follower(frame).matrix, [1, 0, 0, 1, 200, 160]);
          assert.ok(follower(frame).flags & 16);
          const before = await f.inspect();
          await assert.rejects(host.update(tree(60, true, false, true)), /duplicate-layer-leader/);
          const after = await f.inspect();
          assert.equal(after.document, before.document);
          assert.equal(after.transactionWork, before.transactionWork);
          await host.update(tree());
          frame = await prepare();
          assert.deepEqual(follower(frame).matrix, [1, 0, 0, 1, 115, 72]);
          assert.equal(frame.transactionWork, BigInt(host.counters.commands));
          assert.equal(host.execution.tsLayoutFallbacks, 0);
          assert.equal(host.execution.appGeometryNodes, 0);
          assert.equal(host.execution.rejectedFallbacks, 1);
          assert.deepEqual(errors, []);
          const otherView = await client.openView(2);
          other = new OriginalWidgetHost(otherView, { pollEvents: false });
          const otherTree = () =>
            new CompositedTransformFollower(colored(10, 10, 0xffaabbcc), { link });
          await assert.rejects(other.mount(otherTree()), /foreign-layer-link/);
          assert.equal(other.execution.observed, false);
          assert.equal((await otherView.request(p.opcodes.inspect)).transactionWork, 0n);
          await host.close();
          assert.equal(layer.attached, false);
          assert.equal(
            layer.debugDisposed,
            false,
            'An external LayerHandle keeps its Source object alive',
          );
          assert.equal(layer.getLastTransform(), null);
          assert.equal(link.leader, null);
          held.dispose();
          assert.equal(layer.debugDisposed, true);
          await other.update(otherTree());
          assert.equal(
            other.execution.observed,
            true,
            'Closing a View releases its Source link ownership',
          );
          assert.equal(
            (await otherView.request(p.opcodes.inspect)).transactionWork,
            BigInt(other.counters.commands),
          );
        } finally {
          stop?.();
          held?.dispose();
          await other?.close();
          await host.close();
          await client.abort();
        }
      }),
  );
}
