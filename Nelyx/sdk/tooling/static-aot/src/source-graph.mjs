// SPDX-License-Identifier: BSD-3-Clause
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const slash = (value) => value.replaceAll('\\', '/');
const hash = (value) => createHash('sha256').update(value).digest('hex');
const inside = (root, file) => {
  const relative = path.relative(root, file);
  return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
};

function components(modules, kind) {
  const byId = new Map(modules.map((module) => [module.id, module])),
    indexes = new Map(),
    low = new Map(),
    stack = [],
    active = new Set(),
    result = [];
  let index = 0;
  const visit = (id) => {
    indexes.set(id, index);
    low.set(id, index++);
    stack.push(id);
    active.add(id);
    for (const edge of byId.get(id).imports) {
      if (
        (kind === 'runtime' ? edge.kind === 'type' : edge.kind !== kind) ||
        !byId.has(edge.target)
      )
        continue;
      if (!indexes.has(edge.target)) {
        visit(edge.target);
        low.set(id, Math.min(low.get(id), low.get(edge.target)));
      } else if (active.has(edge.target))
        low.set(id, Math.min(low.get(id), indexes.get(edge.target)));
    }
    if (low.get(id) === indexes.get(id)) {
      const values = [];
      let value;
      do {
        value = stack.pop();
        active.delete(value);
        values.push(value);
      } while (value !== id);
      result.push(values.sort());
    }
  };
  for (const id of [...byId.keys()].sort()) if (!indexes.has(id)) visit(id);
  return result.sort((a, b) => a[0].localeCompare(b[0]));
}
/** Read installed implementation bodies with the pinned checker; never synthesize from .d.ts. */
export function buildSourceGraph({ entry, applicationRoot, packageRoots, maxModules = 4096 }) {
  const require = createRequire(import.meta.url),
    checkerPackage = require('typescript/package.json');
  if (
    checkerPackage.name !== '@typescript/typescript6' ||
    checkerPackage.version !== '6.0.2' ||
    ts.version !== '6.0.3'
  )
    throw Error('Static Hermes AOT requires @typescript/typescript6@6.0.2 (API 6.0.3)');
  if (!Number.isSafeInteger(maxModules) || maxModules < 1 || maxModules > 4096)
    throw Error('Invalid source graph admission bound');
  const owners = [],
    names = new Set();
  for (const directory of packageRoots) {
    const root = fs.realpathSync(directory),
      manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    if (!/^@nelyx\/[a-z-]+$/.test(manifest.name) || names.has(manifest.name))
      throw Error('Duplicate or invalid module owner: ' + manifest.name);
    names.add(manifest.name);
    owners.push({ root, name: manifest.name, manifest });
  }
  const application = fs.realpathSync(applicationRoot);
  owners.push({ root: application, name: 'application' });
  // Most-specific installed package wins over its containing application root.
  owners.sort((a, b) => b.root.length - a.root.length);
  const ownerOf = (file) =>
    owners.find(
      (owner) =>
        inside(owner.root, file) &&
        (owner.manifest ||
          !path.relative(owner.root, file).split(path.sep).includes('node_modules')),
    );
  const identity = (file) => {
    const owner = ownerOf(file);
    return owner ? owner.name + '/' + slash(path.relative(owner.root, file)) : null;
  };
  const packages = new Map(
    owners.filter((owner) => owner.manifest).map((owner) => [owner.name, owner]),
  );
  const origins = new Map(),
    boundaries = [],
    resolutions = new Map();
  const ownedFile = (owner, file) => {
    const actual = fs.realpathSync(file);
    if (
      !inside(owner.root, actual) ||
      !fs.statSync(actual).isFile() ||
      fs.lstatSync(file).isSymbolicLink()
    )
      throw Error('Implementation file escapes module owner or is not plain: ' + file);
    return actual;
  };
  const emittedOrigin = (owner, body, runtime) => {
    ownedFile(owner, body);
    ownedFile(owner, runtime);
    const mapFile = runtime + '.map';
    ownedFile(owner, mapFile);
    const mapBytes = fs.readFileSync(mapFile),
      map = JSON.parse(mapBytes);
    if (
      map.version !== 3 ||
      map.sources?.length !== 1 ||
      map.sourcesContent?.length !== 1 ||
      path.resolve(path.dirname(mapFile), map.sources[0]) !== body
    )
      throw Error('Implementation requires one supplied source map body: ' + identity(body));
    if (fs.readFileSync(body, 'utf8') !== map.sourcesContent[0])
      throw Error('Installed source differs from runtime map: ' + identity(body));
    return {
      runtime: identity(runtime),
      runtimeSha256: hash(fs.readFileSync(runtime)),
      mapSha256: hash(mapBytes),
    };
  };
  const mappedBody = (owner, runtime, specifier) => {
    const mapFile = runtime + '.map';
    ownedFile(owner, mapFile);
    const map = JSON.parse(fs.readFileSync(mapFile));
    if (map.version !== 3 || map.sources?.length !== 1 || map.sourcesContent?.length !== 1)
      throw Error('Implementation requires one supplied source map body: ' + specifier);
    const body = path.resolve(path.dirname(mapFile), map.sources[0]);
    if (
      !inside(owner.root, body) ||
      !slash(path.relative(owner.root, body)).startsWith('src/') ||
      !/(?<!\.d)\.tsx?$/.test(body)
    )
      throw Error('Mapped implementation escapes package source: ' + specifier);
    ownedFile(owner, body);
    if (fs.readFileSync(body, 'utf8') !== map.sourcesContent[0])
      throw Error('Installed source differs from runtime map: ' + specifier);
    origins.set(body, emittedOrigin(owner, body, runtime));
    return body;
  };
  const sourceFor = (specifier, containing) => {
    const match = /^(@nelyx\/[^/]+)(\/.*)?$/.exec(specifier);
    if (!match) {
      // The checker ordinarily substitutes dist/*.d.ts for an explicit
      // relative JS import. Recover its supplied implementation, too, so a
      // declaration cannot create a second private class/type identity.
      if (specifier.startsWith('.')) {
        const candidate = path.resolve(path.dirname(containing), specifier),
          runtime = candidate.endsWith('.js')
            ? candidate
            : path.extname(candidate)
              ? null
              : candidate + '.js';
        if (runtime && fs.existsSync(runtime)) {
          const owner = ownerOf(runtime);
          if (owner?.manifest && slash(path.relative(owner.root, runtime)).startsWith('dist/'))
            return {
              body: mappedBody(owner, ownedFile(owner, runtime), specifier),
              route: 'emitted',
            };
        }
      }
      return null;
    }
    const owner = packages.get(match[1]);
    if (!owner) return null;
    const exported = owner.manifest.exports?.[match[2] ? '.' + match[2] : '.'];
    if (!exported) throw Error('Module is not a public package export: ' + specifier);
    const target =
      typeof exported === 'string' ? exported : (exported['react-native'] ?? exported.default);
    if (typeof target !== 'string' || !target.startsWith('./'))
      throw Error('No implementation export: ' + specifier);
    const runtime = path.resolve(owner.root, target);
    if (!inside(owner.root, runtime)) throw Error('Export escapes module owner: ' + specifier);
    ownedFile(owner, runtime);
    let body = runtime;
    const route = target.startsWith('./dist/') ? 'emitted' : 'source';
    if (/\.jsx?$/.test(runtime) && target.startsWith('./dist/')) {
      body = mappedBody(owner, runtime, specifier);
    } else if (!/(?<!\.d)\.tsx?$/.test(body))
      throw Error('Typed implementation source unavailable: ' + specifier);
    body = fs.realpathSync(body);
    if (!inside(owner.root, body))
      throw Error('Implementation link escapes module owner: ' + specifier);
    return { body, route };
  };
  const options = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    customConditions: ['react-native'],
    jsx: ts.JsxEmit.React,
    strict: true,
    esModuleInterop: true,
    allowImportingTsExtensions: true,
    resolveJsonModule: true,
    skipLibCheck: true,
    noEmit: true,
    types: [],
  };
  const host = ts.createCompilerHost(options),
    cache = ts.createModuleResolutionCache(application, host.getCanonicalFileName, options);
  const resolve = (specifier, containing) => {
    const key = containing + '\0' + specifier;
    if (resolutions.has(key)) return resolutions.get(key);
    const owned = sourceFor(specifier, containing),
      body = owned?.body;
    const resolved = body
      ? {
          resolvedFileName: body,
          extension: body.endsWith('.tsx') ? ts.Extension.Tsx : ts.Extension.Ts,
          isExternalLibraryImport: true,
          nelyxRoute: owned.route,
        }
      : ts.resolveModuleName(specifier, containing, options, host, cache).resolvedModule;
    resolutions.set(key, resolved);
    return resolved;
  };
  host.resolveModuleNames = (names, containing) => names.map((name) => resolve(name, containing));
  entry = fs.realpathSync(entry);
  if (!identity(entry)) throw Error('Entry has no module owner');
  const ambient = [];
  const declarations = (folder) => {
    if (!fs.existsSync(folder)) return;
    for (const item of fs.readdirSync(folder, { withFileTypes: true })) {
      if (item.isSymbolicLink()) throw Error('Ambient source link rejected');
      const file = path.join(folder, item.name);
      if (item.isDirectory()) declarations(file);
      else if (file.endsWith('.d.ts')) {
        ambient.push(file);
        if (ambient.length > 256) throw Error('Ambient source admission bound exceeded');
      }
    }
  };
  for (const owner of packages.values()) declarations(path.join(owner.root, 'src'));
  const rootNames = new Set([entry, ...ambient.sort()]);
  let program = ts.createProgram([...rootNames], options, host);
  // TS does not necessarily follow a declared require() in a TS body. Keep
  // literal dynamic dependencies in the implementation closure as well.
  for (let round = 0; ; round++) {
    const loaded = new Set(
        program.getSourceFiles().map((source) => path.resolve(source.fileName).toLowerCase()),
      ),
      additional = new Set();
    for (const source of program.getSourceFiles()) {
      if (source.isDeclarationFile || !identity(path.resolve(source.fileName))) continue;
      const discover = (node) => {
        if (
          ts.isCallExpression(node) &&
          (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
            (ts.isIdentifier(node.expression) && node.expression.text === 'require')) &&
          node.arguments.length === 1 &&
          ts.isStringLiteral(node.arguments[0])
        ) {
          const resolved = resolve(node.arguments[0].text, source.fileName),
            file = resolved?.resolvedFileName;
          if (
            file &&
            !file.endsWith('.d.ts') &&
            /\.tsx?$/.test(file) &&
            identity(path.resolve(file)) &&
            !loaded.has(path.resolve(file).toLowerCase())
          )
            additional.add(file);
        }
        ts.forEachChild(node, discover);
      };
      discover(source);
    }
    if (!additional.size) break;
    if (round >= 31 || rootNames.size + additional.size > maxModules + ambient.length)
      throw Error('Dynamic module closure exceeded source graph admission bound');
    for (const file of additional) rootNames.add(file);
    program = ts.createProgram([...rootNames], options, host, program);
  }
  const checker = program.getTypeChecker(),
    modules = [];
  for (const source of program.getSourceFiles()) {
    if (source.isDeclarationFile || !/(?<!\.d)\.tsx?$/.test(source.fileName)) continue;
    const file = fs.realpathSync(source.fileName),
      id = identity(file);
    if (!id) continue;
    if (modules.length >= maxModules) throw Error('Typed source graph module bound exceeded');
    const owner = ownerOf(file),
      imports = [],
      symbols = [],
      seenSymbols = new Set();
    const position = (node) => {
      const at = source.getLineAndCharacterOfPosition(node.getStart(source));
      return { offset: node.getStart(source), line: at.line + 1, column: at.character + 1 };
    };
    const boundary = (node, kind, detail) =>
      boundaries.push({ module: id, ...position(node), kind, detail });
    const addImport = (node, specifier, kind) => {
      const resolved = resolve(specifier, file),
        target = resolved && identity(fs.realpathSync(resolved.resolvedFileName));
      if (
        target &&
        !resolved.resolvedFileName.endsWith('.d.ts') &&
        /\.tsx?$/.test(resolved.resolvedFileName)
      )
        imports.push({
          specifier,
          kind,
          target,
          ...(resolved.nelyxRoute ? { route: resolved.nelyxRoute } : {}),
          ...position(node),
        });
      else boundary(node, resolved ? 'external-module' : 'unresolved-module', specifier);
    };
    const visit = (node) => {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        const clause = ts.isImportDeclaration(node) ? node.importClause : node;
        const specifiers = ts.isImportDeclaration(node) ? clause?.namedBindings : node.exportClause;
        const allTypeSpecifiers =
          specifiers &&
          (ts.isNamedImports(specifiers) || ts.isNamedExports(specifiers)) &&
          specifiers.elements.length > 0 &&
          specifiers.elements.every((item) => item.isTypeOnly);
        const typeOnly =
          clause?.isTypeOnly === true ||
          (allTypeSpecifiers && !(ts.isImportDeclaration(node) && clause?.name));
        addImport(node, node.moduleSpecifier.text, typeOnly ? 'type' : 'runtime');
        if (
          !typeOnly &&
          ts.isImportDeclaration(node) &&
          clause?.namedBindings &&
          ts.isNamedImports(clause.namedBindings) &&
          clause.namedBindings.elements.some((item) => item.isTypeOnly)
        )
          addImport(node, node.moduleSpecifier.text, 'type');
      }
      if (
        ts.isImportTypeNode(node) &&
        ts.isLiteralTypeNode(node.argument) &&
        ts.isStringLiteral(node.argument.literal)
      )
        addImport(node, node.argument.literal.text, 'type');
      if (ts.isCallExpression(node)) {
        if (
          node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === 'require')
        ) {
          if (node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0]))
            addImport(node, node.arguments[0].text, 'dynamic');
          else boundary(node, 'computed-module', 'Module target depends on runtime data');
        }
        if (ts.isIdentifier(node.expression) && node.expression.text === 'eval')
          boundary(node, 'eval', 'Runtime source evaluation');
      }
      if (
        ts.isNewExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'Proxy'
      )
        boundary(node, 'proxy', 'Observable dynamic property access');
      if (
        (ts.isClassDeclaration(node) || ts.isClassExpression(node)) &&
        node.heritageClauses?.some((clause) =>
          clause.types.some((type) => ts.isCallExpression(type.expression)),
        )
      )
        boundary(node, 'mixin', 'Runtime class factory requires identity closure');
      if (
        (ts.isFunctionDeclaration(node) ||
          ts.isClassDeclaration(node) ||
          ts.isMethodDeclaration(node) ||
          ts.isGetAccessor(node) ||
          ts.isSetAccessor(node) ||
          ts.isVariableDeclaration(node)) &&
        node.name &&
        ts.isIdentifier(node.name)
      ) {
        const symbol = checker.getSymbolAtLocation(node.name);
        if (symbol && !seenSymbols.has(symbol)) {
          seenSymbols.add(symbol);
          symbols.push({
            id: id + '#' + node.name.text + '@' + node.name.getStart(source),
            name: node.name.text,
            kind: ts.SyntaxKind[node.kind],
            type: checker.typeToString(checker.getTypeAtLocation(node.name)),
            ...position(node.name),
          });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    modules.push({
      id,
      owner: owner.name,
      sourceSha256: hash(fs.readFileSync(file)),
      imports: imports.sort((a, b) => a.offset - b.offset || a.kind.localeCompare(b.kind)),
      symbols: symbols.sort((a, b) => a.offset - b.offset),
    });
  }
  const moduleRoutes = new Map(modules.map((module) => [module.id, new Set()]));
  moduleRoutes.get(identity(entry))?.add('source');
  let changed = true;
  while (changed) {
    changed = false;
    for (const module of modules)
      for (const edge of module.imports) {
        if (edge.kind === 'type') continue;
        const target = moduleRoutes.get(edge.target);
        if (!target) continue;
        const incoming = edge.route
          ? [edge.route]
          : edge.specifier.startsWith('.')
            ? moduleRoutes.get(module.id)
            : [];
        for (const route of incoming)
          if (!target.has(route)) {
            target.add(route);
            changed = true;
          }
      }
  }
  for (const module of modules) {
    module.evaluationRoutes = [...moduleRoutes.get(module.id)].sort();
    const owner = owners.find((owner) => owner.name === module.owner),
      relative = module.id.slice(module.owner.length + 1),
      file = path.join(owner.root, relative);
    if (module.evaluationRoutes.includes('emitted') && relative.startsWith('src/'))
      Object.assign(
        module,
        origins.get(file) ??
          emittedOrigin(
            owner,
            file,
            path.join(owner.root, relative.replace(/^src\//, 'dist/').replace(/\.tsx?$/, '.js')),
          ),
      );
    if (module.evaluationRoutes.length > 1)
      boundaries.push({
        module: module.id,
        offset: 0,
        line: 1,
        column: 1,
        kind: 'multiple-evaluation-routes',
        detail:
          'Both supplied source and emitted JavaScript can evaluate this body; partition must preserve or reject the duplicate identity',
      });
  }
  modules.sort((a, b) => a.id.localeCompare(b.id));
  boundaries.sort(
    (a, b) =>
      a.module.localeCompare(b.module) || a.offset - b.offset || a.kind.localeCompare(b.kind),
  );
  const diagnostics = ts.getPreEmitDiagnostics(program).map((item) => ({
    code: item.code,
    category: ts.DiagnosticCategory[item.category],
    module: item.file
      ? (identity(path.resolve(item.file.fileName)) ?? slash(item.file.fileName))
      : null,
    offset: item.start ?? 0,
    message: ts.flattenDiagnosticMessageText(item.messageText, '\n'),
  }));
  const graph = {
    schema: 'nelyx.typed-source-graph/v1',
    checker: ts.version,
    checkerPackage: '@typescript/typescript6@6.0.2',
    checkerSha256: hash(fs.readFileSync(require.resolve('typescript'))),
    entry: identity(entry),
    modules,
    boundaries,
    diagnostics,
    runtimeComponents: components(modules, 'runtime'),
    typeComponents: components(modules, 'type'),
  };
  return { graph: { ...graph, sha256: hash(JSON.stringify(graph)) }, program, checker, owners };
}
export function inspectSourceGraph(options) {
  return buildSourceGraph(options).graph;
}
