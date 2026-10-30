// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { Canvas } from '@nelyx/core/ui/canvas';
import {
  FrameRecording,
  captureSceneFrame,
  releaseSceneFrameSource,
  freezeFrame,
  captureBorrowedFrame,
  disposeFrame,
} from '@nelyx/core/ui/frame';
import { Paint } from '@nelyx/core/ui/paint';
import { ImageShader } from '@nelyx/core/ui/shader';
import { AppSession } from '@nelyx/core/hosting/runtime';
import { ResourceRegistry } from '@nelyx/core/hosting/resources';
import { Image } from '@nelyx/core/ui/image';
import {
  bindResourceRetainer,
  releaseCommandResources,
  resourceOwner,
} from '../../dist/ui/resource-retention.js';
const timeout = 1_200_000,
  metrics = {
    logicalWidth: 20,
    logicalHeight: 20,
    physicalWidth: 20,
    physicalHeight: 20,
    scale: 1,
    viewportGeneration: 1,
    rendererGeneration: 1,
    nativeContextGeneration: null,
    nativeSurfaceGeneration: null,
  };
const token = (sequence) => ({
  owner: { id: 'recording-owner', generation: 1 },
  sequence,
  metrics,
});
function resource(id = 'recording-image') {
  const value = { id, generation: 1 };
  let captures = 0,
    retired = 0;
  bindResourceRetainer(value, () => {
    captures++;
    return {
      dispose() {
        retired++;
      },
    };
  });
  return {
    value,
    get captures() {
      return captures;
    },
    get retired() {
      return retired;
    },
  };
}

test(
  'one completed recording moves immutable image/shader commands and their existing holds without a second capture',
  { timeout },
  () => {
    const image = resource(),
      canvas = new Canvas(),
      shader = new ImageShader(
        image.value,
        'clamp',
        'clamp',
        [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      );
    let recording, frame;
    try {
      canvas.image(image.value, { x: 0, y: 0, width: 1, height: 1 });
      canvas.drawRect({ x: 0, y: 0, width: 2, height: 2 }, new Paint({ shader }));
      const commands = [...canvas.commands],
        captured = image.captures,
        current = token(1);
      recording = FrameRecording.capture(current, canvas);
      assert.equal(image.captures, captured);
      assert(canvas.debugDisposed);
      assert(Object.isFrozen(recording.commands));
      assert.notEqual(recording.commands, canvas.commands);
      assert.equal(recording.commands[0], commands[0]);
      assert.equal(recording.commands[1], commands[1]);
      image.value.id = 'later-input';
      canvas.commands.length = 0;
      assert.equal(recording.commands[0].resource.id, 'recording-image');
      assert.throws(() => canvas.rect({ x: 0, y: 0, width: 1, height: 1 }, 0), /closed/);
      frame = captureSceneFrame(current, recording);
      assert(recording.debugDisposed);
      releaseSceneFrameSource(recording);
      shader.dispose();
      assert(image.retired < image.captures);
      disposeFrame(frame);
      frame = undefined;
      assert.equal(image.retired, image.captures);
    } finally {
      disposeFrameIf(frame);
      recording?.dispose();
      canvas.dispose();
      if (!shader.debugDisposed) shader.dispose();
    }
  },
);
function disposeFrameIf(frame) {
  if (frame) disposeFrame(frame);
}

test(
  'borrowed internal recordings share sealed resource/style snapshots while retaining independent command holds',
  { timeout },
  () => {
    const image = resource('borrowed-sealed-image'),
      canvas = new Canvas(),
      shader = new ImageShader(
        image.value,
        'clamp',
        'clamp',
        [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      );
    let frame;
    try {
      canvas.image(image.value, { x: 0, y: 0, width: 1, height: 1 });
      canvas.drawRect({ x: 0, y: 0, width: 2, height: 2 }, new Paint({ shader }));
      frame = captureBorrowedFrame(token(1), canvas.commands);
      assert.notEqual(frame.commands[0], canvas.commands[0]);
      assert.equal(frame.commands[0].resource, canvas.commands[0].resource);
      assert.equal(frame.commands[1].paint, canvas.commands[1].paint);
      assert.equal(frame.commands[1].paint.shader.image, canvas.commands[1].paint.shader.image);
      canvas.dispose();
      shader.dispose();
      assert(image.retired < image.captures);
      disposeFrame(frame);
      frame = undefined;
      assert.equal(image.retired, image.captures);
    } finally {
      disposeFrameIf(frame);
      canvas.dispose();
      if (!shader.debugDisposed) shader.dispose();
    }
  },
);

test(
  'captured resource ownership cannot be retargeted while original inputs still permit a new binding',
  { timeout },
  () => {
    const image = resource(),
      a = new Canvas(),
      b = new Canvas(),
      firstOwner = {},
      nextOwner = {};
    bindResourceRetainer(image.value, () => ({ dispose() {} }), firstOwner);
    try {
      a.image(image.value, { x: 0, y: 0, width: 1, height: 1 });
      const captured = a.commands[0].resource;
      assert.throws(
        () => bindResourceRetainer(captured, () => ({ dispose() {} }), nextOwner),
        /Captured ResourceId bindings are immutable/,
      );
      assert.equal(resourceOwner(captured), firstOwner);
      bindResourceRetainer(image.value, () => ({ dispose() {} }), nextOwner);
      b.image(image.value, { x: 0, y: 0, width: 1, height: 1 });
      assert.equal(resourceOwner(b.commands[0].resource), nextOwner);
      assert.equal(resourceOwner(captured), firstOwner);
    } finally {
      a.dispose();
      b.dispose();
    }
  },
);

test(
  'a registry binding retains the captured identity after the original input is mutated',
  { timeout },
  () => {
    const registry = new ResourceRegistry(),
      a = { id: 'bound-original-a', generation: 1, kind: 'image' },
      b = { id: 'bound-original-b', generation: 1, kind: 'image' },
      canvas = new Canvas();
    let aRetired = 0,
      bRetired = 0,
      frame;
    registry.register(a, () => aRetired++);
    registry.register(b, () => bRetired++);
    registry.bindResource(a);
    try {
      canvas.image(a, { x: 0, y: 0, width: 1, height: 1 });
      a.id = b.id;
      frame = freezeFrame(token(1), canvas.commands);
      registry.releaseProducer({ id: 'bound-original-a', generation: 1 });
      assert.equal(aRetired, 0);
      assert.equal(registry.retainedReferenceCount({ id: 'bound-original-a', generation: 1 }), 1);
      disposeFrame(frame);
      frame = undefined;
      assert.equal(aRetired, 1);
      registry.releaseProducer(b);
      assert.equal(bRetired, 1);
    } finally {
      disposeFrameIf(frame);
      canvas.dispose();
      registry.dispose();
    }
  },
);

test(
  'Image captures its source identity once, initializes its immutable owner and rejects a foreign registry',
  { timeout },
  () => {
    const registry = new ResourceRegistry(),
      foreign = new ResourceRegistry(),
      a = { id: 'image-capture-a', generation: 1, kind: 'image' },
      b = { id: 'image-capture-b', generation: 1, kind: 'image' };
    let reads = 0,
      image,
      clone,
      retired = 0;
    registry.register(a, () => retired++);
    registry.register(b, () => retired++);
    foreign.register(a, () => {});
    try {
      image = Image.fromResource(
        registry,
        {
          get id() {
            return ++reads === 1 ? a.id : b.id;
          },
          generation: 1,
        },
        2,
        3,
      );
      assert.equal(reads, 1);
      assert.equal(image.resource.id, a.id);
      clone = image.clone();
      assert(image.isCloneOf(clone));
      assert.equal(resourceOwner(image.resource), registry);
      assert.throws(() => Image.fromResource(foreign, image.resource, 2, 3), /foreign/);
      assert.equal(foreign.retainedReferenceCount(a), 1);
      registry.releaseProducer(a);
      registry.releaseProducer(b);
      assert.equal(retired, 1);
      image.dispose();
      image = undefined;
      assert.equal(retired, 1);
      clone.dispose();
      clone = undefined;
      assert.equal(retired, 2);
    } finally {
      if (image && !image.debugDisposed) image.dispose();
      if (clone && !clone.debugDisposed) clone.dispose();
      registry.dispose();
      foreign.dispose();
    }
  },
);

test(
  'Image creation returns its hold when identity indexing fails after admission',
  { timeout },
  () => {
    const registry = new ResourceRegistry(),
      a = { id: 'image-index-failure', generation: 1, kind: 'image' },
      stringify = JSON.stringify,
      retain = registry.retainProducer;
    let admitted = 0,
      failures = 0,
      failIndex = false,
      retired = 0;
    registry.register(a, () => retired++);
    registry.retainProducer = function (resource) {
      const hold = retain.call(this, resource);
      admitted++;
      failIndex = true;
      return hold;
    };
    try {
      JSON.stringify = function (...args) {
        if (failIndex) {
          failIndex = false;
          failures++;
          throw 0;
        }
        return stringify.apply(this, args);
      };
      assert.throws(
        () => Image.fromResource(registry, a, 2, 3),
        (error) => error === 0,
      );
    } finally {
      JSON.stringify = stringify;
    }
    try {
      assert.equal(admitted, 1);
      assert.equal(failures, 1);
      assert.equal(registry.retainedReferenceCount(a), 1);
      registry.releaseProducer(a);
      assert.equal(retired, 1);
    } finally {
      registry.dispose();
    }
  },
);

test(
  'a recording with previously consumed command holds must reacquire an independent owner',
  { timeout },
  () => {
    const image = resource(),
      canvas = new Canvas();
    let first, recording;
    try {
      canvas.image(image.value, { x: 0, y: 0, width: 1, height: 1 });
      first = freezeFrame(token(1), canvas.commands);
      const before = image.captures;
      recording = FrameRecording.capture(token(2), canvas);
      assert.equal(image.captures, before + 1);
      disposeFrame(first);
      first = undefined;
      assert(image.retired < image.captures);
      recording.dispose();
      assert.equal(image.retired, image.captures);
    } finally {
      disposeFrameIf(first);
      recording?.dispose();
      canvas.dispose();
    }
  },
);

test(
  'recording transfer requires its exact build token, succeeds once and leaves the taken frame alive',
  { timeout },
  () => {
    const image = resource(),
      canvas = new Canvas(),
      current = token(1);
    canvas.image(image.value, { x: 0, y: 0, width: 1, height: 1 });
    const recording = FrameRecording.capture(current, canvas);
    let frame;
    try {
      assert.throws(() => captureSceneFrame({ ...current }, recording), /another View build token/);
      assert.equal(recording.debugDisposed, false);
      frame = captureSceneFrame(current, recording);
      recording.dispose();
      assert.equal(image.retired, 0);
      assert.throws(() => captureSceneFrame(current, recording), /consumed or disposed/);
      disposeFrame(frame);
      frame = undefined;
      assert.equal(image.retired, 1);
    } finally {
      disposeFrameIf(frame);
      recording.dispose();
      canvas.dispose();
    }
  },
);

test(
  'failed recording admission returns every existing hold before reentrant and falsey retirement failures',
  { timeout },
  () => {
    const canvas = new Canvas(),
      returned = [];
    for (const [index, failure] of [0, undefined].entries()) {
      const id = { id: 'failing-recording-' + index, generation: 1 };
      bindResourceRetainer(id, () => ({
        dispose() {
          returned.push(index);
          releaseCommandResources(canvas.commands);
          throw failure;
        },
      }));
      canvas.image(id, { x: 0, y: 0, width: 1, height: 1 });
    }
    canvas.save();
    let failure;
    try {
      FrameRecording.capture(token(1), canvas);
    } catch (error) {
      failure = error;
    }
    const flattened = (error) =>
      error instanceof AggregateError ? error.errors.flatMap(flattened) : [error];
    assert(failure instanceof AggregateError);
    const errors = flattened(failure);
    assert.match(errors[0].message, /unclosed save/);
    assert.deepEqual(errors.slice(1), [0, undefined]);
    assert.deepEqual(returned, [0, 1]);
    assert(canvas.debugDisposed);
    canvas.dispose();
    assert.deepEqual(returned, [0, 1]);
  },
);

test(
  'sparse command buffers are rejected before a frame escapes and every source/borrowed hold is returned',
  { timeout },
  () => {
    for (const mode of ['copy', 'borrowed', 'owned']) {
      const image = resource('sparse-recording-' + mode),
        canvas = new Canvas();
      canvas.image(image.value, { x: 0, y: 0, width: 1, height: 1 });
      canvas.commands.length = 3;
      let captured;
      try {
        assert.throws(
          () => {
            captured =
              mode === 'owned'
                ? FrameRecording.capture(token(1), canvas)
                : mode === 'borrowed'
                  ? captureBorrowedFrame(token(1), canvas.commands)
                  : freezeFrame(token(1), canvas.commands);
          },
          (error) => error.code === 'invalid-command-list',
        );
        assert.equal(image.retired, image.captures - (mode === 'borrowed' ? 1 : 0));
      } finally {
        if (captured instanceof FrameRecording) captured.dispose();
        else disposeFrameIf(captured);
        canvas.dispose();
      }
      assert.equal(image.retired, image.captures);
    }
  },
);

test(
  'raw scene arrays retain ordinary getter capture and independent resource ownership',
  { timeout },
  () => {
    const image = resource(),
      canvas = new Canvas();
    canvas.image(image.value, { x: 0, y: 0, width: 1, height: 1 });
    const original = canvas.commands[0],
      current = token(1);
    let reads = 0;
    const command = {
      get op() {
        reads++;
        return 'rect';
      },
      rect: { x: 0, y: 0, width: 1, height: 1 },
      color: 0xff123456,
    };
    let frame;
    try {
      frame = captureSceneFrame(current, [original, command]);
      assert(reads > 0);
      assert.notEqual(frame.commands[0], original);
      assert.notEqual(frame.commands[0].resource, original.resource);
      assert.equal(image.captures, 2);
      disposeFrame(frame);
      frame = undefined;
      assert.equal(image.retired, 2);
    } finally {
      disposeFrameIf(frame);
      canvas.dispose();
    }
  },
);

test(
  'a failing recording owner close cancels its completed buffer and preserves the close and lease failures',
  { timeout },
  () => {
    const image = { id: 'recording-close-failure', generation: 1 };
    let retired = 0;
    bindResourceRetainer(image, () => ({
      dispose() {
        retired++;
        throw null;
      },
    }));
    class FailingCanvas extends Canvas {
      dispose() {
        super.dispose();
        throw 0;
      }
    }
    const canvas = new FailingCanvas();
    canvas.image(image, { x: 0, y: 0, width: 1, height: 1 });
    let failure;
    try {
      FrameRecording.capture(token(1), canvas);
    } catch (error) {
      failure = error;
    }
    assert(failure instanceof AggregateError);
    assert.deepEqual(failure.errors, [0, null]);
    assert(canvas.debugDisposed);
    assert.equal(retired, 1);
  },
);

test(
  'View consumes a recording once and returns its resources on replacement, stale metrics, suppression and close',
  { timeout },
  async () => {
    for (const mode of ['admit', 'stale', 'suppress', 'close', 'empty']) {
      const callbacks = new Map();
      let next = 0,
        view,
        recording,
        retired = 0,
        captures = 0;
      const clock = {
        request(callback) {
          const id = ++next;
          callbacks.set(id, callback);
          return {
            dispose() {
              callbacks.delete(id);
            },
          };
        },
      };
      const image = { id: 'view-recording-' + mode, generation: 1, kind: 'image' };
      const session = new AppSession(
        {
          id: 'owned-view',
          createScene: () => (context) => {
            const canvas = new Canvas();
            canvas.image(image, { x: 0, y: 0, width: 1, height: 1 });
            recording = FrameRecording.capture(context.token, canvas);
            if (mode === 'stale') view.updateMetrics({ ...metrics, viewportGeneration: 2 });
            if (mode === 'close') view.beginClose();
            return recording;
          },
        },
        clock,
      );
      session.resources.register(image, () => retired++);
      session.resources.bindResource(image);
      const retain = session.resources.retainProducer;
      session.resources.retainProducer = function (id) {
        captures++;
        return retain.call(this, id);
      };
      const renderer = {
        capabilities: { admission: 'bounded' },
        observe() {
          return { dispose() {} };
        },
        updateMetrics() {},
        submit() {
          throw Error('This test retains a CPU pending frame');
        },
        async dispose() {},
      };
      try {
        view = session.attach({
          id: 'recording-owner',
          generation: 1,
          metrics: mode === 'empty' ? { ...metrics, physicalWidth: 0, logicalWidth: 0 } : metrics,
          renderer,
          ownership: 'owned',
        });
        if (mode === 'suppress') view.controller = { shouldSubmitFrame: () => false, dispose() {} };
        view.requestFrame();
        view.buildPending(mode === 'empty');
        assert(recording.debugDisposed);
        assert.equal(captures, 1);
        assert.equal(session.resources.retainedReferenceCount(image), mode === 'admit' ? 2 : 1);
        assert.equal(retired, 0);
        if (mode === 'admit') {
          view.requestFrame();
          view.buildPending();
          assert(recording.debugDisposed);
          assert.equal(captures, 2);
          assert.equal(session.resources.retainedReferenceCount(image), 2);
        }
        await session.dispose();
        assert.equal(retired, 1);
        assert.equal(callbacks.size, 0);
      } finally {
        await session.dispose();
      }
    }
  },
);
