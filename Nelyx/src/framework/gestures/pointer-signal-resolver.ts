// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import type { PointerSignalEvent } from './events.ts';
import { invariant, exceptionStack } from '../../foundation/errors.ts';
import { FlutterError } from '../../foundation/flutter-error.ts';
import { FlutterErrorDetails } from '../../foundation/assertions.ts';
import { ErrorDescription, DiagnosticsProperty } from '../../foundation/diagnostics.ts';
export type PointerSignalResolvedCallback = (event: PointerSignalEvent) => void;
function isSameEvent(first: PointerSignalEvent, second: PointerSignalEvent): boolean {
  return (first.original ?? first) === (second.original ?? second);
}
/** Source first-registration-wins disambiguation. The selected callback owns
 * its response; an unregistered signal allows the producer's default action. */
export class PointerSignalResolver {
  private firstRegisteredCallback: PointerSignalResolvedCallback | null = null;
  private currentEvent: PointerSignalEvent | null = null;
  private resolving = false;
  register(event: PointerSignalEvent, callback: PointerSignalResolvedCallback): void {
    invariant(
      this.currentEvent === null || isSameEvent(this.currentEvent, event),
      'different-pointer-signal',
      'Resolve the current pointer signal before registering another',
    );
    if (this.firstRegisteredCallback) return;
    this.currentEvent = event;
    this.firstRegisteredCallback = callback;
  }
  /** A retiring View drops only this admitted signal, never another owner's.
   * A callback already executing still owns its response and finally cleanup. */
  cancel(event: PointerSignalEvent): void {
    if (this.resolving) return;
    if (this.currentEvent !== null && !isSameEvent(this.currentEvent, event)) return;
    this.firstRegisteredCallback = null;
    this.currentEvent = null;
    event.respond({ allowPlatformDefault: true });
  }
  resolve(event: PointerSignalEvent): void {
    invariant(
      !this.resolving,
      'reentrant-pointer-signal-resolution',
      'Pointer signal resolution cannot be nested',
    );
    if (!this.firstRegisteredCallback) {
      invariant(
        this.currentEvent === null,
        'invalid-pointer-signal-state',
        'Pointer signal callback is missing',
      );
      event.respond({ allowPlatformDefault: true });
      return;
    }
    invariant(
      this.currentEvent !== null && isSameEvent(this.currentEvent, event),
      'different-pointer-signal',
      'Resolved signal differs from the current event',
    );
    this.resolving = true;
    try {
      this.firstRegisteredCallback(this.currentEvent);
    } catch (exception) {
      FlutterError.reportError(
        new FlutterErrorDetails({
          exception,
          stack: exceptionStack(exception),
          library: 'gesture library',
          context: new ErrorDescription('while resolving a PointerSignalEvent'),
          informationCollector: () => [
            new DiagnosticsProperty('Event', event, { style: 'errorProperty' }),
          ],
        }),
      );
    } finally {
      this.firstRegisteredCallback = null;
      this.currentEvent = null;
      this.resolving = false;
    }
  }
}
