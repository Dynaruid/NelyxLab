// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { chromium } from 'playwright';
import { stop } from 'esbuild';
import { packet, response, protocol as p } from '@nelyx/core/v2';
import { sourceIdentity, timeout } from '../tools/build.mjs';
import {
  createEngineV2Project,
  buildEngineV2Application,
  verifyEngineV2Application,
  createEngineV2Server,
} from '../../sdk/tooling/cli/src/engine-v2-runner.mjs';
import { originalMaterialFixture } from './original-material-fixture.mjs';

const owner = { session: 1, app: 1, view: 1, generation: 1 };
async function publication(page) {
  const bytes = await page.evaluate(
    async (bytes) => {
      const result = await globalThis.__nelyxV2.surface.host.exchange(new Uint8Array(bytes));
      return Array.from(result);
    },
    Array.from(packet(p.opcodes.semanticsSnapshot, owner)),
  );
  const state = response(new Uint8Array(bytes));
  assert.equal(state.status, p.statuses.ok);
  return state;
}
async function paintSample(page, commands) {
  await page.waitForFunction(
    (commands) => {
      const state = globalThis.__nelyxV2.surface.diagnostics['render-stats']?.state;
      return (
        state?.transactionWork === BigInt(commands) &&
        state.document === state.activeDocument &&
        state.publication > 0n
      );
    },
    commands,
    { timeout: 15000 },
  );
  const state = await publication(page),
    card = state.nodes.find((n) => n.color === 0xff4488cc && n.width === 420 && n.height === 120);
  assert.ok(card, 'Sample the native published card rather than infer App layout');
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const png = await page.screenshot();
  return page.evaluate(
    async ({ png, x, y, opacity }) => {
      const bytes = Uint8Array.from(atob(png), (value) => value.charCodeAt(0)),
        bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      try {
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext('2d');
        context.drawImage(bitmap, 0, 0);
        return {
          color: [...context.getImageData(Math.round(x + 8), Math.round(y + 8), 1, 1).data],
          background: [...context.getImageData(900, 600, 1, 1).data],
          opacity,
        };
      } finally {
        bitmap.close();
      }
    },
    { png: png.toString('base64'), x: card.bounds.x, y: card.bounds.y, opacity: card.opacity },
  );
}
async function report(page, which, count) {
  await page
    .waitForFunction(
      ({ which, count }) =>
        globalThis.__controlEvents.some(
          (e) => e.kind === 'original-gesture-state' && e[which] === count,
        ) || globalThis.__nelyxV2.errors.length,
      { which, count },
      { timeout: 15000 },
    )
    .catch(async (error) => {
      const observed = await page.evaluate(() => ({
        states: globalThis.__controlEvents
          .filter((e) => e.kind === 'original-gesture-state')
          .slice(-3),
        events: globalThis.__controlEvents.slice(-8),
        errors: globalThis.__nelyxV2.errors,
      }));
      throw new Error(`Expected ${which}=${count}: ${JSON.stringify(observed)}`, { cause: error });
    });
  return page.evaluate(() => {
    const events = globalThis.__controlEvents;
    return {
      state: events.filter((e) => e.kind === 'original-gesture-state').at(-1),
      execution: events.filter((e) => e.kind === 'app-execution').at(-1)?.execution,
      errors: globalThis.__nelyxV2.errors,
    };
  });
}

test(
  'Original Material controls preserve hover, activation, animation pixels and drain in both Web profiles',
  { timeout },
  async () => {
    const repo = path.resolve(import.meta.dirname, '../../..'),
      supply = path.join(repo, 'Nelyx/engine/dist'),
      manifest = JSON.parse(fs.readFileSync(path.join(supply, 'engine-manifest.json'), 'utf8')),
      parent = fs.realpathSync(os.tmpdir());
    assert.equal(manifest.sourceSha256, sourceIdentity(), 'Build the current supply first');
    const app = fs.mkdtempSync(path.join(parent, 'engine-controls-web-'));
    let server, browser;
    try {
      createEngineV2Project(app, { designs: ['material', 'cupertino'] });
      fs.mkdirSync(path.join(app, 'node_modules/@nelyx'), { recursive: true });
      for (const [name, directory] of [
        ['core', 'Nelyx'],
        ['sdk', 'Nelyx/sdk'],
        ['cupertino', 'packages/cupertino'],
        ['material', 'packages/material'],
      ])
        fs.symlinkSync(
          path.join(repo, directory),
          path.join(app, 'node_modules/@nelyx', name),
          'junction',
        );
      fs.writeFileSync(path.join(app, 'src/app.ts'), originalMaterialFixture);
      const built = await buildEngineV2Application({
        app,
        target: 'web',
        engineInputs: supply,
      }).catch((error) => {
        throw new Error(
          error.errors?.map((e) => e.location?.file + ': ' + e.text).join('\n') ?? String(error),
        );
      });
      assert.equal(built.routing.appModel, 'original-elements');
      server = createEngineV2Server(verifyEngineV2Application(built.directory, 'web'));
      server.listen(0, '127.0.0.1');
      await once(server, 'listening');
      browser = await chromium.launch({ headless: true });
      for (const [route, profile] of [
        ['plain', 'single-worker'],
        ['isolated', 'threaded'],
      ]) {
        const context = await browser.newContext({ viewport: { width: 960, height: 720 } }),
          page = await context.newPage(),
          errors = [];
        page.on('pageerror', (error) => errors.push(String(error)));
        try {
          await page.goto(`http://127.0.0.1:${server.address().port}/${route}/`);
          await page.waitForFunction(
            () => globalThis.__nelyxV2?.ready || globalThis.__nelyxV2?.errors.length,
            null,
            { timeout: 30000 },
          );
          const ready = await page.evaluate(() => ({
            ready: __nelyxV2.ready,
            errors: __nelyxV2.errors,
            profile: __nelyxV2.surface?.selectedProfile,
            receipt: __nelyxV2.receipt,
          }));
          assert.deepEqual(ready.errors, []);
          assert.equal(ready.ready, true);
          assert.equal(ready.profile, profile);
          await page.evaluate(() => {
            globalThis.__controlEvents = [];
            __nelyxV2.app.addEventListener('message', (event) => {
              if (
                [
                  'original-gesture-state',
                  'original-focus-state',
                  'control-hover',
                  'app-execution',
                ].includes(event.data.kind)
              ) {
                __controlEvents.push(event.data);
                if (__controlEvents.length > 60) __controlEvents.shift();
              }
            });
          });
          const button = (label) => page.getByRole('button', { name: label, exact: true }),
            click = async (label) => {
              const bounds = await button(label).boundingBox();
              assert.ok(bounds);
              await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
            };
          await button('Plain + animate').waitFor({ state: 'visible', timeout: 30000 });
          const full = await paintSample(page, String(ready.receipt.commands));
          const plainBounds = await button('Plain + animate').boundingBox();
          assert.ok(plainBounds);
          await page.mouse.move(
            plainBounds.x + plainBounds.width / 2,
            plainBounds.y + plainBounds.height / 2,
          );
          await page.waitForTimeout(180);
          const beforeInk = await page.screenshot({ clip: plainBounds });
          await page.mouse.down();
          let ink, inkSnapshot;
          for (let attempt = 0; attempt < 20; ++attempt) {
            inkSnapshot = await publication(page);
            ink = inkSnapshot.nodes
              .flatMap((node) => node.nativePaint ?? [])
              .find(
                (entry) =>
                  entry.kind === 'ripple' && entry.color >>> 24 && entry.resolvedRadius > 0,
              );
            if (ink) break;
            await page.waitForTimeout(25);
          }
          assert.ok(ink, 'A canonical Material press publishes C++ ripple geometry');
          const reference = inkSnapshot.nodes.find(
            (node) =>
              node.node.slot === ink.reference.slot &&
              node.node.generation === ink.reference.generation,
          );
          assert.ok(reference);
          assert.equal(ink.width, reference.width);
          assert.equal(ink.height, reference.height);
          await page.waitForTimeout(80);
          assert.notDeepEqual(
            await page.screenshot({ clip: plainBounds }),
            beforeInk,
            'Published Material ink changes actual CanvasKit pixels',
          );
          await page.mouse.up();
          let current = await report(page, 'taps', 1).catch(async (error) => {
            const debug = await publication(page);
            throw new Error(
              String(error) +
                '\n' +
                JSON.stringify({
                  events: await page.evaluate(() =>
                    globalThis.__controlEvents
                      .filter((e) => e.kind !== 'app-execution')
                      .concat(
                        globalThis.__controlEvents
                          .filter((e) => e.kind === 'app-execution')
                          .slice(-1),
                      ),
                  ),
                  gestureWork: String(debug.gestureWork),
                  received: String(debug.received),
                  consumed: String(debug.consumed),
                  rejected: String(debug.rejected),
                  canceled: String(debug.canceled),
                  document: String(debug.document),
                  activeDocument: String(debug.activeDocument),
                  lastInput: String(debug.lastInput),
                }),
            );
          });
          assert.deepEqual(current.errors, []);
          assert.equal(current.state.fade, 0.5);
          assert.equal(
            current.state.hovered,
            true,
            'DOM capture handoff keeps the same hovered control',
          );
          const half = await paintSample(page, current.state.commands);
          assert.deepEqual(full.color, [68, 136, 204, 255]);
          assert.ok(Math.abs(half.opacity - 0.5) < 1 / 255);
          for (let channel = 0; channel < 3; ++channel)
            assert.ok(
              Math.abs(
                half.color[channel] - (full.color[channel] + full.background[channel]) / 2,
              ) <= 2,
              'Opacity affects actual CanvasKit pixels',
            );
          await page.mouse.move(-10, -10);
          await page.waitForFunction(
            () =>
              __controlEvents.filter((e) => e.kind === 'control-hover').at(-1)?.hovered === false,
            null,
            { timeout: 15000 },
          );
          await click('Filled');
          await report(page, 'filled', 1);
          await click('Tinted');
          await report(page, 'tinted', 1);
          await click('Outlined');
          await report(page, 'outlined', 1);
          await click('Elevated');
          await report(page, 'elevated', 1);
          await click('Disabled');
          const checkbox = page.getByRole('checkbox', { name: 'Select option', exact: true }),
            disabledCheckbox = page.getByRole('checkbox', { name: 'Disabled option', exact: true });
          assert.equal(await checkbox.getAttribute('aria-checked'), 'false');
          const checkBounds = await checkbox.boundingBox();
          assert.ok(checkBounds);
          const unchecked = await page.screenshot({ clip: checkBounds });
          await page.mouse.click(
            checkBounds.x + checkBounds.width / 2,
            checkBounds.y + checkBounds.height / 2,
          );
          current = await report(page, 'checks', 1);
          assert.equal(current.state.checked, true);
          assert.equal(await checkbox.getAttribute('aria-checked'), 'true');
          assert.notDeepEqual(
            await page.screenshot({ clip: checkBounds }),
            unchecked,
            'Canonical Checkbox animates to a visible native check mark',
          );
          const selection = await publication(page),
            mark = selection.nodes
              .flatMap((node) => node.nativePaint ?? [])
              .find((entry) => entry.kind === 'mark');
          assert.ok(selection.capabilities & p.capabilities.canonicalSelection);
          assert.ok(mark && mark.points.length === 3 && mark.progress === 1);
          const disabledBounds = await disabledCheckbox.boundingBox();
          assert.ok(disabledBounds);
          await page.mouse.click(
            disabledBounds.x + disabledBounds.width / 2,
            disabledBounds.y + disabledBounds.height / 2,
          );
          await checkbox.focus();
          await page.keyboard.press('Enter');
          current = await report(page, 'checks', 2);
          assert.equal(current.state.checked, false);
          assert.equal(await disabledCheckbox.getAttribute('aria-checked'), 'false');
          const mixed = page.getByRole('checkbox', { name: 'Mixed option', exact: true });
          assert.equal(await mixed.getAttribute('aria-checked'), 'mixed');
          const mixedSnapshot = await publication(page);
          assert.ok(
            mixedSnapshot.nodes
              .flatMap((n) => n.nativePaint ?? [])
              .some(
                (e) => e.kind === 'mark' && e.dash && e.points.length === 2 && e.progress === 1,
              ),
          );
          const mixedBounds = await mixed.boundingBox();
          assert.ok(mixedBounds);
          await page.mouse.click(
            mixedBounds.x + mixedBounds.width / 2,
            mixedBounds.y + mixedBounds.height / 2,
          );
          current = await report(page, 'mixes', 1);
          assert.equal(current.state.mixed, false);
          await mixed.focus();
          await page.keyboard.press('Space');
          current = await report(page, 'mixes', 2);
          assert.equal(current.state.mixed, true);
          await page.keyboard.press('Enter');
          current = await report(page, 'mixes', 3);
          assert.equal(current.state.mixed, null);
          assert.equal(await mixed.getAttribute('aria-checked'), 'mixed');
          const choiceA = page.getByRole('radio', { name: 'Choice A', exact: true }),
            choiceB = page.getByRole('radio', { name: 'Choice B', exact: true }),
            disabledChoice = page.getByRole('radio', { name: 'Disabled choice', exact: true });
          assert.equal(await page.getByRole('radiogroup').count(), 1);
          assert.equal(await choiceA.getAttribute('aria-checked'), 'true');
          assert.equal(await choiceB.getAttribute('aria-checked'), 'false');
          const radioBounds = await choiceB.boundingBox();
          assert.ok(radioBounds);
          const unselected = await page.screenshot({ clip: radioBounds });
          await page.mouse.click(
            radioBounds.x + radioBounds.width / 2,
            radioBounds.y + radioBounds.height / 2,
          );
          current = await report(page, 'choices', 1);
          assert.equal(current.state.choice, 'b');
          assert.equal(await choiceA.getAttribute('aria-checked'), 'false');
          assert.equal(await choiceB.getAttribute('aria-checked'), 'true');
          assert.notDeepEqual(
            await page.screenshot({ clip: radioBounds }),
            unselected,
            'The original Radio paints a visible Content-resolved selection',
          );
          const radioSnapshot = await publication(page);
          assert.ok(
            radioSnapshot.nodes
              .flatMap((n) => n.nativePaint ?? [])
              .some(
                (e) =>
                  e.kind === 'circle' &&
                  e.radius === 8 &&
                  e.shape.strokeWidth === 2 &&
                  e.resolvedRadius === 8,
              ),
          );
          const disabledRadioBounds = await disabledChoice.boundingBox();
          assert.ok(disabledRadioBounds);
          await page.mouse.click(
            disabledRadioBounds.x + disabledRadioBounds.width / 2,
            disabledRadioBounds.y + disabledRadioBounds.height / 2,
          );
          await choiceB.focus();
          await page.keyboard.press('Enter');
          current = await report(page, 'choices', 2);
          assert.equal(current.state.choice, null);
          await choiceA.focus();
          await page.keyboard.press('Space');
          current = await report(page, 'choices', 3);
          assert.equal(current.state.choice, 'a');
          assert.equal(current.state.radioAFocused, true);
          await page.keyboard.press('Control+k');
          current = await report(page, 'shortcuts', 1);
          assert.equal(
            current.state.choice,
            'a',
            'A source Shortcut consumes the native copied key without activating Radio',
          );
          await page.keyboard.press('ArrowRight');
          current = await report(page, 'choices', 4);
          assert.equal(current.state.choice, 'b');
          assert.equal(current.state.radioBFocused, true);
          try {
            await page.waitForFunction(
              () => document.activeElement?.getAttribute('aria-label') === 'Choice B',
              null,
              { timeout: 15000 },
            );
          } catch (error) {
            const state = await publication(page);
            const browser = await page.evaluate(() => ({
              active: document.activeElement?.outerHTML.slice(0, 500),
              errors: __nelyxV2.errors,
              report: __controlEvents.filter((e) => e.kind === 'original-gesture-state').at(-1),
            }));
            throw Error(
              'Original focus peer mismatch: ' +
                JSON.stringify(
                  {
                    browser,
                    focus: state.focus,
                    focusWork: state.focusWork,
                    peers: state.nodes
                      .filter((n) => n.hasFocus)
                      .map((n) => ({ node: n.node, semantics: n.semantics })),
                  },
                  (_key, value) => (typeof value === 'bigint' ? String(value) : value),
                ),
              { cause: error },
            );
          }
          const sourceRect = current.state.focusEvents
            .filter((e) => e.which === 'b' && e.focused)
            .at(-1)?.rect;
          assert.ok(sourceRect);
          const focusedBounds = await choiceB.boundingBox();
          for (let i = 0; i < 4; ++i)
            assert.ok(
              Math.abs(
                sourceRect[i] -
                  [focusedBounds.x, focusedBounds.y, focusedBounds.width, focusedBounds.height][i],
              ) < 0.01,
              'Source FocusNode reads the C++ published bounds',
            );
          await page.keyboard.press('ArrowRight');
          current = await report(page, 'choices', 5);
          assert.equal(current.state.choice, 'a', 'Radio arrows skip disabled clients and wrap');
          await page.keyboard.press('Tab');
          await page
            .waitForFunction(
              () => document.activeElement?.getAttribute('aria-label') === 'Enable feature',
              null,
              { timeout: 15000 },
            )
            .catch(async (error) => {
              const state = await publication(page),
                browser = await page.evaluate(() => ({
                  active: document.activeElement?.outerHTML.slice(0, 400),
                  errors: __nelyxV2.errors,
                  report: __controlEvents.filter((e) => e.kind === 'original-gesture-state').at(-1),
                  focusTrace: __controlEvents
                    .filter((e) => e.kind === 'original-focus-state')
                    .slice(-8),
                }));
              throw Error(
                'Original Tab focus mismatch: ' +
                  JSON.stringify(
                    {
                      browser,
                      focus: state.focus,
                      focusWork: state.focusWork,
                      peers: state.nodes
                        .filter((n) => n.hasFocus)
                        .map((n) => ({ node: n.node, semantics: n.semantics })),
                    },
                    (_key, value) => (typeof value === 'bigint' ? String(value) : value),
                  ),
                { cause: error },
              );
            });
          await page.keyboard.press('Shift+Tab');
          await page.waitForFunction(
            () => document.activeElement?.getAttribute('aria-label') === 'Choice A',
            null,
            { timeout: 15000 },
          );
          assert.ok(current.state.focusEvents.some((e) => e.which === 'a' && !e.focused));
          assert.ok(current.state.focusEvents.some((e) => e.which === 'b' && e.focused));
          assert.equal(await disabledChoice.getAttribute('aria-checked'), 'false');
          const toggle = page.getByRole('switch', { name: 'Enable feature', exact: true }),
            disabledToggle = page.getByRole('switch', { name: 'Disabled switch', exact: true }),
            apple = page.getByRole('switch', { name: 'Apple switch', exact: true }),
            rtlToggle = page.getByRole('switch', { name: 'RTL switch', exact: true });
          const toggleBounds = await toggle.boundingBox();
          assert.ok(toggleBounds);
          const offPixels = await page.screenshot({ clip: toggleBounds });
          const clickToggle = async (locator) => {
            const rect = await locator.boundingBox();
            assert.ok(rect);
            await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
          };
          const thumb = async (label) => {
            const state = await publication(page),
              peer = state.nodes.find((n) => n.semantics?.label === label);
            assert.ok(peer);
            assert.equal(peer.semantics.role, p.semanticsRoles.switchControl);
            assert.ok(state.capabilities & p.capabilities.canonicalSwitch);
            const descendants = state.nodes.filter((n) => {
              for (let at = n; at; at = state.nodes.find((a) => a.node.slot === at.parent.slot))
                if (at.node.slot === peer.node.slot) return true;
              return false;
            });
            const paint = descendants
              .flatMap((n) => n.nativePaint ?? [])
              .filter(
                (e) =>
                  e.kind === 'shape' && e.geometry?.kind === 'switchThumb' && !e.geometry.inset,
              )
              .at(-1);
            assert.ok(paint);
            return paint;
          };
          const offThumb = await thumb('Enable feature');
          assert.deepEqual(
            [
              offThumb.geometry.trackWidth,
              offThumb.geometry.trackHeight,
              offThumb.width,
              offThumb.height,
            ],
            [52, 32, 16, 16],
          );
          await clickToggle(toggle);
          current = await report(page, 'switches', 1);
          assert.equal(current.state.switched, true);
          assert.equal(await toggle.getAttribute('aria-checked'), 'true');
          const onThumb = await thumb('Enable feature');
          assert.deepEqual([onThumb.width, onThumb.height], [24, 24]);
          assert.ok(
            onThumb.transform[4] + onThumb.width / 2 > offThumb.transform[4] + offThumb.width / 2,
          );
          assert.notDeepEqual(
            await page.screenshot({ clip: toggleBounds }),
            offPixels,
            'The native Material switch moves its thumb and changes its track',
          );
          await toggle.focus();
          await page.keyboard.press('Space');
          current = await report(page, 'switches', 2);
          assert.equal(current.state.switched, false);
          const dragToggle = async (locator, forward) => {
            const rect = await locator.boundingBox();
            assert.ok(rect);
            const direction = forward ? 1 : -1,
              start = rect.x + rect.width / 2 - direction * 12,
              y = rect.y + rect.height / 2;
            await page.mouse.move(start, y);
            await page.mouse.down();
            await page.mouse.move(start + direction * 8, y);
            await page.mouse.move(start + direction * 40, y, { steps: 4 });
            await page.mouse.up();
          };
          await dragToggle(toggle, true);
          current = await report(page, 'switches', 3);
          assert.equal(current.state.switched, true);
          await dragToggle(toggle, false);
          current = await report(page, 'switches', 4);
          assert.equal(current.state.switched, false);
          await clickToggle(disabledToggle);
          await toggle.focus();
          await page.keyboard.press('Enter');
          current = await report(page, 'switches', 5);
          assert.equal(current.state.switched, true);
          assert.equal(await disabledToggle.getAttribute('aria-checked'), 'false');
          const rtlOff = await thumb('RTL switch');
          assert.equal(rtlOff.geometry.rtl, true);
          await dragToggle(rtlToggle, false);
          current = await report(page, 'rtlSwitches', 1);
          assert.equal(current.state.rtlSwitch, true);
          const rtlOn = await thumb('RTL switch');
          assert.ok(rtlOn.transform[4] + rtlOn.width / 2 < rtlOff.transform[4] + rtlOff.width / 2);
          await clickToggle(apple);
          current = await report(page, 'cups', 1);
          assert.equal(current.state.cup, true);
          const applePaint = (await publication(page)).nodes.flatMap((n) => n.nativePaint ?? []);
          assert.ok(applePaint.some((e) => e.kind === 'clip' && e.geometry?.trackWidth === 51));
          assert.ok(applePaint.some((e) => e.kind === 'shadow' && e.blurSigma > 0));
          await apple.focus();
          await page.keyboard.press('Enter');
          current = await report(page, 'cups', 2);
          assert.equal(current.state.cup, false);
          await button('Plain + animate').focus();
          await page.keyboard.press('Enter');
          current = await report(page, 'taps', 2);
          assert.deepEqual(current.errors, []);
          assert.deepEqual(errors, []);
          assert.equal(current.state.filled, 1);
          assert.equal(current.state.tinted, 1);
          assert.equal(current.state.outlined, 1);
          assert.equal(current.state.elevated, 1);
          assert.equal(current.state.fade, 1);
          const restored = await paintSample(page, current.state.commands),
            published = await publication(page);
          assert.deepEqual(restored.color, full.color);
          assert.equal(published.transactionWork, BigInt(current.execution.acknowledgedCommands));
          assert.equal(published.transactionWork, BigInt(current.state.commands));
          assert.ok(published.gestureWork > 0n);
          assert.ok(published.keyWork > 0n && published.focusWork > 0n);
          assert.equal(published.publishedDocument, published.document);
          assert.equal(published.publishedMetrics, published.metrics);
          assert.equal(current.execution.tsLayoutFallbacks, 0);
          assert.equal(current.execution.appGeometryNodes, 0);
          assert.equal(current.execution.rejectedFallbacks, 0);
          const closed = await page.evaluate(() => __nelyxV2.close());
          assert.equal(closed.reservedBytes, 0);
          assert.equal(closed.workersStopped, true);
          console.log(
            JSON.stringify({
              profile,
              commands: current.state.commands,
              gestureWork: String(published.gestureWork),
              ink: { width: ink.width, height: ink.height, radius: ink.resolvedRadius },
              checks: current.state.checks,
              mixes: current.state.mixes,
              choices: current.state.choices,
              shortcuts: current.state.shortcuts,
              switches: current.state.switches,
              cups: current.state.cups,
              rtlSwitches: current.state.rtlSwitches,
              keyWork: String(published.keyWork),
              focusWork: String(published.focusWork),
              opacity: [full.color, half.color, restored.color],
              workersStopped: closed.workersStopped,
              reservedBytes: closed.reservedBytes,
            }),
          );
        } finally {
          await page.evaluate(() => globalThis.__nelyxV2?.close?.()).catch(() => {});
          await context.close();
        }
      }
    } finally {
      await browser?.close();
      if (server) await new Promise((resolve) => server.close(resolve));
      stop();
      assert.equal(path.dirname(path.resolve(app)), parent);
      assert.match(path.basename(app), /^engine-controls-web-/);
      fs.rmSync(app, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);
