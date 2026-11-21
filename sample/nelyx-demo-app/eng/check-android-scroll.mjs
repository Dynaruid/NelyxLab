// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
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
  const output = await galleryTouch(
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
  if (!gl) return;
  window.galleryGl = [];
  for (const name of [
    'getShaderParameter',
    'getProgramParameter',
    'compileShader',
    'linkProgram',
    'texImage2D',
    'texSubImage2D',
    'getUniformLocation',
    'bufferData',
    'bufferSubData',
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
    for (let attempt = 0; attempt < 24; attempt++) {
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
    if (probe.range) await reloadWithProbe();
    else if (gl) await page.evaluate(installProbe, probe);
    await filled(page).waitFor({ state: 'attached', timeout: 25_000 });
    if (cpu && !(await page.evaluate(() => typeof window.galleryFrames === 'function'))) {
      assert(!probeReloaded, 'CPU probe did not attach after reload');
      await reloadWithProbe();
      await filled(page).waitFor({ state: 'attached', timeout: 25_000 });
      assert(await page.evaluate(() => typeof window.galleryFrames === 'function'));
    }
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
    return { page, top, current: { ...current, ...(gl ? { probeReloaded } : {}) }, errors, close };
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

async function traceAndroidFrames(layer, run) {
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
    record(route, start, end) {
      windows.push({ route, start, end });
    },
    async close() {
      try {
        await stop();
        if (!windows.length || signal.aborted) return;
        await adb('pull', remoteTrace, localTrace);
        const quote = (value) => "'" + value.replaceAll("'", "''") + "'";
        // A surface slice ends at app completion. Follow its token to the
        // display slice and take the SurfaceFlinger presentation time.
        const query = `
          WITH app_frames AS (
            SELECT app.display_frame_token, EXTRACT_ARG(app.arg_set_id, 'Is Buffer?') AS buffer
            FROM actual_frame_timeline_slice AS app JOIN process USING (upid)
            WHERE process.name = ${quote(pkg)} AND surface_frame_token > 0
              AND layer_name IN (${quote(layer)}, ${quote('TX - ' + layer)})
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
        const stats = (start, end) => {
          const displayTimes = new Set();
          const bufferTimes = new Set();
          for (const [kind, value] of timestamps) {
            const time = Number(value) - offset;
            if (time >= start && time <= end) {
              displayTimes.add(time);
              if (kind === '"buffer"') bufferTimes.add(time);
            }
          }
          return {
            display: presentIntervals(displayTimes),
            bufferDisplay: presentIntervals(bufferTimes),
            firstBufferPresentDelayMs: bufferTimes.size
              ? rounded((Math.min(...bufferTimes) - start) / 1e6)
              : null,
          };
        };
        console.log(
          JSON.stringify({
            frameTimeline: windows.map(({ route, start, end }) => {
              const covered = start + minOffset >= traceStart && end + maxOffset <= traceEnd;
              return {
                route,
                covered,
                ...(covered
                  ? stats(start, end)
                  : { display: null, bufferDisplay: null, firstBufferPresentDelayMs: null }),
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
  }));
}

function longestFlushes(samples, calls) {
  // App.tsx supplies the same WebView Performance object used by installProbe.
  return samples
    .filter((entry) => entry.stage === 'native-submit')
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 4)
    .map(({ frame, begin, end, duration }) => {
      const spent = {};
      for (const [name, at, elapsed, selector] of calls) {
        const overlap = Math.min(end, at + elapsed) - Math.max(begin, at);
        if (overlap <= 0) continue;
        const key = selector === 0x8b82 && name === 'getProgramParameter' ? 'LINK_STATUS' : name;
        spent[key] = (spent[key] ?? 0) + overlap;
      }
      return {
        frame,
        ms: rounded(duration),
        calls: Object.fromEntries(Object.entries(spent).map(([name, ms]) => [name, rounded(ms)])),
      };
    });
}

async function measure(page, layer, route, gesture, tail, timeline) {
  const before = gl ? await drain(page) : undefined;
  await shell('dumpsys', 'gfxinfo', pkg, 'reset');
  if (layer) await shell('dumpsys', 'SurfaceFlinger', '--latency-clear', layer);
  const [start, end] = await gesture();
  await wait(tail + 60);
  const stats = await shell('dumpsys', 'gfxinfo', pkg, 'framestats');
  const sf = layer ? await shell('dumpsys', 'SurfaceFlinger', '--latency', layer) : '';
  const bounds = end + tail * 1e6;
  timeline?.record(route, start, bounds);
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
        'semantics',
        'semantics-flush',
        'semantics-snapshot',
        'semantics-freeze',
        'semantics-publish',
        'input-queue',
        'native-replay',
        'native-submit',
        'gpu-fence-enqueue',
      ];
      const samples = read.trace.frames.samples;
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
        flushes: longestFlushes(samples, read.gl),
        sectionWork: sectionWork(samples),
      });
    }
  }
  console.log(JSON.stringify(result));
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
async function advance(count, onSwipe) {
  for (let i = 0; i < count; i++) {
    const [start, end] = await touch(
      1810,
      [
        [1180, 545],
        [70, 545],
      ],
      12,
    );
    onSwipe?.(i + 1, start, end);
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

async function reveal(locator, height, minHeight = 1) {
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
  assert.fail('Could not reveal ' + locator + ' at height ' + minHeight);
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
  await showAll(page, top);
  return { initial, afterHeldScroll, tapped, scrollDelta: rounded(before.y - after.y) };
}

async function checkRange(page, _top, { height, dpr }) {
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
  let fieldBox;
  try {
    fieldBox = await reveal(field, height);
  } catch (error) {
    const editors = await page.locator('input, textarea').evaluateAll((elements) =>
      elements.map((element) => ({
        label: element.getAttribute('aria-label'),
        box: element.getBoundingClientRect().toJSON(),
      })),
    );
    throw new Error(`${error.message}. Editors: ${JSON.stringify(editors)}`, { cause: error });
  }
  const [fx, fy] = physicalCenter(fieldBox, dpr).map(Math.round);
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
  await showAll(page, top);
  return { keyboardShown, entered: '804', returnedToTop: true };
}

async function checkImage(page, top, { height, dpr }) {
  await openCategory(page, 'Images');
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
  await showAll(page, top);
  return { imagePixels: [before, after], returnedToTop: true };
}

try {
  const size = await shell('wm', 'size');
  assert.match(
    size.split(/\r?\n/).at(-1),
    /size: 1080x2340$/,
    'Gesture geometry for Pixel 5 portrait',
  );
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
            JSON.stringify({ run, check, build: current.build, passed: true, ...result }),
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
      const layers = await shell('dumpsys', 'SurfaceFlinger', '--list');
      const layer = layers
        .split(/\r?\n/)
        .find((name) => name.startsWith(pkg + '/' + pkg + '.MainActivity#'));
      console.log(JSON.stringify({ run, ...current, layer }));
      if (traceProcessor) {
        assert(layer, 'FrameTimeline requires the gallery activity layer');
        timeline = await traceAndroidFrames(layer, run);
      }
      const measureRoute = (route, gesture, tail) =>
        measure(page, layer, route, gesture, tail, timeline);
      if (cssOnly) {
        await measureCss(page, layer, timeline);
        assert.deepEqual(errors, []);
        continue;
      }
      await measureRoute('top-cold-fling', () => touch(1940, [[205, 505]]), 620);
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
      await measureRoute('lower-first-fling', lowerFling, 450);
      await measureRoute('lower-reversal', reverse, 75);
      await advance(4, (swipe, start, end) => {
        timeline?.record(`image-approach-${swipe}`, start, end);
      });
      await page.getByRole('button', { name: 'Extract colors' }).waitFor({ state: 'attached' });
      if (cpu) {
        const { trace } = await drain(page);
        if (trace)
          console.log(
            JSON.stringify({
              route: 'image-approach-sections',
              sectionWork: sectionWork(trace.frames.samples),
              overwritten: trace.frames.overwritten,
            }),
          );
      }
      await resetTop(page, top);
      await advance(6);
      await measureRoute('lower-return-fling', lowerFling, 450);
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
