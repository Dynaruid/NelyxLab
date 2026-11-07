// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { engineRoot, timeout } from '../tools/build.mjs';
import { canvasKitTestSupply } from './canvaskit-supply.mjs';
import { fontResourceFixture } from './font-resource-fixture.mjs';
import { wasmFactory } from './transports.mjs';
import { CanvasKitProvider } from '../render/canvaskit-web/provider.ts';
import { FontPreparation } from '../platform/web/font-preparation.ts';
import { AppTextBudget, WebAppTextBackend } from '../platform/web/app-text.ts';
import { exchange, request } from '../platform/web/common.ts';
import { preparedTransfers } from '../platform/web/actors.ts';
import { OriginalWidgetHost } from '../../runtime/engine-client/original.ts';
import {
  EngineClient,
  EngineError,
  protocol as p,
  appTextQuotaBytes,
  body,
  measurementBody,
  fontResourceReadBytes,
  readFontResourceSlice,
} from '../../runtime/engine-client/index.ts';
import { LeafRenderObjectWidget } from '@nelyx/core/framework/widgets/framework';
import { SizedBox, ColoredBox, Column } from '@nelyx/core/framework/widgets/basic';
import { RenderBox, registerNativeRenderMetadata } from '@nelyx/core/framework/rendering/object';
import { TextPainter } from '@nelyx/core/framework/painting/text-painter';
import { FontLoader, bindFontLoader } from '@nelyx/core/services/font-loader';
import { loadFontFromList } from '@nelyx/core/ui/fonts';
import { TextSpan } from '@nelyx/core/framework/painting/text-span';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { Canvas } from '@nelyx/core/ui/canvas';
import { Offset } from '@nelyx/core/ui/offset';

class RecordedText extends LeafRenderObjectWidget {
  constructor(record) {
    super();
    this.record = record;
  }
  createRenderObject(context) {
    return new RecordedTextBox(context, this.record);
  }
}
class RecordedTextBox extends RenderBox {
  constructor(context, record) {
    super();
    this.context = context;
    this.record = record;
    record.box = this;
  }
  static {
    registerNativeRenderMetadata(RecordedTextBox.prototype, (source) => source.metadata());
  }
  metadata() {
    const record = this.record;
    if (!record.canvas || record.dynamic) {
      record.painter ??= new TextPainter(
        {
          text: new TextSpan({
            text: 'אבגד 123',
            style: new TextStyle({ fontSize: 32, color: 0xff172033 }),
          }),
          textDirection: 'ltr',
        },
        {
          text: this.context.services.text,
          resources: this.context.services.resources,
          font: this.context.services.defaultFont,
          scale: 1,
        },
      );
      record.painter.layout({ minWidth: 180, maxWidth: 180 });
      record.layout = record.painter._layoutSnapshot();
      const next = new Canvas();
      record.painter.paint(next, new Offset(0, 0));
      record.canvas?.dispose();
      record.canvas = next;
      if (!record.dynamic) {
        record.painter.dispose();
        record.painter = undefined;
      }
    }
    return {
      kind: 'paint',
      entries: record.canvas.commands.map((command) => ({
        kind: 'paragraph',
        paragraph: command.resource,
        color: 0,
        shape: {
          kind: 'rrect',
          radii: Array(8).fill(0),
          strokeWidth: 0,
          strokeColor: 0,
          strokeAlign: 0,
        },
        x: command.x,
        y: command.y,
      })),
    };
  }
  overrideDispose() {
    this.record.painter?.dispose();
    this.record.canvas?.dispose();
  }
  dispose() {
    try {
      this.overrideDispose();
    } finally {
      super.dispose();
    }
  }
}
async function until(predicate) {
  for (let i = 0; i < 30; ++i) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 8));
  }
  throw Error('Font control did not settle');
}

test(
  'Original Source font coordinator preserves immutable recordings, refreshes cached painters, resolves lost ACKs and closes pending work with real C++ owners',
  { timeout },
  async () => {
    const root = path.join(engineRoot, 'dist'),
      manifest = JSON.parse(fs.readFileSync(path.join(root, 'engine-manifest.json'))),
      supply = canvasKitTestSupply(),
      factory = createRequire(import.meta.url)(supply.js),
      wasmBinary = fs.readFileSync(supply.wasm),
      kits = [];
    assert.equal(manifest.abi.schema, p.schema);
    for (let i = 0; i < 3; ++i) kits.push(await factory({ wasmBinary }));
    const fonts = manifest.fonts.map((font) => ({
        id: manifest.files.find((file) => file.path === font.path).sha256,
        family: font.family,
        bytes: new Uint8Array(fs.readFileSync(path.join(root, font.path))),
      })),
      budget = new AppTextBudget(appTextQuotaBytes),
      backend = new WebAppTextBackend(new CanvasKitProvider(kits[0], fonts, budget), budget),
      content = new CanvasKitProvider(kits[1], fonts),
      render = new CanvasKitProvider(kits[2], fonts);
    const { module } = await wasmFactory(path.join(root, 'single-worker')),
      engine = module._nelyx_wasm_open(1, 1, p.schema, p.capabilities.protocol),
      messages = [],
      faults = new Map();
    let hideCommit = false,
      holdOwners = false,
      opaque = false,
      closed = false,
      gateNextTransaction = false,
      gateEntered,
      releaseGate,
      expectedDocumentFault = false,
      documentFaultErrors = 0,
      clock = 0,
      preparers = [],
      host;
    const check = () => {
      if (!holdOwners) preparers.forEach((owner) => owner.check());
    };
    const client = await EngineClient.connect({
        async exchange(bytes) {
          const op = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(
            12,
            true,
          );
          if (op === p.opcodes.transaction && gateNextTransaction) {
            gateNextTransaction = false;
            await new Promise((resolve) => {
              releaseGate = resolve;
              gateEntered();
            });
          }
          const result = exchange(module, engine, bytes);
          if (hideCommit && op === p.opcodes.fontTransitionCommit) opaque = true;
          if (
            [
              p.opcodes.fontTransitionBegin,
              p.opcodes.fontTransitionCommit,
              p.opcodes.fontTransitionAbort,
            ].includes(op)
          )
            check();
          if (
            opaque &&
            [
              p.opcodes.fontTransitionCommit,
              p.opcodes.fontTransitionAbort,
              p.opcodes.inspect,
            ].includes(op)
          )
            throw new EngineError(p.statuses.timedOut, 'Injected unknown font ACK');
          if (faults.get(op) > 0) {
            faults.set(op, faults.get(op) - 1);
            throw new EngineError(p.statuses.timedOut, 'Injected lost font ACK');
          }
          return result;
        },
        close() {},
      }),
      view = await client.openView(1);
    preparers = [
      new FontPreparation(module, engine, content, 'content', (value) => messages.push(value)),
      new FontPreparation(module, engine, render, 'render', (value) => messages.push(value)),
    ];
    const fixture = fontResourceFixture(root),
      old = { dynamic: false },
      fresh = { dynamic: true },
      heldA = { dynamic: true };
    render.surface = kits[2].MakeSurface(240, 240);
    render.resize = () => {};
    assert.ok(render.surface);
    host = new OriginalWidgetHost(view, {
      appText: backend,
      pollEvents: false,
      onError: (error) => {
        if (
          expectedDocumentFault &&
          error instanceof EngineError &&
          error.status === p.statuses.timedOut
        )
          ++documentFaultErrors;
        else messages.push({ kind: 'app-error', error });
      },
    });
    let sourceFontNotices = 0;
    host.owner.systemFonts.addListener(() => ++sourceFontNotices);
    const nodeRoot = new SizedBox(
      240,
      240,
      new ColoredBox({
        color: 0xfff4f6fa,
        child: new Column(
          [old, fresh, heldA].map((record) => new SizedBox(180, 64, new RecordedText(record))),
          { crossAxisAlignment: 'start', mainAxisSize: 'min' },
        ),
      }),
    );
    const fontRead = (resource, at, length, preparation) => {
      const state = request(
        module,
        engine,
        p.opcodes.fontResourceRead,
        fontResourceReadBytes(resource, at, length, preparation),
      );
      assert.equal(state.status, p.statuses.ok);
      return readFontResourceSlice(state);
    };
    const pixels = (surface, kit) => {
      const image = surface.makeImageSnapshot();
      try {
        return image
          .readPixels(0, 0, {
            width: surface.width(),
            height: surface.height(),
            colorType: kit.ColorType.RGBA_8888,
            alphaType: kit.AlphaType.Premul,
            colorSpace: kit.ColorSpace.SRGB,
          })
          .slice();
      } finally {
        image.delete();
      }
    };
    const crop = (pixels, y) =>
      Uint8Array.from(
        { length: 180 * 64 * 4 },
        (_, index) => pixels[(y + Math.floor(index / (180 * 4))) * 240 * 4 + (index % (180 * 4))],
      );
    const paint = async () => {
      await host.flush();
      let state;
      for (let i = 0; i < 30; ++i) {
        state = await view.request(
          p.opcodes.contentStep,
          body(8, (data) => data.setUint32(0, p.limits.contentPerStep, true)),
        );
        if (state.measureRequest) {
          const demand = await view.request(p.opcodes.measureRequest),
            release = content.acquireFontResources(demand, fontRead);
          try {
            const measured = content.measure(demand);
            assert.equal(
              (await view.request(p.opcodes.measureResult, measurementBody(demand, measured)))
                .status,
              p.statuses.ok,
            );
          } finally {
            release();
          }
        }
        if (state.preparationReady) break;
      }
      assert.ok(state.preparationReady);
      const scene = await view.request(p.opcodes.preparationScene),
        release = content.acquireFontResources(scene, fontRead);
      let prepared;
      try {
        prepared = content.prepare(scene, false);
      } finally {
        release();
      }
      render.import(structuredClone(prepared, { transfer: preparedTransfers(prepared) }));
      await view.request(
        p.opcodes.tick,
        body(8, (data) => data.setFloat64(0, (clock += 0.01), true)),
      );
      const frame = await view.request(p.opcodes.takeFrame);
      assert.equal(frame.status, p.statuses.ok);
      render.draw(frame, 240, 240, 1);
      render.retireExcept(frame.activePreparation);
      content.releasePacket(scene.preparation);
      const result = pixels(render.surface, kits[2]),
        receipt = body(24, (data) => {
          data.setBigUint64(0, frame.submission, true);
          data.setBigUint64(8, frame.device, true);
        });
      await view.request(p.opcodes.releaseFrame, receipt);
      await view.request(p.opcodes.publish, receipt);
      const control = kits[0].MakeSurface(180, 64);
      assert.ok(control);
      try {
        control.getCanvas().clear(kits[0].Color(244, 246, 250, 1));
        const entry = host.textService.entries.get(fresh.layout);
        assert.ok(entry);
        control.getCanvas().drawParagraph(backend.entries.get(entry.handle).paragraph, 0, 0);
        const actual = crop(result, 64),
          expected = pixels(control, kits[0]);
        assert.equal(
          actual.reduce((count, value, index) => count + (value !== expected[index]), 0),
          0,
          'Core/Content/Render pixels match the measured App C++ paragraph',
        );
      } finally {
        control.delete();
      }
      assert.equal(frame.transactionWork, BigInt(host.execution.acknowledgedCommands));
      assert.equal(backend.snapshot().layouts, host.execution.appText.sdkLayouts);
      assert.equal(backend.snapshot().queries, host.execution.appText.sdkQueries);
      return { frame, pixels: result };
    };
    try {
      assert.equal(
        (
          await view.request(
            p.opcodes.metrics,
            body(40, (data) => {
              data.setBigUint64(0, 2n, true);
              data.setFloat64(8, 240, true);
              data.setFloat64(16, 240, true);
              data.setFloat64(24, 1, true);
            }),
          )
        ).status,
        p.statuses.ok,
      );
      await host.mount(nodeRoot);
      const initial = await paint(),
        oldPixels = crop(initial.pixels, 0);
      const mutable = fixture.a.slice();
      for (const op of [
        p.opcodes.fontUploadBegin,
        p.opcodes.fontUploadChunk,
        p.opcodes.fontUploadCommit,
        p.opcodes.fontTransitionBegin,
        p.opcodes.fontTransitionReady,
        p.opcodes.fontTransitionCommit,
      ])
        faults.set(op, 1);
      const first = host.updateFontCatalog(mutable);
      mutable.fill(0);
      assert.equal(await first, 2);
      const a = await paint(),
        aPixels = crop(a.pixels, 64);
      heldA.dynamic = false;
      assert.deepEqual(crop(a.pixels, 0), oldPixels);
      assert.ok(
        a.frame.nodes.some(
          (node) =>
            node.fontBinding?.pinned &&
            node.fontBinding.fontRevision === 2n &&
            node.fontBinding.resource,
        ),
      );
      faults.set(p.opcodes.fontTransitionCommit, 2);
      assert.equal(await host.updateFontCatalog(fixture.b), 3);
      const b = await paint();
      assert.notDeepEqual(crop(b.pixels, 64), aPixels);
      assert.deepEqual(crop(b.pixels, 128), aPixels);
      assert.deepEqual(crop(b.pixels, 0), oldPixels);
      assert.equal(host.execution.fonts.rollbacks, 0);

      hideCommit = true;
      await assert.rejects(host.updateFontCatalog(fixture.a), /unresolved/);
      assert.equal(host.execution.fonts.pending, true);
      assert.equal(backend.snapshot().fontRevision, 4);
      assert.equal(host.textService.fontRevision, 3);
      assert.equal(backend.snapshot().fontStages, 1);
      await assert.rejects(
        host.updateFontCatalog(fixture.b),
        (error) => error.status === p.statuses.busy,
      );
      const oldInput = { ...fresh.layout.input, text: 'אבגד 12A' };
      const pendingOld = host.textService.layout(oldInput);
      assert.equal(
        host.textService.entries.get(pendingOld).fontRevision,
        3,
        'Unknown Core ACK retains synchronous old App admission',
      );
      host.resources.releaseProducer(pendingOld.resource);
      opaque = false;
      hideCommit = false;
      assert.equal(await host.recoverFontUpdate(), 4);
      assert.equal(backend.snapshot().fontStages, 0);
      assert.equal(host.execution.fonts.rollbacks, 0);
      const recovered = await paint();
      assert.deepEqual(crop(recovered.pixels, 64), aPixels);

      // Reserve the actual Core resource quota in other views. A known upload
      // rejection must roll back its App stage and return the unused SDK slot.
      const extra = [await client.openView(2), await client.openView(3)],
        reservations = [];
      try {
        const occupied = Number((await view.request(p.opcodes.inspect)).resourceBytes);
        let remaining = p.limits.resourceBytes - occupied - 128;
        for (const other of extra) {
          const resource = other.allocateResource(),
            size = Math.min(p.limits.fontCatalogBytes, remaining);
          remaining -= size;
          await other.beginFontUpload(resource, size, 1n);
          reservations.push({ other, resource });
        }
        assert.equal(remaining, 0);
        await assert.rejects(
          host.updateFontCatalog(fixture.a),
          (error) => error.status === p.statuses.budgetExceeded,
        );
        assert.equal(host.execution.fonts.pending, false);
        assert.equal(backend.snapshot().fontStages, 0);
        assert.equal(backend.snapshot().fontRevision, 4);
      } finally {
        for (const { other, resource } of reservations) {
          await other.finishFontUpload(1n, false);
          other.recycleResource(resource, false);
        }
        for (const other of extra) await other.close();
      }

      const make = content.makeAppFontCatalog.bind(content);
      content.makeAppFontCatalog = () => {
        throw Error('Injected Content preparation refusal');
      };
      try {
        await assert.rejects(host.updateFontCatalog(fixture.a), /preparation failed/);
      } finally {
        content.makeAppFontCatalog = make;
      }
      assert.equal(backend.snapshot().fontRevision, 4);
      assert.equal((await view.request(p.opcodes.inspect)).fontRevision, 4n);
      holdOwners = true;
      const pending = host.updateFontCatalog(fixture.a);
      pending.catch(() => {});
      await until(
        () => request(module, engine, p.opcodes.inspect).fontTransition?.phase === 'preparing',
      );
      await assert.rejects(
        host.updateFontCatalog(fixture.b),
        (error) => error.status === p.statuses.busy,
      );
      host.cancelFontUpdate();
      await assert.rejects(pending, (error) => error.status === p.statuses.canceled);
      holdOwners = false;
      check();
      const activate = backend.activateFonts.bind(backend);
      let discardedRevision;
      backend.activateFonts = (stage) => {
        discardedRevision = activate(stage);
        host.cancelFontUpdate();
        return discardedRevision;
      };
      try {
        await assert.rejects(
          host.updateFontCatalog(fixture.b),
          (error) => error.status === p.statuses.canceled,
        );
      } finally {
        backend.activateFonts = activate;
      }
      assert.equal(discardedRevision, 5);
      assert.equal(backend.snapshot().fontRevision, 4);
      assert.equal(await host.updateFontCatalog(null), 6);
      const reset = await paint();
      assert.deepEqual(crop(reset.pixels, 0), oldPixels);
      assert.deepEqual(crop(reset.pixels, 128), aPixels);
      // A captured document can wait in transport after Source disposes its
      // recording and a second font update has dropped the current-cohort hold.
      const entered = new Promise((resolve) => (gateEntered = resolve));
      gateNextTransaction = true;
      assert.equal(await host.updateFontCatalog(fixture.b), 7);
      await entered;
      const capturedFont = host.fontOwner.entries.get(7).binding.resource;
      assert.equal(await host.updateFontCatalog(fixture.a), 8);
      fresh.canvas.dispose();
      fresh.painter.dispose();
      fresh.canvas = fresh.painter = undefined;
      await host.fontOwner.drain();
      assert.equal((await view.readFontResource(capturedFont, 0, 32)).bytes.length, 32);
      const delayedDocument = host.running;
      delayedDocument.catch(() => {});
      expectedDocumentFault = true;
      faults.set(p.opcodes.transaction, 1);
      faults.set(p.opcodes.queryResult, 2);
      releaseGate();
      releaseGate = undefined;
      await assert.rejects(delayedDocument, (error) => error.status === p.statuses.timedOut);
      assert.equal(view.hasPendingTransaction, true);
      await assert.rejects(host.flush(), (error) => error.status === p.statuses.timedOut);
      assert.notEqual(host.sceneFonts, host.pendingSceneFonts);
      assert.equal((await view.readFontResource(capturedFont, 0, 32)).bytes.length, 32);
      const final = await paint();
      expectedDocumentFault = false;
      assert.equal(view.hasPendingTransaction, false);
      assert.equal(host.pendingSceneFonts, undefined);
      await host.fontOwner.drain();
      await assert.rejects(view.readFontResource(capturedFont, 0, 32));
      assert.deepEqual(crop(final.pixels, 0), oldPixels);
      assert.deepEqual(crop(final.pixels, 128), aPixels);
      assert.equal(sourceFontNotices, 6);
      const fontBinding = bindFontLoader({
        loadFont: (bytes, family) => host.loadFont(bytes, family),
      });
      try {
        const a = new FontLoader('LoadedA'),
          b = new FontLoader('LoadedB'),
          source = fixture.font.slice();
        a.addFont(Promise.resolve(source));
        b.addFont(Promise.resolve(fixture.changed));
        holdOwners = true;
        const loading = Promise.all([a.load(), b.load()]);
        loading.catch(() => {});
        await until(
          () => request(module, engine, p.opcodes.inspect).fontTransition?.phase === 'preparing',
        );
        assert.equal(host.execution.fonts.fontLoadsPending, 2);
        assert.ok(backend.snapshot().fontBuffers >= 2);
        source.fill(0);
        await assert.rejects(
          host.updateFontCatalog(null),
          (error) => error.status === p.statuses.busy,
        );
        holdOwners = false;
        check();
        await loading;
        assert.ok(backend.snapshot().fontFamilies.includes('LoadedA'));
        assert.ok(backend.snapshot().fontFamilies.includes('LoadedB'));
        assert.equal(backend.snapshot().fontBuffers, 0);
        assert.equal(backend.snapshot().fontBufferBytes, 0);
        assert.equal(host.execution.fonts.fontLoadsPending, 0);
        assert.equal(host.execution.fonts.fontLoadBytes, 0);
        assert.equal(host.execution.fonts.fontLoadCatalogCredits, 0);
        assert.equal(sourceFontNotices, 8);
        const uiBytes = fixture.font.slice(),
          inferred = loadFontFromList(uiBytes, { fontFamily: '' });
        uiBytes.fill(0);
        await inferred;
        assert.ok(backend.snapshot().fontFamilies.includes('Noto Sans Hebrew'));
        await loadFontFromList(fixture.changed, { fontFamily: 'UiAlias' });
        assert.ok(backend.snapshot().fontFamilies.includes('UiAlias'));
        const valid = backend.snapshot();
        await assert.rejects(loadFontFromList(new Uint8Array(16)), /font decode/i);
        assert.equal(backend.snapshot().fontRevision, valid.fontRevision);
        assert.equal(backend.snapshot().fontBuffers, 0);
        assert.equal(host.execution.fonts.fontLoadBytes, 0);
        assert.equal(sourceFontNotices, 10);
        await host.updateFontCatalog(null);
        assert.equal(backend.snapshot().fontFamilies.includes('LoadedA'), false);
        assert.equal(sourceFontNotices, 11);
      } finally {
        holdOwners = false;
        fontBinding.dispose();
      }
      const loaded = await paint();
      assert.deepEqual(crop(loaded.pixels, 0), oldPixels);
      assert.deepEqual(crop(loaded.pixels, 128), aPixels);
      const beforeClose = host.execution;
      // Queue admission is synchronous and credits both immutable captures.
      // Cancel before the pump can decode a deliberately large caller buffer.
      const large = new Uint8Array(8 * 1024 * 1024);
      large.set(fixture.font);
      const queueA = host.loadFont(large),
        queueB = host.loadFont(large, ''),
        cancelledQueue = Promise.allSettled([queueA, queueB]);
      assert.equal(host.execution.fonts.fontLoadBytes, 16 * 1024 * 1024);
      const overflow = assert.rejects(
        host.loadFont(fixture.font, 'QueueOverflow'),
        /queue byte budget/,
      );
      host.cancelFontUpdate();
      await overflow;
      for (const result of await cancelledQueue) {
        assert.equal(result.status, 'rejected');
        assert.equal(result.reason.status, p.statuses.canceled);
      }
      assert.equal(backend.snapshot().fontBufferBytes, 0);
      holdOwners = true;
      const closing = host.loadFont(fixture.font, 'ClosingA'),
        queuedClosing = host.loadFont(fixture.changed, 'ClosingB');
      closing.catch(() => {});
      queuedClosing.catch(() => {});
      await until(
        () => request(module, engine, p.opcodes.inspect).fontTransition?.phase === 'preparing',
      );
      await host.close();
      closed = true;
      await assert.rejects(closing, (error) => error.status === p.statuses.canceled);
      await assert.rejects(queuedClosing, (error) => error.status === p.statuses.canceled);
      holdOwners = false;
      check();
      assert.equal(backend.snapshot().fontStages, 0);
      assert.equal(backend.snapshot().paragraphs, 0);
      assert.equal(backend.snapshot().fontBuffers, 0);
      assert.equal(host.execution.fonts.fontLoadBytes, 0);
      console.log(
        JSON.stringify({
          control: 'Original-Source-three-heaps',
          cppCommands: String(loaded.frame.transactionWork),
          sdkCommands: beforeClose.acknowledgedCommands,
          cppLayout: String(loaded.frame.layoutWork),
          contentLayouts: content.counters.paragraphLayouts,
          app: beforeClose.appText,
          fonts: host.execution.fonts,
          pixelDiff: 0,
          retainedBundle: true,
          retainedCustom: true,
          delayedDocumentFaults: documentFaultErrors,
          sourceFontNotices,
          tsFallbacks: beforeClose.tsLayoutFallbacks,
        }),
      );
      assert.equal(messages.filter((message) => message.kind === 'app-error').length, 0);
    } finally {
      opaque = false;
      hideCommit = false;
      holdOwners = false;
      faults.clear();
      releaseGate?.();
      if (!closed) await host.close();
      preparers.forEach((owner) => owner.stop());
      content.close();
      render.close();
      try {
        await client.abort();
      } finally {
        module._nelyx_engine_destroy(engine);
      }
    }
  },
);
