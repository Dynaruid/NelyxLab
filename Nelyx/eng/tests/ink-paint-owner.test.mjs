// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { PipelineOwner } from '@nelyx/core/framework/rendering/object';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { PaintingContext } from '@nelyx/core/framework/painting/context';
import {
  MaterialInkRender,
  InkFeature,
} from '../../../packages/material/dist/internal/material/material-ink-owner.js';
test(
  'nested ink paint keeps the outer mutation fence through success and a caught inner failure',
  { timeout: 1_200_000 },
  () => {
    for (const failInner of [false, true]) {
      const render = new MaterialInkRender(
          {
            createTicker() {
              throw Error('No ticker expected');
            },
          },
          null,
          false,
        ),
        owner = new PipelineOwner(),
        outer = new PaintingContext(),
        inner = new PaintingContext();
      let entered = false,
        calls = 0;
      class Feature extends InkFeature {
        paintFeature(_canvas, matrix) {
          assert(matrix.isIdentity());
          calls++;
          if (entered) {
            if (failInner) throw Error('inner ink failure');
            return;
          }
          entered = true;
          if (failInner) assert.throws(() => render.paint(inner), /inner ink failure/);
          else render.paint(inner);
          assert.throws(
            () => render.assertMutable(),
            /painting/,
            'Returning from nested paint must not admit outer feature mutations',
          );
        }
      }
      try {
        owner.rootNode = render;
        render.layout(BoxConstraints.tight({ width: 60, height: 40 }));
        const feature = new Feature({ controller: render, referenceBox: render });
        render.addInkFeature(feature);
        render.paint(outer);
        assert.equal(calls, 2);
        assert.equal(outer.getSaveCount(), 1);
        assert.equal(inner.getSaveCount(), 1);
        render.assertMutable();
        feature.dispose();
        assert.equal(render.features.length, 0);
      } finally {
        owner.rootNode = undefined;
        owner.dispose();
        render.dispose();
        outer.dispose();
        inner.dispose();
      }
    }
  },
);
