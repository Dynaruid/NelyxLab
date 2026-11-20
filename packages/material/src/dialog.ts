// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/dialog.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { showCupertinoDialog } from '@nelyx/cupertino/route';
import { CupertinoAlertDialog } from '@nelyx/cupertino/dialog';
import type { CupertinoAlertDialogOptions } from '@nelyx/cupertino/dialog';
import { FoundationBuildMode } from '@nelyx/core/foundation/constants';
import { invariant } from '@nelyx/core/foundation/errors';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import type { Animation } from '@nelyx/core/framework/animation/animation';
import type { AnimationStyle } from '@nelyx/core/framework/animation/animation-style';
import { CurvedAnimation } from '@nelyx/core/framework/animation/animations';
import { Curves } from '@nelyx/core/framework/animation/curves';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import type { TextStyle } from '@nelyx/core/framework/painting/text-style';
import type { VerticalDirection } from '@nelyx/core/framework/painting/basic-types';
import type { MainAxisAlignment } from '@nelyx/core/framework/rendering/boxes';
import {
  AppTheme,
  Directionality,
  Localizations,
  MediaQuery,
  mediaFromView,
} from '@nelyx/core/framework/widgets/app-data';
import { allInsets } from '@nelyx/core/ui/geometry';
import type { Offset } from '@nelyx/core/ui/offset';
import { Color } from '@nelyx/core/ui/color';
import { SemanticsHitTestBehavior, SemanticsRole } from '@nelyx/core/ui/semantics';
import {
  Element,
  State,
  StatefulWidget,
  StatelessWidget,
} from '@nelyx/core/framework/widgets/framework';
import type { Widget, BuildContext, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import {
  Column,
  Padding,
  Text,
  DecoratedBox,
  Align,
  Builder,
  Flexible,
  IntrinsicWidth,
  SizedBox,
} from '@nelyx/core/framework/widgets/basic';
import { AppFocus } from '@nelyx/core/framework/widgets/app-focus';
import { Title } from '@nelyx/core/framework/widgets/app';
import { Focus } from '@nelyx/core/framework/widgets/focus-scope';
import { ScrollConfiguration } from '@nelyx/core/framework/widgets/scroll-configuration';
import { TapRegionSurface } from '@nelyx/core/framework/widgets/tap-region';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import { createDialogRoute } from '@nelyx/core/framework/widgets/dialog';
import type { DialogRouteOptions } from '@nelyx/core/framework/widgets/dialog';
import { DisplayFeatureSubScreen } from '@nelyx/core/framework/widgets/display-feature-sub-screen';
import { TraversalEdgeBehavior } from '@nelyx/core/framework/widgets/focus-traversal-policy';
import { IconTheme } from '@nelyx/core/framework/widgets/icon-theme';
import { IconThemeData } from '@nelyx/core/framework/widgets/icon-theme-data';
import { InheritedTheme } from '@nelyx/core/framework/widgets/inherited-theme';
import type { CapturedThemes } from '@nelyx/core/framework/widgets/inherited-theme';
import { Navigator, NavigatorController } from '@nelyx/core/framework/widgets/navigation';
import { ListBody } from '@nelyx/core/framework/widgets/list-body';
import { OverflowBar, OverflowBarAlignment } from '@nelyx/core/framework/widgets/overflow-bar';
import { PageRouteBuilder } from '@nelyx/core/framework/widgets/pages';
import type { RouteSettings } from '@nelyx/core/framework/widgets/pages';
import { SafeArea } from '@nelyx/core/framework/widgets/safe-area';
import { SingleBoxScrollView } from '@nelyx/core/framework/widgets/scroll-view';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { FadeTransition } from '@nelyx/core/framework/widgets/transitions';
import { widgetApplication } from '@nelyx/core/framework/widgets/root';
import { KeyDownEvent } from '@nelyx/core/services/hardware-keyboard';
import { LogicalKeyboardKey } from '@nelyx/core/services/keyboard-key';
import { Alignment } from '@nelyx/core/framework/painting/alignment';
import { RoundedRectangleBorder } from '@nelyx/core/framework/painting/rounded-rectangle-border';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { Colors } from './colors.ts';
import { DialogTheme } from './dialog-theme.ts';
import { Dialog } from './generated/date/dialog.generated.ts';
import { FilledButton } from './filled-button.ts';
import { InkWell } from './ink-well.ts';
import { MaterialLocalizations } from './material-localizations.ts';
import { Theme } from './theme.ts';

export { Dialog };

export interface SimpleDialogOptionOptions extends WidgetOptions {
  readonly child?: Widget | null;
  readonly onPressed?: (() => void) | null;
  readonly padding?: EdgeInsetsGeometry | null;
}

const simpleOptionPadding = EdgeInsets.symmetric({ vertical: 8, horizontal: 24 });

export class SimpleDialogOption extends StatelessWidget {
  readonly options: Readonly<SimpleDialogOptionOptions>;

  constructor(options: SimpleDialogOptionOptions = {}) {
    super(options.key ?? null);
    this.options = Object.freeze({ ...options });
  }
  override build(): Widget {
    const { child, onPressed, padding } = this.options;
    return new InkWell({
      onTap: onPressed ?? null,
      child: new Padding(padding ?? simpleOptionPadding, child ?? undefined),
    });
  }
}
type DialogSurfaceOptions = Omit<
  NonNullable<ConstructorParameters<typeof Dialog>[0]>,
  'child' | 'semanticsRole' | 'insetAnimationDuration' | 'insetAnimationCurve'
>;

interface DialogTextOptions extends DialogSurfaceOptions {
  readonly title?: Widget | null;
  readonly titlePadding?: EdgeInsetsGeometry | null;
  readonly titleTextStyle?: TextStyle | null;
  readonly contentTextStyle?: TextStyle | null;
  readonly contentPadding?: EdgeInsetsGeometry | null;
  readonly semanticLabel?: string | null;
}

export interface AlertDialogOptions extends DialogTextOptions {
  readonly icon?: Widget | null;
  readonly iconPadding?: EdgeInsetsGeometry | null;
  readonly iconColor?: Color | null;
  readonly content?: Widget | null;
  readonly actions?: readonly Widget[] | null;
  readonly actionsPadding?: EdgeInsetsGeometry | null;
  readonly actionsAlignment?: MainAxisAlignment | null;
  readonly actionsOverflowAlignment?: OverflowBarAlignment | null;
  readonly actionsOverflowDirection?: VerticalDirection | null;
  readonly actionsOverflowButtonSpacing?: number | null;
  readonly buttonPadding?: EdgeInsetsGeometry | null;
  readonly scrollable?: boolean;
}

type CupertinoAlertMotion = Pick<
  CupertinoAlertDialogOptions,
  'scrollController' | 'actionScrollController' | 'insetAnimationDuration' | 'insetAnimationCurve'
>;

export interface AdaptiveAlertDialogOptions extends AlertDialogOptions, CupertinoAlertMotion {}

const dialogColumn = { mainSize: 'min', crossAlign: 'stretch' } as const;
const dialogActionsPadding = EdgeInsets.fromLTRB(24, 0, 24, 24);

function scaledPadding(context: BuildContext, fontSize: number): number {
  const effectiveFontSize = fontSize > 0 ? fontSize : 14;
  const scale = MediaQuery.textScalerOf(context).scale(effectiveFontSize) / effectiveFontSize;
  return 1 - (2 / 3) * (Math.max(1, Math.min(scale, 2)) - 1);
}

function dialogPadding(
  padding: EdgeInsets,
  factor: number,
  scaleTop: boolean,
  scaleBottom = false,
): EdgeInsets {
  return EdgeInsets.fromLTRB(
    padding.left * factor,
    scaleTop ? padding.top * factor : padding.top,
    padding.right * factor,
    scaleBottom ? padding.bottom * factor : padding.bottom,
  );
}

function routeNamedDialog(label: string | null, child: Widget): Widget {
  return label === null
    ? child
    : new Semantics({
        scopesRoute: true,
        namesRoute: true,
        explicitChildNodes: true,
        label,
        child,
      });
}

export class AlertDialog extends StatelessWidget {
  readonly options: Readonly<AlertDialogOptions>;
  readonly id: string;
  readonly title: Widget | string | null;
  readonly content: Widget | null;
  readonly onClose: (() => void) | null;
  private adaptiveMotion: CupertinoAlertMotion | null = null;

  constructor(options?: AlertDialogOptions);
  constructor(id: string, title: string, content: Widget, onClose: () => void);
  constructor(
    optionsOrId: AlertDialogOptions | string = {},
    title?: string,
    content?: Widget,
    onClose?: () => void,
  ) {
    const options: AlertDialogOptions = typeof optionsOrId === 'string' ? {} : optionsOrId;
    super(options.key ?? null);
    this.options = Object.freeze({
      ...options,
      actions: options.actions ? Object.freeze([...options.actions]) : null,
    });
    this.id = typeof optionsOrId === 'string' ? optionsOrId : '';
    this.title = title ?? options.title ?? null;
    this.content = content ?? options.content ?? null;
    this.onClose = onClose ?? null;
  }

  static adaptive(options: AdaptiveAlertDialogOptions = {}): AlertDialog {
    const {
      scrollController = null,
      actionScrollController = null,
      insetAnimationDuration = 100,
      insetAnimationCurve = Curves.decelerate,
      ...material
    } = options;
    const dialog = new AlertDialog(material);
    dialog.adaptiveMotion = {
      scrollController,
      actionScrollController,
      insetAnimationDuration,
      insetAnimationCurve,
    };
    return dialog;
  }

  override build(context: BuildContext): Widget {
    if (typeof this.title === 'string' && this.content && this.onClose)
      return this.buildLegacy(context, this.title, this.content, this.onClose);
    const options = this.options;
    const theme = Theme.of(context);
    if (this.adaptiveMotion && (theme.platform === 'iOS' || theme.platform === 'macOS'))
      return new CupertinoAlertDialog({
        ...this.adaptiveMotion,
        title: options.title ?? null,
        content: options.content ?? null,
        actions: options.actions ?? [],
      });
    const dialog = DialogTheme.of(context);
    const { icon, title, content, actions } = options;
    const platform = FoundationPlatform.defaultTargetPlatform;
    const label =
      options.semanticLabel ??
      (platform === 'iOS' || platform === 'macOS'
        ? null
        : MaterialLocalizations.of(context).alertDialogLabel);
    const factor = scaledPadding(context, 14);
    const direction = Directionality.maybeOf(context) ?? 'ltr';
    const iconWidget = icon
      ? new Padding(
          dialogPadding(
            (
              options.iconPadding ?? EdgeInsets.fromLTRB(24, 24, 24, title ? 16 : content ? 0 : 24)
            ).resolve(direction),
            factor,
            true,
          ),
          new IconTheme(
            new IconThemeData({
              color:
                options.iconColor ?? dialog.iconColor ?? new Color(theme.colorScheme.secondary),
            }),
            icon,
          ),
        )
      : null;
    const titleWidget = title
      ? new Padding(
          dialogPadding(
            (
              options.titlePadding ?? EdgeInsets.fromLTRB(24, icon ? 0 : 24, 24, content ? 0 : 20)
            ).resolve(direction),
            factor,
            !icon,
          ),
          new DefaultTextStyle(
            (options.titleTextStyle ?? dialog.titleTextStyle ?? theme.textTheme.headlineSmall)!,
            new Semantics({
              namesRoute: label === null && platform !== 'iOS',
              container: true,
              child: title,
            }),
            { textAlign: icon ? 'center' : 'start' },
          ),
        )
      : null;
    const contentWidget = content
      ? new Padding(
          dialogPadding(
            (options.contentPadding ?? EdgeInsets.fromLTRB(24, 16, 24, 24)).resolve(direction),
            factor,
            !title && !icon,
          ),
          new DefaultTextStyle(
            (options.contentTextStyle ?? dialog.contentTextStyle ?? theme.textTheme.bodyMedium)!,
            new Semantics({ container: true, explicitChildNodes: true, child: content }),
          ),
        )
      : null;
    const actionsWidget = actions
      ? new Padding(
          options.actionsPadding ?? dialog.actionsPadding ?? dialogActionsPadding,
          new OverflowBar({
            children: actions,
            alignment: options.actionsAlignment ?? 'end',
            spacing: (options.buttonPadding?.horizontal ?? 16) / 2,
            overflowAlignment: options.actionsOverflowAlignment ?? OverflowBarAlignment.end,
            ...(options.actionsOverflowDirection == null
              ? {}
              : { overflowDirection: options.actionsOverflowDirection }),
            overflowSpacing: options.actionsOverflowButtonSpacing ?? 0,
          }),
        )
      : null;
    const top = [iconWidget, titleWidget, contentWidget].filter((child) => child !== null);
    const children: Widget[] =
      options.scrollable && top.length
        ? [
            new Flexible(
              new SingleBoxScrollView({ primary: false, child: new Column(top, dialogColumn) }),
            ),
          ]
        : [
            ...(iconWidget ? [iconWidget] : []),
            ...(titleWidget ? [titleWidget] : []),
            ...(contentWidget ? [new Flexible(contentWidget)] : []),
          ];
    if (actionsWidget) children.push(actionsWidget);
    return new Dialog({
      ...options,
      key: null,
      semanticsRole: SemanticsRole.alertDialog,
      child: routeNamedDialog(label, new IntrinsicWidth(new Column(children, dialogColumn))),
    });
  }

  private buildLegacy(
    context: BuildContext,
    title: string,
    body: Widget,
    close: () => void,
  ): Widget {
    const theme = AppTheme.of(context);
    const content = new Column(
      [
        new Text(title, { fontSize: 24, color: theme.foreground }),
        body,
        new FilledButton(this.id + '-close', 'Close', close),
      ],
      { spacing: 20, crossAlign: 'stretch' },
    );
    const card = new DecoratedBox(new Padding(allInsets(20), content), theme.surface, theme.radius);
    return new Align(new Padding(allInsets(24), card));
  }
}

export interface SimpleDialogOptions extends DialogTextOptions {
  readonly children?: readonly Widget[] | null;
}

export class SimpleDialog extends StatelessWidget {
  readonly options: Readonly<SimpleDialogOptions>;
  constructor(options: SimpleDialogOptions = {}) {
    super(options.key ?? null);
    this.options = Object.freeze({
      ...options,
      children: options.children ? Object.freeze([...options.children]) : null,
    });
  }

  override build(context: BuildContext): Widget {
    const options = this.options;
    const theme = Theme.of(context);
    const dialog = DialogTheme.of(context);
    const platform = FoundationPlatform.defaultTargetPlatform;
    const label =
      options.semanticLabel ??
      (platform === 'iOS' || platform === 'macOS'
        ? null
        : MaterialLocalizations.of(context).dialogLabel);
    const titleStyle = (options.titleTextStyle ??
      dialog.titleTextStyle ??
      theme.textTheme.titleLarge)!;
    const factor = scaledPadding(context, titleStyle.fontSize ?? 14);
    const direction = Directionality.maybeOf(context) ?? 'ltr';
    const children: Widget[] = [];
    if (options.title)
      children.push(
        new Padding(
          dialogPadding(
            (options.titlePadding ?? EdgeInsets.fromLTRB(24, 24, 24, 0)).resolve(direction),
            factor,
            true,
            options.children == null,
          ),
          new DefaultTextStyle(
            titleStyle,
            new Semantics({
              namesRoute: label === null && platform !== 'iOS',
              container: true,
              child: options.title,
            }),
          ),
        ),
      );
    if (options.children)
      children.push(
        new Flexible(
          new SingleBoxScrollView({
            primary: false,
            padding: dialogPadding(
              (options.contentPadding ?? EdgeInsets.fromLTRB(0, 12, 0, 16)).resolve(direction),
              factor,
              !options.title,
              true,
            ),
            child: new DefaultTextStyle(
              (options.contentTextStyle ?? dialog.contentTextStyle ?? theme.textTheme.bodyMedium)!,
              new ListBody(options.children),
            ),
          }),
        ),
      );
    return new Dialog({
      ...options,
      key: null,
      child: routeNamedDialog(
        label,
        new IntrinsicWidth(new Column(children, dialogColumn), { stepWidth: 56 }),
      ),
    });
  }
}
export interface MaterialDialogRouteOptions {
  readonly context: BuildContext;
  readonly builder: (context: BuildContext) => Widget;
  readonly themes?: CapturedThemes | null;
  readonly barrierColor?: Color | null;
  readonly barrierDismissible?: boolean;
  readonly barrierLabel?: string | null;
  readonly useSafeArea?: boolean;
  readonly settings?: RouteSettings | null;
  readonly requestFocus?: boolean | null;
  readonly anchorPoint?: Offset | null;
  readonly traversalEdgeBehavior?: TraversalEdgeBehavior | null;
  readonly fullscreenDialog?: boolean;
  readonly animationStyle?: AnimationStyle | null;
}

export class DialogRoute<T = unknown> extends PageRouteBuilder<T> {
  readonly anchorPoint: Offset | null;
  readonly animationStyle: AnimationStyle | null;
  private fade: CurvedAnimation | null = null;

  constructor({
    context,
    builder,
    themes = null,
    barrierColor = Colors.black54,
    barrierDismissible = true,
    barrierLabel,
    useSafeArea = true,
    settings = null,
    requestFocus = null,
    anchorPoint = null,
    traversalEdgeBehavior = TraversalEdgeBehavior.closedLoop,
    fullscreenDialog = false,
    animationStyle = null,
  }: MaterialDialogRouteOptions) {
    const duration = animationStyle?.duration ?? 150;
    super({
      settings,
      requestFocus,
      traversalEdgeBehavior,
      fullscreenDialog,
      opaque: false,
      barrierColor,
      barrierDismissible,
      barrierLabel: barrierLabel ?? MaterialLocalizations.of(context).modalBarrierDismissLabel,
      transitionDuration: duration,
      reverseTransitionDuration: animationStyle?.reverseDuration ?? duration,
      pageBuilder: () => {
        const child = new Builder(builder);
        const dialog = themes?.wrap(child) ?? child;
        return new Semantics({
          scopesRoute: true,
          explicitChildNodes: true,
          child: new DisplayFeatureSubScreen({
            anchorPoint,
            child: new Semantics({
              hitTestBehavior: SemanticsHitTestBehavior.opaque,
              child: useSafeArea ? new SafeArea({ child: dialog }) : dialog,
            }),
          }),
        });
      },
    });
    this.anchorPoint = anchorPoint;
    this.animationStyle = animationStyle;
  }

  override buildTransitions(
    _context: BuildContext,
    animation: Animation<number>,
    _secondary: Animation<number>,
    child: Widget,
  ): Widget {
    if (this.fade?.parent !== animation) {
      this.fade?.dispose();
      this.fade = new CurvedAnimation({
        parent: animation,
        curve: this.animationStyle?.curve ?? Curves.easeOut,
        reverseCurve: this.animationStyle?.reverseCurve ?? Curves.easeOut,
      });
    }
    return new FadeTransition({ opacity: this.fade, child });
  }
  override dispose(): void {
    this.fade?.dispose();
    this.fade = null;
    super.dispose();
  }
}

export interface ShowMaterialDialogOptions extends Omit<
  MaterialDialogRouteOptions,
  'context' | 'themes' | 'settings'
> {
  readonly routeSettings?: RouteSettings | null;
  readonly useRootNavigator?: boolean;
}

class WindowDialog<T> extends StatefulWidget {
  constructor(
    readonly options: ShowMaterialDialogOptions,
    readonly dismiss: (result?: T) => void,
  ) {
    super();
  }
  override createState(): State<WindowDialog<T>> {
    return new WindowDialogState<T>();
  }
}

class WindowDialogState<T> extends State<WindowDialog<T>> {
  private readonly navigator = new NavigatorController();
  private readonly initialRoute = new PageRouteBuilder({
    pageBuilder: () => new SizedBox(),
    transitionDuration: 0,
    reverseTransitionDuration: 0,
  });

  override initState(): void {
    const { builder, routeSettings, requestFocus, traversalEdgeBehavior, fullscreenDialog } =
      this.widget.options;
    this.navigator.initialize(this.initialRoute);
    const route = new PageRouteBuilder<T>({
      ...(traversalEdgeBehavior !== undefined ? { traversalEdgeBehavior } : {}),
      ...(fullscreenDialog !== undefined ? { fullscreenDialog } : {}),
      settings: routeSettings ?? null,
      requestFocus: requestFocus ?? true,
      pageBuilder: (context) => {
        const theme = DialogTheme.of(context).copyWith({
          insetPadding: EdgeInsets.zero,
          shape: new RoundedRectangleBorder(),
          alignment: Alignment.topLeft,
          constraints: BoxConstraints.expand(),
        });
        const media = MediaQuery.of(context);
        return new MediaQuery(
          {
            ...media,
            padding: EdgeInsets.zero,
            viewPadding: EdgeInsets.zero,
            viewInsets: EdgeInsets.zero,
            safeArea: allInsets(0),
            keyboardInset: 0,
          },
          new DialogTheme(theme, new Builder(builder)),
        );
      },
      transitionDuration: 0,
      reverseTransitionDuration: 0,
    });
    void this.navigator.push<T>(route).then((result) => {
      if (this.mounted) this.widget.dismiss(result);
    });
  }

  override build(context: BuildContext): Widget {
    return new MediaQuery(
      mediaFromView(context),
      new AppFocus(
        new Focus(new TapRegionSurface(new Navigator(this.navigator, this.initialRoute)), {
          includeSemantics: false,
          canRequestFocus: false,
          onKeyEvent: (_node, event) => {
            if (
              !(event instanceof KeyDownEvent) ||
              event.logicalKey !== LogicalKeyboardKey.escape ||
              this.widget.options.barrierDismissible === false
            )
              return 'ignored';
            void this.navigator.maybePop().catch((error) => context.services.reportError?.(error));
            return 'handled';
          },
        }),
      ),
    );
  }

  override dispose(): void {
    this.navigator.dispose();
    super.dispose();
  }
}

function openWindowDialog<T>(
  context: BuildContext,
  options: ShowMaterialDialogOptions,
  themes: CapturedThemes,
): Promise<T | undefined> | null {
  const host = context.services.dialogWindows;
  if (!host) return null;
  const title = Title.maybeOf(context) || options.routeSettings?.name || 'Dialog';
  const locale = context.maybeDependOn(Localizations);
  const appTheme = context.maybeDependOn(AppTheme)?.data;
  const scrollBehavior = ScrollConfiguration.of(context);
  const direction = Directionality.maybeOf(context) ?? 'ltr';
  const fontId = context.services.defaultFont?.id;
  const background = Theme.of(context).colorScheme.surface;
  const defaultFont = fontId && context.services.assets.has(fontId) ? fontId : undefined;
  return host.open<T>({
    title,
    requestFocus: options.requestFocus ?? true,
    createApplication: (dismiss) =>
      widgetApplication({
        id: 'material-dialog',
        background,
        ...(defaultFont ? { defaultFont } : {}),
        createRoot: () => {
          let child: Widget = new WindowDialog(options, dismiss);
          child = new ScrollConfiguration({ behavior: scrollBehavior, child: themes.wrap(child) });
          child = new Directionality(direction, child);
          if (appTheme) child = new AppTheme(appTheme, child);
          if (locale) child = locale.wrap(child);
          return new Title({ title, child });
        },
      }),
  });
}

export function showDialog<T = unknown>(
  context: BuildContext,
  options: ShowMaterialDialogOptions,
): Promise<T | undefined>;
export function showDialog<T = unknown>(
  navigator: NavigatorController,
  builder: (context: BuildContext) => Widget,
  options?: Omit<DialogRouteOptions, 'builder'>,
): Promise<T | undefined>;
export function showDialog<T = unknown>(
  contextOrNavigator: BuildContext | NavigatorController,
  optionsOrBuilder: ShowMaterialDialogOptions | ((context: BuildContext) => Widget),
  legacyOptions: Omit<DialogRouteOptions, 'builder'> = {},
): Promise<T | undefined> {
  if (contextOrNavigator instanceof NavigatorController && typeof optionsOrBuilder === 'function') {
    return contextOrNavigator.push(
      createDialogRoute<T>({ ...legacyOptions, builder: optionsOrBuilder }),
    );
  }
  if (contextOrNavigator instanceof NavigatorController || typeof optionsOrBuilder === 'function')
    throw new TypeError(
      'Provide a BuildContext and dialog options, or a NavigatorController and builder',
    );
  const context = contextOrNavigator;
  if (FoundationBuildMode.debug && context instanceof Element)
    invariant(
      context.active,
      'inactive-dialog-context',
      'showDialog requires an active BuildContext',
    );
  const { useRootNavigator = true, routeSettings = null, ...options } = optionsOrBuilder;
  const themes = InheritedTheme.capture(context);
  const window = openWindowDialog<T>(context, optionsOrBuilder, themes);
  if (window) return window;
  const navigator = Navigator.of(context, { rootNavigator: useRootNavigator });
  return navigator.push(
    new DialogRoute<T>({
      ...options,
      context,
      settings: routeSettings,
      barrierColor: options.barrierColor ?? DialogTheme.of(context).barrierColor ?? Colors.black54,
      themes,
    }),
  );
}

export function showAdaptiveDialog<T = unknown>(
  context: BuildContext,
  options: ShowMaterialDialogOptions,
): Promise<T | undefined> {
  const platform = Theme.of(context).platform;
  if (platform !== 'iOS' && platform !== 'macOS') return showDialog<T>(context, options);
  return showCupertinoDialog<T>(context, {
    builder: options.builder,
    barrierDismissible: options.barrierDismissible ?? false,
    barrierLabel: options.barrierLabel ?? null,
    useRootNavigator: options.useRootNavigator ?? true,
    routeSettings: options.routeSettings ?? null,
    anchorPoint: options.anchorPoint ?? null,
    requestFocus: options.requestFocus ?? null,
  });
}
