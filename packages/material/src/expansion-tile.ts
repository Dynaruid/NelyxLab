// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/expansion_tile.dart
// Revision: 71e4717a61786faab4c7aa39825989305ed29e8a
import { invariant } from '@nelyx/core/foundation/errors';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import type { Animation } from '@nelyx/core/framework/animation/animation';
import type { AnimationStyle } from '@nelyx/core/framework/animation/animation-style';
import { Curves } from '@nelyx/core/framework/animation/curves';
import { CurveTween, Tween } from '@nelyx/core/framework/animation/tween';
import { Alignment } from '@nelyx/core/framework/painting/alignment';
import type { AlignmentGeometry } from '@nelyx/core/framework/painting/alignment';
import { BorderSide, ShapeBorder } from '@nelyx/core/framework/painting/borders';
import { Border } from '@nelyx/core/framework/painting/box-border';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import type { CrossAxisAlignment } from '@nelyx/core/framework/rendering/boxes';
import { AccessibilityFocusBlockType } from '@nelyx/core/framework/semantics/semantics';
import { SemanticsService } from '@nelyx/core/framework/semantics/semantics-service';
import { Directionality } from '@nelyx/core/framework/widgets/app-data';
import { Align, Column, Padding } from '@nelyx/core/framework/widgets/basic';
import { Expansible, ExpansibleController } from '@nelyx/core/framework/widgets/expansible';
import { Element, State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { Icon } from '@nelyx/core/framework/widgets/icon';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { RotationTransition } from '@nelyx/core/framework/widgets/transitions';
import type { Clip } from '@nelyx/core/ui/clip';
import { Color } from '@nelyx/core/ui/color';
import { ExpansionTileTheme } from './expansion-tile-theme.ts';
import { Icons } from './icons.ts';
import { ListTile, ListTileControlAffinity } from './list-tile.ts';
import type { ListTileOptions } from './list-tile.ts';
import { ListTileTheme } from './list-tile-theme.ts';
import { MaterialLocalizations } from './material-localizations.ts';
import { Material } from './material.ts';
import { Theme } from './theme.ts';

export { ExpansibleController, ExpansibleController as ExpansionTileController };

const expansionDuration = 200;
const halfTurn = new Tween({ begin: 0, end: 0.5 }).chain(new CurveTween({ curve: Curves.easeIn }));
const transparent = new Color(0);
const transparentSide = new BorderSide({ color: 0 });
const collapsedBorder = new Border({ top: transparentSide, bottom: transparentSide });

export interface ExpansionTileOptions
  extends
    WidgetOptions,
    Pick<
      ListTileOptions,
      | 'leading'
      | 'subtitle'
      | 'trailing'
      | 'dense'
      | 'splashColor'
      | 'visualDensity'
      | 'minTileHeight'
      | 'enableFeedback'
      | 'enabled'
      | 'internalAddSemanticForOnTap'
      | 'statesController'
    > {
  readonly title: Widget;
  readonly children?: readonly Widget[];
  readonly onExpansionChanged?: ((expanded: boolean) => void) | null;
  readonly showTrailingIcon?: boolean;
  readonly initiallyExpanded?: boolean;
  readonly maintainState?: boolean;
  readonly tilePadding?: EdgeInsetsGeometry | null;
  readonly expandedCrossAxisAlignment?: CrossAxisAlignment | null;
  readonly expandedAlignment?: AlignmentGeometry | null;
  readonly childrenPadding?: EdgeInsetsGeometry | null;
  readonly backgroundColor?: Color | null;
  readonly collapsedBackgroundColor?: Color | null;
  readonly textColor?: Color | null;
  readonly collapsedTextColor?: Color | null;
  readonly iconColor?: Color | null;
  readonly collapsedIconColor?: Color | null;
  readonly shape?: ShapeBorder | null;
  readonly collapsedShape?: ShapeBorder | null;
  readonly clipBehavior?: Clip | null;
  readonly controlAffinity?: ListTileControlAffinity | null;
  readonly controller?: ExpansibleController | null;
  readonly expansionAnimationStyle?: AnimationStyle | null;
}

export class ExpansionTile extends StatefulWidget {
  readonly options: Readonly<ExpansionTileOptions>;
  readonly title: Widget;
  readonly children: readonly Widget[];
  readonly controller: ExpansibleController | null;

  constructor(options: ExpansionTileOptions) {
    super(options.key ?? null);
    invariant(
      options.expandedCrossAxisAlignment !== 'baseline',
      'invalid-expansion-tile-alignment',
      'ExpansionTile children use a vertical Column',
    );
    this.title = options.title;
    this.children = Object.freeze([...(options.children ?? [])]);
    this.controller = options.controller ?? null;
    this.options = Object.freeze({ ...options, children: this.children });
  }
  override createState(): State<ExpansionTile> {
    return new ExpansionTileState();
  }
}

class ExpansionTileState extends State<ExpansionTile> {
  private controller!: ExpansibleController;
  private cancelAnnouncement: (() => void) | null = null;
  private readonly expansionChanged = (): void => {
    const expanded = this.controller.isExpanded;
    const announceAndNotify = () => {
      if (!this.mounted || this.controller.isExpanded !== expanded) return;
      this.announce(expanded);
      this.widget.options.onExpansionChanged?.(expanded);
    };
    const context = this.context;
    if (context instanceof Element && context.owner.building)
      context.owner.postFrame(announceAndNotify);
    else announceAndNotify();
  };

  override initState(): void {
    super.initState();
    this.controller = this.widget.controller ?? new ExpansibleController();
    if (this.widget.options.initiallyExpanded) this.controller.expand();
    this.controller.addListener(this.expansionChanged);
  }

  override didUpdateWidget(old: ExpansionTile): void {
    super.didUpdateWidget(old);
    if (this.widget.controller === old.controller) return;
    this.controller.removeListener(this.expansionChanged);
    if (!old.controller) this.controller.dispose();
    this.controller = this.widget.controller ?? new ExpansibleController();
    this.controller.addListener(this.expansionChanged);
  }

  private announce(expanded: boolean): void {
    this.cancelAnnouncement?.();
    this.cancelAnnouncement = null;
    const platform = FoundationPlatform.defaultTargetPlatform;
    const context = this.context;
    const { platformView } = context.services;
    if (platform === 'android' || !platformView) return;
    const strings = MaterialLocalizations.of(context);
    const direction = Directionality.of(context);
    const message = expanded ? strings.collapsedHint : strings.expandedHint;
    const send = () => {
      this.cancelAnnouncement = null;
      if (this.mounted)
        void SemanticsService.sendAnnouncement(platformView, message, direction).catch((error) =>
          context.services.reportError?.(error),
        );
    };
    if (platform === 'iOS') {
      const host = globalThis as unknown as {
        setTimeout?: (callback: () => void, delay: number) => unknown;
        clearTimeout?: (handle: unknown) => void;
      };
      if (host.setTimeout && host.clearTimeout) {
        const handle = host.setTimeout(send, 1000);
        this.cancelAnnouncement = () => host.clearTimeout!(handle);
        return;
      }
    }
    send();
  }

  private readonly buildHeader = (context: BuildContext, animation: Animation<number>): Widget => {
    const options = this.widget.options;
    const local = ExpansionTileTheme.of(context);
    const colors = Theme.of(context).colorScheme;
    const progress = Curves.easeIn.transform(animation.value);
    const iconColor = Color.lerp(
      options.collapsedIconColor ?? local.collapsedIconColor ?? new Color(colors.onSurfaceVariant),
      options.iconColor ?? local.iconColor ?? new Color(colors.primary),
      progress,
    );
    const surfaceText = new Color(colors.onSurface);
    const textColor = Color.lerp(
      options.collapsedTextColor ?? local.collapsedTextColor ?? surfaceText,
      options.textColor ?? local.textColor ?? surfaceText,
      progress,
    );
    const expanded = this.controller.isExpanded;
    const affinity =
      options.controlAffinity ??
      ListTileTheme.of(context).controlAffinity ??
      ListTileControlAffinity.trailing;
    const arrow = new RotationTransition({
      turns: animation.drive(halfTurn),
      child: new Icon(Icons.expand_more),
    });
    const strings = MaterialLocalizations.of(context);
    const stateHint = expanded ? strings.collapsedHint : strings.expandedHint;
    const platform = FoundationPlatform.defaultTargetPlatform;
    const isApple = platform === 'iOS' || platform === 'macOS';
    const child = new Semantics({
      expanded,
      hint: isApple
        ? stateHint +
          '\n ' +
          (expanded ? strings.expansionTileExpandedHint : strings.expansionTileCollapsedHint)
        : stateHint,
      onTapHint: expanded
        ? strings.expansionTileExpandedTapHint
        : strings.expansionTileCollapsedTapHint,
      child: new ListTile({
        title: this.widget.title,
        subtitle: options.subtitle ?? null,
        leading: options.leading ?? (affinity === ListTileControlAffinity.leading ? arrow : null),
        trailing:
          options.showTrailingIcon === false
            ? null
            : (options.trailing ?? (affinity === ListTileControlAffinity.leading ? null : arrow)),
        onTap: () => this.controller.toggle(),
        dense: options.dense ?? null,
        visualDensity: options.visualDensity ?? null,
        splashColor: options.splashColor ?? null,
        contentPadding: options.tilePadding ?? local.tilePadding,
        minTileHeight: options.minTileHeight ?? null,
        enableFeedback: options.enableFeedback ?? true,
        enabled: options.enabled ?? true,
        internalAddSemanticForOnTap: options.internalAddSemanticForOnTap ?? false,
        statesController: options.statesController ?? null,
        iconColor,
        textColor,
      }),
    });
    return platform === 'android'
      ? new Semantics({
          label: stateHint,
          liveRegion: true,
          accessibilityFocusBlockType: AccessibilityFocusBlockType.blockNode,
          child,
        })
      : child;
  };

  override build(context: BuildContext): Widget {
    const options = this.widget.options;
    const local = ExpansionTileTheme.of(context);
    const theme = Theme.of(context);
    const explicitShape = options.shape ?? local.shape;
    const explicitCollapsedShape = options.collapsedShape ?? local.collapsedShape;
    const dividerSide = new BorderSide({ color: theme.dividerColor.toARGB32() });
    const expandedBorder = explicitShape ?? new Border({ top: dividerSide, bottom: dividerSide });
    const style = options.expansionAnimationStyle;
    return new Expansible({
      controller: this.controller,
      duration: style?.duration ?? local.expansionAnimationStyle?.duration ?? expansionDuration,
      curve: style?.curve ?? local.expansionAnimationStyle?.curve ?? Curves.easeIn,
      reverseCurve: style?.reverseCurve ?? local.expansionAnimationStyle?.reverseCurve ?? null,
      maintainState: options.maintainState ?? false,
      headerBuilder: this.buildHeader,
      bodyBuilder: () =>
        new Align(
          new Padding(
            options.childrenPadding ?? local.childrenPadding ?? EdgeInsets.zero,
            new Column(this.widget.children, {
              mainAxisSize: 'min',
              crossAxisAlignment: options.expandedCrossAxisAlignment ?? 'center',
            }),
          ),
          { alignment: options.expandedAlignment ?? local.expandedAlignment ?? Alignment.center },
        ),
      expansibleBuilder: (_context, header, body, animation) => {
        const progress = Curves.easeOut.transform(animation.value);
        const shape = ShapeBorder.lerp(
          explicitCollapsedShape ?? collapsedBorder,
          expandedBorder,
          progress,
        )!;
        const background = Color.lerp(
          options.collapsedBackgroundColor ?? local.collapsedBackgroundColor ?? transparent,
          options.backgroundColor ?? local.backgroundColor ?? transparent,
          progress,
        )!;
        return new Material({
          color: background,
          shape,
          animationDuration: 0,
          clipBehavior:
            explicitShape || explicitCollapsedShape
              ? (options.clipBehavior ?? local.clipBehavior ?? 'antiAlias')
              : 'none',
          child: new Padding(shape.dimensions, new Column([header, body], { mainAxisSize: 'min' })),
        });
      },
    });
  }

  override dispose(): void {
    this.cancelAnnouncement?.();
    this.controller.removeListener(this.expansionChanged);
    if (!this.widget.controller) this.controller.dispose();
    super.dispose();
  }
}
