// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from the pinned Flutter services/message_codec.dart.
import { objectRuntimeType } from '../foundation/object.ts';
import { codecValueString } from './value-string.ts';
import { exceptionType } from '../foundation/errors.ts';
import type { Exception } from '../foundation/errors.ts';
export abstract class MessageCodec<T> {
  abstract encodeMessage(message: T | null): DataView | null;
  abstract decodeMessage(message: DataView | null): T | null;
}
export class MethodCall {
  readonly arguments: unknown;
  constructor(
    readonly method: string,
    args: unknown = null,
  ) {
    this.arguments = args;
    Object.freeze(this);
  }
  toString(): string {
    return (
      objectRuntimeType(this, 'MethodCall') +
      '(' +
      this.method +
      ', ' +
      codecValueString(this.arguments) +
      ')'
    );
  }
}
export interface ErrorEnvelope {
  readonly code: string;
  readonly message?: string | null;
  readonly details?: unknown;
}
export abstract class MethodCodec {
  abstract encodeMethodCall(methodCall: MethodCall): DataView;
  abstract decodeMethodCall(methodCall: DataView | null): MethodCall;
  abstract decodeEnvelope(envelope: DataView): unknown;
  abstract encodeSuccessEnvelope(result: unknown): DataView;
  abstract encodeErrorEnvelope(error: ErrorEnvelope): DataView;
}
/** Source exception fields stay nullable; this is a throwable class, not an Error facade. */
export class PlatformException implements Exception {
  readonly stack = new Error().stack;
  readonly [exceptionType] = true as const;
  readonly code: string;
  readonly message: string | null;
  readonly details: unknown;
  readonly stacktrace: string | null;
  constructor({
    code,
    message = null,
    details = null,
    stacktrace = null,
  }: ErrorEnvelope & { readonly stacktrace?: string | null }) {
    this.code = code;
    this.message = message;
    this.details = details;
    this.stacktrace = stacktrace;
  }
  toString(): string {
    return (
      'PlatformException(' +
      [this.code, this.message, this.details, this.stacktrace]
        .map((value) => codecValueString(value))
        .join(', ') +
      ')'
    );
  }
}
export class MissingPluginException implements Exception {
  readonly stack = new Error().stack;
  readonly [exceptionType] = true as const;
  constructor(readonly message: string | null = null) {}
  toString(): string {
    return 'MissingPluginException(' + this.message + ')';
  }
}
/** Host diagnostic representation for dart:core format failures. */
export class FormatException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FormatException';
  }
  override toString(): string {
    return 'FormatException: ' + this.message;
  }
}
