// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { invariant } from '@nelyx/core/foundation/errors';
import { UniqueKey } from '@nelyx/core/foundation/key';
import type { Key } from '@nelyx/core/foundation/key';
import { AnimationStatus } from '@nelyx/core/framework/animation/animation';
import type { Animation } from '@nelyx/core/framework/animation/animation';
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import { Curves } from '@nelyx/core/framework/animation/curves';
import type { TickerProvider } from '@nelyx/core/framework/animation/ticker';
import { AlignmentDirectional } from '@nelyx/core/framework/painting/alignment';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import type { ShapeBorder } from '@nelyx/core/framework/painting/borders';
import { EdgeInsets, EdgeInsetsDirectional } from '@nelyx/core/framework/painting/edge-insets';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { RoundedRectangleBorder } from '@nelyx/core/framework/painting/rounded-rectangle-border';
import { TextPainter } from '@nelyx/core/framework/painting/text-painter';
import { TextSpan } from '@nelyx/core/framework/painting/text-span';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { HitTestBehavior } from '@nelyx/core/framework/rendering/pointer-listener';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import {
  Align,
  Center,
  Column,
  Expanded,
  Padding,
  Row,
  SizedBox,
  Text,
} from '@nelyx/core/framework/widgets/basic';
import { ClipRect } from '@nelyx/core/framework/widgets/clip';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import { Dismissible, DismissDirection } from '@nelyx/core/framework/widgets/dismissible';
import { State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type {
  BuildContext,
  Element,
  Widget,
  WidgetOptions,
} from '@nelyx/core/framework/widgets/framework';
import { Icon } from '@nelyx/core/framework/widgets/icon';
import { LayoutBuilder } from '@nelyx/core/framework/widgets/layout-builder';
import { ListenableBuilder } from '@nelyx/core/framework/widgets/listenable-builder';
import { Opacity } from '@nelyx/core/framework/widgets/opacity';
import { SafeArea } from '@nelyx/core/framework/widgets/safe-area';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import type { Clip } from '@nelyx/core/ui/clip';
import { Color } from '@nelyx/core/ui/color';
import { IconButton } from './icon-button.ts';
import { Icons } from './icons.ts';
import { Material } from './material.ts';
import { MaterialLocalizations } from './material-localizations.ts';
import { ScaffoldMessenger } from './scaffold-messenger.ts';
import { SnackBarBehavior } from './snack-bar-behavior.ts';
import { SnackBarTheme } from './snack-bar-theme.ts';
import { TextButton } from './text-button.ts';
import { Theme } from './theme.ts';

export { SnackBarBehavior };
const transitionDuration = 250;
const floatingShape = new RoundedRectangleBorder({ borderRadius: BorderRadius.circular(4) });
const floatingMargin = EdgeInsets.fromLTRB(15, 5, 15, 10);
const floatingHeightCurve = Curves.fastOutSlowIn;
const reasonToken = Symbol('SnackBarClosedReason');

export class SnackBarClosedReason {
  private readonly brand = reasonToken;
  private constructor(
    readonly index: number,
    readonly name: 'action' | 'dismiss' | 'swipe' | 'hide' | 'remove' | 'timeout',
    token: typeof reasonToken,
  ) {
    if (token !== reasonToken) throw new TypeError('Expected a canonical SnackBarClosedReason');
    Object.freeze(this);
  }
  static readonly action = new SnackBarClosedReason(0, 'action', reasonToken);
  static readonly dismiss = new SnackBarClosedReason(1, 'dismiss', reasonToken);
  static readonly swipe = new SnackBarClosedReason(2, 'swipe', reasonToken);
  static readonly hide = new SnackBarClosedReason(3, 'hide', reasonToken);
  static readonly remove = new SnackBarClosedReason(4, 'remove', reasonToken);
  static readonly timeout = new SnackBarClosedReason(5, 'timeout', reasonToken);
  static readonly values = Object.freeze([
    this.action,
    this.dismiss,
    this.swipe,
    this.hide,
    this.remove,
    this.timeout,
  ]);
  toString(): string {
    return 'SnackBarClosedReason.' + this.name;
  }
}
Object.freeze(SnackBarClosedReason.prototype);
Object.freeze(SnackBarClosedReason);

export interface SnackBarActionOptions extends WidgetOptions {
  readonly label: string;
  readonly onPressed: () => void;
  readonly textColor?: Color | null;
  readonly backgroundColor?: Color | null;
  readonly disabledTextColor?: Color | null;
  readonly disabledBackgroundColor?: Color | null;
}

export class SnackBarAction extends StatefulWidget {
  readonly label: string;
  readonly onPressed: () => void;
  readonly textColor: Color | null;
  readonly backgroundColor: Color | null;
  readonly disabledTextColor: Color | null;
  readonly disabledBackgroundColor: Color | null;

  constructor({
    label,
    onPressed,
    textColor = null,
    backgroundColor = null,
    disabledTextColor = null,
    disabledBackgroundColor = null,
    key = null,
  }: SnackBarActionOptions) {
    super(key);
    this.label = label;
    this.onPressed = onPressed;
    this.textColor = textColor;
    this.backgroundColor = backgroundColor;
    this.disabledTextColor = disabledTextColor;
    this.disabledBackgroundColor = disabledBackgroundColor;
  }

  override createState(): State<SnackBarAction> {
    return new SnackBarActionState();
  }
}

class SnackBarActionState extends State<SnackBarAction> {
  private pressed = false;
  private readonly action = () => {
    if (this.pressed) return;
    const messenger = ScaffoldMessenger.of(this.context);
    const current = messenger.currentSnackBar;
    this.setState(() => {
      this.pressed = true;
    });
    this.widget.onPressed();
    if (messenger.currentSnackBar === current)
      messenger.hideCurrentSnackBar({ reason: SnackBarClosedReason.action });
  };

  override build(context: BuildContext): Widget {
    const theme = SnackBarTheme.of(context);
    const defaultColor = new Color(Theme.of(context).colorScheme.inversePrimary);
    return new TextButton({
      child: new Text(this.widget.label),
      onPressed: this.pressed ? null : this.action,
      style: TextButton.styleFrom({
        foregroundColor: this.widget.textColor ?? theme.actionTextColor ?? defaultColor,
        disabledForegroundColor:
          this.widget.disabledTextColor ?? theme.disabledActionTextColor ?? defaultColor,
        backgroundColor: this.widget.backgroundColor ?? theme.actionBackgroundColor,
        disabledBackgroundColor:
          this.widget.disabledBackgroundColor ?? theme.disabledActionBackgroundColor,
      }),
    });
  }
}

export interface SnackBarOptions extends WidgetOptions {
  readonly content: Widget;
  readonly backgroundColor?: Color | null;
  readonly elevation?: number | null;
  readonly margin?: EdgeInsetsGeometry | null;
  readonly padding?: EdgeInsetsGeometry | null;
  readonly width?: number | null;
  readonly shape?: ShapeBorder | null;
  readonly hitTestBehavior?: HitTestBehavior | null;
  readonly behavior?: SnackBarBehavior | null;
  readonly action?: SnackBarAction | null;
  readonly actionOverflowThreshold?: number | null;
  readonly showCloseIcon?: boolean | null;
  readonly closeIconColor?: Color | null;
  readonly duration?: number;
  readonly persist?: boolean | null;
  readonly animation?: Animation<number> | null;
  readonly onVisible?: (() => void) | null;
  readonly dismissDirection?: DismissDirection | null;
  readonly clipBehavior?: Clip;
}

export class SnackBar extends StatefulWidget {
  readonly options: Readonly<SnackBarOptions>;
  readonly duration: number;
  readonly persist: boolean;
  readonly animation: Animation<number> | null;
  readonly content: Widget;

  constructor(options: SnackBarOptions) {
    super(options.key ?? null);
    this.options = Object.freeze({ ...options });
    this.content = options.content;
    this.duration = options.duration ?? 4000;
    this.persist = options.persist ?? options.action != null;
    this.animation = options.animation ?? null;
    invariant(
      Number.isFinite(this.duration) && this.duration >= 0,
      'invalid-snack-bar-duration',
      'SnackBar duration must be finite and nonnegative',
    );
    invariant(
      options.width == null || options.margin == null,
      'conflicting-snack-bar-width',
      'SnackBar width and margin are mutually exclusive',
    );
    invariant(
      options.width == null || (Number.isFinite(options.width) && options.width > 0),
      'invalid-snack-bar-width',
      'SnackBar width must be positive and finite',
    );
    const threshold = options.actionOverflowThreshold;
    invariant(
      threshold == null || (threshold >= 0 && threshold <= 1),
      'invalid-snack-bar-overflow',
      'SnackBar action overflow threshold must be in [0, 1]',
    );
  }

  get behavior(): SnackBarBehavior | null {
    return this.options.behavior ?? null;
  }
  get action(): SnackBarAction | null {
    return this.options.action ?? null;
  }
  get onVisible(): (() => void) | null {
    return this.options.onVisible ?? null;
  }

  static createAnimationController({
    vsync,
    duration = transitionDuration,
    reverseDuration = null,
  }: {
    readonly vsync: TickerProvider;
    readonly duration?: number;
    readonly reverseDuration?: number | null;
  }): AnimationController {
    return new AnimationController({ vsync, duration, reverseDuration });
  }

  withAnimation(
    animation: Animation<number>,
    { fallbackKey = null }: { readonly fallbackKey?: Key | null } = {},
  ): SnackBar {
    return new SnackBar({ ...this.options, animation, key: this.key ?? fallbackKey });
  }

  override createState(): State<SnackBar> {
    return new SnackBarState();
  }
}

class SnackBarState extends State<SnackBar> {
  private readonly dismissKey = new UniqueKey();
  private wasVisible = false;
  private readonly statusChanged = (status: AnimationStatus) => {
    if (status !== AnimationStatus.completed || this.wasVisible) return;
    this.wasVisible = true;
    (this.context as Element).owner.postFrame(() => {
      if (this.mounted) this.widget.onVisible?.();
    });
  };

  private listen(animation: Animation<number> | null): void {
    animation?.addStatusListener(this.statusChanged);
    this.statusChanged(animation?.status ?? AnimationStatus.completed);
  }

  override initState(): void {
    super.initState();
    this.listen(this.widget.animation);
  }
  override didUpdateWidget(old: SnackBar): void {
    super.didUpdateWidget(old);
    if (old.animation === this.widget.animation) return;
    old.animation?.removeStatusListener(this.statusChanged);
    this.listen(this.widget.animation);
  }

  override build(context: BuildContext): Widget {
    const { options, content, action, animation } = this.widget;
    const theme = Theme.of(context);
    const colors = theme.colorScheme;
    const snack = SnackBarTheme.of(context);
    const media = context.maybeDependOn(MediaQuery)?.data;
    const floating = (options.behavior ?? snack.behavior) === SnackBarBehavior.floating;
    const width = options.width ?? snack.width;
    invariant(
      floating || (width == null && options.margin == null),
      'fixed-snack-bar-dimensions',
      'SnackBar width and margin require floating behavior',
    );
    const showClose = options.showCloseIcon ?? snack.showCloseIcon ?? false;
    const horizontal = floating ? 16 : 24;
    const padding =
      options.padding ??
      EdgeInsetsDirectional.fromSTEB(horizontal, 0, action || showClose ? 0 : horizontal, 0);
    const messenger = ScaffoldMessenger.of(context);
    const close = () => messenger.hideCurrentSnackBar({ reason: SnackBarClosedReason.dismiss });
    const closeButton = showClose
      ? new IconButton({
          icon: new Icon(Icons.close),
          tooltip: MaterialLocalizations.of(context).closeButtonTooltip,
          onPressed: close,
          color:
            options.closeIconColor ?? snack.closeIconColor ?? new Color(colors.onInverseSurface),
        })
      : null;
    const label = new DefaultTextStyle(
      snack.contentTextStyle ??
        (theme.textTheme.bodyMedium ?? new TextStyle()).copyWith({
          color: colors.onInverseSurface,
        }),
      content,
    );
    const contents = new Padding(
      padding,
      new LayoutBuilder((context, constraints) => {
        const font = context.services.defaultFont;
        const actionWidth =
          action && font
            ? TextPainter.computeWidth(
                {
                  text: new TextSpan({ text: action.label, style: theme.textTheme.labelLarge }),
                  textDirection: 'ltr',
                  maxLines: 1,
                },
                {
                  text: context.services.text,
                  resources: context.services.resources,
                  font,
                  scale: media?.scale ?? 1,
                },
              )
            : 0;
        const endWidth = actionWidth + (action ? horizontal / 2 : 0) + (showClose ? 24 : 0);
        const overflow =
          action &&
          endWidth >
            constraints.maxWidth *
              (options.actionOverflowThreshold ?? snack.actionOverflowThreshold ?? 0.25);
        const text = new Padding(EdgeInsets.symmetric({ vertical: 14 }), label);
        const inline = new Row([
          new Expanded(text),
          ...(action && !overflow ? [action] : []),
          ...(closeButton ? [closeButton] : []),
        ]);
        return overflow
          ? new Column(
              [
                inline,
                new Align(action, { alignment: AlignmentDirectional.centerEnd, heightFactor: 1 }),
              ],
              { mainAxisSize: 'min' },
            )
          : inline;
      }),
    );
    let card: Widget = new Material({
      color: options.backgroundColor ?? snack.backgroundColor ?? new Color(colors.inverseSurface),
      elevation: options.elevation ?? snack.elevation ?? 6,
      shape: options.shape ?? snack.shape ?? (floating ? floatingShape : null),
      clipBehavior: options.clipBehavior ?? 'hardEdge',
      child: floating ? contents : new SafeArea({ top: false, child: contents }),
    });
    if (floating) {
      const margin = options.margin ?? snack.insetPadding ?? floatingMargin;
      const resolved = margin.resolve(Directionality.of(context));
      const insets =
        width == null ? margin : EdgeInsets.fromLTRB(0, resolved.top, 0, resolved.bottom);
      card = new SafeArea({
        top: false,
        bottom: false,
        child: new Padding(
          insets,
          width == null
            ? card
            : new Center(new SizedBox(width, undefined, card), { heightFactor: 1 }),
        ),
      });
    }
    const surface = new Semantics({
      container: true,
      liveRegion: true,
      onDismiss: () => messenger.removeCurrentSnackBar({ reason: SnackBarClosedReason.dismiss }),
      child: new Dismissible({
        key: this.dismissKey,
        direction: options.dismissDirection ?? snack.dismissDirection ?? DismissDirection.down,
        behavior:
          options.hitTestBehavior ??
          (options.margin || snack.insetPadding
            ? HitTestBehavior.deferToChild
            : HitTestBehavior.opaque),
        resizeDuration: null,
        onDismissed: () => messenger.removeCurrentSnackBar({ reason: SnackBarClosedReason.swipe }),
        child: card,
      }),
    });
    if (!animation || media?.accessibleNavigation) return surface;
    return new ListenableBuilder(animation, () => {
      const fraction = floating
        ? floatingHeightCurve.transform(animation.value)
        : Curves.easeInOut.transform(animation.value);
      const child = floating
        ? new Opacity(surface, { opacity: Math.min(1, animation.value * 2) })
        : surface;
      return new ClipRect(
        new Align(child, { alignment: AlignmentDirectional.topStart, heightFactor: fraction }),
      );
    });
  }

  override dispose(): void {
    this.widget.animation?.removeStatusListener(this.statusChanged);
    super.dispose();
  }
}
