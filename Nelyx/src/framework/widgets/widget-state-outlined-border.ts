// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from Flutter packages/flutter/lib/src/widgets/widget_state.dart
// at 71e4717a61786faab4c7aa39825989305ed29e8a.
import type { DartMap, DartSet } from '../../foundation/dart-collections.ts';
import {
  applyDartType,
  captureDartInterface,
  nullableDartType,
} from '../../foundation/dart-type-witness.ts';
import { FlutterError } from '../../foundation/flutter-error.ts';
import { OutlinedBorder } from '../painting/borders.ts';
import { RoundedRectangleBorder } from '../painting/rounded-rectangle-border.ts';
import { SourceWidgetStateMapper, SourceWidgetStateProperty } from './widget-state.generated.ts';
import type { SourceWidgetState, SourceWidgetStatesConstraint } from './widget-state.generated.ts';

type BorderResolver = (states: DartSet<SourceWidgetState>) => OutlinedBorder | null;
const borderType = nullableDartType(
  applyDartType<OutlinedBorder>(OutlinedBorder, 'OutlinedBorder', [], []),
);
const propertyType = applyDartType<SourceWidgetStateProperty<OutlinedBorder | null>>(
  SourceWidgetStateProperty,
  'WidgetStateProperty',
  [borderType],
  [],
);

export abstract class WidgetStateOutlinedBorder
  extends RoundedRectangleBorder
  implements SourceWidgetStateProperty<OutlinedBorder | null>
{
  constructor() {
    super();
    captureDartInterface(this, propertyType);
  }

  abstract resolve(states: DartSet<SourceWidgetState>): OutlinedBorder | null;

  static resolveWith(callback: BorderResolver): WidgetStateOutlinedBorder {
    return new (class extends WidgetStateOutlinedBorder {
      resolve(states: DartSet<SourceWidgetState>): OutlinedBorder | null {
        return callback(states);
      }
    })();
  }

  static fromMap(
    map: DartMap<SourceWidgetStatesConstraint, OutlinedBorder | null>,
  ): WidgetStateOutlinedBorder {
    const border = new Proxy(new MappedOutlinedBorder(map), {
      get(target, key, receiver) {
        if (typeof key === 'string' && borderFields.has(key)) {
          throw new FlutterError(
            'Only read ' + key + ' from the resolved WidgetStateOutlinedBorder',
          );
        }
        return Reflect.get(target, key, receiver);
      },
    });
    captureDartInterface(border, propertyType);
    return border;
  }
}

const borderFields = new Set([
  'side',
  'dimensions',
  'borderRadius',
  'preferPaintInterior',
  'scale',
  'copyWith',
  'getInnerPath',
  'getOuterPath',
  'paint',
  'paintInterior',
  'hitTest',
  'add',
  'lerpFrom',
  'lerpTo',
]);

class MappedOutlinedBorder extends WidgetStateOutlinedBorder {
  private readonly mapper: SourceWidgetStateMapper<OutlinedBorder | null>;

  constructor(map: DartMap<SourceWidgetStatesConstraint, OutlinedBorder | null>) {
    super();
    this.mapper = new SourceWidgetStateMapper(borderType, map);
  }

  override resolve(states: DartSet<SourceWidgetState>): OutlinedBorder | null {
    return this.mapper.resolve(states);
  }

  override equals(other: unknown): boolean {
    return other instanceof MappedOutlinedBorder && this.mapper.equals(other.mapper);
  }

  override get hashCode(): number {
    return this.mapper.hashCode;
  }
}
