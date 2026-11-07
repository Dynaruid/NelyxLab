// SPDX-License-Identifier: BSD-3-Clause
import { State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import { Center, Text, SizedBox, DecoratedBox } from '@nelyx/core/framework/widgets/basic';
import { Image, createLocalImageConfiguration } from '@nelyx/core/framework/widgets/image';
import { AssetImage, NetworkImage } from '@nelyx/core/framework/painting/image-provider';
import type { ImageProvider } from '@nelyx/core/framework/painting/image-provider';
import { ValueKey } from '@nelyx/core/foundation/key';
import { ChoiceChip } from '@nelyx/material/choice-chip';
import { FilledButton } from '@nelyx/material/filled-button';
import { TextButton } from '@nelyx/material/text-button';
import { ColorScheme } from '@nelyx/material/color-scheme';
import { Theme } from '@nelyx/material/theme';
import { column, flow, inset } from './layout.ts';

const imageUrl = 'https://images.unsplash.com/photo-1582979512210-99b6a53386f9?w=720&q=80&fit=crop';

export class ImageDemo extends StatefulWidget {
  createState(): State<ImageDemo> {
    return new ImageDemoState();
  }
}
class ImageDemoState extends State<ImageDemo> {
  private remote = false;
  private cover = true;
  private loading = false;
  private revision = 0;
  private reload = 0;
  private error = '';
  private palettes: readonly ColorScheme[] = [];

  private provider(): ImageProvider {
    return this.remote ? new NetworkImage(imageUrl) : new AssetImage('component-image');
  }
  private select(remote: boolean): void {
    this.setState(() => {
      this.remote = remote;
      this.revision++;
      this.loading = false;
      this.error = '';
      this.palettes = [];
    });
  }
  private async retry(context: BuildContext): Promise<void> {
    const revision = this.revision;
    try {
      await this.provider().evict({ configuration: createLocalImageConfiguration(context) });
      if (this.mounted && revision === this.revision)
        this.setState(() => {
          this.reload++;
        });
    } catch (error) {
      if (this.mounted && revision === this.revision)
        this.setState(() => {
          this.error = String(error);
        });
    }
  }
  private async extract(context: BuildContext): Promise<void> {
    const revision = ++this.revision;
    this.setState(() => {
      this.loading = true;
      this.error = '';
      this.palettes = [];
    });
    try {
      const rasterizer = context.services.rasterizer;
      if (!rasterizer) throw Error('Image color extraction is unavailable on this renderer.');
      const provider = this.provider();
      const configuration = createLocalImageConfiguration(context);
      const light = await ColorScheme.fromImageProvider({ provider, configuration, rasterizer });
      const dark = await ColorScheme.fromImageProvider({
        provider,
        configuration,
        rasterizer,
        brightness: 'dark',
      });
      if (this.mounted && revision === this.revision)
        this.setState(() => {
          this.palettes = [light, dark];
          this.loading = false;
        });
    } catch (error) {
      if (this.mounted && revision === this.revision)
        this.setState(() => {
          this.error = String(error);
          this.loading = false;
        });
    }
  }
  override dispose(): void {
    this.revision++;
    super.dispose();
  }
  build(context: BuildContext): Widget {
    const colors = Theme.of(context).colorScheme;
    return column(
      flow(
        ...[false, true].map(
          (remote) =>
            new ChoiceChip({
              label: new Text(remote ? 'Image URL' : 'Local asset'),
              selected: this.remote === remote,
              onSelected: () => this.select(remote),
            }),
        ),
      ),
      new SizedBox(
        undefined,
        220,
        new DecoratedBox(
          new Image(this.provider(), {
            key: new ValueKey(String(this.remote) + ':' + this.reload),
            width: 720,
            height: 220,
            fit: this.cover ? 'cover' : 'contain',
            semanticLabel: this.remote ? 'Photo from Unsplash' : 'Oranges by Mae Mu, Unsplash',
            frameBuilder: (_, child, frame, synchronous) =>
              frame !== null || synchronous ? child : new Center(new Text('Loading image…')),
            errorBuilder: () =>
              new Center(
                column(
                  new Text('Image could not be loaded.'),
                  new TextButton({
                    child: new Text('Retry image'),
                    onPressed: () => {
                      void this.retry(context);
                    },
                  }),
                ),
              ),
          }),
          colors.surfaceContainerHighest,
          12,
        ),
      ),
      flow(
        ...[false, true].map(
          (cover) =>
            new ChoiceChip({
              label: new Text(cover ? 'Cover' : 'Contain'),
              selected: this.cover === cover,
              onSelected: () =>
                this.setState(() => {
                  this.cover = cover;
                }),
            }),
        ),
      ),
      FilledButton.tonal({
        child: new Text(this.loading ? 'Extracting…' : 'Extract colors'),
        onPressed: this.loading
          ? null
          : () => {
              void this.extract(context);
            },
      }),
      new Text(this.remote ? 'Unsplash · remote image' : 'Photo by Mae Mu · Unsplash', {
        fontSize: 11,
        color: colors.onSurfaceVariant,
      }),
      ...(this.error
        ? [
            new Text('Could not load image colors. ' + this.error, {
              fontSize: 12,
              color: colors.error,
            }),
          ]
        : []),
      ...this.palettes.map((palette, index) =>
        column(
          new Text(index === 0 ? 'Light palette' : 'Dark palette', { fontSize: 13 }),
          flow(
            ...(['primary', 'secondary', 'tertiary'] as const).map((role) => {
              const foreground =
                role === 'primary'
                  ? palette.onPrimary
                  : role === 'secondary'
                    ? palette.onSecondary
                    : palette.onTertiary;
              return new SizedBox(
                110,
                undefined,
                new DecoratedBox(
                  inset(
                    10,
                    column(
                      new Text(role, { fontSize: 12, color: foreground }),
                      new Text(
                        '#' +
                          (palette[role] & 0xffffff).toString(16).padStart(6, '0').toUpperCase(),
                        { fontSize: 11, color: foreground },
                      ),
                    ),
                  ),
                  palette[role],
                  8,
                ),
              );
            }),
          ),
        ),
      ),
    );
  }
}
