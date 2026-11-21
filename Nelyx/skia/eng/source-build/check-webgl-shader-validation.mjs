// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { execute } from '../../../sdk/tooling/cli/src/commands.mjs';
import { checkWebRuntime } from '../prepare-web-runtime.mjs';
import { join } from 'node:path';

if (!process.argv.includes('--child')) {
  await execute(process.execPath, [import.meta.filename, '--child'], { timeout: 1_200_000 });
  process.exit(0);
}

const { directory } = checkWebRuntime();
const bytes = await readFile(join(directory, 'canvaskit.wasm'));
const origin = 'http://nelyx-runtime.test';
const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage();
  await page.route(origin + '/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/canvaskit.wasm')
      return route.fulfill({ contentType: 'application/wasm', body: bytes });
    return route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>CanvasKit</title>',
    });
  });
  await page.goto(origin);
  await page.addScriptTag({ path: join(directory, 'canvaskit.js') });
  const result = await page.evaluate(async () => {
    const kit = await window.CanvasKitInit({ locateFile: (file) => '/' + file });
    const prototype = WebGL2RenderingContext.prototype;
    const originals = {
      shaderSource: prototype.shaderSource,
      compileShader: prototype.compileShader,
      getShaderParameter: prototype.getShaderParameter,
      getProgramParameter: prototype.getProgramParameter,
      useProgram: prototype.useProgram,
    };
    function draw(rejectShader) {
      const element = Object.assign(document.createElement('canvas'), { width: 64, height: 64 });
      const handle = kit.GetWebGLContext(element, { majorVersion: 2, antialias: 0 });
      const context = kit.MakeWebGLContext(handle);
      const surface = kit.MakeOnScreenGLSurface(context, 64, 64, kit.ColorSpace.SRGB);
      const paint = new kit.Paint();
      const failedPrograms = new Set();
      const operations = [];
      let usedFailedProgram = false;
      prototype.shaderSource = function (shader, source) {
        return originals.shaderSource.call(this, shader, rejectShader ? 'invalid GLSL' : source);
      };
      prototype.compileShader = function (shader) {
        operations.push('compile');
        return originals.compileShader.call(this, shader);
      };
      prototype.getShaderParameter = function (shader, pname) {
        if (pname === this.COMPILE_STATUS) operations.push('compile-status');
        return originals.getShaderParameter.call(this, shader, pname);
      };
      prototype.getProgramParameter = function (program, pname) {
        const value = originals.getProgramParameter.call(this, program, pname);
        if (pname === this.LINK_STATUS) {
          operations.push(value ? 'link-ok' : 'link-failed');
          if (!value) failedPrograms.add(program);
        }
        return value;
      };
      prototype.useProgram = function (program) {
        usedFailedProgram ||= failedPrograms.has(program);
        return originals.useProgram.call(this, program);
      };
      try {
        const canvas = surface.getCanvas();
        canvas.clear(kit.WHITE);
        paint.setColor(kit.RED);
        paint.setAntiAlias(true);
        canvas.drawCircle(32, 32, 16, paint);
        surface.flush();
        const pixel = canvas.readPixels(32, 32, {
          width: 1,
          height: 1,
          colorType: kit.ColorType.RGBA_8888,
          alphaType: kit.AlphaType.Unpremul,
          colorSpace: kit.ColorSpace.SRGB,
        });
        return { operations, pixel: Array.from(pixel), usedFailedProgram };
      } finally {
        Object.assign(prototype, originals);
        paint.delete();
        surface.delete();
        context.delete();
        kit.deleteContext(handle);
      }
    }
    return { valid: draw(false), invalid: draw(true) };
  });
  for (const [trace, status] of [
    [result.valid, 'link-ok'],
    [result.invalid, 'link-failed'],
  ]) {
    assert.deepEqual(trace.operations.slice(0, 3), ['compile', 'compile', status]);
    assert.equal(trace.operations.includes('compile-status'), false);
    assert.equal(trace.usedFailedProgram, false);
  }
  assert.deepEqual(result.valid.pixel, [255, 0, 0, 255]);
  assert.deepEqual(result.invalid.pixel, [255, 255, 255, 255]);
  console.log(
    'PASS WebGL2 links after compiling both stages and rejects invalid shaders before use',
  );
} finally {
  await browser.close();
}
