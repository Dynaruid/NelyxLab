// SPDX-License-Identifier: BSD-3-Clause
// Instrument a second module graph. Replacing widget prototypes changes guarded
// first-render opt-ins, so observe the actual call sites rather than their hooks.
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
const flag = '?w7-calendar-diagnostic';
export async function profile(replacements = new Map()) {
  const hooks = registerHooks({
    resolve(spec, ctx, next) {
      const r = next(spec, ctx);
      return ctx.parentURL?.endsWith(flag) && r.url.startsWith('file:') && !r.url.endsWith(flag)
        ? { ...r, url: r.url + flag }
        : r;
    },
    load(url, ctx, next) {
      if (!url.endsWith(flag)) return next(url, ctx);
      const clean = url.slice(0, -flag.length),
        r = replacements.has(clean)
          ? { format: 'module', source: replacements.get(clean), shortCircuit: true }
          : next(clean, ctx);
      if (!/\/framework\/widgets\/(framework|sliver)\.js$/.test(clean)) return r;
      let source = Buffer.from(r.source).toString();
      const measure = (kind, e, expr) =>
        `globalThis.__w7CalendarMeasure('${kind}',${e},()=>${expr})`;
      for (const [pattern, kind, element] of [
        [/this\.(state|widget)\.build\(this\)/g, 'buildBody', 'this'],
        [/\bwidget\.createRenderObject\(this\)/g, 'renderCreate', 'this'],
        [
          /(?:\bwidget|this\.adaptorWidget|this\.widget)\.updateRenderObject\(this, this\.(?:render|renderObject)\)/g,
          'renderUpdate',
          'this',
        ],
        [/\bchild\.update\(widget\)/g, 'deliver', 'child'],
      ]) {
        const before = source;
        source = source.replace(pattern, (expr) => measure(kind, element, expr));
        if (clean.endsWith('/framework.js'))
          assert.notEqual(source, before, `missing ${kind} call site`);
      }
      return { ...r, source };
    },
  });
  globalThis.__w7CalendarMeasure = (_op, _e, fn) => fn();
  try {
    const { exercise } = await import('./calendar-midpoint-fixture.mjs' + flag),
      { observe } = await import('./calendar-midpoint-intervals.mjs' + flag);
    for (const d of ['forward', 'reverse', 'cold'])
      exercise(d, observe, (label, r) => {
        const rows = r.rows;
        delete r.rows;
        console.log(
          'W7_DIAG',
          label,
          JSON.stringify({ ...r, outsideIntervalsMs: r.firstSceneMs - r.coveredMs }),
        );
        for (const group of new Set(Object.keys(rows).map((k) => k.split(':')[0])))
          console.log(
            'W7_ROWS',
            label,
            group,
            JSON.stringify(
              Object.fromEntries(
                Object.entries(rows)
                  .filter(([k]) => k.startsWith(group + ':'))
                  .map(([k, v]) => [
                    k.slice(group.length + 1),
                    [v[0], +v[1].toFixed(3), +v[2].toFixed(3)],
                  ]),
              ),
            ),
          );
      });
  } finally {
    delete globalThis.__w7CalendarMeasure;
    hooks.deregister();
  }
}
