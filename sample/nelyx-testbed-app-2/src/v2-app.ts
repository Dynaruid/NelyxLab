// SPDX-License-Identifier: BSD-3-Clause
import { defineEngineV2App } from '@nelyx/sdk/engine-v2';
import { protocol as p } from '@nelyx/core/v2';
import { engineV2Scene } from './v2-scene.ts';

let scene: ReturnType<typeof engineV2Scene> | undefined;
const environment = globalThis as unknown as { __v2Update?: () => Promise<void> };

/** Existing candidate scene, built as an App separately from the engine supply.
 * Its data-Widget consumers are retired with the real catalog in W9A-08. */
export default defineEngineV2App({
  requiredCapabilities:
    p.capabilities.surface |
    p.capabilities.layoutQueries |
    p.capabilities.editing |
    p.capabilities.semantics |
    p.capabilities.lazyList |
    p.capabilities.gestures |
    p.capabilities.controls |
    p.capabilities.rawObserver |
    p.capabilities.appControlled |
    p.capabilities.graphics |
    p.capabilities.nativeExtensions,
  async build(context) {
    scene = engineV2Scene(await context.asset('image'), (sample) =>
      context.notify({
        kind: 'raw-input',
        sequence: String(sample.sequence),
        publication: String(sample.publication),
        native: true,
      }),
    );
    return scene.root;
  },
  async ready(context) {
    await scene!.editor.refresh();
    context.notify({
      kind: 'testbed-ready',
      lazy: { ...scene!.lazy.currentState!.counters, itemCount: 2000 },
    });
    environment.__v2Update = async () => {
      scene?.counter.currentState?.increment();
    };
  },
  dispose() {
    delete environment.__v2Update;
    scene = undefined;
  },
});
