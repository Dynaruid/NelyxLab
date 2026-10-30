// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { SourceMap } from 'node:module';
import { buildNativeHost, root } from './build-native-hermes.mjs';
import {
  buildNativeApplication,
  verifyNativePackage,
} from '../sdk/tooling/cli/src/windows-native-runner.mjs';
import { startWindowsProcess } from '../sdk/tooling/cli/src/windows-process.mjs';
import { analyseNativeInputWindow } from './tests/native-frame-metrics.js';
import { verifyNativeLoadedIdentity } from './tests/native-product-sources.mjs';

const timeout = 1_200_000;
export function nativeProbeReports(output) {
  const reports = [];
  let current = null,
    expectedId = 1;
  for (const line of output.split(/\r?\n/)) {
    if (!line.startsWith('NELYX_NATIVE_PROBE_CHUNK ')) continue;
    const chunk = JSON.parse(line.slice('NELYX_NATIVE_PROBE_CHUNK '.length));
    if (
      chunk.id !== expectedId ||
      !Number.isSafeInteger(chunk.total) ||
      chunk.total < 1 ||
      chunk.total > 2048 ||
      !Number.isSafeInteger(chunk.index) ||
      chunk.index < 0 ||
      chunk.index >= chunk.total ||
      typeof chunk.text !== 'string' ||
      !chunk.text.length ||
      chunk.text.length > 1024
    )
      throw Error('Invalid native probe chunk');
    if (!current) current = { total: chunk.total, index: 0, text: '' };
    if (current.total !== chunk.total || current.index !== chunk.index)
      throw Error('Native probe chunks were lost, duplicated or reordered');
    current.text += chunk.text;
    current.index++;
    if (current.index === current.total) {
      reports.push(JSON.parse(current.text));
      current = null;
      expectedId++;
    }
  }
  if (current) throw Error('Native probe report was truncated');
  return reports;
}
export function symbolicateNativeProfile(profile, map) {
  const locate = (frame) => {
    const caller = frame.caller ? { caller: locate(frame.caller) } : {},
      line = Number(frame.funcLine ?? frame.line),
      column = Number(frame.funcColumn ?? frame.column);
    if (!Number.isSafeInteger(line) || line < 1 || !Number.isSafeInteger(column) || column < 1)
      return { ...frame, ...caller };
    const entry = map.findEntry(line - 1, column - 1);
    return {
      ...frame,
      ...(entry.originalSource !== undefined
        ? {
            source: entry.originalSource,
            sourceLine: entry.originalLine + 1,
            sourceColumn: entry.originalColumn + 1,
            sourceName: entry.name ?? null,
          }
        : {}),
      ...caller,
    };
  };
  return {
    ...profile,
    ...Object.fromEntries(
      ['self', 'inclusive', 'functionSelf', 'functionInclusive'].map((key) => [
        key,
        profile[key].map(locate),
      ]),
    ),
    symbolication: 'Hermes 1-based bundle locations through the exact Metro source map',
  };
}
function printableReport(report, details) {
  if (details || !report.profile) return report;
  const { self, inclusive, functionSelf, functionInclusive, ...profile } = report.profile;
  const compact = (frames) => frames.slice(0, 8).map(({ caller, ...frame }) => frame);
  return {
    ...report,
    profile: {
      ...profile,
      functionSelf: compact(functionSelf),
      functionInclusive: compact(functionInclusive),
      output: 'top 8 functions; --details prints all mapped stacks',
    },
  };
}
export function verifyNativeCatalogReports(reports, { viewport, material, cupertino }) {
  const check = (value, message) => {
    if (!value) throw Error('Native OS catalog: ' + message);
  };
  const ids = (values, label) => {
    check(
      Array.isArray(values) &&
        values.length > 0 &&
        values.every((value) => typeof value === 'string' && value.length > 0) &&
        new Set(values).size === values.length,
      'invalid ' + label,
    );
    return values;
  };
  const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
  ids(material, 'Material source IDs');
  ids(cupertino, 'Cupertino source IDs');
  check(['default', 'maximized'].includes(viewport), 'unknown viewport');
  const columns =
      viewport === 'maximized'
        ? ['material-0', 'material-1', 'cupertino-0']
        : ['material-0', 'cupertino-0'],
    expectedNames = [
      'list-retained',
      'list-cold',
      'list-revisit',
      'list-fast',
      ...columns.flatMap((column) =>
        ['cold', 'revisit', 'fast'].map((suffix) => column + '-' + suffix),
      ),
    ],
    phases = reports.filter((report) => report.type === 'phase');
  check(
    JSON.stringify(phases.map((phase) => phase.name)) === JSON.stringify(expectedNames),
    'missing, duplicated or reordered phases',
  );
  for (const phase of phases) {
    const { workload, receipts, frameTurns } = phase,
      sender = workload?.sender;
    check(phase.inputWindow?.pacing === 'os', 'native input boundary is missing');
    analyseNativeInputWindow(phase.inputWindow.before, phase.inputWindow.after, { pacing: 'os' });
    check(
      phase.pacing === 'os' &&
        phase.scope === 'cpu' &&
        phase.spans === 'disabled' &&
        phase.buildMode === 'release' &&
        phase.qualification === 'diagnostic-only' &&
        phase.performanceAccepted === false,
      'wrong measurement scope',
    );
    check(
      receipts?.receiptIntegrity === true &&
        receipts.displayed === 'unobserved' &&
        receipts.input?.rejected === 0 &&
        receipts.input.accepted === receipts.input.received &&
        receipts.surface?.n > 0 &&
        receipts.inputToSurface?.eligible > 0 &&
        receipts.inputToSurface.pending === 0 &&
        receipts.inputToSurface.mapped === receipts.inputToSurface.eligible &&
        frameTurns?.builtTurns > 0,
      'incomplete matching input/surface receipt',
    );
    check(
      sender?.done === true &&
        sender.error === '' &&
        sender.foreign === 0 &&
        Number.isSafeInteger(workload.count) &&
        workload.count > 0 &&
        workload.count <= 8192 &&
        sender.emitted === workload.count &&
        sender.received > 0 &&
        sender.received <= sender.emitted &&
        sender.sentRaw === sender.receivedRaw &&
        sender.sentAbsoluteRaw === sender.receivedAbsoluteRaw &&
        Number.isSafeInteger(sender.expectedCookie) &&
        sender.expectedCookie > 0 &&
        sender.expectedCookie === sender.observedCookie &&
        sender.pacingPolicy === 'high-resolution-relative-start-completion-v1',
      'incomplete native wheel delivery',
    );
    check(
      Math.abs(receipts.input.receivedWheelY + sender.receivedRaw * 0.4) < 0.001 &&
        Math.abs(receipts.input.receivedAbsoluteWheelY - sender.receivedAbsoluteRaw * 0.4) < 0.001,
      'native/Core wheel distance differs',
    );
    check(
      [sender.sendP50, sender.sendP95, sender.sendMax].every(
        (value) => Number.isFinite(value) && value > 0,
      ) &&
        sender.sendMax >= sender.sendP95 &&
        sender.sendP95 >= sender.sendP50,
      'actual wheel intervals missing',
    );
  }
  const covered = { material: [], cupertino: [] };
  for (const column of columns) {
    const kind = column.startsWith('material') ? 'material' : 'cupertino',
      source = kind === 'material' ? material : cupertino;
    let expected;
    for (const suffix of ['cold', 'revisit', 'fast']) {
      const phase = phases.find((phase) => phase.name === column + '-' + suffix),
        workload = phase.workload,
        coverage = workload.coverage;
      check(
        workload.injection === 'until-edge' &&
          workload.maximumInjected === 8192 &&
          coverage?.reachedEdge === true &&
          coverage.stopped === true &&
          coverage.direction === (suffix === 'revisit' ? 'reverse' : 'forward'),
        'column did not reach its requested edge',
      );
      const current = ids(coverage.expectedIds, 'column IDs');
      check(
        current.every((id) => source.includes(id)) && (!expected || same(current, expected)),
        'column membership differs',
      );
      expected = current;
      check(
        coverage.scope ===
          'Core-visible sections joined to matching surface-copy content frames; display unobserved' &&
          Number.isSafeInteger(coverage.builtFrames) &&
          coverage.builtFrames > 0 &&
          coverage.builtFrames <= 16384 &&
          Number.isSafeInteger(coverage.matchingFrames) &&
          coverage.matchingFrames > 0 &&
          coverage.matchingFrames <= coverage.builtFrames,
        'missing visibility/content-frame join',
      );
      check(
        Array.isArray(coverage.seenIds) &&
          new Set(coverage.seenIds).size === coverage.seenIds.length &&
          coverage.seenIds.every((id) => current.includes(id)) &&
          Array.isArray(coverage.builtSeenIds) &&
          new Set(coverage.builtSeenIds).size === coverage.builtSeenIds.length &&
          coverage.builtSeenIds.every((id) => current.includes(id)) &&
          coverage.seenIds.every((id) => coverage.builtSeenIds.includes(id)),
        'invalid exposed section IDs',
      );
      const skipped = current.filter((id) => !coverage.seenIds.includes(id));
      check(
        Array.isArray(coverage.skippedIds) &&
          same(coverage.skippedIds, skipped) &&
          (suffix === 'fast' || skipped.length === 0),
        'sections never reached a matching surface',
      );
    }
    covered[kind].push(...expected);
  }
  for (const kind of ['material', 'cupertino'])
    check(
      new Set(covered[kind]).size === covered[kind].length &&
        same(covered[kind], kind === 'material' ? material : cupertino),
      'full ' + kind + ' catalog membership differs',
    );
  return {
    scope: 'complete OS catalog with matching surface coverage; diagnostic only',
    material: material.length,
    cupertino: cupertino.length,
    columns: columns.length,
  };
}
export function nativeScrollOptions(args) {
  const result = {
    app: path.join(root, 'sample/nelyx-testbed-app-2'),
    mode: 'bytecode',
    viewport: 'default',
    scope: 'cpu',
    pacing: 'programmatic',
    catalog: false,
    scrollScenes: false,
    mixedScrollScenes: false,
    mixedScrollPixels: false,
    details: false,
    resourceCycles: 0,
    repeat: 1,
  };
  const names = new Map([
    ['--app', 'app'],
    ['--hermes-mode', 'mode'],
    ['--viewport', 'viewport'],
    ['--scope', 'scope'],
    ['--input', 'pacing'],
    ['--resource-cycles', 'resourceCycles'],
    ['--repeat', 'repeat'],
  ]);
  for (let index = 0; index < args.length; index++) {
    const name = args[index];
    if (name === '--catalog') {
      result.catalog = true;
      continue;
    }
    if (name === '--scroll-scenes') {
      result.scrollScenes = true;
      continue;
    }
    if (name === '--mixed-scroll-scenes') {
      result.mixedScrollScenes = true;
      continue;
    }
    if (name === '--mixed-scroll-pixels') {
      result.mixedScrollPixels = true;
      continue;
    }
    if (name === '--details') {
      result.details = true;
      continue;
    }
    const key = names.get(name);
    if (!key || !args[index + 1] || args[index + 1].startsWith('--'))
      throw Error('Unknown or incomplete native scroll option: ' + name);
    result[key] = args[++index];
  }
  if (
    !['bytecode', 'static-aot'].includes(result.mode) ||
    !['default', 'maximized', 'both'].includes(result.viewport) ||
    !['cpu', 'gc', 'diagnostic', 'stages', 'sampling'].includes(result.scope) ||
    (result.scope === 'sampling' && result.mode !== 'bytecode')
  )
    throw Error(
      'Choose a native Hermes mode, default|maximized|both viewport and cpu|gc|diagnostic|stages|sampling scope (sampling requires bytecode)',
    );
  if (
    !['programmatic', 'os'].includes(result.pacing) ||
    (result.pacing === 'os' &&
      (!['cpu', 'sampling'].includes(result.scope) || (result.catalog && result.scope !== 'cpu')))
  )
    throw Error(
      'OS wheel supports cpu scope (including the catalog) or separate bytecode ListView sampling',
    );
  result.resourceCycles = Number(result.resourceCycles);
  if (
    (result.scrollScenes || result.mixedScrollScenes || result.mixedScrollPixels) &&
    ([result.scrollScenes, result.mixedScrollScenes, result.mixedScrollPixels].filter(Boolean)
      .length > 1 ||
      result.catalog ||
      result.pacing !== 'programmatic' ||
      result.resourceCycles !== 0 ||
      result.viewport !== 'maximized' ||
      !['cpu', 'gc', 'diagnostic', 'stages'].includes(result.scope))
  )
    throw Error(
      'Scroll scenes require maximized programmatic cpu|gc|diagnostic|stages without catalog or resource cycles',
    );
  validateResourceCycleOptions(result);
  result.repeat = Number(result.repeat);
  nativeScrollRuns(result);
  result.app = path.resolve(result.app);
  return result;
}
/** Each trial starts a fresh process from the same package. The one 20-minute
 * deadline and one finally-owned build directory cover the complete batch. */
export function nativeScrollRuns({ viewport, repeat = 1, scope, resourceCycles = 0 }) {
  if (
    !['default', 'maximized', 'both'].includes(viewport) ||
    !Number.isSafeInteger(repeat) ||
    repeat < 1 ||
    repeat > 3 ||
    (repeat > 1 && (scope !== 'cpu' || resourceCycles !== 0))
  )
    throw Error(
      'Repeat requires 1..3 trials; multiple trials require cpu scope without resource cycles',
    );
  const runs = [];
  for (let trial = 1; trial <= repeat; trial++)
    for (const view of viewport === 'both' ? ['default', 'maximized'] : [viewport])
      runs.push({ trial, viewport: view });
  return runs;
}
function validateResourceCycleOptions(options) {
  if (
    !Number.isSafeInteger(options.resourceCycles) ||
    (options.resourceCycles !== 0 &&
      (options.resourceCycles < 3 ||
        options.resourceCycles > 30 ||
        options.scope !== 'cpu' ||
        options.pacing !== 'programmatic' ||
        options.catalog))
  )
    throw Error('Resource cycles require 3..30 cpu/programmatic ListView repetitions');
}
/** Resource accounting is a subset of H4; private process/GPU memory is separate. */
export function verifyNativeResourceCycles(reports, cycles) {
  const check = (value, message) => {
      if (!value) throw Error('Native resource cycles: ' + message);
    },
    counter = (value) => Number.isSafeInteger(value) && value >= 0;
  check(Number.isSafeInteger(cycles) && cycles >= 3 && cycles <= 30, 'invalid repetition count');
  const points = reports.filter((report) => report.type === 'resource-cycle'),
    baseline = points[0],
    keys = [
      'resident',
      'producers',
      'residentUnits',
      'producerUnits',
      'residentBytes',
      'producerBytes',
    ];
  check(points.length === cycles + 1, 'missing or duplicate observation');
  for (const [cycle, point] of points.entries()) {
    check(
      point.cycle === cycle &&
        point.scope === 'core-resource-and-native-frame-owners' &&
        point.qualification === 'diagnostic-only' &&
        point.returnedToGallery === true &&
        point.performanceAccepted === false &&
        point.physicalInputAccepted === 'notVerified' &&
        point.displayed === 'unobserved',
      'wrong observation scope/order',
    );
    check(
      keys.every((key) => counter(point.accounted?.[key])),
      'missing resource accounting',
    );
    check(
      ['elements', 'renderObjects', 'hostNodes'].every(
        (key) =>
          counter(point.tree?.[key]) &&
          point.tree[key] > 0 &&
          point.tree[key] === baseline.tree[key],
      ),
      'route tree did not return to baseline',
    );
    check(
      point.accounted.producers === baseline.accounted.producers &&
        point.accounted.producerUnits === baseline.accounted.producerUnits &&
        point.accounted.producerBytes === baseline.accounted.producerBytes,
      'producer owners did not return to baseline',
    );
    check(
      ['cached', 'live', 'bytes'].every((key) => counter(point.pictures?.[key])) &&
        point.pictures.live >= point.pictures.cached,
      'missing or inconsistent picture accounting',
    );
    check(
      Array.isArray(point.native) &&
        point.native.length === 5 &&
        point.native.every(counter) &&
        point.native[0] > 0 &&
        point.native[1] === 0 &&
        point.native[3] === 0 &&
        point.native[4] === 0 &&
        point.native.every((value, index) => value === baseline.native[index]),
      'native frame owners did not drain to baseline',
    );
    if (cycle) {
      check(point.inputWindow?.pacing === 'programmatic', 'missing input boundary');
      analyseNativeInputWindow(point.inputWindow.before, point.inputWindow.after, {
        pacing: 'programmatic',
      });
      check(
        point.receipts?.receiptIntegrity === true &&
          point.receipts.input?.received === 0 &&
          point.receipts.surface?.n > 0,
        'missing native frame or unexpected pointer input',
      );
    }
  }
  const last = points.at(-1);
  return {
    scope: 'Core accounting, pictures and native frame owners only',
    cycles,
    producerAndFrameOwners: 'PASS-scoped',
    cacheRetention: 'observed',
    accounted: last.accounted,
    pictures: last.pictures,
    native: last.native,
    residency: points.map((point) => ({
      cycle: point.cycle,
      accounted: { ...point.accounted },
      pictures: { ...point.pictures },
    })),
    memoryAccepted: false,
    privateProcessMemory: 'notVerified',
    gpuMemory: 'notVerified',
    performanceAccepted: false,
  };
}
export async function runNativeScroll(options) {
  options = { pacing: 'programmatic', details: false, resourceCycles: 0, repeat: 1, ...options };
  validateResourceCycleOptions(options);
  const runs = nativeScrollRuns(options);
  const app = fs.realpathSync(options.app),
    parent = path.join(app, '.nelyx/native-windows');
  fs.mkdirSync(parent, { recursive: true });
  if (fs.realpathSync(parent) !== parent)
    throw Error('Native diagnostic parent must be a real directory');
  const temporary = fs.mkdtempSync(path.join(parent, '.scroll-fixture-')),
    controller = new AbortController(),
    deadline = setTimeout(
      () => controller.abort(Error('Native scroll diagnostic exceeded 20 minutes')),
      timeout,
    );
  let running, abortStop;
  const interrupted = () => controller.abort(Error('Native scroll diagnostic interrupted'));
  process.on('SIGINT', interrupted);
  process.on('SIGTERM', interrupted);
  try {
    const config = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8')).nelyx;
    const catalogs =
      options.catalog && options.pacing === 'os'
        ? Object.fromEntries(
            [
              ['material', 'catalog.ts', 'demos'],
              ['cupertino', 'cupertino-catalog.ts', 'cupertinoDemos'],
            ].map(([name, file, exportName]) => {
              const source = fs.readFileSync(path.join(app, 'src', file), 'utf8'),
                body = source.split('export const ' + exportName + ':')[1]?.split('];')[0];
              if (!body) throw Error('The actual product catalog declaration is missing');
              return [name, [...body.matchAll(/\{id: '([^']+)'/g)].map((match) => match[1])];
            }),
          )
        : null;
    const modules = [
      ['main', path.resolve(app, config.appEntry)],
      ['ComponentsGallery', path.join(app, 'src/gallery.ts')],
      ['ListViewPage', path.join(app, 'src/list-view.ts')],
      ['MixedScrollPage', path.join(app, 'src/mixed-scroll.ts')],
      ['GallerySection', path.join(app, 'src/gallery-section.ts')],
      ['demos', path.join(app, 'src/catalog.ts')],
      ['cupertinoDemos', path.join(app, 'src/cupertino-catalog.ts')],
    ];
    for (const [, file] of modules)
      if (!fs.statSync(file).isFile())
        throw Error('The native scroll diagnostic needs the actual Testbed source: ' + file);
    for (const name of [
      'native-scroll-fixture.ts',
      'native-frame-metrics.js',
      'native-frame-metrics.d.ts',
    ])
      fs.copyFileSync(path.join(import.meta.dirname, 'tests', name), path.join(temporary, name));
    const entry = path.join(temporary, 'entry.ts');
    fs.writeFileSync(
      entry,
      modules
        .map(
          ([name, file]) =>
            'import {' +
            name +
            (name === 'main' ? ' as originalMain' : '') +
            '} from ' +
            JSON.stringify(file.replaceAll('\\', '/')) +
            ';',
        )
        .join('\n') +
        '\nimport {installNativeScrollProbe} from "./native-scroll-fixture.ts";\nexport function main(){installNativeScrollProbe({ComponentsGallery,ListViewPage,MixedScrollPage,GallerySection,demos,cupertinoDemos},' +
        JSON.stringify({
          scope: options.scope,
          catalog: options.catalog,
          scrollScenes: options.scrollScenes === true,
          mixedScrollScenes: options.mixedScrollScenes === true,
          mixedScrollPixels: options.mixedScrollPixels === true,
          pacing: options.pacing,
          resourceCycles: options.resourceCycles,
        }) +
        ');return originalMain();}\n',
    );
    const hostBuild = await buildNativeHost({ app, signal: controller.signal });
    const built = await buildNativeApplication({
      app,
      mode: options.mode,
      hostBuild,
      diagnosticEntry: entry,
      output: path.join(temporary, 'package'),
      cacheDirectory: path.join(temporary, 'aot-cache'),
      signal: controller.signal,
    });
    const checked = verifyNativePackage(built.directory);
    if (checked.manifest.qualification !== 'diagnostic-only')
      throw Error('Native diagnostic acquired a product qualification');
    const results = [];
    for (const { trial, viewport } of runs) {
      let output = '',
        errors = '',
        overflow = false,
        foregroundCarry = '';
      console.log(
        'NELYX_NATIVE_PROBE_READY ' +
          JSON.stringify({
            trial,
            mode: options.mode,
            viewport,
            scope: options.scope,
            catalog: options.catalog,
            input: options.pacing,
            sourceSha256: hostBuild.manifest.sourceSha256,
            bundleSha256: checked.manifest.files.find(
              (file) => file.path === checked.manifest.bundle,
            )?.sha256,
            qualification: 'diagnostic-only',
            desktopInput: 'must remain idle',
          }),
      );
      const env = {
        ...process.env,
        NELYX_NATIVE_FRAME_TRACE: '1',
        NELYX_NATIVE_GC_STATS: options.scope === 'gc' ? '1' : '0',
        NELYX_NATIVE_CPU_PROFILE: options.scope === 'sampling' ? '1' : '0',
        NELYX_NATIVE_PROBE_VIEWPORT: viewport,
      };
      delete env.NELYX_NATIVE_DIAGNOSTICS;
      running = startWindowsProcess(
        built.executable,
        [built.bundle, built.assetRoot, options.mode, String(180000), String(1000), String(1000)],
        {
          cwd: built.directory,
          env,
          verify: verifyNativePackage,
          onOutput(chunk, channel) {
            if (output.length + errors.length + chunk.length > 4 * 1024 * 1024) {
              overflow = true;
              return;
            }
            if (channel === 'stdout') {
              output += chunk;
              foregroundCarry += chunk;
              let end;
              while ((end = foregroundCarry.indexOf('\n')) >= 0) {
                const line = foregroundCarry.slice(0, end).replace(/\r$/, '');
                foregroundCarry = foregroundCarry.slice(end + 1);
                if (line === 'NELYX_NATIVE_PROBE_FOREGROUND_WAIT') console.log(line);
              }
            } else errors += chunk;
          },
        },
      );
      abortStop = () => {
        void running.stop();
      };
      controller.signal.addEventListener('abort', abortStop, { once: true });
      if (controller.signal.aborted) abortStop();
      const result = await running.completed;
      controller.signal.removeEventListener('abort', abortStop);
      abortStop = undefined;
      const reports = nativeProbeReports(output);
      if (options.scope === 'sampling') {
        const map = new SourceMap(
          JSON.parse(fs.readFileSync(path.join(built.directory, 'app.js.map'), 'utf8')),
        );
        for (const report of reports)
          if (report.profile) report.profile = symbolicateNativeProfile(report.profile, map);
      }
      const exits = output
        .split(/\r?\n/)
        .filter((line) => line.startsWith('NELYX_NATIVE_EXIT '))
        .map((line) => JSON.parse(line.slice('NELYX_NATIVE_EXIT '.length)));
      for (const report of reports)
        console.log(
          'NELYX_NATIVE_PROBE ' +
            JSON.stringify({
              ...printableReport(report, options.details),
              trial,
              viewportName: viewport,
            }),
        );
      if (controller.signal.aborted) throw controller.signal.reason;
      if (
        overflow ||
        result.exitCode !== 0 ||
        result.error ||
        result.forced ||
        exits.length !== 1 ||
        exits[0].exitCode !== 0 ||
        !reports.some((report) => report.type === 'complete') ||
        /NELYX_NATIVE_(?:ERROR|MESSAGE_ERROR|JS_ERROR)/.test(output + errors)
      )
        throw Error(
          'Native scroll diagnostic failed: ' +
            JSON.stringify({
              result,
              overflow,
              exits,
              tail: output.slice(-9000),
              errors: errors.slice(-3000),
            }),
        );
      const expectedPhases = options.mixedScrollPixels
        ? 0
        : options.catalog
          ? viewport === 'maximized'
            ? 13
            : 10
          : 4;
      if (reports.filter((report) => report.type === 'phase').length !== expectedPhases)
        throw Error('Native diagnostic scenario incomplete');
      if (options.mixedScrollPixels) {
        const pixels = reports.filter((report) => report.type === 'mixed-native-pixels'),
          expected = new Set(
            ['top', 'bottom'].flatMap((edge) =>
              ['send', 'count', 'clear'].map((kind) => edge + ':mixed-scroll-' + kind + '-3'),
            ),
          );
        for (const row of pixels)
          if (
            !expected.delete(row.edge + ':' + row.button) ||
            !Number.isSafeInteger(row.compared) ||
            row.compared <= 100 ||
            !Number.isSafeInteger(row.missing) ||
            row.missing < 0 ||
            row.missing > row.compared * 0.01
          )
            throw Error('Native mixed scroll pixel comparison failed or repeated');
        if (pixels.length !== 6 || expected.size)
          throw Error('Native mixed scroll pixel comparison incomplete');
      }
      const loadedIdentity = verifyNativeLoadedIdentity(output, checked.manifest);
      const nativeViews = output
        .split(/\r?\n/)
        .filter((line) => line.startsWith('NELYX_NATIVE_VIEW '))
        .map((line) => JSON.parse(line.slice('NELYX_NATIVE_VIEW '.length)));
      const coverage = catalogs
        ? verifyNativeCatalogReports(reports, { viewport, ...catalogs })
        : null;
      const resourceStability = options.resourceCycles
        ? verifyNativeResourceCycles(reports, options.resourceCycles)
        : null;
      const summary = {
        schema: 1,
        trial,
        processId: running.pid,
        options: { ...options, viewport },
        qualification: 'diagnostic-only',
        sourceSha256: hostBuild.manifest.sourceSha256,
        loadedIdentity,
        nativeView: nativeViews.at(-1) ?? null,
        packageFiles: checked.files,
        exit: exits[0],
        normalClose: true,
        phases: reports.filter((report) => report.type === 'phase').length,
        ...(coverage ? { catalog: coverage } : {}),
        ...(resourceStability ? { resourceStability } : {}),
        performanceAccepted: false,
        physicalInputAccepted: 'notVerified',
        displayed: 'unobserved',
      };
      console.log('NELYX_NATIVE_PROBE_RESULT ' + JSON.stringify(summary));
      results.push(summary);
    }
    return results.length === 1 ? results[0] : results;
  } finally {
    clearTimeout(deadline);
    process.off('SIGINT', interrupted);
    process.off('SIGTERM', interrupted);
    if (abortStop) controller.signal.removeEventListener('abort', abortStop);
    if (running) await running.stop();
    /* oxlint-disable no-unsafe-finally -- Reject cleanup when directory ownership or rollback safety cannot be established. */
    if (
      path.dirname(temporary) !== parent ||
      !path.basename(temporary).startsWith('.scroll-fixture-') ||
      fs.lstatSync(temporary).isSymbolicLink()
    )
      throw Error('Native diagnostic cleanup escaped its owned directory');
    /* oxlint-enable no-unsafe-finally */
    fs.rmSync(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename))
  try {
    await runNativeScroll(nativeScrollOptions(process.argv.slice(2)));
  } catch (error) {
    console.error(error.stack ?? error);
    process.exitCode = 1;
  }
