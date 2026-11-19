// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectDesignBodyUnits } from './design-inventory.mjs';

test(
  'selects a family with its transitive runtime dependencies and cyclic type references',
  { timeout: 1_200_000 },
  () => {
    const unit = (id, family, dependencies = [], typeDependencies = []) => ({
      id,
      families: [family],
      dependencies,
      typeDependencies,
    });
    const units = [
      unit(0, 'W11-02'),
      unit(1, 'W11-03', [0], [4]),
      unit(2, 'W11-06'),
      unit(3, 'W11-01', [1]),
      unit(4, 'W11-04', [], [1]),
    ];
    const ids = (items) => items.map((item) => item.id);
    assert.deepEqual(ids(selectDesignBodyUnits(units, 'W11-01')), [3]);
    assert.deepEqual(ids(selectDesignBodyUnits(units, 'W11-01', true)), [0, 1, 3, 4]);
    assert.deepEqual(selectDesignBodyUnits(units, 'all', true), units);
    assert.throws(
      () => selectDesignBodyUnits(units.slice(0, -1), 'W11-01', true),
      /dependency 4 of 1/,
    );
  },
);
