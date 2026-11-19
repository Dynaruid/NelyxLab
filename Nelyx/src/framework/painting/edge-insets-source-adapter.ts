// SPDX-License-Identifier: BSD-3-Clause
import { canonicalDartGetterObject } from '../../foundation/dart-const.ts';
import type { DartConstField } from '../../foundation/dart-const.ts';
import {
  applyDartType,
  captureDartType,
  hasCapturedDartType,
} from '../../foundation/dart-type-witness.ts';
import type { DartTypeWitness } from '../../foundation/dart-type-witness.ts';
import { EdgeInsets, EdgeInsetsDirectional } from './edge-insets.ts';
import type {
  EdgeInsetsOptions,
  EdgeInsetsDirectionalOptions,
  EdgeInsetsSymmetricOptions,
} from './edge-insets.ts';
import { sourceEdgeInsetsGeometryType } from './source-value-types.ts';

const physicalType = applyDartType<EdgeInsets>(
  EdgeInsets,
  'EdgeInsets',
  [],
  [sourceEdgeInsetsGeometryType],
);
const directionalType = applyDartType<EdgeInsetsDirectional>(
  EdgeInsetsDirectional,
  'EdgeInsetsDirectional',
  [],
  [sourceEdgeInsetsGeometryType],
);
const physicalFields: readonly DartConstField[] = [
  ['left', 'double'],
  ['top', 'double'],
  ['right', 'double'],
  ['bottom', 'double'],
];
const directionalFields: readonly DartConstField[] = [
  ['start', 'double'],
  ['top', 'double'],
  ['end', 'double'],
  ['bottom', 'double'],
];
const physicalStorage = Object.freeze(Reflect.ownKeys(EdgeInsets.zero));
const directionalStorage = Object.freeze(Reflect.ownKeys(EdgeInsetsDirectional.zero));
if (physicalStorage.length > 1 || directionalStorage.length > 1)
  throw new TypeError('Unexpected EdgeInsets private storage');

function canonicalInsets<T extends EdgeInsets | EdgeInsetsDirectional>(
  owner: Function,
  witness: DartTypeWitness<T>,
  value: T,
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

function physical(owner: typeof EdgeInsets, value: EdgeInsets): EdgeInsets {
  if (owner !== EdgeInsets) throw new TypeError('Const EdgeInsets requires its exact owner');
  const zero = [value.left, value.top, value.right, value.bottom].every((side) =>
    Object.is(side, 0),
  );
  return canonicalInsets(
    owner,
    physicalType,
    zero ? EdgeInsets.zero : value,
    physicalFields,
    physicalStorage,
  );
}

function directional(
  owner: typeof EdgeInsetsDirectional,
  value: EdgeInsetsDirectional,
): EdgeInsetsDirectional {
  if (owner !== EdgeInsetsDirectional)
    throw new TypeError('Const EdgeInsetsDirectional requires its exact owner');
  const zero = [value.start, value.top, value.end, value.bottom].every((side) =>
    Object.is(side, 0),
  );
  return canonicalInsets(
    owner,
    directionalType,
    zero ? EdgeInsetsDirectional.zero : value,
    directionalFields,
    directionalStorage,
  );
}

physical(EdgeInsets, EdgeInsets.zero);
directional(EdgeInsetsDirectional, EdgeInsetsDirectional.zero);

export function constEdgeInsetsLTRB(
  owner: typeof EdgeInsets,
  left: number,
  top: number,
  right: number,
  bottom: number,
): EdgeInsets {
  return physical(owner, EdgeInsets.fromLTRB(left, top, right, bottom));
}
export function constEdgeInsetsAll(owner: typeof EdgeInsets, value: number): EdgeInsets {
  return physical(owner, EdgeInsets.all(value));
}
export function constEdgeInsetsOnly(
  owner: typeof EdgeInsets,
  options: EdgeInsetsOptions = {},
): EdgeInsets {
  return physical(owner, EdgeInsets.only(options));
}
export function constEdgeInsetsSymmetric(
  owner: typeof EdgeInsets,
  options: EdgeInsetsSymmetricOptions = {},
): EdgeInsets {
  return physical(owner, EdgeInsets.symmetric(options));
}
export function constDirectionalInsetsSTEB(
  owner: typeof EdgeInsetsDirectional,
  start: number,
  top: number,
  end: number,
  bottom: number,
): EdgeInsetsDirectional {
  return directional(owner, EdgeInsetsDirectional.fromSTEB(start, top, end, bottom));
}
export function constDirectionalInsetsAll(
  owner: typeof EdgeInsetsDirectional,
  value: number,
): EdgeInsetsDirectional {
  return directional(owner, EdgeInsetsDirectional.all(value));
}
export function constDirectionalInsetsOnly(
  owner: typeof EdgeInsetsDirectional,
  options: EdgeInsetsDirectionalOptions = {},
): EdgeInsetsDirectional {
  return directional(owner, EdgeInsetsDirectional.only(options));
}
export function constDirectionalInsetsSymmetric(
  owner: typeof EdgeInsetsDirectional,
  options: EdgeInsetsSymmetricOptions = {},
): EdgeInsetsDirectional {
  return directional(owner, EdgeInsetsDirectional.symmetric(options));
}
