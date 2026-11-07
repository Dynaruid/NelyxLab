// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { engineRoot, timeout } from '../tools/build.mjs';
import { CanvasKitProvider, canvasKitSupply } from '../render/canvaskit-web/provider.ts';
import { AppTextBudget } from '../platform/web/app-text.ts';
import { appTextQuotaBytes } from '../../runtime/engine-client/app-text.ts';

function supplyFetch() {
  const directory = path.join(engineRoot, 'dist');
  return async (url) => new Response(fs.readFileSync(path.join(directory, new URL(url).pathname)));
}

test(
  'Failed provider downloads settle their canceled siblings before releasing staging credit',
  { timeout },
  async () => {
    const previous = globalThis.fetch,
      supplied = supplyFetch(),
      budget = new AppTextBudget(appTextQuotaBytes);
    let abortObserved, release;
    const aborted = new Promise((resolve) => {
        abortObserved = resolve;
      }),
      retirement = new Promise((resolve) => {
        release = resolve;
      });
    globalThis.fetch = async (url, options) => {
      if (new URL(url).pathname === '/canvaskit/canvaskit.wasm')
        return new Promise((_, reject) => {
          options.signal.addEventListener(
            'abort',
            () => {
              abortObserved();
              void retirement.then(() => reject(options.signal.reason));
            },
            { once: true },
          );
        });
      if (new URL(url).pathname === '/assets/font.ttf')
        return new Response('failed', { status: 503 });
      return supplied(url);
    };
    let work;
    try {
      work = CanvasKitProvider.load('https://bootstrap.invalid/', budget);
      const rejected = assert.rejects(work, /Asset HTTP 503/);
      await aborted;
      assert.equal(budget.bytes, 48 * 1024 * 1024);
      release();
      await rejected;
      assert.equal(budget.bytes, 0);
    } finally {
      release();
      await work?.catch(() => {});
      globalThis.fetch = previous;
    }
  },
);

test(
  'Cancellation waits for an in-flight factory and retains committed App Wasm credit after failure',
  { timeout },
  async () => {
    const previous = {
        fetch: globalThis.fetch,
        script: globalThis.importScripts,
        factory: globalThis.CanvasKitInit,
      },
      budget = new AppTextBudget(appTextQuotaBytes),
      controller = new AbortController(),
      reason = Error('controlled close');
    let entered,
      release,
      settled = false;
    const entering = new Promise((resolve) => {
        entered = resolve;
      }),
      finishing = new Promise((resolve) => {
        release = resolve;
      });
    globalThis.fetch = supplyFetch();
    globalThis.importScripts = () => {};
    globalThis.CanvasKitInit = async () => {
      entered();
      await finishing;
      // The normal browser suite separately checks the real owned Wasm heap.
      return { HEAPU8: { byteLength: canvasKitSupply.initialMemoryBytes } };
    };
    let work;
    try {
      work = CanvasKitProvider.load('https://bootstrap.invalid/', budget, controller.signal);
      void work.then(
        () => {
          settled = true;
        },
        () => {
          settled = true;
        },
      );
      const rejected = assert.rejects(work, (error) => error === reason);
      await entering;
      controller.abort(reason);
      await Promise.resolve();
      assert.equal(settled, false);
      assert.equal(budget.bytes, 48 * 1024 * 1024 + canvasKitSupply.initialMemoryBytes);
      release();
      await rejected;
      assert.equal(budget.bytes, canvasKitSupply.initialMemoryBytes);
      assert.throws(() => budget.reserve(4, 1), /closed/);
    } finally {
      release();
      await work?.catch(() => {});
      globalThis.fetch = previous.fetch;
      if (previous.script === undefined) delete globalThis.importScripts;
      else globalThis.importScripts = previous.script;
      if (previous.factory === undefined) delete globalThis.CanvasKitInit;
      else globalThis.CanvasKitInit = previous.factory;
    }
  },
);
