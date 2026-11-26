// SPDX-License-Identifier: BSD-3-Clause
// Adapted from DorotiTestbedApp and the Flutter Material 3 sample. See LICENSE.flutter.
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { Alignment } from '@nelyx/core/framework/painting/alignment';
import {
  Align,
  Column,
  Expanded,
  Padding,
  Row,
  SizedBox,
  Text,
} from '@nelyx/core/framework/widgets/basic';
import {
  StatelessWidget,
  type BuildContext,
  type Widget,
} from '@nelyx/core/framework/widgets/framework';
import { Icon } from '@nelyx/core/framework/widgets/icon';
import { LayoutBuilder } from '@nelyx/core/framework/widgets/layout-builder';
import { ListView } from '@nelyx/core/framework/widgets/scroll-view';
import { Wrap } from '@nelyx/core/framework/widgets/wrap';
import { Clipboard, ClipboardData } from '@nelyx/core/services/clipboard';
import { Color } from '@nelyx/core/ui/color';
import * as M from '@nelyx/material/widgets';

const typography = [
  ['Display Large', 'displayLarge'],
  ['Display Medium', 'displayMedium'],
  ['Display Small', 'displaySmall'],
  ['Headline Large', 'headlineLarge'],
  ['Headline Medium', 'headlineMedium'],
  ['Headline Small', 'headlineSmall'],
  ['Title Large', 'titleLarge'],
  ['Title Medium', 'titleMedium'],
  ['Title Small', 'titleSmall'],
  ['Label Large', 'labelLarge'],
  ['Label Medium', 'labelMedium'],
  ['Label Small', 'labelSmall'],
  ['Body Large', 'bodyLarge'],
  ['Body Medium', 'bodyMedium'],
  ['Body Small', 'bodySmall'],
] as const;

export class TypographyScreen extends StatelessWidget {
  override build(context: BuildContext): Widget {
    const { textTheme, colorScheme } = M.Theme.of(context);
    return new ListView({
      padding: EdgeInsets.all(8),
      children: typography.map(
        ([name, role]) =>
          new Padding(
            EdgeInsets.all(8),
            new Text(name, {
              style: textTheme[role]?.copyWith({ color: colorScheme.onSurface }),
            }),
          ),
      ),
    });
  }
}

const roleGroups = [
  [
    ['primary', 'onPrimary'],
    ['onPrimary', 'primary'],
    ['primaryContainer', 'onPrimaryContainer'],
    ['onPrimaryContainer', 'primaryContainer'],
  ],
  [
    ['secondary', 'onSecondary'],
    ['onSecondary', 'secondary'],
    ['secondaryContainer', 'onSecondaryContainer'],
    ['onSecondaryContainer', 'secondaryContainer'],
  ],
  [
    ['tertiary', 'onTertiary'],
    ['onTertiary', 'tertiary'],
    ['tertiaryContainer', 'onTertiaryContainer'],
    ['onTertiaryContainer', 'tertiaryContainer'],
  ],
  [
    ['error', 'onError'],
    ['onError', 'error'],
    ['errorContainer', 'onErrorContainer'],
    ['onErrorContainer', 'errorContainer'],
  ],
  [
    ['primaryFixed', 'onPrimaryFixed'],
    ['onPrimaryFixed', 'primaryFixed'],
    ['primaryFixedDim', 'onPrimaryFixedVariant'],
    ['onPrimaryFixedVariant', 'primaryFixedDim'],
  ],
  [
    ['secondaryFixed', 'onSecondaryFixed'],
    ['onSecondaryFixed', 'secondaryFixed'],
    ['secondaryFixedDim', 'onSecondaryFixedVariant'],
    ['onSecondaryFixedVariant', 'secondaryFixedDim'],
  ],
  [
    ['tertiaryFixed', 'onTertiaryFixed'],
    ['onTertiaryFixed', 'tertiaryFixed'],
    ['tertiaryFixedDim', 'onTertiaryFixedVariant'],
    ['onTertiaryFixedVariant', 'tertiaryFixedDim'],
  ],
  [
    ['surfaceDim', 'onSurface'],
    ['surface', 'onSurface'],
    ['surfaceBright', 'onSurface'],
  ],
  [
    ['surfaceContainerLowest', 'onSurface'],
    ['surfaceContainerLow', 'onSurface'],
    ['surfaceContainer', 'onSurface'],
    ['surfaceContainerHigh', 'onSurface'],
    ['surfaceContainerHighest', 'onSurface'],
  ],
  [
    ['onSurface', 'surface'],
    ['onSurfaceVariant', 'surfaceContainerHighest'],
    ['outline', null],
    ['outlineVariant', null],
    ['shadow', null],
    ['scrim', null],
  ],
  [
    ['inverseSurface', 'onInverseSurface'],
    ['onInverseSurface', 'inverseSurface'],
    ['inversePrimary', 'primary'],
  ],
] as const satisfies readonly (readonly (readonly [M.ColorRole, M.ColorRole | null])[])[];

function swatch(
  context: BuildContext,
  scheme: M.ColorScheme,
  role: M.ColorRole,
  on: M.ColorRole | null,
) {
  const fill = scheme[role];
  const foreground =
    on === null
      ? M.ThemeData.estimateBrightnessForColor(fill) === 'dark'
        ? 0xffffffff
        : 0xff000000
      : scheme[on];
  const hex = `#${(fill & 0xffffff).toString(16).padStart(6, '0')}`;
  const copy = async () => {
    let message = `Copied ${hex} to clipboard`;
    try {
      await Clipboard.setData(new ClipboardData(hex), context.services.binaryMessenger);
    } catch {
      message = `Could not copy ${hex}`;
    }
    if (!context.mounted) return;
    const messenger = M.ScaffoldMessenger.of(context);
    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(new M.SnackBar({ content: new Text(message) }));
  };
  return new M.Material({
    color: new Color(fill),
    child: new Padding(
      EdgeInsets.symmetric({ horizontal: 12, vertical: 4 }),
      new Row([
        new Expanded(
          new Text(role, {
            style: M.Theme.of(context).textTheme.labelMedium?.copyWith({ color: foreground }),
          }),
        ),
        new M.IconButton({
          tooltip: `Copy ${role} ${hex}`,
          color: new Color(foreground),
          icon: new Icon(M.Icons.copy, { size: 16, semanticLabel: `Copy ${role} ${hex}` }),
          onPressed: () => {
            void copy();
          },
        }),
      ]),
    ),
  });
}

export class ColorScreen extends StatelessWidget {
  constructor(
    readonly light: M.ColorScheme,
    readonly dark: M.ColorScheme,
  ) {
    super();
  }
  override build(): Widget {
    return new LayoutBuilder((context, constraints) => {
      const columns = constraints.maxWidth >= 920 ? 4 : constraints.maxWidth >= 500 ? 2 : 1;
      const gutter = 10;
      const width = (constraints.maxWidth - 2 * gutter - (columns - 1) * gutter) / columns;
      const children = [this.light, this.dark].flatMap((scheme) => [
        new Padding(
          EdgeInsets.symmetric({ vertical: 14 }),
          new Text(scheme.brightness === 'light' ? 'Light ColorScheme' : 'Dark ColorScheme', {
            style: M.Theme.of(context).textTheme.titleLarge ?? undefined,
          }),
        ),
        ...Array.from(
          { length: Math.ceil(roleGroups.length / columns) },
          (_, row) =>
            new Padding(
              EdgeInsets.only({ bottom: gutter }),
              new Row(
                roleGroups.slice(row * columns, (row + 1) * columns).map(
                  (group) =>
                    new SizedBox(
                      width,
                      undefined,
                      new M.Card({
                        elevation: 0,
                        margin: EdgeInsets.zero,
                        clipBehavior: 'antiAlias',
                        child: new Column(
                          group.map(([role, on]) => swatch(context, scheme, role, on)),
                          { mainSize: 'min', crossAlign: 'stretch' },
                        ),
                      }),
                    ),
                ),
                { spacing: gutter, crossAlign: 'start' },
              ),
            ),
        ),
      ]);
      return new ListView({ padding: EdgeInsets.all(gutter), children });
    });
  }
}

const elevations = [0, 1, 3, 6, 8, 12];
const overlays = [0, 5, 8, 11, 12, 14];
const elevationModes = [
  { title: 'Surface Tint Color Only', tint: true, shadow: false },
  { title: 'Surface Tint Color and Shadow Color', tint: true, shadow: true },
  { title: 'Shadow Color Only', tint: false, shadow: true },
];

export class ElevationScreen extends StatelessWidget {
  override build(): Widget {
    return new LayoutBuilder((context, constraints) => {
      const { colorScheme, textTheme } = M.Theme.of(context);
      const columns = constraints.maxWidth < 450 ? 3 : 6;
      const gutter = 16;
      const size = Math.floor(
        (constraints.maxWidth - 2 * gutter - (columns - 1) * gutter) / columns,
      );
      return new ListView({
        padding: EdgeInsets.all(gutter),
        children: elevationModes.flatMap(({ title, tint, shadow }) => [
          new Padding(
            EdgeInsets.symmetric({ vertical: 10 }),
            new Text(title, { style: textTheme.titleLarge ?? undefined }),
          ),
          new Padding(
            EdgeInsets.only({ bottom: 14 }),
            new Wrap(
              elevations.map(
                (elevation, index) =>
                  new SizedBox(
                    size,
                    Math.max(72, size),
                    new M.Material({
                      type: M.MaterialType.card,
                      borderRadius: BorderRadius.circular(4),
                      elevation,
                      color: new Color(colorScheme.surface),
                      shadowColor: new Color(shadow ? colorScheme.shadow : 0x00000000),
                      surfaceTintColor: new Color(tint ? colorScheme.primary : 0x00000000),
                      child: new Padding(
                        EdgeInsets.all(8),
                        new Column(
                          [
                            new Text(`Level ${index}`, {
                              style: textTheme.labelMedium ?? undefined,
                            }),
                            new Text(`${elevation} dp`, {
                              style: textTheme.labelMedium ?? undefined,
                            }),
                            ...(tint
                              ? [
                                  new Expanded(
                                    new Align(
                                      new Text(`${overlays[index]}%`, {
                                        style: textTheme.bodySmall ?? undefined,
                                      }),
                                      {
                                        alignment: Alignment.bottomRight,
                                      },
                                    ),
                                  ),
                                ]
                              : []),
                          ],
                          { crossAlign: 'stretch' },
                        ),
                      ),
                    }),
                  ),
              ),
              { spacing: gutter, runSpacing: gutter },
            ),
          ),
        ]),
      });
    });
  }
}
