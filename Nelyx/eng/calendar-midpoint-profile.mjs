// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';
import { exercise } from './calendar-midpoint-fixture.mjs';
export { exercise };
function off(view) {
  let buildLayoutMs = 0;
  const restore = [];
  for (const [obj, name] of [
    [view.buildOwner, 'flushBuild'],
    [view, 'flushLayout'],
  ]) {
    const fn = obj[name];
    obj[name] = function (...args) {
      const start = performance.now();
      try {
        return fn.apply(this, args);
      } finally {
        buildLayoutMs += performance.now() - start;
      }
    };
    restore.push(() => delete obj[name]);
  }
  return { stop: () => restore.forEach((fn) => fn()), result: () => ({ buildLayoutMs }) };
}
const med = (values) => {
  const a = [...values].sort((x, y) => x - y),
    mid = a.length >> 1;
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
};
export function paired(before, after, directions = ['forward', 'reverse', 'cold']) {
  const samples = {};
  for (let i = 0; i < 7; i++)
    for (const d of directions) {
      const pair = {},
        proof = {};
      for (const [version, exerciseVersion] of i % 2
        ? [
            ['new', after],
            ['old', before],
          ]
        : [
            ['old', before],
            ['new', after],
          ])
        exerciseVersion(d, off, (label, r) => {
          (pair[label] ??= {})[version] = [r.buildLayoutMs, r.firstSceneMs];
          const content = [r.callbacks, r.daySize, r.marchLabels];
          if (label in proof)
            assert.deepEqual(content, proof[label], 'first scene geometry/semantics differ');
          else proof[label] = content;
        });
      if (i) for (const [label, p] of Object.entries(pair)) (samples[label] ??= []).push(p);
    }
  for (const [label, pairs] of Object.entries(samples)) {
    const summary = {};
    for (const [i, metric] of ['buildLayoutMs', 'firstSceneMs'].entries()) {
      const b = pairs.map((p) => p.old[i]),
        a = pairs.map((p) => p.new[i]),
        diff = a.map((v, i) => v - b[i]);
      summary[metric] = {
        before: med(b),
        after: med(a),
        beforeRange: [Math.min(...b), Math.max(...b)],
        afterRange: [Math.min(...a), Math.max(...a)],
        pairedDelta: med(diff),
        rangeDelta: [Math.min(...diff), Math.max(...diff)],
        n: diff.length,
      };
    }
    console.log('W7_PAIRED', label, JSON.stringify(summary));
  }
}
export async function run() {
  const samples = {};
  for (let i = 0; i < 6; i++)
    for (const d of ['forward', 'reverse', 'cold'])
      exercise(d, off, (name, r) => {
        if (i) (samples[name] ??= []).push([r.buildLayoutMs, r.firstSceneMs]);
      });
  console.log('W7_OFF', JSON.stringify(samples));
  const { profile } = await import('./calendar-midpoint-diagnostics.mjs');
  await profile();
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.includes('--child')) {
    const [mode, ref] = process.argv.slice(2).filter((a) => a !== '--child');
    if (mode === '--diagnose') {
      const { profile } = await import('./calendar-midpoint-diagnostics.mjs');
      await profile();
    } else if (mode) {
      if (
        ![
          '--before',
          '--render-before',
          '--diagnose-before',
          '--parent-only',
          '--cold-only',
          '--cold-before',
          '--trial-single-child',
        ].includes(mode)
      )
        throw Error('Unknown calendar measurement mode: ' + mode);
      const { variant } = await import('./calendar-midpoint-variant.mjs');
      await variant(mode, ref, exercise, paired);
    } else await run();
  } else
    await execute(process.execPath, [import.meta.filename, '--child', ...process.argv.slice(2)], {
      cwd: resolve(import.meta.dirname, '../..'),
      timeout: 1_200_000,
    });
}
