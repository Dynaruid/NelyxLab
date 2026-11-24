// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { freezeFrame, disposeFrame } from '@nelyx/core/ui/frame';
import { encodeFrame, frameWireVersion } from '@nelyx/core/ui/frame-wire';
import { decodeWebFrame, maxWebFrameBytes } from '@nelyx/core/ui/web-frame-wire';
import { Paint } from '@nelyx/core/ui/paint';

const wide = 0x100000005;
const owner = { id: 'wire-check', generation: wide };
const token = {
  owner,
  sequence: wide,
  metrics: {
    logicalWidth: 105.00000000001,
    logicalHeight: 20,
    physicalWidth: 1788,
    physicalHeight: 341,
    scale: 17.00000000001,
    viewportGeneration: wide,
    rendererGeneration: wide,
    nativeContextGeneration: wide,
    nativeSurfaceGeneration: wide,
  },
};
const area = { x: 0.12500000000001, y: -0.25, width: 0.50000000000001, height: 2.75 };
const ellipse = { values: [0, 0, 123, 57, 1, 2, 3, 4, 5, 6, 7, 8] };
const path = {
  fillType: 'evenOdd',
  operations: [
    { verb: 'moveTo', values: [0, 0] },
    { verb: 'relativeConicTo', values: [1, 2, 3, 4, 0.75] },
    { verb: 'close', values: [] },
    { verb: 'addRRect', values: ellipse.values },
  ],
};
const [image, text, picture] = ['image', 'paragraph', 'picture'].map((id) => ({
  id,
  generation: wide,
}));
const base = new Paint({
  blendMode: 'multiply',
  strokeCap: 'square',
  strokeJoin: 'bevel',
}).snapshot();
const matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 12.123456789, 9, 0, 1];
const style = {
  ...base,
  filterQuality: 'high',
  invertColors: true,
  dither: true,
  shader: {
    kind: 'image',
    image,
    tileModeX: 'mirror',
    tileModeY: 'decal',
    filterQuality: null,
    matrix,
  },
  colorFilter: { kind: 'colorMode', blendMode: 'srcIn', color: 0xf1223366 },
  imageFilter: {
    kind: 'compose',
    outer: { kind: 'blur', sigmaX: 2, sigmaY: 3, tileMode: null, bounds: area },
    inner: {
      kind: 'compose',
      outer: { kind: 'matrix', matrix, filterQuality: 'medium' },
      inner: { kind: 'erode', radiusX: 3, radiusY: 4 },
    },
  },
  maskFilter: { sigma: 2, style: 'solid' },
};
const gradient = {
  ...base,
  shader: {
    kind: 'linear',
    colors: [0xff110033, 0x88112244],
    stops: null,
    tileMode: 'clamp',
    points: [0, 0, 20, 20],
    matrix: null,
  },
};
const runtime = {
  ...base,
  shader: {
    kind: 'runtime',
    source: 'uniform float alpha;\nhalf4 main(float2 p) { return half4(0,0,0,alpha); }',
    uniforms: [0.5],
  },
};
const commands = [
  { op: 'clear', color: 0x81824a8b },
  { op: 'save' },
  { op: 'transform', matrix: [1, 0, 0, 1, area.x, 0] },
  { op: 'transform', matrix },
  { op: 'clip', rect: area },
  { op: 'clipRect', rect: area, clipOp: 'difference', doAntiAlias: true },
  { op: 'clipRRect', rrect: ellipse, clipOp: 'intersect', doAntiAlias: false },
  { op: 'clipRRect', rect: area, radius: 1, clipOp: 'intersect', doAntiAlias: true },
  { op: 'clipPath', path, clipOp: 'intersect', doAntiAlias: true },
  { op: 'rect', rect: area, color: 0xff125678 },
  { op: 'rrect', rect: area, radius: 2.25, color: 0xff125678 },
  { op: 'image', resource: image, rect: area },
  { op: 'paragraph', resource: text, x: area.x, y: -0.12500000000001 },
  { op: 'drawPicture', resource: picture },
  { op: 'drawImageRect', resource: image, src: area, dst: area, paint: style },
  {
    op: 'drawImageNine',
    resource: image,
    center: { x: 1, y: 2, width: 3, height: 4 },
    dst: area,
    paint: base,
  },
  { op: 'drawRect', rect: area, paint: gradient },
  { op: 'drawOval', rect: area, paint: runtime },
  { op: 'drawRRect', rrect: ellipse, paint: base },
  { op: 'drawRRect', rect: area, radius: 1, paint: base },
  { op: 'drawLine', from: { x: area.x, y: 1.25 }, to: { x: 2, y: 3 }, paint: base },
  { op: 'drawPath', path, paint: base },
  {
    op: 'drawShadow',
    path,
    elevation: 4,
    transparentOccluder: true,
    devicePixelRatio: 2,
    color: 0x95121212,
  },
  { op: 'saveLayer', bounds: area, paint: base },
  { op: 'saveBackdropFilter', paint: style },
  { op: 'drawPaint', paint: base },
  { op: 'restore' },
  { op: 'restore' },
  { op: 'restore' },
];
const identity = new Map([
  [image.id, 1],
  [text.id, 2],
  [picture.id, 3],
]);
const resolve = (id, generation, kind) => {
  const resource = [image, text, picture][id - 1];
  assert.equal(generation, resource?.generation);
  assert.equal(kind, resource?.id);
  return resource;
};
const captured = freezeFrame(token, commands);
const encode = (frame, allocate) =>
  encodeFrame(frame, (r) => ({ id: identity.get(r.id), generation: r.generation }), {
    format: 'web',
    allocate,
  });
const bytes = encode(captured);
const restored = decodeWebFrame(bytes, owner, resolve);
assert.deepEqual(restored.token, captured.token);
assert.equal(restored.commands[11].rect.x, area.x);
assert.equal(restored.commands[12].x, area.x);
assert.equal(restored.commands[16].paint.shader.stops, null);
assert.equal(restored.commands[17].paint.shader.source, runtime.shader.source);
assert.deepEqual(encode(restored), bytes, 'All command and effect records round trip');
for (const at of [4, 8, 12, 104]) {
  const corrupt = bytes.slice();
  new DataView(corrupt.buffer).setUint32(at, 0xffffffff, true);
  assert.throws(() => decodeWebFrame(corrupt, owner, resolve));
}
assert.throws(() => decodeWebFrame(bytes.subarray(0, -1), owner, resolve), /length|header/i);
assert.throws(() => decodeWebFrame(bytes, { ...owner, generation: 1 }, resolve), /owner/);
assert.throws(
  () =>
    decodeWebFrame(bytes, owner, () => {
      throw Error('stale generation');
    }),
  /stale generation/,
);

const large = freezeFrame(
  token,
  Array.from({ length: 2000 }, () => commands[9]),
);
const larger = encode(large, (size) => new Uint8Array(new ArrayBuffer(size + 32), 16, size));
const decodedLarge = decodeWebFrame(larger, owner, resolve);
assert.ok(larger.byteLength > 128 * 1024 && larger.byteLength <= maxWebFrameBytes);
assert.equal(decodedLarge.commands.length, 2000);

const native = freezeFrame(
  {
    owner: { id: 'native', generation: 1 },
    sequence: 1,
    metrics: {
      logicalWidth: 8,
      logicalHeight: 8,
      physicalWidth: 8,
      physicalHeight: 8,
      scale: 1,
      viewportGeneration: 1,
      rendererGeneration: 1,
      nativeContextGeneration: null,
      nativeSurfaceGeneration: null,
    },
  },
  [{ op: 'clear', color: 0xff112233 }],
);
const nativeBytes = encodeFrame(native);
assert.equal(nativeBytes.byteLength, 112);
assert.equal(
  new DataView(nativeBytes.buffer, nativeBytes.byteOffset).getUint32(4, true),
  frameWireVersion,
);
for (const frame of [captured, restored, large, decodedLarge, native]) disposeFrame(frame);
console.log(
  'PASS Web frame wire round trip, wide scalars, resources, packet bounds and native wire 11',
);
