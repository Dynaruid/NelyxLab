// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { FlutterError } from '../../foundation/flutter-error.ts';
/** ESM imports are not assignable; this container is the explicit adaptation
 * of Dart's mutable top-level gesture debug flags. */
export class GestureDebug {
  static debugPrintHitTestResults = false;
  static debugPrintMouseHoverEvents = false;
  static debugPrintGestureArenaDiagnostics = false;
  static debugPrintRecognizerCallbacksTrace = false;
  static debugPrintResamplingMargin = false;
}
export function debugAssertAllGesturesVarsUnset(reason: string): boolean {
  // The pinned source intentionally omits debugPrintMouseHoverEvents here.
  if (
    FoundationBuildMode.debug &&
    (GestureDebug.debugPrintHitTestResults ||
      GestureDebug.debugPrintGestureArenaDiagnostics ||
      GestureDebug.debugPrintRecognizerCallbacksTrace ||
      GestureDebug.debugPrintResamplingMargin)
  )
    throw new FlutterError(reason);
  return true;
}
