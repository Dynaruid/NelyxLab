// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from Flutter widgets/ticker_provider.dart at the recorded pin.
import { invariant } from '../../foundation/errors.ts';
import type { ValueListenable } from '../../foundation/notifier.ts';
import { Ticker } from '../animation/ticker.ts';
import type { TickerProvider } from '../animation/ticker.ts';
import type { FrameScheduler } from '../scheduler/scheduler.ts';
import { State } from './framework.ts';
import type { StatefulWidget } from './framework.ts';
import { TickerMode } from './ticker-mode.ts';
import type { TickerModeData } from './ticker-mode.ts';
import { tickerScheduler } from './ticker-scheduler.ts';
import { MediaQuery } from './app-data.ts';
abstract class WidgetTickerProviderState<W extends StatefulWidget>
  extends State<W>
  implements TickerProvider
{
  private notifier: ValueListenable<TickerModeData> | undefined;
  private closed = false;
  private readonly changed = () => {
    if (this.notifier) this.updateTickers();
  };
  protected readonly tickers = new Set<Ticker>();
  get disableAnimations(): boolean {
    invariant(
      !this.closed,
      'disposed-ticker-provider',
      'Accessibility policy requires a live ticker owner',
    );
    return this.context.maybeDependOn(MediaQuery)?.data.disableAnimations ?? false;
  }
  protected mode(): TickerModeData {
    invariant(!this.closed, 'disposed-ticker-provider', 'Ticker provider State has been disposed');
    const next = TickerMode.getValuesNotifier(this.context);
    if (next !== this.notifier) {
      this.notifier?.removeListener(this.changed);
      this.notifier = next;
      next.addListener(this.changed);
    }
    return next.value;
  }
  private updateTickers(): void {
    const values = this.notifier!.value;
    for (const ticker of this.tickers) {
      ticker.muted = !values.enabled;
      ticker.forceFrames = values.forceFrames;
    }
  }
  protected configure(ticker: Ticker, values: TickerModeData): Ticker {
    ticker.muted = !values.enabled;
    ticker.forceFrames = values.forceFrames;
    this.tickers.add(ticker);
    return ticker;
  }
  protected removeTicker(ticker: Ticker): void {
    this.tickers.delete(ticker);
  }
  override deactivate(): void {
    const notifier = this.notifier;
    this.notifier = undefined;
    let errors: unknown[] | undefined;
    try {
      notifier?.removeListener(this.changed);
    } catch (error) {
      (errors ??= []).push(error);
    }
    for (const ticker of this.tickers)
      try {
        ticker.setMuted(this, true);
      } catch (error) {
        (errors ??= []).push(error);
      }
    try {
      super.deactivate();
    } catch (error) {
      (errors ??= []).push(error);
    }
    if (errors?.length === 1) throw errors[0];
    if (errors) throw new AggregateError(errors, 'Ticker provider deactivation failed');
  }
  override activate(): void {
    super.activate();
    this.mode();
    this.updateTickers();
    for (const ticker of this.tickers) ticker.setMuted(this, false);
  }
  override dispose(): void {
    if (this.closed) return;
    this.closed = true;
    const active = [...this.tickers].some((ticker) => ticker.isActive);
    this.notifier?.removeListener(this.changed);
    this.notifier = undefined;
    const errors: unknown[] = [];
    const snapshot = [...this.tickers];
    for (const ticker of snapshot)
      try {
        ticker.dispose();
      } catch (error) {
        errors.push(error);
      }
    if (active)
      errors.unshift(
        new Error(
          'TickerProvider State disposed with an active Ticker; dispose controllers before super.dispose()',
        ),
      );
    try {
      super.dispose();
    } catch (error) {
      errors.push(error);
    }
    if (errors.length) throw new AggregateError(errors, 'Ticker provider teardown failed');
  }
  abstract createTicker(onTick: (elapsedMilliseconds: number) => void): Ticker;
}
class WidgetTicker extends Ticker {
  private removed = false;
  constructor(
    scheduler: FrameScheduler,
    onTick: (elapsedMilliseconds: number) => void,
    private readonly remove: (ticker: Ticker) => void,
  ) {
    super(scheduler, onTick);
  }
  override dispose(): void {
    if (this.removed) return;
    this.removed = true;
    this.remove(this);
    super.dispose();
  }
}
/** TypeScript State superclass adaptation of the source mixin; one vending per State lifetime. */
export abstract class SingleTickerProviderStateMixin<
  W extends StatefulWidget = StatefulWidget,
> extends WidgetTickerProviderState<W> {
  private created = false;
  createTicker(onTick: (elapsedMilliseconds: number) => void): Ticker {
    invariant(
      !this.created,
      'multiple-single-tickers',
      'SingleTickerProviderStateMixin can vend only one Ticker over its lifetime',
    );
    const scheduler = tickerScheduler(this.context),
      values = this.mode();
    const ticker = new WidgetTicker(scheduler, onTick, (t) => this.removeTicker(t));
    this.created = true;
    return this.configure(ticker, values);
  }
}
/** TypeScript State superclass adaptation, tracking removal of every owned ticker. */
export abstract class TickerProviderStateMixin<
  W extends StatefulWidget = StatefulWidget,
> extends WidgetTickerProviderState<W> {
  createTicker(onTick: (elapsedMilliseconds: number) => void): Ticker {
    const scheduler = tickerScheduler(this.context),
      values = this.mode();
    return this.configure(new WidgetTicker(scheduler, onTick, (t) => this.removeTicker(t)), values);
  }
}
