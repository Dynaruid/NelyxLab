// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { SizedBox, Text } from '@nelyx/core/framework/widgets/basic';
import { ListView } from '@nelyx/core/framework/widgets/scroll-view';
import { ScrollController } from '@nelyx/core/framework/widgets/scroll-controller';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { DefaultAssetBundle } from '@nelyx/core/framework/widgets/default-asset-bundle';
import { AssetBundle } from '@nelyx/core/services/asset-bundle';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { Color } from '@nelyx/core/ui/color';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { Material } from '../dist/material.js';
import { Theme, ThemeData } from '../dist/theme.js';
import { ListTile } from '../dist/list-tile.js';
import { engineFixture } from './engine-fixture.mjs';
const timeout = 1_200_000;
FoundationPlatform.configure({ kind: 'native', operatingSystem: 'windows' });
class NoAssets extends AssetBundle {
  async load(key) {
    throw Error('Unexpected tile asset ' + key);
  }
}
const assets = new NoAssets(),
  theme = new ThemeData();
function pixels(f, surface) {
  f.library.replay(surface.getCanvas(), { commands: f.frame() });
  surface.flush();
  const image = surface.makeImageSnapshot();
  try {
    return Buffer.from(
      image.readPixels(0, 0, {
        width: 240,
        height: 160,
        colorType: f.ck.ColorType.RGBA_8888,
        alphaType: f.ck.AlphaType.Unpremul,
        colorSpace: f.ck.ColorSpace.SRGB,
      }),
    );
  } finally {
    image.delete();
  }
}
test(
  'reactivated Material ink and text match a fresh legacy row in all pixels and use the latest tap callback',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      surface = f.ck.MakeSurface(240, 160);
    let cache;
    try {
      for (const direction of ['ltr', 'rtl'])
        for (const selected of [false, true]) {
          let expected;
          for (const mode of ['legacy', 'dormant']) {
            const scroll = new ScrollController(),
              calls = [],
              built = [];
            let version = 0;
            const list = ListView.builder({
              controller: scroll,
              primary: false,
              itemCount: 100,
              itemExtent: 80,
              cacheExtent: 0,
              padding: EdgeInsets.zero,
              childPolicy: mode === 'legacy' ? 'legacy' : { mode: 'dormant', capacity: 8 },
              itemBuilder: (_context, index) => {
                built.push([index, version]);
                const captured = version;
                return new ListTile({
                  id: 'dormant-tile-' + index,
                  title: new Text('Tile ' + index),
                  subtitle: new Text('Detail ' + index),
                  selected,
                  selectedTileColor: new Color(0xffd0e0f0),
                  onTap: () => calls.push(captured),
                });
              },
            });
            try {
              f.set(
                new DefaultAssetBundle(
                  assets,
                  new MediaQuery(
                    {
                      width: 240,
                      height: 160,
                      scale: 1,
                      textScale: 1,
                      keyboardInset: 0,
                      safeArea: { left: 0, top: 0, right: 0, bottom: 0 },
                    },
                    new Directionality(
                      direction,
                      new Theme(
                        theme,
                        new Material({
                          color: new Color(0xfff0e8f0),
                          clipBehavior: 'hardEdge',
                          child: list,
                        }),
                      ),
                    ),
                  ),
                ),
              );
              f.root.buildOwner.focus.rootScope.requestFocus();
              f.root.buildOwner.focus.applyFocusChangesIfNeeded();
              f.frame();
              scroll.jumpTo(160);
              f.frame();
              version = 1;
              scroll.jumpTo(0);
              f.frame();
              const actual = pixels(f, surface);
              if (mode === 'legacy') expected = actual;
              else {
                assert.deepEqual(actual, expected, JSON.stringify({ direction, selected }));
                cache = f.root.buildOwner.maybeDormantChildren;
                assert(
                  cache.debugStats.hits > 0,
                  'The actual private ink/semantics anchors must permit row reuse',
                );
              }
              // Send the input after the final pixel recipe: a mouse hover/highlight
              // from an earlier tap legitimately requests explicit keep-alive.
              if (mode === 'dormant' && direction === 'rtl' && selected) {
                assert(
                  built.some(([index, value]) => index === 0 && value === 1),
                  'The tapped row must actually reenter the builder',
                );
                f.tap('dormant-tile-0');
                assert.deepEqual(calls, [1]);
              }
            } finally {
              f.set(new SizedBox(1, 1));
              scroll.dispose();
            }
          }
        }
    } finally {
      surface.delete();
      await f.close();
    }
    assert.equal(cache.debugStats.children, 0);
    assert.equal(cache.debugStats.elements, 0);
  },
);
