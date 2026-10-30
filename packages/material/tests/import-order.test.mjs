// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test(
  'each theme entry loads first in an isolated ESM process and shares immutable M3 specifications',
  { timeout: 1_200_000 },
  () => {
    for (const first of [
      '@nelyx/material/typography',
      '@nelyx/material/script-category',
      '@nelyx/material/text-theme',
      '@nelyx/material/theme-data',
      '@nelyx/material/theme',
      '@nelyx/material/chip-theme',
      '@nelyx/material/scrollbar-theme',
      '@nelyx/material/tooltip-theme',
      '@nelyx/material/slider-theme',
      '@nelyx/material/chip',
      '@nelyx/cupertino/interface-level',
    ]) {
      const source = `
      import assert from 'node:assert/strict';
      await import(${JSON.stringify(first)});
      const {FoundationPlatform} = await import('@nelyx/core/foundation/platform');
      FoundationPlatform.configure({kind:'native',operatingSystem:'windows'});
      const {ThemeData} = await import('@nelyx/material/theme-data');
      const {TextTheme} = await import('@nelyx/material/text-theme');
      const {material2021} = await import('./packages/material/dist/generated/theme/typography-data.js');
      assert(Object.isFrozen(material2021));
      for (const key of ['englishLike','dense','tall']) {assert(Object.isFrozen(material2021[key]));assert.equal(material2021[key],material2021[key]);assert.equal(new TextTheme(material2021[key]).displayLarge.fontSize,57);}
      const base = ThemeData.light();
      assert.equal(base.textTheme.bodyMedium.fontSize,null,'Factory text theme supplies color/font; locale geometry is composed on lookup');
      const theme = ThemeData.localize(base,base.typography.englishLike);
      assert.equal(theme.textTheme.displayLarge.fontSize,57);
      assert.equal(theme.textTheme.bodyMedium.fontSize,14);
      assert.equal(theme.textTheme.labelSmall.fontSize,11);
    `;
      const result = spawnSync(process.execPath, ['--input-type=module', '-e', source], {
        cwd: new URL('../../../', import.meta.url),
        encoding: 'utf8',
        timeout: 1_200_000,
      });
      assert.equal(result.status, 0, first + '\n' + result.stderr);
    }
  },
);
