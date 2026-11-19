// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import type { Disposable } from '@nelyx/core/foundation/disposable';
import { invariant } from '@nelyx/core/foundation/errors';
import { UniqueKey } from '@nelyx/core/foundation/key';
import { AnimationStatus } from '@nelyx/core/framework/animation/animation';
import type { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import type { AnimationStyle } from '@nelyx/core/framework/animation/animation-style';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { Element, InheritedWidget, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { TickerProviderStateMixin } from '@nelyx/core/framework/widgets/ticker-provider';
import { scrollChromeTimer } from '@nelyx/core/internal/framework/widgets/scroll-chrome-timers';
import { MaterialBanner, MaterialBannerClosedReason } from './banner.ts';
import { SnackBar, SnackBarClosedReason } from './snack-bar.ts';

export class ScaffoldFeatureController<T extends Widget, R> {
  constructor(
    readonly feature: T,
    readonly closed: Promise<R>,
    readonly close: () => void,
    readonly setState: ((mutation: () => void) => void) | null = null,
  ) {}
}

export interface ScaffoldMessengerOptions extends WidgetOptions {
  readonly child: Widget;
}

export class ScaffoldMessenger extends StatefulWidget {
  readonly child: Widget;
  constructor({ child, key = null }: ScaffoldMessengerOptions) {
    super(key);
    this.child = child;
  }

  static maybeOf(context: BuildContext): ScaffoldMessengerState | null {
    return context.maybeDependOn(ScaffoldMessengerScope)?.messenger ?? null;
  }

  static of(context: BuildContext): ScaffoldMessengerState {
    const messenger = this.maybeOf(context);
    invariant(
      messenger,
      'missing-scaffold-messenger',
      'ScaffoldMessenger.of requires a ScaffoldMessenger ancestor',
    );
    return messenger;
  }

  override createState(): ScaffoldMessengerState {
    return new ScaffoldMessengerState();
  }
}

class ScaffoldMessengerScope extends InheritedWidget {
  constructor(
    readonly messenger: ScaffoldMessengerState,
    readonly snack: SnackBar | null,
    readonly banner: MaterialBanner | null,
    child: Widget,
  ) {
    super(child);
  }
  override updateShouldNotify(old: ScaffoldMessengerScope): boolean {
    return (
      this.messenger !== old.messenger || this.snack !== old.snack || this.banner !== old.banner
    );
  }
}

interface SnackPresentation {
  readonly snack: SnackBar;
  readonly style: AnimationStyle | null;
  readonly resolve: (value: SnackBarClosedReason) => void;
}
interface BannerPresentation {
  readonly banner: MaterialBanner;
  readonly resolve: (value: MaterialBannerClosedReason) => void;
}

export interface ShowSnackBarOptions {
  readonly snackBarAnimationStyle?: AnimationStyle | null;
}
export interface CloseSnackBarOptions {
  readonly reason?: SnackBarClosedReason;
}
export interface CloseMaterialBannerOptions {
  readonly reason?: MaterialBannerClosedReason;
}

export class ScaffoldMessengerState extends TickerProviderStateMixin<ScaffoldMessenger> {
  private readonly scaffolds = new Set<object>();
  private readonly presentationSlots = new Map<symbol, Set<number>>();
  private readonly snacks: SnackPresentation[] = [];
  private readonly banners: BannerPresentation[] = [];
  private animation!: AnimationController;
  private bannerAnimation: AnimationController | null = null;
  private timer: Disposable | null = null;
  private closing: SnackBarClosedReason | null = null;
  private closingBanner: MaterialBannerClosedReason | null = null;
  private accessibleNavigation = false;

  /** @internal Each mounted Scaffold registers against its nearest messenger. */
  _registerScaffold(scaffold: object): () => void {
    this.scaffolds.add(scaffold);
    return () => {
      this.scaffolds.delete(scaffold);
    };
  }

  /** @internal Match root Scaffold presentation positions between routes. */
  _reservePresentationSlot(route: symbol): Disposable & { readonly ordinal: number } {
    let occupied = this.presentationSlots.get(route);
    if (!occupied) this.presentationSlots.set(route, (occupied = new Set()));
    let ordinal = 0;
    while (occupied.has(ordinal)) ordinal++;
    occupied.add(ordinal);
    return {
      ordinal,
      dispose: () => {
        if (!occupied.delete(ordinal) || occupied.size > 0) return;
        if (this.presentationSlots.get(route) === occupied) this.presentationSlots.delete(route);
      },
    };
  }

  get currentSnackBar(): SnackBar | null {
    return this.snacks[0]?.snack ?? null;
  }
  get currentMaterialBanner(): MaterialBanner | null {
    return this.banners[0]?.banner ?? null;
  }

  override initState(): void {
    super.initState();
    this.animation = SnackBar.createAnimationController({ vsync: this });
    this.animation.addStatusListener(this.statusChanged);
  }

  showSnackBar(
    snackBar: SnackBar,
    { snackBarAnimationStyle = null }: ShowSnackBarOptions = {},
  ): ScaffoldFeatureController<SnackBar, SnackBarClosedReason> {
    invariant(
      this.mounted && this.scaffolds.size > 0,
      'missing-snack-bar-scaffold',
      'Show a SnackBar from a messenger with a mounted Scaffold',
    );
    const snack = snackBar.withAnimation(this.animation.view, { fallbackKey: new UniqueKey() });
    let resolve!: SnackPresentation['resolve'];
    const closed = new Promise<SnackBarClosedReason>((complete) => {
      resolve = complete;
    });
    const entry: SnackPresentation = { snack, resolve, style: snackBarAnimationStyle };
    const start = this.snacks.length === 0;
    this.setState(() => {
      this.snacks.push(entry);
    });
    if (start) this.startCurrent();
    return new ScaffoldFeatureController(snack, closed, () => this.close(entry));
  }

  hideCurrentSnackBar({ reason = SnackBarClosedReason.hide }: CloseSnackBarOptions = {}): void {
    const active = this.snacks[0];
    if (!active || this.closing) return;
    this.timer?.dispose();
    this.timer = null;
    this.closing = reason;
    if (this.accessibleNavigation || this.animation.isDismissed) this.retireCurrent(reason);
    else this.animation.reverse();
  }

  removeCurrentSnackBar({ reason = SnackBarClosedReason.remove }: CloseSnackBarOptions = {}): void {
    if (this.snacks.length) this.retireCurrent(reason);
  }

  clearSnackBars(): void {
    const pending = this.snacks.splice(1);
    for (const entry of pending) entry.resolve(SnackBarClosedReason.remove);
    this.hideCurrentSnackBar();
  }

  private close(entry: SnackPresentation): void {
    const index = this.snacks.indexOf(entry);
    if (index < 0) return;
    if (index === 0) this.hideCurrentSnackBar();
    else {
      this.snacks.splice(index, 1);
      entry.resolve(SnackBarClosedReason.hide);
    }
  }

  private startCurrent(): void {
    this.animation.value = 0;
    const entry = this.snacks[0];
    if (!entry) return;
    this.animation.duration = entry.style?.duration ?? 250;
    this.animation.reverseDuration = entry.style?.reverseDuration ?? null;
    if (this.accessibleNavigation) this.animation.value = 1;
    else this.animation.forward();
  }

  private retireCurrent(reason: SnackBarClosedReason): void {
    this.timer?.dispose();
    this.timer = null;
    this.closing = null;
    const entry = this.snacks[0]!;
    this.setState(() => {
      this.snacks.shift();
    });
    entry.resolve(reason);
    this.startCurrent();
  }

  private readonly statusChanged = (status: AnimationStatus): void => {
    if (!this.mounted) return;
    const current = this.snacks[0];
    if (!current) return;
    if (status === AnimationStatus.dismissed && this.closing) this.retireCurrent(this.closing);
    if (status === AnimationStatus.completed && !this.timer && !current.snack.persist)
      this.timer = scrollChromeTimer(current.snack.duration, () => {
        if (this.snacks[0] === current)
          this.hideCurrentSnackBar({ reason: SnackBarClosedReason.timeout });
      });
  };

  showMaterialBanner(
    materialBanner: MaterialBanner,
  ): ScaffoldFeatureController<MaterialBanner, MaterialBannerClosedReason> {
    invariant(
      this.mounted && this.scaffolds.size > 0,
      'missing-material-banner-scaffold',
      'Show a MaterialBanner from a messenger with a mounted Scaffold',
    );
    if (!this.bannerAnimation) {
      this.bannerAnimation = MaterialBanner.createAnimationController({ vsync: this });
      this.bannerAnimation.addStatusListener(this.bannerStatusChanged);
    }
    const banner = materialBanner.withAnimation(this.bannerAnimation.view, {
      fallbackKey: new UniqueKey(),
    });
    let resolve!: BannerPresentation['resolve'];
    const closed = new Promise<MaterialBannerClosedReason>((complete) => {
      resolve = complete;
    });
    const entry = { banner, resolve };
    const start = this.banners.length === 0;
    this.setState(() => {
      this.banners.push(entry);
    });
    if (start) this.startBanner();
    return new ScaffoldFeatureController(banner, closed, () => {
      const index = this.banners.indexOf(entry);
      if (index === 0) this.hideCurrentMaterialBanner();
      else if (index > 0) {
        this.banners.splice(index, 1);
        resolve(MaterialBannerClosedReason.hide);
      }
    });
  }

  hideCurrentMaterialBanner({
    reason = MaterialBannerClosedReason.hide,
  }: CloseMaterialBannerOptions = {}): void {
    const animation = this.bannerAnimation;
    if (!animation || !this.banners.length || this.closingBanner) return;
    this.closingBanner = reason;
    if (this.accessibleNavigation || animation.isDismissed) this.retireBanner(reason);
    else animation.reverse();
  }

  removeCurrentMaterialBanner({
    reason = MaterialBannerClosedReason.remove,
  }: CloseMaterialBannerOptions = {}): void {
    if (this.banners.length) this.retireBanner(reason);
  }

  clearMaterialBanners(): void {
    for (const entry of this.banners.splice(1)) entry.resolve(MaterialBannerClosedReason.remove);
    this.hideCurrentMaterialBanner();
  }

  private startBanner(): void {
    const animation = this.bannerAnimation!;
    animation.value = 0;
    if (!this.banners.length) return;
    if (this.accessibleNavigation) animation.value = 1;
    else animation.forward();
  }

  private retireBanner(reason: MaterialBannerClosedReason): void {
    const current = this.banners[0]!;
    this.closingBanner = null;
    this.setState(() => {
      this.banners.shift();
    });
    current.resolve(reason);
    this.startBanner();
  }

  private readonly bannerStatusChanged = (status: AnimationStatus): void => {
    if (this.mounted && status === AnimationStatus.dismissed && this.closingBanner)
      this.retireBanner(this.closingBanner);
  };

  override build(context: BuildContext): Widget {
    this.accessibleNavigation =
      context.maybeDependOn(MediaQuery)?.data.accessibleNavigation ?? false;
    return new ScaffoldMessengerScope(
      this,
      this.currentSnackBar,
      this.currentMaterialBanner,
      this.widget.child,
    );
  }

  override dispose(): void {
    this.timer?.dispose();
    this.animation.removeStatusListener(this.statusChanged);
    this.animation.dispose();
    this.bannerAnimation?.removeStatusListener(this.bannerStatusChanged);
    this.bannerAnimation?.dispose();
    for (const entry of this.snacks) entry.resolve(SnackBarClosedReason.remove);
    this.snacks.length = 0;
    for (const entry of this.banners) entry.resolve(MaterialBannerClosedReason.remove);
    this.banners.length = 0;
    this.scaffolds.clear();
    super.dispose();
  }
}
