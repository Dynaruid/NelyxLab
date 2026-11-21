// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readdir, rmdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { promisify } from 'node:util';
import { chromium } from 'playwright';

const pkg = 'dev.nelyx.demo.tauri';
const device = process.env.ANDROID_SERIAL ?? 'emulator-5554';
const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
const java = process.env.JAVA_HOME;
const runs = Number(process.env.NELYX_SCROLL_RUNS ?? 3);
const cpu = process.argv.includes('--cpu');
const topOnly = process.argv.includes('--top-only');
const controls = process.argv.includes('--controls');
const gl = cpu || process.argv.includes('--gl');
assert(sdk && java, 'Set ANDROID_HOME and JAVA_HOME for the Demo Android toolchain');
assert(Number.isInteger(runs) && runs >= 1 && runs <= 5);

const interrupt = new AbortController();
const cancel = () => interrupt.abort();
process.on('SIGINT', cancel);
process.on('SIGTERM', cancel);
const signal = AbortSignal.any([interrupt.signal, AbortSignal.timeout(1_180_000)]);
const execute = promisify(execFile);
const exe = (name) => name + (process.platform === 'win32' ? '.exe' : '');
const adbPath = join(sdk, 'platform-tools', exe('adb'));
const jdk = (name) => join(java, 'bin', exe(name));
const remote = '/data/local/tmp/nelyx-gallery-touch-' + process.pid + '.jar';
const temp = await mkdtemp(join(tmpdir(), 'nelyx-gallery-touch-'));

const command = async (file, args, cleanup = false) =>
  (
    await execute(file, args, {
      timeout: 20_000,
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024,
      ...(!cleanup ? { signal } : {}),
    })
  ).stdout.trim();
const adb = (...args) => command(adbPath, ['-s', device, ...args]);
const shell = (...args) => adb('shell', ...args);
const cleanupAdb = (...args) => command(adbPath, ['-s', device, ...args], true);
const wait = (ms) => sleep(ms, undefined, { signal });

async function prepareTouch() {
  const latest = async (folder, prefix) => {
    const versions = (await readdir(join(sdk, folder), { withFileTypes: true }))
      .filter(
        (entry) =>
          entry.isDirectory() &&
          entry.name.startsWith(prefix) &&
          /^\d+(\.\d+)*$/.test(entry.name.slice(prefix.length)),
      )
      .map((entry) => entry.name)
      .sort((a, b) => b.localeCompare(a, 'en', { numeric: true }));
    assert(versions.length > 0, 'Missing Android SDK ' + folder);
    return join(sdk, folder, versions[0]);
  };
  const [platform, buildTools] = await Promise.all([
    latest('platforms', 'android-'),
    latest('build-tools', ''),
  ]);
  await command(jdk('javac'), [
    '--release',
    '8',
    '-classpath',
    join(platform, 'android.jar'),
    '-d',
    temp,
    join(import.meta.dirname, 'GalleryTouch.java'),
  ]);
  await command(jdk('java'), [
    '-cp',
    join(buildTools, 'lib', 'd8.jar'),
    'com.android.tools.r8.D8',
    '--min-api',
    '24',
    '--output',
    temp,
    join(temp, 'GalleryTouch.class'),
  ]);
  const jar = join(temp, basename(remote));
  await command(jdk('jar'), ['cf', jar, '-C', temp, 'classes.dex']);
  await adb('push', jar, remote);
}

function touch(start, segments, step = 8) {
  return drag(
    70,
    start,
    segments.map(([duration, y]) => [duration, 70, y]),
    { step },
  );
}

async function drag(x, y, segments, { step = 8, cancel = false } = {}) {
  const output = await shell(
    'CLASSPATH=' + remote,
    'app_process',
    '/system/bin',
    'GalleryTouch',
    String(step),
    String(x),
    String(y),
    ...segments.flat().map(String),
    ...(cancel ? ['cancel'] : []),
  );
  const pair = output.split(/\r?\n/).at(-1).split(',').map(Number);
  assert(pair.length === 2 && Number.isFinite(pair[0]) && pair[1] > pair[0], output);
  return pair;
}

function installProbe({ gl, cpu }) {
  if (cpu)
    window.nelyxDemoFrameProbe = (read) => {
      window.galleryFrames = read;
    };
  if (!gl) return;
  window.galleryGl = [];
  for (const name of [
    'getShaderParameter',
    'getProgramParameter',
    'compileShader',
    'linkProgram',
    'texSubImage2D',
    'fenceSync',
    'clientWaitSync',
  ]) {
    const proto = WebGL2RenderingContext.prototype;
    const original = proto[name];
    proto[name] = function (...args) {
      const at = performance.now();
      const result = Reflect.apply(original, this, args);
      if (window.galleryGl.length < 16000) {
        window.galleryGl.push([
          name,
          at,
          performance.now() - at,
          name.endsWith('Parameter') ? args[1] : null,
        ]);
      }
      return result;
    };
  }
}

const control = (page, id) => page.locator(`[data-semantics-identifier="${id}"]`);
const filled = (page) => control(page, 'demo-filled');
async function openDemo() {
  await shell('am', 'force-stop', pkg);
  const launch = await shell('am', 'start', '-n', pkg + '/.MainActivity');
  assert.match(launch, /^Starting: Intent/m);
  assert.doesNotMatch(launch, /^Error:/m);
  // The WebView and rendered gallery are the readiness gates.
  let pid = '';
  for (let attempt = 0; attempt < 12 && !pid; attempt++) {
    try {
      pid = await shell('pidof', pkg);
    } catch (error) {
      if (error.code !== 1) throw error;
      await wait(250);
    }
  }
  assert.match(pid, /^\d+$/);
  const port = await adb('forward', 'tcp:0', 'localabstract:webview_devtools_remote_' + pid);
  assert.match(port, /^\d+$/);
  const endpoint = 'http://127.0.0.1:' + port;
  let browser;
  const disconnect = () => {
    void browser?.close().catch(() => {});
  };
  const close = async () => {
    signal.removeEventListener('abort', disconnect);
    try {
      await browser?.close();
    } finally {
      await cleanupAdb('forward', '--remove', 'tcp:' + port);
    }
  };
  try {
    for (let attempt = 0; attempt < 12; attempt++) {
      try {
        if (
          (
            await fetch(endpoint + '/json/version', {
              signal: AbortSignal.any([signal, AbortSignal.timeout(1000)]),
            })
          ).ok
        )
          break;
      } catch {
        signal.throwIfAborted();
      }
      await wait(250);
    }
    browser = await chromium.connectOverCDP(endpoint, { timeout: 12_000, noDefaults: true });
    signal.throwIfAborted();
    signal.addEventListener('abort', disconnect, { once: true });
    const context = browser.contexts()[0],
      page = context.pages()[0],
      errors = [];
    assert(page, 'Tauri WebView was not available');
    page.setDefaultTimeout(12_000);
    page.on('pageerror', (error) => errors.push(String(error)));
    if (gl) {
      await context.addInitScript(installProbe, { gl, cpu });
      await page.reload({ timeout: 25_000 });
    }
    await filled(page).waitFor({ state: 'attached', timeout: 25_000 });
    const top = (await filled(page).boundingBox())?.y;
    assert(Number.isFinite(top));
    const current = await page.evaluate(async () => {
      const manifest = await fetch(new URL('build.json', location.href)).then((response) =>
        response.json(),
      );
      const canvas = document.querySelector('canvas');
      return {
        build: manifest.buildId,
        width: innerWidth,
        height: innerHeight,
        dpr: devicePixelRatio,
        raster: [canvas.width, canvas.height],
      };
    });
    return { page, top, current, errors, close };
  } catch (error) {
    await close();
    throw error;
  }
}

const rounded = (number) => +number.toFixed(2);
function percentiles(samples) {
  if (!samples.length) return null;
  samples.sort((a, b) => a - b);
  const q = (p) => rounded(samples[Math.ceil(samples.length * p) - 1]);
  return {
    n: samples.length,
    p50: q(0.5),
    p95: q(0.95),
    p99: q(0.99),
    max: q(1),
    over33: samples.filter((ms) => ms >= 33.3).length,
  };
}

function displayIntervals(data, start, end, layerLatency) {
  let columns;
  const times = new Set();
  for (const line of data.split(/\r?\n/)) {
    if (line.startsWith('Flags,')) {
      columns = line.split(',');
      continue;
    }
    let present;
    if (layerLatency && /^\d+\s+\d+\s+\d+$/.test(line))
      present = Number(line.trim().split(/\s+/)[1]);
    else if (!layerLatency && columns && line.startsWith('0,')) {
      present = Number(line.split(',')[columns.indexOf('DisplayPresentTime')]);
    }
    if (present >= start && present <= end) times.add(present);
  }
  const ordered = [...times].sort((a, b) => a - b);
  return percentiles(ordered.slice(1).map((value, index) => (value - ordered[index]) / 1e6));
}
async function drain(page) {
  return page.evaluate(() => ({
    trace: window.galleryFrames?.(),
    gl: window.galleryGl?.splice(0) ?? [],
  }));
}

async function measure(page, layer, route, gesture, tail) {
  const before = gl ? await drain(page) : undefined;
  await shell('dumpsys', 'gfxinfo', pkg, 'reset');
  if (layer) await shell('dumpsys', 'SurfaceFlinger', '--latency-clear', layer);
  const [start, end] = await gesture();
  await wait(tail + 60);
  const stats = await shell('dumpsys', 'gfxinfo', pkg, 'framestats');
  const sf = layer ? await shell('dumpsys', 'SurfaceFlinger', '--latency', layer) : '';
  const bounds = end + tail * 1e6;
  const result = {
    route,
    gestureMs: rounded((end - start) / 1e6),
    hwui: displayIntervals(stats, start, bounds, false),
    compositor: displayIntervals(sf, start, bounds, true),
  };
  if (gl) {
    const read = await drain(page);
    const fences = read.gl.filter(([name]) => name === 'fenceSync').map(([, at]) => at);
    const linkStatus = read.gl.filter(
      ([name, , , selector]) => name === 'getProgramParameter' && selector === 0x8b82,
    );
    Object.assign(result, {
      submits: percentiles(fences.slice(1).map((at, index) => at - fences[index])),
      compiles: read.gl.filter(([name]) => name === 'compileShader').length,
      compileQueries: read.gl.filter(
        ([name, , , selector]) => name === 'getShaderParameter' && selector === 0x8b81,
      ).length,
      linkQueries: linkStatus.length,
      linkStatusWait: percentiles(linkStatus.map(([, , duration]) => duration)),
      fencePolls: percentiles(
        read.gl.filter(([name]) => name === 'clientWaitSync').map(([, , duration]) => duration),
      ),
      textureUploads: percentiles(
        read.gl.filter(([name]) => name === 'texSubImage2D').map(([, , duration]) => duration),
      ),
    });
    if (read.trace && before?.trace) {
      const stages = [
        'build',
        'layout',
        'paint',
        'compose',
        'semantics',
        'input-queue',
        'native-replay',
        'native-submit',
        'gpu-fence-enqueue',
      ];
      Object.assign(result, {
        costs: Object.fromEntries(
          stages.map((stage) => [
            stage,
            percentiles(
              read.trace.frames.samples
                .filter((entry) => entry.stage === stage)
                .map((entry) => entry.duration),
            ),
          ]),
        ),
        cold: read.trace.sections.requiredColdChildren - before.trace.sections.requiredColdChildren,
        prepared: read.trace.sections.published - before.trace.sections.published,
        reused: (read.trace.dormant?.hits ?? 0) - (before.trace.dormant?.hits ?? 0),
        overwritten: read.trace.frames.overwritten,
      });
    }
  }
  console.log(JSON.stringify(result));
}

async function resetTop(page, top) {
  for (let attempt = 0; attempt < 9; attempt++) {
    if ((await filled(page).count()) && Math.abs((await filled(page).boundingBox())?.y - top) <= 2)
      return;
    await touch(540, [[205, 1930]]);
    await wait(460);
  }
  assert.fail('Returned to the first gallery card');
}
async function advance(count) {
  for (let i = 0; i < count; i++)
    await touch(
      1810,
      [
        [1180, 545],
        [70, 545],
      ],
      12,
    );
  await wait(240);
}
const lowerFling = () => touch(1570, [[205, 810]]);
const reverse = () =>
  touch(1430, [
    [110, 940],
    [112, 1640],
    [108, 940],
    [110, 1485],
    [66, 1485],
  ]);

async function reveal(locator, height, minHeight = 1) {
  for (let attempt = 0; attempt < 16; attempt++) {
    const box = (await locator.count()) ? await locator.boundingBox() : null;
    if (box && box.height >= minHeight && box.y > 96 && box.y + box.height < height - 30)
      return box;
    if (box && box.y < height / 3)
      await touch(
        1100,
        [
          [575, 1570],
          [100, 1570],
        ],
        12,
      );
    else
      await touch(
        1770,
        [
          [575, 1060],
          [100, 1060],
        ],
        12,
      );
    await wait(430);
  }
  assert.fail('Could not reveal ' + locator);
}

async function checkControls(page, top, { height, dpr }) {
  const start = control(page, 'range-custom-start'),
    end = control(page, 'range-custom-end'),
    field = page.getByRole('textbox', { name: 'Write something', exact: true });
  const center = ({ x, y, width, height }) => [(x + width / 2) * dpr, (y + height / 2) * dpr];
  const values = () =>
    Promise.all(
      [start, end].map(async (thumb) => Number(await thumb.getAttribute('aria-valuenow'))),
    );
  await reveal(start, height);
  const [sx, sy] = center(await start.boundingBox()),
    [ex, ey] = center(await end.boundingBox()),
    unit = (ex - sx) / 50;
  assert(unit > 0, 'Range thumb positions');
  assert.deepEqual(await values(), [25, 75]);
  await drag(sx, sy, [[610, sx + 7 * unit, sy]], { step: 16 });
  await wait(475);
  const [slow, stillEnd] = await values();
  assert(slow >= 31 && slow <= 33);
  assert.equal(stillEnd, 75);
  await drag(ex, ey, [
    [94, ex - 6 * unit, ey],
    [84, ex + 4 * unit, ey],
    [100, ex - 9 * unit, ey],
    [100, ex - 6.5 * unit, ey],
  ]);
  await wait(475);
  const [stillStart, fast] = await values();
  assert.equal(stillStart, slow);
  assert(fast >= 67.5 && fast <= 69.5);
  const [cx, cy] = center(await start.boundingBox());
  await drag(cx, cy, [[90, cx + 5 * unit, cy]], { cancel: true });
  await wait(475);
  const [afterCancel] = await values(),
    [nx, ny] = center(await start.boundingBox());
  await drag(nx, ny, [[260, nx - 8 * unit, ny]]);
  await wait(475);
  const [newStart, newEnd] = await values();
  assert(newStart < afterCancel, 'The canceled thumb accepts a new drag');
  assert.equal(newEnd, fast);

  const [fx, fy] = center(await reveal(field, height)).map(Math.round);
  await shell('input', 'tap', String(fx), String(fy));
  await page.waitForFunction(
    () => document.activeElement?.getAttribute('aria-label') === 'Write something',
  );
  let keyboardShown = false;
  for (let attempt = 0; attempt < 8 && !keyboardShown; attempt++) {
    keyboardShown = /mInputShown=true/.test(await shell('dumpsys', 'input_method'));
    if (!keyboardShown) await wait(225);
  }
  assert(keyboardShown, 'Android soft keyboard is visible');
  await shell('input', 'text', '804');
  await page.waitForFunction(() => document.activeElement?.value?.includes('804'));
  await shell('input', 'keyevent', 'KEYCODE_BACK');
  await wait(600);
  assert.doesNotMatch(await shell('dumpsys', 'input_method'), /mInputShown=true/);

  const image = page.getByLabel('Oranges by Mae Mu, Unsplash', { exact: true });
  const box = await reveal(image, height, 190);
  const clip = Object.fromEntries(
    Object.entries(box).map(([dimension, value]) => [dimension, Math.round(value * dpr)]),
  );
  async function orangePixels() {
    const { stdout } = await execute(adbPath, ['-s', device, 'exec-out', 'screencap', '-p'], {
      timeout: 12_000,
      windowsHide: true,
      encoding: 'buffer',
      maxBuffer: 8 * 1024 * 1024,
      signal,
    });
    return page.evaluate(
      async ({ source, clip }) => {
        const png = Uint8Array.from(atob(source), (character) => character.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([png], { type: 'image/png' }));
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext('2d');
        context.drawImage(bitmap, 0, 0);
        bitmap.close();
        const rgba = context.getImageData(clip.x, clip.y, clip.width, clip.height).data;
        let count = 0;
        for (let i = 0; i < rgba.length; i += 4) {
          const r = rgba[i],
            g = rgba[i + 1],
            b = rgba[i + 2];
          if (r > 135 && r > 1.2 * g && g > 1.2 * b) count++;
        }
        return count;
      },
      { source: stdout.toString('base64'), clip },
    );
  }
  const before = await orangePixels();
  assert(before > 1000, 'Local orange image was painted');
  await page.evaluate(async () => {
    const canvas = document.querySelector('canvas'),
      context = canvas.getContext('webgl2'),
      extension = context.getExtension('WEBGL_lose_context');
    const once = (type) =>
      new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(type + ' did not arrive')), 10_000);
        canvas.addEventListener(
          type,
          () => {
            clearTimeout(timeout);
            resolve();
          },
          { once: true },
        );
      });
    const lost = once('webglcontextlost');
    extension.loseContext();
    await lost;
    const restored = once('webglcontextrestored');
    extension.restoreContext();
    await restored;
  });
  let after;
  for (let attempt = 0; attempt < 5; attempt++) {
    await wait(300);
    after = await orangePixels();
    if (Math.abs(after - before) <= before * 0.01) break;
  }
  assert(Math.abs(after - before) <= before * 0.01, 'Local image pixels recovered');
  await resetTop(page, top);
  console.log(
    JSON.stringify({
      range: { slow, fast, afterCancel, newStart, newEnd },
      keyboardShown,
      entered: '804',
      imagePixels: [before, after],
      returnedToTop: true,
    }),
  );
}

try {
  const size = await shell('wm', 'size');
  assert.match(
    size.split(/\r?\n/).at(-1),
    /size: 1080x2340$/,
    'Gesture geometry for Pixel 5 portrait',
  );
  await prepareTouch();
  for (let run = 1; run <= runs; run++) {
    const { page, top, current, errors, close } = await openDemo();
    try {
      const layers = await shell('dumpsys', 'SurfaceFlinger', '--list');
      const layer = layers
        .split(/\r?\n/)
        .find((name) => name.startsWith(pkg + '/' + pkg + '.MainActivity#'));
      console.log(JSON.stringify({ run, ...current, layer }));
      if (controls) {
        await checkControls(page, top, current);
        assert.deepEqual(errors, []);
        break;
      }
      await measure(page, layer, 'top-cold-fling', () => touch(1940, [[205, 505]]), 620);
      if (topOnly) {
        assert.deepEqual(errors, []);
        continue;
      }
      await resetTop(page, top);
      await advance(4);
      await measure(page, layer, 'middle-reversal', reverse, 75);
      await resetTop(page, top);
      await advance(6);
      await measure(page, layer, 'lower-first-fling', lowerFling, 450);
      await measure(page, layer, 'lower-reversal', reverse, 75);
      await advance(4);
      await page.getByRole('button', { name: 'Extract colors' }).waitFor({ state: 'attached' });
      await resetTop(page, top);
      await advance(6);
      await measure(page, layer, 'lower-return-fling', lowerFling, 450);
      await measure(page, layer, 'lower-return-reversal', reverse, 75);
      assert.deepEqual(errors, []);
    } finally {
      await close();
    }
  }
} finally {
  try {
    await cleanupAdb('shell', 'rm', '-f', remote);
  } finally {
    for (const file of await readdir(temp)) await unlink(join(temp, file));
    await rmdir(temp);
    process.off('SIGINT', cancel);
    process.off('SIGTERM', cancel);
  }
}
