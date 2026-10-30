// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Source services/mouse_cursor.dart with explicit per-View channel ownership.
import { Diagnosticable } from '../foundation/diagnosticable.ts';
import { DiagnosticsProperty } from '../foundation/diagnostics.ts';
import type {
  DiagnosticPropertiesBuilder,
  DiagnosticsStringOptions,
} from '../foundation/diagnostics.ts';
import { FoundationBuildMode } from '../foundation/constants.ts';
import { invariant } from '../foundation/errors.ts';
import { objectRuntimeType } from '../foundation/object.ts';
import { FlutterError } from '../foundation/flutter-error.ts';
import { FlutterErrorDetails } from '../foundation/assertions.ts';
import { hashDoubles } from '../ui/value-math.ts';
import { PointerRemovedEvent } from '../framework/gestures/events.ts';
import type { PointerEvent } from '../framework/gestures/events.ts';
import type { MethodChannel } from './platform-channel.ts';
import { SystemChannels } from './system-channels.ts';
import { dartIdentityHash, registerDartValueSemantics } from '../foundation/dart-value.ts';
export abstract class MouseCursorSession {
  constructor(
    readonly cursor: MouseCursor,
    readonly device: number,
  ) {}
  abstract activate(): Promise<void>;
  abstract dispose(): void;
}
export abstract class MouseCursor extends Diagnosticable(class {}) {
  abstract createSession(device: number, channel?: MethodChannel): MouseCursorSession;
  abstract get debugDescription(): string;
  equals(other: unknown): boolean {
    return this === other;
  }
  /** Source Object identity hash for cursors without an explicit value hash. */
  get hashCode(): number {
    return dartIdentityHash(this);
  }
  override toString(options: DiagnosticsStringOptions = {}): string {
    return ['hidden', 'fine', 'debug'].includes(options.minLevel ?? 'info')
      ? super.toString(options)
      : this.debugDescription;
  }
  static get defer(): MouseCursor {
    return deferred;
  }
  static get uncontrolled(): MouseCursor {
    return uncontrolled;
  }
}
class DeferringMouseCursor extends MouseCursor {
  createSession(_device: number): MouseCursorSession {
    throw new Error('DeferringMouseCursor cannot create a session');
  }
  get debugDescription(): string {
    return 'defer';
  }
  static firstNonDeferred(cursors: Iterable<MouseCursor>): MouseCursor | null {
    for (const cursor of cursors) if (cursor !== MouseCursor.defer) return cursor;
    return null;
  }
}
class NoopMouseCursorSession extends MouseCursorSession {
  /** Source uncontrolled cursor deliberately leaves platform state to its owner. */
  async activate(): Promise<void> {}
  dispose(): void {}
}
class NoopMouseCursor extends MouseCursor {
  createSession(device: number): MouseCursorSession {
    return new NoopMouseCursorSession(this, device);
  }
  get debugDescription(): string {
    return 'uncontrolled';
  }
}
const deferred = new DeferringMouseCursor(),
  uncontrolled = new NoopMouseCursor();
class SystemMouseCursorSession extends MouseCursorSession {
  constructor(
    override readonly cursor: SystemMouseCursor,
    device: number,
    private readonly channel: MethodChannel,
  ) {
    super(cursor, device);
  }
  activate(): Promise<void> {
    return this.channel
      .invokeMethod(
        'activateSystemCursor',
        new Map<string, unknown>([
          ['device', this.device],
          ['kind', this.cursor.kind],
        ]),
      )
      .then(() => {});
  }
  /** Source system sessions have no platform resource to release. */
  dispose(): void {}
}
export class SystemMouseCursor extends MouseCursor {
  readonly kind: string;
  constructor({ kind }: { readonly kind: string }) {
    super();
    invariant(
      typeof kind === 'string' && kind.length > 0,
      'invalid-system-cursor',
      'System cursor requires a kind',
    );
    this.kind = kind;
    if (new.target === SystemMouseCursor) Object.freeze(this);
  }
  get debugDescription(): string {
    return objectRuntimeType(this, 'SystemMouseCursor') + '(' + this.kind + ')';
  }
  createSession(
    device: number,
    channel: MethodChannel = SystemChannels.mouseCursor,
  ): MouseCursorSession {
    return new SystemMouseCursorSession(this, device, channel);
  }
  override equals(other: unknown): boolean {
    return (
      other instanceof SystemMouseCursor &&
      Object.getPrototypeOf(other) === Object.getPrototypeOf(this) &&
      other.kind === this.kind
    );
  }
  override get hashCode(): number {
    return hashDoubles([...this.kind].map((character) => character.codePointAt(0)!));
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty('kind', this.kind, { level: 'debug' }));
  }
}
export class MouseCursorManager {
  private readonly lastSession = new Map<number, MouseCursorSession>();
  private live = true;
  /** @internal Normal updates consume only candidates; removal consumes the event. */
  static _usesOnlyRemovalEvent(manager: MouseCursorManager): boolean {
    return manager.handleDeviceCursorUpdate === defaultCursorUpdate;
  }
  constructor(
    readonly fallbackMouseCursor: MouseCursor,
    private readonly channel: MethodChannel = SystemChannels.mouseCursor,
  ) {
    invariant(
      fallbackMouseCursor !== MouseCursor.defer,
      'invalid-cursor-fallback',
      'Cursor fallback cannot defer',
    );
  }
  debugDeviceActiveCursor(device: number): MouseCursor | null {
    return FoundationBuildMode.debug ? (this.lastSession.get(device)?.cursor ?? null) : null;
  }
  handleDeviceCursorUpdate(
    device: number,
    triggeringEvent: PointerEvent | null,
    cursorCandidates: Iterable<MouseCursor>,
  ): void {
    if (!this.live) return;
    if (triggeringEvent instanceof PointerRemovedEvent) {
      const session = this.lastSession.get(device);
      this.lastSession.delete(device);
      session?.dispose();
      return;
    }
    const last = this.lastSession.get(device),
      next = DeferringMouseCursor.firstNonDeferred(cursorCandidates) ?? this.fallbackMouseCursor;
    if (last?.cursor.equals(next)) return;
    const session = next.createSession(device, this.channel);
    this.lastSession.set(device, session);
    try {
      last?.dispose();
    } finally {
      if (this.live && this.lastSession.get(device) === session)
        void session
          .activate()
          .catch((exception) =>
            FlutterError.reportError(
              new FlutterErrorDetails({ exception, library: 'mouse cursor service' }),
            ),
          );
    }
  }
  dispose(): void {
    if (!this.live) return;
    this.live = false;
    const sessions = [...this.lastSession.values()];
    this.lastSession.clear();
    const errors: unknown[] = [];
    for (const session of sessions)
      try {
        session.dispose();
      } catch (error) {
        errors.push(error);
      }
    if (errors.length) throw new AggregateError(errors, 'Mouse cursor manager retirement failed');
  }
}
const defaultCursorUpdate = MouseCursorManager.prototype.handleDeviceCursorUpdate;

/** Exact source system cursor names; platform mappings may differ. */
export class SystemMouseCursors {
  private constructor() {}
  static readonly none = new SystemMouseCursor({ kind: 'none' });
  static readonly basic = new SystemMouseCursor({ kind: 'basic' });
  static readonly click = new SystemMouseCursor({ kind: 'click' });
  static readonly forbidden = new SystemMouseCursor({ kind: 'forbidden' });
  static readonly wait = new SystemMouseCursor({ kind: 'wait' });
  static readonly progress = new SystemMouseCursor({ kind: 'progress' });
  static readonly contextMenu = new SystemMouseCursor({ kind: 'contextMenu' });
  static readonly help = new SystemMouseCursor({ kind: 'help' });
  static readonly text = new SystemMouseCursor({ kind: 'text' });
  static readonly verticalText = new SystemMouseCursor({ kind: 'verticalText' });
  static readonly cell = new SystemMouseCursor({ kind: 'cell' });
  static readonly precise = new SystemMouseCursor({ kind: 'precise' });
  static readonly move = new SystemMouseCursor({ kind: 'move' });
  static readonly grab = new SystemMouseCursor({ kind: 'grab' });
  static readonly grabbing = new SystemMouseCursor({ kind: 'grabbing' });
  static readonly noDrop = new SystemMouseCursor({ kind: 'noDrop' });
  static readonly alias = new SystemMouseCursor({ kind: 'alias' });
  static readonly copy = new SystemMouseCursor({ kind: 'copy' });
  static readonly disappearing = new SystemMouseCursor({ kind: 'disappearing' });
  static readonly allScroll = new SystemMouseCursor({ kind: 'allScroll' });
  static readonly resizeLeftRight = new SystemMouseCursor({ kind: 'resizeLeftRight' });
  static readonly resizeUpDown = new SystemMouseCursor({ kind: 'resizeUpDown' });
  static readonly resizeUpLeftDownRight = new SystemMouseCursor({ kind: 'resizeUpLeftDownRight' });
  static readonly resizeUpRightDownLeft = new SystemMouseCursor({ kind: 'resizeUpRightDownLeft' });
  static readonly resizeUp = new SystemMouseCursor({ kind: 'resizeUp' });
  static readonly resizeDown = new SystemMouseCursor({ kind: 'resizeDown' });
  static readonly resizeLeft = new SystemMouseCursor({ kind: 'resizeLeft' });
  static readonly resizeRight = new SystemMouseCursor({ kind: 'resizeRight' });
  static readonly resizeUpLeft = new SystemMouseCursor({ kind: 'resizeUpLeft' });
  static readonly resizeUpRight = new SystemMouseCursor({ kind: 'resizeUpRight' });
  static readonly resizeDownLeft = new SystemMouseCursor({ kind: 'resizeDownLeft' });
  static readonly resizeDownRight = new SystemMouseCursor({ kind: 'resizeDownRight' });
  static readonly resizeColumn = new SystemMouseCursor({ kind: 'resizeColumn' });
  static readonly resizeRow = new SystemMouseCursor({ kind: 'resizeRow' });
  static readonly zoomIn = new SystemMouseCursor({ kind: 'zoomIn' });
  static readonly zoomOut = new SystemMouseCursor({ kind: 'zoomOut' });
}

registerDartValueSemantics(MouseCursor, {
  accepts: (v: unknown): v is MouseCursor => v instanceof MouseCursor,
  equals: (v, o) => v.equals(o),
  hash: (v) => v.hashCode,
  string: (v) => v.toString(),
});
