// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {createRuntimeInventory} from '@nelyx/static-aot/runtime-inventory';

const hash = value => createHash('sha256').update(value).digest('hex');
const slash = value => value.replaceAll('\\', '/');
const inside = (root, file) => {const relative = path.relative(root, file); return relative === '' || !relative.startsWith('..') && !path.isAbsolute(relative);};

/** Observe the installed runner's actual Release serializer, including loader,
 * pre-main/polyfills and generated run statements. No bundle is published. */
export async function inspectRuntimeInventory({runner, appRoot, signal, entry = 'main.tsx', config: suppliedConfig, customTransformOptions, sourceMapUrl = 'index.windows.bundle.map', onCapture}) {
  signal?.throwIfAborted();
  runner = fs.realpathSync(runner); appRoot = fs.realpathSync(appRoot);
  if (!inside(appRoot, runner)) throw Error('Runtime runner must belong to the application');
  const load = createRequire(path.join(runner, 'package.json'));
  const {runBuild, loadConfig} = load('metro');
  const metroManifest = load.resolve('metro/package.json'), metro = path.dirname(metroManifest);
  // These serializer internals are tied to the declared runner Metro version.
  // Unsupported serializers fail instead of silently dropping generated code.
  if (JSON.parse(fs.readFileSync(metroManifest, 'utf8')).version !== '0.83.8') throw Error('Runtime inventory requires qualified Metro 0.83.8');
  const baseBundle = load(path.join(metro, 'src/DeltaBundler/Serializers/baseJSBundle.js')).default;
  const bundleToString = load(path.join(metro, 'src/lib/bundleToString.js')).default;
  const appendScripts = load(path.join(metro, 'src/lib/getAppendScripts.js')).default;
  const configFile = path.join(runner, 'metro.config.cjs');
  const config = suppliedConfig ?? await loadConfig({cwd: runner, config: configFile});
  if (config.serializer.customSerializer) throw Error('Runtime inventory cannot replace a custom serializer');
  if (![load.resolve('@react-native/metro-babel-transformer'), ...(suppliedConfig ? [load.resolve('@nelyx/metro/native-typed-transformer')] : [])].includes(config.transformer.babelTransformerPath)) throw Error('Pre-partition inventory requires the owning RN Babel transformer');
  const id = file => {
    if (!inside(appRoot, file)) throw Error('Runtime module escaped installed application: ' + file);
    return slash(path.relative(appRoot, file));
  };
  const ownerCache = new Map();
  const ownerOf = file => {
    let directory = path.dirname(file);
    while (inside(appRoot, directory)) {
      if (ownerCache.has(directory)) return ownerCache.get(directory);
      const manifest = path.join(directory, 'package.json');
      if (fs.existsSync(manifest)) {
        const bytes = fs.readFileSync(manifest), value = JSON.parse(bytes);
        const owner = {name: value.name, version: value.version, root: id(directory), license: typeof value.license === 'string' ? value.license : null, manifestSha256: hash(bytes)};
        if (typeof owner.name !== 'string' || typeof owner.version !== 'string') throw Error('Runtime package owner is incomplete: ' + manifest);
        ownerCache.set(directory, owner); return owner;
      }
      directory = path.dirname(directory);
    }
    throw Error('Runtime module owner is absent: ' + file);
  };
  const recoverSource = (file, text, owner) => {
    if (!owner.name.startsWith('@nelyx/') || !/\.jsx?$/.test(file) || !id(file).slice(owner.root.length).startsWith('/dist/')) return {source: text, sourceFile: id(file)};
    const mapFile = file + '.map';
    if (!fs.existsSync(mapFile)) throw Error('Installed implementation source map absent: ' + id(file));
    const bytes = fs.readFileSync(mapFile), map = JSON.parse(bytes);
    if (map.version !== 3 || map.sourceRoot || map.sources?.length !== 1 || map.sourcesContent?.length !== 1 || typeof map.sources[0] !== 'string' || typeof map.sourcesContent[0] !== 'string') throw Error('Single owned implementation source map required: ' + id(file));
    const sourceFile = path.resolve(path.dirname(file), map.sources[0]);
    if (!inside(path.join(appRoot, owner.root), sourceFile) || !/(?<!\.d)\.tsx?$/.test(sourceFile) || !fs.existsSync(sourceFile) || !inside(path.join(appRoot, owner.root), fs.realpathSync(sourceFile))) throw Error('Implementation source escaped package owner: ' + id(file));
    const source = fs.readFileSync(sourceFile, 'utf8');
    if (source !== map.sourcesContent[0]) throw Error('Installed source differs from emitted map: ' + id(file));
    return {source, sourceFile: id(sourceFile), sourceMapSha256: hash(bytes), originalMap: map};
  };
  let captured;
  const bundle = await runBuild({...config, maxWorkers: 2, reporter: {update(event) {if (event.type === 'error') config.reporter.update(event);}}, serializer: {...config.serializer,
    customSerializer(entry, prepend, graph, options) {
      signal?.throwIfAborted();
      if (captured) throw Error('Runtime graph was serialized more than once');
      const serialized = baseBundle(entry, prepend, graph, options);
      const selected = [...prepend, ...graph.dependencies.values()].filter(module => options.processModuleFilter(module) && module.output.some(output => output.type.startsWith('js/')));
      const appended = appendScripts(entry, [...prepend, ...graph.dependencies.values()], options).filter(module => options.processModuleFilter(module));
      const generated = appended.filter(module => !['source-map', 'source-url'].includes(module.path));
      const pre = new Set(prepend), names = new Map(selected.map(module => [module.path, fs.existsSync(module.path) ? id(module.path) : 'generated/prelude']));
      const serializedModules = new Map(serialized.modules);
      const records = selected.map(module => {
        const outputs = module.output.filter(output => output.type.startsWith('js/'));
        if (outputs.length !== 1) throw Error('Runtime module must own exactly one JS output: ' + module.path);
        const emitted = pre.has(module) ? outputs[0].data.code : serializedModules.get(options.createModuleId(module.path));
        if (typeof emitted !== 'string') throw Error('Serialized runtime module output missing: ' + module.path);
        const real = fs.existsSync(module.path), owner = ownerOf(real ? module.path : metroManifest);
        if (real && fs.realpathSync(module.path) !== module.path) throw Error('Runtime module symlink identity rejected: ' + module.path);
        const recovered = real ? recoverSource(module.path, module.getSource().toString('utf8'), owner) : {source: emitted, sourceFile: names.get(module.path)};
        // RN's frontend accepts Flow even without an @flow pragma.
        const dialect = /\.tsx?$/.test(recovered.sourceFile) ? 'typescript' : real && !module.path.endsWith('.json') ? 'flow' : 'javascript';
        return {id: names.get(module.path), metroId: options.createModuleId(module.path), role: pre.has(module) ? 'prepend' : 'module', owner, ...recovered, nativeEvidence:outputs[0].data.nelyxNativeEvidence, transformSourceSha256:real?hash(module.getSource()):hash(emitted), sourceKind: module.path.endsWith('.json') ? 'json' : 'code', dialect, emitted, mappings: outputs[0].data.map,
          dependencies: [...module.dependencies.values()].map(edge => {
            if (edge.absolutePath === undefined) return {specifier: edge.data.name, target: null, asyncType: edge.data.data.asyncType ?? null, optional: edge.data.data.isOptional === true, position: edge.data.data.loc ?? null};
            const target = names.get(edge.absolutePath);
            if (!target) throw Error('Runtime dependency is absent from serialization: ' + edge.absolutePath);
            return {specifier: edge.data.name, target, asyncType: edge.data.data.asyncType ?? null};
          })};
      });
      for (let index = 0; index < generated.length; index++) {
        const module = generated[index], emitted = module.output[0].data.code;
        const target = module.path.startsWith('require-') ? names.get(module.path.slice(8)) : null;
        if (!target) throw Error('Unclassified Metro startup script: ' + module.path);
        records.push({id: 'generated/append-' + index, metroId: module.path.startsWith('require-') ? options.createModuleId(module.path.slice(8)) : module.path,
          role: 'append', owner: ownerOf(metroManifest), source: emitted, emitted, sourceFile: 'generated/append-' + index + '.js', dialect: 'javascript', dependencies: [{specifier: '<metro-run>', target, asyncType: null}]});
      }
      captured = {entry: names.get(entry), records, paths: names, roots: options.runBeforeMainModule.map(file => names.get(file)), moduleOrder: serialized.modules.map(([moduleId]) => moduleId), directives: appended.filter(module => !generated.includes(module)).map(module => ({kind: module.path, sha256: hash(module.output[0].data.code)}))};
      if (!captured.entry || captured.roots.some(root => !root)) throw Error('Runtime initializer root missing');
      const code = bundleToString(serialized).code;
      const spans = [];let cursor = 0;
      const recordById = new Map(records.filter(record => record.role === 'module').map(record => [record.metroId, record]));
      const addSpan = record => {if (code.slice(cursor, cursor + record.emitted.length) !== record.emitted) throw Error('Runtime module serialization span differs: ' + record.id);spans.push({id: record.id, offset: cursor, end: cursor + record.emitted.length});cursor += record.emitted.length + 1;};
      for (const record of records.filter(record => record.role === 'prepend')) addSpan(record);
      if (cursor !== (serialized.pre.length ? serialized.pre.length + 1 : 0)) throw Error('Runtime prelude span differs');
      for (const [moduleId] of serialized.modules.slice().sort((a,b) => a[0]-b[0])) addSpan(recordById.get(moduleId));
      for (const record of records.filter(record => record.role === 'append')) addSpan(record);
      captured.spans = spans;
      return code;
    }}}, {entry: path.isAbsolute(entry) ? path.relative(runner, entry) : entry, ...(customTransformOptions ? {customTransformOptions} : {}), platform: 'windows', dev: false, minify: false, sourceMap: true, sourceMapUrl});
  signal?.throwIfAborted();
  if (!captured) throw Error('Metro runtime serializer was not observed');
  const map = JSON.parse(bundle.map);
  if (map.version !== 3 || map.sourceRoot || map.sources.length !== map.sourcesContent.length) throw Error('Flat complete Metro source map required');
  const sourceMapModules = map.sources.map((file, index) => {
    const absolute = path.isAbsolute(file) ? file : path.resolve(runner, file);
    const moduleId = captured.paths.get(file) ?? captured.paths.get(absolute), record = captured.records.find(record => record.id === moduleId);
    if (!record) throw Error('Metro map has an unobserved module: ' + file);
    const actual = fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : record.source;
    if (map.sourcesContent[index] !== actual) throw Error('Metro map source content differs: ' + file);
    return moduleId;
  });
  const suppliedIdentity = (filename, schema, property, manifest) => {
    const file = path.join(appRoot, '.nelyx/windows', filename);
    if (!fs.existsSync(file)) return null;
    const bytes = fs.readFileSync(file), locator = JSON.parse(bytes);
    if (locator.schema !== schema || typeof locator[property] !== 'string' || typeof locator.sha256 !== 'string') throw Error('Prepared inventory input locator differs: ' + filename);
    const input = manifest ? path.join(locator[property], manifest) : locator[property];
    if (hash(fs.readFileSync(input)) !== locator.sha256) throw Error('Prepared inventory input manifest changed: ' + filename);
    return {locatorSha256: hash(bytes), inputSha256: locator.sha256};
  };
  const identity = {stage: suppliedConfig ? 'native-input-release' : 'pre-partition-release', platform: 'windows', configuration: 'Release', engine: 'hermes', dev: false, minify: false, metro: '0.83.8',
    runnerManifestSha256: hash(fs.readFileSync(path.join(runner, 'package.json'))), lockSha256: hash(fs.readFileSync(path.join(runner, 'package-lock.json'))),
    configSha256: hash(fs.readFileSync(configFile)), babelConfigSha256: hash(fs.readFileSync(path.join(runner, 'babel.config.cjs'))),
    bundleSha256: hash(bundle.code), sourceMapSha256: hash(bundle.map), roots: captured.roots, moduleOrder: captured.moduleOrder, directives: captured.directives,
    nativeInputs: suppliedIdentity('native-inputs.json', 'nelyx.rnw-prepared/v1', 'input'),
    compilerRuntimeInputs: suppliedIdentity('static-hermes-inputs.json', 'nelyx.windows-static-hermes-locator/v1', 'directory', 'static-hermes.json')};
  const inventory = createRuntimeInventory({identity, entry: captured.entry, modules: captured.records, sourceMapModules});
  if (onCapture) onCapture({inventory, code: bundle.code, map: bundle.map, records: captured.records, spans: captured.spans});
  return inventory;
}
