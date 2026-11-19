// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/material_state.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import type { DartMap, DartSet } from '@nelyx/core/foundation/dart-collections';
import { applyDartType, captureDartInterface } from '@nelyx/core/foundation/dart-type-witness';
import { FlutterError } from '@nelyx/core/foundation/flutter-error';
import { WidgetStateMapper, WidgetStateProperty } from '@nelyx/core/framework/widgets/widget-state';
import type {
  WidgetState,
  WidgetStatesConstraint,
} from '@nelyx/core/framework/widgets/widget-state';
import { InputBorder, OutlineInputBorder, UnderlineInputBorder } from './input-border.ts';

// Keep the same value and type identities for the deprecated Material spellings.
export {
  WidgetState as MaterialState,
  WidgetStateProperty as MaterialStateProperty,
  WidgetStatePropertyAll as MaterialStatePropertyAll,
  WidgetStatesController as MaterialStatesController,
  WidgetStateColor as MaterialStateColor,
  WidgetStateMouseCursor as MaterialStateMouseCursor,
  WidgetStateBorderSide as MaterialStateBorderSide,
  WidgetStateOutlinedBorder as MaterialStateOutlinedBorder,
  WidgetStateTextStyle as MaterialStateTextStyle,
} from '@nelyx/core/framework/widgets/widget-state';

/** @deprecated Use a resolver of Core WidgetState values. */
export type MaterialPropertyResolver<T> = (states: DartSet<WidgetState>) => T;

const inputBorderType = applyDartType<InputBorder>(InputBorder, 'InputBorder', [], []);
const statePropertyType = applyDartType<WidgetStateProperty<InputBorder>>(
  WidgetStateProperty,
  'WidgetStateProperty',
  [inputBorderType],
  [],
);

export abstract class WidgetStateInputBorder
  extends OutlineInputBorder
  implements WidgetStateProperty<InputBorder>
{
  constructor() {
    super();
    captureDartInterface(this, statePropertyType);
  }
  abstract resolve(states: DartSet<WidgetState>): InputBorder;
  static resolveWith(callback: MaterialPropertyResolver<InputBorder>): WidgetStateInputBorder {
    return new (class extends WidgetStateInputBorder {
      override resolve(states: DartSet<WidgetState>): InputBorder {
        return callback(states);
      }
    })();
  }
  static fromMap(map: DartMap<WidgetStatesConstraint, InputBorder>): WidgetStateInputBorder {
    const border = new Proxy(new MappedInputBorder(map), {
      get(target, key, receiver) {
        if (typeof key === 'string' && inputBorderFields.has(key)) {
          throw new FlutterError('Only read ' + key + ' from the resolved WidgetStateInputBorder');
        }
        return Reflect.get(target, key, receiver);
      },
    });
    captureDartInterface(border, statePropertyType);
    return border;
  }
}

const inputBorderFields = new Set([
  'borderSide',
  'dimensions',
  'isOutline',
  'borderRadius',
  'gapPadding',
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

class MappedInputBorder extends WidgetStateInputBorder {
  private readonly mapper: WidgetStateMapper<InputBorder>;

  constructor(map: DartMap<WidgetStatesConstraint, InputBorder>) {
    super();
    this.mapper = new WidgetStateMapper(inputBorderType, map);
  }

  override resolve(states: DartSet<WidgetState>): InputBorder {
    return this.mapper.resolve(states);
  }

  override equals(other: unknown): boolean {
    return other instanceof MappedInputBorder && this.mapper.equals(other.mapper);
  }

  override get hashCode(): number {
    return this.mapper.hashCode;
  }
}

/** @deprecated Use WidgetStateInputBorder. */
export abstract class MaterialStateOutlineInputBorder
  extends OutlineInputBorder
  implements WidgetStateProperty<InputBorder>
{
  constructor() {
    super();
    captureDartInterface(this, statePropertyType);
  }
  abstract resolve(states: DartSet<WidgetState>): InputBorder;
  static resolveWith(
    callback: MaterialPropertyResolver<InputBorder>,
  ): MaterialStateOutlineInputBorder {
    return new (class extends MaterialStateOutlineInputBorder {
      override resolve(states: DartSet<WidgetState>): InputBorder {
        return callback(states);
      }
    })();
  }
}

/** @deprecated Use WidgetStateInputBorder. */
export abstract class MaterialStateUnderlineInputBorder
  extends UnderlineInputBorder
  implements WidgetStateProperty<InputBorder>
{
  constructor() {
    super();
    captureDartInterface(this, statePropertyType);
  }
  abstract resolve(states: DartSet<WidgetState>): InputBorder;
  static resolveWith(
    callback: MaterialPropertyResolver<InputBorder>,
  ): MaterialStateUnderlineInputBorder {
    return new (class extends MaterialStateUnderlineInputBorder {
      override resolve(states: DartSet<WidgetState>): InputBorder {
        return callback(states);
      }
    })();
  }
}
