// SPDX-License-Identifier: BSD-3-Clause
'use strict';
const path = require('node:path');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { createRequire } = require('node:module');
const nativePreset = require('./native-es2022-preset.cjs');
module.exports.createNativeTransformer = (engine, policy) => {
  const result = { compilerPolicy: policy };
  result.getCacheKey = () =>
    createHash('sha256')
      .update(require('@react-native/babel-preset').getCacheKey())
      .update(engine)
      .update(policy)
      .update(readFileSync(__filename))
      .update(readFileSync(require.resolve('./native-es2022-preset.cjs')))
      .update(readFileSync(require.resolve('./babel-config.cjs')))
      .update(readFileSync(require.resolve('./hermes-loop-tdz.cjs')))
      .update(readFileSync(require.resolve('./hermes-block-scoping.cjs')))
      .digest('hex');

  result.transform = ({ src, filename, options, plugins = [] }) => {
    if (options.platform !== 'windows')
      throw Error(
        engine === 'v8'
          ? 'The native V8 transformer requires the Windows V8 cohort'
          : engine === 'jsc'
            ? 'The native JSC transformer requires the Windows JSC cohort'
            : 'Static Hermes native syntax requires the Windows cohort',
      );
    const projectRoot = path.resolve(options.projectRoot),
      load = createRequire(path.join(projectRoot, 'package.json'));
    const babel = load('@babel/core'),
      rnPreset = load('@react-native/babel-preset');
    // Load consumer Babel configuration through Babel itself. Compose normalized
    // items instead of replacing the user's aliases, env/overrides or plugins.
    // No process-global BABEL_ENV or first-run Metro config cache is mutated.
    const partial = babel.loadPartialConfig({
      cwd: projectRoot,
      filename,
      sourceType: 'unambiguous',
      envName: options.dev ? 'development' : process.env.BABEL_ENV || 'production',
      babelrc: options.enableBabelRCLookup ?? true,
      ...(options.extendsBabelConfigPath
        ? { extends: path.resolve(projectRoot, options.extendsBabelConfigPath) }
        : {}),
      caller: {
        name: 'metro',
        bundler: 'metro',
        platform: options.platform,
        nelyxJavaScriptEngine: engine,
      },
      plugins,
    });
    if (!partial) return { ast: null };
    const presetOptions = {
      ...options,
      projectRoot,
      nativeJavaScriptEngine: engine,
      disableImportExportTransform: options.experimentalImportSupport,
      enableBabelRuntime: options.enableBabelRuntime,
    };
    const modern = (item) =>
      babel.createConfigItem([nativePreset, { ...presetOptions, ...item?.options, projectRoot }], {
        type: 'preset',
        dirname: item?.dirname ?? projectRoot,
      });
    const hasRnPreset = partial.options.presets.some((item) => item.value === rnPreset);
    const presets = partial.options.presets.map((item) =>
      item.value === rnPreset ? modern(item) : item,
    );
    // A per-directory .babelrc augments the RN fallback; it is not the root
    // replacement configuration. Preserve Flow parsing when it only adds plugins.
    const rootConfig =
      partial.config ||
      options.extendsBabelConfigPath ||
      (partial.babelrc && path.dirname(partial.babelrc) === projectRoot);
    if (!rootConfig && !hasRnPreset) presets.unshift(modern());
    const configuredPlugins = [...partial.options.plugins];
    if (options.dev && options.hot && !filename.includes('node_modules')) {
      const presetLoad = createRequire(load.resolve('@react-native/babel-preset/package.json'));
      for (const plugin of presetLoad('./src/configs/hmr')().plugins) {
        const item = babel.createConfigItem(plugin, { type: 'plugin', dirname: projectRoot });
        if (!configuredPlugins.some((previous) => previous.value === item.value))
          configuredPlugins.push(item);
      }
    }
    // Normalized items already include root/extended/overridden configuration.
    // Prevent a second filesystem load from applying the legacy RN preset again.
    let result = babel.transformSync(src, {
      ...partial.options,
      babelrc: false,
      configFile: false,
      ast: true,
      code: false,
      cloneInputAst: false,
      presets,
      plugins: configuredPlugins,
    });
    // TDZ validation must see React calls, rather than JSXIdentifier reference
    // paths. Babel's block-scoping visitor cannot build an expression from a
    // JSXIdentifier. Keep TDZ/loop capture checks in a separate, ordered pass.
    if (result && engine === 'hermes') {
      const presetLoad = createRequire(load.resolve('@react-native/babel-preset/package.json'));
      const prepared = babel.transformFromAstSync(result.ast, src, {
        babelrc: false,
        configFile: false,
        ast: true,
        code: false,
        cloneInputAst: true,
        plugins: [require('./hermes-loop-tdz.cjs')],
      });
      // Block-scoping's TDZ transform assumes destructuring has already been
      // lowered. Otherwise it emits a destructuring sentinel initialized from
      // undefined and resets the loop's assigned values in its body. Preserve
      // the original loop-head RHS environment before lowering its patterns.
      const destructured = babel.transformFromAstSync(prepared.ast, src, {
        babelrc: false,
        configFile: false,
        ast: true,
        code: false,
        cloneInputAst: true,
        plugins: [[presetLoad('@babel/plugin-transform-destructuring'), { useBuiltIns: true }]],
      });
      const lowered = babel.transformFromAstSync(destructured.ast, src, {
        babelrc: false,
        configFile: false,
        ast: true,
        code: false,
        cloneInputAst: true,
        plugins: [[require('./hermes-block-scoping.cjs'), { projectRoot }]],
      });
      result = { ...result, ast: lowered.ast };
    }
    return result ? { ast: result.ast, metadata: result.metadata } : { ast: null };
  };

  return result;
};
