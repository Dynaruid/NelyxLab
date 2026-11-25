// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from packages/flutter/lib/src/cupertino/dialog.dart at
// 71e4717a61786faab4c7aa39825989305ed29e8a.
import { invariant } from '@nelyx/core/foundation/errors';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { RoundedSuperellipseBorder } from '@nelyx/core/framework/painting/rounded-superellipse-border';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { ShapeBorderClipper } from '@nelyx/core/framework/rendering/shape-border-clipper';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { BackdropFilter } from '@nelyx/core/framework/widgets/backdrop-filter';
import {
  Align,
  Builder,
  Center,
  Column,
  ConstrainedBox,
  DecoratedBox,
  Flexible,
  Padding,
  SizedBox,
} from '@nelyx/core/framework/widgets/basic';
import { ClipPath } from '@nelyx/core/framework/widgets/clip';
import {
  ControlInteraction,
  ControlInteractionState,
} from '@nelyx/core/framework/widgets/control-interaction';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import type { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { Element, State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { SafeArea } from '@nelyx/core/framework/widgets/safe-area';
import { ScrollConfiguration } from '@nelyx/core/framework/widgets/scroll-configuration';
import { ScrollController } from '@nelyx/core/framework/widgets/scroll-controller';
import { SingleBoxScrollView } from '@nelyx/core/framework/widgets/scroll-view';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { MouseCursor, SystemMouseCursors } from '@nelyx/core/services/mouse-cursor';
import { ImageFilter } from '@nelyx/core/ui/image-filter';
import { Radius } from '@nelyx/core/ui/radius';
import { SemanticsRole } from '@nelyx/core/ui/semantics';
import { FontWeight } from '@nelyx/core/ui/typography';
import { CupertinoColors } from './colors.ts';
import { kCupertinoButtonSizeBorderRadius } from './constants.ts';
import { CupertinoFocusHalo } from './cupertino-focus-halo.ts';
import { CupertinoLocalizations } from './cupertino-localizations.ts';
import { CupertinoUserInterfaceLevel, CupertinoUserInterfaceLevelData } from './interface-level.ts';
import type { CupertinoColor } from './internal/colors/color-values.ts';
import { resolveCupertinoColor } from './internal/colors/color-values.ts';
import { CupertinoScrollbar } from './scrollbar.ts';
import { CupertinoTheme } from './theme.ts';
import {
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

const edge = 8;
const cancelButtonPadding = 8;
const actionMinHeight = 57.17;
const actionsSectionMinHeight = 84;
const blur = ImageFilter.blur({ sigmaX: 30, sigmaY: 30 });
const mainClipper = new ShapeBorderClipper({
  shape: new RoundedSuperellipseBorder({ borderRadius: BorderRadius.circular(12) }),
});
const cancelClipper = new ShapeBorderClipper({
  shape: new RoundedSuperellipseBorder({ borderRadius: BorderRadius.circular(14) }),
});
const actionsHaloRadius = kCupertinoButtonSizeBorderRadius.large.copyWith({
  topLeft: Radius.zero,
  topRight: Radius.zero,
});

const palette = {
  light: {
    background: 0xc8fcfcfc,
    pressed: 0xcae0e0e0,
    cancel: 0xffffffff,
    cancelPressed: 0xffececec,
    content: 0x851d1d1d,
    divider: 0xd4c9c9c9,
  },
  dark: {
    background: 0xbe292929,
    pressed: 0xc1515151,
    cancel: 0xff2c2c2c,
    cancelPressed: 0xff494949,
    content: 0x96f1f1f1,
    divider: 0xd57d7d7d,
  },
} as const;

export interface CupertinoActionSheetOptions extends WidgetOptions {
  readonly title?: Widget | null;
  readonly message?: Widget | null;
  readonly actions?: readonly Widget[] | null;
  readonly messageScrollController?: ScrollController | null;
  readonly actionScrollController?: ScrollController | null;
  readonly cancelButton?: Widget | null;
}

export class CupertinoActionSheet extends StatefulWidget {
  readonly options: Readonly<CupertinoActionSheetOptions>;

  constructor(options: CupertinoActionSheetOptions) {
    super(options.key ?? null);
    invariant(
      options.title != null ||
        options.message != null ||
        options.actions != null ||
        options.cancelButton != null,
      'empty-cupertino-action-sheet',
      'An action sheet needs a title, message, actions, or cancel button',
    );
    this.options = Object.freeze({
      ...options,
      ...(options.actions == null ? {} : { actions: Object.freeze([...options.actions]) }),
    });
  }

  override createState(): State<CupertinoActionSheet> {
    return new ActionSheetState();
  }
}

class ActionSheetState extends State<CupertinoActionSheet> {
  private messageController?: ScrollController;
  private actionController?: ScrollController;
  private pressedIndex: number | null = null;

  override dispose(): void {
    this.messageController?.dispose();
    this.actionController?.dispose();
    super.dispose();
  }

  private highlight(index: number, pressed: boolean): void {
    if (!this.mounted || !(this.context as Element).active) return;
    const next = pressed ? index : this.pressedIndex === index ? null : this.pressedIndex;
    if (next !== this.pressedIndex)
      this.setState(() => {
        this.pressedIndex = next;
      });
  }

  override build(context: BuildContext): Widget {
    const { width, height } = MediaQuery.of(context);
    const landscape = width > height;
    const viewTop = MediaQuery.viewPaddingOf(context).top;
    const topRatio = 1 - (5 / 59) * Math.min(1, Math.max(0, (viewTop - 47) / 12));
    return new Align(
      new SafeArea({
        minimum: EdgeInsets.only({
          bottom: Math.max(edge, MediaQuery.viewInsetsOf(context).bottom),
        }),
        child: new Padding(
          new EdgeInsets(
            edge,
            landscape ? edge : Math.max(20, Math.round(topRatio * viewTop)),
            edge,
            0,
          ),
          new SizedBox(
            Math.max(0, Math.min(width, height) - 2 * edge),
            undefined,
            new CupertinoUserInterfaceLevel({
              data: CupertinoUserInterfaceLevelData.elevated,
              child: new Builder((innerContext) => this.buildBody(innerContext)),
            }),
          ),
        ),
      }),
      0,
      1,
    );
  }

  buildBody(context: BuildContext): Widget {
    const {
      title,
      message,
      actions = [],
      cancelButton,
      messageScrollController,
      actionScrollController,
    } = this.widget.options;
    const colors = palette[CupertinoTheme.brightnessOf(context)];
    const rows = actions ?? [];
    const hasContent = title != null || message != null;
    const hasActions = rows.length > 0;
    const children: Widget[] = [];

    if (hasContent || hasActions) {
      const contentController = hasContent
        ? (messageScrollController ?? (this.messageController ??= new ScrollController()))
        : null;
      const content = contentController
        ? new DecoratedBox(
            new CupertinoScrollbar({
              controller: contentController,
              child: new SingleBoxScrollView({
                primary: false,
                padding: new EdgeInsets(16, 13.5, 16, 13.5),
                controller: contentController,
                child: new Column(
                  [
                    ...(title == null ? [] : [contentText(title, colors.content, message != null)]),
                    ...(title != null && message != null ? [new SizedBox(undefined, 4)] : []),
                    ...(message == null
                      ? []
                      : [contentText(message, colors.content, title == null)]),
                  ],
                  sheetColumn,
                ),
              }),
            }),
            colors.background,
          )
        : null;
      const controller = hasActions
        ? (actionScrollController ?? (this.actionController ??= new ScrollController()))
        : null;
      const actionList =
        controller == null
          ? null
          : new DialogOverscrollBackground(
              colors.background,
              CupertinoFocusHalo.withRRect({
                borderRadius: actionsHaloRadius,
                child: new CupertinoScrollbar({
                  controller,
                  child: new SingleBoxScrollView({
                    primary: false,
                    controller,
                    child: new Column(
                      rows.flatMap((row, index) => [
                        ...(index === 0
                          ? []
                          : [
                              dialogDivider(
                                this.pressedIndex === index - 1 || this.pressedIndex === index
                                  ? colors.background
                                  : colors.divider,
                              ),
                            ]),
                        new DialogActionBackground(
                          row,
                          colors.background,
                          colors.pressed,
                          (value) => this.highlight(index, value),
                        ),
                      ]),
                      sheetColumn,
                    ),
                  }),
                }),
              }),
            );
      const main =
        content && actionList
          ? new PriorityDialogColumn(
              content,
              new Column([dialogDivider(colors.divider), new Flexible(actionList)], sheetColumn),
              actionsSectionMinHeight + dialogDividerThickness,
            )
          : (content ?? actionList!);
      children.push(
        new Flexible(
          new ClipPath(new BackdropFilter({ filter: blur, child: main }), {
            clipper: mainClipper,
          }),
        ),
      );
    }

    if (cancelButton != null) {
      if (hasContent || hasActions) children.push(new SizedBox(undefined, cancelButtonPadding));
      children.push(
        CupertinoFocusHalo.withRRect({
          borderRadius: kCupertinoButtonSizeBorderRadius.large,
          child: new ClipPath(
            new DialogActionBackground(cancelButton, colors.cancel, colors.cancelPressed),
            { clipper: cancelClipper },
          ),
        }),
      );
    }
    return new Semantics({
      container: true,
      explicitChildNodes: true,
      scopesRoute: true,
      namesRoute: true,
      role: SemanticsRole.dialog,
      label: CupertinoLocalizations.of(context).alertDialogLabel,
      child: new ScrollConfiguration({
        behavior: ScrollConfiguration.of(context).copyWith({ scrollbars: false }),
        child: new DialogSlidingActions(new Column(children, sheetColumn)),
      }),
    });
  }
}

const sheetColumn = { mainSize: 'min', crossAlign: 'stretch' } as const;

function contentText(child: Widget, color: number, bold: boolean): Widget {
  return new DefaultTextStyle(
    new TextStyle({
      fontFamily: 'CupertinoSystemText',
      inherit: false,
      fontSize: 13,
      fontWeight: bold ? FontWeight.w600 : FontWeight.w400,
      textBaseline: 'alphabetic',
      color,
    }),
    child,
    { textAlign: 'center' },
  );
}

export interface CupertinoActionSheetActionOptions extends WidgetOptions {
  readonly child: Widget;
  readonly onPressed: () => void;
  readonly isDefaultAction?: boolean;
  readonly isDestructiveAction?: boolean;
  readonly focusNode?: FocusNode | null;
  readonly focusColor?: CupertinoColor | null;
  readonly mouseCursor?: MouseCursor;
  readonly id?: string;
  readonly semanticsLabel?: string;
}

export class CupertinoActionSheetAction extends StatefulWidget {
  readonly options: Readonly<CupertinoActionSheetActionOptions>;

  constructor(options: CupertinoActionSheetActionOptions) {
    super(options.key ?? null);
    this.options = Object.freeze({ ...options });
  }
  override createState(): State<CupertinoActionSheetAction> {
    return new ActionSheetActionState();
  }
}

class ActionSheetActionState
  extends State<CupertinoActionSheetAction>
  implements DialogSlideTarget
{
  private readonly control = new GlobalKey<ControlInteractionState>(
    'Cupertino action sheet action',
    ControlInteractionState,
  );

  didEnter(_fromPointerDown: boolean, innerEnabled: boolean): boolean {
    return innerEnabled;
  }
  didLeave(): void {}
  didConfirm(): void {
    this.control.currentState?.activateControl();
  }

  override build(context: BuildContext): Widget {
    const {
      child,
      onPressed,
      isDefaultAction,
      isDestructiveAction,
      focusColor,
      focusNode,
      mouseCursor,
      id,
      semanticsLabel,
    } = this.widget.options;
    const theme = CupertinoTheme.of(context);
    const colors = palette[theme.brightness];
    const scope = context.maybeDependOn(DialogSlideScope);
    const scaler = MediaQuery.maybeTextScalerOf(context);
    const body = scaler?.scale(17) || 17;
    const size =
      body <= 17
        ? 21
        : body <= 19
          ? body + 4
          : body <= 21
            ? (body - 19) / 2 + 23
            : Math.max(24, body);
    const focus = resolveCupertinoColor(focusColor ?? CupertinoColors.activeBlue, context)
      .withOpacity(theme.brightness === 'dark' ? 0.26 : 0.12)
      .toARGB32();
    const text = new TextStyle({
      fontFamily: 'CupertinoSystemDisplay',
      inherit: false,
      textBaseline: 'alphabetic',
      fontSize: (size * 17) / body,
      fontWeight: isDefaultAction ? FontWeight.w600 : FontWeight.w400,
      color: isDestructiveAction
        ? resolveCupertinoColor(CupertinoColors.systemRed, context).toARGB32()
        : theme.primaryColor,
    });
    const bodyWidget = new ConstrainedBox(
      new Center(
        new Padding(
          EdgeInsets.symmetric({ horizontal: 10, vertical: 1.8 + size * 0.4 }),
          new DefaultTextStyle(text, child, { textAlign: 'center' }),
        ),
        { heightFactor: 1 },
      ),
      new BoxConstraints(0, Infinity, actionMinHeight, Infinity),
    );
    return dialogSlideRegion(
      scope,
      this,
      new ControlInteraction(
        (_context, state) =>
          new DecoratedBox(
            state.showFocusHighlight ? new DecoratedBox(bodyWidget, focus) : bodyWidget,
            scope ? 0 : state.pressed ? colors.pressed : colors.background,
          ),
        {
          key: this.control,
          onPressed,
          pointerGesturesEnabled: !scope,
          requestFocusOnPointer: false,
          focusNode: focusNode ?? null,
          mouseCursor:
            mouseCursor ??
            (FoundationPlatform.isWeb ? SystemMouseCursors.click : MouseCursor.defer),
          semantics: {
            button: true,
            label: semanticsLabel ?? null,
            excludeSemantics: semanticsLabel !== undefined,
            identifier: id ?? null,
            transportId: id ?? null,
          },
        },
      ),
    );
  }
}
