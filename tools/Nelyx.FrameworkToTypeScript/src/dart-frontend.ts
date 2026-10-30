// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { contentCache, contentHash, stableJson, treeIdentity } from './content-cache.ts';
import type { BodyIr } from './body-ir.ts';
import { dartDirectiveUris } from './dart-directives.ts';

const tool = path.resolve(import.meta.dir, '..'),
  repository = path.resolve(tool, '../..');
export const portCacheRoot = path.join(repository, '.tmp/work8/port-cache/v1');
export const getPortCacheRoot = () =>
  process.env.NELYX_PORT_CACHE_ROOT
    ? path.resolve(process.env.NELYX_PORT_CACHE_ROOT)
    : portCacheRoot;
export interface DartRequest {
  source: string;
  sha256: string;
  symbols: string[];
  packagePin?: unknown;
  library?: string;
  librarySha256?: string;
}
export const dartRequestSources = (requests: DartRequest[]) =>
  [
    ...new Set(
      requests.flatMap((request) => [
        request.source,
        ...(request.library ? [request.library] : []),
      ]),
    ),
  ].sort();
const analysisFile = (file: string) =>
  /\.(dart|yaml|yml)$/.test(file) || path.basename(file) === 'pubspec.lock';
function fileHash(file: string) {
  return fs.existsSync(file) ? contentHash(fs.readFileSync(file)) : null;
}
/** Conservative closure: every source/configuration in the analyzed root,
 * configured package libraries, the SDK libraries, and frontend implementation.
 * Paths remain part of the identity; cache reuse never aliases source checkouts. */
export function dartAnalysisIdentity(
  sourceRoot: string,
  dart: string,
  requestSources?: string[],
): unknown {
  const root = fs.realpathSync(sourceRoot),
    executable = fs.realpathSync(dart),
    sdk = path.dirname(path.dirname(executable)),
    configFile = path.join(tool, 'dart/.dart_tool/package_config.json');
  if (fs.existsSync(path.join(root, '.dart_tool/package_config.json')))
    throw new Error('Source analysis configuration already owned by another analyzer');
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8')) as {
    packages: { name: string; rootUri: string; packageUri?: string }[];
  };
  const packages = config.packages.map((item) => {
    const packageRoot = fs.realpathSync(
      fileURLToPath(new URL(item.rootUri, pathToFileURL(configFile))),
    );
    return {
      name: item.name,
      root: packageRoot,
      manifest: fileHash(path.join(packageRoot, 'pubspec.yaml')),
      sources: treeIdentity(path.resolve(packageRoot, item.packageUri ?? 'lib')),
    };
  });
  // Follow analysis option includes as well, including files outside the root.
  const included: Record<string, string> = {},
    seen = new Set<string>();
  function options(file: string) {
    if (!fs.existsSync(file) || seen.has(file)) return;
    seen.add(file);
    included[file] = contentHash(fs.readFileSync(file));
    const value = Bun.YAML.parse(fs.readFileSync(file, 'utf8')) as {
      include?: string | string[];
    } | null;
    for (const include of typeof value?.include === 'string'
      ? [value.include]
      : (value?.include ?? [])) {
      if (include.startsWith('package:')) {
        const match = /^package:([^/]+)\/(.+)$/.exec(include),
          item = match && config.packages.find((item) => item.name === match[1]);
        if (!match || !item) throw new Error('Unresolved analysis options include: ' + include);
        const base = fileURLToPath(new URL(item.rootUri, pathToFileURL(configFile)));
        options(path.resolve(base, item.packageUri ?? 'lib', match[2]!));
      } else options(path.resolve(path.dirname(file), include));
    }
  }
  const sources = treeIdentity(root, analysisFile, new Set(['.git', '.dart_tool']));
  for (const file of Object.keys(sources))
    if (path.basename(file) === 'analysis_options.yaml') options(path.join(root, file));
  for (let parent = path.dirname(root); ; parent = path.dirname(parent)) {
    options(path.join(parent, 'analysis_options.yaml'));
    if (path.dirname(parent) === parent) break;
  }
  const externalSources: Record<string, string | null> = {},
    visited = new Set<string>();
  const owned = [
    root,
    path.join(sdk, 'lib'),
    ...config.packages.map((item) =>
      path.resolve(
        fileURLToPath(new URL(item.rootUri, pathToFileURL(configFile))),
        item.packageUri ?? 'lib',
      ),
    ),
  ];
  const withinOwner = (file: string) =>
    owned.some((base) => {
      const relative = path.relative(base, file);
      return (
        relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative)
      );
    });
  function targetOf(uri: string, origin: string): string | undefined {
    if (uri.startsWith('dart:')) return; // Full SDK and both embedded engine trees are inventoried.
    if (uri.startsWith('package:')) {
      const match = /^([^/]+)\/(.+)$/.exec(new URL(uri).pathname);
      if (!match) return;
      const relative = decodeURIComponent(match[2]!);
      if (match[1] === 'flutter' || match[1] === 'flutter_localizations')
        return path.resolve(root, 'packages', match[1], 'lib', relative);
      const item = config.packages.find((item) => item.name === match[1]);
      if (!item) return;
      return path.resolve(
        fileURLToPath(new URL(item.rootUri, pathToFileURL(configFile))),
        item.packageUri ?? 'lib',
        relative,
      );
    }
    const resolved = new URL(uri, pathToFileURL(origin));
    if (resolved.protocol !== 'file:') throw new Error('Untracked Dart directive URI: ' + uri);
    return fileURLToPath(resolved);
  }
  function directives(file: string) {
    if (visited.has(file)) return;
    visited.add(file);
    if (!fs.existsSync(file)) {
      externalSources[file] = null;
      return;
    }
    if (!fs.statSync(file).isFile()) {
      externalSources[file] = 'directory';
      return;
    }
    const actual = fs.realpathSync(file),
      canonical = (value: string) => (process.platform === 'win32' ? value.toLowerCase() : value);
    if (canonical(actual) !== canonical(path.resolve(file)))
      throw new Error('Linked Dart directive input rejected: ' + file);
    const bytes = fs.readFileSync(file);
    if (!withinOwner(file)) externalSources[file] = contentHash(bytes);
    for (const uri of dartDirectiveUris(bytes.toString('utf8'))) {
      const target = targetOf(uri, file);
      if (target) directives(target);
    }
  }
  for (const source of requestSources ??
    Object.keys(sources).filter((file) => file.endsWith('.dart'))) {
    const target = source.startsWith('package:')
      ? targetOf(source, path.join(root, 'request.dart'))
      : path.resolve(root, source);
    if (target) directives(target);
  }
  return {
    schema: 'nelyx.dart-analysis-inputs/v1',
    root,
    requestSources,
    executable,
    sdk,
    executableSha256: fileHash(executable),
    sdkVersion: fileHash(path.join(sdk, 'version')),
    sdkLibraries: treeIdentity(path.join(sdk, 'lib')),
    sdkRuntime: treeIdentity(path.join(sdk, 'bin')),
    frontend: fileHash(path.join(tool, 'dart/bin/body_ir.dart')),
    cacheImplementation: [
      fileHash(import.meta.path),
      fileHash(path.join(tool, 'src/content-cache.ts')),
      fileHash(path.join(tool, 'src/dart-directives.ts')),
    ],
    lock: fileHash(path.join(tool, 'dart/pubspec.lock')),
    pubspec: fileHash(path.join(tool, 'dart/pubspec.yaml')),
    packageConfiguration: fileHash(configFile),
    packages,
    sources,
    includedOptions: included,
    externalSources,
  };
}
export function analyzeDart(options: {
  sourceRoot: string;
  dart: string;
  requestFile: string;
  irFile: string;
  cacheRoot?: string;
  identity?: unknown;
  enabled?: boolean;
}) {
  const started = performance.now(),
    requests = JSON.parse(fs.readFileSync(options.requestFile, 'utf8')) as DartRequest[],
    identity =
      options.identity ??
      dartAnalysisIdentity(options.sourceRoot, options.dart, dartRequestSources(requests));
  if (!Array.isArray(requests) || requests.some((request) => !Array.isArray(request.symbols)))
    throw new Error('Invalid Dart analysis request');
  const validate = (artifacts: Record<string, Buffer>) => {
    if (Object.keys(artifacts).length !== 1 || !artifacts['body-ir.json'])
      throw new Error('Invalid IR cache artifacts');
    const ir = JSON.parse(artifacts['body-ir.json'].toString()) as BodyIr,
      expected = requests.flatMap((request) =>
        request.symbols.map((symbol) => ({ request, symbol })),
      );
    if (
      ir.schema !== 'nelyx.resolved-body-ir/v1' ||
      !Array.isArray(ir.records) ||
      ir.records.length !== expected.length
    )
      throw new Error('Invalid cached body IR schema/record count');
    expected.forEach(({ request, symbol }, index) => {
      const record = ir.records[index]!;
      if (
        record.source !== request.source ||
        record.symbol !== symbol ||
        record.sourceSha256 !== request.sha256 ||
        Boolean(record.ir) === Boolean(record.diagnostic)
      )
        throw new Error('Cached body IR request identity differs');
    });
  };
  const cached = contentCache(
    {
      root: options.cacheRoot ?? getPortCacheRoot(),
      namespace: 'dart-ir',
      identity: { analysis: identity, requests },
      ...(options.enabled === undefined ? {} : { enabled: options.enabled }),
    },
    () => {
      const result = spawnSync(
        options.dart,
        [
          path.join(tool, 'dart/bin/body_ir.dart'),
          options.sourceRoot,
          options.requestFile,
          options.irFile,
        ],
        {
          cwd: path.join(tool, 'dart'),
          env: process.env,
          encoding: 'utf8',
          windowsHide: true,
          timeout: 1200000,
          maxBuffer: 32 * 1024 * 1024,
        },
      );
      if (result.error || result.status !== 0)
        throw new Error(
          `Dart analysis exited ${result.status}: ${result.error?.message ?? ''}\n${result.stdout}\n${result.stderr}`,
        );
      if (
        stableJson(
          dartAnalysisIdentity(options.sourceRoot, options.dart, dartRequestSources(requests)),
        ) !== stableJson(identity)
      )
        throw new Error('Dart analysis inputs changed while resolving');
      return { 'body-ir.json': fs.readFileSync(options.irFile) };
    },
    validate,
  );
  // A hit must obey the frontend's single-owner admission too.
  if (fs.existsSync(path.join(options.sourceRoot, '.dart_tool/package_config.json')))
    throw new Error('Source analysis configuration already owned by another analyzer');
  fs.mkdirSync(path.dirname(options.irFile), { recursive: true });
  fs.writeFileSync(options.irFile, cached.artifacts['body-ir.json']!);
  return { ...cached.report, elapsedMs: Math.round(performance.now() - started) };
}
