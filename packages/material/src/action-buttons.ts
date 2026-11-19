// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/action_buttons.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { Builder } from '@nelyx/core/framework/widgets/basic';
import { StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { Icon } from '@nelyx/core/framework/widgets/icon';
import { Navigator } from '@nelyx/core/framework/widgets/navigation';
import type { Color } from '@nelyx/core/ui/color';
import { ActionIconTheme } from './action-icon-theme.ts';
import type { ButtonStyle } from './button-style.ts';
import { debugCheckHasMaterialLocalizations } from './debug.ts';
import { IconButton } from './icon-button.ts';
import { Icons } from './icons.ts';
import { MaterialLocalizations } from './material-localizations.ts';
import { Scaffold } from './scaffold.ts';
import { Theme } from './theme.ts';

type ActionKind = 'back' | 'close' | 'drawer' | 'endDrawer';
const labels = {
  back: 'backButtonTooltip',
  close: 'closeButtonTooltip',
  drawer: 'openAppDrawerTooltip',
  endDrawer: 'openAppDrawerTooltip',
} as const;
const builders = {
  back: 'backButtonIconBuilder',
  close: 'closeButtonIconBuilder',
  drawer: 'drawerButtonIconBuilder',
  endDrawer: 'endDrawerButtonIconBuilder',
} as const;

abstract class ActionIcon extends StatelessWidget {
  protected constructor(
    private readonly kind: ActionKind,
    { key = null }: WidgetOptions,
  ) {
    super(key);
  }

  override build(context: BuildContext): Widget {
    const builder = ActionIconTheme.of(context)?.[builders[this.kind]];
    if (builder) return builder(context);
    const platform = Theme.of(context).platform;
    const apple = !FoundationPlatform.isWeb && (platform === 'iOS' || platform === 'macOS');
    const icon =
      this.kind === 'back'
        ? apple
          ? Icons.arrow_back_ios_new_rounded
          : Icons.arrow_back
        : this.kind === 'close'
          ? Icons.close
          : Icons.menu;
    return new Icon(icon, {
      semanticLabel:
        FoundationPlatform.defaultTargetPlatform === 'android'
          ? MaterialLocalizations.of(context)[labels[this.kind]]
          : null,
    });
  }
}

export class BackButtonIcon extends ActionIcon {
  constructor(options: WidgetOptions = {}) {
    super('back', options);
  }
}
export class CloseButtonIcon extends ActionIcon {
  constructor(options: WidgetOptions = {}) {
    super('close', options);
  }
}
export class DrawerButtonIcon extends ActionIcon {
  constructor(options: WidgetOptions = {}) {
    super('drawer', options);
  }
}
export class EndDrawerButtonIcon extends ActionIcon {
  constructor(options: WidgetOptions = {}) {
    super('endDrawer', options);
  }
}

export interface ActionButtonOptions extends WidgetOptions {
  readonly color?: Color | null;
  readonly style?: ButtonStyle | null;
  readonly onPressed?: (() => void) | null;
}

abstract class ActionButton extends IconButton {
  protected constructor(
    private readonly kind: ActionKind,
    icon: Widget,
    { key = null, color = null, style = null, onPressed = null }: ActionButtonOptions,
  ) {
    super({ key, color, style, onPressed, icon });
  }

  override build(): Widget {
    return new Builder((context) => {
      debugCheckHasMaterialLocalizations(context);
      return new IconButton({
        icon: this.icon,
        color: this.color,
        style: this.style,
        tooltip: MaterialLocalizations.of(context)[labels[this.kind]],
        onPressed:
          this.onPressed ??
          (() => {
            if (this.kind === 'drawer') Scaffold.of(context).openDrawer();
            else if (this.kind === 'endDrawer') Scaffold.of(context).openEndDrawer();
            else void Navigator.of(context).maybePop();
          }),
      });
    });
  }
}

export class BackButton extends ActionButton {
  constructor(options: ActionButtonOptions = {}) {
    super('back', new BackButtonIcon(), options);
  }
}
export class CloseButton extends ActionButton {
  constructor(options: ActionButtonOptions = {}) {
    super('close', new CloseButtonIcon(), options);
  }
}
export class DrawerButton extends ActionButton {
  constructor(options: ActionButtonOptions = {}) {
    super('drawer', new DrawerButtonIcon(), options);
  }
}
export class EndDrawerButton extends ActionButton {
  constructor(options: ActionButtonOptions = {}) {
    super('endDrawer', new EndDrawerButtonIcon(), options);
  }
}
