// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { allInsets } from '@nelyx/core/ui/geometry';
import type { Size } from '@nelyx/core/ui/geometry';
import { EdgeInsets, EdgeInsetsDirectional } from '@nelyx/core/framework/painting/edge-insets';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { Widget, BuildContext, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import {
  Center,
  ColoredBox,
  Column,
  Expanded,
  DecoratedBox,
  Padding,
  Row,
  Text,
  SizedBox,
} from '@nelyx/core/framework/widgets/basic';
import { AppTheme, Directionality } from '@nelyx/core/framework/widgets/app-data';
import { BackdropFilter } from '@nelyx/core/framework/widgets/backdrop-filter';
import { ClipRect } from '@nelyx/core/framework/widgets/clip';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import { Icon } from '@nelyx/core/framework/widgets/icon';
import { Navigator, routeTokenOf } from '@nelyx/core/framework/widgets/navigation';
import { NavigationToolbar } from '@nelyx/core/framework/widgets/navigation-toolbar';
import { PageRoute } from '@nelyx/core/framework/widgets/pages';
import type { PreferredSizeWidget } from '@nelyx/core/framework/widgets/preferred-size';
import { SafeArea } from '@nelyx/core/framework/widgets/safe-area';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { Color } from '@nelyx/core/ui/color';
import { ImageFilter } from '@nelyx/core/ui/image-filter';
import { CupertinoButton } from './button.ts';
import { CupertinoLocalizations } from './cupertino-localizations.ts';
import { CupertinoIcons } from './icons.ts';
import { resolveCupertinoColor } from './internal/colors/color-values.ts';
import type { CupertinoColor } from './internal/colors/color-values.ts';
import type { ObstructingPreferredSizeWidget } from './page-scaffold.ts';
import { CupertinoRouteTransitionMixin } from './route.ts';
import { CupertinoTheme } from './theme.ts';

const toolbarHeight = 44;
const blur = ImageFilter.blur({ sigmaX: 10, sigmaY: 10 });

export interface CupertinoNavigationBarOptions extends WidgetOptions {
  readonly leading?: Widget | null;
  readonly middle?: Widget | null;
  readonly trailing?: Widget | null;
  readonly automaticallyImplyLeading?: boolean;
  readonly automaticallyImplyMiddle?: boolean;
  readonly previousPageTitle?: string | null;
  readonly backgroundColor?: CupertinoColor | null;
  readonly enableBackgroundFilterBlur?: boolean;
  readonly padding?: EdgeInsetsGeometry | null;
  readonly bottom?: PreferredSizeWidget | null;
}

export class CupertinoNavigationBar
  extends StatelessWidget
  implements ObstructingPreferredSizeWidget
{
  readonly title: string;
  readonly onBack: (() => void) | undefined;
  readonly options: Readonly<CupertinoNavigationBarOptions> | null;
  readonly preferredSize: Size;

  constructor(options?: CupertinoNavigationBarOptions);
  constructor(title: string, onBack?: () => void);
  constructor(first: string | CupertinoNavigationBarOptions = {}, onBack?: () => void) {
    super(typeof first === 'string' ? null : (first.key ?? null));
    this.title = typeof first === 'string' ? first : '';
    this.onBack = onBack;
    this.options = typeof first === 'string' ? null : Object.freeze({ ...first });
    this.preferredSize = Object.freeze({
      width: 0,
      height: toolbarHeight + (this.options?.bottom?.preferredSize.height ?? 0),
    });
  }

  private background(context: BuildContext): Color {
    const color = this.options?.backgroundColor;
    return this.options === null
      ? new Color(AppTheme.of(context).surface)
      : color == null
        ? new Color(CupertinoTheme.of(context).barBackgroundColor)
        : resolveCupertinoColor(color, context);
  }

  shouldFullyObstruct(context: BuildContext): boolean {
    return this.background(context).alpha === 255;
  }

  private buildToolbar(context: BuildContext, options: CupertinoNavigationBarOptions): Widget {
    const typography = CupertinoTheme.of(context).textTheme;
    const navigation = Navigator.maybeOf(context);
    const token = routeTokenOf(context);
    const routes = navigation?.routes ?? [];
    const index = routes.findIndex((route) => route.token === token);
    const route = routes[index]?.route;
    const prior = routes[index - 1]?.route;
    const priorTitle =
      options.previousPageTitle ??
      (prior instanceof CupertinoRouteTransitionMixin ? prior.title : null);
    const routeTitle = route instanceof CupertinoRouteTransitionMixin ? route.title : null;
    let leading = options.leading;
    if (leading == null && navigation && index > 0 && (options.automaticallyImplyLeading ?? true)) {
      const modal = route instanceof PageRoute && route.fullscreenDialog;
      const direction = Directionality.of(context);
      const localization = CupertinoLocalizations.of(context);
      const buttonLabel = modal ? localization.cancelButtonLabel : localization.backButtonLabel;
      const displayedPrior = priorTitle && priorTitle.length > 12 ? buttonLabel : priorTitle;
      leading = new Center(
        new CupertinoButton({
          semanticsLabel: buttonLabel,
          padding: EdgeInsets.zero,
          onPressed: () => {
            void navigation.maybePop();
          },
          child: modal
            ? new Text(buttonLabel)
            : new Row(
                [
                  new Icon(direction === 'rtl' ? CupertinoIcons.forward : CupertinoIcons.back, {
                    size: 24,
                  }),
                  ...(displayedPrior
                    ? [new Text(displayedPrior, { maxLines: 1, softWrap: false })]
                    : []),
                ],
                { mainSize: 'min' },
              ),
        }),
        { widthFactor: 1 },
      );
    }
    const middle =
      options.middle ??
      ((options.automaticallyImplyMiddle ?? true) && routeTitle ? new Text(routeTitle) : null);
    const toolbar = new SizedBox(
      undefined,
      toolbarHeight,
      new Padding(
        options.padding ?? EdgeInsetsDirectional.fromSTEB(8, 0, 8, 0),
        new DefaultTextStyle(
          typography.navActionTextStyle,
          new NavigationToolbar({
            leading: leading ?? null,
            middle: middle
              ? new Semantics({
                  header: true,
                  child: new DefaultTextStyle(typography.navTitleTextStyle, middle, {
                    maxLines: 1,
                    overflow: 'ellipsis',
                    softWrap: false,
                  }),
                })
              : null,
            trailing: options.trailing ?? null,
            middleSpacing: 6,
          }),
        ),
      ),
    );
    const contents = options.bottom
      ? new Column([toolbar, options.bottom], { mainSize: 'min', crossAlign: 'stretch' })
      : toolbar;
    const background = this.background(context);
    const visible = new ColoredBox({
      color: background.toARGB32(),
      child: new SafeArea({ bottom: false, child: contents }),
    });
    return background.alpha < 255 && (options.enableBackgroundFilterBlur ?? true)
      ? new ClipRect(new BackdropFilter({ filter: blur, child: visible }))
      : visible;
  }

  override build(context: BuildContext): Widget {
    if (this.options) return this.buildToolbar(context, this.options);
    const theme = AppTheme.of(context);
    return new DecoratedBox(
      new Padding(
        allInsets(12),
        new Row(
          [
            ...(this.onBack
              ? [
                  new SizedBox(
                    80,
                    undefined,
                    new CupertinoButton('cupertino-back', 'Back', this.onBack),
                  ),
                ]
              : []),
            new Expanded(new Text(this.title, { fontSize: 22, color: theme.foreground })),
          ],
          { spacing: 12, crossAlign: 'center' },
        ),
      ),
      theme.surface,
    );
  }
}
