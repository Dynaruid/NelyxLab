// SPDX-License-Identifier: BSD-3-Clause
import type { ApplicationDefinition } from '@nelyx/core/hosting/runtime';
import { widgetApplication } from '@nelyx/core/framework/widgets/root';
import { State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { Widget } from '@nelyx/core/framework/widgets/framework';
import { NavigatorController } from '@nelyx/core/framework/widgets/navigation';
import { MaterialApp } from '@nelyx/material/app';
import { ThemeData } from '@nelyx/material/theme-data';
import { ColorScheme } from '@nelyx/material/color-scheme';
import { ComponentsScreen } from './components.ts';

export interface ApplicationState {
  readonly initialText: string;
}
export interface ApplicationOptions {
  readonly accessibilityEnabled?: boolean;
}
export function createApplicationState(): ApplicationState {
  return { initialText: '안녕하세요, Nelyx!' };
}
export function defineApplication(
  state: ApplicationState,
  options: ApplicationOptions = {},
): ApplicationDefinition {
  return widgetApplication({
    id: 'nelyx.demo',
    defaultFont: 'sample-font',
    accessibilityEnabled: options.accessibilityEnabled ?? true,
    semanticsUpdateInterval: 300,
    createRoot: () => new DemoApplication(state.initialText),
  });
}

class DemoApplication extends StatefulWidget {
  constructor(readonly initialText: string) {
    super();
  }
  createState(): State<DemoApplication> {
    return new DemoApplicationState();
  }
}
class DemoApplicationState extends State<DemoApplication> {
  private dark = false;
  private readonly navigator = new NavigatorController();
  private readonly themes = new Map<boolean, ThemeData>();

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
    return new MaterialApp({
      theme,
      locale: 'en',
      supportedLocales: ['en', 'ko-KR'],
      navigatorController: this.navigator,
      home: new ComponentsScreen(this.navigator, this.widget.initialText, this.dark, () =>
        this.setState(() => {
          this.dark = !this.dark;
        }),
      ),
    });
  }
}
