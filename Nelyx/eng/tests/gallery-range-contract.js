// SPDX-License-Identifier: BSD-3-Clause
const fail = (reason) => {
  throw Error(reason);
};
const equal = (a, b) =>
  Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((id, i) => id === b[i]);
export function galleryColumns(catalog) {
  return {
    primary: catalog.filter((demo, i) => demo.id === 'text-fields' || i % 2 === 0).map((x) => x.id),
    secondary: catalog
      .filter((demo, i) => demo.id !== 'text-fields' && i % 2 !== 0)
      .map((x) => x.id),
  };
}
export function verifyGalleryWarmup(samples, expected) {
  if (!Array.isArray(samples) || samples.length !== 3)
    fail('FAIL_WARMUP_NOT_COMPLETE: three observations required');
  const first = samples[0];
  for (const snapshot of samples) {
    if (
      snapshot?.schema !== 1 ||
      snapshot.includePlanned !== false ||
      !snapshot.configuration ||
      snapshot.configuration !== first.configuration ||
      !Array.isArray(snapshot.resourceErrors) ||
      snapshot.resourceErrors.length ||
      !equal(Object.keys(snapshot.columns ?? {}).sort(), ['primary', 'secondary'])
    )
      fail('FAIL_WARMUP_NOT_COMPLETE: environment/resources/columns');
    for (const name of ['primary', 'secondary']) {
      const column = snapshot.columns[name],
        previous = first.columns[name];
      if (
        !equal(column.ids, expected[name]) ||
        new Set(column.ids).size !== column.ids.length ||
        !equal([...column.loaded].sort(), [...expected[name]].sort()) ||
        !equal(column.measured, expected[name]) ||
        ![column.min, column.max, column.offset, column.viewport, column.width].every(
          Number.isFinite,
        ) ||
        column.max <= column.min ||
        column.viewport <= 0 ||
        column.width <= 0 ||
        Math.abs(column.offset - column.min) > 0.5 ||
        Math.abs(column.max - previous.max) > 0.5 ||
        column.min !== previous.min ||
        column.viewport !== previous.viewport ||
        column.width !== previous.width
      )
        fail('FAIL_WARMUP_NOT_COMPLETE: ' + name);
    }
  }
  return first.configuration;
}
export function verifyGalleryLeg(snapshot, warmup, input, expected) {
  const leg = snapshot?.leg,
    name = leg?.column,
    column = snapshot?.columns?.[name];
  if (
    !leg ||
    !column ||
    !expected[name] ||
    snapshot.resourceErrors?.length ||
    snapshot.configuration !== warmup.configuration ||
    leg.configuration !== warmup.configuration ||
    !equal(column.ids, expected[name]) ||
    !equal(column.measured, expected[name]) ||
    !Array.isArray(leg.faults) ||
    leg.faults.length ||
    ![
      leg.start,
      leg.end,
      leg.min,
      leg.max,
      leg.viewport,
      leg.gap,
      leg.firstMovement,
      leg.bottom,
      input.nativeBeginMs,
      input.nativeEndMs,
    ].every((x) => typeof x === 'number' && Number.isFinite(x)) ||
    Math.abs(leg.start - leg.min) > 0.5 ||
    Math.abs(leg.end - leg.max) > 0.5 ||
    Math.abs(column.offset - leg.max) > 0.5 ||
    Math.abs(leg.max - warmup.columns[name].max) > 0.5 ||
    leg.gap > leg.viewport + 0.5 ||
    leg.frames < 2 ||
    leg.firstMovement < input.nativeBeginMs ||
    leg.bottom > input.nativeEndMs ||
    leg.bottom < leg.firstMovement ||
    !equal(Object.keys(leg.sections).sort(), [...expected[name]].sort()) ||
    !column.visible.includes(expected[name].at(-1)) ||
    input.partialDelivery ||
    input.foregroundLost ||
    input.latePackets ||
    input.maxPacket > 120
  )
    fail('FAIL_FULL_RANGE_COVERAGE: ' + (name ?? 'missing leg'));
  return {
    ...leg,
    scope: 'top to bottom submitted geometry within original OS input window; scanout unobserved',
  };
}

export function summarizeGallerySurfaces(snapshot, input, expected) {
  const leg = snapshot?.leg,
    raw = snapshot?.nativeSurfaces;
  if (
    !leg ||
    !Array.isArray(raw) ||
    !raw.length ||
    raw.length > 8192 ||
    snapshot.surfaceOverflow !== 0 ||
    snapshot.unmappedSurfaces !== 0
  )
    fail('FAIL_FULL_RANGE_COVERAGE: missing/overflowed native surface trace');
  let previous = -Infinity;
  for (const row of raw) {
    if (
      !Array.isArray(row) ||
      row.length !== 4 ||
      !row.slice(0, 3).every(Number.isFinite) ||
      row[0] <= previous ||
      !Number.isSafeInteger(row[1]) ||
      !Array.isArray(row[3]) ||
      row[3].some((id) => !expected[leg.column].includes(id))
    )
      fail('FAIL_FULL_RANGE_COVERAGE: invalid native surface trace');
    previous = row[0];
  }
  const rows = raw.filter((row) => row[0] >= input.nativeBeginMs && row[0] <= input.nativeEndMs),
    first = rows.findIndex((row) => row[2] > leg.min + 0.5),
    bottom = rows.findIndex(
      (row) => Math.abs(row[2] - leg.max) <= 0.5 && row[3].includes(expected[leg.column].at(-1)),
    ),
    seen = new Set(rows.flatMap((row) => row[3]));
  if (
    first < 0 ||
    bottom <= first ||
    Math.abs(rows.length - input.surfaceUpdates) > 1 ||
    !expected[leg.column].every((id) => seen.has(id))
  )
    fail('FAIL_FULL_RANGE_COVERAGE: native surface endpoints/count/section coverage');
  const gaps = [],
    movement = [],
    sections = {};
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1],
      b = rows[i],
      gap = b[0] - a[0];
    if (b[2] < a[2] - 0.5 || b[2] - a[2] > leg.viewport + 0.5)
      fail('FAIL_FULL_RANGE_COVERAGE: native surface skipped/reversed content');
    gaps.push(gap);
    if (i > first && i <= bottom) movement.push(gap);
    for (const id of a[3]) if (b[3].includes(id)) (sections[id] ??= []).push(gap);
  }
  const distribution = (values) => {
    const sorted = values.slice().sort((a, b) => a - b),
      n = sorted.length,
      at = (p) => (n ? sorted[Math.min(n - 1, Math.floor(n * p))] : null);
    return {
      samples: n,
      p50: at(0.5),
      p95: at(0.95),
      p99: at(0.99),
      max: n ? sorted[n - 1] : null,
    };
  };
  return {
    surfaceRows: rows.length,
    counterBoundaryDifference: rows.length - input.surfaceUpdates,
    firstMovementMs: rows[first][0],
    bottomMs: rows[bottom][0],
    movementSurfaceFPS: ((bottom - first) * 1000) / (rows[bottom][0] - rows[first][0]),
    endpointWaitMs: input.nativeEndMs - rows[bottom][0],
    initialWaitMs: rows[first][0] - input.nativeBeginMs,
    maximumInputSilenceMs: Math.max(
      ...gaps,
      rows[0][0] - input.nativeBeginMs,
      input.nativeEndMs - rows.at(-1)[0],
    ),
    cadence: distribution(gaps),
    movementCadence: distribution(movement),
    sectionCadence: Object.fromEntries(
      Object.entries(sections).map(([id, values]) => [id, distribution(values)]),
    ),
    sections: [...seen],
    scope:
      'every native surface-updated trace row, joined to its captured geometry; counter boundary tolerance one update; scanout unobserved',
  };
}
