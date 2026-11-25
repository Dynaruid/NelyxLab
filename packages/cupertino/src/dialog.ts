// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/cupertino/dialog.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { FoundationBuildMode } from '@nelyx/core/foundation/constants';
import { invariant } from '@nelyx/core/foundation/errors';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { Curves, type Curve } from '@nelyx/core/framework/animation/curves';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { RoundedSuperellipseBorder } from '@nelyx/core/framework/painting/rounded-superellipse-border';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { ShapeBorderClipper } from '@nelyx/core/framework/rendering/shape-border-clipper';
import { BackdropFilter } from '@nelyx/core/framework/widgets/backdrop-filter';
import { ClipPath } from '@nelyx/core/framework/widgets/clip';
import {
  ControlInteraction,
  ControlInteractionState,
} from '@nelyx/core/framework/widgets/control-interaction';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { FittedBox } from '@nelyx/core/framework/widgets/fitted-box';
import {
  Element,
  State,
  StatefulWidget,
  StatelessWidget,
} from '@nelyx/core/framework/widgets/framework';
import type { Widget, BuildContext, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { AnimatedPadding } from '@nelyx/core/framework/widgets/implicit-animations';
import { LayoutBuilder } from '@nelyx/core/framework/widgets/layout-builder';
import { ScrollConfiguration } from '@nelyx/core/framework/widgets/scroll-configuration';
import { ScrollController } from '@nelyx/core/framework/widgets/scroll-controller';
import { SingleBoxScrollView } from '@nelyx/core/framework/widgets/scroll-view';
import {
  Builder,
  Center,
  ColoredBox,
  Column,
  ConstrainedBox,
  Flexible,
  Padding,
  SizedBox,
  Text,
} from '@nelyx/core/framework/widgets/basic';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { MouseCursor, SystemMouseCursors } from '@nelyx/core/services/mouse-cursor';
import { Color } from '@nelyx/core/ui/color';
import { ColorFilter } from '@nelyx/core/ui/color-filter';
import { ImageFilter } from '@nelyx/core/ui/image-filter';
import { SemanticsRole } from '@nelyx/core/ui/semantics';
import { FontWeight } from '@nelyx/core/ui/typography';
import { CupertinoColors, CupertinoDynamicColor } from './colors.ts';
import { CupertinoLocalizations } from './cupertino-localizations.ts';
import { CupertinoUserInterfaceLevel, CupertinoUserInterfaceLevelData } from './interface-level.ts';
import { CupertinoScrollbar } from './scrollbar.ts';
import { CupertinoTheme } from './theme.ts';
import {
  DialogActionsLayout,
  DialogOverscrollBackground,
  PriorityDialogColumn,
  dialogDivider,
  dialogDividerThickness,
} from './internal/dialog-layout.ts';
import {
  DialogActionBackground,
  DialogSlideScope,
  DialogSlidingActions,
  dialogSlideRegion,
  type DialogSlideTarget,
} from './internal/sliding-dialog-actions.ts';

const dialogWidth = 270;
const accessibilityDialogWidth = 310;
const dialogEdgePadding = 20;
const dialogActionsSectionMinHeight = 67.8;
const maxRegularTextScaleFactor = 1.4;
const dialogMinButtonHeight = 45;
const dialogMinButtonFontSize = 10;
const dialogSurface = CupertinoDynamicColor.withBrightness({
  color: new Color(0xccf2f2f2),
  darkColor: new Color(0xcc2d2d2d),
});
const dialogPressedSurface = CupertinoDynamicColor.withBrightness({
  color: new Color(0xffe1e1e1),
  darkColor: new Color(0xff404040),
});
const dialogActionStyle = new TextStyle({
  fontFamily: 'CupertinoSystemText',
  inherit: false,
  fontSize: 16.8,
  fontWeight: FontWeight.w400,
  textBaseline: 'alphabetic',
});
const dialogTitleStyle = new TextStyle({
  fontFamily: 'CupertinoSystemText',
  inherit: false,
  fontSize: 17,
  fontWeight: FontWeight.w600,
  height: 1.3,
  letterSpacing: -0.5,
  textBaseline: 'alphabetic',
});
const dialogContentStyle = new TextStyle({
  fontFamily: 'CupertinoSystemText',
  inherit: false,
  fontSize: 13,
  fontWeight: FontWeight.w400,
  height: 1.35,
  letterSpacing: -0.2,
  textBaseline: 'alphabetic',
});
const dialogColumn = { mainSize: 'min', crossAlign: 'stretch' } as const;
const clearInsets = { removeTop: true, removeLeft: true, removeRight: true, removeBottom: true };
function accessibilityMode(context: BuildContext): boolean {
  const size = MediaQuery.maybeTextScalerOf(context)?.scale(14);
  return size !== undefined && size > 14 * maxRegularTextScaleFactor;
}
const popupClipper = new ShapeBorderClipper({
  shape: new RoundedSuperellipseBorder({ borderRadius: BorderRadius.circular(13) }),
});
const lightVibrance = ColorFilter.matrix([
  1.74, -0.4, -0.17, 0, 0, -0.26, 1.6, -0.17, 0, 0, -0.26, -0.4, 1.83, 0, 0, 0, 0, 0, 1, 0,
]);
const darkVibrance = ColorFilter.matrix([
  1.39, -0.56, -0.11, 0, 0.3, -0.32, 1.14, -0.11, 0, 0.3, -0.32, -0.56, 1.59, 0, 0.3, 0, 0, 0, 1, 0,
]);

export interface CupertinoPopupSurfaceOptions extends WidgetOptions {
  readonly child: Widget;
  readonly blurSigma?: number;
  readonly isSurfacePainted?: boolean;
}

export class CupertinoPopupSurface extends StatelessWidget {
  static readonly defaultBlurSigma = 30;
  static debugIsVibrancePainted = true;
  readonly child: Widget;
  readonly blurSigma: number;
  readonly isSurfacePainted: boolean;

  constructor({
    child,
    key = null,
    blurSigma = CupertinoPopupSurface.defaultBlurSigma,
    isSurfacePainted = true,
  }: CupertinoPopupSurfaceOptions) {
    super(key);
    invariant(
      Number.isFinite(blurSigma) && blurSigma >= 0,
      'invalid-popup-blur',
      'CupertinoPopupSurface blurSigma must be nonnegative',
    );
    this.child = child;
    this.blurSigma = blurSigma;
    this.isSurfacePainted = isSurfacePainted;
  }

  override build(context: BuildContext): Widget {
    const vibrance =
      !FoundationBuildMode.debug || CupertinoPopupSurface.debugIsVibrancePainted
        ? CupertinoTheme.maybeBrightnessOf(context) === 'dark'
          ? darkVibrance
          : lightVibrance
        : null;
    const blur =
      this.blurSigma === 0
        ? null
        : ImageFilter.blur({ sigmaX: this.blurSigma, sigmaY: this.blurSigma });
    const filter =
      blur && vibrance ? ImageFilter.compose({ outer: blur, inner: vibrance }) : (blur ?? vibrance);
    const surface = this.isSurfacePainted
      ? new ColoredBox({
          child: this.child,
          color: CupertinoDynamicColor.resolve(dialogSurface, context).toARGB32(),
        })
      : this.child;
    return new ClipPath(filter ? new BackdropFilter({ filter, child: surface }) : surface, {
      clipper: popupClipper,
    });
  }
}

export interface CupertinoDialogActionOptions extends WidgetOptions {
  readonly child: Widget;
  readonly onPressed?: (() => void) | null;
  readonly isDefaultAction?: boolean;
  readonly isDestructiveAction?: boolean;
  readonly textStyle?: TextStyle | null;
  readonly mouseCursor?: MouseCursor | null;
  readonly id?: string;
}

export class CupertinoDialogAction extends StatefulWidget {
  readonly options: Readonly<CupertinoDialogActionOptions>;

  constructor(options: CupertinoDialogActionOptions) {
    super(options.key ?? null);
    this.options = Object.freeze({ ...options });
  }
  override createState(): State<CupertinoDialogAction> {
    return new DialogActionState();
  }
}

class DialogActionState extends State<CupertinoDialogAction> implements DialogSlideTarget {
  private readonly control = new GlobalKey<ControlInteractionState>(
    'Cupertino dialog action',
    ControlInteractionState,
  );

  didEnter(_fromPointerDown: boolean, innerEnabled: boolean): boolean {
    return innerEnabled && this.widget.options.onPressed != null;
  }

  didLeave(): void {}

  didConfirm(): void {
    this.control.currentState?.activateControl();
  }

  override build(context: BuildContext): Widget {
    const {
      child,
      onPressed = null,
      isDefaultAction,
      isDestructiveAction,
      mouseCursor,
      textStyle,
      id,
    } = this.widget.options;
    const scope = context.maybeDependOn(DialogSlideScope);
    const theme = CupertinoTheme.of(context);
    const color = isDestructiveAction
      ? CupertinoDynamicColor.resolve(CupertinoColors.systemRed, context)
      : new Color(theme.primaryColor);
    let style = dialogActionStyle.copyWith({ color: color.toARGB32() }).merge(textStyle);
    if (isDefaultAction) style = style.copyWith({ fontWeight: FontWeight.w600 });
    if (!onPressed)
      style = style.copyWith({ color: new Color(style.color!).withOpacity(0.5).toARGB32() });
    const scaler = MediaQuery.maybeTextScalerOf(context);
    const large = accessibilityMode(context);
    const fontSize = style.fontSize || dialogActionStyle.fontSize!;
    const scaledSize = scaler?.scale(fontSize) ?? fontSize;
    const padding = (8 * scaledSize) / fontSize;
    const text = new DefaultTextStyle(
      style,
      child,
      large ? { textAlign: 'center' } : { textAlign: 'center', maxLines: 1, overflow: 'ellipsis' },
    );
    const regularWidth =
      (Math.max(0, dialogWidth - 2 * padding) * scaledSize) / dialogMinButtonFontSize;
    const content = large
      ? text
      : new FittedBox(new ConstrainedBox(text, new BoxConstraints(0, regularWidth)), {
          fit: 'scaleDown',
        });
    const body = new ConstrainedBox(
      new Padding(EdgeInsets.all(padding), new Center(content, { heightFactor: 1 })),
      new BoxConstraints(0, Infinity, dialogMinButtonHeight),
    );
    const focusColor = CupertinoDynamicColor.resolve(CupertinoColors.activeBlue, context)
      .withOpacity(0.12)
      .toARGB32();
    const pressedColor = CupertinoDynamicColor.resolve(dialogPressedSurface, context).toARGB32();
    return dialogSlideRegion(
      scope,
      this,
      new ControlInteraction(
        (_context, state) =>
          new ColoredBox({
            child: body,
            color: state.pressed ? pressedColor : state.showFocusHighlight ? focusColor : 0,
          }),
        {
          key: this.control,
          onPressed,
          enabled: onPressed !== null,
          pointerGesturesEnabled: !scope,
          requestFocusOnPointer: false,
          semantics: { button: true, identifier: id ?? null, transportId: id ?? null },
          mouseCursor:
            mouseCursor ??
            (onPressed && FoundationPlatform.isWeb ? SystemMouseCursors.click : MouseCursor.defer),
        },
      ),
    );
  }
}

export interface CupertinoAlertDialogOptions extends WidgetOptions {
  readonly title?: Widget | null;
  readonly content?: Widget | null;
  readonly actions?: readonly Widget[];
  readonly scrollController?: ScrollController | null;
  readonly actionScrollController?: ScrollController | null;
  readonly insetAnimationDuration?: number;
  readonly insetAnimationCurve?: Curve;
}

export class CupertinoAlertDialog extends StatefulWidget {
  readonly title: Widget | string | null;
  readonly content: Widget | null;
  readonly onClose: (() => void) | null;
  readonly options: Readonly<CupertinoAlertDialogOptions>;

  constructor(options?: CupertinoAlertDialogOptions);
  constructor(title: string, content: Widget, onClose: () => void);
  constructor(
    optionsOrTitle: CupertinoAlertDialogOptions | string = {},
    content?: Widget,
    onClose?: () => void,
  ) {
    const options: CupertinoAlertDialogOptions =
      typeof optionsOrTitle === 'string'
        ? {
            title: new Text(optionsOrTitle),
            content: content ?? null,
            actions: [
              new CupertinoDialogAction({
                child: new Text('Close'),
                onPressed: onClose ?? null,
                id: 'cupertino-dialog-close',
              }),
            ],
          }
        : optionsOrTitle;
    super(options.key ?? null);
    this.title = typeof optionsOrTitle === 'string' ? optionsOrTitle : (options.title ?? null);
    this.content = options.content ?? null;
    this.onClose = onClose ?? null;
    this.options = Object.freeze({
      ...options,
      actions: Object.freeze([...(options.actions ?? [])]),
    });
  }

  override createState(): State<CupertinoAlertDialog> {
    return new AlertDialogState();
  }
}

class AlertDialogState extends State<CupertinoAlertDialog> {
  private contentController?: ScrollController;
  private actionController?: ScrollController;
  private pressedIndex: number | null = null;

  override dispose(): void {
    this.contentController?.dispose();
    this.actionController?.dispose();
    super.dispose();
  }

  private highlight(index: number, pressed: boolean): void {
    if (!this.mounted || !(this.context as Element).active) return;
    const next = pressed ? index : this.pressedIndex === index ? null : this.pressedIndex;
    if (this.pressedIndex !== next)
      this.setState(() => {
        this.pressedIndex = next;
      });
  }

  private buildContent(context: BuildContext, color: number): Widget | null {
    const { title, content, scrollController } = this.widget.options;
    if (!title && !content) return null;
    const scale = MediaQuery.textScalerOf(context).scale(14) / 14;
    const textColor = CupertinoDynamicColor.resolve(CupertinoColors.label, context).toARGB32();
    const children: Widget[] = [];
    if (title)
      children.push(
        new Padding(
          EdgeInsets.fromLTRB(
            dialogEdgePadding,
            dialogEdgePadding * scale,
            dialogEdgePadding,
            content ? 1 : dialogEdgePadding,
          ),
          new DefaultTextStyle(dialogTitleStyle.copyWith({ color: textColor }), title, {
            textAlign: 'center',
          }),
        ),
      );
    if (content)
      children.push(
        new Padding(
          EdgeInsets.fromLTRB(
            dialogEdgePadding,
            title ? 1 : dialogEdgePadding,
            dialogEdgePadding,
            dialogEdgePadding * scale,
          ),
          new DefaultTextStyle(dialogContentStyle.copyWith({ color: textColor }), content, {
            textAlign: 'center',
          }),
        ),
      );
    const controller = scrollController ?? (this.contentController ??= new ScrollController());
    return new ColoredBox({
      color,
      child: dialogScroll(controller, new Column(children, dialogColumn)),
    });
  }

  private buildActions(
    context: BuildContext,
    background: number,
    separator: number,
  ): Widget | null {
    const { actions = [], actionScrollController } = this.widget.options;
    if (actions.length === 0) return null;
    const pressed = CupertinoDynamicColor.resolve(dialogPressedSurface, context).toARGB32();
    const children = actions.flatMap((action, index) => [
      ...(index === 0
        ? []
        : [
            dialogDivider(
              this.pressedIndex === index - 1 || this.pressedIndex === index
                ? background
                : separator,
            ),
          ]),
      new DialogActionBackground(action, background, pressed, (value) =>
        this.highlight(index, value),
      ),
    ]);
    const controller = actionScrollController ?? (this.actionController ??= new ScrollController());
    return new DialogOverscrollBackground(
      background,
      dialogScroll(controller, new DialogActionsLayout(children)),
    );
  }

  private buildBody(context: BuildContext, constraints: BoxConstraints): Widget {
    const background = CupertinoDynamicColor.resolve(dialogSurface, context).toARGB32();
    const separator = CupertinoDynamicColor.resolve(CupertinoColors.separator, context).toARGB32();
    const content = this.buildContent(context, background);
    const actions = this.buildActions(context, background, separator);
    if (!content || !actions) return content ?? actions ?? SizedBox.shrink();
    const reserve = accessibilityMode(context)
      ? constraints.maxHeight / 2
      : dialogActionsSectionMinHeight;
    return new PriorityDialogColumn(
      content,
      new Column([dialogDivider(separator), new Flexible(actions)], dialogColumn),
      reserve + dialogDividerThickness,
    );
  }

  override build(context: BuildContext): Widget {
    const label = CupertinoLocalizations.of(context).alertDialogLabel;
    const { insetAnimationDuration = 100, insetAnimationCurve = Curves.decelerate } =
      this.widget.options;
    return new CupertinoUserInterfaceLevel({
      data: CupertinoUserInterfaceLevelData.elevated,
      child: MediaQuery.withClampedTextScaling({
        minScaleFactor: 1,
        child: new ScrollConfiguration({
          behavior: ScrollConfiguration.of(context).copyWith({ scrollbars: false }),
          child: new Builder(
            (innerContext) =>
              new AnimatedPadding({
                padding: MediaQuery.viewInsetsOf(innerContext).add(
                  EdgeInsets.symmetric({ horizontal: 40, vertical: 24 }),
                ),
                duration: insetAnimationDuration,
                curve: insetAnimationCurve,
                child: MediaQuery.removeViewInsets({
                  context: innerContext,
                  ...clearInsets,
                  child: new Center(
                    new Padding(
                      EdgeInsets.symmetric({ vertical: dialogEdgePadding }),
                      new SizedBox(
                        accessibilityMode(innerContext) ? accessibilityDialogWidth : dialogWidth,
                        undefined,
                        new DialogSlidingActions(
                          new CupertinoPopupSurface({
                            isSurfacePainted: false,
                            child: new Semantics({
                              role: SemanticsRole.alertDialog,
                              scopesRoute: true,
                              namesRoute: true,
                              explicitChildNodes: true,
                              label,
                              child: new Builder((bodyContext) =>
                                MediaQuery.removePadding({
                                  context: bodyContext,
                                  ...clearInsets,
                                  child: new LayoutBuilder((layoutContext, constraints) =>
                                    this.buildBody(layoutContext, constraints),
                                  ),
                                }),
                              ),
                            }),
                          }),
                        ),
                      ),
                    ),
                  ),
                }),
              }),
          ),
        }),
      }),
    });
  }
}

function dialogScroll(controller: ScrollController, content: Widget): Widget {
  return new CupertinoScrollbar({
    controller,
    child: new SingleBoxScrollView({
      controller,
      primary: false,
      child: content,
    }),
  });
}
