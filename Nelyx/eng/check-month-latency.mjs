// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import {
  createEngineV2Server,
  verifyEngineV2Application,
} from '../sdk/tooling/cli/src/engine-v2-runner.mjs';
const application = verifyEngineV2Application('sample/nelyx-demo-app/engine-v2/dist/v2-web', 'web');
const server = createEngineV2Server(application);
const providerReads = process.argv.includes('--baseline-reads');
const fullPictures = process.argv.includes('--full-pictures');
const wireDiagnostics = process.argv.includes('--wire');
const lazyProviderRows = process.argv.includes('--lazy-provider-rows');
const fullProviderFrames = process.argv.includes('--full-provider-frames') || lazyProviderRows;
const fullProviderPreparations = process.argv.includes('--full-provider-preparations');
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
const watchdog = setTimeout(() => {
  throw Error('Month latency checks exceeded 20 minutes');
}, 1200000);
try {
  for (const profile of process.argv.includes('--plain')
    ? ['plain']
    : process.argv.includes('--both')
      ? ['isolated', 'plain']
      : ['isolated']) {
    const context = await browser.newContext({
      viewport: { width: 960, height: 720 },
      deviceScaleFactor: 1,
    });
    let page;
    let profiler;
    try {
      page = await context.newPage();
      page.setDefaultTimeout(15000);
      const errors = [];
      const intercept = (pattern, handler) =>
        page.route(pattern, async (route) => {
          try {
            await handler(route);
          } catch (error) {
            errors.push(String(error));
            await route.abort().catch(() => {});
          }
        });
      // Same-supply diagnostic oracle: restore the former provider queues
      // without retaining another engine/application copy or changing App work.
      if (
        providerReads ||
        fullPictures ||
        wireDiagnostics ||
        fullProviderFrames ||
        fullProviderPreparations
      )
        await intercept(/\/(owner|coordinator)\.js$/, async (route) => {
          const response = await route.fetch(),
            original = await response.text();
          let body = original;
          if (fullProviderFrames) {
            const marker = 'deltaEnabled = true;';
            assert.equal(body.split(marker).length, 2, 'Provider frame mode hook must be unique');
            body = body.replace(marker, 'deltaEnabled = false;');
          }
          if (fullProviderPreparations) {
            const marker = 'preparationDeltaEnabled = true;';
            assert.equal(
              body.split(marker).length,
              2,
              'Provider preparation mode hook must be unique',
            );
            body = body.replace(marker, 'preparationDeltaEnabled = false;');
          }
          // Compose hooks in one response: overlapping route handlers would
          // silently discard earlier ablations when flags are combined.
          if (providerReads && route.request().url().endsWith('/coordinator.js')) {
            const marker = 'const immediateRead = isImmediateRead(bytes);';
            assert.equal(body.split(marker).length, 2, 'Immediate read routing must be unique');
            body = body.replace(marker, 'const immediateRead = false;');
          }
          if (fullPictures) {
            const marker = 'function emptyOwnPicture(node) {';
            assert.equal(
              body.split(marker).length,
              2,
              'Full picture oracle requires the provider predicate',
            );
            body = body.replace(marker, marker + ' return false;');
          }
          if (wireDiagnostics || lazyProviderRows) {
            const marker =
              /return response\(exchange\((module\d*), (engine\d*), packet\(op, owner, data, id\)\)\);/g;
            assert.equal(
              [...body.matchAll(marker)].length,
              1,
              'Provider request hook must be unique',
            );
            body = body.replace(
              marker,
              (_text, module, engine) => `
              const wireStarted=performance.now(), input=packet(op, owner, data, id),
                wireEncoded=performance.now(), output=exchange(${module}, ${engine}, input),
                wireDispatched=performance.now(), result=response(output${lazyProviderRows ? ',{appObservation:true,ownedObservation:true}' : ''}), wireDecoded=performance.now();
              const operations=globalThis.__monthWire??=Object.create(null),
                row=operations[op]??={calls:0,inputBytes:0,outputBytes:0,encodeMs:0,exchangeMs:0,decodeMs:0,maxExchangeMs:0,maxDecodeMs:0};
              ++row.calls;row.inputBytes+=input.length;row.outputBytes+=output.length;
              row.encodeMs+=wireEncoded-wireStarted;row.exchangeMs+=wireDispatched-wireEncoded;
              row.decodeMs+=wireDecoded-wireDispatched;
              row.maxExchangeMs=Math.max(row.maxExchangeMs,wireDispatched-wireEncoded);
              row.maxDecodeMs=Math.max(row.maxDecodeMs,wireDecoded-wireDispatched);
              return result;`,
            );
          }
          if (wireDiagnostics) {
            const exchangeMarker =
              /const output = exchange\(this\.module, this\.engine, packet\((\w+)\.opcodes\.takeFrame, owner, data\)\);/g;
            assert.equal(
              [...body.matchAll(exchangeMarker)].length,
              1,
              'Provider frame exchange hook must be unique',
            );
            body = body.replace(
              exchangeMarker,
              (_text, schema) => `
              const frameWireStarted=performance.now(), frameInput=packet(${schema}.opcodes.takeFrame, owner, data),
                frameWireEncoded=performance.now(), output=exchange(this.module,this.engine,frameInput),
                frameWireExchanged=performance.now(), frameOperations=globalThis.__monthWire??=Object.create(null),
                frameRow=frameOperations[${schema}.opcodes.takeFrame]??={calls:0,inputBytes:0,outputBytes:0,encodeMs:0,exchangeMs:0,decodeMs:0,maxExchangeMs:0,maxDecodeMs:0};
              ++frameRow.calls;frameRow.inputBytes+=frameInput.length;frameRow.outputBytes+=output.length;
              frameRow.encodeMs+=frameWireEncoded-frameWireStarted;frameRow.exchangeMs+=frameWireExchanged-frameWireEncoded;
              frameRow.maxExchangeMs=Math.max(frameRow.maxExchangeMs,frameWireExchanged-frameWireEncoded);`,
            );
            const decodeMarker =
              /frame = response\(output, \{[\s\S]*?observationOwner: "provider-frame\/1:1:1:1"\s*\}\);/g;
            assert.equal(
              [...body.matchAll(decodeMarker)].length,
              1,
              'Provider frame decode hook must be unique',
            );
            body = body.replace(
              decodeMarker,
              (text) => `const frameDecodeStarted=performance.now();${text}
              const frameDecodeElapsed=performance.now()-frameDecodeStarted;
              frameRow.decodeMs+=frameDecodeElapsed;frameRow.maxDecodeMs=Math.max(frameRow.maxDecodeMs,frameDecodeElapsed);`,
            );
            const preparationExchange =
              /const output = exchange\(\s*this\.module,\s*this\.engine,\s*packet\((\w+)\.opcodes\.preparationScene, owner, data\)\s*\);/g;
            assert.equal(
              [...body.matchAll(preparationExchange)].length,
              1,
              'Preparation exchange hook must be unique',
            );
            body = body.replace(
              preparationExchange,
              (_text, schema) =>
                `const prepStarted=performance.now(),prepInput=packet(${schema}.opcodes.preparationScene,owner,data),
              prepEncoded=performance.now(),output=exchange(this.module,this.engine,prepInput),prepExchanged=performance.now(),
              prepOperations=globalThis.__monthWire??=Object.create(null),
              prepRow=prepOperations[${schema}.opcodes.preparationScene]??={calls:0,inputBytes:0,outputBytes:0,encodeMs:0,exchangeMs:0,decodeMs:0,maxExchangeMs:0,maxDecodeMs:0};
              ++prepRow.calls;prepRow.inputBytes+=prepInput.length;prepRow.outputBytes+=output.length;
              prepRow.encodeMs+=prepEncoded-prepStarted;prepRow.exchangeMs+=prepExchanged-prepEncoded;
              prepRow.maxExchangeMs=Math.max(prepRow.maxExchangeMs,prepExchanged-prepEncoded);`,
            );
            const preparationDecode =
              /scene = response\(output, \{[\s\S]*?observationOwner: "provider-preparation\/1:1:1:1"\s*\}\);/g;
            assert.equal(
              [...body.matchAll(preparationDecode)].length,
              1,
              'Preparation decode hook must be unique',
            );
            body = body.replace(
              preparationDecode,
              (text) => `const prepDecodeStarted=performance.now();${text}
              const prepElapsed=performance.now()-prepDecodeStarted;prepRow.decodeMs+=prepElapsed;
              prepRow.maxDecodeMs=Math.max(prepRow.maxDecodeMs,prepElapsed);`,
            );
            const marker =
              'this.provider.draw(frame, this.viewport.width, this.viewport.height, this.viewport.scale);';
            assert.equal(body.split(marker).length, 2, 'Provider draw hook must be unique');
            body = body.replace(
              marker,
              `const monthDrawStarted=performance.now();${marker}
              const monthDrawElapsed=performance.now()-monthDrawStarted,
                monthDraw=globalThis.__monthDraw??={calls:0,elapsedMs:0,maxMs:0};
              ++monthDraw.calls;monthDraw.elapsedMs+=monthDrawElapsed;monthDraw.maxMs=Math.max(monthDraw.maxMs,monthDrawElapsed);`,
            );
          }
          await route.fulfill({ response, body });
        });
      if (process.argv.includes('--stages'))
        await page.addInitScript(() => {
          const NativeWorker = globalThis.Worker;
          globalThis.__monthStages = [];
          globalThis.Worker = class extends NativeWorker {
            constructor(...args) {
              super(...args);
              this.addEventListener('message', (event) => {
                if (event.data?.kind !== 'stats') return;
                const content = event.data.value?.['content-stats']?.timing;
                if (content && content.preparation !== globalThis.__monthLastPreparation) {
                  globalThis.__monthLastPreparation = content.preparation;
                  if (globalThis.__monthStages.length >= 128)
                    throw Error('Uncollected month timing samples exceeded their bound');
                  globalThis.__monthStages.push({
                    ...content,
                    wallMs: content.completedAtMs - content.startedAtMs,
                  });
                }
              });
            }
          };
        });
      page.on('pageerror', (error) => errors.push(error.message));
      await intercept('**/application/main.js', async (route) => {
        const response = await route.fetch(),
          original = await response.text();
        const marker = 'this.layer.dataset.nelyxV2Semantics = "";';
        assert.equal(original.split(marker).length, 2, 'Browser interaction owner must be unique');
        await route.fulfill({
          response,
          body: original.replace(marker, marker + ' globalThis.__monthInteraction = this;'),
        });
      });
      await intercept('**/application/app.js', async (route) => {
        const response = await route.fetch(),
          original = await response.text();
        const instrumented = original.replace(
          /hosts\.set\(view, (host\d*)\);/,
          'hosts.set(view, $1); globalThis.__monthHost=$1;',
        );
        assert.notEqual(original, instrumented);
        await route.fulfill({ response, body: instrumented });
      });
      await page.goto(`http://127.0.0.1:${server.address().port}/${profile}/`);
      await page.waitForFunction(() => __nelyxV2?.ready || __nelyxV2?.errors.length);
      const worker = page.workers().find((worker) => worker.url().includes('/application/app.js'));
      assert(worker);
      await worker.evaluate(() => {
        const h = globalThis.__monthHost,
          action = h.native.options.onSemanticAction;
        h.monthSetupActions = [];
        h.monthRestoreActions = () => {
          h.native.options.onSemanticAction = action;
        };
        h.native.options.onSemanticAction = (event, perform) => {
          const source = event.semanticSource ?? event.node;
          const record = [...h.native.accepted.values()].find(
            (candidate) =>
              candidate.handle.slot === source.slot &&
              candidate.handle.generation === source.generation,
          );
          const row = {
            node: source,
            label: record?.node.options.semantics?.label,
            publication: String(event.id),
            invoked: false,
          };
          if (h.monthSetupActions.length === 16) h.monthSetupActions.shift();
          h.monthSetupActions.push(row);
          action(event, () => {
            row.invoked = true;
            perform();
          });
        };
      });
      const click = (label) =>
        page
          .locator(
            `[aria-label=${JSON.stringify(label)}], [aria-description=${JSON.stringify(label)}]`,
          )
          .first()
          .evaluate((e) => e.click());
      await click('Explore components');
      await page.getByRole('button', { name: 'Selection', exact: true }).evaluate((e) => e.click());
      await click('Choose date');
      await page.getByRole('button', { name: /^15, / }).waitFor();
      await worker.evaluate(() => __monthHost.monthRestoreActions());
      const settleApp = () =>
        worker.evaluate(async () => {
          const host = globalThis.__monthHost,
            scheduler = host.scrolling.scheduler,
            start = performance.now();
          while (performance.now() - start < 15000) {
            const state = await host.view.inspectState();
            if (
              !host.running &&
              !host.scheduled &&
              !host.rerun &&
              !state.preparation &&
              state.document === state.publishedDocument &&
              !host.native.observationRunning &&
              !host.native.observationPending &&
              scheduler.phase === 'idle' &&
              !scheduler.hasScheduledFrame &&
              !scheduler.transientCallbackCount &&
              !scheduler.pendingPostFrame &&
              state.nextDeadline === null
            )
              return String(state.publication);
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
          throw Error('Month preparation did not settle');
        });
      const settle = async () => {
        const deadline = Date.now() + 15000;
        let publication = await settleApp();
        while (Date.now() < deadline) {
          await page.waitForFunction(
            (expected) => {
              const owner = globalThis.__monthInteraction;
              return (
                owner &&
                !owner.syncing &&
                !owner.wanted &&
                owner.queued === 0 &&
                owner.publication >= BigInt(expected)
              );
            },
            publication,
            { timeout: Math.max(1, deadline - Date.now()) },
          );
          const current = await settleApp();
          if (current === publication) return;
          publication = current;
        }
        throw Error('App/Core/Main publication did not settle');
      };
      await settle();
      const wireSamples = async () =>
        (
          await Promise.all(
            page.workers().map(async (owner) => ({
              url: owner.url(),
              ...(await owner.evaluate(() => {
                const operations = globalThis.__monthWire,
                  draw = globalThis.__monthDraw;
                globalThis.__monthWire = Object.create(null);
                globalThis.__monthDraw = undefined;
                return { timeOriginMs: performance.timeOrigin, operations, draw };
              })),
            })),
          )
        ).filter((owner) => owner.operations && Object.keys(owner.operations).length);
      if (wireDiagnostics) await wireSamples();
      if (process.argv.includes('--flow'))
        await worker.evaluate(() => {
          const host = globalThis.__monthHost;
          globalThis.__monthFlow = [];
          const record = (value) => {
            if (__monthFlow.length >= 256) throw Error('Uncollected month flow exceeded its bound');
            __monthFlow.push({ at: performance.now(), ...value });
          };
          const rebuild = host.rebuildFromContent;
          host.rebuildFromContent = async function (observed) {
            const started = performance.now();
            const state = observed ?? (await this.view.inspectState());
            await rebuild.call(this, state);
            const request = state.layoutBuildRequest;
            record({
              kind: 'source',
              started,
              document: state.document,
              active: state.activeDocument,
              published: state.publishedDocument,
              publication: state.publication,
              preparation: state.preparation,
              ready: state.preparationReady,
              input: state.consumedThrough,
              request: request
                ? {
                    id: request.id,
                    node: request.node,
                    revision: request.revision,
                    list: request.list,
                    horizontal: request.horizontal,
                    vertical: request.vertical,
                  }
                : null,
              builder: { ...this.builderDiagnostic },
              rerun: this.rerun,
            });
          };
          for (const [target, method] of [
            [host.view, 'inspectState'],
            [host.focusing, 'finishBuild'],
          ]) {
            const original = target[method];
            target[method] = async function (...args) {
              const started = performance.now();
              try {
                return await original.apply(this, args);
              } finally {
                record({ kind: method, started });
              }
            };
          }
          const adopt = host.native.adopt;
          host.native.adopt = function (desired, changes) {
            const kinds = {};
            const paints = [];
            for (const command of changes) {
              const kind = new DataView(
                command.buffer,
                command.byteOffset,
                command.byteLength,
              ).getUint16(0, true);
              kinds[kind] = (kinds[kind] ?? 0) + 1;
              const bytes = new DataView(command.buffer, command.byteOffset, command.byteLength);
              if (kind === 27 || (kind === 40 && bytes.getUint32(24, true) === 27)) {
                const id = bytes.getUint32(8, true) + ':' + bytes.getUint32(12, true);
                paints.push({
                  id,
                  before: this.accepted.get(id)?.node.options.nativePaint?.map((p) => p.kind),
                  after: desired.get(id)?.node.options.nativePaint?.map((p) => p.kind),
                });
              }
            }
            record({
              kind: 'adopt',
              document: host.view.documentEpoch,
              nodes: desired.size,
              commands: changes.length,
              kinds,
              paints,
            });
            return adopt.call(this, desired, changes);
          };
        });
      if (process.argv.includes('--cpu')) profiler = await startCpuProfile(browser, context, page);
      if (process.argv.includes('--stages'))
        await page.evaluate(() => globalThis.__monthStages.splice(0));
      if (process.argv.includes('--dom'))
        console.log(
          'Calendar DOM',
          await page.getByRole('button', { name: /^Select year/ }).evaluate((element) => ({
            header: element.outerHTML.slice(0, 800),
            root: element.getRootNode().constructor.name,
            days: [...element.getRootNode().querySelectorAll('[aria-label],[aria-description]')]
              .filter((e) => (e.getAttribute('aria-label') ?? '').includes('15,'))
              .slice(0, 2)
              .map((e) => e.outerHTML.slice(0, 600)),
          })),
        );
      const samples = [],
        startTitle = await page
          .getByRole('button', { name: /^Select year/ })
          .getAttribute('aria-label');
      const match = /Select year\s+([A-Za-z]+)\s+(\d{4})/.exec(startTitle);
      assert(match, startTitle);
      const date = new Date(`${match[1]} 15, ${match[2]}`);
      assert(!Number.isNaN(date.valueOf()));
      const snapshot = () =>
        worker.evaluate(() => {
          const h = globalThis.__monthHost;
          return JSON.parse(
            JSON.stringify(h.diagnostics(), (_, v) => (typeof v === 'bigint' ? String(v) : v)),
          );
        });
      let previous = await snapshot();
      const providerCounters = () =>
        page.evaluate(() => ({
          ...globalThis.__nelyxV2.surface.diagnostics['content-stats']?.counters,
        }));
      let previousProvider = await providerCounters();
      const renderCounters = () =>
        page.evaluate(() => ({
          ...globalThis.__nelyxV2.surface.diagnostics['render-stats']?.counters,
        }));
      let previousRender = await renderCounters();
      const frameCounters = () =>
        page.evaluate(() => ({
          ...__nelyxV2.surface.diagnostics['render-stats']?.frameStream,
        }));
      let previousFrames = await frameCounters();
      const preparationCounters = () =>
        page.evaluate(
          () => __nelyxV2.surface.diagnostics['content-stats']?.preparationStream ?? {},
        );
      let previousPreparations = await preparationCounters();
      const mainCounters = () =>
        page.evaluate(() => ({ ...__nelyxV2.surface.diagnostics.interaction }));
      let previousMain = await mainCounters();
      const steps = Number(process.argv[process.argv.indexOf('--steps') + 1]) || 18;
      assert(steps > 0 && steps <= 24);
      for (let step = 0; step < steps; ++step) {
        const direction = step < 12 || step >= 15 ? -1 : 1;
        date.setMonth(date.getMonth() + direction);
        const month = new Intl.DateTimeFormat('en-US', {
          month: 'long',
          year: 'numeric',
        }).format(date);
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        const days = [1, 15, lastDay].map(
          (value) =>
            value +
            ', ' +
            new Intl.DateTimeFormat('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            }).format(new Date(date.getFullYear(), date.getMonth(), value)),
        );
        const settleStarted = performance.now();
        const readyMs = await page.getByRole('button', { name: /^Select year/ }).evaluate(
          (header, { month, days, direction }) =>
            new Promise((resolve, reject) => {
              const root = header.getRootNode(),
                name = direction < 0 ? 'Previous month' : 'Next month';
              const label = (element) =>
                (element.getAttribute('aria-label') ?? '').replace(/\s+/g, ' ').trim();
              const button = [...root.querySelectorAll('[aria-label],[aria-description]')].find(
                (element) =>
                  label(element) === name || element.getAttribute('aria-description') === name,
              );
              if (!button) return reject(Error('Month navigation unavailable'));
              const started = performance.now(),
                observer = new MutationObserver(check),
                timer = setTimeout(() => {
                  observer.disconnect();
                  reject(Error('Published month grid timed out'));
                }, 15000);
              function check() {
                const nodes = [...root.querySelectorAll('[aria-label]')];
                if (
                  nodes.some((element) => label(element) === 'Select year ' + month) &&
                  days.every((day) =>
                    nodes.some(
                      (element) => label(element) === day && element.style.pointerEvents === 'auto',
                    ),
                  )
                ) {
                  clearTimeout(timer);
                  observer.disconnect();
                  resolve(performance.now() - started);
                }
              }
              observer.observe(root, {
                subtree: true,
                childList: true,
                attributes: true,
              });
              button.click();
              check();
            }),
          { month, days, direction },
        );
        await settle();
        const settledMs = performance.now() - settleStarted;
        const current = await snapshot();
        const provider = await providerCounters();
        const render = await renderCounters();
        const frames = await frameCounters();
        const preparationStream = await preparationCounters();
        const main = await mainCounters();
        const from = previous.samplesThrough,
          to = current.samplesThrough;
        const oldest = to - current.samples.length;
        assert(from >= oldest, 'Bounded diagnostic ring dropped uncollected samples');
        const app = current.samples.slice(from - oldest, to - oldest);
        const delta = Object.fromEntries(
          [
            'recordVisits',
            'allocatedVisits',
            'commands',
            'transactions',
            'blobRegistrations',
            'blobRegisteredBytes',
            'blobReferencedBytes',
            'recordsMs',
            'diffMs',
            'creationDepthVisits',
          ].map((key) => [key, current.scene[key] - previous.scene[key]]),
        );
        const appDurations = Object.fromEntries(
          ['buildMs', 'captureMs', 'sceneMs', 'waitMs'].map((key) => [
            key,
            app.reduce((sum, row) => sum + row[key], 0),
          ]),
        );
        samples.push({
          step: step + 1,
          month,
          direction,
          readyMs,
          settledMs,
          appPasses: app.length,
          appDurations,
          scene: delta,
          capture: current.capture.captured - previous.capture.captured,
          dynamic: current.capture.dynamic - previous.capture.dynamic,
          provider: Object.fromEntries(
            [
              'serializedBytes',
              'fontCatalogCopyBytes',
              'referencedFontCatalogs',
              'referencedPictures',
              'avoidedPictureCopyBytes',
              'paragraphLayouts',
              'reusedPictures',
              'pictures',
              'emptyPicturesSkipped',
              'livePaintKeysSkipped',
            ].map((key) => [key, (provider[key] ?? 0) - (previousProvider[key] ?? 0)]),
          ),
          render: Object.fromEntries(
            ['draws', 'clipCulledNodes'].map((key) => [
              key,
              (render[key] ?? 0) - (previousRender[key] ?? 0),
            ]),
          ),
          frameStream: {
            ...Object.fromEntries(
              [
                'frames',
                'responseBytes',
                'rowVisits',
                'changedRows',
                'fulls',
                'deltas',
                'registrations',
                'registrationCopyBytes',
                'resyncs',
                'fallbacks',
              ].map((key) => [key, (frames[key] ?? 0) - (previousFrames[key] ?? 0)]),
            ),
            retainedBytes: frames.retainedBytes,
            reservedBytes: frames.reservedBytes,
            retiredBytes: frames.retiredBytes,
          },
          preparationStream: {
            ...Object.fromEntries(
              [
                'scenes',
                'responseBytes',
                'rowVisits',
                'changedRows',
                'comparedSlots',
                'fulls',
                'deltas',
                'registrations',
                'registrationCopyBytes',
                'resyncs',
                'fallbacks',
                'decodeHits',
                'decodeMisses',
                'emptyScenes',
                'capacityGrowths',
                'capacityShrinks',
                'resizeScenes',
                'decodeRetired',
              ].map((key) => [
                key,
                (preparationStream[key] ?? 0) - (previousPreparations[key] ?? 0),
              ]),
            ),
            retainedBytes: preparationStream.retainedBytes,
            reservedBytes: preparationStream.reservedBytes,
            retiredBytes: preparationStream.retiredBytes,
            readers: preparationStream.readers,
          },
          main: Object.fromEntries(
            Object.keys(main)
              .filter((key) => typeof main[key] === 'number')
              .map((key) => [key, main[key] - (previousMain[key] ?? 0)]),
          ),
          ...(process.argv.includes('--stages')
            ? {
                content: await page.evaluate(() => globalThis.__monthStages.splice(0)),
              }
            : {}),
          ...(wireDiagnostics ? { wire: await wireSamples() } : {}),
          ...(process.argv.includes('--flow')
            ? {
                flow: await worker.evaluate(() =>
                  JSON.parse(
                    JSON.stringify(__monthFlow.splice(0), (_, value) =>
                      typeof value === 'bigint' ? String(value) : value,
                    ),
                  ),
                ),
                app,
              }
            : {}),
        });
        previous = current;
        previousProvider = provider;
        previousRender = render;
        previousFrames = frames;
        previousPreparations = preparationStream;
        previousMain = main;
      }
      const sorted = samples.map((s) => s.readyMs).sort((a, b) => a - b),
        percentile = (p) => sorted[Math.ceil(p * sorted.length) - 1];
      if (profiler) await profiler.report(profile);
      const uncacheable = process.argv.includes('--diagnose')
        ? await worker.evaluate(() => {
            const host = globalThis.__monthHost,
              names = new Map(),
              counts = {};
            for (const [render, entry] of host.capture.active) {
              const node = entry.scene.reference.currentNode;
              if (node) names.set(node.slot + ':' + node.generation, render.constructor.name);
            }
            for (const record of host.native.accepted.values())
              if (!record.fullyCacheable) {
                const reason = [...record.configByKind.keys()].filter(
                  (kind) => !record.configInputs.has(kind),
                );
                const name =
                  (names.get(record.handle.slot + ':' + record.handle.generation) ??
                    record.node.kind) +
                  '/' +
                  reason.join(',');
                counts[name] = (counts[name] ?? 0) + 1;
              }
            return Object.entries(counts)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 12);
          })
        : undefined;
      console.log(
        JSON.stringify(
          {
            profile,
            readsMode: providerReads ? 'provider-queues' : 'immediate',
            source: application.supply.manifest.sourceSha256,
            pictureMode: fullPictures ? 'full-recording-oracle' : 'empty-elision',
            wireDiagnostics,
            providerRows: lazyProviderRows ? 'lazy-prototype' : 'eager',
            frameMode: fullProviderFrames ? 'full-oracle' : 'provider-delta',
            preparationMode: fullProviderPreparations ? 'full-oracle' : 'provider-delta',
            condition:
              '960x720 DPR1 headless; font/assets ready; sequential navigation with normal bounded adjacent preparation; App/Core/Main projection settled between samples; no injected delay' +
              (profiler || wireDiagnostics || lazyProviderRows
                ? '; profiling enabled: diagnostic only'
                : ''),
            clock:
              'browser-performance programmatic semantics click to published header and interactive days 1/15/last via MutationObserver; App durations use a separate worker clock and overlap',
            count: samples.length,
            p50: percentile(0.5),
            p95: percentile(0.95),
            max: sorted.at(-1),
            samples,
            uncacheable,
            diagnostics: previous.transport,
          },
          (_, v) => (typeof v === 'bigint' ? String(v) : v),
        ),
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(await page.evaluate(() => __nelyxV2.errors), []);
    } catch (error) {
      if (page) {
        console.log(
          'MONTH_FAILURE',
          await page
            .evaluate(() => {
              const d = globalThis.__nelyxV2?.surface?.diagnostics,
                s = d?.['render-stats']?.state;
              return JSON.stringify(
                {
                  errors: globalThis.__nelyxV2?.errors,
                  interaction: d?.interaction,
                  document: s?.document,
                  published: s?.publishedDocument,
                  preparation: s?.preparation,
                  focused: s?.focused,
                  visible: s?.visible,
                  browserFocused: document.hasFocus(),
                  frameStream: d?.['render-stats']?.frameStream,
                  preparationError: d?.['preparation-error'],
                  buttons: [...document.querySelectorAll('[role="button"]')]
                    .slice(0, 48)
                    .map((e) => [e.getAttribute('aria-label'), e.getAttribute('aria-description')]),
                },
                (_, value) => (typeof value === 'bigint' ? String(value) : value),
              );
            })
            .catch(String),
        );
        const app = page.workers().find((w) => w.url().includes('/application/app.js'));
        console.log(
          'MONTH_SETUP_ACTIONS',
          await app?.evaluate(() => globalThis.__monthHost?.monthSetupActions).catch(String),
        );
      }
      throw error;
    } finally {
      await profiler?.close();
      if (page)
        console.log(
          profile,
          'close',
          await page
            .evaluate(async () => {
              const result = await __nelyxV2.close();
              return {
                reservedBytes: String(result.reservedBytes),
                workersStopped: result.workersStopped,
              };
            })
            .catch(String),
        );
      await context.close();
    }
  }
} finally {
  clearTimeout(watchdog);
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

// CPU samples stay in memory and are discarded after the bounded summary.
// Profiled wall times are diagnostic; compare performance with --cpu omitted.
async function startCpuProfile(browser, context, page) {
  const root = await browser.newBrowserCDPSession(),
    main = await context.newCDPSession(page),
    sessions = [],
    waiting = new Map();
  let sequence = 0;
  root.on('Target.receivedMessageFromTarget', ({ sessionId, message }) => {
    const result = JSON.parse(message),
      key = `${sessionId}:${result.id}`,
      pending = waiting.get(key);
    if (!pending) return;
    waiting.delete(key);
    if (result.error) pending.reject(Error(JSON.stringify(result.error)));
    else pending.resolve(result.result);
  });
  const send = (sessionId, method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++sequence,
        key = `${sessionId}:${id}`,
        timer = setTimeout(() => {
          waiting.delete(key);
          reject(Error('CPU profiler command timed out: ' + method));
        }, 15000);
      waiting.set(key, {
        resolve: (result) => {
          clearTimeout(timer);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      void root
        .send('Target.sendMessageToTarget', {
          sessionId,
          message: JSON.stringify({ id, method, params }),
        })
        .catch((error) => {
          waiting.delete(key);
          clearTimeout(timer);
          reject(error);
        });
    });
  const close = async () => {
    for (const { sessionId } of sessions)
      await root.send('Target.detachFromTarget', { sessionId }).catch(() => {});
    for (const pending of waiting.values()) pending.reject(Error('CPU profiler closed'));
    waiting.clear();
    await main.detach().catch(() => {});
    await root.detach().catch(() => {});
  };
  try {
    const prefix = page.url();
    for (const target of (await root.send('Target.getTargets')).targetInfos)
      if (target.type === 'worker' && target.url.startsWith(prefix)) {
        const { sessionId } = await root.send('Target.attachToTarget', {
          targetId: target.targetId,
          flatten: false,
        });
        sessions.push({ sessionId, url: target.url });
        await send(sessionId, 'Profiler.enable');
        await send(sessionId, 'Profiler.setSamplingInterval', {
          interval: 500,
        });
        await send(sessionId, 'Profiler.start');
      }
    await main.send('Profiler.enable');
    await main.send('Profiler.setSamplingInterval', { interval: 500 });
    await main.send('Profiler.start');
  } catch (error) {
    await close();
    throw error;
  }
  return {
    close,
    async report(profileName) {
      const profiles = [];
      for (const target of sessions)
        profiles.push({
          ...target,
          ...(await send(target.sessionId, 'Profiler.stop')),
        });
      profiles.push({ url: 'main', ...(await main.send('Profiler.stop')) });
      for (const { url, profile } of profiles) {
        const nodes = new Map(profile.nodes.map((node) => [node.id, node])),
          parents = new Map(),
          self = new Map(),
          inclusive = new Map(),
          frames = new Map();
        for (const node of profile.nodes)
          for (const child of node.children ?? []) parents.set(child, node.id);
        const add = (map, id, delta) => {
          const frame = nodes.get(id).callFrame,
            key = `${frame.url}:${frame.lineNumber}:${frame.columnNumber}/${frame.functionName}`;
          frames.set(key, frame);
          map.set(key, (map.get(key) ?? 0) + delta);
          return key;
        };
        for (let i = 0; i < (profile.samples?.length ?? 0); ++i) {
          let id = profile.samples[i];
          const delta = profile.timeDeltas[i] ?? 500,
            seen = new Set();
          add(self, id, delta);
          while (id) {
            const frame = nodes.get(id).callFrame,
              key = `${frame.url}:${frame.lineNumber}:${frame.columnNumber}/${frame.functionName}`;
            if (!seen.has(key)) {
              seen.add(key);
              add(inclusive, id, delta);
            }
            id = parents.get(id);
          }
        }
        const top = (map) =>
          [...map]
            .map(([key, us]) => ({
              ...frames.get(key),
              ms: +(us / 1000).toFixed(2),
            }))
            .filter((frame) => !['(root)', '(idle)'].includes(frame.functionName))
            .sort((a, b) => b.ms - a.ms)
            .slice(0, 18)
            .map((frame) => ({
              name: frame.functionName,
              ms: frame.ms,
              url: frame.url.split('/').slice(-2).join('/'),
              line: frame.lineNumber + 1,
              column: frame.columnNumber + 1,
            }));
        console.log(
          JSON.stringify({
            cpu: profileName,
            target: url,
            wallMs: (profile.endTime - profile.startTime) / 1000,
            self: top(self),
            inclusive: top(inclusive),
          }),
        );
      }
    },
  };
}
