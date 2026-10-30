// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { capture, startOwnedCommand } from '../../sdk/tooling/cli/src/commands.mjs';

const timeout = 1_200_000,
  applicationId = 'com.nelyxtestbed2';
test(
  'current Android testbed connects nonvisual OS input to Core editing through keyboard resize, clear/undo, Form actions and design return',
  { timeout },
  async (t) => {
    const serial = process.env.NELYX_ANDROID_TEST_SERIAL;
    assert(
      serial && /^emulator-\d+$/.test(serial),
      'Select the prepared Vulkan emulator with NELYX_ANDROID_TEST_SERIAL',
    );
    const disk = fs.statfsSync(process.cwd());
    assert(disk.bavail * disk.bsize >= 20 * 1024 ** 3, 'At least 20 GiB of free disk is required');
    const runner = path.resolve('sample/nelyx-testbed-app-2/android/runner'),
      load = createRequire(path.join(runner, 'package.json'));
    const sdk =
      process.env.ANDROID_HOME ??
      process.env.ANDROID_SDK_ROOT ??
      path.join(process.env.LOCALAPPDATA, 'Android/Sdk');
    const adb = path.join(
      sdk,
      'platform-tools',
      'adb' + (process.platform === 'win32' ? '.exe' : ''),
    );
    const call = (args) => {
      t.signal.throwIfAborted();
      return capture(adb, ['-s', serial, ...args], { timeout: 30000 });
    };
    assert.equal(call(['get-state']).trim(), 'device');
    // An existing developer server keeps its owner; this test starts its own.
    const probe = net.createServer();
    await new Promise((resolve, reject) => {
      probe.once('error', reject);
      probe.listen(8081, '127.0.0.1', resolve);
    });
    await new Promise((resolve) => probe.close(resolve));
    const metro = startOwnedCommand(
      process.execPath,
      [
        load.resolve('@react-native-community/cli/build/bin.js'),
        'start',
        '--config',
        'metro.config.cjs',
        '--port',
        '8081',
        '--max-workers',
        '2',
        '--no-interactive',
      ],
      { cwd: runner },
    );
    const abort = () => {
      void metro.stop();
    };
    t.signal.addEventListener('abort', abort, { once: true });
    const dump = '/sdcard/nelyx-input-' + process.pid + '.xml';
    let reverseCreated = false,
      launched = false,
      pid,
      failure;
    const decode = (value) =>
      value
        .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
    const rect = (node) => {
      const values = node.bounds.match(/\d+/g)?.map(Number);
      assert.equal(values?.length, 4);
      return { left: values[0], top: values[1], right: values[2], bottom: values[3] };
    };
    function ui() {
      try {
        call(['shell', 'uiautomator', 'dump', dump]);
        const xml = call(['shell', 'cat', dump]);
        assert(Buffer.byteLength(xml) <= 2 * 1024 * 1024, 'Native hierarchy byte budget');
        return [...xml.matchAll(/<node\b([^>]+)>?/g)]
          .map((match) =>
            Object.fromEntries(
              [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((attribute) => [
                attribute[1],
                decode(attribute[2]),
              ]),
            ),
          )
          .filter((node) => node.package === applicationId);
      } finally {
        capture(adb, ['-s', serial, 'shell', 'rm', '-f', dump], { timeout: 30000 });
      }
    }
    async function wait(name, predicate, attempts = 6) {
      let last = [];
      for (let attempt = 0; attempt < attempts; attempt++) {
        t.signal.throwIfAborted();
        if (pid) {
          try {
            assert.equal(call(['shell', 'pidof', applicationId]).trim(), pid);
          } catch {
            throw new Error(
              'Android application exited before ' +
                name +
                ': ' +
                call(['logcat', '-d', '-b', 'crash', '-t', '100']).slice(0, 6000),
            );
          }
        }
        const nodes = (last = ui()),
          found = nodes.find((node) => predicate(node, nodes));
        if (found) return found;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      throw new Error(
        'Native UI did not reach: ' +
          name +
          '; ' +
          JSON.stringify(
            last
              .filter(
                (node) =>
                  node.class === 'android.widget.EditText' ||
                  node['resource-id'] === 'android:id/content',
              )
              .map((node) => ({
                label: node['content-desc'],
                text: node.text,
                focused: node.focused,
                bounds: node.bounds,
              })),
          ),
      );
    }
    function tap(node) {
      assert.equal(node.enabled, 'true');
      const bounds = rect(node);
      assert(bounds.right > bounds.left && bounds.bottom > bounds.top);
      call([
        'shell',
        'input',
        'tap',
        String(Math.floor((bounds.left + bounds.right) / 2)),
        String(Math.floor((bounds.top + bounds.bottom) / 2)),
      ]);
    }
    const stable = (name, predicate) => {
      let previous;
      return wait(name + ' stable native bounds', (node) => {
        if (!predicate(node)) return false;
        const current = node.bounds + '|' + node.text + '|' + node.focused,
          ready = current === previous;
        previous = current;
        return ready;
      });
    };
    const byId = (id) => stable(id, (node) => node['resource-id'] === id),
      editor = (label, predicate = () => true) =>
        stable(
          label,
          (node) =>
            node.class === 'android.widget.EditText' &&
            node['content-desc'] === label &&
            predicate(node),
        );
    async function revealById(id, { steps = 4, fraction = 0.3 } = {}) {
      for (let attempt = 0; attempt <= steps; attempt++) {
        const nodes = ui(),
          content = rect(nodes.find((node) => node['resource-id'] === 'android:id/content')),
          candidate = nodes.find((node) => node['resource-id'] === id);
        // A semantics node can intersect the viewport while its centre is under
        // the fixed footer. Reveal the whole control before injecting a tap.
        if (candidate) {
          const target = rect(candidate);
          if (
            target.top >= content.top &&
            target.bottom <= content.bottom - (content.bottom - content.top) * 0.1
          )
            return byId(id);
        }
        if (attempt === steps) break;
        const bounds = content,
          x = Math.floor((bounds.left + bounds.right) / 2),
          height = bounds.bottom - bounds.top,
          start = bounds.top + Math.floor(height * 0.75),
          end = start - Math.floor(height * fraction);
        // Start inside the scrolling body; the page has a fixed footer and safe-area padding.
        call([
          'shell',
          'input',
          'swipe',
          String(x),
          String(start),
          String(x),
          String(end),
          fraction < 0.1 ? '1000' : '400',
        ]);
      }
      throw new Error('Native scroll did not reveal: ' + id);
    }
    const withKeyboard = (node, nodes) => {
      const content = nodes.find((node) => node['resource-id'] === 'android:id/content');
      return (
        !!content &&
        rect(content).bottom < fullBottom - 200 &&
        rect(node).bottom <= rect(content).bottom
      );
    };
    let fullBottom;
    try {
      let ready = false;
      for (let attempt = 0; attempt < 30; attempt++) {
        try {
          const response = await fetch('http://127.0.0.1:8081/status', {
            signal: AbortSignal.any([t.signal, AbortSignal.timeout(1000)]),
          });
          if (response.ok && (await response.text()) === 'packager-status:running') {
            assert.equal(path.resolve(response.headers.get('X-React-Native-Project-Root')), runner);
            ready = true;
            break;
          }
        } catch (_error) {
          t.signal.throwIfAborted();
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      assert(ready, 'Owned Metro server must become ready');
      // Qualify both RN dev/release transforms before the native host asks for a bundle.
      for (const dev of [false, true]) {
        const response = await fetch(
          'http://127.0.0.1:8081/main.bundle?platform=android&dev=' + dev + '&minify=' + !dev,
          { signal: AbortSignal.any([t.signal, AbortSignal.timeout(240000)]) },
        );
        assert.equal(
          response.status,
          200,
          (await (response.ok ? Promise.resolve('') : response.text())).slice(0, 2000),
        );
        await response.arrayBuffer();
      }
      const mapping = call(['reverse', '--list'])
        .split(/\r?\n/)
        .map((line) => line.trim().split(/\s+/))
        .find((parts) => parts[1] === 'tcp:8081');
      if (mapping) assert.equal(mapping[2], 'tcp:8081', 'Keep another reverse-port owner');
      else {
        call(['reverse', '--no-rebind', 'tcp:8081', 'tcp:8081']);
        reverseCreated = true;
      }
      call(['shell', 'am', 'force-stop', applicationId]);
      call(['shell', 'input', 'keyevent', '224']);
      call(['shell', 'input', 'keyevent', '82']);
      launched = true;
      assert.match(
        call(['shell', 'am', 'start', '-W', '-n', applicationId + '/.MainActivity']),
        /^Status: ok\s*$/m,
      );
      pid = call(['shell', 'pidof', applicationId]).trim();
      assert(/^\d+$/.test(pid));
      // A cold development bundle and native surface initialization have a separate
      // startup budget; this test makes no startup-latency or FPS claim.
      await wait('initial gallery', (node) => node['resource-id'] === 'category-text', 25);
      fullBottom = rect(
        await wait('app content', (node) => node['resource-id'] === 'android:id/content'),
      ).bottom;
      tap(await byId('category-text'));
      tap(await editor('Write something'));
      await wait(
        'focused Material editor inside keyboard viewport',
        (node, nodes) =>
          node.class === 'android.widget.EditText' &&
          node['content-desc'] === 'Write something' &&
          node.focused === 'true' &&
          withKeyboard(node, nodes),
      );
      const initialMaterialText = (
        await editor('Write something', (node) => node.focused === 'true')
      ).text;
      call(['shell', 'input', 'keycombination', '113', '29']);
      call(['shell', 'input', 'keyevent', '67']);
      await editor('Write something', (node) => node.focused === 'true' && node.text === '');
      call(['shell', 'input', 'keycombination', '113', '54']);
      await editor(
        'Write something',
        (node) => node.focused === 'true' && node.text === initialMaterialText,
      );
      call(['shell', 'input', 'keycombination', '113', '123']);
      call(['shell', 'input', 'text', 'XY']);
      const materialText = (
        await editor(
          'Write something',
          (node) => node.focused === 'true' && node.text === initialMaterialText + 'XY',
        )
      ).text;
      call(['shell', 'input', 'keyevent', '4']);
      await wait(
        'keyboard dismissed',
        (node) => node['resource-id'] === 'android:id/content' && rect(node).bottom === fullBottom,
      );
      assert.equal((await editor('Write something')).text, materialText);
      tap(await revealById('toggle-secure-input', { steps: 12, fraction: 0.08 }));
      await editor(
        'Write something',
        (node) => node.password === 'true' && node.text !== materialText,
      );
      tap(await editor('Write something'));
      await wait(
        'secure Core editor and keyboard',
        (node, nodes) =>
          node['content-desc'] === 'Write something' &&
          node.password === 'true' &&
          node.focused === 'true' &&
          withKeyboard(node, nodes),
      );
      // A fresh tap while the IME is already visible must not reopen it after a later Back.
      tap(
        await editor(
          'Write something',
          (node) => node.password === 'true' && node.focused === 'true',
        ),
      );
      call(['shell', 'input', 'keyevent', '4']);
      await wait(
        'secure keyboard dismissed after a fresh tap',
        (node) => node['resource-id'] === 'android:id/content' && rect(node).bottom === fullBottom,
      );
      for (let observation = 0; observation < 3; observation++)
        assert.equal(
          rect(await byId('android:id/content')).bottom,
          fullBottom,
          'A delayed pre-Back tap must not show the IME again',
        );
      tap(await editor('Write something', (node) => node.password === 'true'));
      await wait(
        'a newer secure-field tap reopens the keyboard',
        (node, nodes) =>
          node['content-desc'] === 'Write something' &&
          node.password === 'true' &&
          node.focused === 'true' &&
          withKeyboard(node, nodes),
      );
      call(['shell', 'input', 'keyevent', '4']);
      await wait(
        'secure keyboard dismissed again',
        (node) => node['resource-id'] === 'android:id/content' && rect(node).bottom === fullBottom,
      );
      tap(await revealById('toggle-secure-input', { steps: 12, fraction: 0.08 }));
      assert.equal(
        (await editor('Write something', (node) => node.password === 'false')).text,
        materialText,
        'The secure provider transition retains the Core document',
      );
      tap(await byId('show-cupertino'));
      await wait(
        'retired Material input dismisses its keyboard',
        (node) => node['resource-id'] === 'android:id/content' && rect(node).bottom === fullBottom,
      );
      tap(await byId('cupertino-category-text'));
      tap(await editor('메시지를 입력하세요'));
      const cupertinoText = (
        await wait(
          'focused Cupertino editor inside keyboard viewport',
          (node, nodes) =>
            node.class === 'android.widget.EditText' &&
            node['content-desc'] === '메시지를 입력하세요' &&
            node.focused === 'true' &&
            withKeyboard(node, nodes),
        )
      ).text;
      tap(
        await stable(
          'Cupertino clear',
          (node) => node['content-desc'] === 'Clear Cupertino message',
        ),
      );
      await wait(
        'clear retains native editor focus and keyboard',
        (node, nodes) =>
          node.class === 'android.widget.EditText' &&
          node['content-desc'] === '메시지를 입력하세요' &&
          node.text === '' &&
          node.focused === 'true' &&
          withKeyboard(node, nodes),
      );
      tap(await byId('cupertino-undo-message'));
      assert.equal(
        (await editor('메시지를 입력하세요', (node) => node.text === cupertinoText)).text,
        cupertinoText,
      );
      tap(await editor('Cupertino name'));
      await editor('Cupertino name', (node) => node.focused === 'true');
      call(['shell', 'input', 'text', 'Ada']);
      await editor('Cupertino name', (node) => node.text === 'Ada' && node.focused === 'true');
      call(['shell', 'input', 'keyevent', '66']);
      await editor('Cupertino email', (node) => node.focused === 'true');
      call(['shell', 'input', 'text', 'ada@example.com']);
      await editor('Cupertino email', (node) => node.text === 'ada@example.com');
      call(['shell', 'input', 'keyevent', '66']);
      await wait('Form submitted', (node) =>
        node['content-desc'].includes('Cupertino saved: Ada · ada@example.com'),
      );
      await wait(
        'Done dismisses keyboard',
        (node) => node['resource-id'] === 'android:id/content' && rect(node).bottom === fullBottom,
      );
      tap(await revealById('cupertino-form-reset'));
      await editor('Cupertino name', (node) => node.text === '');
      await editor('Cupertino email', (node) => node.text === '');
      assert(
        !ui().some((node) =>
          /이름을 입력하세요\.|이메일 형식을 확인하세요\./.test(node['content-desc']),
        ),
        'Reset clears user-interaction validation errors',
      );
      tap(await byId('show-material'));
      assert.equal((await editor('Write something')).text, materialText);
      tap(await byId('show-cupertino'));
      assert.equal((await editor('메시지를 입력하세요')).text, cupertinoText);
      const logs = call(['logcat', '-d', '--pid=' + pid]);
      assert(
        !/\b[EF] (?:ReactNativeJS|AndroidRuntime|unknown:ReactNative)\s*:/.test(logs),
        logs
          .split(/\r?\n/)
          .filter((line) => /\b[EF] /.test(line))
          .slice(-12)
          .join('\n'),
      );
      assert(!logs.includes('Encountered two children with the same key'));
      assert(
        !/ReactNativeJS:.*(?:Error:|Unhandled)/.test(logs),
        logs
          .split(/\r?\n/)
          .filter((line) => /ReactNativeJS:.*(?:Error:|Unhandled)/.test(line))
          .join('\n'),
      );
      t.diagnostic(
        'PASS-scoped: real APK/JS/Core-Skia and nonvisual input endpoint, Core Ctrl+A/delete/Undo through actual native acknowledgements, injected ASCII editing, OS keyboard viewport, Core secure/plain transition, clear/undo, Next/Done/Form save/reset and retained design values; physical IME/reader/caret/FPS remain notVerified',
      );
    } catch (error) {
      failure = error;
      try {
        const imeDump = call(['shell', 'dumpsys', 'input_method']);
        t.diagnostic(
          'IME-HISTORY: ' +
            imeDump
              .split(/\r?\n/)
              .filter((line) =>
                /SoftInputShowHideHistory #|time=.*timestamp|reason=SHOW_SOFT_INPUT|reason=HIDE_SOFT_INPUT_BY_BACK_KEY/.test(
                  line,
                ),
              )
              .slice(-32)
              .join('\n'),
        );
        t.diagnostic(
          'IME-STATE: ' +
            imeDump
              .split(/\r?\n/)
              .filter((line) =>
                /mShowRequested|mInputShown|mImeWindowVis|mCurFocusedWindow|mCurClient|mServedInputConnection|mCurAttribute|mImeShowFlags/.test(
                  line,
                ),
              )
              .slice(-20)
              .join('\n'),
        );
        t.diagnostic(
          'IME-LIFECYCLE: ' +
            call([
              'logcat',
              '-d',
              '-v',
              'brief',
              '-s',
              'ImeTracker:I',
              'InsetsController:I',
              'InputMethodManager:I',
            ])
              .split(/\r?\n/)
              .slice(-30)
              .join('\n'),
        );
      } catch {}
      try {
        t.diagnostic(
          JSON.stringify(
            ui()
              .filter((node) => node['resource-id'] || node.class === 'android.widget.EditText')
              .slice(-20)
              .map((node) => ({
                id: node['resource-id'],
                label: node['content-desc'],
                text: node.text,
                focused: node.focused,
                bounds: node.bounds,
              })),
          ),
        );
      } catch {}
      if (pid)
        try {
          t.diagnostic(
            call(['logcat', '-d', '--pid=' + pid])
              .split(/\r?\n/)
              .filter((line) => /\b[EF] |ReactNativeJS:.*(?:Error:|Unhandled)/.test(line))
              .slice(0, 24)
              .join('\n'),
          );
        } catch {}
      throw error;
    } finally {
      t.signal.removeEventListener('abort', abort);
      const errors = [];
      if (launched && process.env.NELYX_ANDROID_PREVIEW) {
        const shot = spawnSync(adb, ['-s', serial, 'exec-out', 'screencap', '-p'], {
          timeout: 30000,
          maxBuffer: 8 * 1024 * 1024,
          windowsHide: true,
        });
        if (shot.status === 0) fs.writeFileSync(process.env.NELYX_ANDROID_PREVIEW, shot.stdout);
      }
      if (launched)
        try {
          capture(adb, ['-s', serial, 'shell', 'am', 'force-stop', applicationId], {
            timeout: 30000,
          });
        } catch (error) {
          errors.push(error);
        }
      if (reverseCreated)
        try {
          capture(adb, ['-s', serial, 'reverse', '--remove', 'tcp:8081'], { timeout: 30000 });
        } catch (error) {
          errors.push(error);
        }
      /* oxlint-disable no-unsafe-finally -- Retirement and finalization failures must propagate, including while unwinding a frame or test. */
      await metro.stop();
      if (errors.length && !failure) throw new AggregateError(errors, 'Native test cleanup failed');
      /* oxlint-enable no-unsafe-finally */
    }
  },
);
