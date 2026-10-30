// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { DartMapHash } from '../../foundation/dart-map-equality.ts';
import { MouseCursor, SystemMouseCursors } from '../../services/mouse-cursor.ts';
import type { MouseCursorSession } from '../../services/mouse-cursor.ts';
import type { MethodChannel } from '../../services/platform-channel.ts';
import {
  SourceWidgetStateProperty as Property,
  SourceWidgetStateMapper,
  SourceWidgetState,
  SourceWidgetStatesConstraint,
} from './widget-state.generated.ts';
import { constEmptyWidgetStateSet } from './widget-state-full-collections.ts';
import type { DartSet, DartMap } from '../../foundation/dart-collections.ts';
import {
  applyDartType,
  captureDartType,
  captureDartInterface,
  isDartType,
} from '../../foundation/dart-type-witness.ts';
import { FoundationPlatform } from '../../foundation/platform.ts';
import { FlutterError } from '../../foundation/flutter-error.ts';
import { widgetStateDiagnosticableType } from './widget-state-diagnostic-source-adapter.ts';
export const sourceMouseCursorType = applyDartType<MouseCursor>(
  MouseCursor,
  'MouseCursor',
  [],
  [widgetStateDiagnosticableType],
);
const propertyType = applyDartType<Property<MouseCursor>>(
  Property,
  'WidgetStateProperty',
  [sourceMouseCursorType],
  [],
);
const mapperType = applyDartType<SourceWidgetStateMapper<MouseCursor>>(
  SourceWidgetStateMapper,
  'WidgetStateMapper',
  [sourceMouseCursorType],
  [propertyType, widgetStateDiagnosticableType],
);
function admitted(cursor: unknown): MouseCursor {
  if (!(cursor instanceof MouseCursor))
    throw new TypeError('State cursor must resolve the owning Core MouseCursor');
  if (!isDartType(cursor, sourceMouseCursorType))
    captureDartInterface(cursor, sourceMouseCursorType);
  return cursor;
}
/** Canonical cursor admission for source generic properties outside the cursor owner. */
export function captureSourceMouseCursor(cursor: MouseCursor): MouseCursor {
  return admitted(cursor);
}
export abstract class WidgetStateMouseCursor extends MouseCursor implements Property<MouseCursor> {
  constructor() {
    super();
    captureDartType(this, stateCursorType);
  }
  abstract resolve(states: DartSet<SourceWidgetState>): MouseCursor;
  static resolveWith(
    callback: (states: DartSet<SourceWidgetState>) => MouseCursor,
    { debugDescription = 'WidgetStateMouseCursor()' }: { readonly debugDescription?: string } = {},
  ): WidgetStateMouseCursor {
    return new ResolvedCursor(callback, debugDescription);
  }
  static fromMap(map: DartMap<SourceWidgetStatesConstraint, MouseCursor>): WidgetStateMouseCursor {
    const target = new MappedCursor(map),
      proxy = new Proxy(target, {
        get(object, key, receiver) {
          if (key === 'createSession' || key === 'debugDescription')
            throw new FlutterError(
              'There was an attempt to access the "' +
                String(key) +
                '" field of a WidgetStateMapper<MouseCursor> object. WidgetStateProperty objects should only be used in places that document their support.',
            );
          return Reflect.get(object, key, receiver);
        },
      });
    captureDartType(proxy, stateCursorType);
    captureDartType(proxy, mappedCursorType);
    return proxy;
  }
  /** @dartParam device int */
  createSession(device: number, channel?: MethodChannel): MouseCursorSession {
    return this.resolve(constEmptyWidgetStateSet()).createSession(device, channel);
  }
  static get clickable(): WidgetStateMouseCursor {
    return clickable;
  }
  static get adaptiveClickable(): WidgetStateMouseCursor {
    return adaptiveClickable;
  }
  static get textable(): WidgetStateMouseCursor {
    return textable;
  }
}
const stateCursorType = applyDartType<WidgetStateMouseCursor>(
  WidgetStateMouseCursor,
  'WidgetStateMouseCursor',
  [],
  [sourceMouseCursorType, propertyType],
);
class ResolvedCursor extends WidgetStateMouseCursor {
  constructor(
    private readonly callback: (states: DartSet<SourceWidgetState>) => MouseCursor,
    readonly debugDescription: string,
  ) {
    super();
  }
  resolve(states: DartSet<SourceWidgetState>): MouseCursor {
    return admitted(this.callback(states));
  }
}
class MappedCursor extends WidgetStateMouseCursor {
  readonly mapper: SourceWidgetStateMapper<MouseCursor>;
  constructor(private readonly map: DartMap<SourceWidgetStatesConstraint, MouseCursor>) {
    super();
    this.mapper = new SourceWidgetStateMapper(sourceMouseCursorType, map);
    /* Bridge the generated mapper-owned storage and source supertype without copying its algorithm. */ Object.defineProperties(
      this,
      Object.getOwnPropertyDescriptors(this.mapper),
    );
    captureDartType(this, mappedCursorType);
  }
  resolve(states: DartSet<SourceWidgetState>): MouseCursor {
    return admitted(this.mapper.resolve(states));
  }
  get debugDescription(): string {
    return this.mapper.toString();
  }
  override equals(other: unknown): boolean {
    return other !== null && other !== undefined && this.mapper.equals(other as {});
  }
  override get hashCode(): number {
    return new DartMapHash<MouseCursor>(admitted).hash(this.map);
  }
  override toString(): string {
    return this.mapper.toString();
  }
}
const mappedCursorType = applyDartType<MappedCursor>(
    MappedCursor,
    '_WidgetMouseCursorMapper',
    [],
    [stateCursorType, mapperType],
  ),
  clickable = WidgetStateMouseCursor.resolveWith(
    (s) =>
      s.contains(SourceWidgetState.disabled) ? SystemMouseCursors.basic : SystemMouseCursors.click,
    { debugDescription: 'WidgetStateMouseCursor(clickable)' },
  ),
  adaptiveClickable = WidgetStateMouseCursor.resolveWith(
    (s) =>
      s.contains(SourceWidgetState.disabled) || FoundationPlatform.hostEnvironment.kind !== 'web'
        ? SystemMouseCursors.basic
        : SystemMouseCursors.click,
    { debugDescription: 'WidgetStateMouseCursor(adaptiveClickable)' },
  ),
  textable = WidgetStateMouseCursor.resolveWith(
    (s) =>
      s.contains(SourceWidgetState.disabled) ? SystemMouseCursors.basic : SystemMouseCursors.text,
    { debugDescription: 'WidgetStateMouseCursor(textable)' },
  );
