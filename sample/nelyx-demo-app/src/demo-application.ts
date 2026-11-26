// SPDX-License-Identifier: BSD-3-Clause
import { State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { Widget } from '@nelyx/core/framework/widgets/framework';
import { Icon } from '@nelyx/core/framework/widgets/icon';
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
import type { DemoRenderSettings } from './settings-screen.ts';
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
  private readonly themes = new Map<boolean, ThemeData>();
  private readonly toggleBrightness = (): void => {
    this.setState(() => {
      this.dark = !this.dark;
    });
  };

  override dispose(): void {
    this.navigator.dispose();
    super.dispose();
  }
  build(): Widget {
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
    );
    const colors = theme.colorScheme;
    const settings = this.widget.renderSettings;
    return new MaterialApp({
      theme,
      ...(this.locale === undefined ? {} : { locale: this.locale }),
      supportedLocales: ['en', 'en-US', 'ko-KR'],
      messages: localizationMessages,
      navigatorController: this.navigator,
      home: new CupertinoTabScaffold({
        backgroundColor: new Color(colors.surface),
        tabBar: new CupertinoTabBar({
          items: settings ? destinationsWithSettings : destinations,
          currentIndex: settings?.showOnStartup ? settingsIndex : 0,
          backgroundColor: new Color(colors.surfaceContainer),
          activeColor: new Color(colors.primary),
          inactiveColor: new Color(colors.onSurfaceVariant),
          iconSize: 24,
        }),
        tabBuilder: (_, index) => {
          if (index === settingsIndex && settings) return settingsScreen(settings);
          return index === 0 ? material : cupertino;
        },
      }),
    });
  }
}
