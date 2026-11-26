// SPDX-License-Identifier: BSD-3-Clause
// Adapted from the Image demo in DorotiTestbedApp. See LICENSE.flutter.
import { ValueKey } from '@nelyx/core/foundation/key';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { AssetImage, NetworkImage } from '@nelyx/core/framework/painting/image-provider';
import {
  Center,
  Column,
  DecoratedBox,
  Padding,
  SizedBox,
  Text,
} from '@nelyx/core/framework/widgets/basic';
import {
  State,
  StatefulWidget,
  type BuildContext,
  type Widget,
} from '@nelyx/core/framework/widgets/framework';
import { createLocalImageConfiguration, Image } from '@nelyx/core/framework/widgets/image';
import { Wrap } from '@nelyx/core/framework/widgets/wrap';
import * as M from '@nelyx/material/widgets';
import { imageScheme, sampleImage, themeImageAsset } from './image-palette.ts';

const imageUrl = 'https://plus.unsplash.com/premium_photo-1734210255965-0a721514a34e';

export class ComponentImage extends StatefulWidget {
  override createState() {
    return new ComponentImageState();
  }
}

class ComponentImageState extends State<ComponentImage> {
  private source = 'Asset';
  private cover = false;
  private revision = 0;
  private reload = 0;
  private loading = false;
  private message: string | null = null;
  private scheme: M.ColorScheme | null = null;

  private provider() {
    if (this.source === 'URL') return new NetworkImage(imageUrl);
    return new AssetImage(this.source === 'Theme image' ? themeImageAsset(1) : sampleImage);
  }

  private async retry(context: BuildContext) {
    const revision = this.revision;
    try {
      await this.provider().evict({ configuration: createLocalImageConfiguration(context) });
      if (this.mounted && revision === this.revision)
        this.setState(() => {
          this.reload++;
          this.message = null;
        });
    } catch {
      if (this.mounted && revision === this.revision)
        this.setState(() => {
          this.message = 'Could not reload the image';
        });
    }
  }

  private async extract(context: BuildContext) {
    const revision = ++this.revision;
    this.setState(() => {
      this.loading = true;
      this.message = null;
    });
    try {
      const scheme = await imageScheme(context, this.provider());
      if (this.mounted && revision === this.revision)
        this.setState(() => {
          this.scheme = scheme;
        });
    } catch {
      if (this.mounted && revision === this.revision)
        this.setState(() => {
          this.message = 'Could not read image colors';
        });
    } finally {
      if (this.mounted && revision === this.revision)
        this.setState(() => {
          this.loading = false;
        });
    }
  }

  override build(context: BuildContext): Widget {
    return new Center(
      new SizedBox(
        450,
        undefined,
        new Padding(
          EdgeInsets.all(12),
          new Column(
            [
              new Center(
                new M.SegmentedButton({
                  segments: ['Asset', 'Theme image', 'URL'].map(
                    (value) => new M.ButtonSegment({ value, label: new Text(value) }),
                  ),
                  selected: new Set([this.source]),
                  onSelectionChanged: (values) =>
                    this.setState(() => {
                      this.source = [...values][0]!;
                      this.revision++;
                      this.scheme = this.message = null;
                      this.loading = false;
                    }),
                }),
              ),
              new SizedBox(
                undefined,
                220,
                new DecoratedBox(
                  new Image(this.provider(), {
                    key: new ValueKey(`${this.source}/${this.reload}`),
                    fit: this.cover ? 'cover' : 'contain',
                    semanticLabel:
                      this.source === 'Asset' ? 'Oranges by Mae Mu' : 'Sample photograph',
                    frameBuilder: (_context, child, frame) =>
                      frame === null ? new Center(new M.CircularProgressIndicator()) : child,
                    errorBuilder: (errorContext) =>
                      new Center(
                        new Column(
                          [
                            new Text('Image could not be loaded'),
                            new M.TextButton({
                              child: new Text('Retry'),
                              onPressed: () => {
                                void this.retry(errorContext);
                              },
                            }),
                          ],
                          { mainSize: 'min' },
                        ),
                      ),
                  }),
                  M.Theme.of(context).colorScheme.surfaceContainer,
                ),
              ),
              new Wrap(
                [
                  new M.FilterChip({
                    label: new Text('Cover'),
                    selected: this.cover,
                    onSelected: (cover) =>
                      this.setState(() => {
                        this.cover = cover;
                      }),
                  }),
                  new M.OutlinedButton({
                    child: new Text('Extract image colors'),
                    onPressed: this.loading
                      ? null
                      : () => {
                          void this.extract(context);
                        },
                  }),
                ],
                { spacing: 8, runSpacing: 8, alignment: 'center' },
              ),
              ...(this.loading
                ? [new M.LinearProgressIndicator({ semanticsLabel: 'Extracting colors' })]
                : []),
              ...(this.message ? [new Text(this.message)] : []),
              ...(this.scheme
                ? [
                    this.preview(this.scheme),
                    this.preview(
                      M.ColorScheme.fromSeed({
                        seedColor: this.scheme.primary,
                        brightness: 'dark',
                      }),
                    ),
                  ]
                : []),
            ],
            { mainSize: 'min', crossAlign: 'stretch', spacing: 12 },
          ),
        ),
      ),
    );
  }

  private preview(scheme: M.ColorScheme): Widget {
    return new Column(
      [
        new Text(scheme.brightness === 'light' ? 'Light image colors' : 'Dark image colors'),
        new Wrap(
          [
            ['Primary', scheme.primary, scheme.onPrimary],
            ['Secondary', scheme.secondary, scheme.onSecondary],
            ['Tertiary', scheme.tertiary, scheme.onTertiary],
          ].map(
            ([label, fill, on]) =>
              new DecoratedBox(
                new Padding(EdgeInsets.all(8), new Text(String(label), { color: Number(on) })),
                Number(fill),
                6,
              ),
          ),
          { spacing: 8, runSpacing: 8 },
        ),
      ],
      { mainSize: 'min', crossAlign: 'start', spacing: 6 },
    );
  }
}
