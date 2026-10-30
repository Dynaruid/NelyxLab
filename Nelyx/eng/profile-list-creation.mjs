// SPDX-License-Identifier: BSD-3-Clause
// Node/CanvasKit allocation diagnosis of the real Testbed ListViewPage.
// Run with --experimental-transform-types. This is not Hermes/frame acceptance.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { copyResourceId } from '@nelyx/core/ui/resource-retention';
import { Session } from 'node:inspector';
import { engineFixture } from '../../packages/material/tests/engine-fixture.mjs';
import { MaterialApp } from '@nelyx/material/app';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { DefaultAssetBundle } from '@nelyx/core/framework/widgets/default-asset-bundle';
import { AssetBundle } from '@nelyx/core/services/asset-bundle';
import { ListViewPage } from '../../sample/nelyx-testbed-app-2/src/list-view.ts';

const cacheRevisit = process.argv.includes('--cache-revisit');
if (process.argv.slice(2).some((argument) => argument !== '--cache-revisit'))
  throw Error('Choose the allocation diagnosis or --cache-revisit');
const deadline = setTimeout(() => {
  console.error('List creation diagnosis exceeded 20 minutes');
  process.exitCode = 1;
}, 1_200_000);
const inspector = new Session();
inspector.connect();
const post = (method, parameters = {}) =>
  new Promise((resolve, reject) =>
    inspector.post(method, parameters, (error, result) =>
      error ? reject(error) : resolve(result),
    ),
  );
let fixture,
  sampling = false;
try {
  FoundationPlatform.configure({ kind: 'native', operatingSystem: 'windows' });
  const f = (fixture = await engineFixture()),
    context = f.root.context;
  Object.assign(context.readMetrics(), {
    logicalWidth: 487,
    logicalHeight: 464.5,
    physicalWidth: 974,
    physicalHeight: 929,
    scale: 2,
  });
  const app = path.resolve(import.meta.dirname, '../../sample/nelyx-testbed-app-2');
  for (const asset of JSON.parse(
    fs.readFileSync(path.join(app, 'package.json'), 'utf8'),
  ).nelyx.assets.filter((asset) => asset.kind === 'font')) {
    const bytes = fs.readFileSync(path.join(app, asset.path)),
      font = f.library.decode(
        { ...asset, sha256: createHash('sha256').update(bytes).digest('hex') },
        bytes,
      );
    context.resources.register(font.descriptor, font.retire);
    const resource = copyResourceId(font.descriptor);
    context.assets.set(asset.id, resource);
    if (asset.id === 'sample-font') context.defaultFont = resource;
  }
  class DeclaredAssets extends AssetBundle {
    async load(key) {
      throw Error('List creation probe requested undeclared bytes: ' + key);
    }
  }
  const page = new ListViewPage(() => {});
  f.set(new DefaultAssetBundle(new DeclaredAssets(), new MaterialApp({ home: page })));
  const pending = [f.root.root];
  let state;
  while (pending.length) {
    const element = pending.pop();
    if (element.widget === page) {
      state = element.stateObject;
      break;
    }
    pending.push(...element.children);
  }
  if (!state?.scroll?.hasClients) throw Error('Actual Testbed ListView owner is unavailable');
  if (cacheRevisit) {
    const before = f.library.debugTextStats,
      viewport = state.scroll.position.viewportDimension,
      target = viewport * 5.5;
    for (let step = 1; step <= 11; step++) {
      state.scroll.jumpTo((target * step) / 11);
      f.frame();
    }
    const cold = f.library.debugTextStats,
      coldDormant = f.root.buildOwner.maybeDormantChildren?.debugStats ?? null;
    for (let step = 10; step >= 0; step--) {
      state.scroll.jumpTo((target * step) / 11);
      f.frame();
    }
    const revisit = f.library.debugTextStats;
    const delta = (a, b) =>
      Object.fromEntries(
        ['hits', 'misses', 'cacheOnlyHits'].map((name) => [name, b.cache[name] - a.cache[name]]),
      );
    console.log(
      JSON.stringify(
        {
          scope: 'Node/CanvasKit cache diagnosis; not native timing or acceptance',
          workload: { viewport, target, stepsPerDirection: 11, itemCount: 1000 },
          before,
          cold,
          revisit,
          coldDelta: delta(before, cold),
          revisitDelta: delta(cold, revisit),
          dormant: {
            cold: coldDormant,
            revisit: f.root.buildOwner.maybeDormantChildren?.debugStats ?? null,
          },
        },
        null,
        2,
      ),
    );
  } else {
    await post('HeapProfiler.startSampling', {
      samplingInterval: 512,
      includeObjectsCollectedByMajorGC: true,
      includeObjectsCollectedByMinorGC: true,
    });
    sampling = true;
    state.scroll.jumpTo(10064);
    f.frame();
    const { profile } = await post('HeapProfiler.stopSampling');
    sampling = false;
    const self = [],
      inclusive = [],
      functions = new Map();
    const visit = (node, parents) => {
      const frame = node.callFrame,
        label = {
          function: frame.functionName || '<anonymous>',
          file: frame.url.replace('file:///', '').replaceAll('\\', '/'),
          line: frame.lineNumber + 1,
        };
      let bytes = node.selfSize;
      for (const child of node.children) bytes += visit(child, [...parents, label]);
      if (node.selfSize) {
        self.push({ ...label, estimatedBytes: node.selfSize, callers: parents.slice(-3) });
        const source = label.file
            ? label
            : ([...parents].reverse().find((frame) => frame.file) ?? label),
          key = JSON.stringify(source),
          previous = functions.get(key);
        if (previous) previous.estimatedBytes += node.selfSize;
        else functions.set(key, { ...source, estimatedBytes: node.selfSize });
      }
      if (bytes) inclusive.push({ ...label, estimatedBytes: bytes });
      return bytes;
    };
    const estimatedBytes = visit(profile.head, []);
    for (const values of [self, inclusive])
      values.sort((a, b) => b.estimatedBytes - a.estimatedBytes);
    console.log(
      JSON.stringify(
        {
          scope:
            'Node/CanvasKit sampled allocation diagnosis; not Hermes timing or product acceptance',
          workload: 'actual ListViewPage, far destination 10064, one synchronous frame',
          estimatedBytes,
          selfByFunction: [...functions.values()]
            .sort((a, b) => b.estimatedBytes - a.estimatedBytes)
            .slice(0, 24),
          self: self.slice(0, 3),
          inclusive: inclusive
            .filter((value) => value.file && !value.file.startsWith('node:'))
            .slice(0, 5),
        },
        null,
        2,
      ),
    );
  }
} finally {
  try {
    if (sampling) await post('HeapProfiler.stopSampling');
  } finally {
    inspector.disconnect();
    clearTimeout(deadline);
    await fixture?.close();
  }
}
