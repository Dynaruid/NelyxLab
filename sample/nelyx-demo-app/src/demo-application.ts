// SPDX-License-Identifier: BSD-3-Clause
import { State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { Widget } from '@nelyx/core/framework/widgets/framework';
import { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { Icon } from '@nelyx/core/framework/widgets/icon';
import { ListenableBuilder } from '@nelyx/core/framework/widgets/listenable-builder';
import { NavigatorController } from '@nelyx/core/framework/widgets/navigation';
import { SafeArea } from '@nelyx/core/framework/widgets/safe-area';
import { Color } from '@nelyx/core/ui/color';
import { BottomNavigationBarItem, CupertinoTabBar } from '@nelyx/cupertino/bottom-tab-bar';
import { CupertinoIcons } from '@nelyx/cupertino/icons';
import { CupertinoTabScaffold } from '@nelyx/cupertino/tab-scaffold';
import { MaterialApp } from '@nelyx/material/app';
import { Icons } from '@nelyx/material/icons';
import { Scaffold } from '@nelyx/material/scaffold';
import { ThemeData } from '@nelyx/material/theme-data';
import { ColorScheme } from '@nelyx/material/color-scheme';
import { ComponentsScreen } from './components.ts';
import { CupertinoComponentsScreen } from './cupertino-components.ts';
import { settingsScreen } from './settings-screen.ts';
import type { DemoRenderSettings, DemoWindowAcrylic } from './settings-screen.ts';
import { localizationMessages } from './localization-screen.ts';
import type { DemoLocale } from './localization-screen.ts';

const destinations = [
  new BottomNavigationBarItem({
    icon: new Icon(Icons.widgets_outlined),
    activeIcon: new Icon(Icons.widgets),
    label: 'Material',
  }),
  new BottomNavigationBarItem({
    icon: new Icon(CupertinoIcons.square_grid_2x2),
    activeIcon: new Icon(CupertinoIcons.square_grid_2x2_fill),
    label: 'Cupertino',
  }),
];
const settingsIndex = destinations.length;
const destinationsWithSettings = [
  ...destinations,
  new BottomNavigationBarItem({
    icon: new Icon(Icons.settings_outlined),
    activeIcon: new Icon(Icons.settings),
    label: 'Settings',
  }),
];

export class DemoApplication extends StatefulWidget {
  constructor(
    readonly initialText: string,
    readonly calendarPreparation = false,
    readonly renderSettings?: DemoRenderSettings,
    readonly windowAcrylic?: DemoWindowAcrylic,
  ) {
    super();
  }
  createState(): State<DemoApplication> {
    return new DemoApplicationState();
  }
}
class DemoApplicationState extends State<DemoApplication> {
  private dark = false;
  private locale: DemoLocale | 'en' = 'en';
  private readonly changeLocale = (locale: DemoLocale): void => {
    this.setState(() => {
      this.locale = locale;
    });
  };
  private readonly navigator = new NavigatorController();
  private acrylicFocus: FocusNode | null = null;
  private readonly themes = new Map<boolean, ThemeData>();
  private readonly toggleBrightness = (): void => {
    this.setState(() => {
      this.dark = !this.dark;
    });
  };

  override dispose(): void {
    this.acrylicFocus?.dispose();
    this.navigator.dispose();
    super.dispose();
  }
  build(): Widget {
    const acrylic = this.widget.windowAcrylic;
    return acrylic
      ? new ListenableBuilder(acrylic.state, () =>
          this.buildApplication(acrylic.state.value.enabled),
        )
      : this.buildApplication(false);
  }
  private buildApplication(acrylic: boolean): Widget {
    let theme = this.themes.get(this.dark);
    if (!theme) {
      theme = new ThemeData({
        fontFamily: 'NelyxSample',
        fontFamilyFallback: ['NelyxEmoji'],
        colorScheme: ColorScheme.fromSeed({
          seedColor: 0xff6750a4,
          brightness: this.dark ? 'dark' : 'light',
        }),
      });
      this.themes.set(this.dark, theme);
    }
    const material = new Scaffold({
      backgroundColor: acrylic ? new Color(0) : null,
      body: new SafeArea({
        bottom: false,
        child: new ComponentsScreen(
          this.navigator,
          this.widget.initialText,
          this.dark,
          this.toggleBrightness,
          this.widget.calendarPreparation,
          this.changeLocale,
        ),
      }),
    });
    const cupertino = new CupertinoComponentsScreen(
      this.widget.initialText,
      this.dark,
      this.toggleBrightness,
      acrylic,
    );
    const colors = theme.colorScheme;
    const surface = new Color(colors.surface);
    const settings = this.widget.renderSettings;
    return new MaterialApp({
      theme,
      ...(this.locale === undefined ? {} : { locale: this.locale }),
      supportedLocales: ['en', 'en-US', 'ko-KR'],
      messages: localizationMessages,
      navigatorController: this.navigator,
      home: new CupertinoTabScaffold({
        backgroundColor: acrylic ? surface.withAlpha(0xb8) : surface,
        tabBar: new CupertinoTabBar({
          items: settings ? destinationsWithSettings : destinations,
          currentIndex: settings?.showOnStartup ? settingsIndex : 0,
          backgroundColor: new Color(colors.surfaceContainer),
          activeColor: new Color(colors.primary),
          inactiveColor: new Color(colors.onSurfaceVariant),
          iconSize: 24,
        }),
        tabBuilder: (_, index) => {
          if (index === settingsIndex && settings) {
            const backdrop = this.widget.windowAcrylic;
            if (backdrop) this.acrylicFocus ??= new FocusNode({ debugLabel: 'Acrylic window' });
            return settingsScreen(settings, backdrop, this.acrylicFocus);
          }
          return index === 0 ? material : cupertino;
        },
      }),
    });
  }
}
