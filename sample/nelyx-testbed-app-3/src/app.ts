// SPDX-License-Identifier: BSD-3-Clause
// Adapted from DorotiTestbedApp and the Flutter Material 3 sample. See LICENSE.flutter.
import { AssetImage } from '@nelyx/core/framework/painting/image-provider';
import { Axis } from '@nelyx/core/framework/painting/basic-types';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import {
  Builder,
  ClipRect,
  Column,
  Expanded,
  Padding,
  Row,
  SizedBox,
  Text,
} from '@nelyx/core/framework/widgets/basic';
import { State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import { Icon } from '@nelyx/core/framework/widgets/icon';
import { Image } from '@nelyx/core/framework/widgets/image';
import { LayoutBuilder } from '@nelyx/core/framework/widgets/layout-builder';
import { ScrollController } from '@nelyx/core/framework/widgets/scroll-controller';
import { SingleBoxScrollView } from '@nelyx/core/framework/widgets/scroll-view';
import { tickerScheduler } from '@nelyx/core/internal/framework/widgets/ticker-scheduler';
import { Wrap } from '@nelyx/core/framework/widgets/wrap';
import { Color } from '@nelyx/core/ui/color';
import * as M from '@nelyx/material/widgets';
import type { WindowAcrylic } from '@nelyx/sdk/frontend/dom/environment';
import { ComponentsScreen } from './components.ts';
import { HostSlot, type HostPage, type HostPlacement } from './host-slot.ts';
import { imageScheme, sampleImage, themeImages, themeImageAsset } from './image-palette.ts';
import { ColorScreen, ElevationScreen, TypographyScreen } from './theme-screens.ts';
import { PlatformViewsScreen } from './platform-views.ts';

const seeds = [
  ['M3 Baseline', 0xff6750a4],
  ['Indigo', 0xff3f51b5],
  ['Blue', 0xff2196f3],
  ['Teal', 0xff009688],
  ['Green', 0xff4caf50],
  ['Yellow', 0xffffeb3b],
  ['Orange', 0xffff9800],
  ['Deep Orange', 0xffff5722],
  ['Pink', 0xffe91e63],
] as const;
const { Icons } = M;
const destinations = [
  { label: 'Components', icon: Icons.widgets_outlined, selected: Icons.widgets },
  { label: 'Color', icon: Icons.format_paint_outlined, selected: Icons.format_paint },
  { label: 'Typography', icon: Icons.text_snippet_outlined, selected: Icons.text_snippet },
  { label: 'Elevation', icon: Icons.invert_colors_on_outlined, selected: Icons.opacity },
  {
    label: 'Platform views',
    icon: Icons.web_asset_outlined,
    selected: Icons.web_asset,
    page: 'platform',
  },
  { label: 'WebView', icon: Icons.language, selected: Icons.language, page: 'webview' },
  { label: 'Texture', icon: Icons.image_outlined, selected: Icons.image, page: 'texture' },
  { label: 'Composited views', icon: Icons.layers_outlined, selected: Icons.layers },
] as const;
const barDestinations = destinations.map(
  ({ label, icon, selected }) =>
    new M.NavigationDestination({ label, icon: new Icon(icon), selectedIcon: new Icon(selected) }),
);
const railDestinations = destinations.map(
  ({ label, icon, selected }) =>
    new M.NavigationRailDestination({
      label: new Text(label),
      icon: new Icon(icon),
      selectedIcon: new Icon(selected),
    }),
);
const navigationItemWidth = 96;
type NavigationLayout = 'scrollingBar' | 'bar' | 'rail' | 'extendedRail';
const localThemeIndex = themeImages.length;

function themes(seed: number, light = M.ColorScheme.fromSeed({ seedColor: seed })) {
  const dark = M.ColorScheme.fromSeed({ seedColor: seed, brightness: 'dark' });
  return {
    light: new M.ThemeData({ colorScheme: light, fontFamily: 'Roboto' }),
    dark: new M.ThemeData({ colorScheme: dark, fontFamily: 'Roboto' }),
  };
}

export class Testbed extends StatefulWidget {
  constructor(
    readonly showHost: (placement: HostPlacement | null) => void,
    readonly acrylic: WindowAcrylic | undefined,
    readonly setTransparent: (enabled: boolean) => void,
  ) {
    super();
  }
  override createState() {
    return new TestbedState();
  }
}

class TestbedState extends State<Testbed> {
  private mode: M.ThemeMode = M.ThemeMode.system;
  private seed = 0;
  private image: number | null = null;
  private pendingImage: number | null = null;
  private palette = themes(seeds[0][1]);
  private revision = 0;
  private acrylicPending = false;

  private async toggleAcrylic(context: BuildContext) {
    const acrylic = this.widget.acrylic;
    if (!acrylic || this.acrylicPending) return;
    this.setState(() => {
      this.acrylicPending = true;
    });
    try {
      await acrylic.setEnabled(!acrylic.enabled);
      if (this.mounted) this.widget.setTransparent(acrylic.enabled);
    } catch {
      if (context.mounted)
        M.ScaffoldMessenger.of(context).showSnackBar(
          new M.SnackBar({
            content: new Text('Could not change the window backdrop'),
          }),
        );
    } finally {
      if (this.mounted)
        this.setState(() => {
          this.acrylicPending = false;
        });
    }
  }

  private selectSeed(index: number) {
    this.revision++;
    this.setState(() => {
      this.seed = index;
      this.image = this.pendingImage = null;
      this.palette = themes(seeds[index]![1]);
    });
  }

  private async selectImage(context: BuildContext, index: number) {
    const revision = ++this.revision;
    this.setState(() => {
      this.pendingImage = index;
    });
    const provider = new AssetImage(
      index === localThemeIndex ? sampleImage : themeImageAsset(index),
    );
    try {
      const light = await imageScheme(context, provider);
      if (!this.mounted || this.revision !== revision) return;
      this.setState(() => {
        this.image = index;
        this.pendingImage = null;
        this.palette = themes(light.primary, light);
      });
    } catch {
      if (!this.mounted || this.revision !== revision) return;
      this.setState(() => {
        this.pendingImage = null;
      });
      if (context.mounted)
        M.ScaffoldMessenger.of(context).showSnackBar(
          new M.SnackBar({
            content: new Text(`Could not load ${themeImages[index] ?? 'the sample image'}.`),
          }),
        );
    }
  }

  override build(): Widget {
    return new M.MaterialApp({
      title: 'Nelyx Testbed 3',
      debugShowCheckedModeBanner: false,
      locale: 'en-US',
      supportedLocales: ['en-US'],
      theme: this.palette.light,
      darkTheme: this.palette.dark,
      themeMode: this.mode,
      home: new Home({
        showHost: this.widget.showHost,
        seed: this.seed,
        image: this.image,
        loading: this.pendingImage !== null,
        light: this.palette.light.colorScheme,
        dark: this.palette.dark.colorScheme,
        acrylic: this.widget.acrylic?.enabled ?? false,
        showAcrylic: this.widget.acrylic !== undefined,
        toggleAcrylic: this.acrylicPending
          ? null
          : (context) => {
              void this.toggleAcrylic(context);
            },
        toggleBrightness: (dark) =>
          this.setState(() => {
            this.mode = dark ? M.ThemeMode.light : M.ThemeMode.dark;
          }),
        selectSeed: (index) => this.selectSeed(index),
        selectImage: (context, index) => {
          void this.selectImage(context, index);
        },
      }),
    });
  }
}

interface HomeOptions {
  readonly showHost: Testbed['showHost'];
  readonly seed: number;
  readonly image: number | null;
  readonly loading: boolean;
  readonly light: M.ColorScheme;
  readonly dark: M.ColorScheme;
  readonly acrylic: boolean;
  readonly showAcrylic: boolean;
  readonly toggleAcrylic: ((context: BuildContext) => void) | null;
  readonly toggleBrightness: (dark: boolean) => void;
  readonly selectSeed: (index: number) => void;
  readonly selectImage: (context: BuildContext, index: number) => void;
}

class Home extends StatefulWidget {
  constructor(readonly options: HomeOptions) {
    super();
  }
  override createState() {
    return new HomeState();
  }
}

class HomeState extends State<Home> {
  private selected = 0;
  private popupOpen = false;
  private readonly bottomScroll = new ScrollController({ debugLabel: 'Testbed 3 destinations' });
  private narrow: boolean | undefined;

  override dispose(): void {
    this.bottomScroll.dispose();
    super.dispose();
  }

  private readonly select = (selected: number) => {
    if (this.selected === selected) return;
    this.setState(() => {
      this.selected = selected;
    });
    if (this.narrow) this.revealDestination();
  };

  private revealDestination() {
    tickerScheduler(this.context).addPostFrameCallback(() => {
      if (!this.mounted || !this.bottomScroll.hasClients) return;
      const position = this.bottomScroll.position;
      if (!position.hasContentDimensions) return;
      const { minScrollExtent, maxScrollExtent, viewportDimension } = position;
      const offset = (this.selected + 0.5) * navigationItemWidth - viewportDimension / 2;
      const target = Math.max(minScrollExtent, Math.min(maxScrollExtent, offset));
      if (target !== this.bottomScroll.offset) this.bottomScroll.jumpTo(target);
    });
  }

  private setPopup(open: boolean) {
    if (this.mounted && this.popupOpen !== open)
      this.setState(() => {
        this.popupOpen = open;
      });
  }

  private actions(context: BuildContext): Widget[] {
    const {
      seed,
      image,
      acrylic,
      showAcrylic,
      toggleAcrylic,
      toggleBrightness,
      selectSeed,
      selectImage,
    } = this.widget.options;
    const isDark = M.Theme.of(context).brightness === 'dark';
    const acrylicLabel = acrylic ? 'Turn off Acrylic window' : 'Turn on Acrylic window';
    return [
      new M.IconButton({
        tooltip: 'Toggle brightness',
        icon: new Icon(isDark ? Icons.light_mode_outlined : Icons.dark_mode_outlined, {
          semanticLabel: 'Toggle brightness',
        }),
        onPressed: () => toggleBrightness(isDark),
      }),
      ...(showAcrylic
        ? [
            new M.IconButton({
              tooltip: acrylicLabel,
              icon: new Icon(acrylic ? Icons.blur_on : Icons.blur_off, {
                semanticLabel: acrylicLabel,
              }),
              onPressed: toggleAcrylic ? () => toggleAcrylic(context) : null,
            }),
          ]
        : []),
      new M.PopupMenuButton<number>({
        tooltip: 'Select a seed color',
        icon: new Icon(Icons.palette_outlined, { semanticLabel: 'Select a seed color' }),
        initialValue: image === null ? seed : null,
        onOpened: () => this.setPopup(true),
        onCanceled: () => this.setPopup(false),
        onSelected: (index) => {
          this.setPopup(false);
          selectSeed(index);
        },
        itemBuilder: () =>
          seeds.map(
            ([label, color], index) =>
              new M.PopupMenuItem({
                value: index,
                child: new Row(
                  [
                    new Icon(
                      image === null && seed === index
                        ? Icons.color_lens
                        : Icons.color_lens_outlined,
                      { color: new Color(color) },
                    ),
                    new Text(label),
                  ],
                  { mainSize: 'min', spacing: 12 },
                ),
              }),
          ),
      }),
      new M.PopupMenuButton<number>({
        tooltip: 'Select an image color',
        icon: new Icon(Icons.image_outlined, { semanticLabel: 'Select an image color' }),
        initialValue: image,
        onOpened: () => this.setPopup(true),
        onCanceled: () => this.setPopup(false),
        onSelected: (index) => {
          this.setPopup(false);
          selectImage(context, index);
        },
        itemBuilder: () =>
          [...themeImages, 'Sample image'].map(
            (label, index) =>
              new M.PopupMenuItem({
                value: index,
                child: new Row(
                  [
                    Image.asset(index === localThemeIndex ? sampleImage : themeImageAsset(index), {
                      width: 38,
                      height: 34,
                      fit: 'cover',
                      excludeFromSemantics: true,
                    }),
                    new Text(label),
                  ],
                  { mainSize: 'min', spacing: 12 },
                ),
              }),
          ),
      }),
    ];
  }

  private settings(context: BuildContext): Widget {
    const {
      seed,
      image,
      acrylic,
      showAcrylic,
      toggleAcrylic,
      toggleBrightness,
      selectSeed,
      selectImage,
    } = this.widget.options;
    const isDark = M.Theme.of(context).brightness === 'dark';
    return new SizedBox(
      168,
      undefined,
      new Column(
        [
          new Row([
            new Expanded(new Text('Brightness')),
            new M.Switch({ value: isDark, onChanged: () => toggleBrightness(isDark) }),
          ]),
          ...(showAcrylic
            ? [
                new Row([
                  new Expanded(new Text('Acrylic window')),
                  new M.Switch({
                    value: acrylic,
                    onChanged: toggleAcrylic ? () => toggleAcrylic(context) : null,
                  }),
                ]),
              ]
            : []),
          new M.Divider(),
          new Wrap(
            seeds.map(
              ([label, color], index) =>
                new M.IconButton({
                  tooltip: label,
                  icon: new Icon(
                    image === null && seed === index ? Icons.circle : Icons.radio_button_unchecked,
                    { color: new Color(color), semanticLabel: label },
                  ),
                  onPressed: () => selectSeed(index),
                }),
            ),
            { alignment: 'center' },
          ),
          new M.Divider(),
          new Wrap(
            [...themeImages, 'Sample image'].map(
              (label, index) =>
                new M.IconButton({
                  tooltip: label,
                  icon:
                    index === localThemeIndex
                      ? new Icon(Icons.photo_outlined, { semanticLabel: label })
                      : Image.asset(themeImageAsset(index), {
                          width: 28,
                          height: 28,
                          fit: 'cover',
                          semanticLabel: label,
                          errorBuilder: () =>
                            new Icon(Icons.image_not_supported_outlined, { semanticLabel: label }),
                        }),
                  isSelected: image === index,
                  onPressed: () => selectImage(context, index),
                }),
            ),
            { alignment: 'center' },
          ),
        ],
        { mainSize: 'min', crossAlign: 'stretch' },
      ),
    );
  }

  private body(wide: boolean, host: HostPage | null): Widget {
    if (host !== null) return new HostSlot(host, this.widget.options.showHost, !this.popupOpen);
    switch (this.selected) {
      case 0:
        return new ComponentsScreen(wide);
      case 1:
        return new ColorScreen(this.widget.options.light, this.widget.options.dark);
      case 2:
        return new TypographyScreen();
      case 3:
        return new ElevationScreen();
      default:
        return new PlatformViewsScreen();
    }
  }

  private bottomNavigation(scrollable: boolean): Widget {
    const bar = new M.NavigationBar({
      destinations: barDestinations,
      selectedIndex: this.selected,
      onDestinationSelected: this.select,
      ...(this.widget.options.acrylic
        ? { backgroundColor: new Color(0), surfaceTintColor: new Color(0) }
        : {}),
    });
    if (!scrollable) return new ClipRect(bar);
    return new SizedBox(
      undefined,
      80,
      new M.Scrollbar({
        controller: this.bottomScroll,
        thumbVisibility: true,
        thickness: 4,
        child: new SingleBoxScrollView({
          scrollDirection: Axis.horizontal,
          controller: this.bottomScroll,
          primary: false,
          child: new SizedBox(destinations.length * navigationItemWidth, 80, bar),
        }),
      }),
    );
  }

  override build(): Widget {
    let previous:
      | { layout: NavigationLayout; trailingAtBottom: boolean; child: Widget }
      | undefined;
    return new LayoutBuilder((_, { maxWidth, maxHeight }) => {
      const narrow = maxWidth < destinations.length * navigationItemWidth;
      if (this.narrow !== narrow) {
        this.narrow = narrow;
        if (narrow) this.revealDestination();
      }
      const layout =
        maxWidth > 1500
          ? 'extendedRail'
          : maxWidth > 1000
            ? 'rail'
            : narrow
              ? 'scrollingBar'
              : 'bar';
      const trailingAtBottom =
        (layout === 'rail' && maxHeight > 675) || (layout === 'extendedRail' && maxHeight > 850);
      if (
        !previous ||
        previous.layout !== layout ||
        previous.trailingAtBottom !== trailingAtBottom
      ) {
        // The render objects still receive every new extent. The Builder owns theme dependencies.
        const child = new Builder((context) => this.scaffold(context, layout, trailingAtBottom));
        previous = { layout, trailingAtBottom, child };
      }
      return previous.child;
    });
  }

  private scaffold(
    context: BuildContext,
    layout: NavigationLayout,
    trailingAtBottom: boolean,
  ): Widget {
    const extended = layout === 'extendedRail';
    const wide = layout === 'rail' || extended;
    const destination = destinations[this.selected]!;
    const host = 'page' in destination ? destination.page : null;
    const { acrylic, loading } = this.widget.options;
    const background = acrylic
      ? new Color(M.Theme.of(context).colorScheme.surface).withAlpha(96)
      : null;
    const content = this.body(wide, host);
    return new M.Scaffold({
      backgroundColor: background,
      appBar: new M.AppBar({
        title: new Text('Nelyx Material 3', { maxLines: 1, overflow: 'ellipsis' }),
        actions: wide ? [] : this.actions(context),
        ...(acrylic
          ? {
              backgroundColor: new Color(0),
              surfaceTintColor: new Color(0),
              scrolledUnderElevation: 0,
            }
          : {}),
      }),
      endDrawer:
        host === null
          ? new Builder(
              (drawerContext) =>
                new M.NavigationDrawer({
                  selectedIndex: this.selected,
                  onDestinationSelected: (index) => {
                    M.Scaffold.of(drawerContext).closeEndDrawer();
                    this.select(index);
                  },
                  children: [
                    new Padding(
                      EdgeInsets.all(24),
                      new Text('Nelyx Material 3', {
                        style: M.Theme.of(drawerContext).textTheme.titleLarge ?? undefined,
                      }),
                    ),
                    ...destinations.map(
                      ({ label, icon, selected }) =>
                        new M.NavigationDrawerDestination({
                          label: new Text(label),
                          icon: new Icon(icon),
                          selectedIcon: new Icon(selected),
                        }),
                    ),
                  ],
                }),
            )
          : null,
      body: new Column(
        [
          ...(loading
            ? [new M.LinearProgressIndicator({ semanticsLabel: 'Loading image colors' })]
            : []),
          new Expanded(
            new Row(
              [
                wide
                  ? new M.NavigationRail({
                      destinations: railDestinations,
                      selectedIndex: this.selected,
                      onDestinationSelected: this.select,
                      extended,
                      scrollable: true,
                      backgroundColor: acrylic ? new Color(0) : null,
                      trailingAtBottom,
                      trailing: new Padding(
                        EdgeInsets.all(8),
                        extended
                          ? this.settings(context)
                          : new Column(this.actions(context), { mainSize: 'min' }),
                      ),
                    })
                  : SizedBox.shrink(),
                new Expanded(content),
              ],
              { crossAlign: 'stretch' },
            ),
          ),
        ],
        { crossAlign: 'stretch' },
      ),
      bottomNavigationBar: wide ? null : this.bottomNavigation(layout === 'scrollingBar'),
    });
  }
}
