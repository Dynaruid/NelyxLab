// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/widgets/scrollable_helpers.dart; SHA256 1739ef2234d5f613ca1aa52ff6016fdce8fd9afe0ae31aba2f1ed2d698df614b
// Adopted product owner: nominal checks use the classes declared here.
import { AxisDirection } from '../painting/basic-types.ts';
import { protect } from '../../ui/value-math.ts';
import { checkedInteger } from '../../ui/value-math.ts';
import { hashValues } from '../painting/value-equality.ts';
import { describeIdentity } from '../../foundation/diagnostics-identity.ts';
import { detailsObjectString } from './scrollable-details-adapter.ts';
import { detailsRuntimeType } from './scrollable-details-adapter.ts';
import { detailsStringConcat } from './scrollable-details-adapter.ts';
import type { Clip } from '../../ui/clip.ts';
import type { ScrollController } from './scroll-controller.ts';
import type { ScrollPhysics } from './scroll-physics.ts';
import type { MutableDetailsList } from './scrollable-details-adapter.ts';

export class SourceScrollableDetails {
  readonly direction: AxisDirection;
  readonly controller: ScrollController | null;
  readonly physics: ScrollPhysics | null;
  readonly decorationClipBehavior: Clip | null;
  constructor({
    direction,
    controller = null,
    physics = null,
    clipBehavior = null,
    decorationClipBehavior = null,
  }: {
    readonly direction: AxisDirection;
    readonly controller?: ScrollController | null;
    readonly physics?: ScrollPhysics | null;
    readonly clipBehavior?: Clip | null;
    readonly decorationClipBehavior?: Clip | null;
  }) {
    const _initialField0 = direction;
    const _initialField1 = controller;
    const _initialField2 = physics;
    const _initialField3 = clipBehavior ?? decorationClipBehavior;
    this.direction = _initialField0;
    this.controller = _initialField1;
    this.physics = _initialField2;
    this.decorationClipBehavior = _initialField3;
    protect(this, ['direction', 'controller', 'physics', 'decorationClipBehavior']);
  }
  get clipBehavior(): Clip | null {
    return this.decorationClipBehavior;
  }
  copyWith({
    direction = null,
    controller = null,
    physics = null,
    decorationClipBehavior = null,
  }: {
    readonly direction?: AxisDirection | null;
    readonly controller?: ScrollController | null;
    readonly physics?: ScrollPhysics | null;
    readonly decorationClipBehavior?: Clip | null;
  } = {}): SourceScrollableDetails {
    return new SourceScrollableDetails({
      direction: direction ?? this.direction,
      controller: controller ?? this.controller,
      physics: physics ?? this.physics,
      decorationClipBehavior: decorationClipBehavior ?? this.decorationClipBehavior,
    });
  }
  toString(): string {
    const description: MutableDetailsList<string> = [];
    description.push(`axisDirection: ${detailsObjectString(this.direction)}`);
    const addIfNonNull: (argument0: string, argument1: {} | null) => void = (
      prefix: string,
      value: {} | null,
    ): void => {
      if (value !== null) {
        description.push(detailsStringConcat(prefix, detailsObjectString(value as {})));
      }
    };
    addIfNonNull('scroll controller: ', this.controller);
    addIfNonNull('scroll physics: ', this.physics);
    addIfNonNull('decorationClipBehavior: ', this.decorationClipBehavior);
    return `${describeIdentity(this)}(${description.join(', ')})`;
  }
  /**
   * @dartReturn int
   * @dartReturnOrigin explicit
   */
  get hashCode(): number {
    return checkedInteger(
      hashValues(this.direction, this.controller, this.physics, this.decorationClipBehavior),
    );
  }
  equals(other: {}): boolean {
    if (this === other) {
      return true;
    }
    if (!(detailsRuntimeType(other) === this.constructor)) {
      return false;
    }
    return (
      isSourceScrollableDetails(other) &&
      (other as SourceScrollableDetails).direction === this.direction &&
      (other as SourceScrollableDetails).controller === this.controller &&
      (other as SourceScrollableDetails).physics === this.physics &&
      (other as SourceScrollableDetails).decorationClipBehavior === this.decorationClipBehavior
    );
  }
  static vertical({
    reverse = false,
    controller = null,
    physics = null,
    decorationClipBehavior = null,
  }: {
    readonly reverse?: boolean;
    readonly controller?: ScrollController | null;
    readonly physics?: ScrollPhysics | null;
    readonly decorationClipBehavior?: Clip | null;
  } = {}): SourceScrollableDetails {
    return _dartTemporary0({ reverse, controller, physics, decorationClipBehavior });
  }
  static horizontal({
    reverse = false,
    controller = null,
    physics = null,
    decorationClipBehavior = null,
  }: {
    readonly reverse?: boolean;
    readonly controller?: ScrollController | null;
    readonly physics?: ScrollPhysics | null;
    readonly decorationClipBehavior?: Clip | null;
  } = {}): SourceScrollableDetails {
    return _dartTemporary2({ reverse, controller, physics, decorationClipBehavior });
  }
}
function _dartTemporary0({
  reverse = false,
  controller = null,
  physics = null,
  decorationClipBehavior = null,
}: {
  readonly reverse?: boolean;
  readonly controller?: ScrollController | null;
  readonly physics?: ScrollPhysics | null;
  readonly decorationClipBehavior?: Clip | null;
} = {}): SourceScrollableDetails {
  const _dartTemporary1: InstanceType<typeof Object> & {
    direction: AxisDirection;
    controller: ScrollController | null;
    physics: ScrollPhysics | null;
    decorationClipBehavior: Clip | null;
  } = Reflect.construct(
    Object,
    [] satisfies ConstructorParameters<typeof Object>,
    SourceScrollableDetails,
  ) as InstanceType<typeof Object> & {
    direction: AxisDirection;
    controller: ScrollController | null;
    physics: ScrollPhysics | null;
    decorationClipBehavior: Clip | null;
  };
  const _initialField0 = controller;
  const _initialField1 = physics;
  const _initialField2 = decorationClipBehavior;
  const _initialField3 = reverse ? AxisDirection.up : AxisDirection.down;
  _dartTemporary1.direction = _initialField3;
  _dartTemporary1.controller = _initialField0;
  _dartTemporary1.physics = _initialField1;
  _dartTemporary1.decorationClipBehavior = _initialField2;
  protect(_dartTemporary1, ['direction', 'controller', 'physics', 'decorationClipBehavior']);
  return _dartTemporary1 as SourceScrollableDetails;
}
function _dartTemporary2({
  reverse = false,
  controller = null,
  physics = null,
  decorationClipBehavior = null,
}: {
  readonly reverse?: boolean;
  readonly controller?: ScrollController | null;
  readonly physics?: ScrollPhysics | null;
  readonly decorationClipBehavior?: Clip | null;
} = {}): SourceScrollableDetails {
  const _dartTemporary3: InstanceType<typeof Object> & {
    direction: AxisDirection;
    controller: ScrollController | null;
    physics: ScrollPhysics | null;
    decorationClipBehavior: Clip | null;
  } = Reflect.construct(
    Object,
    [] satisfies ConstructorParameters<typeof Object>,
    SourceScrollableDetails,
  ) as InstanceType<typeof Object> & {
    direction: AxisDirection;
    controller: ScrollController | null;
    physics: ScrollPhysics | null;
    decorationClipBehavior: Clip | null;
  };
  const _initialField0 = controller;
  const _initialField1 = physics;
  const _initialField2 = decorationClipBehavior;
  const _initialField3 = reverse ? AxisDirection.left : AxisDirection.right;
  _dartTemporary3.direction = _initialField3;
  _dartTemporary3.controller = _initialField0;
  _dartTemporary3.physics = _initialField1;
  _dartTemporary3.decorationClipBehavior = _initialField2;
  protect(_dartTemporary3, ['direction', 'controller', 'physics', 'decorationClipBehavior']);
  return _dartTemporary3 as SourceScrollableDetails;
}

export function isSourceScrollableDetails(value: unknown): value is SourceScrollableDetails {
  return value instanceof SourceScrollableDetails;
}
export function castSourceScrollableDetails(value: unknown): SourceScrollableDetails {
  if (!isSourceScrollableDetails(value)) throw new TypeError('Expected ScrollableDetails');
  return value;
}
