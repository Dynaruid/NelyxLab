// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/widgets/navigator.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { diagnosticValueString } from '../../foundation/debug.ts';
import { sameKey } from '../../foundation/key.ts';
import type { LocalKey } from '../../foundation/key.ts';
import { objectRuntimeType } from '../../foundation/object.ts';
import type { BuildContext } from './framework.ts';
import type { Route } from './navigation.ts';

export interface RouteSettingsOptions {
  readonly name?: string | null;
  readonly arguments?: unknown;
}

export class RouteSettings {
  readonly name: string | null;
  readonly arguments: unknown;
  constructor({ name = null, arguments: argumentsValue = null }: RouteSettingsOptions = {}) {
    this.name = name;
    this.arguments = argumentsValue;
    if (new.target === RouteSettings) Object.freeze(this);
  }
  toString(): string {
    const name = this.name === null ? 'none' : '"' + this.name + '"';
    return `${objectRuntimeType(this, 'RouteSettings')}(${name}, ${diagnosticValueString(this.arguments)})`;
  }
}

export type PopInvokedWithResultCallback<T> = {
  invoke(didPop: boolean, result: T | null): void;
}['invoke'];

export interface PageOptions<T = unknown> extends RouteSettingsOptions {
  readonly key?: LocalKey | null;
  readonly canPop?: boolean;
  readonly onPopInvoked?: PopInvokedWithResultCallback<T>;
  readonly restorationId?: string | null;
}

export abstract class Page<T = unknown> extends RouteSettings {
  readonly key: LocalKey | null;
  readonly canPop: boolean;
  readonly onPopInvoked: PopInvokedWithResultCallback<T>;
  readonly restorationId: string | null;

  constructor({
    key = null,
    canPop = true,
    onPopInvoked = () => {},
    restorationId = null,
    ...settings
  }: PageOptions<T> = {}) {
    super(settings);
    this.key = key;
    this.canPop = canPop;
    this.onPopInvoked = onPopInvoked;
    this.restorationId = restorationId;
  }

  canUpdate(other: Page): boolean {
    return this.constructor === other.constructor && sameKey(this.key, other.key);
  }

  abstract createRoute(context: BuildContext): Route<T>;

  override toString(): string {
    return `${objectRuntimeType(this, 'Page')}(${JSON.stringify(this.name)}, ${this.key}, ${diagnosticValueString(this.arguments)})`;
  }
}
