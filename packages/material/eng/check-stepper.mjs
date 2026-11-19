// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { execute } from '../../../Nelyx/sdk/tooling/cli/src/commands.mjs';
import { FlutterError } from '@nelyx/core/foundation/flutter-error';
import { ValueNotifier } from '@nelyx/core/foundation/notifier';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { FrameDiagnostics, releaseSceneFrameSource } from '@nelyx/core/ui/frame';
import { freezeTextInput } from '@nelyx/core/ui/text';
import { ResourceRegistry } from '@nelyx/core/hosting/resources';
import { Text } from '@nelyx/core/framework/widgets/basic';
import { State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import { ListenableBuilder } from '@nelyx/core/framework/widgets/listenable-builder';
import { FrameworkRoot } from '@nelyx/core/framework/widgets/root';
import { ScrollController } from '@nelyx/core/framework/widgets/scroll-controller';
import { flattenSemantics } from '@nelyx/core/framework/semantics/semantics';

if (!process.argv.includes('--child')) {
  await execute(
    process.execPath,
    ['--experimental-transform-types', import.meta.filename, '--child'],
    {
      timeout: 1_200_000,
    },
  );
  process.exit(0);
}

// Load the same shader text the Material build inlines, without writing dist.
registerHooks({
  load(url, context, nextLoad) {
    if (!url.endsWith('.sksl')) return nextLoad(url, context);
    return {
      format: 'module',
      shortCircuit: true,
      source: `export default ${JSON.stringify(readFileSync(new URL(url), 'utf8'))}`,
    };
  },
});
const { MaterialApp } = await import('../src/app.ts');
const { Material } = await import('../src/material.ts');
const { TextButton } = await import('../src/text-button.ts');
const { ControlsDetails, Step, Stepper, StepperType, StepState } =
  await import('../src/stepper.ts');

FlutterError.onError = ({ exception }) => {
  throw exception;
};
FoundationPlatform.configure({ kind: 'native', operatingSystem: 'windows' });
const names = ['Account', 'Unavailable', 'Review'];
const contentNames = ['Account form', 'Unavailable form', 'Review form'];
class Panel extends StatefulWidget {
  constructor(index) {
    super();
    this.index = index;
  }
  createState() {
    return new (class extends State {
      build() {
        return new Text(contentNames[this.widget.index]);
      }
    })();
  }
}
const steps = names.map(
  (name, index) =>
    new Step({
      title: new Text(name),
      content: new Panel(index),
      ...(index === 1 ? { state: StepState.disabled } : {}),
      ...(index === 2 ? { state: StepState.error, label: new Text('Check') } : {}),
    }),
);
assert.throws(() => new Stepper({ steps, currentStep: 0.5 }), /currentStep/);

async function check(type) {
  const selection = new ValueNotifier(0),
    scroll = new ScrollController();
  const changes = [],
    details = [];
  const owner = { id: `stepper-${type}`, generation: 1 };
  const resources = new ResourceRegistry();
  const font = resources.allocateId('font');
  resources.register({ ...font, kind: 'font' }, () => {});
  let now = 0,
    sequence = 0,
    semantics = [];
  const clock = { now: () => now },
    frameDiagnostics = new FrameDiagnostics(clock);
  const metrics = {
    logicalWidth: 640,
    logicalHeight: 400,
    physicalWidth: 640,
    physicalHeight: 400,
    scale: 1,
    viewportGeneration: 1,
    rendererGeneration: 1,
    nativeContextGeneration: null,
    nativeSurfaceGeneration: null,
  };
  const view = new FrameworkRoot(
    {
      owner,
      resources,
      assets: new Map(),
      defaultFont: font,
      clock,
      paths: { contains: () => true },
      text: {
        layout(raw) {
          const input = freezeTextInput(raw),
            width = Math.min(input.width, input.text.length * 7);
          const resource = resources.allocateId('paragraph');
          resources.register({ ...resource, kind: 'paragraph' }, () => {});
          return {
            resource,
            input,
            indexUnit: 'utf16',
            width,
            height: 16,
            alphabeticBaseline: 12,
            ideographicBaseline: 12,
            minIntrinsicWidth: width,
            maxIntrinsicWidth: width,
            longestLine: width,
            overflow: false,
            unresolvedGlyphs: 0,
            lines: [
              {
                start: 0,
                end: input.text.length,
                baseline: 12,
                bounds: { x: 0, y: 0, width, height: 16 },
              },
            ],
          };
        },
        hit: () => ({ position: 0, affinity: 'downstream' }),
        range: () => [],
        boxes: () => [],
        glyphAt: () => null,
      },
      semantics: {
        capability: 'native-controls',
        bind(nodes) {
          semantics = nodes;
          return {
            update: (nodes) => {
              semantics = nodes;
            },
            dispose() {},
          };
        },
        dispose() {},
      },
      readMetrics: () => metrics,
      readStatus: () => 'open',
      requestFrame() {},
      reportError(error) {
        throw error;
      },
    },
    {
      id: owner.id,
      createRoot: () =>
        new MaterialApp({
          home: new Material({
            child: new ListenableBuilder(
              selection,
              () =>
                new Stepper({
                  type,
                  steps,
                  controller: scroll,
                  currentStep: selection.value,
                  onStepTapped: (index) => changes.push(index),
                  onStepContinue: () => changes.push('continue'),
                  ...(type === StepperType.horizontal
                    ? {
                        onStepCancel: () => changes.push('cancel'),
                        controlsBuilder: (_context, value) => {
                          details.push(value);
                          return new TextButton({
                            onPressed: value.onStepCancel,
                            child: new Text('Back'),
                          });
                        },
                      }
                    : {}),
                }),
            ),
          }),
        }),
    },
  );
  function tick(count = 1) {
    for (let frame = 0; frame < count; frame++) {
      now += 80;
      releaseSceneFrameSource(
        view.build({
          token: { owner, sequence: ++sequence, metrics },
          resources,
          frameDiagnostics,
        }),
      );
    }
  }
  function find(predicate) {
    let found;
    function visit(node) {
      if (found) return;
      if (predicate(node.widget)) found = node;
      else node.visitChildren(visit);
    }
    visit(view.root);
    assert(found);
    return found;
  }
  function position(text) {
    const render = find(
      (widget) => widget instanceof Text && widget.text === text,
    ).findRenderObject();
    return render.localToGlobal({ x: render.size.width / 2, y: render.size.height / 2 });
  }
  function tap(text) {
    const { x, y } = position(text);
    for (const kind of ['down', 'up'])
      view.pointer({
        kind,
        pointer: 1,
        device: 'mouse',
        x,
        y,
        buttons: kind === 'down' ? 1 : 0,
        timestamp: now,
        viewportGeneration: 1,
      });
    tick();
  }
  function checkVisible(current) {
    const visible = flattenSemantics(semantics).flatMap(({ name }) => name.split('\n'));
    for (const [index, text] of contentNames.entries()) {
      assert.equal(visible.includes(text), index === current, JSON.stringify(visible));
    }
  }
  try {
    tick(2);
    assert(scroll.hasClients);
    const firstPanel = find((widget) => widget === steps[0].content).state;
    checkVisible(0);
    const headers = flattenSemantics(semantics).filter(({ role }) => role === 'button');
    const unavailable = headers.find(({ name }) => name.split('\n').includes('Unavailable'));
    const account = headers.find(({ name }) => name.split('\n').includes('Account'));
    assert.equal(unavailable?.enabled, false);
    assert.equal(account?.selected, true);
    if (type === StepperType.vertical) {
      assert(position('Account').y < position('Account form').y);
      assert(position('Account form').y < position('Unavailable').y);
      tap('Continue');
      tap('Cancel');
      assert.deepEqual(changes.splice(0), ['continue']);
    } else {
      assert(position('Account').x < position('Review').x);
      assert(position('Review').y < position('Account form').y);
      assert(details.at(-1) instanceof ControlsDetails);
      assert.equal(details.at(-1).stepIndex, 0);
      assert.equal(details.at(-1).isActive, true);
      tap('Back');
      assert.deepEqual(changes.splice(0), ['cancel']);
    }
    tap('Unavailable');
    tap('Review');
    assert.deepEqual(changes, [2]);
    checkVisible(0);
    selection.value = 2;
    tick(4);
    checkVisible(2);
    if (type === StepperType.horizontal) {
      assert.equal(details.at(-1).currentStep, 2);
      assert.equal(details.at(-1).stepIndex, 2);
    }
    selection.value = 0;
    tick(4);
    checkVisible(0);
    assert.equal(find((widget) => widget === steps[0].content).state, firstPanel);
    await Promise.resolve();
  } finally {
    view.dispose();
    selection.dispose();
    scroll.dispose();
  }
}
await check(StepperType.vertical);
await check(StepperType.horizontal);
console.log('Mounted Stepper checks passed');
