// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2013 The Flutter Authors. All rights reserved.
// Adapted from pinned web engine semantics/accessibility.dart.
import { StandardMessageCodec } from '@nelyx/core/services/message-codecs';
import type { PluginPlatformMessagePort } from '../../runtime/plugin-port.ts';

/** Source live-region algorithm, owned by one actual DOM View. */
export class BrowserAccessibilityAnnouncements {
  private readonly polite: HTMLElement;
  private readonly assertive: HTMLElement;
  private appendSpace = false;
  private live = true;
  private readonly timers = new Set<number>();
  private readonly window: Window;
  constructor(
    private readonly hostElement: HTMLElement,
    readonly viewId: number,
  ) {
    const view = hostElement.ownerDocument.defaultView;
    if (!view || !hostElement.isConnected || !Number.isSafeInteger(viewId))
      throw new TypeError('Announcements require a connected View and integer identity');
    this.window = view;
    const create = (value: 'polite' | 'assertive') => {
      const element = hostElement.ownerDocument.createElement('nelyx-announcement-' + value);
      Object.assign(element.style, {
        position: 'fixed',
        overflow: 'hidden',
        transform: 'translate(-99999px, -99999px)',
        width: '1px',
        height: '1px',
      });
      element.setAttribute('aria-live', value);
      return element;
    };
    this.polite = create('polite');
    this.assertive = create('assertive');
    hostElement.append(this.polite, this.assertive);
  }
  handleMessage(value: unknown): void {
    if (!this.live || !this.hostElement.isConnected) return;
    if (!(value instanceof Map) || !(value.get('data') instanceof Map))
      throw new TypeError('Invalid accessibility event map');
    const data = value.get('data') as Map<unknown, unknown>,
      message = data.get('message');
    if (message == null) return;
    if (typeof message !== 'string') throw new TypeError('Invalid accessibility message');
    if (message.length === 0) return;
    const target = data.get('viewId');
    if (target !== undefined && target !== this.viewId) return;
    const rawAssertiveness = data.get('assertiveness') ?? 0;
    if (typeof rawAssertiveness !== 'number' || !Number.isFinite(rawAssertiveness))
      throw new TypeError('Invalid accessibility assertiveness');
    const assertiveness = Math.trunc(rawAssertiveness);
    if (assertiveness !== 0 && assertiveness !== 1)
      throw new RangeError('Invalid accessibility assertiveness');
    this.announce(message, assertiveness === 1 ? 'assertive' : 'polite');
  }
  announce(message: string, assertiveness: 'polite' | 'assertive'): void {
    if (!this.live || !this.hostElement.isConnected) return;
    const element = assertiveness === 'assertive' ? this.assertive : this.polite,
      originalParent = element.parentElement;
    // The source picks the last modal in DOM order. Limit discovery to this
    // View so one app cannot relocate its live region into another app.
    const modals = this.hostElement.querySelectorAll('[aria-modal="true"]'),
      modal =
        modals.item(modals.length - 1) ??
        (this.hostElement.matches('[aria-modal="true"]') ? this.hostElement : null);
    if (modal && originalParent) modal.append(element);
    const text = this.appendSpace ? message + '\u00a0' : message;
    this.appendSpace = !this.appendSpace;
    this.schedule(() => {
      element.textContent = text;
    }, 0);
    this.schedule(() => {
      element.textContent = '';
      if (modal && originalParent && originalParent.isConnected) originalParent.append(element);
    }, 300);
  }
  private schedule(callback: () => void, delay: number): void {
    const timer = this.window.setTimeout(() => {
      this.timers.delete(timer);
      if (this.live && this.hostElement.isConnected) callback();
    }, delay);
    this.timers.add(timer);
  }
  dispose(): void {
    if (!this.live) return;
    this.live = false;
    for (const timer of this.timers) this.window.clearTimeout(timer);
    this.timers.clear();
    this.polite.remove();
    this.assertive.remove();
  }
}
export function installBrowserAccessibility(
  port: PluginPlatformMessagePort,
  hostElement: HTMLElement,
  viewId: number,
): void {
  const announcements = new BrowserAccessibilityAnnouncements(hostElement, viewId),
    codec = new StandardMessageCodec();
  port.register('flutter/accessibility', (data, { signal }) => {
    if (!signal.aborted) announcements.handleMessage(codec.decodeMessage(data));
    return codec.encodeMessage(true);
  });
  port.own(announcements);
  port.onStop(() => announcements.dispose());
}
