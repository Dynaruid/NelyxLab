// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/banner.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { invariant } from '@nelyx/core/foundation/errors';
import type { Key } from '@nelyx/core/foundation/key';
import { AnimationStatus } from '@nelyx/core/framework/animation/animation';
import type { Animation } from '@nelyx/core/framework/animation/animation';
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import { Curves } from '@nelyx/core/framework/animation/curves';
import type { TickerProvider } from '@nelyx/core/framework/animation/ticker';
import { AlignmentDirectional } from '@nelyx/core/framework/painting/alignment';
import { EdgeInsets, EdgeInsetsDirectional } from '@nelyx/core/framework/painting/edge-insets';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import type { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import {
  Align,
  Column,
  ConstrainedBox,
  Expanded,
  Padding,
  Row,
} from '@nelyx/core/framework/widgets/basic';
import { ClipRect } from '@nelyx/core/framework/widgets/clip';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import { Element, State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { ListenableBuilder } from '@nelyx/core/framework/widgets/listenable-builder';
import { OverflowBar, OverflowBarAlignment } from '@nelyx/core/framework/widgets/overflow-bar';
import { IgnorePointer } from '@nelyx/core/framework/widgets/pointer-blocking';
import { SafeArea } from '@nelyx/core/framework/widgets/safe-area';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { Color } from '@nelyx/core/ui/color';
import { Colors } from './colors.ts';
import { Divider } from './divider.ts';
import { Material } from './material.ts';
import { MaterialBannerTheme } from './material-banner-theme.ts';
import { Durations } from './motion.ts';
import { ScaffoldMessenger } from './scaffold-messenger.ts';
import { Theme } from './theme.ts';

const bannerClosedReasonToken = Symbol();
export class MaterialBannerClosedReason {
  static readonly dismiss = new MaterialBannerClosedReason(0, 'dismiss', bannerClosedReasonToken);
  static readonly swipe = new MaterialBannerClosedReason(1, 'swipe', bannerClosedReasonToken);
  static readonly hide = new MaterialBannerClosedReason(2, 'hide', bannerClosedReasonToken);
  static readonly remove = new MaterialBannerClosedReason(3, 'remove', bannerClosedReasonToken);
  static readonly values = Object.freeze([this.dismiss, this.swipe, this.hide, this.remove]);

  private constructor(
    readonly index: number,
    readonly name: 'dismiss' | 'swipe' | 'hide' | 'remove',
    token: typeof bannerClosedReasonToken,
  ) {
    invariant(
      token === bannerClosedReasonToken,
      'invalid-banner-close-reason',
      'Use a MaterialBannerClosedReason value',
    );
    Object.freeze(this);
  }
  toString(): string {
    return `MaterialBannerClosedReason.${this.name}`;
  }
}

export interface MaterialBannerOptions extends WidgetOptions {
  readonly content: Widget;
  readonly contentTextStyle?: TextStyle | null;
  readonly actions: readonly Widget[];
  readonly elevation?: number | null;
  readonly leading?: Widget | null;
  readonly backgroundColor?: Color | null;
  readonly surfaceTintColor?: Color | null;
  readonly shadowColor?: Color | null;
  readonly dividerColor?: Color | null;
  readonly padding?: EdgeInsetsGeometry | null;
  readonly margin?: EdgeInsetsGeometry | null;
  readonly leadingPadding?: EdgeInsetsGeometry | null;
  readonly forceActionsBelow?: boolean;
  readonly overflowAlignment?: OverflowBarAlignment;
  readonly animation?: Animation<number> | null;
  readonly onVisible?: (() => void) | null;
  readonly minActionBarHeight?: number;
}

const inlinePadding = EdgeInsetsDirectional.only({ start: 16, top: 2 });
const stackedPadding = EdgeInsetsDirectional.only({ start: 16, top: 24, end: 16, bottom: 4 });
const iconPadding = EdgeInsetsDirectional.only({ end: 16 });
const actionsPadding = EdgeInsets.symmetric({ horizontal: 8 });
const elevatedMargin = EdgeInsets.only({ bottom: 10 });
const maxContentTextScaleFactor = 1.5;

export class MaterialBanner extends StatefulWidget {
  readonly options: Readonly<MaterialBannerOptions>;

  constructor(options: MaterialBannerOptions) {
    super(options.key ?? null);
    invariant(
      options.actions.length > 0,
      'empty-banner-actions',
      'MaterialBanner needs at least one action',
    );
    invariant(
      options.elevation == null || options.elevation >= 0,
      'invalid-banner-elevation',
      'MaterialBanner elevation must be nonnegative',
    );
    this.options = Object.freeze({ ...options, actions: Object.freeze([...options.actions]) });
  }
  get elevation(): number | null {
    return this.options.elevation ?? null;
  }
  static createAnimationController({
    vsync,
  }: {
    readonly vsync: TickerProvider;
  }): AnimationController {
    return new AnimationController({
      vsync,
      duration: Durations.medium1,
      debugLabel: 'MaterialBanner',
    });
  }
  withAnimation(
    animation: Animation<number>,
    { fallbackKey = null }: { readonly fallbackKey?: Key | null } = {},
  ): MaterialBanner {
    return new MaterialBanner({ ...this.options, animation, key: this.key ?? fallbackKey });
  }
  override createState(): State<MaterialBanner> {
    return new MaterialBannerState();
  }
}

class MaterialBannerState extends State<MaterialBanner> {
  private wasVisible = false;
  private viewAnimation: Animation<number> | null = null;

  private readonly statusChanged = (status: AnimationStatus): void => {
    if (status !== AnimationStatus.completed || this.wasVisible) return;
    const animation = this.viewAnimation;
    (this.context as Element).owner.postFrame(() => {
      if (
        !this.mounted ||
        this.wasVisible ||
        animation !== this.viewAnimation ||
        animation?.status !== AnimationStatus.completed
      )
        return;
      this.wasVisible = true;
      this.widget.options.onVisible?.();
    });
  };
  private connect(): void {
    const next = this.widget.options.animation ?? null;
    if (next === this.viewAnimation) return;
    this.viewAnimation?.removeStatusListener(this.statusChanged);
    this.viewAnimation = next;
    next?.addStatusListener(this.statusChanged);
    if (next) this.statusChanged(next.status);
  }
  override initState(): void {
    super.initState();
    this.connect();
  }
  override didUpdateWidget(old: MaterialBanner): void {
    super.didUpdateWidget(old);
    this.connect();
  }
  override dispose(): void {
    this.viewAnimation?.removeStatusListener(this.statusChanged);
    super.dispose();
  }
  override build(context: BuildContext): Widget {
    const options = this.widget.options;
    const theme = Theme.of(context);
    const bannerTheme = MaterialBannerTheme.of(context);
    const inline = options.actions.length === 1 && !options.forceActionsBelow;
    const elevation = options.elevation ?? bannerTheme.elevation ?? 0;
    const style =
      options.contentTextStyle ?? bannerTheme.contentTextStyle ?? theme.textTheme.bodyMedium!;
    const actions = new ConstrainedBox(
      new Padding(
        actionsPadding,
        new Align(
          new OverflowBar({
            children: options.actions,
            spacing: 8,
            overflowAlignment: options.overflowAlignment ?? OverflowBarAlignment.end,
          }),
          { alignment: AlignmentDirectional.centerEnd },
        ),
      ),
      new BoxConstraints(0, Infinity, options.minActionBarHeight ?? 52),
    );
    const content = new Padding(
      options.margin ?? (elevation ? elevatedMargin : EdgeInsets.zero),
      new Material({
        color:
          options.backgroundColor ??
          bannerTheme.backgroundColor ??
          new Color(theme.colorScheme.surfaceContainerLow),
        elevation,
        surfaceTintColor:
          options.surfaceTintColor ?? bannerTheme.surfaceTintColor ?? Colors.transparent,
        shadowColor: options.shadowColor ?? bannerTheme.shadowColor,
        child: new Column(
          [
            new Padding(
              options.padding ?? bannerTheme.padding ?? (inline ? inlinePadding : stackedPadding),
              new Row([
                ...(options.leading
                  ? [
                      new Padding(
                        options.leadingPadding ?? bannerTheme.leadingPadding ?? iconPadding,
                        options.leading,
                      ),
                    ]
                  : []),
                new Expanded(
                  MediaQuery.withClampedTextScaling({
                    maxScaleFactor: maxContentTextScaleFactor,
                    child: new DefaultTextStyle(style, options.content),
                  }),
                ),
                ...(inline
                  ? [
                      MediaQuery.withClampedTextScaling({
                        maxScaleFactor: maxContentTextScaleFactor,
                        child: actions,
                      }),
                    ]
                  : []),
              ]),
            ),
            ...(inline ? [] : [actions]),
            ...(elevation === 0
              ? [
                  new Divider({
                    height: 0,
                    color:
                      options.dividerColor ??
                      bannerTheme.dividerColor ??
                      new Color(theme.colorScheme.outlineVariant),
                  }),
                ]
              : []),
          ],
          { mainAxisSize: 'min' },
        ),
      }),
    );
    const animation = this.viewAnimation;
    if (!animation) return content;
    const presented = new Semantics({
      container: true,
      liveRegion: true,
      onDismiss: () =>
        ScaffoldMessenger.maybeOf(context)?.removeCurrentMaterialBanner({
          reason: MaterialBannerClosedReason.dismiss,
        }),
      child: new SafeArea({ child: content }),
    });
    if (MediaQuery.of(context).accessibleNavigation) return presented;
    return new ClipRect(
      new ListenableBuilder(animation, () => {
        const progress = Curves.fastOutSlowIn.transform(animation.value);
        return new Align(new IgnorePointer(presented, { ignoring: progress === 0 }), {
          alignment: AlignmentDirectional.bottomStart,
          heightFactor: progress,
        });
      }),
    );
  }
}
