// SPDX-License-Identifier: BSD-3-Clause
import { StandardMessageCodec } from '@nelyx/core/services/message-codecs';
import { PlatformException } from '@nelyx/core/services/message-codec';
import type { PlatformId } from '@nelyx/core/hosting/platform';
import type { PluginPlatformMessagePort } from './plugin-port.ts';

export interface NativeAccessibilityView {
  readonly viewId: number;
  isLive(): boolean;
  rootTag(): number | null;
  nodeTag(sourceNodeId: number): number | null;
}
interface NativeAccessibilityModule {
  getAccessibilityProtocol(): number;
  dispatchAccessibilityEvent(
    rootTag: number,
    targetTag: number,
    type: string,
    message: string | null,
  ): PromiseLike<boolean>;
}
/** Platform channel dispatch follows each pinned engine's supported events.
 * The owned native module acknowledges UI execution before the port drains. */
export function installNativeAccessibility(
  port: PluginPlatformMessagePort,
  readBackend: () => unknown,
  target: Exclude<PlatformId, 'web'>,
  view: NativeAccessibilityView,
): void {
  const codec = new StandardMessageCodec();
  port.register('flutter/accessibility', async (bytes, { signal }) => {
    if (signal.aborted || !view.isLive()) return null;
    const event = codec.decodeMessage(bytes);
    if (
      !(event instanceof Map) ||
      typeof event.get('type') !== 'string' ||
      !(event.get('data') instanceof Map)
    )
      throw new TypeError('Invalid native accessibility event');
    const type = event.get('type') as string,
      data = event.get('data') as Map<unknown, unknown>;
    if (target !== 'android' && target !== 'windows') return null;
    if (
      (target === 'windows' && type !== 'announce') ||
      !['announce', 'tooltip', 'tap', 'longPress', 'focus'].includes(type)
    )
      return null;
    let message: string | null = null,
      targetTag: number | null = null;
    if (type === 'announce' || type === 'tooltip') {
      const value = data.get('message');
      if (value === null || value === undefined) return null;
      if (typeof value !== 'string') throw new TypeError('Accessibility message must be a string');
      message = value;
      if (type === 'announce') {
        const id = data.get('viewId');
        if ((id !== undefined && id !== view.viewId) || (target === 'windows' && id === undefined))
          return null;
      }
    } else {
      const id = event.get('nodeId');
      if (id === null || id === undefined) return null;
      if (!Number.isSafeInteger(id) || id < 0)
        throw new TypeError('Accessibility node id must be a nonnegative integer');
      targetTag = view.nodeTag(id);
      if (targetTag === null && id !== 0) return null;
    }
    const rootTag = view.rootTag();
    if (rootTag === null) return null;
    if (
      !Number.isSafeInteger(rootTag) ||
      rootTag <= 0 ||
      (targetTag !== null && (!Number.isSafeInteger(targetTag) || targetTag <= 0))
    )
      throw new TypeError('Invalid native accessibility View tag');
    const module = readBackend() as Partial<NativeAccessibilityModule> | undefined;
    if (
      typeof module?.getAccessibilityProtocol !== 'function' ||
      module.getAccessibilityProtocol() !== 1 ||
      typeof module.dispatchAccessibilityEvent !== 'function'
    )
      throw new PlatformException({
        code: 'native-accessibility-cohort',
        message: 'Accessibility protocol1 requires matching rebuilt SDK native sources',
      });
    if (signal.aborted || !view.isLive()) return null;
    const operation = module.dispatchAccessibilityEvent(
      rootTag,
      targetTag ?? rootTag,
      type,
      message,
    );
    if (!operation || typeof operation.then !== 'function')
      throw new TypeError('Native accessibility dispatch requires an acknowledgement');
    const handled = await operation;
    if (typeof handled !== 'boolean')
      throw new TypeError('Invalid native accessibility acknowledgement');
    return null;
  });
}
