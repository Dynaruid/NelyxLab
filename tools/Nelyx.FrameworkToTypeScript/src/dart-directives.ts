// SPDX-License-Identifier: BSD-3-Clause
/** Lex only the directive prefix for cache dependency admission. Every URI,
 * including conditional alternatives and part-of owners, is included. The Dart
 * analyzer remains responsible for syntax, resolution and all body semantics. */
export function dartDirectiveUris(source: string): string[] {
  let at = source.startsWith('#!') ? Math.max(0, source.indexOf('\n')) : 0;
  const uris: string[] = [];
  function space() {
    for (;;) {
      while (/\s/.test(source[at] ?? '') && at < source.length) at++;
      if (source.startsWith('//', at)) {
        const end = source.indexOf('\n', at);
        at = end < 0 ? source.length : end + 1;
        continue;
      }
      if (source.startsWith('/*', at)) {
        at += 2;
        let depth = 1;
        while (depth && at < source.length) {
          if (source.startsWith('/*', at)) {
            depth++;
            at += 2;
          } else if (source.startsWith('*/', at)) {
            depth--;
            at += 2;
          } else at++;
        }
        if (depth) throw new Error('Unterminated Dart directive comment');
        continue;
      }
      break;
    }
  }
  function string(): string {
    const raw = source[at] === 'r';
    if (raw) at++;
    const quote = source[at]!;
    if (quote !== "'" && quote !== '"') throw new Error('Expected Dart directive string');
    const delimiter = source.startsWith(quote.repeat(3), at) ? quote.repeat(3) : quote;
    at += delimiter.length;
    let value = '';
    while (at < source.length) {
      if (source.startsWith(delimiter, at)) {
        at += delimiter.length;
        return value;
      }
      const char = source[at++]!;
      if (!raw && char === '$') throw new Error('Interpolated directive URI cannot be cached');
      if (raw || char !== '\\') {
        value += char;
        continue;
      }
      const escape = source[at++];
      if (escape === undefined) throw new Error('Unterminated Dart directive escape');
      const simple: Record<string, string> = {
        n: '\n',
        r: '\r',
        t: '\t',
        b: '\b',
        f: '\f',
        v: '\v',
      };
      if (escape in simple) value += simple[escape];
      else if (escape === 'u' || escape === 'x') {
        const braced = escape === 'u' && source[at] === '{';
        if (braced) at++;
        const end = braced ? source.indexOf('}', at) : at + (escape === 'u' ? 4 : 2),
          digits = source.slice(at, end);
        if (
          end < at ||
          !/^[a-fA-F0-9]+$/.test(digits) ||
          (!braced && digits.length !== (escape === 'u' ? 4 : 2))
        )
          throw new Error('Invalid Dart directive escape');
        value += String.fromCodePoint(Number.parseInt(digits, 16));
        at = end + (braced ? 1 : 0);
      } else if (['\\', "'", '"', '$'].includes(escape)) value += escape;
      else throw new Error('Unsupported Dart directive escape');
    }
    throw new Error('Unterminated Dart directive string');
  }
  const isString = () =>
    source[at] === "'" ||
    source[at] === '"' ||
    (source[at] === 'r' && (source[at + 1] === "'" || source[at + 1] === '"'));
  function throughSemicolon(collect: boolean) {
    while (at < source.length) {
      space();
      if (source[at] === ';') {
        at++;
        return;
      }
      if (isString()) {
        const uri = string();
        if (collect) uris.push(uri);
      } else at++;
    }
    throw new Error('Unterminated Dart directive');
  }
  for (;;) {
    space();
    if (at === source.length) break;
    if (source[at] === '@') {
      // Metadata may precede a library/import. Skip its balanced arguments,
      // never interpret strings in metadata as dependency URIs.
      at++;
      while (/[a-zA-Z0-9_.$]/.test(source[at] ?? '') && at < source.length) at++;
      space();
      if (source[at] === '(') {
        at++;
        let depth = 1;
        while (depth && at < source.length) {
          space();
          if (isString()) string();
          else {
            if (source[at] === '(') depth++;
            if (source[at] === ')') depth--;
            at++;
          }
        }
        if (depth) throw new Error('Unterminated directive metadata');
      }
      continue;
    }
    const token = /^[a-zA-Z_$][a-zA-Z0-9_$]*/.exec(source.slice(at))?.[0];
    if (token === 'augment')
      throw new Error('Augmented library directives require a cache dependency policy');
    if (!token || !['library', 'import', 'export', 'part'].includes(token)) break;
    at += token.length;
    throughSemicolon(token !== 'library');
  }
  return uris;
}
