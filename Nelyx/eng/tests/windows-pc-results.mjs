// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { symbolizeNativePc } from '../../sdk/tooling/cli/src/native-pc-map.mjs';
import { symbolizeWindowsFault } from './windows-fault-results.mjs';

/** Validate the real partition schema before invoking the native compiler. */
export function nativePcSources(partition) {
  assert.equal(partition.ir?.schema, 'nelyx.typed-partition-ir/v1');
  assert(Array.isArray(partition.ir.functions) && Array.isArray(partition.bindings));
  assert.deepEqual(
    partition.ir.functions.map((fn) => fn.id),
    partition.bindings.map((fn) => fn.id),
  );
  assert(Array.isArray(partition.executionPlan?.modules));
  return {
    typed: partition.ir.functions.map(({ id, module, name, position }) => ({
      id,
      module,
      name,
      position,
    })),
    owners: partition.executionPlan.modules.map(
      ({ nativeUnit, sourceFile, span, emitted, originals }) => {
        assert(
          Number.isSafeInteger(span?.offset) &&
            Number.isSafeInteger(span?.end) &&
            span.end >= span.offset &&
            Array.isArray(emitted) &&
            Array.isArray(originals),
        );
        return {
          unit: nativeUnit ?? 'nelyx_app',
          sourceFile,
          span,
          emitted: emitted.map(({ inputOffset, inputEnd, originals }) => ({
            inputOffset,
            inputEnd,
            originals,
          })),
          originals: originals.map(({ id, name, line, column }) => ({ id, name, line, column })),
        };
      },
    ),
  };
}

export function nativePcReport(profile, map) {
  assert(
    profile.complete &&
      Number.isSafeInteger(profile.thread) &&
      profile.thread > 0 &&
      Number.isSafeInteger(profile.samples) &&
      profile.samples > 0,
    'No complete observed JS-thread PC scope: ' + profile.phase,
  );
  assert.equal(profile.failed, 0);
  assert.equal(profile.dropped, 0);
  assert(Array.isArray(profile.pcs));
  const modules = new Map();
  let matchedSamples = 0,
    unmappedAotSamples = 0;
  const source = [],
    groups = new Map();
  let total = 0;
  for (const pc of profile.pcs) {
    assert(
      typeof pc.module === 'string' &&
        Number.isSafeInteger(pc.rva) &&
        pc.rva >= 0 &&
        Number.isSafeInteger(pc.n) &&
        pc.n > 0,
    );
    total += pc.n;
    modules.set(pc.module, (modules.get(pc.module) ?? 0) + pc.n);
    if (pc.module.toLowerCase() !== 'nelyxapp.aot.dll' || !map) continue;
    const functions = symbolizeNativePc(map, pc.rva);
    if (!functions.length) {
      unmappedAotSamples += pc.n;
      continue;
    }
    matchedSamples += pc.n;
    const entry = {
      ...pc,
      functionCount: functions.length,
      functions: functions.slice(0, 4).map((fn) => {
        if (fn.unit === 'nelyx_typed') {
          const kernel = /_kernel(\d+)$/.exec(fn.symbol),
            original = kernel ? map.typed?.[Number(kernel[1])] : undefined;
          return { ...fn, original: original ?? null };
        }
        const owner = map.owners?.find(
            (owner) =>
              owner.unit === fn.unit &&
              fn.position &&
              fn.position.offset >= owner.span.offset &&
              fn.position.offset < owner.span.end,
          ),
          emitted = owner?.emitted
            .filter(
              (body) =>
                fn.position.offset >= body.inputOffset && fn.position.offset < body.inputEnd,
            )
            .sort((a, b) => a.inputEnd - a.inputOffset - (b.inputEnd - b.inputOffset))[0];
        const originals = emitted
          ? owner.originals.filter((body) => emitted.originals.includes(body.id))
          : [];
        return {
          ...fn,
          module: owner?.sourceFile ?? null,
          originalCount: originals.length,
          originals: originals.slice(0, 4),
        };
      }),
    };
    source.push(entry);
    // Instruction bins split one function across many RVAs. Group by the full
    // set of containing ranges, preserving folded/overlapping ambiguity. Count
    // each observation once instead of assigning it to every alias.
    const key = JSON.stringify(
      [...new Set(functions.map((fn) => fn.unit + ':' + fn.rva + ':' + fn.size))].sort(),
    );
    let group = groups.get(key);
    if (!group) {
      group = {
        n: 0,
        pcCount: 0,
        observedRvas: [],
        functionCount: entry.functionCount,
        functions: entry.functions,
      };
      groups.set(key, group);
    }
    group.n += pc.n;
    group.pcCount++;
    if (group.observedRvas.length < 3) group.observedRvas.push(pc.rva);
  }
  assert.equal(total, profile.samples, 'PC accounting lost observations');
  return {
    phase: profile.phase,
    scope:
      'intrusive external suspension snapshots, including waits; not CPU-time shares or performance acceptance',
    precision:
      'function-range; folded aliases remain ambiguous; top 6 PCs/8 range groups, at most 4 aliases/original candidates with total counts',
    thread: profile.thread,
    samples: profile.samples,
    threadCpuMs: profile.threadCpuMs,
    requestedIntervalMs: profile.requestedIntervalMs,
    intervalP50Ms: profile.intervalP50Ms,
    intervalP95Ms: profile.intervalP95Ms,
    intervalMaxMs: profile.intervalMaxMs,
    modules: Object.fromEntries(modules),
    matchedAotSamples: matchedSamples,
    aotOutsideOwnedRanges: unmappedAotSamples,
    ownedFunctionGroups: groups.size,
    ownedFunctionObservations: [...groups.values()].sort((a, b) => b.n - a.n).slice(0, 8),
    observedSourcePcs: source.sort((a, b) => b.n - a.n).slice(0, 6),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let input, ownedInput;
  try {
    const bundle = fs.realpathSync(process.argv[2]),
      directory = path.dirname(bundle),
      owner = path.basename(directory) === 'out' ? path.dirname(directory) : directory;
    assert.equal(path.dirname(owner), fs.realpathSync(os.tmpdir()));
    assert(path.basename(owner).startsWith('nelyx-windows-animation-'));
    assert.equal(path.basename(bundle), 'Bundle');
    assert(!fs.lstatSync(owner).isSymbolicLink());
    input = path.resolve(process.argv[3]);
    assert.equal(path.dirname(input), directory);
    assert.equal(path.basename(input), 'pc-snapshots.json');
    assert(fs.lstatSync(input).isFile() && !fs.lstatSync(input).isSymbolicLink());
    assert(fs.statSync(input).size <= 64 * 1024 ** 2);
    ownedInput = input;
    const profiles = JSON.parse(fs.readFileSync(input)),
      file = path.join(bundle, 'native-pc-map.json');
    let map;
    const hash = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
      observer = fs.realpathSync(process.argv[4]),
      target = fs.realpathSync(process.argv[5]);
    for (const executable of [observer, target]) assert.equal(path.dirname(executable), directory);
    const provenance = {
      observerSha256: hash(observer),
      targetSha256: hash(target),
      ...(fs.existsSync(path.join(directory, 'hermes.dll'))
        ? { vmSha256: hash(path.join(directory, 'hermes.dll')) }
        : {}),
    };
    if (fs.existsSync(file)) {
      assert(!fs.lstatSync(file).isSymbolicLink());
      assert(fs.statSync(file).size <= 64 * 1024 ** 2);
      map = JSON.parse(fs.readFileSync(file));
      const image = path.join(directory, 'NelyxApp.aot.dll');
      assert.equal(
        createHash('sha256').update(fs.readFileSync(image)).digest('hex'),
        map.imageSha256,
        'Observed native PCs belong to a different image',
      );
    }
    assert(Array.isArray(profiles) && profiles.length > 0 && profiles.length <= 128);
    assert.equal(new Set(profiles.map((value) => value.phase)).size, profiles.length);
    let matched = 0;
    for (const profile of profiles) {
      const report = nativePcReport(profile, map),
        pcs = profile.pcs
          .filter((pc) => pc.module.toLowerCase() === 'hermes.dll')
          .sort((a, b) => b.n - a.n)
          .slice(0, 12);
      report.provenance = {
        ...provenance,
        ...(map ? { aotSha256: map.imageSha256, mapSha256: hash(file) } : {}),
      };
      matched += report.matchedAotSamples;
      report.vmSymbols = symbolizeWindowsFault(pcs, directory, { compact: true });
      if (pcs.length)
        assert(
          report.vmSymbols.some((record) =>
            record.entries?.some((entry) => entry.symbols.some((symbol) => symbol.resolved)),
          ),
          'Observed VM PCs have no resolved symbols',
        );
      console.log('ANIMATION_PC_ATTRIBUTION ' + JSON.stringify(report));
      // Compatible with an already-running qualification wrapper: namespaced
      // sidecars never masquerade as native elapsed-time stage distributions.
      console.log(
        'ANIMATION_STAGES ' +
          JSON.stringify({ phase: 'pc.' + profile.phase, stages: {}, pc: report }),
      );
    }
    if (map) assert(matched > 0, 'No owned AOT function PC was observed');
  } catch (error) {
    console.error('ANIMATION_PC_ERROR ' + String(error));
    process.exitCode = 1;
  } finally {
    if (ownedInput && fs.existsSync(ownedInput) && !fs.lstatSync(ownedInput).isSymbolicLink())
      fs.unlinkSync(ownedInput);
  }
}
