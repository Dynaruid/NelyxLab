// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { Directionality } from '@nelyx/core/framework/widgets/app-data';
import { SizedBox } from '@nelyx/core/framework/widgets/basic';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { Material } from '@nelyx/material/material';
import { InkWell } from '@nelyx/material/ink-well';
import { InkSparkle } from '@nelyx/material/ink-sparkle';
import { Theme } from '@nelyx/material/theme';
import { ThemeData } from '@nelyx/material/theme-data';
import { engineFixture } from './engine-fixture.mjs';

const timeout = 1_200_000;
test(
  'built InkSparkle paints the packaged SkSL with its original float ABI and retires',
  { timeout },
  async () => {
    FoundationPlatform.configure({ kind: 'native', operatingSystem: 'windows' });
    const source = fs.readFileSync(
      new URL('../assets/shaders/ink_sparkle.sksl', import.meta.url),
      'utf8',
    );
    const ownership = JSON.parse(
      fs.readFileSync(
        new URL(
          '../../../tools/Nelyx.FrameworkToTypeScript/data/work8/w11-sparkle-shader-ownership.json',
          import.meta.url,
        ),
      ),
    );
    assert.equal(ownership.output.file, 'packages/material/assets/shaders/ink_sparkle.sksl');
    assert.equal(createHash('sha256').update(source).digest('hex'), ownership.output.sha256);
    const f = await engineFixture(),
      surface = f.ck.MakeSurface(240, 160);
    let taps = 0;
    try {
      f.set(
        new Directionality(
          'ltr',
          new Theme(
            new ThemeData({ platform: 'windows' }),
            new Material({
              child: new InkWell({
                id: 'file-shader',
                onTap: () => taps++,
                enableFeedback: false,
                splashFactory: InkSparkle.constantTurbulenceSeedSplashFactory,
                child: new SizedBox(160, 100),
              }),
            }),
          ),
        ),
      );
      f.tap('file-shader');
      for (const step of [90, 90, 90]) {
        const commands = f.advance(step),
          shader = commands.find((command) => command.paint?.shader?.kind === 'runtime')?.paint
            .shader;
        assert(shader, 'The actual ink owner must paint a runtime effect');
        assert.equal(
          shader.source,
          source,
          'The package build must embed the canonical file bytes',
        );
        assert.equal(shader.uniforms.length, 28);
        const effect = f.ck.RuntimeEffect.Make(source);
        assert(effect, 'Packaged SkSL must compile in the product CanvasKit');
        try {
          assert.equal(effect.getUniformFloatCount(), 28);
        } finally {
          effect.delete();
        }
        f.library.replay(surface.getCanvas(), { commands });
        surface.flush();
      }
      assert.equal(taps, 1);
      assert.equal(f.library.debugRuntimePrograms.compilations, 1);
      assert.equal(f.library.debugRuntimePrograms.entries, 1);
      const image = surface.makeImageSnapshot();
      try {
        assert(image.encodeToBytes()?.length > 0, 'Read back the rendered surface');
      } finally {
        image.delete();
      }
      f.advance(1000);
      assert(!f.frame().some((command) => command.paint?.shader?.kind === 'runtime'));
      f.set(new SizedBox());
      assert.equal(f.root.scheduler.transientCallbackCount, 0);
    } finally {
      surface?.delete();
      await f.close();
    }
    assert.equal(f.library.debugRuntimePrograms.entries, 0);
  },
);
