// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { SceneBuilder } from '@nelyx/core/ui/scene';
import { Picture } from '@nelyx/core/ui/picture';
import { PictureRecorder } from '@nelyx/core/ui/picture-recorder';
import { Canvas } from '@nelyx/core/ui/canvas';
import { ResourceRegistry } from '@nelyx/core/hosting/resources';
import { FramePictureService } from '@nelyx/core/hosting/pictures';
import {
  OffsetLayer,
  PictureLayer,
  ContainerLayer,
  LayerHandle,
} from '@nelyx/core/framework/rendering/layer';
const timeout = 1_200_000;
test(
  'layer ownership drains all siblings and composition observers after hook failures',
  { timeout },
  () => {
    const root = new ContainerLayer(),
      events = [],
      attachErrors = [Error('first attach'), Error('second attach')],
      detachErrors = [Error('first detach'), Error('second detach')],
      callbackError = Error('composition observer');
    class Fault extends ContainerLayer {
      constructor(index) {
        super();
        this.index = index;
      }
      attach(owner) {
        super.attach(owner);
        events.push('attach-' + this.index);
        throw attachErrors[this.index];
      }
      detach() {
        super.detach();
        events.push('detach-' + this.index);
        throw detachErrors[this.index];
      }
    }
    root.append(new Fault(0));
    root.append(new Fault(1));
    const remove = root.addCompositionCallback(() => {
      events.push('observer');
      throw callbackError;
    });
    try {
      assert.throws(
        () => root.attach({}),
        (error) => {
          assert.deepEqual(error.errors, attachErrors);
          return true;
        },
      );
      assert(root.children.every((child) => child.attached));
      assert.throws(
        () => root.detach(),
        (error) => {
          assert.deepEqual(error.errors, [...detachErrors, callbackError]);
          return true;
        },
      );
      assert(root.children.every((child) => !child.attached));
      assert.deepEqual(events, ['attach-0', 'attach-1', 'detach-0', 'detach-1', 'observer']);
    } finally {
      remove();
      root.dispose();
    }
  },
);

function leaf(resource) {
  const recorder = new PictureRecorder(),
    canvas = new Canvas(recorder);
  try {
    if (resource) canvas.image(resource, { x: 0, y: 0, width: 1, height: 1 });
    else canvas.rect({ x: 0, y: 0, width: 5, height: 5 }, 0xff123456);
    return recorder.endRecording();
  } finally {
    canvas.dispose();
  }
}

test(
  'native retained layers reuse one complete recording while parent motion and frame resource holds stay current',
  { timeout },
  () => {
    const resources = new ResourceRegistry(),
      image = { id: 'retained-image', generation: 1, kind: 'image' },
      compiled = [],
      retired = [];
    let imageRetired = 0;
    resources.register(image, () => imageRetired++);
    resources.bindResource(image);
    const owner = new FramePictureService(
      resources,
      {
        compile(capture, descriptor) {
          compiled.push({ descriptor, commands: capture.frame.commands });
          return {
            bytes: 128,
            retire() {
              retired.push(descriptor.id);
            },
          };
        },
      },
      { id: 'retained-owner', generation: 1 },
    );
    const picture = leaf(image),
      initial = new SceneBuilder(owner),
      outputs = [],
      layers = [],
      cpu = new Canvas();
    let layer;
    try {
      layer = initial.pushOffset(4, 6);
      layers.push(layer);
      for (let index = 0; index < 16; index++) layers.push(initial.pushOffset(1, 2));
      initial.addPicture({ x: 0, y: 0 }, picture);
      const first = new Canvas();
      outputs.push(first);
      initial._buildInto(first);
      layer._draw(cpu);
      const baseline = [...cpu.commands];
      const ids = [];
      for (const dx of [10, 35, -12]) {
        const builder = new SceneBuilder(owner),
          output = new Canvas();
        outputs.push(output);
        try {
          layers.push(builder.pushOffset(dx, 0));
          builder.addRetained(layer);
          builder._buildInto(output);
          const draws = output.commands.filter((command) => command.op === 'drawPicture');
          assert.equal(draws.length, 1);
          ids.push(draws[0].resource.id);
          assert(
            output.commands.length < 10,
            'A retained hierarchy must not expand into every scrolling frame',
          );
          assert(
            output.commands.some(
              (command) => command.op === 'transform' && command.matrix[4] === dx,
            ),
            'The current parent motion remains outside the retained recording',
          );
        } finally {
          builder.dispose();
        }
      }
      assert.equal(new Set(ids).size, 1);
      assert.equal(compiled.length, 2, 'One leaf and one retained hierarchy compile once');
      assert.deepEqual(
        compiled[1].commands,
        baseline,
        'Native retention preserves the complete scoped CPU display list',
      );
      for (const value of layers) value.dispose();
      picture.dispose();
      resources.releaseProducer(image);
      owner.dispose();
      assert.equal(
        imageRetired,
        0,
        'Recorded frames keep native pictures and their image inputs alive',
      );
      for (const output of outputs) output.dispose();
      cpu.dispose();
      assert.equal(imageRetired, 1);
      assert.equal(retired.length, 2);
      assert.deepEqual(owner.debugStats, { cached: 0, live: 0, bytes: 0 });
    } finally {
      for (const output of outputs) output.dispose();
      cpu.dispose();
      for (const value of layers) value.dispose();
      initial.dispose();
      picture.dispose();
      owner.dispose();
      resources.dispose();
    }
  },
);

test(
  'failed native retained capture rolls back the output and permits a fresh owner retry',
  { timeout },
  () => {
    const resources = new ResourceRegistry(),
      compiled = [];
    let reject = false;
    const owner = new FramePictureService(
      resources,
      {
        compile(capture, _descriptor) {
          if (reject) {
            reject = false;
            throw Error('retained compile failed');
          }
          compiled.push(capture.frame);
          return { bytes: 128, retire() {} };
        },
      },
      { id: 'retry-owner', generation: 1 },
    );
    const picture = leaf(),
      first = new SceneBuilder(owner),
      output = new Canvas();
    let layer;
    try {
      layer = first.pushOffset(4, 6);
      first.addPicture({ x: 0, y: 0 }, picture);
      first._buildInto(output);
      output.rollback(0);
      output.rect({ x: 0, y: 0, width: 2, height: 2 }, 0xff123456);
      const before = [...output.commands];
      const failed = new SceneBuilder(owner);
      try {
        failed.addRetained(layer);
        reject = true;
        assert.throws(() => failed._buildInto(output), /retained compile failed/);
        assert.deepEqual(output.commands, before);
        assert.equal(layer.debugDisposed, false);
      } finally {
        failed.dispose();
      }
      const retry = new SceneBuilder(owner);
      try {
        retry.addRetained(layer);
        retry._buildInto(output);
        assert.equal(compiled.length, 2);
        assert.equal(output.commands.filter((command) => command.op === 'drawPicture').length, 1);
      } finally {
        retry.dispose();
      }
    } finally {
      output.dispose();
      layer?.dispose();
      first.dispose();
      picture.dispose();
      owner.dispose();
      resources.dispose();
    }
  },
);

test(
  'layer child snapshots stay frozen across removal and depth-first traversal preserves sibling order',
  { timeout },
  () => {
    const root = new ContainerLayer(),
      branch = new OffsetLayer(),
      first = new ContainerLayer(),
      second = new ContainerLayer(),
      handle = new LayerHandle(first);
    try {
      root.append(branch);
      branch.append(first);
      const before = branch.children;
      branch.append(second);
      assert(Object.isFrozen(before));
      assert.deepEqual(before, [first]);
      assert.deepEqual(branch.children, [first, second]);
      assert.deepEqual(root.depthFirstIterateChildren(), [branch, first, second]);
      first.remove();
      assert.deepEqual(branch.children, [second]);
      assert.deepEqual(before, [first]);
      assert(Object.isFrozen(root.depthFirstIterateChildren()));
    } finally {
      root.dispose();
      handle.dispose();
    }
  },
);

test(
  'composition callback snapshots survive listener mutation and track late registration, reparenting and disposal',
  { timeout },
  () => {
    const root = new ContainerLayer(),
      other = new ContainerLayer(),
      branch = new OffsetLayer(),
      child = new OffsetLayer(),
      handle = new LayerHandle(branch),
      forbidden = new ContainerLayer(),
      events = [];
    let removeB = () => {},
      removeC = () => {},
      added = false;
    root.attach({});
    other.attach({});
    root.append(branch);
    branch.append(child);
    const removeA = branch.addCompositionCallback(() => {
      events.push('a');
      removeB();
      if (!added) {
        added = true;
        removeC = child.addCompositionCallback(() => events.push('c'));
      }
      assert.throws(() => root.append(forbidden), /callbacks/);
    });
    removeB = child.addCompositionCallback(() => events.push('b'));
    try {
      assert(root.subtreeHasCompositionCallbacks);
      root.buildScene().dispose();
      assert.deepEqual(events, ['a', 'b']);
      events.length = 0;
      root.buildScene().dispose();
      assert.deepEqual(events, ['a', 'c']);
      branch.remove();
      assert.equal(root.subtreeHasCompositionCallbacks, false);
      assert(branch.subtreeHasCompositionCallbacks);
      other.append(branch);
      assert(other.subtreeHasCompositionCallbacks);
      removeA();
      removeC();
      assert.equal(other.subtreeHasCompositionCallbacks, false);
      const late = child.addCompositionCallback(() => {});
      assert(other.subtreeHasCompositionCallbacks);
      other.removeAllChildren();
      assert.equal(other.subtreeHasCompositionCallbacks, false);
      handle.dispose();
      late();
      removeA();
      assert.equal(other.subtreeHasCompositionCallbacks, false);
    } finally {
      removeA();
      removeB();
      removeC();
      root.dispose();
      other.dispose();
      handle.dispose();
      forbidden.dispose();
    }
  },
);
test(
  'retained layer reparenting preserves descendant depths across equal, deeper and shallower parents',
  { timeout },
  () => {
    const root = new ContainerLayer(),
      other = new ContainerLayer(),
      parent = new ContainerLayer(),
      branch = new ContainerLayer(),
      child = new ContainerLayer(),
      leaf = new ContainerLayer(),
      handle = new LayerHandle(branch);
    try {
      root.append(parent);
      parent.append(branch);
      branch.append(child);
      child.append(leaf);
      assert.deepEqual([branch.depth, child.depth, leaf.depth], [2, 3, 4]);
      branch.remove();
      parent.append(branch);
      assert.deepEqual([branch.depth, child.depth, leaf.depth], [2, 3, 4]);
      branch.remove();
      other.append(branch);
      assert.deepEqual([branch.depth, child.depth, leaf.depth], [1, 2, 3]);
      const deep = new ContainerLayer();
      parent.append(deep);
      branch.remove();
      deep.append(branch);
      assert.deepEqual([branch.depth, child.depth, leaf.depth], [3, 4, 5]);
    } finally {
      root.dispose();
      other.dispose();
      handle.dispose();
    }
  },
);

test(
  'streaming a retained scene takes independent holds without allocating a transient Picture',
  { timeout },
  () => {
    const resources = new ResourceRegistry(),
      image = { id: 'stream-image', generation: 1, kind: 'image' };
    let retired = 0,
      created = 0;
    resources.register(image, () => retired++);
    resources.bindResource(image);
    const picture = leaf(image),
      builder = new SceneBuilder(),
      output = new Canvas(),
      previous = Picture.onCreate;
    let layer;
    try {
      layer = builder.pushOffset(4, 6);
      builder.addPicture({ x: 0, y: 0 }, picture);
      Picture.onCreate = () => created++;
      builder._buildInto(output);
      assert.equal(created, 0);
      assert.equal(output.commands.filter((command) => command.op === 'image').length, 1);
      layer.dispose();
      picture.dispose();
      resources.releaseProducer(image);
      assert.equal(retired, 0);
      output.dispose();
      assert.equal(retired, 1);
    } finally {
      Picture.onCreate = previous;
      output.dispose();
      layer?.dispose();
      builder.dispose();
      if (!picture.debugDisposed) picture.dispose();
      resources.dispose();
    }
  },
);

test(
  'a failed streamed replay restores the destination and retires all source holds',
  { timeout },
  () => {
    class FailingCanvas extends Canvas {
      record(command) {
        if (command.op === 'image') throw Error('stream interrupted');
        super.record(command);
      }
    }
    const resources = new ResourceRegistry(),
      image = { id: 'failed-stream-image', generation: 1, kind: 'image' };
    let retired = 0;
    resources.register(image, () => retired++);
    resources.bindResource(image);
    const picture = leaf(image),
      builder = new SceneBuilder(),
      output = new FailingCanvas();
    let layer;
    try {
      output.rect({ x: 0, y: 0, width: 2, height: 2 }, 0xff123456);
      const before = [...output.commands];
      layer = builder.pushOffset(4, 6);
      builder.addPicture({ x: 0, y: 0 }, picture);
      picture.dispose();
      resources.releaseProducer(image);
      assert.throws(() => builder._buildInto(output), /stream interrupted/);
      assert.deepEqual(output.commands, before);
      assert.equal(layer.debugDisposed, true);
      assert.equal(retired, 1);
    } finally {
      output.dispose();
      layer?.dispose();
      builder.dispose();
      if (!picture.debugDisposed) picture.dispose();
      resources.dispose();
    }
  },
);

test(
  'streamed scenes enforce expanded wire and layer budgets before exposing a frame',
  { timeout },
  () => {
    for (const kind of ['records', 'layers']) {
      const builder = new SceneBuilder(),
        output = new Canvas(),
        layers = [];
      try {
        output.rect({ x: 0, y: 0, width: 2, height: 2 }, 0xff123456);
        const before = [...output.commands];
        if (kind === 'records') {
          for (let index = 0; index < 900; index++)
            layers.push(builder.pushTransform([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1]));
        } else {
          for (let index = 0; index < 33; index++) layers.push(builder.pushOpacity(128));
        }
        assert.throws(() => builder._buildInto(output), /budget/);
        assert.deepEqual(output.commands, before);
        assert(layers.every((layer) => layer.debugDisposed));
      } finally {
        output.dispose();
        builder.dispose();
        for (const layer of layers) layer.dispose();
      }
    }
  },
);

test(
  'streamed scenes reject conflicting registry owners and retire every copied hold',
  { timeout },
  () => {
    const registries = [new ResourceRegistry(), new ResourceRegistry()],
      images = registries.map(() => ({ id: 'shared-stream-id', generation: 1, kind: 'image' })),
      pictures = [],
      builder = new SceneBuilder(),
      output = new Canvas();
    let retired = 0;
    try {
      for (let index = 0; index < registries.length; index++) {
        const registry = registries[index],
          image = images[index];
        registry.register(image, () => retired++);
        registry.bindResource(image);
        const picture = leaf(image);
        pictures.push(picture);
        builder.addPicture({ x: 0, y: 0 }, picture);
        picture.dispose();
        registry.releaseProducer(image);
      }
      assert.throws(() => builder._buildInto(output), /mix registries/);
      assert.equal(output.commands.length, 0);
      assert.equal(retired, 2);
    } finally {
      output.dispose();
      builder.dispose();
      for (const picture of pictures) picture.dispose();
      for (const registry of registries) registry.dispose();
    }
  },
);

test(
  'Repeated layer invalidation reaches clean ancestors once and a later scene starts a fresh propagation',
  { timeout },
  () => {
    class Counted extends OffsetLayer {
      calls = 0;
      markNeedsAddToScene() {
        this.calls++;
        super.markNeedsAddToScene();
      }
    }
    const root = new Counted(),
      ancestors = [root],
      picture = leaf(),
      draw = new PictureLayer({ x: 0, y: 0, width: 5, height: 5 });
    let scene;
    try {
      let parent = root;
      for (let i = 0; i < 24; i++) {
        const next = new Counted();
        parent.append(next);
        ancestors.push(next);
        parent = next;
      }
      draw.picture = picture;
      parent.append(draw);
      scene = root.buildScene();
      scene.dispose();
      scene = null;
      for (const layer of ancestors) layer.calls = 0;
      for (let i = 0; i < 20; i++) draw.markNeedsAddToScene();
      assert(ancestors.every((layer) => layer.calls === 1));
      scene = root.buildScene();
      scene.dispose();
      scene = null;
      assert(ancestors.every((layer) => !layer.debugNeedsAddToScene));
      for (const layer of ancestors) layer.calls = 0;
      draw.markNeedsAddToScene();
      assert(ancestors.every((layer) => layer.calls === 1));
    } finally {
      scene?.dispose();
      root.dispose();
      if (!picture.debugDisposed) picture.dispose();
    }
  },
);

test(
  'Structural identity layers do not inflate wire commands and retained replay keeps independent sibling coordinates',
  { timeout },
  () => {
    const picture = leaf(),
      builder = new SceneBuilder(),
      layers = [],
      output = new Canvas(),
      state = new Canvas();
    let scene;
    try {
      layers.push(builder.pushOffset(40, 20));
      for (let i = 0; i < 100; i++) layers.push(builder.pushOffset(0, 0));
      builder.addPicture({ x: 0, y: 0 }, picture);
      for (let i = 0; i < 100; i++) builder.pop();
      layers.push(builder.pushTransform([1, 0, 0, 1, 0, 0]));
      builder.addPicture({ x: 0, y: 0 }, picture);
      builder.pop();
      layers.push(builder.pushOffset(100, 0));
      builder.addPicture({ x: 0, y: 0 }, picture);
      builder.pop();
      builder.pop();
      builder.addPicture({ x: 0, y: 0 }, picture);
      scene = builder.build();
      scene._draw(output);
      const positions = [];
      for (const command of output.commands) {
        if (command.op === 'rect') {
          const matrix = state.getTransform();
          positions.push([matrix[12], matrix[13]]);
        }
        state.addCommands([command]);
      }
      assert.deepEqual(positions, [
        [40, 20],
        [40, 20],
        [140, 20],
        [0, 0],
      ]);
      assert.equal(output.commands.filter((command) => command.op === 'transform').length, 2);
      assert(output.commands.length < 30);
    } finally {
      state.dispose();
      output.dispose();
      scene?.dispose();
      builder.dispose();
      for (const layer of layers) layer.dispose();
      picture.dispose();
    }
  },
);
test(
  'Identity layer storage remains bounded even when its display-list commands collapse',
  { timeout },
  () => {
    const builder = new SceneBuilder();
    try {
      for (let i = 0; i < 4096; i++) builder.pushOffset(0, 0);
      assert.throws(() => builder.pushOffset(0, 0), /budget/);
    } finally {
      builder.dispose();
    }
  },
);

test('Identity elision still rejects sparse and nonfinite transform storage', { timeout }, () => {
  const builder = new SceneBuilder();
  try {
    assert.throws(() => builder.pushTransform(Array(16)), /finite/);
    assert.throws(() => builder.pushTransform([1, 0, 0, 1, NaN, 0]), /finite/);
  } finally {
    builder.dispose();
  }
});
test(
  'Deep compositing records one final display list rather than copying it at every layer',
  { timeout },
  () => {
    const picture = leaf(),
      builder = new SceneBuilder(),
      layers = [],
      output = new Canvas();
    let scene,
      created = 0,
      inspected = 0;
    const previous = Picture.onCreate,
      saveCount = Canvas.prototype.getSaveCount;
    try {
      Picture.onCreate = () => created++;
      Canvas.prototype.getSaveCount = function () {
        inspected += this.commands.length;
        return saveCount.call(this);
      };
      for (let i = 0; i < 80; i++) layers.push(builder.pushOffset(i, 1));
      builder.addPicture({ x: 2, y: 3 }, picture);
      scene = builder.build();
      assert.equal(created, 1);
      scene._draw(output);
      assert.equal(output.commands.filter((command) => command.op === 'rect').length, 1);
      assert.equal(output.commands.filter((command) => command.op === 'transform').length, 81);
      assert(
        inspected < 2000,
        'Balanced scene replay must not rescan the growing list at every nested restore',
      );
    } finally {
      Canvas.prototype.getSaveCount = saveCount;
      Picture.onCreate = previous;
      output.dispose();
      scene?.dispose();
      builder.dispose();
      for (const layer of layers) layer.dispose();
      picture.dispose();
    }
  },
);
test(
  'A retained capture survives disposal of its original layer and scene and keeps native resource holds',
  { timeout },
  () => {
    const resources = new ResourceRegistry(),
      image = { id: 'scene-image', generation: 1, kind: 'image' };
    let retired = 0;
    resources.register(image, () => retired++);
    resources.bindResource(image);
    const picture = leaf(image),
      first = new SceneBuilder(),
      second = new SceneBuilder(),
      output = new Canvas();
    let original, retained, layer;
    try {
      layer = first.pushOffset(4, 6);
      first.addPicture({ x: 1, y: 2 }, picture);
      original = first.build();
      second.addRetained(layer);
      layer.dispose();
      original.dispose();
      picture.dispose();
      resources.releaseProducer(image);
      assert.equal(retired, 0);
      retained = second.build();
      retained._draw(output);
      assert.equal(output.commands.filter((command) => command.op === 'image').length, 1);
      retained.dispose();
      assert.equal(retired, 0);
      output.dispose();
      assert.equal(retired, 1);
    } finally {
      output.dispose();
      retained?.dispose();
      original?.dispose();
      layer?.dispose();
      first.dispose();
      second.dispose();
      if (!picture.debugDisposed) picture.dispose();
      resources.dispose();
    }
  },
);
test(
  'Cancelling a retained scene releases its own capture and preserves the foreign layer',
  { timeout },
  () => {
    const picture = leaf(),
      owner = new SceneBuilder(),
      cancelled = new SceneBuilder(),
      next = new SceneBuilder();
    let scene, other, layer;
    try {
      layer = owner.pushOffset(0, 0);
      owner.addPicture({ x: 0, y: 0 }, picture);
      scene = owner.build();
      cancelled.addRetained(layer);
      assert.throws(() => cancelled.addRetained(layer), /only be used once/);
      cancelled.dispose();
      assert.equal(layer.debugDisposed, false);
      next.addRetained(layer);
      other = next.build();
    } finally {
      other?.dispose();
      scene?.dispose();
      layer?.dispose();
      owner.dispose();
      cancelled.dispose();
      next.dispose();
      picture.dispose();
    }
  },
);
test(
  'Oversized flattened scenes fail closed and release all resource captures',
  { timeout },
  () => {
    const resources = new ResourceRegistry(),
      image = { id: 'oversize-image', generation: 1, kind: 'image' };
    let retired = 0;
    resources.register(image, () => retired++);
    resources.bindResource(image);
    const picture = leaf(image),
      builder = new SceneBuilder(),
      layers = [];
    try {
      for (let i = 0; i < 1500; i++) layers.push(builder.pushOffset(1, 0));
      builder.addPicture({ x: 0, y: 0 }, picture);
      assert.throws(() => builder.build(), /budget/);
      picture.dispose();
      resources.releaseProducer(image);
      assert.equal(retired, 1);
      assert(layers.every((layer) => layer.debugDisposed));
    } finally {
      builder.dispose();
      for (const layer of layers) layer.dispose();
      if (!picture.debugDisposed) picture.dispose();
      resources.dispose();
    }
  },
);
