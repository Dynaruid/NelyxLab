// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from packages/flutter/lib/src/cupertino/nav_bar.dart at
// 71e4717a61786faab4c7aa39825989305ed29e8a.
import { ObjectKey } from '@nelyx/core/foundation/key';
import { Cubic, Curves } from '@nelyx/core/framework/animation/curves';
import { AlignmentDirectional } from '@nelyx/core/framework/painting/alignment';
import { TextSpan } from '@nelyx/core/framework/painting/text-span';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { RenderBox } from '@nelyx/core/framework/rendering/object';
import { RenderRichParagraph } from '@nelyx/core/framework/rendering/paragraph';
import { RenderRepaintBoundary } from '@nelyx/core/framework/rendering/repaint-boundary';
import { RenderSemanticsAnnotations } from '@nelyx/core/framework/rendering/semantics-annotations';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { Align, Positioned, SizedBox, Stack, Text } from '@nelyx/core/framework/widgets/basic';
import type { TextOptions } from '@nelyx/core/framework/widgets/basic';
import { StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { Hero } from '@nelyx/core/framework/widgets/heroes';
import type { HeroFlightDetails, HeroFlightEndpoint } from '@nelyx/core/framework/widgets/heroes';
import { Navigator, routeOf } from '@nelyx/core/framework/widgets/navigation';
import { Opacity } from '@nelyx/core/framework/widgets/opacity';
import { PageRoute } from '@nelyx/core/framework/widgets/pages';
import { IgnorePointer } from '@nelyx/core/framework/widgets/pointer-blocking';
import { RawImage } from '@nelyx/core/framework/widgets/raw-image';
import { RepaintBoundary } from '@nelyx/core/framework/widgets/repaint-boundary';
import { ExcludeSemantics } from '@nelyx/core/framework/widgets/semantics';
import { AnimatedBuilder } from '@nelyx/core/framework/widgets/transitions';
import { bounds } from '@nelyx/core/ui/geometry';
import type { Rect } from '@nelyx/core/ui/types';
import { CupertinoSheetRoute } from '../sheet.ts';
import { clampedFraction, paintNavBarSurface } from './navigation-bar-layout.ts';
import type { NavBarSurfaceOptions, navBarSurface } from './navigation-bar-layout.ts';

const defaultNavBarHeroTag = Symbol('Cupertino navigation bar');
const topHeaderTransition = new Cubic(0, 0.45, 0.45, 0.98);
const bottomHeaderTransition = new Cubic(0.05, 0.9, 0.9, 0.95);
const parts = [
  'leading',
  'backChevron',
  'backLabel',
  'middle',
  'trailing',
  'title',
  'bottom',
] as const;
export type NavBarPart = (typeof parts)[number];

export class NavigationBarKeys {
  readonly leading = new GlobalKey('Navigation bar leading');
  readonly backChevron = new GlobalKey('Navigation bar back chevron');
  readonly backLabel = new GlobalKey('Navigation bar back label');
  readonly middle = new GlobalKey('Navigation bar middle');
  readonly trailing = new GlobalKey('Navigation bar trailing');
  readonly title = new GlobalKey('Navigation bar large title');
  readonly bottom = new GlobalKey('Navigation bar bottom');
}

export function navigationBarPart(context: BuildContext, child: Widget, key: GlobalKey): Widget {
  return context.services.rasterizer ? new RepaintBoundary(child, key) : child;
}

interface NavigationBarFlightAnchor {
  readonly keys: NavigationBarKeys;
  readonly surface: ReturnType<typeof navBarSurface>;
  readonly options: NavBarSurfaceOptions & {
    readonly transitionBetweenRoutes?: boolean;
    readonly heroTag?: NonNullable<unknown>;
  };
  readonly include: readonly NavBarPart[];
  readonly searchable: boolean;
}

export function navigationBarHero(
  context: BuildContext,
  child: Widget,
  anchor: NavigationBarFlightAnchor,
): Widget {
  const navigator = Navigator.maybeOf(context);
  if (
    anchor.options.transitionBetweenRoutes === false ||
    !navigator ||
    !context.services.rasterizer ||
    CupertinoSheetRoute.hasParentSheet(context) ||
    !Hero.hasController(context, navigator)
  )
    return child;
  const route = routeOf(context);
  if (!(route instanceof PageRoute) || route.fullscreenDialog) return child;
  const tag = anchor.options.heroTag ?? defaultNavBarHeroTag;
  return new Hero({
    key: new ObjectKey(tag),
    tag,
    child: new TransitionableNavigationBar(child, anchor),
    createRectTween: largestRectTween,
    flightShuttleBuilder: buildNavBarFlight,
    useRouteLayout: true,
    useRouteAnimation: true,
    transitionOnUserGestures: true,
  });
}

class TransitionableNavigationBar extends StatelessWidget {
  constructor(
    readonly child: Widget,
    readonly anchor: NavigationBarFlightAnchor,
  ) {
    super();
  }

  override build(): Widget {
    return this.child;
  }
}

function largestRectTween(from: Rect, to: Rect): (progress: number) => Rect {
  const width = Math.max(from.width, to.width);
  const height = Math.max(from.height, to.height);
  return (progress) => ({
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
    width,
    height,
  });
}

interface FlightPart {
  readonly image: Widget;
  readonly rect: Rect;
  readonly text: FlightText | null;
}

interface FlightText {
  readonly value: string;
  readonly style: TextStyle;
  readonly options: TextOptions;
}

function flightText(render: RenderRepaintBoundary): FlightText | null {
  let child = render.child;
  while (child instanceof RenderSemanticsAnnotations) child = child.child;
  if (!(child instanceof RenderRichParagraph)) return null;
  const { span, style, font, scaler, paragraphOptions, painterOptions } = child.config;
  if (!(span instanceof TextSpan) || span.text === null || span.children?.length) return null;
  return {
    value: span.text,
    style: style.merge(span.style).copyWith({ inherit: false }),
    options: {
      font,
      textScaler: scaler,
      direction: painterOptions?.textDirection ?? 'ltr',
      maxLines: painterOptions?.maxLines ?? 1,
      softWrap: paragraphOptions?.softWrap ?? false,
      overflow: paragraphOptions?.overflow ?? 'ellipsis',
      textAlign: painterOptions?.textAlign ?? 'start',
    },
  };
}

interface NavigationBarSnapshot {
  readonly anchor: NavigationBarFlightAnchor;
  readonly rect: Rect;
  readonly pieces: ReadonlyMap<NavBarPart, FlightPart>;
}

function snapshot(
  endpoint: HeroFlightEndpoint,
  details: HeroFlightDetails,
): NavigationBarSnapshot | null {
  const navBar = endpoint.hero.options.child;
  const rasterizer = endpoint.context.services.rasterizer;
  const root = endpoint.context.findRenderObject();
  if (
    !(navBar instanceof TransitionableNavigationBar) ||
    !rasterizer ||
    !(root instanceof RenderBox)
  )
    return null;
  const { anchor } = navBar;
  const pieces = new Map<NavBarPart, FlightPart>();
  const pixelRatio = MediaQuery.devicePixelRatioOf(endpoint.context);
  for (const part of anchor.include) {
    const context = anchor.keys[part].currentContext;
    const render = context?.findRenderObject();
    if (
      !(render instanceof RenderRepaintBoundary) ||
      !render.hasSize ||
      render.size.width <= 0 ||
      render.size.height <= 0
    )
      continue;
    if (!render.canCaptureImage) return null;
    try {
      const image = render.toImageSync({ rasterizer, pixelRatio });
      details.onDispose(() => image.dispose());
      pieces.set(part, {
        image: new RawImage({ image, fit: 'fill', scale: pixelRatio }),
        rect: bounds(render.getTransformTo(root), render.size),
        text:
          part === 'title' || part === 'middle' || part === 'backLabel' ? flightText(render) : null,
      });
    } catch {
      return null;
    }
  }
  return { anchor, rect: endpoint.rect, pieces };
}

function buildNavBarFlight(
  context: BuildContext,
  direction: 'push' | 'pop',
  details: HeroFlightDetails,
): Widget | null {
  const from = snapshot(details.from, details);
  const to = snapshot(details.to, details);
  if (!from || !to) return null;
  const push = direction === 'push';
  const lower = push ? from : to;
  const upper = push ? to : from;
  const sign = Directionality.maybeOf(context) === 'rtl' ? -1 : 1;
  const sameSearchLayout = lower.anchor.searchable && upper.anchor.searchable;
  const backgroundCurve = push
    ? Curves.fastEaseInToSlowEaseOut
    : Curves.fastEaseInToSlowEaseOut.flipped;
  const lowerHeader = push ? bottomHeaderTransition : bottomHeaderTransition.flipped;
  const upperHeader = push ? topHeaderTransition : topHeaderTransition.flipped;
  const lowerTitle = lower.pieces.get('title') ?? lower.pieces.get('middle');
  const upperBackLabel = upper.pieces.get('backLabel');
  return new AnimatedBuilder({
    animation: details.animation,
    builder: () => {
      const progress = push ? details.animation.value : 1 - details.animation.value;
      const motion = details.userGesture ? progress : backgroundCurve.transform(progress);
      const leaving = sign * -lower.rect.width * motion;
      const entering = sign * upper.rect.width * (1 - motion);
      const sourceHeaderProgress = details.userGesture ? progress : lowerHeader.transform(progress);
      const targetHeaderProgress = details.userGesture ? progress : upperHeader.transform(progress);
      const titleStyle =
        lowerTitle?.text && upperBackLabel?.text
          ? TextStyle.lerp(lowerTitle.text.style, upperBackLabel.text.style, progress)
          : null;
      const transitioningTitle =
        lowerTitle && upperBackLabel
          ? titleStyle
            ? titleSlide(lowerTitle.rect, upperBackLabel.rect, progress, sign)
            : lerpRect(lowerTitle.rect, upperBackLabel.rect, progress)
          : null;
      const stack: Widget[] = [background(lower, leaving)];
      for (const part of parts) {
        const piece = lower.pieces.get(part);
        if (!piece) continue;
        const opacity =
          part === 'bottom' && sameSearchLayout ? 1 : fadeOut(progress, lowerFade[part]);
        const offset =
          part === 'bottom'
            ? -sign * lower.rect.width * sourceHeaderProgress
            : part === 'backLabel' || part === 'title' || part === 'middle'
              ? leaving / 2
              : 0;
        stack.push(
          positionedPart(
            piece,
            offset,
            opacity,
            piece === lowerTitle ? transitioningTitle : null,
            piece === lowerTitle ? titleStyle : null,
          ),
        );
      }
      stack.push(background(upper, entering));
      for (const part of parts) {
        const piece = upper.pieces.get(part);
        if (!piece) continue;
        const opacity =
          part === 'bottom' && sameSearchLayout ? 1 : fadeIn(progress, upperFade[part]);
        const offset =
          part === 'bottom'
            ? sign * upper.rect.width * (1 - targetHeaderProgress)
            : part === 'title' || part === 'middle'
              ? entering
              : 0;
        stack.push(
          positionedPart(
            piece,
            offset,
            opacity,
            piece === upperBackLabel ? transitioningTitle : null,
            piece === upperBackLabel ? titleStyle : null,
          ),
        );
      }
      return new ExcludeSemantics(
        new IgnorePointer(new Stack(stack, { fit: 'expand', clipBehavior: 'hardEdge' })),
      );
    },
  });
}

const lowerFade: Readonly<Record<NavBarPart, number>> = {
  leading: 0.4,
  backChevron: 0.6,
  backLabel: 0.2,
  middle: 0.4,
  trailing: 0.6,
  title: 0.4,
  bottom: 0.8,
};
const upperFade: Readonly<Record<NavBarPart, number>> = {
  leading: 0.6,
  backChevron: 0.35,
  backLabel: 0.3,
  middle: 0.25,
  trailing: 0.4,
  title: 0.3,
  bottom: 0,
};

function fadeOut(progress: number, end: number): number {
  return 1 - Curves.easeOut.transform(clampedFraction(progress / end));
}

function fadeIn(progress: number, start: number): number {
  return Curves.easeIn.transform(clampedFraction((progress - start) / (1 - start)));
}

function lerpRect(from: Rect, to: Rect, progress: number): Rect {
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
    width: from.width + (to.width - from.width) * progress,
    height: from.height + (to.height - from.height) * progress,
  };
}

function titleSlide(from: Rect, to: Rect, progress: number, direction: 1 | -1): Rect {
  const rect = lerpRect(from, to, progress);
  const width = Math.max(from.width, to.width);
  const height = Math.max(from.height, to.height);
  return {
    x: direction === 1 ? rect.x : rect.x + rect.width - width,
    y: rect.y + (rect.height - height) / 2,
    width,
    height,
  };
}

function background(snapshot: NavigationBarSnapshot, left: number): Widget {
  return new Positioned(
    paintNavBarSurface(new SizedBox(), snapshot.anchor.surface, snapshot.anchor.options, false),
    { left, top: 0, width: snapshot.rect.width, height: snapshot.rect.height },
  );
}

function positionedPart(
  piece: FlightPart,
  offset: number,
  opacity: number,
  movement: Rect | null,
  style: TextStyle | null,
): Widget {
  const { x, y, width, height } = movement ?? piece.rect;
  const child =
    style && piece.text
      ? new Align(new Text(piece.text.value, { ...piece.text.options, style }), {
          alignment: AlignmentDirectional.centerStart,
        })
      : piece.image;
  return new Positioned(new Opacity(child, { opacity }), {
    left: x + (movement ? 0 : offset),
    top: y,
    width,
    height,
  });
}
