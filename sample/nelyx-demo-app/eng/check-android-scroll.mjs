// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { mkdtemp, readdir, rmdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import { installPictureProbe } from './gallery-picture-probe.mjs';

const pkg = 'dev.nelyx.demo.tauri';
const device = process.env.ANDROID_SERIAL ?? 'emulator-5554';
const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
const java = process.env.JAVA_HOME;
const runs = Number(process.env.NELYX_SCROLL_RUNS ?? 3);
const pictures = process.argv.includes('--pictures');
const cpu = pictures || process.argv.includes('--cpu');
const topOnly = process.argv.includes('--top-only');
const imageEntryOnly = process.argv.includes('--image-entry-only');
const editorEntryOnly = process.argv.includes('--editor-entry-only');
const inertia = process.argv.includes('--inertia');
const controlChecks = {
  slider: checkSlider,
  range: checkRange,
  ime: checkIme,
  image: checkImage,
};
const controlFlag = process.argv.find(
  (arg) => arg === '--controls' || arg.startsWith('--controls='),
);
const controls =
  controlFlag === '--controls'
    ? Object.keys(controlChecks)
    : (controlFlag?.slice('--controls='.length).split(',') ?? []);
assert(
  controls.every((name) => Object.hasOwn(controlChecks, name)),
  'Use --controls=slider,range,ime,image',
);
const gl = cpu || process.argv.includes('--gl');
const cssOnly = process.argv.includes('--css-only');
const traceProcessor = process.argv.includes('--timeline')
  ? process.env.NELYX_TRACE_PROCESSOR
  : null;
assert(
  traceProcessor === null || (traceProcessor && controls.length === 0),
  'Set NELYX_TRACE_PROCESSOR to the Perfetto executable and run --timeline with a scroll route',
);
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
const softwareRenderer =
  /\b(?:swiftshader|llvmpipe|softpipe|lavapipe|software|warp)\b|Microsoft Basic Render Driver/i;
let galleryTouchX = 96;

function assertHardwareRenderer(renderer, source) {
  assert.ok(typeof renderer === 'string' && renderer.trim(), `${source} renderer is unavailable`);
  assert.doesNotMatch(renderer, softwareRenderer, `${source} must use hardware rendering`);
}

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
  const x = galleryTouchX;
  return drag(
    x,
    start,
    segments.map(([duration, y]) => [duration, x, y]),
    { step },
  );
}

async function drag(x, y, segments, { step = 8, cancel = false } = {}) {
  const output = await galleryTouch(
    String(step),
    String(x),
    String(y),
    ...segments.flat().map(String),
    ...(cancel ? ['cancel'] : []),
  );
  const times = output.split(/\r?\n/).at(-1).split(',').map(Number);
  const [start, end, lastMovement] = times;
  assert(
    times.length === 3 &&
      times.every(Number.isSafeInteger) &&
      end > start &&
      lastMovement >= start &&
      lastMovement <= end,
    output,
  );
  return times;
}

const galleryTouch = (...args) =>
  shell('CLASSPATH=' + remote, 'app_process', '/system/bin', 'GalleryTouch', ...args);

function installProbe({ gl, cpu, range }) {
  if (range) {
    const samples = [];
    window.galleryTouches = () => samples.splice(0);
    window.galleryLastTouch = () => samples.at(-1)?.[0];
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'])
      document.addEventListener(
        type,
        (event) => {
          if (event.pointerType === 'touch' && samples.length < 256) {
            samples.push([type, event.clientX, event.clientY, event.timeStamp, performance.now()]);
          }
        },
        true,
      );
  }
  if (cpu)
    window.nelyxDemoFrameProbe = (read) => {
      window.galleryFrames = read;
    };
  if (cpu && !window.CanvasKitInit) {
    const events = (window.galleryCodecs = []);
    function measure(owner, name, dimensions, label = name) {
      const original = owner[name];
      if (typeof original !== 'function') return;
      owner[name] = function (...args) {
        const at = performance.now();
        const result = Reflect.apply(original, this, args);
        if (events.length < 256)
          events.push([label, at, performance.now() - at, ...dimensions(result, args)]);
        return result;
      };
    }
    if (typeof ImageDecoder === 'function')
      measure(
        ImageDecoder.prototype,
        'decode',
        (pending) => {
          const at = performance.now();
          void pending.then(
            ({ image }) => {
              if (events.length < 256)
                events.push([
                  'ImageDecoder result',
                  at,
                  performance.now() - at,
                  image.displayWidth,
                  image.displayHeight,
                  image.format,
                  image.colorSpace.toJSON(),
                ]);
            },
            () => {},
          );
          return [];
        },
        'ImageDecoder dispatch',
      );
    if (typeof VideoFrame === 'function')
      measure(
        VideoFrame.prototype,
        'copyTo',
        (_result, [pixels, options]) => [pixels.byteLength, options?.format ?? 'native'],
        'VideoFrame copy dispatch',
      );
    Object.defineProperty(window, 'CanvasKitInit', {
      configurable: true,
      set(factory) {
        Object.defineProperty(window, 'CanvasKitInit', {
          configurable: true,
          async value(options) {
            const kit = await factory(options);
            measure(kit, 'MakeAnimatedImageFromEncoded', (result, [bytes]) =>
              result
                ? [result.width(), result.height(), result.getFrameCount(), bytes.byteLength]
                : [],
            );
            measure(kit, 'MakeImageFromEncoded', (result, [bytes]) =>
              result ? [result.width(), result.height(), 1, bytes.byteLength] : [],
            );
            measure(kit, 'MakeSurface', (_result, args) => args.slice(0, 2));
            measure(kit, 'MakeImage', (_result, [info]) => [info.width, info.height]);
            measure(kit, 'MakeLazyImageFromTextureSource', (_result, [, info]) =>
              info ? [info.width, info.height] : [],
            );
            measure(kit.AnimatedImage.prototype, 'makeImageAtCurrentFrame', (result) =>
              result ? [result.width(), result.height()] : [],
            );
            measure(kit.Surface.prototype, 'makeImageSnapshot', (result) =>
              result ? [result.width(), result.height()] : [],
            );
            window.galleryInspectCanvasKit?.(kit);
            return kit;
          },
        });
      },
    });
  }
  if (!gl) return;
  window.galleryGl = [];
  window.galleryFences = [];
  const programs = new WeakMap();
  const fenceStarts = new WeakMap();
  let programCount = 0;
  for (const name of [
    'getShaderParameter',
    'getProgramParameter',
    'compileShader',
    'linkProgram',
    'useProgram',
    'texImage2D',
    'texSubImage2D',
    'getUniformLocation',
    'bufferData',
    'bufferSubData',
    'fenceSync',
    'clientWaitSync',
    'flush',
  ]) {
    const proto = WebGL2RenderingContext.prototype;
    const original = proto[name];
    proto[name] = function (...args) {
      const at = performance.now();
      const result = Reflect.apply(original, this, args);
      if (cpu && name === 'fenceSync' && result) fenceStarts.set(result, at);
      if (
        cpu &&
        name === 'clientWaitSync' &&
        (result === this.ALREADY_SIGNALED || result === this.CONDITION_SATISFIED)
      ) {
        const start = fenceStarts.get(args[0]);
        if (start !== undefined && window.galleryFences.length < 4096)
          window.galleryFences.push([start, performance.now()]);
      }
      if (window.galleryGl.length < 16000) {
        const program = ['linkProgram', 'useProgram', 'getProgramParameter'].includes(name)
          ? args[0]
          : undefined;
        if (program && !programs.has(program)) programs.set(program, ++programCount);
        window.galleryGl.push([
          name,
          at,
          performance.now() - at,
          name.endsWith('Parameter') ? args[1] : null,
          program ? programs.get(program) : null,
          name === 'texImage2D' && args.length >= 9
            ? [args[3], args[4]]
            : name === 'texSubImage2D' && args.length >= 9
              ? [args[4], args[5]]
              : null,
        ]);
      }
      return result;
    };
  }
}

const control = (page, id) => page.locator(`[data-semantics-identifier="${id}"]`);
const filled = (page) => control(page, 'demo-filled');

function readGallerySurface(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const context = canvas?.getContext('webgl2');
    const debug = context?.getExtension('WEBGL_debug_renderer_info');
    return {
      raster: canvas ? [canvas.width, canvas.height] : null,
      webgl2: Boolean(context && !context.isContextLost()),
      glRenderer: debug ? context.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
      failIfMajorPerformanceCaveat: context?.getContextAttributes()?.failIfMajorPerformanceCaveat,
    };
  });
}

async function openDemo(check) {
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
    let ready = false;
    const devToolsDeadline = performance.now() + 60_000;
    while (performance.now() < devToolsDeadline) {
      try {
        const targets = await fetch(endpoint + '/json/list', {
          signal: AbortSignal.any([signal, AbortSignal.timeout(1000)]),
        });
        if (targets.ok && (await targets.json()).some((target) => target.type === 'page')) {
          ready = true;
          break;
        }
      } catch {
        signal.throwIfAborted();
      }
      await wait(500);
    }
    assert(ready, 'WebView DevTools did not become ready for PID ' + pid);
    browser = await chromium.connectOverCDP(endpoint, { timeout: 12_000, noDefaults: true });
    signal.throwIfAborted();
    signal.addEventListener('abort', disconnect, { once: true });
    const context = browser.contexts()[0];
    assert(context, 'Tauri WebView context was not available');
    const page = context.pages()[0] ?? (await context.waitForEvent('page', { timeout: 12_000 }));
    const errors = [];
    page.setDefaultTimeout(12_000);
    page.on('pageerror', (error) => errors.push(String(error)));
    const probe = { gl, cpu, range: check === 'range' };
    let probeReloaded = false;
    const reloadWithProbe = async () => {
      await context.addInitScript(installProbe, probe);
      await page.reload({ timeout: 25_000 });
      probeReloaded = true;
    };
    // Prefer the original Android viewport. A reload can change its window insets.
    if (pictures) {
      await context.addInitScript(installPictureProbe);
      await page.evaluate(installPictureProbe);
    }
    if (probe.range) await reloadWithProbe();
    else if (gl) await page.evaluate(installProbe, probe);
    await filled(page).waitFor({ state: 'attached', timeout: 25_000 });
    const hasProbe = () =>
      page.evaluate(
        (pictures) =>
          Boolean(
            window.galleryFrames &&
            window.galleryCodecs &&
            (!pictures || window.galleryPictureDraws),
          ),
        pictures,
      );
    if (cpu && !(await hasProbe())) {
      assert(!probeReloaded, 'CPU probe did not attach after reload');
      await reloadWithProbe();
      await filled(page).waitFor({ state: 'attached', timeout: 25_000 });
      assert(await hasProbe());
    }
    const top = (await filled(page).boundingBox())?.y;
    assert(Number.isFinite(top));
    const current = await page.evaluate(async (cpu) => {
      const manifest = await fetch(new URL('build.json', location.href)).then((response) =>
        response.json(),
      );
      return {
        build: manifest.buildId,
        width: innerWidth,
        height: innerHeight,
        dpr: devicePixelRatio,
        ...(cpu ? { timeOrigin: performance.timeOrigin } : {}),
      };
    }, cpu);
    const surface = await readGallerySurface(page);
    if (!check) {
      assert.ok(surface.webgl2, 'Gallery WebGL2 context is unavailable');
      assertHardwareRenderer(surface.glRenderer, 'Gallery WebGL2');
    }
    return {
      page,
      top,
      current: { ...current, ...surface, ...(gl ? { probeReloaded } : {}) },
      errors,
      close,
    };
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
    if (layerLatency && /^\s*\d+\s+\d+\s+\d+\s*$/.test(line))
      present = Number(line.trim().split(/\s+/)[1]);
    else if (!layerLatency && columns && line.startsWith('0,')) {
      present = Number(line.split(',')[columns.indexOf('DisplayPresentTime')]);
    }
    if (present >= start && present <= end) times.add(present);
  }
  return presentIntervals(times);
}

function presentIntervals(times) {
  const ordered = [...times].sort((a, b) => a - b);
  return percentiles(ordered.slice(1).map((value, index) => (value - ordered[index]) / 1e6));
}

async function traceAndroidFrames(layers, run) {
  const key = `nelyx-gallery-${process.pid}-${run}`;
  const remoteTrace = `/data/misc/perfetto-traces/${key}.pftrace`;
  const localTrace = join(temp, key + '.pftrace');
  const windows = [];
  const config = `
    buffers { size_kb: 2048 fill_policy: RING_BUFFER }
    data_sources { config { name: "android.surfaceflinger.frametimeline" } }
    data_sources { config {
      name: "linux.process_stats"
      process_stats_config { scan_all_processes_on_start: true }
    } }
    duration_ms: 240000
    write_into_file: true
    file_write_period_ms: 1000
    flush_period_ms: 1000
    max_file_size_bytes: 8388608
  `;
  const stop = () => cleanupAdb('shell', 'perfetto', '--attach=' + key, '--stop');
  try {
    await new Promise((resolve, reject) => {
      const recorder = spawn(
        adbPath,
        [
          '-s',
          device,
          'shell',
          'perfetto',
          '--detach=' + key,
          '--txt',
          '-c',
          '-',
          '-o',
          remoteTrace,
        ],
        { windowsHide: true, signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]) },
      );
      let errors = '';
      recorder.stdout.resume();
      recorder.stderr.on('data', (chunk) => {
        errors += chunk;
      });
      recorder.stdin.once('error', reject);
      recorder.once('error', reject);
      recorder.once('close', (status) => {
        if (status === 0) resolve();
        else reject(new Error(`FrameTimeline start failed (${status}) ${errors.trim()}`));
      });
      recorder.stdin.end(config);
    });
    await shell('perfetto', '--is_detached=' + key);
  } catch (error) {
    await stop().catch(() => {});
    await cleanupAdb('shell', 'rm', '-f', remoteTrace);
    throw error;
  }

  return {
    record(route, start, end, { movingEnd, released } = {}) {
      const window = { route, start, end, movingEnd, released };
      windows.push(window);
      return window;
    },
    async close() {
      try {
        await stop();
        if (!windows.length || signal.aborted) return;
        await adb('pull', remoteTrace, localTrace);
        const quote = (value) => "'" + value.replaceAll("'", "''") + "'";
        const layerNames = layers.flatMap((layer) => [layer, 'TX - ' + layer]).map(quote);
        // A surface slice ends at app completion. Follow its token to the
        // display slice and take the SurfaceFlinger presentation time.
        const query = `
          WITH app_frames AS (
            SELECT app.display_frame_token, EXTRACT_ARG(app.arg_set_id, 'Is Buffer?') AS buffer
            FROM actual_frame_timeline_slice AS app JOIN process USING (upid)
            WHERE process.name = ${quote(pkg)} AND surface_frame_token > 0
              AND layer_name IN (${layerNames.join(', ')})
              AND present_type IN ('Early Present', 'On-time Present', 'Late Present')
          )
          SELECT 'clock' AS kind, MIN(ts - clock_value) AS first, MAX(ts - clock_value) AS last
          FROM clock_snapshot WHERE clock_name = 'MONOTONIC'
          UNION ALL
          SELECT 'coverage', COALESCE(
            MIN(CASE name WHEN 'all_data_source_started_ns' THEN int_value END),
            MIN(CASE name WHEN 'tracing_started_ns' THEN int_value END)
          ),
            MAX(CASE name WHEN 'tracing_disabled_ns' THEN int_value END)
          FROM metadata
          UNION ALL
          SELECT DISTINCT CASE app_frames.buffer WHEN 'Yes' THEN 'buffer' ELSE 'layer' END,
            display.ts + display.dur, 0
          FROM app_frames JOIN actual_frame_timeline_slice AS display USING (display_frame_token)
          JOIN process ON process.upid = display.upid
          WHERE process.name = '/system/bin/surfaceflinger' AND display.layer_name IS NULL
            AND display.dur > 0
            AND display.present_type IN ('Early Present', 'On-time Present', 'Late Present')
        `;
        const { stdout } = await execute(
          traceProcessor,
          ['query', '--format', 'csv', localTrace, query],
          { windowsHide: true, timeout: 20_000, maxBuffer: 2_000_000, signal },
        );
        const rows = stdout
          .trim()
          .split(/\r?\n/)
          .slice(1)
          .map((line) => line.split(','));
        const pair = (key) => {
          const row = rows.find(([kind]) => kind === JSON.stringify(key));
          const fields = row?.slice(1);
          const values = fields?.map(Number);
          assert(
            fields?.length === 2 &&
              fields.every((value) => /^-?\d+$/.test(value)) &&
              values?.every(Number.isSafeInteger),
            'Missing FrameTimeline ' + key,
          );
          return values;
        };
        const [minOffset, maxOffset] = pair('clock');
        const [traceStart, traceEnd] = pair('coverage');
        const offset = (minOffset + maxOffset) / 2;
        const timestamps = rows.filter(([kind]) => kind === '"layer"' || kind === '"buffer"');
        const nextBufferOnOrAfter = (start, end) => {
          let earliest = Infinity;
          for (const [kind, value] of timestamps) {
            if (kind !== '"buffer"') continue;
            const time = Number(value) - offset;
            if (time >= start && time <= end) earliest = Math.min(earliest, time);
          }
          return Number.isFinite(earliest) ? earliest : undefined;
        };
        const stats = (start, end, includeGaps = false) => {
          const displayTimes = new Set();
          const bufferTimes = new Set();
          for (const [kind, value] of timestamps) {
            const time = Number(value) - offset;
            if (time >= start && time <= end) {
              displayTimes.add(time);
              if (kind === '"buffer"') bufferTimes.add(time);
            }
          }
          const result = {
            display: presentIntervals(displayTimes),
            bufferDisplay: presentIntervals(bufferTimes),
            firstBufferPresentDelayMs: bufferTimes.size
              ? rounded((Math.min(...bufferTimes) - start) / 1e6)
              : null,
          };
          if (includeGaps) {
            const ordered = [...bufferTimes].sort((a, b) => a - b);
            result.gapsOver33 = ordered.slice(1).flatMap((time, index) => {
              const previous = ordered[index];
              return time - previous >= 33.3e6
                ? [[rounded((previous - start) / 1e6), rounded((time - start) / 1e6)]]
                : [];
            });
          }
          return result;
        };
        console.log(
          JSON.stringify({
            frameTimeline: windows.map((window) => {
              const { route, start, end, movingEnd, released, lastMotionSubmit } = window;
              const covered = start + minOffset >= traceStart && end + maxOffset <= traceEnd;
              // Correlate the last moving JS submit with the next buffer in time.
              // The native presentation has no matching JS frame identifier.
              const motionPresent =
                covered && released && lastMotionSubmit
                  ? nextBufferOnOrAfter(lastMotionSubmit, end)
                  : undefined;
              return {
                route,
                covered,
                ...(covered
                  ? stats(start, end)
                  : { display: null, bufferDisplay: null, firstBufferPresentDelayMs: null }),
                ...(covered && movingEnd
                  ? { movingBufferDisplay: stats(start, movingEnd).bufferDisplay }
                  : {}),
                ...(covered && released
                  ? {
                      beforeRelease: stats(start, released).bufferDisplay,
                      afterRelease: stats(released, end, true),
                      ...(motionPresent
                        ? { afterReleaseThroughNextPresent: stats(released, motionPresent, true) }
                        : {}),
                    }
                  : {}),
              };
            }),
            clockOffsetSpanMs: rounded((maxOffset - minOffset) / 1e6),
          }),
        );
      } finally {
        await cleanupAdb('shell', 'rm', '-f', remoteTrace);
      }
    },
  };
}

async function measureCss(page, layer, timeline) {
  await wait(400);
  await shell('dumpsys', 'gfxinfo', pkg, 'reset');
  if (layer) await shell('dumpsys', 'SurfaceFlinger', '--latency-clear', layer);
  const start = Number(await galleryTouch('--clock'));
  const raf = await page.evaluate(async () => {
    const square = document.createElement('div');
    square.style.cssText =
      'position:fixed;top:30%;left:10%;width:32px;height:32px;background:red;z-index:2147483647;pointer-events:none';
    document.body.append(square);
    try {
      const animation = square.animate(
        [{ transform: 'translateY(0)' }, { transform: 'translateY(45vh)' }],
        { duration: 1500, iterations: 1, fill: 'forwards' },
      );
      const times = [];
      await new Promise((resolve) => {
        const sample = (t) => {
          times.push(t);
          if (t - times[0] >= 1500 || animation.playState === 'finished') resolve();
          else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      return times.slice(1).map((t, i) => t - times[i]);
    } finally {
      square.remove();
    }
  });
  const end = Number(await galleryTouch('--clock'));
  timeline?.record('css-control', start, end);
  const stats = await shell('dumpsys', 'gfxinfo', pkg, 'framestats');
  const sf = layer ? await shell('dumpsys', 'SurfaceFlinger', '--latency', layer) : '';
  console.log(
    JSON.stringify({
      route: 'css-control',
      raf: percentiles(raf),
      hwui: displayIntervals(stats, start, end, false),
      compositor: displayIntervals(sf, start, end, true),
    }),
  );
}
async function drain(page) {
  return page.evaluate(() => ({
    trace: window.galleryFrames?.(),
    gl: window.galleryGl?.splice(0) ?? [],
    codecs: window.galleryCodecs?.splice(0) ?? [],
    pictures: window.galleryPictureDraws?.(),
    retired: window.galleryFences?.splice(0) ?? [],
  }));
}

function flushOrder(samples, calls) {
  const intervals = samples
    .filter(({ stage }) => stage === 'native-submit' || stage === 'gpu-fence-enqueue')
    .map(({ stage, begin, end }) => ({
      stage,
      flushes: calls.filter(([name, at]) => name === 'flush' && begin <= at && at <= end),
    }));
  return Object.fromEntries(
    ['native-submit', 'gpu-fence-enqueue'].map((stage) => {
      const submissions = intervals.filter((entry) => entry.stage === stage);
      const flushes = submissions.flatMap((entry) => entry.flushes);
      return [
        stage,
        {
          submissions: submissions.length,
          calls: flushes.length,
          time: percentiles(flushes.map(([, , duration]) => duration)),
        },
      ];
    }),
  );
}

function imageWork({ codecs, gl, trace }) {
  let firstUpload;
  const event = gl.find(
    ([, , , , , dimensions]) => dimensions?.[0] === 960 && dimensions[1] === 1440,
  );
  if (event) {
    const [name, at, elapsed] = event;
    const frame = trace?.frames.samples.find(
      ({ stage, begin, end }) =>
        (stage === 'native-submit' || stage === 'native-replay') && begin <= at && at <= end,
    );
    firstUpload = { op: name, at: rounded(at), ms: rounded(elapsed), frame: frame?.frame };
  }
  return {
    codecs: codecs.map(([name, at, elapsed, ...details]) => [
      name,
      rounded(at),
      rounded(elapsed),
      ...details,
    ]),
    firstUpload,
    dynamicImageBytes: trace?.pictures?.dynamicImageBytes,
  };
}

function longestFlushes(samples, calls) {
  // App.tsx supplies the same WebView Performance object used by installProbe.
  return samples
    .filter((entry) => entry.stage === 'native-submit')
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 4)
    .map(({ frame, input, begin, end, duration }) => {
      const spent = {};
      const programs = [];
      for (const [name, at, elapsed, selector, program] of calls) {
        const overlap = Math.min(end, at + elapsed) - Math.max(begin, at);
        if (name === 'linkProgram' && begin <= at && at <= end) programs.push(program);
        if (overlap <= 0) continue;
        const key = selector === 0x8b82 && name === 'getProgramParameter' ? 'LINK_STATUS' : name;
        spent[key] = (spent[key] ?? 0) + overlap;
      }
      return {
        frame,
        input,
        begin: rounded(begin),
        ms: rounded(duration),
        programs,
        calls: Object.fromEntries(Object.entries(spent).map(([name, ms]) => [name, rounded(ms)])),
      };
    });
}

function visibleCards(page) {
  return page.evaluate(() => {
    const titles = new Set([
      'Common buttons',
      'Icon buttons',
      'Badges',
      'Progress indicators',
      'Cards',
      'Dialogs',
      'Dividers',
      'Destinations and drawer',
      'Checkboxes',
      'Date picker',
      'Chips',
      'Radio buttons',
      'Sliders',
      'Switches',
      'Text fields',
      'Write something',
      'Your message',
      'Local and network images',
    ]);
    const visible = [];
    const controls = [];
    for (const node of document.querySelectorAll('[aria-label], [role="text"]')) {
      const label = node.getAttribute('aria-label') || node.textContent;
      if (!label) continue;
      const { top, bottom, width, height } = node.getBoundingClientRect();
      if (width <= 0 || height <= 0 || bottom <= 0 || top >= innerHeight) continue;
      for (const line of label.split('\n')) if (titles.has(line)) visible.push([line, top]);
      if (node.closest('[role="list"]') && node.matches('button, [role="slider"]'))
        controls.push([label, top]);
    }
    const landmarks = visible.length ? visible : controls;
    return [...new Set(landmarks.sort((a, b) => a[1] - b[1]).map(([label]) => label))].slice(0, 6);
  });
}

async function measure(page, layer, route, gesture, tail, timeline, clocks) {
  const before = gl ? await drain(page) : undefined;
  await shell('dumpsys', 'gfxinfo', pkg, 'reset');
  if (layer) await shell('dumpsys', 'SurfaceFlinger', '--latency-clear', layer);
  const from = await visibleCards(page);
  const [start, end, lastMovement] = await gesture();
  await wait(tail + 60);
  const stats = await shell('dumpsys', 'gfxinfo', pkg, 'framestats');
  const sf = layer ? await shell('dumpsys', 'SurfaceFlinger', '--latency', layer) : '';
  const bounds = end + tail * 1e6;
  const isFling = route.endsWith('-fling');
  const timelineWindow = timeline?.record(route, start, bounds, {
    movingEnd: end - lastMovement > 30e6 ? lastMovement : undefined,
    released: isFling ? end : undefined,
  });
  const result = {
    route,
    from,
    to: await visibleCards(page),
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
        read.gl
          .filter(([name]) => name === 'texSubImage2D' || name === 'texImage2D')
          .map(([, , duration]) => duration),
      ),
    });
    if (read.trace && before?.trace) {
      const stages = [
        'build',
        'layout',
        'paint',
        'compose',
        'input-geometry',
        'semantics',
        'semantics-flush',
        'semantics-snapshot',
        'semantics-freeze',
        'semantics-publish',
        'input-queue',
        'input-dispatch',
        'pending',
        'native-replay',
        'native-submit',
        'gpu-fence-enqueue',
      ];
      const samples = read.trace.frames.samples;
      const submissions = samples.filter(({ stage }) => stage === 'submit');
      const dispatches = samples.filter(({ stage }) => stage === 'input-dispatch');
      let dispatch = 0,
        latestInput = 0;
      const inputLag = submissions.map(({ begin, input }) => {
        while (dispatch < dispatches.length && dispatches[dispatch].end <= begin)
          latestInput = dispatches[dispatch++].input;
        return Math.max(0, latestInput - input);
      });
      const firstInput = dispatches[0];
      const firstSubmit = submissions[0];
      const programs = new Map();
      for (const [name, , , , id] of read.gl) {
        if (name === 'useProgram' && id !== null) programs.set(id, (programs.get(id) ?? 0) + 1);
      }
      Object.assign(result, {
        costs: Object.fromEntries(
          stages.map((stage) => [
            stage,
            percentiles(
              samples.filter((entry) => entry.stage === stage).map((entry) => entry.duration),
            ),
          ]),
        ),
        cold: read.trace.sections.requiredColdChildren - before.trace.sections.requiredColdChildren,
        prepared: read.trace.sections.published - before.trace.sections.published,
        reused: (read.trace.dormant?.hits ?? 0) - (before.trace.dormant?.hits ?? 0),
        overwritten: read.trace.frames.overwritten,
        clocks: {
          gestureStartNs: start,
          firstInput: firstInput ? rounded(firstInput.begin) : null,
          firstSubmit: firstSubmit ? rounded(firstSubmit.begin) : null,
          firstFences: read.gl
            .filter(([name]) => name === 'fenceSync')
            .slice(0, 4)
            .map(([, at]) => rounded(at)),
          firstRetirement: read.retired.length ? read.retired[0].map(rounded) : null,
        },
        inputLag: percentiles(inputLag),
        observedFenceRetirement: percentiles(read.retired.map(([begin, end]) => end - begin)),
        programsUsed: Object.fromEntries(programs),
        flushOrder: flushOrder(samples, read.gl),
        flushes: longestFlushes(samples, read.gl),
        sectionWork: sectionWork(samples),
        decoration: decorationWork(samples),
        ...(read.pictures ? { replayPictures: read.pictures } : {}),
        ...(read.codecs.length ? { image: imageWork(read) } : {}),
      });
      if (isFling && clocks) {
        const release = end / 1e6 - clocks.monotonicMsAtTimeOrigin;
        const after = samples.filter(({ begin }) => begin >= release && begin <= release + tail);
        const motion = [];
        let previousOffset = samples.findLast(
          ({ begin, scrollOffset }) => begin < release && scrollOffset !== undefined,
        )?.scrollOffset;
        for (const entry of after) {
          if (entry.scrollOffset === undefined || entry.scrollOffset === previousOffset) continue;
          motion.push(entry);
          previousOffset = entry.scrollOffset;
        }
        const lastChange = motion.at(-1);
        const layoutOffsets = new Map();
        for (const sample of samples) {
          if (sample.scrollOffset !== undefined)
            layoutOffsets.set(sample.frame, sample.scrollOffset);
        }
        let lastChangingSubmit, previousSubmittedOffset;
        for (const sample of samples) {
          // An attempted submit can be rejected before it reaches WebGL.
          if (sample.stage !== 'gpu-fence-enqueue') continue;
          const offset = layoutOffsets.get(sample.frame);
          if (offset === undefined || offset === previousSubmittedOffset) continue;
          previousSubmittedOffset = offset;
          if (sample.end >= release && sample.end <= release + tail) lastChangingSubmit = sample;
        }
        if (timelineWindow && lastChangingSubmit)
          timelineWindow.lastMotionSubmit =
            (lastChangingSubmit.end + clocks.monotonicMsAtTimeOrigin) * 1e6;
        const expensive = after
          .filter(({ stage }) => stage === 'section-create' || stage === 'native-submit')
          .sort((a, b) => b.duration - a.duration);
        const frames = [...new Set(expensive.map(({ frame }) => frame))].slice(0, 3);
        result.afterRelease = {
          ...(lastChange
            ? {
                viewportMotion: {
                  samples: motion.length,
                  lastLayoutMs: rounded(lastChange.begin - release),
                  lastSubmitMs: lastChangingSubmit
                    ? rounded(lastChangingSubmit.end - release)
                    : null,
                  lastOffset: rounded(lastChange.scrollOffset),
                },
              }
            : {}),
          layout: percentiles(
            after.filter(({ stage }) => stage === 'layout').map(({ duration }) => duration),
          ),
          nativeSubmit: percentiles(
            after.filter(({ stage }) => stage === 'native-submit').map(({ duration }) => duration),
          ),
          frameCosts: frames.map((frame) => ({
            frame,
            phases: Object.fromEntries(
              samples
                .filter((sample) => sample.frame === frame && stages.includes(sample.stage))
                .map(({ stage, begin, duration }) => [
                  stage,
                  { ms: rounded(duration), afterReleaseMs: rounded(begin - release) },
                ]),
            ),
          })),
          sectionWork: sectionWork(after)
            .slice(0, 8)
            .map(({ frame, section, stage, ms }) => {
              const sample = after.find(
                (entry) =>
                  entry.frame === frame && entry.stage === stage && entry.section === section,
              );
              return { frame, section, stage, ms, afterReleaseMs: rounded(sample.begin - release) };
            }),
        };
      }
    }
  }
  console.log(JSON.stringify(result));
  return result;
}

function sectionWork(samples) {
  return samples
    .filter((entry) => entry.section !== undefined)
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 20)
    .map(({ frame, section, stage, duration }) => ({
      frame,
      section,
      stage,
      ms: rounded(duration),
    }));
}

function decorationWork(samples) {
  const frames = new Set(
    samples
      .filter(
        ({ stage, section }) => stage === 'section-create' && (section === 18 || section === 19),
      )
      .map(({ frame }) => frame),
  );
  return samples
    .filter(({ frame, decorationSlot }) => frames.has(frame) && decorationSlot)
    .map(({ frame, stage, decorationSlot, dry, duration }) => [
      frame,
      stage === 'input-decoration-baseline' ? 'baseline' : 'size',
      decorationSlot,
      dry ? 'dry' : 'layout',
      rounded(duration),
    ]);
}

async function resetTop(page, top) {
  for (let attempt = 0; attempt <= 9; attempt++) {
    if ((await filled(page).count()) && Math.abs((await filled(page).boundingBox())?.y - top) <= 2)
      return;
    if (attempt === 9) break;
    await touch(540, [[205, 1930]]);
    await wait(460);
  }
  assert.fail('Returned to the first gallery card');
}
async function advance(count, onSwipe, observeCards) {
  for (let i = 0; i < count; i++) {
    const from = await observeCards?.();
    const [start, end, lastMovement] = await touch(
      1810,
      [
        [1180, 545],
        [70, 545],
      ],
      12,
    );
    onSwipe?.(i + 1, start, end, lastMovement);
    if (from) {
      console.log(
        JSON.stringify({
          route: `image-approach-${i + 1}`,
          gestureMs: rounded((end - start) / 1e6),
          from,
          to: await observeCards(),
        }),
      );
    }
  }
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

async function reveal(locator, height, minHeight = 1, towardStart = false) {
  const visible = (box) =>
    box && box.height >= minHeight && box.y > 96 && box.y + box.height < height - 30;
  for (let attempt = 0; attempt < 16; attempt++) {
    const box = (await locator.count()) ? await locator.boundingBox() : null;
    if (visible(box)) {
      await wait(250);
      const settled = await locator.boundingBox();
      if (
        visible(settled) &&
        Math.abs(settled.y - box.y) <= 0.5 &&
        Math.abs(settled.height - box.height) <= 0.5
      )
        return settled;
      continue;
    }
    if (box ? box.y < height / 3 : towardStart)
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
  assert.fail('Could not reveal ' + locator + ' at height ' + minHeight);
}

const imageCardTitle = 'Local and network images';
const firstEditorTitle = 'Write something';

async function adjustGalleryOffset(correction, dpr) {
  const distance = Math.sign(correction) * Math.min(115, Math.abs(correction) + 8);
  const end = Math.round(1210 - distance * dpr);
  await touch(
    1210,
    [
      [380, end],
      [90, end],
    ],
    12,
  );
  await wait(280);
}

async function alignImageEntry(page, { height, dpr }, readCards) {
  const marker = control(page, 'toggle-message-lines');
  const target = height - 140;
  for (let move = 0; move <= 12; move++) {
    const box = (await marker.count()) ? await marker.boundingBox() : null;
    const atImage = (await readCards()).includes(imageCardTitle);
    if (box && Math.abs(box.y - target) <= 12 && !atImage) return rounded(box.y);
    if (move === 12) break;
    // A fast lower fling can pass the marker before the alignment starts.
    const delta = (box?.y ?? target + (atImage ? -100 : 100)) - target;
    await adjustGalleryOffset(atImage ? Math.min(-16, delta) : delta, dpr);
  }
  assert.fail('Could not align the text field actions before the image fling');
}

async function alignEditorEntry(page, dpr) {
  const marker = control(page, 'switch-value');
  const list = await page.getByRole('list').first().boundingBox();
  assert(list, 'The gallery list must be visible before aligning the editor entry');
  const listBottom = list.y + list.height;
  const target = listBottom - 168;
  for (let move = 0; move <= 16; move++) {
    const cards = await visibleCards(page);
    assert(!cards.includes(firstEditorTitle), 'The first editor was exposed before the fling');
    const box = (await marker.count()) ? await marker.boundingBox() : null;
    if (box && Math.abs(box.y - target) <= 6)
      return { y: rounded(box.y), listBottom: rounded(listBottom) };
    if (move === 16) break;
    // Adjust against the scroll clip. Android insets and the gallery footer
    // place it above the WebView window's bottom edge.
    const correction = box ? box.y - target : cards.includes('Text fields') ? -70 : 100;
    await adjustGalleryOffset(correction, dpr);
  }
  assert.fail('Could not align the switch before the editor fling');
}

const physicalCenter = ({ x, y, width, height }, dpr) => [
  (x + width / 2) * dpr,
  (y + height / 2) * dpr,
];

async function openCategory(page, category) {
  // Activate the accessible buttons. The control under test receives Android input.
  await control(page, 'open-drawer').evaluate((button) => button.click());
  await page
    .getByRole('button', { name: category, exact: true })
    .evaluate((button) => button.click());
  await page.getByRole('button', { name: 'Show all', exact: true }).waitFor({ state: 'attached' });
}

async function showAll(page, top) {
  await page
    .getByRole('button', { name: 'Show all', exact: true })
    .evaluate((button) => button.click());
  await resetTop(page, top);
}

async function holdThenScroll(x, y, dpr) {
  await drag(
    x,
    y,
    [
      [245, x, y],
      [320, x, y - 100 * dpr],
      [80, x, y - 100 * dpr],
    ],
    { step: 12 },
  );
  await wait(430);
}

async function checkSlider(page, top, { height, dpr }) {
  await openCategory(page, 'Selection');
  const slider = control(page, 'slider-value');
  const value = async () => Number(await slider.getAttribute('aria-valuenow'));
  const before = await reveal(slider, height);
  const initial = await value();
  const [, y] = physicalCenter(before, dpr);
  await holdThenScroll((before.x + before.width * 0.65) * dpr, y, dpr);
  const after = await slider.boundingBox();
  assert(after && before.y - after.y >= 40, 'A held vertical swipe scrolls from the slider track');
  const afterHeldScroll = await value();
  assert.equal(afterHeldScroll, initial, 'A held vertical swipe must preserve the slider value');
  const [, tapY] = physicalCenter(after, dpr);
  const tapX = Math.round((after.x + after.width * 0.75) * dpr);
  await shell('input', 'tap', String(tapX), String(Math.round(tapY)));
  await wait(430);
  const tapped = await value();
  assert(tapped > initial, 'A tap after the vertical swipe must still adjust the slider');
  const x = (fraction) => (after.x + after.width * fraction) * dpr;
  const move = async (from, points, cancel = false) => {
    await drag(
      x(from),
      tapY,
      points.map(([duration, to]) => [duration, x(to), tapY]),
      { cancel },
    );
    await wait(330);
    return value();
  };
  const slow = await move(0.75, [
    [540, 0.4],
    [80, 0.4],
  ]);
  assert(slow >= 30 && slow <= 50, 'Single slider follows a slow horizontal drag');
  const reversed = await move(0.4, [
    [130, 0.23],
    [240, 0.64],
    [80, 0.64],
  ]);
  assert(reversed >= 60 && reversed > slow, 'Single slider tracks the direction change');
  const canceled = await move(
    0.64,
    [
      [260, 0.27],
      [80, 0.27],
    ],
    true,
  );
  assert(canceled < reversed, 'Single slider delivered the drag before cancellation');
  const redragged = await move(0.27, [
    [260, 0.6],
    [80, 0.6],
  ]);
  assert(
    redragged >= 50 && redragged > canceled,
    'Single slider can drag again after cancellation',
  );
  await showAll(page, top);
  return {
    initial,
    afterHeldScroll,
    tapped,
    slow,
    reversed,
    canceled,
    redragged,
    scrollDelta: rounded(before.y - after.y),
  };
}

async function checkRange(page, top, { height, dpr }) {
  await openCategory(page, 'Selection');
  const start = control(page, 'range-custom-start'),
    end = control(page, 'range-custom-end');
  const center = (box) => physicalCenter(box, dpr);
  const values = () =>
    Promise.all(
      [start, end].map(async (thumb) => Number(await thumb.getAttribute('aria-valuenow'))),
    );
  const startBox = await reveal(start, height);
  const endBox = await end.boundingBox();
  const [sx, sy] = center(startBox),
    [ex, ey] = center(endBox),
    unit = (ex - sx) / 50;
  assert(unit > 0, 'Range thumb positions');
  assert.deepEqual(await values(), [25, 75]);
  const gestures = [];
  const swipe = async (name, thumb, x, y, segments, options) => {
    const track = { left: (sx - 25 * unit) / dpr, right: (ex + 25 * unit) / dpr };
    const thumbBounds = await thumb.boundingBox();
    const from = [x / dpr, y / dpr];
    const [, tx, ty] = segments.at(-1);
    const to = [tx / dpr, ty / dpr];
    await page.evaluate(() => window.galleryTouches());
    const [begin, end] = await drag(x, y, segments, options);
    const terminal = options?.cancel ? 'pointercancel' : 'pointerup';
    try {
      await page.waitForFunction((type) => window.galleryLastTouch() === type, terminal, {
        timeout: 5_000,
      });
    } catch (error) {
      if (error.name !== 'TimeoutError') throw error;
    }
    await wait(475);
    const actual = await values();
    const delivered = await page.evaluate(() => window.galleryTouches());
    const record = {
      name,
      from,
      to,
      track,
      thumbBounds,
      actual,
      gestureMs: rounded((end - begin) / 1e6),
      delivered: [
        delivered[0],
        delivered.findLast(([kind]) => kind === 'pointermove'),
        delivered.at(-1),
      ],
    };
    gestures.push(record);
    assert.equal(delivered.at(-1)?.[0], terminal, JSON.stringify(record));
    return actual;
  };
  // Hold the last coordinate for one input sample before releasing a slow drag.
  const slowX = sx + 7 * unit;
  const [slow, stillEnd] = await swipe(
    'slow',
    start,
    sx,
    sy,
    [
      [610, slowX, sy],
      [48, slowX, sy],
    ],
    { step: 16 },
  );
  assert(slow >= 31 && slow <= 33, 'Slow start thumb: ' + JSON.stringify(gestures.at(-1)));
  assert.equal(stillEnd, 75);
  const [stillStart, fast] = await swipe('reversal', end, ex, ey, [
    [94, ex - 6 * unit, ey],
    [84, ex + 4 * unit, ey],
    [100, ex - 9 * unit, ey],
    [100, ex - 6.5 * unit, ey],
  ]);
  assert.equal(stillStart, slow);
  assert(fast >= 67.5 && fast <= 69.5, 'Fast end thumb: ' + JSON.stringify(gestures.at(-1)));
  const [cx, cy] = center(await start.boundingBox());
  const cancelX = cx + 10 * unit;
  const [afterCancel, cancelOtherThumb] = await swipe(
      'cancel',
      start,
      cx,
      cy,
      [
        [210, cancelX, cy],
        [48, cancelX, cy],
      ],
      { cancel: true },
    ),
    [nx, ny] = center(await start.boundingBox());
  assert(afterCancel > slow, 'The canceled gesture must have moved the thumb');
  assert.equal(cancelOtherThumb, fast);
  const redragX = nx - 8 * unit;
  const [newStart, newEnd] = await swipe('redrag', start, nx, ny, [
    [260, redragX, ny],
    [80, redragX, ny],
  ]);
  assert(newStart < afterCancel, 'Redrag after cancel: ' + JSON.stringify(gestures.at(-1)));
  assert.equal(newEnd, fast);
  const beforeScroll = await start.boundingBox();
  const [vx, vy] = center(beforeScroll);
  await drag(
    vx,
    vy,
    [
      [320, vx + 2 * dpr, vy - 100 * dpr],
      [80, vx + 2 * dpr, vy - 100 * dpr],
    ],
    { step: 12 },
  );
  await wait(430);
  const scrolled = await start.boundingBox();
  assert(
    scrolled && beforeScroll.y - scrolled.y >= 40,
    'A vertical swipe on a thumb scrolls the list',
  );
  assert.deepEqual(
    await values(),
    [newStart, newEnd],
    'A vertical swipe does not adjust either thumb',
  );
  const beforeHold = await reveal(start, height);
  const [holdX, holdY] = center(beforeHold);
  await holdThenScroll(holdX + 8 * unit, holdY, dpr);
  const afterHold = await start.boundingBox();
  assert(
    afterHold && beforeHold.y - afterHold.y >= 40,
    'A held vertical swipe scrolls from the range track',
  );
  const afterHeldScroll = await values();
  assert.deepEqual(
    afterHeldScroll,
    [newStart, newEnd],
    'A held vertical swipe preserves both thumbs',
  );
  await showAll(page, top);
  return {
    slow,
    fast,
    afterCancel,
    newStart,
    newEnd,
    verticalScroll: true,
    afterHeldScroll,
    gestures,
  };
}

async function checkIme(page, top, { height, dpr }) {
  await openCategory(page, 'Text inputs');
  const field = page.getByRole('textbox', { name: 'Write something', exact: true });
  await page.evaluate(() => {
    window.galleryEditorState = (element = document.activeElement) => ({
      label: element?.getAttribute('aria-label'),
      carrier: element?.editContext ? 'EditContext' : element?.tagName,
      value: element?.editContext?.text ?? element?.value,
      start: element?.editContext?.selectionStart ?? element?.selectionStart,
      end: element?.editContext?.selectionEnd ?? element?.selectionEnd,
    });
  });
  const waitForEditor = async (step, predicate, value) => {
    try {
      await page.waitForFunction(predicate, value);
    } catch (error) {
      const state = await page.evaluate(() => ({
        ...window.galleryEditorState(),
        composition: window.galleryComposition,
      }));
      throw new Error(step + ': ' + error.message + '. Editor: ' + JSON.stringify(state), {
        cause: error,
      });
    }
  };
  let fieldBox;
  try {
    fieldBox = await reveal(field, height);
  } catch (error) {
    const editors = await page
      .locator('input, textarea, [data-nelyx-edit-context]')
      .evaluateAll((elements) =>
        elements.map((element) => ({
          label: element.getAttribute('aria-label'),
          box: element.getBoundingClientRect().toJSON(),
        })),
      );
    throw new Error(`${error.message}. Editors: ${JSON.stringify(editors)}`, { cause: error });
  }
  const [fx, fy] = physicalCenter(fieldBox, dpr).map(Math.round);
  await shell('input', 'tap', String(fx), String(fy));
  await waitForEditor(
    'Android editor focus',
    () => document.activeElement?.getAttribute('aria-label') === 'Write something',
  );
  let keyboardShown = false;
  for (let attempt = 0; attempt < 8 && !keyboardShown; attempt++) {
    keyboardShown = /mInputShown=true/.test(await shell('dumpsys', 'input_method'));
    if (!keyboardShown) await wait(225);
  }
  assert(keyboardShown, 'Android soft keyboard is visible');
  await shell('input', 'text', '804');
  await waitForEditor('Android keyboard text', () =>
    window.galleryEditorState().value?.includes('804'),
  );
  // End the keyboard session before DevTools drives a second composing owner.
  await shell('input', 'keyevent', 'KEYCODE_BACK');
  await wait(400);
  assert.doesNotMatch(await shell('dumpsys', 'input_method'), /mInputShown=true/);
  await waitForEditor(
    'Editor focus after hiding Android keyboard',
    () => document.activeElement?.getAttribute('aria-label') === 'Write something',
  );
  const readField = () => field.evaluate((element) => window.galleryEditorState(element));
  const { value, start, end, carrier } = await readField();
  assert.ok(carrier === 'EditContext' || carrier === 'INPUT');
  assert(Number.isInteger(start) && Number.isInteger(end));
  const withComposition = (text) => value.slice(0, start) + text + value.slice(end);
  await field.evaluate((element) => {
    window.galleryComposition = [];
    const target = element.editContext ?? element;
    const update = element.editContext ? 'textupdate' : 'compositionupdate';
    for (const type of ['compositionstart', update, 'compositionend'])
      target.addEventListener(
        type,
        (event) => window.galleryComposition.push([type, event.data ?? event.text ?? null]),
        { capture: true },
      );
  });
  const protocol = await page.context().newCDPSession(page);
  try {
    for (const text of ['ㅎ', '하', '한']) {
      await protocol.send('Input.imeSetComposition', {
        text,
        selectionStart: text.length,
        selectionEnd: text.length,
      });
    }
    await protocol.send('Input.insertText', { text: '한' });
    await waitForEditor('Composition commit', () =>
      window.galleryComposition.some(([type]) => type === 'compositionend'),
    );
  } finally {
    await protocol.detach();
  }
  const composition = await page.evaluate(() => window.galleryComposition);
  assert.equal(composition[0]?.[0], 'compositionstart');
  const committed = composition.findIndex(([type]) => type === 'compositionend');
  const updates = composition.slice(1, committed);
  const updateType = carrier === 'EditContext' ? 'textupdate' : 'compositionupdate';
  assert.ok(updates.every(([type]) => type === updateType));
  assert.deepEqual(
    updates.slice(0, 3).map(([, text]) => text),
    ['ㅎ', '하', '한'],
  );
  if (carrier === 'INPUT') assert.deepEqual(composition[committed], ['compositionend', '한']);
  const expected = withComposition('한');
  assert.equal((await readField()).value, expected);
  const focused = await field.boundingBox();
  assert.ok(focused?.width > 20 && focused.height > 0);
  const caret = async () => {
    const state = await readField();
    return [state.start, state.end];
  };
  const [, centerY] = physicalCenter(focused, dpr).map(Math.round);
  await shell('input', 'tap', String(Math.round((focused.x + 2) * dpr)), String(centerY));
  await waitForEditor('Caret at the start', () => window.galleryEditorState().end === 0);
  const startSelection = await caret();
  await shell(
    'input',
    'tap',
    String(Math.round((focused.x + focused.width - 4) * dpr)),
    String(centerY),
  );
  await waitForEditor(
    'Caret at the end',
    (length) => window.galleryEditorState().end === length,
    expected.length,
  );
  const endSelection = await caret();
  if (/mInputShown=true/.test(await shell('dumpsys', 'input_method'))) {
    await shell('input', 'keyevent', 'KEYCODE_BACK');
    await wait(600);
  }
  assert.doesNotMatch(await shell('dumpsys', 'input_method'), /mInputShown=true/);
  const outlined = page.getByRole('textbox', { name: 'Your message', exact: true });
  const multiline = await reveal(outlined, height);
  assert.ok(
    await outlined.evaluate((element) =>
      element.editContext
        ? element.getAttribute('aria-multiline') === 'true'
        : element.tagName === 'TEXTAREA',
    ),
  );
  const toggle = control(page, 'toggle-message-lines');
  const [lineX, lineY] = physicalCenter(await reveal(toggle, height), dpr).map(Math.round);
  await shell('input', 'tap', String(lineX), String(lineY));
  await waitForEditor('Switch to one line', () =>
    document.querySelector(
      'input[aria-label="Your message"], [data-nelyx-edit-context][aria-label="Your message"][aria-multiline="false"]',
    ),
  );
  const singleLine = await reveal(outlined, height, 1, true);
  assert.ok(singleLine.height < multiline.height);
  await showAll(page, top);
  return {
    keyboardShown,
    carrier,
    entered: '804',
    composition,
    startSelection,
    endSelection,
    editorHeights: [rounded(multiline.height), rounded(singleLine.height)],
    returnedToTop: true,
  };
}

async function checkImage(page, top, { height, dpr }) {
  await openCategory(page, 'Images');
  const image = page.getByLabel('Oranges by Mae Mu, Unsplash', { exact: true });
  const box = await reveal(image, height, 190);
  const clip = Object.fromEntries(
    Object.entries(box).map(([dimension, value]) => [dimension, Math.round(value * dpr)]),
  );
  async function orangePixels(region = clip) {
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
      { source: stdout.toString('base64'), clip: region },
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
    // WebView handles the event's preventDefault after dispatch returns.
    await new Promise((resolve) => setTimeout(resolve, 0));
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
  const restored = await readGallerySurface(page);
  const extract = page.getByRole('button', { name: 'Extract colors', exact: true });
  const [extractX, extractY] = physicalCenter(await reveal(extract, height), dpr).map(Math.round);
  await shell('input', 'tap', String(extractX), String(extractY));
  await page.waitForFunction(() => {
    return [...document.querySelectorAll('[aria-label]')].some((node) =>
      node.getAttribute('aria-label')?.includes('Light palette'),
    );
  });
  await reveal(page.getByLabel(/Dark palette/), height);
  await showAll(page, top);
  await openCategory(page, 'Images');
  const shownAgain = await reveal(image, height, 190);
  await wait(300);
  const revisited = await orangePixels(
    Object.fromEntries(
      Object.entries(shownAgain).map(([dimension, value]) => [dimension, Math.round(value * dpr)]),
    ),
  );
  assert(revisited > 1000, 'The local image paints again after leaving the gallery section');
  await showAll(page, top);
  return {
    imagePixels: [before, after, revisited],
    restoredRenderer: restored.glRenderer,
    extractedPalettes: true,
    returnedToTop: true,
  };
}

try {
  const compositor = await shell('dumpsys', 'SurfaceFlinger');
  const compositorRenderer = /^GLES:\s*(.+)$/m.exec(compositor)?.[1]?.trim();
  if (!controls.length && (compositorRenderer || device.startsWith('emulator-')))
    assertHardwareRenderer(compositorRenderer, 'Android compositor');
  const size = await shell('wm', 'size');
  assert.match(
    size.split(/\r?\n/).at(-1),
    /size: 1080x2340$/,
    'Gallery route requires a 1080×2340 portrait display',
  );
  const systemUi = await shell(
    'dumpsys',
    'activity',
    'service',
    'com.android.systemui/.SystemUIService',
  );
  const leftEdges = [...systemUi.matchAll(/\bmEdgeWidthLeft=(\d+)/g)].map((match) =>
    Number(match[1]),
  );
  // Keep the gesture within the gallery and clear of Android's back gesture region.
  galleryTouchX = Math.max(galleryTouchX, ...leftEdges.map((edge) => edge + 14));
  await prepareTouch();
  if (controls.length) {
    let failures = 0;
    for (let run = 1; run <= runs; run++) {
      for (const check of controls) {
        signal.throwIfAborted();
        let demo;
        try {
          demo = await openDemo(check);
          const { page, top, current, errors } = demo;
          const result = await controlChecks[check](page, top, current);
          assert.deepEqual(errors, []);
          console.log(
            JSON.stringify({
              run,
              check,
              build: current.build,
              glRenderer: current.glRenderer,
              compositorRenderer,
              failIfMajorPerformanceCaveat: current.failIfMajorPerformanceCaveat,
              passed: true,
              ...result,
              ...(cpu && check === 'image'
                ? {
                    raster: current.raster,
                    probeReloaded: current.probeReloaded,
                    image: imageWork(await drain(page)),
                  }
                : {}),
            }),
          );
        } catch (error) {
          failures++;
          console.error(
            JSON.stringify({
              run,
              check,
              build: demo?.current.build,
              passed: false,
              error: String(error),
            }),
          );
        } finally {
          await demo?.close();
        }
      }
    }
    assert.equal(failures, 0, 'Failed Android control checks');
  }
  for (let run = 1; controls.length === 0 && run <= runs; run++) {
    const { page, top, current, errors, close } = await openDemo();
    let timeline;
    try {
      const displayLayers = await shell('dumpsys', 'SurfaceFlinger', '--list');
      const activity = pkg + '/' + pkg + '.MainActivity';
      const layers = displayLayers.split(/\r?\n/).flatMap((line) => {
        const start = line.indexOf(activity);
        const suffix =
          start < 0
            ? undefined
            : line.slice(start + activity.length).match(/^(?:\$_\d+)?#\d+/)?.[0];
        if (!suffix) return [];
        const prefix = line.slice(0, start).endsWith('VRI-') ? 'VRI-' : '';
        return [prefix + activity + suffix];
      });
      const layer = layers.find((name) => name.startsWith('VRI-')) ?? layers[0];
      let clocks;
      if (cpu) {
        const [before, epochMs, after] = (await galleryTouch('--clocks')).split(',').map(Number);
        assert.ok([before, epochMs, after].every(Number.isSafeInteger));
        clocks = {
          monotonicMsAtTimeOrigin: current.timeOrigin - epochMs + (before + after) / 2e6,
          nativeBracketMs: rounded((after - before) / 1e6),
        };
      }
      console.log(
        JSON.stringify({
          run,
          ...current,
          compositorRenderer,
          layer,
          layers,
          swipeX: galleryTouchX,
          clocks,
        }),
      );
      if (traceProcessor) {
        assert(layers.length > 0, 'FrameTimeline requires a gallery window or view-root layer');
        timeline = await traceAndroidFrames(layers, run);
      }
      let sawImageCard = false;
      const readCards = async () => {
        const cards = await visibleCards(page);
        sawImageCard ||= cards.includes(imageCardTitle);
        return cards;
      };
      const measureRoute = async (route, gesture, tail) => {
        const result = await measure(page, layer, route, gesture, tail, timeline, clocks);
        sawImageCard ||= result.from.includes(imageCardTitle) || result.to.includes(imageCardTitle);
        return result.to;
      };
      const measureImageEntry = async (fling) => {
        const y = await alignImageEntry(page, current, readCards);
        const revisited = sawImageCard;
        console.log(JSON.stringify({ route: 'image-entry-marker', y, revisited }));
        const route =
          (revisited ? 'image-reentry' : 'image-entry') + (fling ? '-fling' : '-scroll');
        // Cross the remaining message actions even if the fling settles early.
        const destination = await measureRoute(
          route,
          fling
            ? () => touch(1730, [[205, 975]])
            : () =>
                touch(
                  1730,
                  [
                    [560, 880],
                    [160, 880],
                  ],
                  12,
                ),
          950,
        );
        // The card can be visible before its image accessibility node is published.
        assert(
          destination.includes(imageCardTitle),
          `Image entry did not reach the image card: ${destination.join(', ')}`,
        );
        return revisited;
      };
      if (cssOnly) {
        await measureCss(page, layer, timeline);
        assert.deepEqual(errors, []);
        continue;
      }
      if (editorEntryOnly) {
        await advance(5);
        const marker = await alignEditorEntry(page, current.dpr);
        console.log(JSON.stringify({ route: 'editor-entry-marker', ...marker }));
        // Use a short drag so the upcoming editor enters during coast.
        const end = Math.round(1570 - 80 * current.dpr);
        const destination = await measureRoute(
          'editor-entry-fling',
          () => touch(1570, [[90, end]]),
          950,
        );
        assert(destination.includes(firstEditorTitle), 'Fling did not reach the first editor');
        if (!gl) await measureCss(page, layer, timeline);
        assert.deepEqual(errors, []);
        continue;
      }
      if (imageEntryOnly) {
        const editors = ['Text fields', 'Write something', 'Your message'];
        for (let swipe = 0; swipe < 14; swipe++) {
          const cards = await readCards();
          if (sawImageCard || editors.some((label) => cards.includes(label))) break;
          await advance(1);
        }
        assert.equal(
          await measureImageEntry(inertia),
          false,
          'The measured image must be a first visit',
        );
        await reveal(
          page.getByLabel('Oranges by Mae Mu, Unsplash', { exact: true }),
          current.height,
          190,
        );
        if (!gl) await measureCss(page, layer, timeline);
        assert.deepEqual(errors, []);
        continue;
      }
      await measureRoute('top-cold-fling', () => touch(1940, [[205, 505]]), inertia ? 1200 : 620);
      if (topOnly) {
        if (!gl) await measureCss(page, layer, timeline);
        assert.deepEqual(errors, []);
        continue;
      }
      await resetTop(page, top);
      await advance(4);
      await measureRoute('middle-reversal', reverse, 75);
      await resetTop(page, top);
      await advance(6);
      await measureRoute('lower-first-fling', lowerFling, inertia ? 950 : 450);
      await measureRoute('lower-reversal', reverse, 75);
      if (inertia) {
        await measureImageEntry(true);
        await advance(2);
      } else {
        await advance(
          4,
          (swipe, start, end, lastMovement) =>
            timeline?.record(`image-approach-${swipe}`, start, end, { movingEnd: lastMovement }),
          readCards,
        );
      }
      await page.getByRole('button', { name: 'Extract colors' }).waitFor({ state: 'attached' });
      if (cpu) {
        const read = await drain(page);
        if (read.trace)
          console.log(
            JSON.stringify({
              route: 'image-approach-sections',
              sectionWork: sectionWork(read.trace.frames.samples),
              decoration: decorationWork(read.trace.frames.samples),
              overwritten: read.trace.frames.overwritten,
              image: imageWork(read),
            }),
          );
      }
      await resetTop(page, top);
      await advance(6);
      await measureRoute('lower-return-fling', lowerFling, inertia ? 950 : 450);
      await measureRoute('lower-return-reversal', reverse, 75);
      if (!gl) await measureCss(page, layer, timeline);
      assert.deepEqual(errors, []);
    } finally {
      try {
        await timeline?.close();
      } finally {
        await close();
      }
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
