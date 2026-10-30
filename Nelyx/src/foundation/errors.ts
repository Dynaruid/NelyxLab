export class NelyxError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'NelyxError';
  }
}
export function invariant(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) throw new NelyxError(code, message);
}
/** Marker for Dart-style throwable exceptions with nullable message fields. */
export const exceptionType: unique symbol = Symbol.for('nelyx.foundation.exception');
export interface Exception {
  readonly [exceptionType]: true;
  readonly stack?: string | undefined;
  toString(): string;
}
export function isException(value: unknown): value is Exception {
  return (
    value !== null &&
    typeof value === 'object' &&
    (value as Partial<Exception>)[exceptionType] === true
  );
}
/** JavaScript capture is separate from a service exception's native stacktrace. */
export function exceptionStack(value: unknown): string | null {
  const stack = value instanceof Error || isException(value) ? value.stack : undefined;
  return typeof stack === 'string' ? stack : null;
}
/** Bounded cause chain for a host's error surface/log; the original Error retains its stack. */
export function describeError(error: unknown): string {
  const messages: string[] = [],
    seen = new Set<unknown>();
  const visit = (current: unknown, prefix: string) => {
    if (seen.size >= 8 || seen.has(current)) return;
    seen.add(current);
    if (current instanceof Error) {
      messages.push(`${prefix}${current.name}: ${current.message}`);
      if (current.cause !== undefined) visit(current.cause, 'Caused by: ');
      if (current instanceof AggregateError)
        for (const related of current.errors) visit(related, 'Related error: ');
    } else {
      try {
        messages.push(prefix + String(current));
      } catch {
        messages.push(prefix + 'Unprintable error');
      }
    }
  };
  visit(error, '');
  return messages.join('\n').slice(0, 4096);
}
