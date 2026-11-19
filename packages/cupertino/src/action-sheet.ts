// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from packages/flutter/lib/src/cupertino/dialog.dart at
// 71e4717a61786faab4c7aa39825989305ed29e8a.
import { invariant } from '@nelyx/core/foundation/errors';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
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
import { ClipRRect } from '@nelyx/core/framework/widgets/clip';
import { ControlInteraction } from '@nelyx/core/framework/widgets/control-interaction';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import type { FocusNode } from '@nelyx/core/framework/widgets/focus';
import {
  InheritedWidget,
  State,
  StatefulWidget,
  StatelessWidget,
} from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { LayoutBuilder } from '@nelyx/core/framework/widgets/layout-builder';
import { SafeArea } from '@nelyx/core/framework/widgets/safe-area';
import { ScrollConfiguration } from '@nelyx/core/framework/widgets/scroll-configuration';
import { ScrollController } from '@nelyx/core/framework/widgets/scroll-controller';
import { ListView } from '@nelyx/core/framework/widgets/scroll-view';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import type { MouseCursor } from '@nelyx/core/services/mouse-cursor';
import { Color } from '@nelyx/core/ui/color';
import { ImageFilter } from '@nelyx/core/ui/image-filter';
import { SemanticsRole } from '@nelyx/core/ui/semantics';
import { FontWeight } from '@nelyx/core/ui/typography';
import { CupertinoColors } from './colors.ts';
import { CupertinoUserInterfaceLevel, CupertinoUserInterfaceLevelData } from './interface-level.ts';
import type { CupertinoColor } from './internal/colors/color-values.ts';
import { resolveCupertinoColor } from './internal/colors/color-values.ts';
import { CupertinoScrollbar } from './scrollbar.ts';
import { CupertinoTheme } from './theme.ts';

const edge = 8;
const radius = 12;
const dividerThickness = 0.3;
const actionMinHeight = 57.17;
const actionsSectionMinHeight = 84;
const blur = ImageFilter.blur({ sigmaX: 30, sigmaY: 30 });

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

class ActionSheetSlot extends InheritedWidget {
  constructor(
    readonly cancel: boolean,
    child: Widget,
  ) {
    super(child);
  }
  override updateShouldNotify(old: this): boolean {
    return old.cancel !== this.cancel;
  }
}

class ActionSheetState extends State<CupertinoActionSheet> {
  private messageController?: ScrollController;
  private actionController?: ScrollController;

  override dispose(): void {
    this.messageController?.dispose();
    this.actionController?.dispose();
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
      const content = hasContent
        ? new DecoratedBox(
            new ListView({
              primary: false,
              shrinkWrap: true,
              padding: new EdgeInsets(16, 13.5, 16, 13.5),
              controller:
                messageScrollController ?? (this.messageController ??= new ScrollController()),
              children: [
                ...(title == null ? [] : [contentText(title, colors.content, message != null)]),
                ...(title != null && message != null ? [new SizedBox(undefined, 4)] : []),
                ...(message == null ? [] : [contentText(message, colors.content, title == null)]),
              ],
            }),
            colors.background,
          )
        : null;
      const controller = hasActions
        ? (actionScrollController ?? (this.actionController ??= new ScrollController()))
        : null;
      const divider = () =>
        new SizedBox(undefined, dividerThickness, new DecoratedBox(undefined, colors.divider));
      const actionList =
        controller == null
          ? null
          : new CupertinoScrollbar({
              controller,
              child: new ListView({
                primary: false,
                shrinkWrap: true,
                padding: EdgeInsets.zero,
                controller,
                children: rows.flatMap((row, index) => [
                  ...(index === 0 ? [] : [divider()]),
                  row instanceof CupertinoActionSheetAction
                    ? row
                    : new DecoratedBox(row, colors.background),
                ]),
              }),
            });
      let main: Widget = content ?? actionList!;
      if (content != null && actionList != null) {
        main = new LayoutBuilder((_context, constraints) => {
          // Reserve room for actions before giving the header its scroll viewport.
          const reserve =
            (rows.length === 1 ? actionMinHeight : actionsSectionMinHeight) + dividerThickness;
          return new Column(
            [
              new ConstrainedBox(
                content,
                new BoxConstraints(0, Infinity, 0, Math.max(0, constraints.maxHeight - reserve)),
              ),
              new Flexible(new Column([divider(), new Flexible(actionList)], sheetColumn)),
            ],
            sheetColumn,
          );
        });
      }
      children.push(
        new Flexible(
          new ClipRRect(new BackdropFilter({ filter: blur, child: main }), {
            borderRadius: radius,
          }),
        ),
      );
    }

    if (cancelButton != null) {
      if (hasContent || hasActions) children.push(new SizedBox(undefined, edge));
      children.push(
        new ClipRRect(
          new ActionSheetSlot(
            true,
            cancelButton instanceof CupertinoActionSheetAction
              ? cancelButton
              : new DecoratedBox(cancelButton, colors.cancel),
          ),
          { borderRadius: radius },
        ),
      );
    }
    return new Semantics({
      container: true,
      explicitChildNodes: true,
      scopesRoute: true,
      namesRoute: true,
      role: SemanticsRole.dialog,
      label: 'Alert',
      child: new ScrollConfiguration({
        behavior: ScrollConfiguration.of(context).copyWith({ scrollbars: false }),
        child: new Column(children, sheetColumn),
      }),
    });
  }
}

const sheetColumn = { mainSize: 'min', crossAlign: 'stretch' } as const;

function contentText(child: Widget, color: number, bold: boolean): Widget {
  return new DefaultTextStyle(
    new TextStyle({
      fontFamily: 'CupertinoSystemText',
      fontSize: 13,
      fontWeight: bold ? FontWeight.w600 : FontWeight.w400,
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

export class CupertinoActionSheetAction extends StatelessWidget {
  readonly options: Readonly<CupertinoActionSheetActionOptions>;

  constructor(options: CupertinoActionSheetActionOptions) {
    super(options.key ?? null);
    this.options = Object.freeze({ ...options });
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
    } = this.options;
    const theme = CupertinoTheme.of(context);
    const colors = palette[theme.brightness];
    const cancel = context.maybeDependOn(ActionSheetSlot)?.cancel ?? false;
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
    return new ControlInteraction(
      (_context, state) =>
        new DecoratedBox(
          state.showFocusHighlight ? new DecoratedBox(bodyWidget, focus) : bodyWidget,
          state.pressed
            ? cancel
              ? colors.cancelPressed
              : colors.pressed
            : cancel
              ? colors.cancel
              : colors.background,
        ),
      {
        onPressed,
        focusNode: focusNode ?? null,
        ...(mouseCursor === undefined ? {} : { mouseCursor }),
        semantics: {
          button: true,
          label: semanticsLabel ?? null,
          excludeSemantics: semanticsLabel !== undefined,
          identifier: id ?? null,
          transportId: id ?? null,
        },
      },
    );
  }
}
