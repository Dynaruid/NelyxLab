// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { sha256 } from '../sdk/tooling/contracts/src/node-files.mjs';
import { fingerprint, hashTree } from '../sdk/tooling/cli/src/build-cache.mjs';

const declaration = (file) => /\.d\.[cm]?ts$/.test(file);
const compilerDirectory = '@typescript/typescript-' + process.platform + '-' + process.arch;
let tools;

export function packageBuildInputs(root, directory, scripts) {
  const config = path.join(directory, 'tsconfig.build.json');
  const configs = new Map();
  const host = {
    ...ts.sys,
    readFile(file) {
      const text = ts.sys.readFile(file);
      if (text !== undefined) configs.set(file, text);
      return text;
    },
  };
  const read = ts.readConfigFile(config, host.readFile);
  const parsed = ts.parseJsonConfigFileContent(read.config ?? {}, host, directory, {}, config);
  const errors = [read.error, ...parsed.errors].filter(Boolean);
  if (errors.length)
    throw Error(
      ts.formatDiagnostics(errors, {
        getCurrentDirectory: () => directory,
        getCanonicalFileName: (file) => file,
        getNewLine: () => '\n',
      }),
    );
  const manifestFile = path.join(directory, 'package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const modules = path.join(root, 'node_modules');
  const dependencies = new Set([
    ...Object.keys({
      ...manifest.dependencies,
      ...manifest.peerDependencies,
      ...manifest.devDependencies,
    }),
    ...ts.getAutomaticTypeDirectiveNames(parsed.options, ts.sys).map((name) => '@types/' + name),
  ]);
  const typeInputs = new Map();
  function addTypes(packageName) {
    if (typeInputs.has(packageName)) return;
    const packageFile = path.join(modules, packageName, 'package.json');
    if (!fs.existsSync(packageFile)) return;
    const packageRoot = fs.realpathSync(path.dirname(packageFile));
    const metadata = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
    const typesRoot = packageName.startsWith('@nelyx/')
      ? path.join(packageRoot, 'dist')
      : packageRoot;
    typeInputs.set(packageName, [
      sha256(packageFile),
      fs.existsSync(typesRoot) ? hashTree(typesRoot, declaration) : [],
    ]);
    for (const name of Object.keys(metadata.dependencies ?? {}))
      if (name.startsWith('@types/') || !packageName.startsWith('@nelyx/')) addTypes(name);
    if (!packageName.startsWith('@') && fs.existsSync(path.join(modules, '@types', packageName)))
      addTypes('@types/' + packageName);
  }
  for (const name of dependencies) addTypes(name);
  tools ??= ['typescript', '@typescript/old', '@typescript/native', compilerDirectory].map(
    (name) => {
      const directory = path.join(modules, name);
      return [name, fs.existsSync(directory) ? hashTree(directory) : null];
    },
  );
  const shaders = path.join(directory, 'assets', 'shaders');
  const inputs = {
    tools,
    node: process.version,
    typescript: ts.version,
    config: [...configs].sort(([a], [b]) => a.localeCompare(b)),
    manifest: sha256(manifestFile),
    sources: parsed.fileNames.sort().map((file) => [file, sha256(file)]),
    dependencies: [...typeInputs].sort(([a], [b]) => a.localeCompare(b)),
    shaders: fs.existsSync(shaders) ? hashTree(shaders) : [],
    scripts: scripts.map((file) => sha256(file)),
  };
  return { parsed, key: fingerprint(inputs) };
}
