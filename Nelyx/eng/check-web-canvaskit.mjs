// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import CanvasKitInit from 'canvaskit-wasm';
import { ResourceRegistry } from '@nelyx/core/hosting/resources';
import { WebSkiaLibrary } from '@nelyx/skia-web/library';
import { readWebRuntime } from '../sdk/tooling/contracts/src/web-runtime.mjs';

test(
  'npm CanvasKit preserves line indices and the soft-hyphen policy',
  { timeout: 1_200_000 },
  async () => {
    const root = new URL('../../', import.meta.url);
    const { runtime } = readWebRuntime(fileURLToPath(root));
    const ck = await CanvasKitInit({
      wasmBinary: runtime.find(({ file }) => file.id === 'canvaskit.wasm').bytes,
    });
    const resources = new ResourceRegistry();
    const library = new WebSkiaLibrary(
      ck,
      () => {
        throw new Error('The text test does not require a canvas');
      },
      { id: 'canvaskit', generation: 1 },
    );
    const font = { id: 'sample-font', generation: 1 };
    const bytes = readFileSync(new URL('sample/nelyx-demo-app/assets/NotoSansKR.ttf', root));
    library.bind(resources);
    resources.register({ ...font, kind: 'font' }, library.restoreFont(font, 'Sample', bytes));

    const layout = (text, options) =>
      library.layout(
        {
          text,
          width: 210,
          font,
          fontSize: 24,
          locale: 'ko',
          direction: 'ltr',
          scale: 1,
          ...options,
        },
        { transient: true },
      );

    try {
      const mixed = layout('안녕\n👋e\u0301\nשלום');
      try {
        assert.equal(mixed.lines.length, 3);
        for (const [offset, line] of [
          [0, 0],
          [1, 0],
          [3, 1],
          [4, 1],
          [5, 1],
          [6, 1],
          [8, 2],
          [11, 2],
          [12, null],
        ])
          assert.equal(library.lineNumberAt(mixed, offset), line, 'UTF-16 offset ' + offset);
        for (const line of mixed.lines) assert.ok(Number.isFinite(line.metrics?.unscaledAscent));
      } finally {
        resources.releaseProducer(mixed.resource);
      }

      for (const [body, width, paintsHyphen] of [
        ['ab\u00adcd', 42, true],
        ['ab\u00adcd', 100, false],
        ['ab\u00ad', 42, false],
        ['ab\u00ad\ncd', 42, true],
        ['ab\u00ad cd', 42, true],
      ]) {
        const manual = layout(body, { width, hyphens: 'manual' });
        const hidden = layout(body, { width, hyphens: 'hidden' });
        try {
          assert.deepEqual(manual.lines, hidden.lines);
          assert.equal(manual.longestLine > hidden.longestLine, paintsHyphen, JSON.stringify(body));
        } finally {
          resources.releaseProducer(manual.resource);
          resources.releaseProducer(hidden.resource);
        }
      }
    } finally {
      resources.releaseProducer(font);
      await library.dispose();
    }
  },
);
