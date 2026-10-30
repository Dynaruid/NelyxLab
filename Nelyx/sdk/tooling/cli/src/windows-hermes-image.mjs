// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execute } from './commands.mjs';
import { sha256 } from './files.mjs';
import { readNativeFunctionMap } from './native-function-map.mjs';
import { readNativePcMap } from './native-pc-map.mjs';
import { nativeBuildHash, openNativeBuildCache } from './native-build-cache.mjs';
const timeout = 1_200_000;
export function mapTypedDiagnostics(output, source, map) {
  const text = fs.readFileSync(source, 'utf8'),
    starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
  const files = new Map(map.bindings.map((binding) => [binding.module, binding.file])),
    positions = [];
  for (const match of output.matchAll(/^(.+):(\d+):(\d+): (error|warning): (.+)$/gm)) {
    if (path.resolve(match[1]) !== path.resolve(source)) continue;
    const line = Number(match[2]),
      column = Number(match[3]);
    if (line < 1 || line > starts.length) continue;
    const offset = starts[line - 1] + column - 1;
    let segment;
    for (const item of map.segments) {
      if (item.generatedOffset > offset) break;
      if (offset < item.generatedOffset + item.generatedLength) segment = item;
    }
    if (segment)
      positions.push(
        `${files.get(segment.module) ?? segment.module}:${segment.line}:${segment.column}: ${match[4]}: ${match[5]} [typed input ${line}:${column}]`,
      );
  }
  return positions;
}
/** Shared native image owner for typed and untyped units of one verified VM. */
export async function compileHermesImage({
  checked,
  env,
  units,
  output,
  descriptor,
  signal,
  cacheDirectory,
  runtimeLibrary = path.join(checked.directory, 'build/API/hermes_shared/hermes.lib'),
  descriptorExport = 'nelyx_sh_plan_v5',
}) {
  output = path.resolve(output);
  const parent = fs.realpathSync(path.dirname(output));
  if (
    parent !== path.dirname(output) ||
    (fs.existsSync(output) && fs.lstatSync(output).isSymbolicLink())
  )
    throw Error('Native image output must have a plain owned parent');
  signal?.throwIfAborted();
  const started = performance.now(),
    cache = cacheDirectory ? openNativeBuildCache(cacheDirectory) : null;
  let folder;
  try {
    const previous = cache?.read(),
      debug = units.some((unit) => unit.evidence);
    const clang = path.join(process.env.ProgramFiles, 'LLVM/bin/clang.exe');
    const link = (env.PATH ?? env.Path ?? '')
      .split(path.delimiter)
      .map((dir) => path.join(dir, 'link.exe'))
      .find((file) => fs.existsSync(file));
    if (!link) throw Error('MSVC linker unavailable');
    const cFlags = [
      '-O3',
      ...(debug ? ['-gcodeview', '-gline-tables-only'] : []),
      '-ffp-contract=off',
      '-DNDEBUG',
      '-DSTATIC_HERMES',
      '-fno-strict-aliasing',
      '-fno-strict-overflow',
      '-fms-runtime-lib=dll',
      '-I' + path.join(checked.directory, 'source/include'),
      '-I' + path.join(checked.directory, 'build/lib/config'),
    ];
    const producer = nativeBuildHash(
      [
        import.meta.filename,
        path.join(import.meta.dirname, 'native-build-cache.mjs'),
        path.join(import.meta.dirname, 'native-function-map.mjs'),
        path.join(import.meta.dirname, 'native-pc-map.mjs'),
        path.join(import.meta.dirname, 'commands.mjs'),
      ].map((file) => sha256(file)),
    );
    const nativeInputs = {
      producer,
      toolchain: checked.sha256,
      runtimeLibrary: sha256(runtimeLibrary),
      descriptorExport,
      clang: sha256(clang),
      link: sha256(link),
      cFlags,
      environment: [env.INCLUDE, env.LIB, env.PATH ?? env.Path],
    };
    const planned = units.map((unit) => {
      if (!/^nelyx_[a-z_]+$/.test(unit.name)) throw Error('Invalid owned SHUnit name');
      const sourceSha256 = sha256(unit.source),
        key = nativeBuildHash({
          nativeInputs,
          name: unit.name,
          source: fs.realpathSync(unit.source),
          sourceSha256,
          flags: unit.flags,
          typed: !!unit.typed,
          requireNumeric: unit.requireNumeric !== false,
          evidence: !!unit.evidence,
        });
      return { unit, key, sourceSha256 };
    });
    if (new Set(units.map((unit) => unit.name)).size !== units.length)
      throw Error('Duplicate SHUnit name');
    const imageKey = nativeBuildHash({
      nativeInputs,
      output,
      units: planned.map(({ key }) => key),
      descriptor: descriptor ?? null,
    });
    if (
      previous?.image?.key === imageKey &&
      fs.existsSync(output) &&
      sha256(output) === previous.image.sha256
    ) {
      signal?.throwIfAborted();
      console.log('STATIC_AOT_CACHE image-hit');
      return {
        buildMs: performance.now() - started,
        cacheHit: true,
        units: previous.units.map(({ measurement }) => ({
          ...measurement,
          cacheHit: true,
          frontendMs: 0,
          baselineMs: 0,
          evidenceMs: 0,
          nativeMs: 0,
        })),
        ...(previous.image.nativePcMap ? { nativePcMap: previous.image.nativePcMap } : {}),
      };
    }
    console.log('STATIC_AOT_CACHE image-miss');
    folder = fs.mkdtempSync(path.join(parent, '.nelyx-sh-'));
    const pdb = path.join(folder, 'image.pdb');
    const controller = new AbortController(),
      childSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    /* oxlint-disable unicorn/no-new-array -- The numeric argument is the required length; preserve preallocation and sparse storage semantics. */
    const compiledUnits = new Array(units.length);
    /* oxlint-enable unicorn/no-new-array */
    let cursor = 0;
    const compile = async ({ unit, key, sourceSha256 }) => {
      const cached = previous?.units?.find(
          (value) => value.name === unit.name && value.key === key,
        ),
        cachedObject = cache?.file(unit.name + '.obj');
      if (cached && fs.existsSync(cachedObject) && sha256(cachedObject) === cached.objectSha256) {
        console.log('STATIC_AOT_CACHE unit-hit ' + unit.name);
        return {
          ...cached,
          object: cachedObject,
          measurement: {
            ...cached.measurement,
            cacheHit: true,
            frontendMs: 0,
            baselineMs: 0,
            evidenceMs: 0,
            nativeMs: 0,
          },
        };
      }
      const c = path.join(folder, unit.name + '.c'),
        object = path.join(folder, unit.name + '.obj'),
        begin = performance.now();
      console.log('STATIC_AOT_COMPILE ' + unit.name);
      try {
        await execute(
          path.join(checked.directory, 'build/bin/shermes.exe'),
          [
            ...unit.flags,
            '-sm-comment=off',
            '-emit-c',
            '-exported-unit=' + unit.name,
            '-o',
            c,
            fs.realpathSync(unit.source),
          ],
          { env, signal: childSignal, timeout },
        );
      } catch (error) {
        const mapped = unit.diagnosticMap
          ? mapTypedDiagnostics(error.output ?? '', unit.source, unit.diagnosticMap)
          : [];
        if (mapped.length) throw new Error(mapped.join('\n'), { cause: error });
        throw error;
      }
      const compiled = performance.now();
      let nativeFunctions,
        baselineMs = 0,
        evidenceMs = 0;
      if (unit.evidence) {
        const baseline = path.join(folder, unit.name + '.baseline.c');
        const frontendFlags = unit.flags.filter((flag) =>
          ['-typed', '-parse-ts', '-parse-flow'].includes(flag),
        );
        const baselineStarted = performance.now();
        await execute(
          path.join(checked.directory, 'build/bin/shermes.exe'),
          [
            ...frontendFlags,
            '-sm-comment=off',
            '-O0',
            ...(unit.typed ? ['-Xcustom-opt=stripdebug'] : []),
            '-emit-c',
            '-exported-unit=' + unit.name,
            '-o',
            baseline,
            fs.realpathSync(unit.source),
          ],
          { env, signal: childSignal, timeout },
        );
        baselineMs = performance.now() - baselineStarted;
        const evidenceStarted = performance.now();
        nativeFunctions = {
          ...(await readNativeFunctionMap(c, unit.source, unit.name)),
          sourceSha256: sha256(unit.source),
          baseline: await readNativeFunctionMap(baseline, unit.source, unit.name),
        };
        evidenceMs = performance.now() - evidenceStarted;
      }
      if (
        unit.typed &&
        unit.requireNumeric !== false &&
        !fs.readFileSync(c, 'utf8').includes('_sh_ljs_double')
      )
        throw Error('Typed unit lacks native numeric lowering');
      const nativeStarted = performance.now();
      await execute(clang, ['-c', c, '-o', object, ...cFlags], {
        env,
        signal: childSignal,
        timeout,
      });
      if (sha256(unit.source) !== sourceSha256)
        throw Error('Native source changed during compilation: ' + unit.name);
      const measurement = {
        unit: unit.name,
        cacheHit: false,
        frontendMs: compiled - begin,
        baselineMs,
        evidenceMs,
        nativeMs: performance.now() - nativeStarted,
        cBytes: fs.statSync(c).size,
        sourceMapMode: 'generated-input-with-owned-map',
        ...(nativeFunctions ? { nativeFunctions } : {}),
      };
      if (cache) fs.copyFileSync(object, cachedObject);
      return {
        name: unit.name,
        key,
        object: cachedObject ?? object,
        objectSha256: sha256(object),
        measurement,
      };
    };
    // A single large app unit can use several GiB. Bound concurrency by both
    // memory and CPUs; never launch one compiler per logical processor.
    const jobs = Math.min(
      2,
      os.availableParallelism(),
      Math.max(1, Math.floor(os.totalmem() / (6 * 1024 ** 3))),
      units.length,
    );
    const results = await Promise.allSettled(
      Array.from({ length: jobs }, async () => {
        try {
          while (cursor < planned.length) {
            const index = cursor++;
            childSignal.throwIfAborted();
            compiledUnits[index] = await compile(planned[index]);
          }
        } catch (error) {
          controller.abort(error);
          throw error;
        }
      }),
    );
    const failed = results.find((result) => result.status === 'rejected');
    if (failed) throw controller.signal.reason ?? failed.reason;
    signal?.throwIfAborted();
    const measurements = compiledUnits.map((value) => value.measurement),
      objects = compiledUnits.map((value) => value.object);
    if (descriptor) {
      const source = path.join(folder, 'plan.c'),
        object = path.join(folder, 'plan.obj');
      fs.writeFileSync(source, descriptor);
      await execute(clang, ['-c', source, '-o', object, '-O2', '-fms-runtime-lib=dll'], {
        env,
        signal,
        timeout,
      });
      objects.push(object);
    }
    const image = path.join(folder, 'image.dll');
    if (!/^[a-z_0-9]+$/.test(descriptorExport)) throw Error('Invalid native descriptor export');
    await execute(
      link,
      [
        '/DLL',
        '/NOLOGO',
        '/MACHINE:X64',
        '/OPT:REF',
        '/OPT:ICF',
        ...(debug ? ['/DEBUG:FULL', '/INCREMENTAL:NO', '/PDB:' + pdb] : []),
        '/DYNAMICBASE',
        '/NXCOMPAT',
        '/OUT:' + image,
        '/IMPLIB:' + path.join(folder, 'image.lib'),
        ...units.map((unit) => '/EXPORT:sh_export_' + unit.name),
        ...(descriptor ? ['/EXPORT:' + descriptorExport] : []),
        ...objects,
        runtimeLibrary,
      ],
      { env, signal, timeout },
    );
    const nativePcMap = debug
      ? await readNativePcMap(image, pdb, measurements, { env, signal })
      : null;
    fs.renameSync(image, output);
    cache?.write(
      {
        units: compiledUnits.map(({ object, ...value }) => value),
        image: { key: imageKey, sha256: sha256(output), nativePcMap },
      },
      folder,
    );
    return {
      buildMs: performance.now() - started,
      cacheHit: false,
      units: measurements,
      ...(nativePcMap ? { nativePcMap } : {}),
    };
  } finally {
    try {
      if (folder) {
        /* oxlint-disable no-unsafe-finally -- Reject cleanup when directory ownership or rollback safety cannot be established. */
        if (
          path.dirname(folder) !== parent ||
          !path.basename(folder).startsWith('.nelyx-sh-') ||
          fs.lstatSync(folder).isSymbolicLink()
        )
          throw Error('Unexpected native image temporary owner');
        /* oxlint-enable no-unsafe-finally */
        fs.rmSync(folder, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      }
    } finally {
      cache?.close();
    }
  }
}
