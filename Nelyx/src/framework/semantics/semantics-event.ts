// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from the pinned framework semantics_event.dart.
import { objectRuntimeType } from '../../foundation/object.ts';
import { protect, checkedInteger } from '../../ui/value-math.ts';
import { invariant } from '../../foundation/errors.ts';

export const Assertiveness = Object.freeze({ polite: 'polite', assertive: 'assertive' } as const);
export type Assertiveness = (typeof Assertiveness)[keyof typeof Assertiveness];

/** Maps retain the StandardMessageCodec contract, including nested maps. */
export abstract class SemanticsEvent {
  constructor(readonly type: string) {
    invariant(
      typeof type === 'string',
      'invalid-semantics-event-type',
      'Semantics event type must be a string',
    );
    protect(this, ['type']);
  }
  toMap({ nodeId = null }: { readonly nodeId?: number | null } = {}): Map<string, unknown> {
    const id = nodeId === null ? null : checkedInteger(nodeId);
    const event = new Map<string, unknown>([
      ['type', this.type],
      ['data', this.getDataMap()],
    ]);
    if (id !== null) event.set('nodeId', id);
    return event;
  }
  abstract getDataMap(): Map<string, unknown>;
  toString(): string {
    const data = this.getDataMap(),
      pairs = [...data.keys()].sort().map((key) => `${key}: ${String(data.get(key))}`);
    return `${objectRuntimeType(this, 'SemanticsEvent')}(${pairs.join(', ')})`;
  }
}

export class AnnounceSemanticsEvent extends SemanticsEvent {
  readonly assertiveness: Assertiveness;
  constructor(
    readonly message: string,
    readonly textDirection: 'ltr' | 'rtl',
    readonly viewId: number,
    { assertiveness = Assertiveness.polite }: { readonly assertiveness?: Assertiveness } = {},
  ) {
    super('announce');
    invariant(
      typeof message === 'string' &&
        (textDirection === 'ltr' || textDirection === 'rtl') &&
        (assertiveness === Assertiveness.polite || assertiveness === Assertiveness.assertive),
      'invalid-semantics-announcement',
      'Announcement requires a string, text direction and assertiveness',
    );
    this.viewId = checkedInteger(viewId);
    this.assertiveness = assertiveness;
    protect(this, ['message', 'textDirection', 'viewId', 'assertiveness']);
  }
  override getDataMap(): Map<string, unknown> {
    const data = new Map<string, unknown>([
      ['viewId', this.viewId],
      ['message', this.message],
      ['textDirection', this.textDirection === 'rtl' ? 0 : 1],
    ]);
    if (this.assertiveness !== Assertiveness.polite) data.set('assertiveness', 1);
    return data;
  }
}
export class TooltipSemanticsEvent extends SemanticsEvent {
  constructor(readonly message: string) {
    super('tooltip');
    invariant(
      typeof message === 'string',
      'invalid-semantics-tooltip',
      'Tooltip message must be a string',
    );
    protect(this, ['message']);
  }
  override getDataMap(): Map<string, unknown> {
    return new Map([['message', this.message]]);
  }
}
/** Dart const empty event payloads are shared and reject mutation. */
class _EmptyEventData extends Map<string, unknown> {
  override set(_key: string, _value: unknown): this {
    throw new TypeError('Cannot modify an unmodifiable event map');
  }
  override delete(_key: string): boolean {
    throw new TypeError('Cannot modify an unmodifiable event map');
  }
  override clear(): void {
    throw new TypeError('Cannot modify an unmodifiable event map');
  }
}
const emptyEventData = new _EmptyEventData();
export class LongPressSemanticsEvent extends SemanticsEvent {
  constructor() {
    super('longPress');
  }
  override getDataMap(): Map<string, unknown> {
    return emptyEventData;
  }
}
export class TapSemanticEvent extends SemanticsEvent {
  constructor() {
    super('tap');
  }
  override getDataMap(): Map<string, unknown> {
    return emptyEventData;
  }
}
export class FocusSemanticEvent extends SemanticsEvent {
  constructor() {
    super('focus');
  }
  override getDataMap(): Map<string, unknown> {
    return emptyEventData;
  }
}
