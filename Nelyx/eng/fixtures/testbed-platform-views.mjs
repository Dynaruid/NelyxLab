// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';

const editorType = '[data-nelyx-platform-view="testbed.composited-editor"]';
const frameType = '[data-nelyx-platform-view="testbed.composited-frame"]';
const foreground = 'canvas[data-nelyx-platform-foreground]';
const labelContaining = (page, text) =>
  page.locator('[aria-label*=' + JSON.stringify(text) + ']').first();

export async function clickCanvasControl(page, locator) {
  await locator.waitFor({ state: 'visible' });
  const box = await locator.boundingBox();
  assert(box && box.width > 0 && box.height > 0, 'Missing Nelyx hit bounds');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  return box;
}

async function pixel(page, x, y) {
  const png = await page.screenshot({ scale: 'css' });
  return page.evaluate(
    async ({ image, x, y }) => {
      const bytes = Uint8Array.from(atob(image), (char) => char.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      try {
        const canvas = new OffscreenCanvas(1, 1);
        const context = canvas.getContext('2d');
        context.drawImage(bitmap, -Math.floor(x), -Math.floor(y));
        return [...context.getImageData(0, 0, 1, 1).data];
      } finally {
        bitmap.close();
      }
    },
    { image: png.toString('base64'), x, y },
  );
}

export async function openPlatformViews(page) {
  await page.locator('canvas[data-nelyx-frame-ready="true"]').first().waitFor({ state: 'visible' });
  assert.equal(await page.locator(foreground).count(), 0);
  await clickCanvasControl(page, await navigationTab(page, /^Composited views(?:,|$)/, 7));
}

async function navigationTab(page, name, index) {
  const labelled = page.getByRole('tab', { name });
  if ((await labelled.count()) === 1) return labelled;
  for (const list of await page.getByRole('tablist').all()) {
    const tabs = list.getByRole('tab');
    if ((await tabs.count()) === 8) return tabs.nth(index);
  }
  return labelled;
}

export async function checkTestbedPlatformViews(
  page,
  { denied = false, extended = true, contextRecovery = false, legacyViews = false } = {},
) {
  await openPlatformViews(page);
  const editor = page.locator(editorType + ' textarea');
  const iframe = page.locator(frameType + ' iframe');
  const frame = page.frameLocator(frameType + ' iframe');
  const addEditor = page.getByRole('button', { name: 'Add above editor' });
  const addFrame = page.getByRole('button', { name: 'Add above iframe' });
  const frameButton = frame.getByRole('button', { name: /Frame clicks:/ });
  await editor.waitFor({ state: 'visible' });
  await page.locator(foreground).first().waitFor({ state: 'visible' });
  if (denied) {
    await labelContaining(page, 'HTML document unavailable').waitFor();
    await labelContaining(page, 'The iframe did not send a verified ready message.').waitFor();
    assert.equal(await iframe.count(), 0);
    return;
  }

  await labelContaining(page, 'HTML document ready').waitFor();
  await iframe.waitFor({ state: 'visible' });
  const id = await page.locator(editorType).getAttribute('id');
  const iframeId = await page.locator(frameType).getAttribute('id');
  assert(id && iframeId);
  const editorOwner = page.locator('[aria-owns="' + id + '"]');
  assert.equal(await editorOwner.count(), 1);
  assert.equal(await editorOwner.getAttribute('aria-hidden'), null);
  assert.equal(await editorOwner.getAttribute('tabindex'), null);
  await clickCanvasControl(page, addEditor);
  await labelContaining(page, 'Nelyx clicks: 1').waitFor();
  const rect = await editor.boundingBox();
  assert(rect);
  // Click the tinted part of the real textarea, beyond the overlaid button.
  await page.mouse.click(rect.x + rect.width - 105, rect.y + 86);
  assert(await editor.evaluate((element) => element === document.activeElement));
  await page.keyboard.insertText('입력확인');
  const value = await editor.inputValue();
  assert.match(value, /입력확인/);
  await page.keyboard.press('Shift+ArrowLeft');
  const selection = await editor.evaluate((element) => [
    element.selectionStart,
    element.selectionEnd,
  ]);
  assert(selection[1] > selection[0]);
  const tinted = await pixel(page, rect.x + rect.width - 105, rect.y + 86);
  await frameButton.click();
  assert.equal(await frameButton.innerText(), 'Frame clicks: 1');
  await clickCanvasControl(page, addFrame);
  await labelContaining(page, 'Nelyx clicks: 2').waitFor();
  assert.equal(await frameButton.innerText(), 'Frame clicks: 1');

  if (!extended) return;
  const text = frame.locator('p').first();
  const line = await text.boundingBox();
  assert(line);
  await page.mouse.move(line.x + 4, line.y + line.height / 2);
  await page.mouse.down();
  await page.mouse.move(line.x + 140, line.y + line.height / 2, { steps: 8 });
  await page.mouse.up();
  assert.match(
    await text.evaluate((element) => element.ownerDocument.getSelection().toString()),
    /\w{3}/,
  );
  await clickCanvasControl(page, page.getByRole('button', { name: 'Hide overlay' }));
  await page.getByRole('button', { name: 'Show overlay' }).waitFor();
  await page.waitForFunction(
    () => document.querySelectorAll('[data-nelyx-platform-input]').length === 0,
  );
  await page.locator(foreground).first().waitFor({ state: 'detached' });
  const base = await pixel(page, rect.x + rect.width - 105, rect.y + 86);
  assert.notDeepEqual(tinted, base, 'The tinted card did not change the composited pixels');
  assert.deepEqual(base.slice(0, 3), [250, 248, 255]);
  for (let channel = 0; channel < 3; channel++)
    assert(tinted[channel] > 120, 'The tinted card hid the editor background');
  assert.equal(await editor.inputValue(), value);
  await clickCanvasControl(page, page.getByRole('button', { name: 'Show overlay' }));
  await addEditor.waitFor();

  await addEditor.focus();
  await page.keyboard.press('Shift+Tab');
  assert(await editor.evaluate((element) => element === document.activeElement));
  await page.keyboard.press('Tab');
  assert(await addEditor.evaluate((element) => element === document.activeElement));
  await page.keyboard.press('Enter');
  await labelContaining(page, 'Nelyx clicks: 3').waitFor();

  const before = await editor.boundingBox();
  await clickCanvasControl(page, page.getByRole('button', { name: 'Reverse views' }));
  await page.waitForFunction(
    ({ selector, oldY }) => document.querySelector(selector)?.getBoundingClientRect().y > oldY + 20,
    { selector: editorType, oldY: before.y },
  );
  assert.equal(await page.locator(editorType).getAttribute('id'), id);
  assert.equal(await page.locator(frameType).getAttribute('id'), iframeId);
  assert.equal(await editor.inputValue(), value);
  assert.deepEqual(
    await editor.evaluate((element) => [element.selectionStart, element.selectionEnd]),
    selection,
  );
  assert.equal(await frameButton.innerText(), 'Frame clicks: 1');

  const reverseEditor = await editor.boundingBox();
  await page.mouse.move(reverseEditor.x - 12, reverseEditor.y + 25);
  await page.mouse.wheel(0, 64);
  await page.waitForFunction(
    ({ selector, oldY }) => document.querySelector(selector)?.getBoundingClientRect().y < oldY - 15,
    { selector: editorType, oldY: reverseEditor.y },
  );
  assert.equal(await page.locator(editorType).getAttribute('id'), id);

  const underneath = await editor.boundingBox();
  await clickCanvasControl(page, page.getByRole('button', { name: 'Open composited views modal' }));
  const closeModal = page
    .getByRole('alertdialog', { name: 'Composited views modal' })
    .getByRole('button', { name: 'Close modal' });
  await closeModal.waitFor();
  await page.waitForFunction(
    (selector) => document.querySelector(selector)?.inert === true,
    editorType,
  );
  await page.mouse.click(underneath.x + 18, underneath.y + 18);
  await page.keyboard.press('Tab');
  assert(!(await editor.evaluate((element) => element === document.activeElement)));
  assert.equal(await editor.inputValue(), value);
  await clickCanvasControl(page, closeModal);
  await page.waitForFunction(
    (selector) => document.querySelector(selector)?.inert === false,
    editorType,
  );
  await labelContaining(page, 'Nelyx clicks: 3').waitFor();
  await clickCanvasControl(page, addEditor);
  await labelContaining(page, 'Nelyx clicks: 4').waitFor();

  if (contextRecovery) {
    await page
      .locator('canvas[data-nelyx-render-path="direct"]')
      .first()
      .evaluate((canvas) => {
        const loss = canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context');
        if (!loss) throw new Error('Direct WebGL context loss extension is unavailable');
        window.restoreTestbedContext = () => loss.restoreContext();
        loss.loseContext();
      });
    await page.waitForFunction(
      (selector) => document.querySelector(selector)?.inert === true,
      editorType,
    );
    await page.evaluate(() => {
      window.restoreTestbedContext();
      delete window.restoreTestbedContext;
    });
    await page.waitForFunction(
      (selector) => document.querySelector(selector)?.inert === false,
      editorType,
    );
    assert.equal(await page.locator(editorType).getAttribute('id'), id);
    assert.equal(await editor.inputValue(), value);
    await clickCanvasControl(page, addEditor);
    await labelContaining(page, 'Nelyx clicks: 5').waitFor();
  }

  await clickCanvasControl(page, await navigationTab(page, /^Components(?:,|$)/, 0));
  await page.locator(editorType).waitFor({ state: 'detached' });
  await page.locator(foreground).first().waitFor({ state: 'detached' });
  assert.equal(await page.locator('[data-nelyx-platform-input]').count(), 0);
  if (legacyViews) {
    await clickCanvasControl(page, await navigationTab(page, /^WebView(?:,|$)/, 5));
    await page
      .frameLocator('iframe[title="Local WebView sample"]')
      .getByRole('heading', { name: 'Interactive local HTML' })
      .waitFor();
    await clickCanvasControl(page, await navigationTab(page, /^Texture(?:,|$)/, 6));
    await page.getByLabel('Texture preview').waitFor();
    assert.equal(await page.locator('iframe[title="Local WebView sample"]').count(), 0);
    assert.equal(await page.locator(foreground).count(), 0);
    await clickCanvasControl(page, await navigationTab(page, /^Components(?:,|$)/, 0));
  }
}
