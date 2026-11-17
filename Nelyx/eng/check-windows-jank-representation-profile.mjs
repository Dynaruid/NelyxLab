// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { representationSamplingProfile } from './windows-jank-representation-profile.mjs';
import {
  patchDescriptorProfile,
  descriptorProfileEnabled,
} from '../sdk/tooling/cli/src/windows-hermes-descriptor-profile.mjs';
import {
  patchPropertyProfile,
  propertyProfileEnabled,
} from '../sdk/tooling/cli/src/windows-hermes-property-profile.mjs';

const map = {
  version: 3,
  names: [],
  sources: [
    '/core/foundation/dart-collections.ts',
    '/core/framework/widgets/widget-state-constraint-source-adapter.ts',
    '/app/index.ts',
  ],
  mappings: 'AAAA;ACAA;ACAA',
};
const frames = [
  { sequence: 1, begin: 100, end: 140, cpuMs: 30, newDays: 30, rebuiltDays: 0 },
  { sequence: 2, begin: 150, end: 170, cpuMs: 10, newDays: 0, rebuiltDays: 0 },
  { sequence: 3, begin: 200, end: 260, cpuMs: 40, newDays: 0, rebuiltDays: 30 },
];
const trace = {
  stackFrames: {
    1: { name: '[root]', category: 'root' },
    2: { name: 'DartSet', category: 'JavaScript', line: '1', column: '1', parent: 1 },
    3: { name: '[Native] objectDefineProperties', category: 'Native', parent: 2 },
    4: { name: '[GC young]', category: 'Metadata', parent: 3 },
    5: { name: 'accepts', category: 'JavaScript', line: '2', column: '1', parent: 2 },
    6: { name: 'app', category: 'JavaScript', line: '3', column: '1', parent: 1 },
  },
  samples: [
    { ts: '99000', sf: 2 }, // Outside frames must not enter a long-frame denominator.
    { ts: '101000', sf: 3 }, // Nested candidates are independent upper bounds.
    { ts: '102000', sf: 4 }, // Saved GC parents cannot become collection work.
    { ts: '103000', sf: 5 }, // Two collection parents still count as one sample.
    { ts: '140000', sf: 2 }, // A frame's end is exclusive.
    { ts: '155000', sf: 2 }, // Short-frame work is excluded from long-frame screening.
    { ts: '201000', sf: 6 },
  ],
};
const report = representationSamplingProfile(trace, frames, map);
assert.equal(report.long.frames, 2);
assert.equal(report.long.elapsedMs, 100);
assert.equal(report.long.cpuMs, 70); // CPU and elapsed time stay distinct.
assert.equal(report.long.samples, 4);
assert.equal(report.long.collectionUpper, 2);
assert.equal(report.long.policy, 1);
assert.equal(report.long.definePropertiesUpper, 1);
assert.equal(report.long.gc, 1);
assert.equal(report.long.unmapped, 0);
assert.equal(report.newMonth.frames, 1);
assert.equal(report.existingMonth.frames, 1);
assert.equal(report.outsideFrames, 2);
assert.equal(report.descriptorConversion, 'notSeparated');
assert.equal(report.gate, 'notAcceptedFromSamplingAlone');
assert.equal(
  report.hotspots.long.self.reduce((sum, pair) => sum + pair[1], 0),
  3,
);
assert.equal(report.hotspots.long.self.find(([site]) => site.endsWith('DartSet'))[1], 1);
assert.equal(report.hotspots.long.branches.find(([site]) => site.endsWith('DartSet'))[1], 2);
assert.equal(report.hotspots.long.native[0][0], '[Native] objectDefineProperties');
assert.equal(report.hotspots.long.native[0][1], 1);
assert.equal(report.hotspots.existingMonth.self[0][1], 1);
const property = representationSamplingProfile(
  trace,
  frames.map((frame) => ({ ...frame, property: [10, 3, 1, 2, 4, 4, 5] })),
  map,
);
assert.equal(property.long.nativeNamedProperty.eligibleAccessorLookups, 6);
assert.equal(property.long.nativeNamedProperty.combinedUpperOfCpu, 6 / 70);
assert.equal(property.long.nativeNamedProperty.allResolutionUpperMs, 10);
assert.throws(
  () =>
    representationSamplingProfile(trace, [{ ...frames[0], property: [3, 4, 1, 2, 4, 4, 5] }], map),
  /clocks or sequence/,
);
assert.throws(
  () =>
    representationSamplingProfile(trace, [{ ...frames[0], property: [10, 3, 1, 2, 3, 4, 5] }], map),
  /clocks or sequence/,
);
assert.throws(
  () =>
    representationSamplingProfile(
      trace,
      [{ ...frames[0], property: [10, 3, 1, 60, 4, 4, 5] }],
      map,
    ),
  /clocks or sequence/,
);
const native = representationSamplingProfile(
  trace,
  frames.map((frame) => ({ ...frame, native: [2, 0, 0.05, 0.1] })),
  map,
);
assert.equal(native.long.nativeDefineProperties.calls, 4);
assert.equal(native.long.nativeDefineProperties.conversionUpperMs, 0.1);
assert.equal(native.long.nativeDefineProperties.applicationUpperMs, 0.2);
assert.equal(native.long.nativeDefineProperties.conversionUpperOfCpu, 0.1 / 70);
assert.throws(
  () =>
    representationSamplingProfile(
      trace,
      frames.map((frame) => ({ ...frame, native: [2, 0, 100, 100] })),
      map,
    ),
  /clocks/,
);
assert.throws(
  () => representationSamplingProfile(trace, [frames[0], frames[0]], map),
  /clocks or sequence/,
);
assert.throws(
  () => representationSamplingProfile({ ...trace, samples: [{ ts: 101000, sf: 42 }] }, frames, map),
  /Missing/,
);
assert.throws(
  () =>
    representationSamplingProfile({ ...trace, samples: [{ ts: 'invalid', sf: 2 }] }, frames, map),
  /clock/,
);
assert.throws(
  () =>
    representationSamplingProfile(
      {
        ...trace,
        samples: [{ ts: '101000', sf: 2 }],
        stackFrames: { 2: { name: 'cycle', parent: 2 } },
      },
      frames,
      map,
    ),
  /cyclic/,
);
const unmapped = representationSamplingProfile(
  {
    ...trace,
    stackFrames: {
      ...trace.stackFrames,
      2: { name: 'unknown', category: 'JavaScript', parent: 1 },
    },
  },
  frames,
  map,
);
assert.ok(unmapped.long.unmapped > 0, 'Missing source mapping must remain visible');
const parent = path.resolve(import.meta.dirname, '../../.tmp'),
  temporary = fs.mkdtempSync(path.join(parent, 'descriptor-patch-'));
try {
  const file = path.join(temporary, 'lib/VM/JSLib/Object.cpp');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.copyFileSync(
    path.resolve(import.meta.dirname, '../../.nelyx/windows-hermes/source/lib/VM/JSLib/Object.cpp'),
    file,
  );
  patchDescriptorProfile(temporary, false);
  const original = fs.readFileSync(file, 'utf8');
  patchDescriptorProfile(temporary, true);
  const instrumented = fs.readFileSync(file, 'utf8');
  assert.notEqual(instrumented, original);
  patchDescriptorProfile(temporary, true);
  assert.equal(fs.readFileSync(file, 'utf8'), instrumented, 'Diagnostic patch must be idempotent');
  patchDescriptorProfile(temporary, false);
  assert.equal(
    fs.readFileSync(file, 'utf8'),
    original,
    'Normal supplier must recover the exact pinned source',
  );
  const propertyFiles = ['lib/VM/JSObject.cpp', 'lib/VM/Interpreter.cpp'];
  for (const relative of propertyFiles)
    fs.copyFileSync(
      path.resolve(import.meta.dirname, '../../.nelyx/windows-hermes/source', relative),
      path.join(temporary, relative),
    );
  patchPropertyProfile(temporary, false);
  const originals = propertyFiles.map((relative) =>
    fs.readFileSync(path.join(temporary, relative), 'utf8'),
  );
  patchPropertyProfile(temporary, true);
  const patched = propertyFiles.map((relative) =>
    fs.readFileSync(path.join(temporary, relative), 'utf8'),
  );
  assert.ok(patched.every((text, index) => text !== originals[index]));
  patchPropertyProfile(temporary, true);
  assert.deepEqual(
    propertyFiles.map((relative) => fs.readFileSync(path.join(temporary, relative), 'utf8')),
    patched,
  );
  patchPropertyProfile(temporary, false);
  assert.deepEqual(
    propertyFiles.map((relative) => fs.readFileSync(path.join(temporary, relative), 'utf8')),
    originals,
  );
  /* oxlint-disable no-unsafe-finally -- Preserve an unexpected cleanup owner. */
} finally {
  if (
    fs.realpathSync(parent) !== parent ||
    fs.realpathSync(temporary) !== temporary ||
    path.dirname(temporary) !== parent ||
    !path.basename(temporary).startsWith('descriptor-patch-') ||
    fs.lstatSync(temporary).isSymbolicLink()
  )
    throw Error('Descriptor patch fixture cleanup owner differs');
  fs.rmSync(temporary, { recursive: true, force: true });
}
/* oxlint-enable no-unsafe-finally */
const keys = [
    'NELYX_HERMES_DESCRIPTOR_PROFILE',
    'NELYX_HERMES_PROPERTY_PROFILE',
    'NELYX_NATIVE_CPU_PROFILE',
    'NELYX_JANK_REPRESENTATION_PROFILE',
  ],
  previous = keys.map((key) => process.env[key]);
try {
  for (const key of keys) delete process.env[key];
  assert.equal(descriptorProfileEnabled(), false);
  process.env.NELYX_HERMES_DESCRIPTOR_PROFILE = '1';
  assert.throws(descriptorProfileEnabled, /explicit representation/);
  for (const key of keys.filter((key) => key !== 'NELYX_HERMES_PROPERTY_PROFILE'))
    process.env[key] = '1';
  assert.equal(descriptorProfileEnabled(), true);
  process.env.NELYX_HERMES_DESCRIPTOR_PROFILE = 'invalid';
  assert.throws(descriptorProfileEnabled, /0 or 1/);
  assert.equal(propertyProfileEnabled(), false);
  process.env.NELYX_HERMES_DESCRIPTOR_PROFILE = '0';
  process.env.NELYX_HERMES_PROPERTY_PROFILE = '1';
  assert.equal(propertyProfileEnabled(), true);
  process.env.NELYX_HERMES_DESCRIPTOR_PROFILE = '1';
  assert.throws(propertyProfileEnabled, /its own representation/);
  process.env.NELYX_HERMES_DESCRIPTOR_PROFILE = '0';
  process.env.NELYX_JANK_REPRESENTATION_PROFILE = '0';
  assert.throws(propertyProfileEnabled, /its own representation/);
  process.env.NELYX_HERMES_PROPERTY_PROFILE = 'invalid';
  assert.throws(propertyProfileEnabled, /0 or 1/);
} finally {
  keys.forEach((key, index) => {
    if (previous[index] === undefined) delete process.env[key];
    else process.env[key] = previous[index];
  });
}
console.log(
  'Representation sampling: frame clocks, nesting, GC, source mapping, new/existing days and invalid traces PASS.',
);
