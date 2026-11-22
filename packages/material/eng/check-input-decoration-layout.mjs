// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { RenderBox } from '@nelyx/core/framework/rendering/object';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { execute } from '../../../Nelyx/sdk/tooling/cli/src/commands.mjs';
import { RenderInputDecoration } from '../dist/internal/input/input-decorator-layout.js';

if (!process.argv.includes('--child')) {
  await execute(process.execPath, [import.meta.filename, '--child'], { timeout: 1_200_000 });
  process.exit(0);
}

class Child extends RenderBox {
  constructor(width, height, baseline = null) {
    super();
    this.requestedSize = { width, height };
    this.baseline = baseline;
  }
  performLayout(constraints) {
    return this.computeDryLayout(constraints);
  }
  computeDryLayout(constraints) {
    return constraints.constrain(this.requestedSize);
  }
  computeDryBaseline() {
    assert.notEqual(this.baseline, null, 'Size-only slot requested a dry baseline');
    return this.baseline;
  }
  computeDistanceToActualBaseline() {
    assert.notEqual(this.baseline, null, 'Size-only slot requested an actual baseline');
    return this.baseline;
  }
}

function measure(direction, scale, floated) {
  const children = {
    container: new Child(0, 0),
    icon: new Child(24, 24),
    prefixIcon: new Child(40, 32),
    suffixIcon: new Child(40, 32),
    input: new Child(100, (floated ? 40 : 20) * scale, 15 * scale),
    hint: new Child(56, 20 * scale, 15 * scale),
    label: new Child(64, 20 * scale, 15 * scale),
    helperError: new Child(72, 16 * scale, 12 * scale),
    counter: new Child(32, 16 * scale, 12 * scale),
  };
  const constraints = new BoxConstraints(0, 320, 0, 240);
  const render = new RenderInputDecoration(Object.keys(children), {
    direction,
    padding: new EdgeInsets(8, 10, 8, 10),
    baseline: 'alphabetic',
    floatingLabelHeight: 16 * scale,
    labelProgress: floated ? 1 : 0,
    labelAlignment: -1,
    outline: true,
    borderStrokeOffset: 0,
    hasLabel: true,
    labelVisible: true,
    isEmpty: !floated,
    isCollapsed: false,
    isDense: false,
    maintainHintSize: true,
    hintVisible: true,
    maintainLabelSize: true,
    alignLabelWithHint: true,
    density: { width: 0, height: 0 },
    inputGap: 4,
    expands: false,
    vertical: null,
  });
  render.setChildren(Object.values(children));
  try {
    const drySize = render.getDryLayout(constraints);
    const dryBaseline = render.getDryBaseline(constraints, 'alphabetic');
    render.layout(constraints);
    assert.deepEqual(drySize, render.size);
    assert.equal(dryBaseline, render.getDistanceToBaseline('alphabetic'));
    const y = (slot) => children[slot].layoutOffset.y;
    assert.equal(y('input') + 15 * scale, dryBaseline);
    assert.equal(y('hint') + 15 * scale, dryBaseline);
    assert.equal(y('helperError'), y('counter'));
    assert.equal(y('prefixIcon'), y('suffixIcon'));
    if (floated) assert.ok(y('label') < 0);
    else assert.equal(y('label'), y('input'));
    return Object.fromEntries(
      Object.entries(children).map(([slot, child]) => [
        slot,
        { ...child.layoutOffset, width: child.size.width },
      ]),
    );
  } finally {
    render.dispose();
  }
}

for (const [scale, floated] of [
  [1, false],
  [1.5, true],
]) {
  const ltr = measure('ltr', scale, floated);
  const rtl = measure('rtl', scale, floated);
  for (const slot of Object.keys(ltr)) {
    const width = ltr[slot].width * (slot === 'label' && floated ? 0.75 : 1);
    assert.equal(ltr[slot].y, rtl[slot].y, slot);
    assert.ok(Math.abs(ltr[slot].x + rtl[slot].x + width - 320) < 1e-6, slot);
  }
}
console.log('PASS dry and actual input decoration layouts, RTL, text scaling and label baselines');
