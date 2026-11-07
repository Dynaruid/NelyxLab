// SPDX-License-Identifier: BSD-3-Clause
import { gzipSync } from 'node:zlib';

export function networkAssetFixture() {
  const calls = [],
    pending = new Set();
  let jsonCalls = 0;
  return {
    calls,
    pending,
    handle(request, response) {
      const url = new URL(request.url, 'http://localhost');
      if (!url.pathname.startsWith('/network/')) return false;
      const name = decodeURIComponent(url.pathname);
      calls.push({ method: request.method, name, query: url.search });
      response.setHeader('Cache-Control', 'no-store');
      const send = (value, status = 200, extra = {}) => {
        const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
        response.writeHead(status, { 'Content-Length': bytes.length, ...extra });
        response.end(bytes);
      };
      if (request.method !== 'GET') {
        send('', 405);
        return true;
      }
      if (name === '/network/bytes') send(Buffer.from([1, 2, 3]));
      else if (name === '/network/utf8') send('안녕 net');
      else if (name === '/network/json') send(JSON.stringify({ value: ++jsonCalls % 9 }));
      else if (name === '/network/empty') send('');
      else if (name === '/network/gzip')
        send(gzipSync(Buffer.from('gzip-한글')), 200, { 'Content-Encoding': 'gzip' });
      else if (name === '/network/redirect') send('', 302, { Location: './bytes' });
      else if (name === '/network/한글 file')
        send(
          url.searchParams.get('q') === 'one two'
            ? Buffer.from([7, 8, 9, 10])
            : Buffer.from('bad query'),
          url.searchParams.get('q') === 'one two' ? 200 : 400,
        );
      else if (name === '/network/base/' && url.searchParams.get('asset') === 'yes')
        send(Buffer.from([4, 5]));
      else if (/^\/network\/status\/(204|206|404|500)$/.test(name))
        send('', Number(name.split('/').at(-1)));
      else if (name === '/network/short')
        send('short', 200, { 'Content-Length': 10, Connection: 'close' });
      else if (name === '/network/huge')
        send('x', 200, { 'Content-Length': 33554433, Connection: 'close' });
      else if (name === '/network/budget')
        send('x', 200, { 'Content-Length': 24 * 1024 * 1024, Connection: 'close' });
      else if (name === '/network/chunked') {
        response.writeHead(200);
        response.write('chunk-');
        setImmediate(() => response.end('한글'));
      } else if (name === '/network/stall' || name === '/network/stall-headers') {
        pending.add(response);
        response.on('close', () => pending.delete(response));
        if (name === '/network/stall') {
          response.writeHead(200);
          response.write(Buffer.from([9, 8, 7]));
        }
      } else send('', 404);
      return true;
    },
    close() {
      for (const response of pending) response.destroy();
      pending.clear();
    },
  };
}

/** Public canonical API only, also embedded unchanged in ordinary CLI apps. */
export async function networkAssetProbe(NetworkBundle, origin, successful) {
  const check = (value, message) => {
    if (!value) throw Error(message);
  };
  const base = origin + '/network/base/',
    bundle = new NetworkBundle(base);
  const first = await bundle.load('../bytes');
  first[0] = 99;
  const second = await bundle.load('../bytes');
  check(second[0] === 1 && second.buffer !== first.buffer, 'Network ByteData must be fresh');
  check((await bundle.loadString('../utf8')) === '안녕 net', 'Network UTF-8');
  check(
    (await bundle.loadString('../utf8', { cache: true })) === '안녕 net',
    'Network strings remain uncached',
  );
  let parses = 0;
  const a = await bundle.loadStructuredData('../json', (text) => {
    ++parses;
    return JSON.parse(text);
  });
  const b = await bundle.loadStructuredData('../json', (text) => {
    ++parses;
    return JSON.parse(text);
  });
  check(parses === 2 && a.value !== b.value, 'Network structured results remain uncached');
  check(
    (await bundle.loadStructuredBinaryData('../bytes', (bytes) => bytes[2])) === 3,
    'Network binary parser',
  );
  check((await bundle.loadString('../chunked')) === 'chunk-한글', 'Unknown-length stream');
  check((await bundle.loadString('../gzip')) === 'gzip-한글', 'Transparent gzip stream');
  check((await bundle.load('../empty')).length === 0, 'Empty HTTP 200');
  check((await bundle.load('../redirect'))[2] === 3, 'Platform redirect');
  check(
    (await bundle.load('../한글 file?q=one%20two#client'))[3] === 10,
    'Relative UTF-8 URL, query and fragment',
  );
  check((await bundle.load(origin + '/network/bytes'))[1] === 2, 'Absolute key');
  check((await bundle.load('?asset=yes#client'))[1] === 5, 'Query-relative key');
  const buffer = await bundle.loadBuffer('../bytes');
  check(buffer.length === 3 && !buffer.debugDisposed, 'Network immutable buffer');
  buffer.dispose();
  check(buffer.debugDisposed, 'Network buffer retirement');
  bundle.evict('../utf8');
  bundle.clear();
  check(bundle.toString().includes(base), 'Network bundle identifies its base URL');
  const result = { rawReads: 14, rawBytes: 86, bufferReads: 1, bufferBytes: 3, parses };
  if (successful) await successful(result);
  for (const status of [204, 206, 404, 500]) {
    let error;
    try {
      await bundle.load('../status/' + status);
    } catch (value) {
      error = value;
    }
    check(
      String(error).includes('HTTP status code ' + status),
      'Only HTTP 200 succeeds: ' + status,
    );
  }
  for (const key of ['../short', '../huge', 'file:///bad', '\0']) {
    let rejected = false;
    try {
      await bundle.load(key);
    } catch {
      rejected = true;
    }
    check(rejected, 'Invalid/over-budget/short network input must fail: ' + key);
  }
  let rejected = false;
  try {
    await new NetworkBundle('file:///bad/').load('x');
  } catch {
    rejected = true;
  }
  check(rejected, 'Network bundle rejects a non-HTTP base');
  return { ...result, statusFailures: 4, transportFailures: 2, invalidUrls: 3 };
}
