import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import { shaderAssetImports } from './shader-assets.mjs';
import { runTypeScriptCompiler } from '../sdk/tooling/contracts/src/typescript-compiler.cjs';
import {
  buildStage,
  hashTree,
  readBuildState,
  writeBuildState,
} from '../sdk/tooling/cli/src/build-cache.mjs';
import { packageBuildInputs } from './package-build-inputs.mjs';
import { withSdkLock, workspaceRoot as root } from './sdk-lock.mjs';
// Package ownership comes from workspace manifests, not a fixed core/SDK list.
const workspace = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const directories = Object.fromEntries(
  workspace.workspaces.map((directory) => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(root, directory, 'package.json'), 'utf8'),
    );
    return [manifest.name.replace(/^@nelyx\//, ''), directory];
  }),
);
export function buildPackage(name, signal) {
  if (!directories[name]) throw new Error('Unknown workspace package: ' + name);
  const start = performance.now();
  const sdk = path.join(root, directories[name]),
    cache = path.join(sdk, '.cache');
  const output = path.join(sdk, 'dist'),
    state = path.join(cache, 'typescript-build.json');
  const inputs = () =>
    packageBuildInputs(root, sdk, [
      import.meta.filename,
      path.join(import.meta.dirname, 'package-build-inputs.mjs'),
      path.join(import.meta.dirname, 'shader-assets.mjs'),
      path.join(root, 'Nelyx/sdk/tooling/contracts/src/typescript-compiler.cjs'),
    ]);
  const project = inputs();
  const previous = readBuildState(state);
  let reason = previous ? 'TypeScript build inputs changed' : 'no previous TypeScript output';
  if (previous?.key === project.key) {
    if (
      fs.existsSync(output) &&
      JSON.stringify(hashTree(output)) === JSON.stringify(previous.output)
    ) {
      buildStage('typescript', start, {
        package: name,
        checks: 0,
        emits: 0,
        reason: 'verified dist reused',
      });
      return;
    }
    reason = 'dist files missing or changed';
  }
  signal?.throwIfAborted();
  const disk = fs.statfsSync(sdk, { bigint: true });
  if (disk.bavail * disk.bsize < 20n * 1024n * 1024n * 1024n)
    throw new Error(
      'Package build requires at least 20 GiB of free space; clean temporary outputs before retrying.',
    );
  fs.mkdirSync(cache, { recursive: true });
  const staged = fs.mkdtempSync(path.join(cache, 'sdk-'));
  const backup = path.join(cache, 'last-' + path.basename(staged));
  function insideSdk(file) {
    const relative = path.relative(sdk, path.resolve(file));
    if (relative.startsWith('..') || path.isAbsolute(relative))
      throw new Error('Build path outside SDK');
    let current = path.resolve(file);
    while (current !== sdk) {
      if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink())
        throw new Error('SDK build path symlink rejected');
      current = path.dirname(current);
    }
    return file;
  }
  function filesIn(directory) {
    const files = [];
    const visit = (folder) => {
      for (const item of fs.readdirSync(folder, { withFileTypes: true })) {
        const file = insideSdk(path.join(folder, item.name));
        if (item.isSymbolicLink()) throw new Error('Unexpected link in SDK output');
        if (item.isDirectory()) visit(file);
        else files.push(path.relative(directory, file));
      }
    };
    visit(directory);
    return new Set(files);
  }
  function copyTree(source, target) {
    insideSdk(source);
    insideSdk(target);
    const wanted = filesIn(source),
      previous = fs.existsSync(target) ? filesIn(target) : new Set();
    fs.cpSync(source, target, { recursive: true });
    for (const relative of previous)
      if (!wanted.has(relative)) fs.unlinkSync(insideSdk(path.join(target, relative)));
  }
  // TypeScript rewrites JavaScript imports, but declarations also need explicit .js paths for standard ESM consumers.
  function declarationImportPaths(context) {
    const factory = context.factory;
    const rewrite = (specifier) => {
      if (
        !specifier ||
        !ts.isStringLiteral(specifier) ||
        !specifier.text.startsWith('.') ||
        !/\.tsx?$/.test(specifier.text) ||
        specifier.text.endsWith('.d.ts')
      )
        return specifier;
      return ts.setOriginalNode(
        ts.setTextRange(
          factory.createStringLiteral(specifier.text.replace(/\.tsx?$/, '.js')),
          specifier,
        ),
        specifier,
      );
    };
    const visit = (node) => {
      if (ts.isImportDeclaration(node))
        return factory.updateImportDeclaration(
          node,
          node.modifiers,
          node.importClause,
          rewrite(node.moduleSpecifier),
          node.attributes,
        );
      if (ts.isExportDeclaration(node))
        return factory.updateExportDeclaration(
          node,
          node.modifiers,
          node.isTypeOnly,
          node.exportClause,
          rewrite(node.moduleSpecifier),
          node.attributes,
        );
      if (
        ts.isImportTypeNode(node) &&
        ts.isLiteralTypeNode(node.argument) &&
        ts.isStringLiteral(node.argument.literal)
      )
        return factory.updateImportTypeNode(
          node,
          factory.updateLiteralTypeNode(node.argument, rewrite(node.argument.literal)),
          node.attributes,
          node.qualifier,
          node.typeArguments,
          node.isTypeOf,
        );
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'require' &&
        node.arguments.length === 1
      )
        return factory.updateCallExpression(node, node.expression, node.typeArguments, [
          rewrite(node.arguments[0]),
        ]);
      return ts.visitEachChild(node, visit, context);
    };
    return (node) => ts.visitNode(node, visit);
  }
  function compile(config, options) {
    // Native TS 7 admits the actual project before the compatibility API performs
    // the existing shader/declaration AST transforms and emit.
    const nativeConfig = path.join(staged, 'native-check.json');
    try {
      fs.writeFileSync(
        nativeConfig,
        JSON.stringify({
          extends: path.join(sdk, config),
          compilerOptions: { ...options, noEmit: true },
        }),
      );
      const checked = runTypeScriptCompiler(
        root,
        ['-p', nativeConfig, '--pretty', 'false'],
        '@typescript/native',
      );
      if (checked.status !== 0) throw Error(checked.stdout + checked.stderr);
    } finally {
      if (fs.existsSync(nativeConfig)) fs.unlinkSync(nativeConfig);
    }
    const { fileNames, options: compiler } = project.parsed;
    const program = ts.createProgram(fileNames, {
      ...compiler,
      ...options,
      noEmitOnError: true,
      inlineSources: true,
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    if (diagnostics.length)
      throw new Error(
        ts.formatDiagnosticsWithColorAndContext(diagnostics, {
          getCanonicalFileName: (x) => x,
          getCurrentDirectory: () => sdk,
          getNewLine: () => '\n',
        }),
      );
    const emitted = program.emit(undefined, undefined, undefined, false, {
      before: [shaderAssetImports(sdk), declarationImportPaths],
      afterDeclarations: [declarationImportPaths],
    });
    if (emitted.emitSkipped) throw new Error('SDK emit skipped');
  }
  function finalizeOutput(directory) {
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, item.name);
      if (item.isDirectory()) finalizeOutput(file);
      else if (item.name.endsWith('.js')) {
        if (!fs.existsSync(file.replace(/\.js$/, '.d.ts')) || !fs.existsSync(file + '.map'))
          throw new Error('ESM output requires its declaration and source map: ' + file);
        const map = JSON.parse(fs.readFileSync(file + '.map', 'utf8'));
        if (map.version !== 3 || !Array.isArray(map.sources) || !map.sources.length)
          throw new Error('Invalid emitted ESM source map: ' + file);
      }
    }
  }

  try {
    compile('tsconfig.build.json', { outDir: staged });
    finalizeOutput(staged);
    // Restore source-map paths after the generated tree moves from staging to dist.
    const visit = (directory) => {
      for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, item.name);
        if (item.isDirectory()) visit(file);
        else if (item.name.endsWith('.map')) {
          const map = JSON.parse(fs.readFileSync(file, 'utf8'));
          const final = path.join(output, path.relative(staged, file));
          map.sources = map.sources.map((source) =>
            path
              .relative(path.dirname(final), path.resolve(path.dirname(file), source))
              .replaceAll('\\', '/'),
          );
          fs.writeFileSync(file, JSON.stringify(map));
        }
      }
    };
    visit(staged);
    if (project.key !== inputs().key)
      throw Error('TypeScript inputs changed while building @nelyx/' + name);
    const inventory = hashTree(staged);
    signal?.throwIfAborted();
    insideSdk(backup);
    insideSdk(staged);
    insideSdk(output);
    let directoryLocked = false;
    if (fs.existsSync(output)) {
      try {
        fs.renameSync(output, backup);
      } catch (error) {
        if (!['EPERM', 'EACCES'].includes(error.code)) throw error;
        // Windows editor directory handles can prevent a directory rename while
        // allowing file updates. Compile/validate everything first; keep a temporary
        // backup for rollback and remove it when this attempt finishes.
        fs.cpSync(output, backup, { recursive: true });
        directoryLocked = true;
      }
    }
    if (directoryLocked) {
      try {
        copyTree(staged, output);
      } catch (error) {
        copyTree(backup, output);
        throw error;
      }
    } else
      try {
        fs.renameSync(staged, output);
      } catch (error) {
        if (['EPERM', 'EACCES'].includes(error.code)) {
          try {
            copyTree(staged, output);
          } catch (copyError) {
            if (fs.existsSync(backup)) copyTree(backup, output);
            throw copyError;
          }
        } else {
          if (fs.existsSync(backup)) fs.renameSync(backup, output);
          throw error;
        }
      }
    writeBuildState(state, { key: project.key, output: inventory });
    buildStage('typescript', start, { package: name, checks: 2, emits: 1, reason });
  } finally {
    for (const temporary of [staged, backup])
      try {
        /* oxlint-disable no-unsafe-finally -- Reject cleanup when directory ownership or rollback safety cannot be established. */
        if (
          path.dirname(temporary) !== cache ||
          !/^(?:sdk-|last-sdk-)/.test(path.basename(temporary))
        )
          throw new Error('Unexpected build cleanup target');
        /* oxlint-enable no-unsafe-finally */
        if (fs.existsSync(temporary)) {
          insideSdk(temporary);
          filesIn(temporary);
          fs.rmSync(temporary, { recursive: true, maxRetries: 3, retryDelay: 100 });
        }
      } catch (error) {
        console.error('Build temporary cleanup failed: ' + String(error));
        process.exitCode = 1;
      }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename)
  await withSdkLock(() => buildPackage(process.argv[2] ?? 'core'));
