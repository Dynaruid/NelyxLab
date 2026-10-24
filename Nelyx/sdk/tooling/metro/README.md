# Nelyx Metro

**English** | [한국어](README.ko.md)

`@nelyx/metro` supplies Metro configuration, asset validation, Web bundles, and development servers for independent platform runners. Use Node.js **>=24.3.0 <25**. The [CLI](../cli/README.md) manages explicit build/development operations.

Asset and notice `sha256` fields are optional and are omitted from the starter configuration. Runner preparation, type checking and Metro startup calculate them from the current files and write portable runtime metadata to generated `runner/app-config.json`; they never add hashes to the root package. Each runner main validates that generated asset metadata before registration. Package assets are compared with their installed source bytes before copying, and existing edited destinations are preserved and rejected. Explicit hash pins, when supplied, are still checked.

## Modules

| Import | Purpose |
| --- | --- |
| `@nelyx/metro/runner-config` | Inspect RN runner cohorts and generate Metro/TypeScript configuration |
| `@nelyx/metro/rn-config` | Configure native Metro resolution and transforms |
| `@nelyx/metro/babel-config` | Lower product ES2022 static blocks before the runner's RN class transforms |
| `@nelyx/metro/assets` | Validate application assets |
| `@nelyx/metro/web-config` | Configure Web Metro resolution |
| `@nelyx/metro/web-build` | Build Web output, assets, and runtime files |
| `@nelyx/metro/web-development` | Serve Web development output |
| `@nelyx/metro/web-refresh` | Web refresh integration |

Import the module directly. RN presets receive the selected target's runner root and exact dependency cohort. Shared app code stays in `src/`; each runner's `main.ts` performs platform registration.

Windows V8 and Static Hermes share the native ES2022 frontend and consumer
Babel configuration. The qualified Hermes pin retains async-generator and
lexical-scope lowering. JSX and destructuring run before TDZ validation; loop RHS bindings keep
their uninitialized environment and assignment order. The Static AOT adapter
guards eligible scalar entries and captures pinned Metro elimination provenance
before the standard worker owns wrapping, dependencies and Release folding.

For Windows/macOS, the pre-main `InitializeCore` path belongs to the selected RNW/RN-macOS facade. Metro compares these absolute paths to its graph without using the resolver alias. The runner initializes the facade first, removes the duplicate base RN initializer and retains additional caller hooks so AppRegistry starts with the platform's performance/timer setup.

For supplied local Nelyx archives, runner inspection compares the manifest's archive paths and SHA-512 integrity with npm's installed lock receipt. Supply refreshes the lockfile; run `npm ci --workspaces=false` in the runner to install it before building or starting Metro. Equal package versions do not establish equal archive contents. Explicit development `packageRoots` retain their source ownership mapping; registry dependencies use the existing cohort checks.

## Runner configuration

`@nelyx/metro/runtime-inventory` exports `inspectRuntimeInventory({runner,
appRoot, signal})` for W15A investigation. It observes the installed Windows
Release serializer, including pre-main/polyfills, the module loader, actual
serialized module IDs/dependencies and generated startup calls. It verifies
the exact graph/source-map module correspondence and recovers owned TypeScript
implementations through installed source maps. It returns an in-memory
syntactic inventory from `@nelyx/static-aot/runtime-inventory`; it does not
compile, publish a bundle, or qualify typed native coverage. Custom serializers
and unqualified Metro versions are rejected. Cancellation is checked at build
boundaries; interrupting an in-flight compiler/build is a later W15A gate.

Native runners use `createRunnerConfig({target, runnerRoot, appRoot})` from `@nelyx/metro/runner-config`. See the sample's [Windows config](../../../../sample/nelyx-testbed-app-2/windows/runner/metro.config.cjs) and [Web config](../../../../sample/nelyx-testbed-app-2/web/runner/metro.config.cjs) for complete examples.

The runner owns Metro/Babel configuration and dependencies. Normal builds validate supply ABI, asset hashes, source maps, and module boundaries. SDK runtime imports do not start Metro or a build; the CLI's explicit `dev`/`build` operations own tooling lifetime.

Native `babel.config.cjs` uses `module.exports=require('@nelyx/metro/babel-config')`. The shared configuration uses the runner's selected `@react-native/babel-preset` at the config root. After updating local archives, resupply and reinstall the runner before restarting Metro.

Windows V8 builds use `@nelyx/metro/native-v8-transformer`. For explicit Metro development or tooling, select `createRunnerConfig({target:'windows', runnerRoot, appRoot, javaScriptEngine:'v8'})`. The pinned RN0.83.10 preset retains native ES2022 classes, fields, private members, lexical scopes, destructuring and async/generators while preserving RN Flow/JSX/modules, consumer Babel configuration and development refresh. Build acknowledgements and current Windows package manifests carry `v8CompilerPolicy=nelyx.v8-native-es2022-rn0.83.10/v2`; the CLI rejects an older builder acknowledgement before packaging. The default and Hermes runners retain the existing RN transforms. Custom Babel plugins belong in `babel.config.cjs`; a separate Babel transformer requires explicit composition rather than silently replacing this engine policy.

## Check declarations

From the repository root after `npm ci`:

```powershell
npm run check:metro-types
```

This compiler check validates the tooling declarations. Use the [sample guide](../../../../sample/nelyx-testbed-app-2/README.md) to build or serve an actual runner; declaration checking alone does not establish runtime behavior.

## License

Nelyx-authored code uses [BSD-3-Clause](LICENSE.md). Imported notices are retained in [`licenses/`](licenses/).


`@nelyx/metro/assets` exports `materializeAppAssets(appRoot, assets, resolveModule)` for explicit `packageSource` declarations. Pass the runner's module resolver. The function verifies installed exported font/image and notice bytes before copying missing app-local files, preserves existing content, and returns the normal verified asset records. `verifyAppAssets` and artifact notice copying retain their existing hash/path/budget contracts. SDK CLI application preparation calls this before bundling native/Web assets declared in the root `package.json` → `nelyx.assets`.

The Windows host copies verified asset bytes at their existing `Assets/` paths; the Skia loader verifies their hashes. No separate native editor font header or registry is required.
