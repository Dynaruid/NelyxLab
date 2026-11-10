// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import {
  EngineClient,
  createWasmTransport,
  commands as c,
  body,
  protocol as p,
  focusBody,
  editBody,
} from '@nelyx/core/engine';
import factory from '../engine/dist/single-worker/engine.mjs';

const watchdog = setTimeout(() => {
  throw Error('Browser projection checks exceeded 20 minutes');
}, 1200000);
let browser;
let client;
try {
  const transport = createWasmTransport(await factory());
  client = await EngineClient.connect(transport);
  const view = await client.openView(1);
  const root = { slot: 1, generation: 1 },
    clip = { slot: 2, generation: 1 },
    button = { slot: 3, generation: 1 },
    editor = { slot: 4, generation: 1 };
  const request = async (opcode, data) => {
    const r = await view.request(opcode, data);
    assert.equal(r.status, p.statuses.ok, `opcode ${opcode}`);
    return r;
  };
  let clock = 0;
  const publish = async () => {
    let prepared;
    for (let i = 0; i < 20; ++i) {
      prepared = await request(
        p.opcodes.contentStep,
        body(8, (v) => v.setUint32(0, p.limits.contentPerStep, true)),
      );
      if (prepared.preparationReady) break;
    }
    assert(prepared.preparationReady);
    await request(
      p.opcodes.tick,
      body(8, (v) => v.setFloat64(0, ++clock, true)),
    );
    const frame = await request(p.opcodes.takeFrame);
    const done = body(24, (v) => {
      v.setBigUint64(0, frame.submission, true);
      v.setBigUint64(8, frame.device, true);
      v.setUint32(16, 1, true);
    });
    await request(p.opcodes.releaseFrame, done);
    new DataView(done.buffer).setUint32(16, 0, true);
    await request(p.opcodes.publish, done);
  };
  await request(
    p.opcodes.metrics,
    body(40, (v) => {
      v.setBigUint64(0, 2n, true);
      v.setFloat64(8, 320, true);
      v.setFloat64(16, 240, true);
      v.setFloat64(24, 1, true);
    }),
  );
  await request(
    p.opcodes.visibility,
    body(16, (v) => v.setUint32(0, 3, true)),
  );
  await view.commit([
    c.create(root, 'stack'),
    c.create(clip, 'clip', 0, { parent: root }),
    c.create(button, 'box', 0, { parent: clip }),
    c.properties(clip, { width: 160, height: 100 }),
    c.properties(button, { width: 80, height: 40 }),
    c.graphics(clip, {
      transform: [1, 0, 0, 1, 10, 20],
      path: [['move', 0, 0], ['line', 160, 0], ['line', 0, 100], ['close']],
      fillRule: 'evenOdd',
    }),
    c.semantics(button, {
      role: 'button',
      label: 'Projected action',
      actions: p.semanticsActions.activate,
    }),
    c.nativePaint(button, [
      {
        kind: 'shape',
        color: 0xff123456,
        shape: {
          kind: 'rrect',
          radii: Array(8).fill(0),
          strokeWidth: 0,
          strokeColor: 0,
          strokeAlign: 0,
        },
      },
    ]),
    c.create(editor, 'editable', 0, { parent: root, index: 1 }),
    c.properties(editor, { width: 100, height: 20 }),
    c.editor(editor),
    c.semantics(editor, {
      role: 'textField',
      label: 'Projected editor',
      actions: p.semanticsActions.focus,
    }),
  ]);
  await publish();
  const appBase = await view.observeApp(p.opcodes.semanticsSnapshot);
  const script = await build({
    stdin: {
      resolveDir: process.cwd(),
      contents: `import {EngineV2BrowserInteraction} from './Nelyx/sdk/src/runtime/engine-v2-interaction.ts';
        globalThis.projectionErrors=[];
        globalThis.interaction=new EngineV2BrowserInteraction(document.querySelector('canvas'),
          async bytes=>new Uint8Array(await exchangeBrowserForCheck(Array.from(bytes))),
          message=>projectionErrors.push(message));
        globalThis.refreshProjection=async()=>{
          interaction.update();
          while(interaction.syncing||interaction.wanted)await new Promise(r=>setTimeout(r,0));
          await interaction.tail;
          if(projectionErrors.length)throw Error(projectionErrors.join(';'));
          return {...interaction.counters};
        };`,
    },
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    logLevel: 'silent',
  });
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  page.setDefaultTimeout(15000);
  let projectedRequests = 0;
  await page.exposeFunction('exchangeBrowserForCheck', async (bytes) => {
    const data = new Uint8Array(bytes),
      wire = new DataView(data.buffer);
    if (wire.getUint16(p.headerFields.opcode, true) === p.opcodes.semanticsSnapshot) {
      assert.equal(data.length, p.headerBytes + 4);
      assert.equal(wire.getUint32(p.headerBytes, true), p.inspectionFlags.browserObservation);
      ++projectedRequests;
    }
    return Array.from(await transport.exchange(data));
  });
  await page.setContent(
    '<canvas style="position:absolute;left:10px;top:15px;width:320px;height:240px"></canvas>',
  );
  await page.addScriptTag({ content: script.outputFiles[0].text });
  const refresh = () => page.evaluate(() => refreshProjection());
  const first = await refresh();
  assert.equal(first.snapshots, 1);
  assert.equal(await page.getByRole('button', { name: 'Projected action' }).count(), 1);
  assert.equal(await page.locator('textarea').count(), 1);
  assert.match(
    await page.evaluate(() => interaction.geometry.get('2:1').style.clipPath),
    /evenodd/,
  );
  assert.equal(await page.evaluate(() => interaction.peers.get('3:1').node.nativePaint), null);
  await page.evaluate(() => {
    globalThis.retainedButton = interaction.peers.get('3:1').element;
    globalThis.mutations = [];
    globalThis.observer = new MutationObserver((records) =>
      mutations.push(...records.map((r) => ({ type: r.type, name: r.attributeName }))),
    );
    observer.observe(interaction.layer, {
      attributes: true,
      childList: true,
      subtree: true,
      characterData: true,
    });
  });
  // Three accepted documents can arrive while the same published scene is
  // still visible. None may reinstall that old ARIA/geometry tree.
  for (let i = 0; i < 3; ++i) {
    await view.commit([c.paint(button, 0xff000000 + i)]);
    await refresh();
  }
  const stable = await page.evaluate(() => ({
    ...interaction.counters,
    mutations: mutations.splice(0),
    same: retainedButton === interaction.peers.get('3:1').element,
  }));
  assert.equal(stable.snapshots, first.snapshots);
  assert.equal(stable.skippedProjections - first.skippedProjections, 3);
  assert.equal(stable.domStyleWrites, first.domStyleWrites);
  assert.deepEqual(stable.mutations, []);
  assert(stable.same);
  // A canvas embedding move is independent of Core's publication identity.
  await page.evaluate(() => (document.querySelector('canvas').style.left = '30px'));
  await refresh();
  assert.equal(await page.evaluate(() => interaction.layer.style.left), '30px');
  await publish();
  await refresh();
  await view.commit([
    c.graphics(clip, {
      transform: [1, 0, 0, 1, 30, 40],
      path: [['move', 0, 0], ['line', 160, 0], ['line', 0, 100], ['close']],
      fillRule: 'evenOdd',
    }),
    c.semantics(button, {
      role: 'button',
      label: 'Updated action',
      flags: p.semanticsFlags.disabled,
      actions: p.semanticsActions.activate,
    }),
  ]);
  await publish();
  await refresh();
  assert.equal(
    await page.getByRole('button', { name: 'Updated action' }).getAttribute('aria-disabled'),
    'true',
  );
  assert.match(
    await page.evaluate(() => interaction.geometry.get('2:1').style.transform),
    /30, 40/,
  );
  // Reinstall the exact published cohort: zero actual DOM mutations, including
  // CSS normalization, ARIA ownership, editor selection and clip geometry.
  const repeated = await page.evaluate(async (opcode) => {
    const scene = await interaction.call(opcode);
    interaction.install(scene);
    await Promise.resolve();
    mutations.splice(0);
    interaction.install(scene);
    await Promise.resolve();
    return mutations.splice(0);
  }, p.opcodes.semanticsSnapshot);
  assert.deepEqual(repeated, []);
  // Live editor/focus revisions invalidate the small-state guard even without
  // a new visual publication. Pending browser input retains its local value.
  let state = await view.inspectState();
  await request(p.opcodes.focus, focusBody(editor, state.publication));
  state = await view.inspectState();
  const revision = BigInt(
    await page.evaluate(() => interaction.peers.get('4:1').value.revision.toString()),
  );
  await request(
    p.opcodes.edit,
    editBody(editor, {
      kind: 'update',
      revision,
      text: 'fresh',
      base: 2,
      extent: 4,
      composingStart: -1,
      composingEnd: -1,
      session: state.focus.session,
      publication: state.publication,
    }),
  );
  await refresh();
  assert.equal(await page.locator('textarea').inputValue(), 'fresh');
  assert.deepEqual(
    await page
      .locator('textarea')
      .evaluate((e) => [e.selectionStart, e.selectionEnd, document.activeElement === e]),
    [2, 4, true],
  );
  await page.evaluate(() => {
    const peer = interaction.peers.get('4:1');
    peer.pending = 1;
    peer.composing = true;
    peer.element.value = 'local IME';
    peer.element.setSelectionRange(3, 6);
  });
  await page.evaluate(async (opcode) => {
    const scene = await interaction.call(opcode);
    interaction.install(scene);
  }, p.opcodes.semanticsSnapshot);
  assert.equal(await page.locator('textarea').inputValue(), 'local IME');
  assert.deepEqual(
    await page.locator('textarea').evaluate((e) => [e.selectionStart, e.selectionEnd]),
    [3, 6],
  );
  await page.evaluate(async () => {
    await new Promise((r) => setTimeout(r, 0));
    const peer = interaction.peers.get('4:1');
    peer.pending = 0;
    peer.composing = false;
  });
  const appAfterBrowser = await view.observeApp(p.opcodes.semanticsSnapshot);
  assert.equal(appAfterBrowser.observation.full, false);
  assert.equal(appBase.observation.full, true);
  // A recycled slot never inherits the old DOM action/geometry carrier.
  await view.commit([
    c.destroy(button, true),
    c.destroy(editor, true),
    c.create({ ...button, generation: 2 }, 'box', 0, { parent: clip }),
    c.properties({ ...button, generation: 2 }, { width: 80, height: 40 }),
    c.semantics({ ...button, generation: 2 }, { role: 'button', label: 'Recycled action' }),
  ]);
  await publish();
  await refresh();
  assert.equal(await page.evaluate(() => retainedButton.isConnected), false);
  assert.equal(await page.getByRole('button', { name: 'Recycled action' }).count(), 1);
  await page.evaluate(async () => {
    observer.disconnect();
    await interaction.close();
  });
  assert.equal(await page.locator('[data-nelyx-v2-semantics]').count(), 0);
  await view.close();
  console.log(
    JSON.stringify({
      result: 'Browser projection PASS',
      projectedRequests,
      unchangedAcceptedDocuments: 3,
      repeatedInstallMutations: repeated.length,
    }),
  );
} finally {
  clearTimeout(watchdog);
  await browser?.close();
  await client?.close();
}
