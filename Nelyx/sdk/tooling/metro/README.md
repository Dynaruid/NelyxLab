# Nelyx Metro

**English** | [한국어](README.ko.md)

`@nelyx/metro` provides Metro configuration, asset preparation, Web bundles, and development servers for Nelyx's independent platform runners. Use Node.js **>=24.3.0 <25**. The [CLI](../cli/README.md) owns explicit build and development operations.

## Modules

| Import | Purpose |
| --- | --- |
| `@nelyx/metro/runner-config` | Native runner configuration and dependency-cohort checks |
| `@nelyx/metro/rn-config` | Native Metro resolution and transforms |
| `@nelyx/metro/babel-config` | Shared native Babel configuration |
| `@nelyx/metro/assets` | Asset materialization and validation |
| `@nelyx/metro/web-config` | Web runner configuration |
| `@nelyx/metro/web-build` | Web output, assets, and runtime files |
| `@nelyx/metro/web-development` | Web development server |
| `@nelyx/metro/web-refresh` | Web refresh integration |
| `@nelyx/metro/runtime-inventory` | Inspect the installed Windows Metro source graph |

Use direct subpath imports; see [package.json](package.json) for all exports.

## Runner configuration

A Windows `metro.config.cjs`:

```js
const path = require('node:path');
const {createRunnerConfig} = require('@nelyx/metro/runner-config');

module.exports = createRunnerConfig({
  target: 'windows',
  runnerRoot: __dirname,
  appRoot: path.resolve(__dirname, '../..'),
});
```

Native `babel.config.cjs` uses `module.exports = require('@nelyx/metro/babel-config')`. For Web, use `createWebRunnerConfig({runnerRoot, appRoot})` from `@nelyx/metro/web-config`.

The sample's [Windows](../../../../sample/nelyx-testbed-app-2/windows/runner/metro.config.cjs) and [Web](../../../../sample/nelyx-testbed-app-2/web/runner/metro.config.cjs) configurations show the complete setup. Each runner owns its dependencies and registration code; common UI stays in the application's `src/`.

Engine-specific transforms are selected through runner/CLI configuration. Keep custom Babel plugins in the runner's `babel.config.cjs` and preserve the selected engine policy when composing transformers.

## Assets and local packages

Declare assets under root `package.json` → `nelyx.assets`. Tooling calculates omitted asset/notice hashes into generated `runner/app-config.json`; explicit hashes are checked.

`materializeAppAssets(appRoot, assets, resolveModule)` copies missing assets declared with `packageSource` from installed packages. It verifies the exported asset and notice bytes and reports edited destination files as conflicts. Use the runner's module resolver.

After supplying new local archives, run `npm ci --workspaces=false` in the runner and restart Metro. Equal package versions can contain different bytes, so runner checks also verify installed archive identity.

## Runtime inventory

`inspectRuntimeInventory({runner, appRoot, signal})` inspects the installed Windows Release serializer, module graph, startup calls, and source maps. It returns an in-memory syntactic inventory for Static AOT tooling; it does not compile or publish an application. Custom serializers and incompatible Metro versions are rejected.

## Check declarations

From the repository root, after `npm ci`:

```powershell
npm run check:metro-types
```

Use the [Testbed guide](../../../../sample/nelyx-testbed-app-2/README.md) to build or serve a runner.

## License

Nelyx-authored code uses [BSD-3-Clause](LICENSE.md). Imported notices remain in [licenses/](licenses/).
