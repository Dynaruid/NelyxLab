// SPDX-License-Identifier: BSD-3-Clause
import { canonicalDartGetterObject } from '../../foundation/dart-const.ts';
import type { DartConstField } from '../../foundation/dart-const.ts';
import {
  applyDartType,
  captureDartType,
  hasCapturedDartType,
} from '../../foundation/dart-type-witness.ts';
import type { DartTypeWitness } from '../../foundation/dart-type-witness.ts';
import { registerDartValueSemantics } from '../../foundation/dart-value.ts';
import { Radius } from '../../ui/radius.ts';
import { constSourceRadiusElliptical } from '../../ui/radius-source-adapter.ts';
import { BorderRadius, BorderRadiusDirectional, BorderRadiusGeometry } from './border-radius.ts';
import type {
  BorderRadiusHorizontalOptions,
  BorderRadiusOptions,
  BorderRadiusVerticalOptions,
} from './border-radius.ts';

const geometryType = applyDartType<BorderRadiusGeometry>(
  BorderRadiusGeometry,
  'BorderRadiusGeometry',
  [],
  [],
);
const physicalType = applyDartType<BorderRadius>(BorderRadius, 'BorderRadius', [], [geometryType]);
const directionalType = applyDartType<BorderRadiusDirectional>(
  BorderRadiusDirectional,
  'BorderRadiusDirectional',
  [],
  [geometryType],
);

const physicalFields = [
  ['topLeft', 'value'],
  ['topRight', 'value'],
  ['bottomLeft', 'value'],
  ['bottomRight', 'value'],
] as const satisfies readonly DartConstField[];
const directionalFields = [
  ['topStart', 'value'],
  ['topEnd', 'value'],
  ['bottomStart', 'value'],
  ['bottomEnd', 'value'],
] as const satisfies readonly DartConstField[];
const physicalStorage = Object.freeze(Reflect.ownKeys(BorderRadius.zero));
const directionalStorage = Object.freeze(Reflect.ownKeys(BorderRadiusDirectional.zero));
if (physicalStorage.length > 1 || directionalStorage.length > 1)
  throw new TypeError('Unexpected BorderRadius private storage');

registerDartValueSemantics(BorderRadiusGeometry, {
  accepts: (value): value is BorderRadiusGeometry => value instanceof BorderRadiusGeometry,
  equals: (value, other) => value.equals(other),
  hash: (value) => value.hashCode,
  string: (value) => value.toString(),
});

function intern<T extends BorderRadiusGeometry>(
  owner: Function,
  value: T,
  witness: DartTypeWitness<T>,
  fields: readonly DartConstField[],
  storage: readonly PropertyKey[],
): T {
  return canonicalDartGetterObject(
    owner,
    witness,
    fields,
    () => {
      if (!hasCapturedDartType(value, owner)) captureDartType(value, witness);
      return value;
    },
    storage,
  );
}

function radius(value: Radius): Radius {
  if (Object.getPrototypeOf(value) !== Radius.prototype)
    throw new TypeError('Expected the Core Radius receiver');
  return constSourceRadiusElliptical(Radius, value.x, value.y);
}

type PhysicalOwner = typeof BorderRadius | typeof BorderRadiusGeometry;
type DirectionalOwner = typeof BorderRadiusDirectional | typeof BorderRadiusGeometry;

function physical(owner: PhysicalOwner, value: BorderRadius): BorderRadius {
  if (owner !== BorderRadius && owner !== BorderRadiusGeometry)
    throw new TypeError('Expected the exact BorderRadius owner');
  const topLeft = radius(value.topLeft),
    topRight = radius(value.topRight);
  const bottomLeft = radius(value.bottomLeft),
    bottomRight = radius(value.bottomRight);
  const corners = [topLeft, topRight, bottomLeft, bottomRight];
  const candidate = corners.every((corner) => corner === Radius.zero)
    ? BorderRadius.zero
    : topLeft === value.topLeft &&
        topRight === value.topRight &&
        bottomLeft === value.bottomLeft &&
        bottomRight === value.bottomRight
      ? value
      : new BorderRadius({ topLeft, topRight, bottomLeft, bottomRight });
  return intern(BorderRadius, candidate, physicalType, physicalFields, physicalStorage);
}

function directional(
  owner: DirectionalOwner,
  value: BorderRadiusDirectional,
): BorderRadiusDirectional {
  if (owner !== BorderRadiusDirectional && owner !== BorderRadiusGeometry)
    throw new TypeError('Expected the exact BorderRadiusDirectional owner');
  const topStart = radius(value.topStart),
    topEnd = radius(value.topEnd);
  const bottomStart = radius(value.bottomStart),
    bottomEnd = radius(value.bottomEnd);
  const corners = [topStart, topEnd, bottomStart, bottomEnd];
  const candidate = corners.every((corner) => corner === Radius.zero)
    ? BorderRadiusDirectional.zero
    : topStart === value.topStart &&
        topEnd === value.topEnd &&
        bottomStart === value.bottomStart &&
        bottomEnd === value.bottomEnd
      ? value
      : new BorderRadiusDirectional({ topStart, topEnd, bottomStart, bottomEnd });
  return intern(
    BorderRadiusDirectional,
    candidate,
    directionalType,
    directionalFields,
    directionalStorage,
  );
}

physical(BorderRadius, BorderRadius.zero);
directional(BorderRadiusDirectional, BorderRadiusDirectional.zero);

export const constBorderRadiusAll = (owner: PhysicalOwner, value: Radius): BorderRadius =>
  physical(owner, BorderRadius.all(value));
export const constBorderRadiusOnly = (
  owner: PhysicalOwner,
  options: BorderRadiusOptions = {},
): BorderRadius => physical(owner, BorderRadius.only(options));
export const constBorderRadiusVertical = (
  owner: PhysicalOwner,
  options: BorderRadiusVerticalOptions = {},
): BorderRadius => physical(owner, BorderRadius.vertical(options));
export const constBorderRadiusHorizontal = (
  owner: typeof BorderRadius,
  options: BorderRadiusHorizontalOptions = {},
): BorderRadius => physical(owner, BorderRadius.horizontal(options));

export const constBorderRadiusDirectionalAll = (
  owner: typeof BorderRadiusDirectional,
  value: Radius,
): BorderRadiusDirectional => directional(owner, BorderRadiusDirectional.all(value));
export const constBorderRadiusDirectionalOnly = (
  owner: DirectionalOwner,
  options: BorderRadiusOptions = {},
): BorderRadiusDirectional => directional(owner, BorderRadiusDirectional.only(options));
export const constBorderRadiusDirectionalVertical = (
  owner: typeof BorderRadiusDirectional,
  options: BorderRadiusVerticalOptions = {},
): BorderRadiusDirectional => directional(owner, BorderRadiusDirectional.vertical(options));
export const constBorderRadiusDirectionalHorizontal = (
  owner: typeof BorderRadiusDirectional,
  options: BorderRadiusHorizontalOptions = {},
): BorderRadiusDirectional => directional(owner, BorderRadiusDirectional.horizontal(options));
