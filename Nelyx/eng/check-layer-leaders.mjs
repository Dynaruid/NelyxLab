// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { ContainerLayer, LayerHandle, LayerLink, LeaderLayer } from '../dist/framework/rendering/layer.js';

const compose = (root) => root.buildScene().dispose();
const left = new ContainerLayer();
const right = new ContainerLayer();
const branch = new ContainerLayer();
const keepAlive = new LayerHandle(branch);
const link = new LayerLink();
const first = new LeaderLayer({ link });
const second = new LeaderLayer({ link });
try {
  left.append(branch);
  branch.append(first);
  left.attach({});
  right.attach({});
  compose(left);
  branch.append(second);
  assert.throws(() => compose(left), { code: 'multiple-leaders' });

  branch.remove();
  compose(left);
  right.append(branch);
  assert.throws(() => compose(right), { code: 'multiple-leaders' });
  first.link = new LayerLink();
  compose(right);

  branch.remove();
  compose(right);
} finally {
  keepAlive.dispose();
  left.dispose();
  right.dispose();
}
