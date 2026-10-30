// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from the pinned Flutter foundation/assertions.dart.
import { FoundationBuildMode } from './constants.ts';
import { TextTreeRenderer } from './diagnostics-text.ts';
import { invariant } from './errors.ts';
import { StackFrame } from './stack-frame.ts';
import { debugPrint } from './print.ts';
import {
  DiagnosticsProperty,
  DiagnosticableNode,
  ErrorSummary,
  ErrorDescription,
  ErrorHint,
} from './diagnostics.ts';
import type {
  DiagnosticsNode,
  Diagnosticable,
  DiagnosticsOptions,
  DiagnosticPropertiesBuilder,
} from './diagnostics.ts';
import type {
  FlutterExceptionHandler,
  FlutterErrorDetails,
  StackTraceDemangler,
} from './assertions.ts';

export class FlutterError extends Error implements Diagnosticable {
  declare readonly message: string;
  readonly diagnostics: readonly DiagnosticsNode[];
  constructor(message: string) {
    const lines = message.split('\n');
    super();
    this.name = 'FlutterError';
    this.diagnostics = [
      new ErrorSummary(lines[0]!),
      ...lines.slice(1).map((line) => new ErrorDescription(line)),
    ];
    Object.defineProperty(this, 'message', { configurable: true, get: () => this.toString() });
  }
  static fromParts(diagnostics: readonly DiagnosticsNode[]): FlutterError {
    const error = new FlutterError('');
    error.setParts(diagnostics);
    if (this.debugMode) {
      if (!diagnostics.length)
        throw FlutterError.fromParts([new ErrorSummary('Empty FlutterError')]);
      const reportHint = new ErrorDescription(
        '\nThis error should still help you solve your problem, however please also report this malformed error in the framework by filing a bug on GitHub:\n  https://github.com/flutter/flutter/issues/new?template=02_bug.yml',
      );
      if (diagnostics[0]!.level !== 'summary')
        throw FlutterError.fromParts([
          new ErrorSummary('FlutterError is missing a summary.'),
          new ErrorDescription(
            'All FlutterError objects should start with a short (one line) summary description of the problem that was detected.',
          ),
          new DiagnosticsProperty('Malformed', error, {
            expandableValue: true,
            showSeparator: false,
            style: 'whitespace',
          }),
          reportHint,
        ]);
      const summaries = diagnostics.filter((node) => node.level === 'summary');
      if (summaries.length > 1)
        throw FlutterError.fromParts([
          new ErrorSummary('FlutterError contained multiple error summaries.'),
          new ErrorDescription(
            'All FlutterError objects should have only a single short (one line) summary description of the problem that was detected.',
          ),
          new DiagnosticsProperty('Malformed', error, {
            expandableValue: true,
            showSeparator: false,
            style: 'whitespace',
          }),
          new ErrorDescription(`\nThe malformed error has ${summaries.length} summaries.`),
          ...summaries.map(
            (summary, i) =>
              new DiagnosticsProperty('Summary ' + (i + 1), summary, { expandableValue: true }),
          ),
          reportHint,
        ]);
    }
    return error;
  }
  private setParts(parts: readonly DiagnosticsNode[]): void {
    Object.defineProperty(this, 'diagnostics', {
      value: parts,
      writable: false,
      configurable: true,
      enumerable: true,
    });
  }
  /** Explicit app configuration, replacing Dart compile-time assertions/release flags. */
  static get debugMode(): boolean {
    return FoundationBuildMode.debug;
  }
  static set debugMode(value: boolean) {
    FoundationBuildMode.mode = value ? 'debug' : 'release';
  }
  static demangleStackTrace: StackTraceDemangler = (stack) => stack;
  static presentError: FlutterExceptionHandler = (details) =>
    FlutterError.dumpErrorToConsole(details);
  static onError: FlutterExceptionHandler | null = FlutterError.presentError;
  private static _errorCount = 0;
  static readonly wrapWidth = 100;
  private static readonly _stackFilters: StackFilter[] = [];
  static resetErrorCount(): void {
    this._errorCount = 0;
  }
  static reportError(details: FlutterErrorDetails): void {
    this.onError?.(details);
  }
  static dumpErrorToConsole(
    details: FlutterErrorDetails,
    { forceReport = false }: { readonly forceReport?: boolean } = {},
  ): void {
    if (!this.debugMode && details.silent && !forceReport) return;
    if (this._errorCount === 0 || forceReport) {
      if (this.debugMode) ErrorToConsoleDumper.dump(details.toString().trimEnd());
      else
        debugPrintStack({
          stackTrace: details.stack,
          label: String(details.exception),
          maxFrames: 100,
        });
    } else ErrorToConsoleDumper.dump('Another exception was thrown: ' + details.summary);
    this._errorCount++;
  }
  static addDefaultStackFilter(filter: StackFilter): void {
    this._stackFilters.push(filter);
  }
  static defaultStackFilter(frames: Iterable<string>): string[] {
    const removed = new Map<string, number>(
        [
          'dart:async-patch',
          'dart:async',
          'package:stack_trace',
          'class _AssertionError',
          'class _FakeAsync',
          'class _FrameCallbackEntry',
          'class _Timer',
          'class _RawReceivePortImpl',
        ].map((key) => [key, 0]),
      ),
      parsed = StackFrame.fromStackString(Array.from(frames).join('\n'));
    let skipped = 0;
    const kept: StackFrame[] = [];
    for (const frame of parsed) {
      const className = 'class ' + frame.className,
        packaged = frame.packageScheme + ':' + frame.package,
        key = removed.has(className) ? className : removed.has(packaged) ? packaged : null;
      if (key !== null) {
        skipped++;
        removed.set(key, removed.get(key)! + 1);
      } else kept.push(frame);
    }
    const reasons: (string | null)[] = kept.map(() => null);
    for (const filter of this._stackFilters) filter.filter(kept, reasons);
    const result: string[] = [];
    for (let index = 0; index < kept.length; index++) {
      const start = index;
      while (
        index < reasons.length - 1 &&
        reasons[index] !== null &&
        reasons[index + 1] === reasons[index]
      )
        index++;
      const suffix =
        reasons[index] !== null
          ? index !== start
            ? ` (${index - start + 2} frames)`
            : ' (1 frame)'
          : '';
      result.push((reasons[index] ?? kept[index]!.source) + suffix);
    }
    const where = [...removed]
      .filter(([, count]) => count > 0)
      .map(([name]) => name)
      .sort();
    if (skipped === 1) result.push('(elided one frame from ' + where[0] + ')');
    else if (skipped > 1) {
      if (where.length > 1) where[where.length - 1] = 'and ' + where.at(-1);
      result.push(`(elided ${skipped} frames from ${where.join(where.length > 2 ? ', ' : ' ')})`);
    }
    return result;
  }
  debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    for (const node of this.diagnostics) properties.add(node);
  }
  toStringShort(): string {
    return 'FlutterError';
  }
  override toString(): string {
    if (FoundationBuildMode.release)
      return (
        this.diagnostics
          .find(
            (node) =>
              node instanceof ErrorSummary ||
              node instanceof ErrorDescription ||
              node instanceof ErrorHint,
          )
          ?.toDescription() ?? this.toStringShort()
      );
    const renderer = new TextTreeRenderer({ wrapWidth: 4000000000 });
    return this.diagnostics.map((node) => renderer.render(node).trimEnd()).join('\n');
  }
  toDiagnosticsNode(o: DiagnosticsOptions = {}): DiagnosticsNode {
    return new DiagnosticableNode(this, o);
  }
}

export class ErrorToConsoleDumper {
  /** SDK bootstrap selects the source conditional-console branch for this realm. */
  static useWebConsole = false;
  private static readonly _listeners: ((message: string) => void)[] = [];
  static dump: (message: string) => void = (message) => {
    if (!this.useWebConsole) {
      debugPrint(message);
      return;
    }
    const console = (globalThis as { console?: { error(message: string): void } }).console;
    console?.error(message);
    this._notifyListeners(message);
  };
  static addWebDumpListener(listener: (message: string) => void): void {
    if (this.useWebConsole) this._listeners.push(listener);
  }
  static clearWebDumpListeners(): void {
    if (this.useWebConsole) this._listeners.length = 0;
  }
  private static _notifyListeners(message: string): void {
    const length = this._listeners.length;
    for (let i = 0; ; i++) {
      if (this._listeners.length !== length) {
        const error = new Error('ErrorToConsoleDumper listeners changed during notification');
        error.name = 'ConcurrentModificationError';
        throw error;
      }
      if (i === length) return;
      this._listeners[i]!(message);
    }
  }
}

export function debugPrintStack({
  stackTrace,
  label,
  maxFrames,
}: {
  readonly stackTrace?: string | null;
  readonly label?: string | null;
  readonly maxFrames?: number | null;
} = {}): void {
  if (label !== undefined && label !== null) ErrorToConsoleDumper.dump(label);
  let lines = (
    stackTrace === undefined || stackTrace === null
      ? (new Error().stack ?? '')
      : FlutterError.demangleStackTrace(stackTrace)
  )
    .trimEnd()
    .split('\n');
  if (maxFrames !== undefined && maxFrames !== null) lines = lines.slice(0, maxFrames);
  ErrorToConsoleDumper.dump(FlutterError.defaultStackFilter(lines).join('\n'));
}

export class PartialStackFrame {
  static isWeb = false;
  static readonly asynchronousSuspension = new PartialStackFrame({
    package: '',
    className: '',
    method: 'asynchronous suspension',
  });
  readonly package: string | RegExp;
  readonly className: string;
  readonly method: string;
  constructor(o: {
    readonly package: string | RegExp;
    readonly className: string;
    readonly method: string;
  }) {
    this.package = o.package;
    this.className = o.className;
    this.method = o.method;
  }
  matches(frame: StackFrame): boolean {
    const uri = frame.packageScheme + ':' + frame.package + '/' + frame.packagePath;
    let matched: boolean;
    if (typeof this.package === 'string') matched = uri.includes(this.package);
    else {
      const previous = this.package.lastIndex;
      try {
        this.package.lastIndex = 0;
        matched = this.package.test(uri);
      } finally {
        this.package.lastIndex = previous;
      }
    }
    return (
      matched &&
      frame.method ===
        (PartialStackFrame.isWeb && this.method.startsWith('_')
          ? '[' + this.method + ']'
          : this.method) &&
      (PartialStackFrame.isWeb || frame.className === this.className)
    );
  }
}

export abstract class StackFilter {
  abstract filter(frames: StackFrame[], reasons: (string | null)[]): void;
}

export class RepetitiveStackFrameFilter extends StackFilter {
  readonly frames: readonly PartialStackFrame[];
  readonly replacement: string;
  constructor(o: { readonly frames: readonly PartialStackFrame[]; readonly replacement: string }) {
    super();
    invariant(
      o.frames.length > 0,
      'empty-stack-filter',
      'Repetitive stack filters require a nonempty frame pattern',
    );
    this.frames = o.frames;
    this.replacement = o.replacement;
  }
  get numFrames(): number {
    return this.frames.length;
  }
  filter(stackFrames: StackFrame[], reasons: (string | null)[]): void {
    for (let index = 0; index < stackFrames.length - this.numFrames; index++)
      if (this._matchesFrames(stackFrames.slice(index, index + this.numFrames))) {
        for (let offset = 0; offset < this.numFrames; offset++)
          reasons[index + offset] = this.replacement;
        index += this.numFrames - 1;
      }
  }
  private _matchesFrames(frames: StackFrame[]): boolean {
    return (
      frames.length >= this.numFrames &&
      this.frames.every((frame, index) => frame.matches(frames[index]!))
    );
  }
}
