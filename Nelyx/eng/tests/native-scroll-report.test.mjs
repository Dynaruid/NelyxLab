// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { SourceMap } from 'node:module';
import {
  nativeProbeReports,
  nativeScrollOptions,
  nativeScrollRuns,
  symbolicateNativeProfile,
  verifyNativeCatalogReports,
  verifyNativeResourceCycles,
} from '../run-native-scroll.mjs';
const timeout = 1_200_000;

test(
  'CPU trial batches cover each viewport once per fresh-process trial and reject mixed repetition scopes',
  { timeout },
  () => {
    const options = nativeScrollOptions(['--repeat', '3', '--viewport', 'both']),
      runs = nativeScrollRuns(options);
    assert.deepEqual(runs, [
      { trial: 1, viewport: 'default' },
      { trial: 1, viewport: 'maximized' },
      { trial: 2, viewport: 'default' },
      { trial: 2, viewport: 'maximized' },
      { trial: 3, viewport: 'default' },
      { trial: 3, viewport: 'maximized' },
    ]);
    assert.deepEqual(nativeScrollRuns(nativeScrollOptions([])), [
      { trial: 1, viewport: 'default' },
    ]);
    assert.equal(
      nativeScrollRuns(nativeScrollOptions(['--repeat', '3', '--input', 'os', '--catalog'])).length,
      3,
    );
    for (const args of [
      ['--repeat', '0'],
      ['--repeat', '4'],
      ['--repeat', '1.5'],
      ['--repeat', 'NaN'],
      ['--repeat', '2', '--scope', 'sampling'],
      ['--repeat', '2', '--scope', 'gc'],
      ['--repeat', '2', '--resource-cycles', '3'],
    ])
      assert.throws(() => nativeScrollOptions(args), /Repeat/);
  },
);
test(
  'full OS catalog qualification rejects missing delivery, unseen sections and a false surface join',
  { timeout },
  () => {
    const fixture = (viewport) => {
      const columns =
        viewport === 'maximized'
          ? { 'material-0': ['a'], 'material-1': ['b'], 'cupertino-0': ['c'] }
          : { 'material-0': ['a', 'b'], 'cupertino-0': ['c'] };
      return [
        'list-retained',
        'list-cold',
        'list-revisit',
        'list-fast',
        ...Object.keys(columns).flatMap((name) =>
          ['cold', 'revisit', 'fast'].map((suffix) => name + '-' + suffix),
        ),
      ].map((name) => {
        const column = Object.keys(columns).find((column) => name.startsWith(column)),
          expectedIds = columns[column];
        return {
          type: 'phase',
          name,
          pacing: 'os',
          scope: 'cpu',
          inputWindow: {
            pacing: 'os',
            before: {
              foreground: true,
              focusChanges: 1,
              keyboardMessages: 0,
              semanticsActions: 0,
              lastInputTick: 5,
              cursorParked: false,
            },
            after: {
              foreground: true,
              focusChanges: 1,
              keyboardMessages: 0,
              semanticsActions: 0,
              lastInputTick: 6,
              cursorParked: false,
            },
          },
          spans: 'disabled',
          buildMode: 'release',
          qualification: 'diagnostic-only',
          performanceAccepted: false,
          frameTurns: { builtTurns: 2 },
          receipts: {
            receiptIntegrity: true,
            displayed: 'unobserved',
            input: {
              received: 2,
              accepted: 2,
              rejected: 0,
              receivedWheelY: 2.4,
              receivedAbsoluteWheelY: 2.4,
            },
            surface: { n: 2 },
            inputToSurface: { eligible: 2, mapped: 2, pending: 0 },
          },
          workload: {
            count: 2,
            maximumInjected: 8192,
            injection: column ? 'until-edge' : 'fixed',
            sender: {
              done: true,
              emitted: 2,
              received: 2,
              error: '',
              foreign: 0,
              sentRaw: -6,
              receivedRaw: -6,
              sentAbsoluteRaw: 6,
              receivedAbsoluteRaw: 6,
              expectedCookie: 123,
              observedCookie: 123,
              pacingPolicy: 'high-resolution-relative-start-completion-v1',
              sendP50: 16,
              sendP95: 17,
              sendMax: 18,
            },
            ...(column
              ? {
                  coverage: {
                    scope:
                      'Core-visible sections joined to matching surface-copy content frames; display unobserved',
                    expectedIds,
                    builtSeenIds: expectedIds,
                    seenIds: expectedIds,
                    skippedIds: [],
                    builtFrames: 2,
                    matchingFrames: 2,
                    direction: name.endsWith('-revisit') ? 'reverse' : 'forward',
                    reachedEdge: true,
                    stopped: true,
                  },
                }
              : {}),
          },
        };
      });
    };
    for (const viewport of ['default', 'maximized'])
      assert.equal(
        verifyNativeCatalogReports(fixture(viewport), {
          viewport,
          material: ['a', 'b'],
          cupertino: ['c'],
        }).columns,
        viewport === 'default' ? 2 : 3,
      );
    const verify = (reports) =>
      verifyNativeCatalogReports(reports, {
        viewport: 'maximized',
        material: ['a', 'b'],
        cupertino: ['c'],
      });
    for (const change of [
      (reports) => reports.pop(),
      (reports) => delete reports[4].inputWindow,
      (reports) => reports[4].inputWindow.after.keyboardMessages++,
      (reports) => reports[4].inputWindow.after.semanticsActions++,
      (reports) => (reports[4].inputWindow.after.foreground = false),
      (reports) => (reports[4].workload.coverage.seenIds = []),
      (reports) => (reports[4].workload.coverage.scope = 'built frames only'),
      (reports) => (reports[4].workload.coverage.matchingFrames = 0),
      (reports) => (reports[4].workload.coverage.reachedEdge = false),
      (reports) => (reports[4].workload.coverage.skippedIds = ['a']),
      (reports) => (reports[4].workload.sender.observedCookie = 124),
      (reports) => (reports[4].workload.sender.sendP50 = 0),
      (reports) => (reports[4].receipts.input.receivedWheelY = 999),
      (reports) => (reports[4].receipts.inputToSurface.pending = 1),
    ]) {
      const reports = fixture('maximized');
      change(reports);
      assert.throws(() => verify(reports));
    }
    const fast = fixture('maximized')[6];
    assert.equal(fast.name, 'material-0-fast');
    const reports = fixture('maximized');
    reports[6].workload.coverage.seenIds = [];
    reports[6].workload.coverage.skippedIds = ['a'];
    assert.equal(verify(reports).material, 2);
    for (const field of ['expectedCookie', 'observedCookie', 'pacingPolicy']) {
      const reports = fixture('maximized');
      delete reports[4].workload.sender[field];
      assert.throws(() => verify(reports));
    }
  },
);
test(
  'bounded native diagnostic reports reassemble Unicode across the host log limit and reject partial evidence',
  { timeout },
  () => {
    const report = { type: 'phase', name: '한글😀'.repeat(4000) },
      text = JSON.stringify(report),
      total = Math.ceil(text.length / 1024),
      lines = [];
    for (let index = 0; index < total; index++) {
      const line =
        'NELYX_NATIVE_PROBE_CHUNK ' +
        JSON.stringify({ id: 1, index, total, text: text.slice(index * 1024, (index + 1) * 1024) });
      assert(Buffer.byteLength(line) < 8192);
      lines.push(line);
    }
    assert.deepEqual(nativeProbeReports(lines.join('\n')), [report]);
    for (const invalid of [
      lines.slice(1),
      lines.slice(0, -1),
      [lines[0], lines[0], ...lines.slice(1)],
      [lines[1], lines[0], ...lines.slice(2)],
    ])
      assert.throws(() => nativeProbeReports(invalid.join('\n')));
    assert.throws(() =>
      nativeProbeReports('NELYX_NATIVE_PROBE_CHUNK {"id":1,"index":0,"total":999999,"text":"x"}'),
    );
  },
);
test('native scroll options keep diagnostic modes and viewports explicit', { timeout }, () => {
  assert.equal(nativeScrollOptions([]).mode, 'bytecode');
  assert.equal(nativeScrollOptions(['--scope', 'gc', '--catalog']).catalog, true);
  assert.equal(
    nativeScrollOptions(['--scope', 'stages', '--hermes-mode', 'static-aot']).scope,
    'stages',
  );
  assert.equal(
    nativeScrollOptions(['--scroll-scenes', '--viewport', 'maximized', '--repeat', '3'])
      .scrollScenes,
    true,
  );
  assert.throws(() => nativeScrollOptions(['--scroll-scenes']), /Scroll scenes/);
  assert.equal(
    nativeScrollOptions(['--scroll-scenes', '--viewport', 'maximized', '--scope', 'gc']).scope,
    'gc',
  );
  assert.throws(
    () => nativeScrollOptions(['--scroll-scenes', '--viewport', 'maximized', '--catalog']),
    /Scroll scenes/,
  );
  assert.throws(
    () => nativeScrollOptions(['--scroll-scenes', '--viewport', 'maximized', '--input', 'os']),
    /Scroll scenes/,
  );
  assert.equal(nativeScrollOptions(['--scope', 'sampling', '--details']).details, true);
  assert.throws(() => nativeScrollOptions(['--scope', 'sampling', '--hermes-mode', 'static-aot']));
  assert.equal(nativeScrollOptions(['--input', 'os']).pacing, 'os');
  assert.equal(nativeScrollOptions(['--input', 'os', '--catalog']).catalog, true);
  assert.equal(nativeScrollOptions(['--input', 'os', '--scope', 'sampling']).scope, 'sampling');
  for (const args of [
    ['--input', 'unknown'],
    ['--input', 'os', '--catalog', '--scope', 'sampling'],
    ['--input', 'os', '--scope', 'gc'],
    ['--input', 'os', '--scope', 'diagnostic'],
    ['--input', 'os', '--scope', 'sampling', '--hermes-mode', 'static-aot'],
  ])
    assert.throws(() => nativeScrollOptions(args));
  assert.equal(
    nativeScrollOptions(['--hermes-mode', 'static-aot', '--viewport', 'both', '--input', 'os'])
      .viewport,
    'both',
  );
  assert.equal(nativeScrollOptions(['--resource-cycles', '6']).resourceCycles, 6);
  for (const args of [
    ['--resource-cycles', '1'],
    ['--resource-cycles', '2'],
    ['--resource-cycles', '31'],
    ['--resource-cycles', 'NaN'],
    ['--resource-cycles', '6', '--scope', 'sampling'],
    ['--resource-cycles', '6', '--input', 'os'],
    ['--resource-cycles', '6', '--catalog'],
  ])
    assert.throws(() => nativeScrollOptions(args));
  for (const args of [
    ['--scope', 'unknown'],
    ['--viewport', 'unobserved'],
    ['--hermes-mode', 'v8'],
    ['--scope'],
    ['--unknown'],
  ])
    assert.throws(() => nativeScrollOptions(args));
});

test(
  'resource repetition requires returned producers and drained frames while reporting cache residency independently',
  { timeout },
  () => {
    const state = {
      foreground: true,
      focusChanges: 1,
      keyboardMessages: 0,
      semanticsActions: 0,
      lastInputTick: 5,
      cursorParked: true,
    };
    const fixture = () =>
      Array.from({ length: 4 }, (_, cycle) => ({
        type: 'resource-cycle',
        cycle,
        scope: 'core-resource-and-native-frame-owners',
        qualification: 'diagnostic-only',
        returnedToGallery: true,
        performanceAccepted: false,
        physicalInputAccepted: 'notVerified',
        displayed: 'unobserved',
        tree: { elements: 100, renderObjects: 40, hostNodes: 12 },
        accounted: {
          resident: 20,
          producers: 10,
          residentUnits: 20,
          producerUnits: 10,
          residentBytes: 2000,
          producerBytes: 1000,
        },
        pictures: { cached: 4, live: 5, bytes: 2048 },
        native: [1, 0, 1, 0, 0],
        inputWindow: { pacing: 'programmatic', before: { ...state }, after: { ...state } },
        receipts: { receiptIntegrity: true, input: { received: 0 }, surface: { n: 10 } },
      }));
    const result = verifyNativeResourceCycles(fixture(), 3);
    assert.equal(result.producerAndFrameOwners, 'PASS-scoped');
    assert.equal(result.cacheRetention, 'observed');
    assert.equal(result.memoryAccepted, false);
    assert.equal(result.residency.length, 4);
    assert(!('stableTail' in result));
    const growing = fixture();
    for (const point of growing) {
      point.accounted.residentBytes += point.cycle * 1024;
      point.pictures.cached += point.cycle * 100;
      point.pictures.live = point.pictures.cached + 1;
      point.pictures.bytes += point.cycle * 64 * 1024 ** 2;
    }
    const observation = verifyNativeResourceCycles(growing, 3);
    assert.equal(observation.residency[3].pictures.cached, 304);
    assert.equal(observation.residency[3].pictures.bytes, 2048 + 192 * 1024 ** 2);
    assert.equal(observation.accounted.residentBytes, 5072);
    assert.equal(observation.memoryAccepted, false);
    for (const change of [
      (points) => points.pop(),
      (points) => (points[2].cycle = 1),
      (points) => (points[2].returnedToGallery = false),
      (points) => points[2].tree.elements++,
      (points) => points[2].accounted.producers++,
      (points) => points[2].accounted.producerUnits++,
      (points) => points[2].accounted.producerBytes++,
      (points) => (points[2].accounted.residentBytes = -1),
      (points) => (points[2].pictures.cached = 6),
      (points) => (points[2].pictures.bytes = NaN),
      (points) => (points[2].native[3] = 1),
      (points) => (points[2].native[0] = 2),
      (points) => (points[2].receipts.input.received = 1),
      (points) => (points[2].receipts.surface.n = 0),
      (points) => points[2].inputWindow.after.keyboardMessages++,
      (points) => (points[2].performanceAccepted = true),
    ]) {
      const points = fixture();
      change(points);
      assert.throws(() => verifyNativeResourceCycles(points, 3));
    }
  },
);
test(
  'sampling names map through the exact bundle locations without inventing a location for native frames',
  { timeout },
  () => {
    const frame = { name: 'fn(app.js:2:1)', funcLine: '2', funcColumn: '1' },
      native = { name: '[Native] freeze', caller: frame },
      profile = {
        self: [native],
        inclusive: [frame],
        functionSelf: [native],
        functionInclusive: [frame],
      },
      map = new SourceMap({ version: 3, sources: ['core.ts'], names: [], mappings: 'AAAA;AACA' }),
      mapped = symbolicateNativeProfile(profile, map);
    assert.equal(mapped.inclusive[0].sourceLine, 2);
    assert.equal(mapped.inclusive[0].sourceColumn, 1);
    assert.equal(mapped.self[0].source, undefined);
    assert.equal(mapped.self[0].caller.sourceLine, 2);
  },
);
