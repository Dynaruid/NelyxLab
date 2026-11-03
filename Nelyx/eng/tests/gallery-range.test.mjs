// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  galleryColumns,
  verifyGalleryWarmup,
  verifyGalleryLeg,
  summarizeGallerySurfaces,
} from './gallery-range-contract.js';
import { withGalleryRangeFixture } from './gallery-range-fixture.mjs';
const timeout = 1_200_000;
const expected = galleryColumns([{ id: 'a' }, { id: 'b' }, { id: 'text-fields' }, { id: 'image' }]);
function fixture() {
  const snapshot = {
    schema: 1,
    includePlanned: false,
    configuration: 'owner:width:theme:locale:dpi',
    resourceErrors: [],
    columns: {},
  };
  for (const name of ['primary', 'secondary'])
    snapshot.columns[name] = {
      ids: expected[name],
      measured: expected[name],
      loaded: expected[name],
      visible: [expected[name][0]],
      min: 0,
      max: 2000,
      offset: 0,
      viewport: 500,
      width: 400,
    };
  return snapshot;
}
test(
  'full warmup requires every current catalog ID in both measured and submitted-ready coverage',
  { timeout },
  () => {
    const valid = fixture();
    assert.equal(
      verifyGalleryWarmup([valid, structuredClone(valid), structuredClone(valid)], expected),
      valid.configuration,
    );
    const mutations = [
      (x) => {
        delete x.columns.secondary;
      },
      (x) => {
        x.columns.primary.ids = ['a'];
      },
      (x) => {
        x.columns.secondary.loaded = ['b'];
      },
      (x) => {
        x.columns.secondary.measured = ['b'];
      },
      (x) => {
        x.resourceErrors = ['image'];
      },
      (x) => {
        x.includePlanned = true;
      },
      (x) => {
        x.columns.primary.offset = 1;
      },
      (x) => {
        x.configuration = 'other DPI/theme/owner';
      },
      (x) => {
        x.columns.secondary.max = 2300;
      },
    ];
    for (const mutate of mutations) {
      const broken = structuredClone(valid);
      mutate(broken);
      assert.throws(
        () => verifyGalleryWarmup([valid, valid, broken], expected),
        /FAIL_WARMUP_NOT_COMPLETE/,
      );
    }
  },
);
test(
  'original full-range leg rejects skipped, late, changed, or unfinished motion even at high FPS',
  { timeout },
  () => {
    const warm = fixture(),
      end = structuredClone(warm),
      input = { nativeBeginMs: 100, nativeEndMs: 500, maxPacket: 120 };
    end.columns.primary.offset = 2000;
    end.columns.primary.visible = ['text-fields'];
    end.leg = {
      column: 'primary',
      configuration: warm.configuration,
      start: 0,
      end: 2000,
      min: 0,
      max: 2000,
      viewport: 500,
      gap: 300,
      frames: 15,
      firstMovement: 110,
      bottom: 490,
      faults: [],
      sections: { a: { first: 100, last: 250 }, 'text-fields': { first: 250, last: 490 } },
    };
    assert.equal(verifyGalleryLeg(end, warm, input, expected).column, 'primary');
    for (const change of [
      (x) => {
        x.leg.start = 10;
      },
      (x) => {
        x.leg.end = 1999;
      },
      (x) => {
        x.leg.bottom = 501;
      },
      (x) => {
        x.leg.bottom = null;
      },
      (x) => {
        x.leg.gap = 600;
      },
      (x) => {
        delete x.leg.sections.a;
      },
      (x) => {
        x.leg.faults = ['extent-changed'];
      },
      (x) => {
        x.columns.primary.measured = [];
      },
      (x) => {
        x.configuration = 'different';
      },
      (x) => {
        x.resourceErrors = ['image'];
      },
    ]) {
      const broken = structuredClone(end);
      change(broken);
      assert.throws(
        () => verifyGalleryLeg(broken, warm, input, expected),
        /FAIL_FULL_RANGE_COVERAGE/,
      );
    }
    for (const fault of ['partialDelivery', 'foregroundLost', 'latePackets'])
      assert.throws(
        () => verifyGalleryLeg(end, warm, { ...input, [fault]: true }, expected),
        /FAIL_FULL_RANGE_COVERAGE/,
      );
  },
);
test(
  'range fixture restores original App and removes owned temporary source after build failure',
  { timeout },
  async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nelyx-gallery-range-'));
    try {
      const file = path.join(root, 'App.tsx'),
        original =
          'main(undefined, { accessibilityEnabled });\n<ApplicationSurface onReady={() => {}} />';
      fs.writeFileSync(file, original);
      await assert.rejects(
        withGalleryRangeFixture(root, async () => {
          assert.match(fs.readFileSync(file, 'utf8'), /galleryRange/);
          throw Error('build failed');
        }),
        /build failed/,
      );
      assert.equal(fs.readFileSync(file, 'utf8'), original);
      assert.deepEqual(fs.readdirSync(root), ['App.tsx']);
    } finally {
      assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
      fs.rmSync(root, { recursive: true, force: true });
    }
  },
);

test(
  'surface cadence includes the complete native trace and refuses a submitted-only bottom',
  { timeout },
  () => {
    const snapshot = {
      leg: { column: 'primary', min: 0, max: 2000, viewport: 500 },
      surfaceOverflow: 0,
      unmappedSurfaces: 0,
      nativeSurfaces: Array.from({ length: 9 }, (_, i) => [
        110 + i * 40,
        i + 1,
        Math.min(2000, (i + 1) * 250),
        expected.primary,
      ]),
    };
    const input = { nativeBeginMs: 100, nativeEndMs: 500, surfaceUpdates: 9 };
    const result = summarizeGallerySurfaces(snapshot, input, expected);
    assert.equal(result.surfaceRows, 9);
    assert.equal(result.movementCadence.max, 40);
    assert.equal(result.endpointWaitMs, 110);
    for (const mutate of [
      (x) => {
        x.nativeSurfaces = x.nativeSurfaces.slice(0, 6);
      },
      (x) => {
        x.surfaceOverflow = 1;
      },
      (x) => {
        x.unmappedSurfaces = 1;
      },
      (x) => {
        x.nativeSurfaces[3][0] = 111;
      },
      (x) => {
        x.nativeSurfaces[2][2] = 1900;
      },
      (x) => {
        x.nativeSurfaces.at(-1)[3] = ['unknown'];
      },
    ]) {
      const broken = structuredClone(snapshot);
      mutate(broken);
      assert.throws(
        () => summarizeGallerySurfaces(broken, input, expected),
        /FAIL_FULL_RANGE_COVERAGE/,
      );
    }
  },
);
