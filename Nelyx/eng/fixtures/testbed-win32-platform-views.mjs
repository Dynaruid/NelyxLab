// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { capture } from '../../sdk/tooling/cli/src/commands.mjs';
import { clickCanvasControl } from './testbed-platform-views.mjs';

export async function checkWin32PlatformViews(page, pid) {
  const manifest = JSON.parse(
    readFileSync(
      new URL('../../sdk/tooling/cli/templates/tauri/skia-foreground/supply.json', import.meta.url),
      'utf8',
    ),
  );
  const nativeScript = fileURLToPath(new URL('./testbed-win32-controls.ps1', import.meta.url));
  const native = (action = 'inspect', point) =>
    JSON.parse(
      capture(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          nativeScript,
          '-TestbedProcess',
          String(pid),
          '-Action',
          action,
          ...(point ? ['-ClickX', String(point[0]), '-ClickY', String(point[1])] : []),
        ],
        { timeout: 10000 },
      ),
    );
  const probe = await page.evaluate(() =>
    window.__TAURI__.core.invoke('windows_platform_view', { request: { action: 'probe' } }),
  );
  assert.equal(probe.skia.skiaRevision, manifest.skiaRevision);
  assert.equal(probe.skia.bindingRevision, manifest.bindingRevision);
  assert.deepEqual(
    probe.skia.targets['x86_64-pc-windows-msvc'],
    manifest.targets['x86_64-pc-windows-msvc'],
  );
  assert(probe.types.includes('nelyx.win32.edit'));
  const initial = new URL(page.url());
  const demo = new URL(initial);
  demo.searchParams.set('win32PlatformView', '1');
  await page.goto(demo.href);
  await page.locator('[aria-label*="Composited Win32 editor"]').first().waitFor();
  const waitVisible = async (visible) => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const control = native();
      if (control.visible === visible) return control;
      await delay(200);
    }
    const labels = await page
      .locator('[aria-label]')
      .evaluateAll((elements) => elements.map((element) => element.getAttribute('aria-label')));
    assert.fail('Win32 editor rendering did not settle: ' + JSON.stringify(labels));
  };
  const original = await waitVisible(true);
  assert.equal(original.className.toUpperCase(), 'EDIT');
  assert(original.foregroundHandle > 0);
  assert.deepEqual(native('accessibility'), {
    visible: 1,
    role: 42, // ROLE_SYSTEM_TEXT
    name: 'Composited Win32 editor',
    foregroundFocusable: false,
  });
  assert.deepEqual(original.editorBackground, original.windowColor);
  assert(
    original.sample.every(
      (color, channel) =>
        Math.abs(
          color -
            Math.round(([124, 100, 196][channel] * 81 + original.windowColor[channel] * 174) / 255),
        ) <= 1,
    ),
    'The card alpha must be composited over the displayed Win32 editor',
  );
  assert.equal(await page.locator('canvas[data-nelyx-platform-foreground]').count(), 0);
  const plus = native('plus');
  assert.notEqual(plus.hitClass.toUpperCase(), 'EDIT');
  await page.locator('[aria-label*="Nelyx clicks: 1"]').first().waitFor();
  const edit = native('edit');
  assert.equal(edit.hitClass.toUpperCase(), 'EDIT');
  assert.match(edit.text, /W9/);
  assert.equal(native().editorCaret, true);
  native('tab');
  await page.waitForFunction(
    () => document.activeElement?.getAttribute('aria-label') === 'Add above editor',
  );
  await page.keyboard.press('Shift+Tab');
  let editorFocused = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    editorFocused = native().editorFocused;
    if (editorFocused) break;
    await delay(250);
  }
  assert(editorFocused, 'Shift+Tab did not return keyboard focus to the Win32 editor');
  await clickCanvasControl(page, page.getByRole('button', { name: 'Hide overlay' }));
  await page.getByRole('button', { name: 'Show overlay' }).waitFor();
  const base = await waitVisible(true);
  assert.equal(base.handle, original.handle);
  assert.equal(base.foregroundHandle, 0);
  assert.deepEqual(base.sample, base.editorBackground);
  assert.equal(native('inspectSaved', original.plusPoint).hitHandle, original.handle);
  await clickCanvasControl(page, page.getByRole('button', { name: 'Show overlay' }));
  await page.getByRole('button', { name: 'Hide overlay' }).waitFor();
  await clickCanvasControl(page, page.getByRole('button', { name: 'Open composited views modal' }));
  assert.equal((await waitVisible(false)).foregroundHandle, 0);
  assert.deepEqual(native('accessibility'), {
    visible: 0,
    role: null,
    name: null,
    foregroundFocusable: false,
  });
  assert.notEqual(native('clickSaved', original.plusPoint).hitHandle, plus.hitHandle);
  const closeModal = page
    .getByRole('alertdialog', { name: 'Composited views modal' })
    .getByRole('button', { name: 'Close modal' });
  await clickCanvasControl(page, closeModal);
  const restored = await waitVisible(true);
  assert.equal(restored.handle, original.handle);
  assert(restored.foregroundHandle > 0);
  assert.deepEqual(native('accessibility'), {
    visible: 1,
    role: 42,
    name: 'Composited Win32 editor',
    foregroundFocusable: false,
  });
  await page.locator('[aria-label="Nelyx clicks: 1"]').first().waitFor();
  await page.goto(initial.href);
  await page.locator('canvas[data-nelyx-frame-ready]').first().waitFor();
  const removed = await waitVisible(false);
  assert.equal(removed.handle, 0);
  assert.equal(removed.foregroundHandle, 0);
  assert.notEqual(native('inspectSaved', original.plusPoint).hitHandle, plus.hitHandle);
  console.log(
    JSON.stringify({
      skiaRevision: probe.skia.skiaRevision,
      hwnd: 'EDIT',
      input: 'Win32',
      accessibility: 'UI Automation and MSAA',
      retainedHandle: true,
    }),
  );
}
