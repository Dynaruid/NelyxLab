// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from '../../../packages/material/tests/root-fixture.mjs';
import { CustomPaint } from '@nelyx/core/framework/widgets/custom-paint';
import {
  CustomPainter,
  CustomPainterSemantics,
} from '@nelyx/core/framework/rendering/custom-paint';
import { SemanticsNode } from '@nelyx/core/framework/semantics/semantics';
import { RepaintBoundary } from '@nelyx/core/framework/widgets/repaint-boundary';
import { SizedBox, Transform, Row } from '@nelyx/core/framework/widgets/basic';
import {
  State,
  StatefulWidget,
  RenderObjectElement,
  LeafRenderObjectWidget,
} from '@nelyx/core/framework/widgets/framework';
import { RenderRepaintBoundary } from '@nelyx/core/framework/rendering/repaint-boundary';
import { Navigator, NavigatorController, Route } from '@nelyx/core/framework/widgets/navigation';
import { PageRouteBuilder } from '@nelyx/core/framework/widgets/pages';
import { Offstage } from '@nelyx/core/framework/widgets/offstage';
import { ChangeNotifier } from '@nelyx/core/foundation/notifier';
import { FramePictureService } from '@nelyx/core/hosting/pictures';
import { existingSemanticsFor } from '../../dist/framework/rendering/semantics-pipeline.js';
import { AlwaysStoppedAnimation } from '@nelyx/core/framework/animation/animations';
import { Color } from '@nelyx/core/ui/color';
import { SourceScrollbarPainter } from '../../dist/framework/widgets/scrollbar.generated.js';
import {
  scrollbarCorePainter,
  scrollbarRegisterEmptyPainterSemantics,
} from '../../dist/framework/widgets/scrollbar-painter-source-adapter.js';
import '@nelyx/core/framework/widgets/scrollbar';
const timeout = 1_200_000;
class Painter extends CustomPainter {
  count = 0;
  color = 0xff123456;
  constructor(repaint) {
    super({ repaint });
  }
  paint(canvas) {
    this.count++;
    canvas.rect({ x: 0, y: 0, width: 10, height: 10 }, this.color);
  }
  shouldRepaint() {
    return false;
  }
}

test(
  'a retained leaf owns its paint contents, refreshes pixels and retries a failed recording',
  { timeout },
  () => {
    const f = fixture(),
      outerChanges = new ChangeNotifier(),
      outer = new Painter(outerChanges);
    let render;
    class Leaf extends LeafRenderObjectWidget {
      createRenderObject() {
        return (render = new (class extends RenderRepaintBoundary {
          paints = 0;
          color = 0xff123456;
          fail = false;
          performLayout(c) {
            return c.constrain({ width: 20, height: 20 });
          }
          paintContents(context) {
            this.paints++;
            if (this.fail) throw Error('leaf paint failed');
            context.rect({ x: 0, y: 0, width: 20, height: 20 }, this.color);
          }
          repaint(color) {
            this.color = color;
            this.markNeedsPaintOnly();
          }
        })());
      }
    }
    try {
      f.set(new RepaintBoundary(new CustomPaint(new Leaf(), { painter: outer })));
      assert.equal(render.paints, 1);
      const parentPaints = outer.count;
      render.repaint(0xffabcdef);
      assert(f.frame().some((command) => command.op === 'rect' && command.color === 0xffabcdef));
      assert.equal(render.paints, 2);
      assert.equal(outer.count, parentPaints);
      f.frame();
      assert.equal(render.paints, 2);
      render.fail = true;
      render.repaint(0xff234567);
      assert.throws(() => f.frame(), /leaf paint failed/);
      render.fail = false;
      assert(f.frame().some((command) => command.op === 'rect' && command.color === 0xff234567));
      assert.equal(outer.count, parentPaints);
      f.set(new SizedBox());
      assert(render.debugDisposed);
    } finally {
      f.close();
      outerChanges.dispose();
    }
  },
);

test(
  'scrollbar resize retains empty painter semantics and observes an overridden source builder',
  { timeout },
  () => {
    scrollbarRegisterEmptyPainterSemantics(SourceScrollbarPainter.prototype);
    const f = fixture(),
      source = new SourceScrollbarPainter({
        color: new Color(0xff123456),
        fadeoutOpacityAnimation: new AlwaysStoppedAnimation(0),
      });
    const resize = (width) => {
      const metrics = f.root.context.readMetrics();
      Object.assign(metrics, {
        logicalWidth: width,
        physicalWidth: width,
        viewportGeneration: metrics.viewportGeneration + 1,
      });
      f.frame();
    };
    try {
      f.set(new CustomPaint(new SizedBox(20, 20), { painter: scrollbarCorePainter(source) }));
      const render = f.root.pipeline.root,
        configuration = existingSemanticsFor(render).configProvider.original;
      resize(300);
      assert.equal(existingSemanticsFor(render).configProvider.original, configuration);
      Object.defineProperty(source, 'semanticsBuilder', {
        configurable: true,
        get() {
          return (size) => [
            new CustomPainterSemantics({
              rect: { x: 0, y: 0, width: size.width, height: size.height },
              properties: { role: 'text', name: `Width ${size.width}`, enabled: true },
            }),
          ];
        },
      });
      resize(280);
      assert(f.root.nodes.some((node) => node.name === 'Width 280'));
      resize(260);
      assert(f.root.nodes.some((node) => node.name === 'Width 260'));
      assert(!f.root.nodes.some((node) => node.name === 'Width 280'));
      delete source.semanticsBuilder;
      resize(300);
      assert(!f.root.nodes.some((node) => node.name?.startsWith('Width ')));
    } finally {
      f.close();
      source.dispose();
    }
  },
);

test(
  'CustomPainter repaint signals preserve semantics while delegate semantic changes still publish',
  { timeout },
  () => {
    const f = fixture(),
      changes = new ChangeNotifier(),
      calls = [];
    let updates = 0;
    class SemanticPainter extends Painter {
      constructor(label, color) {
        super(changes);
        this.label = label;
        this.color = color;
      }
      shouldRepaint(old) {
        return this.color !== old.color;
      }
      shouldRebuildSemantics(old) {
        return this.label !== old.label;
      }
      get semanticsBuilder() {
        return (size) => [
          new CustomPainterSemantics({
            rect: { x: 0, y: 0, ...size },
            properties: {
              role: 'button',
              name: this.label,
              enabled: true,
              activate: () => calls.push(this.label),
            },
          }),
        ];
      }
    }
    const show = (painter) => f.set(new CustomPaint(new SizedBox(20, 20), { painter })),
      update = SemanticsNode.prototype.updateWith;
    try {
      const first = new SemanticPainter('First', 0xff123456);
      show(first);
      SemanticsNode.prototype.updateWith = function (...args) {
        updates++;
        return update.apply(this, args);
      };
      first.color = 0xffabcdef;
      changes.notifyListeners();
      assert(f.frame().some((command) => command.op === 'rect' && command.color === 0xffabcdef));
      assert.equal(updates, 0, 'A repaint signal must not rebuild source semantic nodes');
      const action = f.root.nodes.find((node) => node.name === 'First');
      assert(action?.actions?.activate);
      action.actions.activate();
      assert.deepEqual(calls, ['First']);
      show(new SemanticPainter('Second', 0xffabcdef));
      assert(updates > 0, 'A semantic delegate change must reach the source tree');
      assert(!f.root.nodes.some((node) => node.name === 'First'));
      const replacement = f.root.nodes.find((node) => node.name === 'Second');
      assert(replacement?.actions?.activate);
      replacement.actions.activate();
      assert.deepEqual(calls, ['First', 'Second']);
      updates = 0;
      changes.notifyListeners();
      f.frame();
      assert.equal(updates, 0);
      assert.equal(
        f.root.nodes.find((node) => node.name === 'Second')?.bounds.width,
        replacement.bounds.width,
      );
    } finally {
      SemanticsNode.prototype.updateWith = update;
      f.close();
      changes.dispose();
    }
  },
);

test(
  'A rebuilt branch synchronizes its changed render children while a stable sibling stays untouched',
  { timeout },
  () => {
    const f = fixture(),
      stable = new SizedBox(20, 20);
    let state,
      render,
      stableCalls = 0;
    class Changing extends StatefulWidget {
      createState() {
        state = new (class extends State {
          width = 20;
          build() {
            return new SizedBox(this.width, 20);
          }
        })();
        return state;
      }
    }
    try {
      f.set(new Row([stable, new Changing()]));
      const visit = (element) => {
        if (element.widget === stable) render = element.renderObject;
        for (const child of element.children) visit(child);
      };
      visit(f.root.root);
      const original = render.setChildren.bind(render);
      render.setChildren = (children) => {
        stableCalls++;
        original(children);
      };
      state.setState(() => {
        state.width = 40;
      });
      f.frame();
      assert.equal(stableCalls, 0);
      assert.equal(state.context.children[0].renderObject.size.width, 40);
      assert.equal(render.size.width, 20);
    } finally {
      f.close();
    }
  },
);

test(
  'Navigator moves retained page content without repainting it and still repaints app changes',
  { timeout },
  async () => {
    const f = fixture(),
      controller = new NavigatorController(),
      changes = new ChangeNotifier(),
      painter = new Painter(changes),
      background = new Painter(),
      route = new PageRouteBuilder({
        pageBuilder: () => new CustomPaint(new SizedBox(100, 100), { painter }),
        transitionsBuilder: (_context, animation, _secondary, child) =>
          Transform.translate(child, { x: 100 * (1 - animation.value), y: 0 }),
      });
    try {
      f.set(
        new RepaintBoundary(
          new CustomPaint(new Navigator(controller, new Route(() => new SizedBox(100, 100))), {
            painter: background,
          }),
        ),
      );
      const result = controller.push(route);
      f.frame();
      const count = painter.count,
        backgroundCount = background.count;
      const first = f.advance(80),
        second = f.advance(80);
      assert.notDeepEqual(first, second);
      assert.equal(painter.count, count, 'Page motion must reuse the local page recording');
      assert.equal(
        background.count,
        backgroundCount,
        'Route motion must not repaint the app background',
      );
      painter.color = 0xffabcdef;
      changes.notifyListeners();
      assert(f.frame().some((command) => command.op === 'rect' && command.color === 0xffabcdef));
      assert.equal(painter.count, count + 1);
      controller.pop();
      f.frame();
      f.advance(301);
      await Promise.resolve();
      f.frame();
      await result;
      assert.equal(f.root.scheduler.transientCallbackCount, 0);
    } finally {
      f.close();
      controller.dispose();
      changes.dispose();
    }
  },
);
test(
  'A nested animated boundary updates visible pixels without repainting its static parent',
  { timeout },
  () => {
    const f = fixture(),
      changes = new ChangeNotifier(),
      outerChanges = new ChangeNotifier(),
      outer = new Painter(outerChanges),
      inner = new Painter(changes);
    const commit = RenderObjectElement.prototype._commitRenderChildren;
    let synchronizations = 0;
    try {
      f.set(
        new RepaintBoundary(
          new CustomPaint(
            new RepaintBoundary(new CustomPaint(new SizedBox(20, 20), { painter: inner })),
            { painter: outer },
          ),
        ),
      );
      RenderObjectElement.prototype._commitRenderChildren = function () {
        if (this.owner === f.root.buildOwner) synchronizations++;
        return commit.call(this);
      };
      assert.equal(outer.count, 1);
      assert.equal(inner.count, 1);
      inner.color = 0xffabcdef;
      changes.notifyListeners();
      const commands = f.frame();
      assert.equal(outer.count, 1);
      assert.equal(inner.count, 2);
      assert(commands.some((command) => command.op === 'rect' && command.color === 0xffabcdef));
      assert.equal(
        synchronizations,
        0,
        'Paint-only frames must not renormalize the unchanged Element tree',
      );
      f.frame();
      assert.equal(outer.count, 1);
      assert.equal(inner.count, 2);
      outerChanges.notifyListeners();
      f.frame();
      assert.equal(outer.count, 2);
      assert.equal(inner.count, 2, 'Parent replacement must retain the clean child layer');
      changes.notifyListeners();
      f.frame();
      assert.equal(outer.count, 2);
      assert.equal(inner.count, 3, 'The reparented retained child must remain independently dirty');
      f.set(new SizedBox(30, 30));
      assert(synchronizations > 0, 'Widget replacement must still synchronize the render tree');
    } finally {
      RenderObjectElement.prototype._commitRenderChildren = commit;
      f.close();
      changes.dispose();
      outerChanges.dispose();
    }
  },
);

test(
  'a dirty repaint boundary reuses identical native picture content and recompiles changed pixels',
  { timeout },
  () => {
    const f = fixture(),
      changes = new ChangeNotifier(),
      painter = new Painter(changes);
    let compiled = 0,
      retired = 0;
    const pictures = new FramePictureService(
      f.root.context.resources,
      {
        compile() {
          compiled++;
          return {
            bytes: 0,
            retire() {
              retired++;
            },
          };
        },
      },
      f.root.context.owner,
    );
    f.root.context.pictures = pictures;
    try {
      f.set(new RepaintBoundary(new CustomPaint(new SizedBox(20, 20), { painter })));
      const initial = compiled;
      assert(initial > 0);
      assert.equal(painter.count, 1);
      changes.notifyListeners();
      f.frame();
      assert.equal(painter.count, 2, 'The painter still executes when its owner is dirty');
      assert.equal(
        compiled,
        initial,
        'Identical immutable output must keep the same native recording',
      );
      painter.color = 0xffabcdef;
      changes.notifyListeners();
      f.frame();
      assert.equal(compiled, initial + 1);
      assert.equal(painter.count, 3);
      f.set(new SizedBox(20, 20));
      assert.equal(retired, compiled);
    } finally {
      f.close();
      pictures.dispose();
      changes.dispose();
      assert.equal(retired, compiled);
    }
  },
);
test(
  'Hidden nested boundaries defer painting and show their latest content after layout changes',
  { timeout },
  () => {
    const f = fixture(),
      changes = new ChangeNotifier(),
      outer = new Painter(),
      inner = new Painter(changes),
      child = new RepaintBoundary(new CustomPaint(new SizedBox(20, 20), { painter: inner }));
    const tree = (hidden) =>
      new RepaintBoundary(
        new CustomPaint(new Offstage(child, { offstage: hidden }), { painter: outer }),
      );
    try {
      f.set(tree(false));
      f.set(tree(true));
      const count = inner.count;
      inner.color = 0xffabcdef;
      changes.notifyListeners();
      f.frame();
      assert.equal(inner.count, count);
      const commands = f.set(tree(false));
      assert(inner.count > count);
      assert(commands.some((command) => command.op === 'rect' && command.color === 0xffabcdef));
    } finally {
      f.close();
      changes.dispose();
    }
  },
);

test(
  'dirty hidden recordings return obsolete image owners while an admitted frame keeps its own lease',
  { timeout },
  () => {
    const f = fixture(),
      changes = new ChangeNotifier(),
      image = { id: 'hidden-snapshot', generation: 1, kind: 'image' },
      registry = f.root.context.resources;
    let retired = 0,
      lease;
    registry.register(image, () => retired++);
    registry.bindResource(image);
    class ImagePainter extends CustomPainter {
      include = true;
      count = 0;
      constructor() {
        super({ repaint: changes });
      }
      paint(canvas) {
        this.count++;
        if (this.include) canvas.image(image, { x: 0, y: 0, width: 10, height: 10 });
      }
      shouldRepaint() {
        return false;
      }
    }
    const painter = new ImagePainter(),
      child = new RepaintBoundary(new CustomPaint(new SizedBox(20, 20), { painter })),
      tree = (hidden) => new Offstage(child, { offstage: hidden });
    try {
      f.set(tree(false));
      lease = registry.acquire([image]);
      registry.releaseProducer(image);
      f.set(tree(true));
      assert.equal(retired, 0, 'A clean hidden recording remains reusable');
      const count = painter.count;
      painter.include = false;
      changes.notifyListeners();
      f.frame();
      assert.equal(painter.count, count, 'Hidden content is not painted to release its cache');
      assert.equal(
        registry.retainedReferenceCount(image),
        1,
        'Only the admitted frame may still retain the obsolete image',
      );
      assert.equal(retired, 0);
      lease.returnBy('caller');
      lease = undefined;
      assert.equal(retired, 1);
      const commands = f.set(tree(false));
      assert.equal(painter.count, count + 1);
      assert(!commands.some((command) => command.op === 'image'));
    } finally {
      lease?.returnBy('caller');
      f.close();
      changes.dispose();
    }
  },
);
test(
  'A failed render owner commit is retried after its widget build has already drained',
  { timeout },
  () => {
    const f = fixture();
    try {
      f.set(new SizedBox(10, 10));
      const element = f.root.root.children[0],
        commit = element._commitRenderChildren.bind(element);
      let calls = 0;
      element._commitRenderChildren = () => {
        if (++calls === 1) throw Error('synchronization interrupted');
        commit();
      };
      assert.throws(() => f.set(new SizedBox(20, 20)), /synchronization interrupted/);
      assert.equal(f.root.buildOwner.hasDirty, false);
      f.frame();
      assert.equal(calls, 2);
      f.frame();
      assert.equal(calls, 2);
    } finally {
      f.close();
    }
  },
);

test(
  'A render child normalization failure retains the dirty branch until its retry succeeds',
  { timeout },
  () => {
    const f = fixture(),
      widgets = [new SizedBox(10, 10), new SizedBox(20, 20)];
    let render, original;
    try {
      f.set(new Row(widgets));
      render = f.root.root.children[0].renderObject;
      original = render.setChildren.bind(render);
      const expected = [...render.children];
      render.move(expected[1]);
      let calls = 0;
      render.setChildren = (children) => {
        if (++calls === 1) throw Error('child normalization interrupted');
        original(children);
      };
      assert.throws(() => f.set(new Row(widgets)), /child normalization interrupted/);
      f.frame();
      assert.equal(calls, 2);
      assert.deepEqual(render.children, expected);
      assert.equal(render.needsLayout, false);
      f.frame();
      assert.equal(calls, 2);
    } finally {
      if (original) render.setChildren = original;
      f.close();
    }
  },
);
