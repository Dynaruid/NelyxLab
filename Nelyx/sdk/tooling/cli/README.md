# Nelyx CLI

**English** | [한국어](README.ko.md)

CLI0.10.0 templates use core0.16.0, SDK0.20.0, Skia0.6.0, Metro0.10.0 and build tooling static-aot0.1.0. Supply these archives together with selected Material/Cupertino0.1.0 archives. Native supplier/paragraph/keyboard contracts remain required. Asset `notice` references retain verified font license files; see the [SDK configuration guide](../../README.md).

`@nelyx/cli` creates applications from packaged templates and manages target preparation, builds, development, execution, and packaging. Use Node.js **>=24.3.0 <25**. For the repository sample, start with the [sample guide](../../../../sample/nelyx-testbed-app-2/README.md).

The self-contained [`templates/nelyx-app`](templates/nelyx-app/) directory owns the starter app source and all six platform runners. Edit that template directly; it is independent of the Components Gallery.

The root `package.json` is the application configuration source; `app.json`, `application.json`, `nelyx.config.ts` and root bootstrap files are unnecessary. Keep the npm package `name` separate from `nelyx.name`, which must match the native application registration name. `nelyx.displayName` retains the human-readable label. When adding bundled images (or fonts on Apple/Linux), add literal `require` entries to the runner main asset map so Metro includes their bytes. Windows maps all declared assets to host URIs; Android maps declared fonts to hash-qualified native asset URIs. CLI preparation still writes build-owned `runner/app-config.json` for native build tools; edit the root package configuration and rerun prepare to refresh it.

Asset and notice `sha256` fields are optional and are omitted from the starter configuration. Runner preparation, type checking and Metro startup calculate them from the current files and write portable runtime metadata to generated `runner/app-config.json`; they never add hashes to the root package. Each runner main validates that generated asset metadata before registration. Package assets are compared with their installed source bytes before copying, and existing edited destinations are preserved and rejected. Explicit hash pins, when supplied, are still checked.

## Create an application

With the CLI installed and a local archive directory prepared:

```text
nelyx create MyApp --name MyApp --target web --packages <archive-directory>
nelyx create CoreApp --name CoreApp --target web --designs none --packages <archive-directory>
nelyx create MaterialApp --name MaterialApp --target web --designs material --packages <archive-directory>
```

The destination must be empty. The application name starts with an uppercase letter and contains only letters and digits. Targets are `windows`, `android`, `ios`, `macos`, `linux`, and `web`; select one explicitly.

Creation writes the runner manifest without a lockfile. Install the new Web runner once with `npm --prefix MyApp/web/runner install --workspaces=false`. Later, `supply` refreshes its lockfile; use `ci` as shown below to replace installed packages from updated archives.

`--packages` requires exactly one archive for each of `@nelyx/core`, `@nelyx/sdk`, `@nelyx/skia-rn`, `@nelyx/skia-web`, `@nelyx/metro`, `@nelyx/cli`, and `@nelyx/static-aot`. The CLI declares static-aot as a build dependency; creation and supply put its local reference in the selected runner even when the runtime uses bytecode or V8. Include one Material/Cupertino archive for each selected design (`--designs none` omits both; the default selects both). After building the SDK, create these archives from the repository root in PowerShell:

```powershell
New-Item -ItemType Directory -Force Nelyx/.cache/packages/manual | Out-Null
foreach ($package in @('core', 'sdk', 'skia-rn', 'skia-web', 'metro', 'cli', 'static-aot', 'material', 'cupertino')) {
    npm pack --workspace "@nelyx/$package" --pack-destination Nelyx/.cache/packages/manual --ignore-scripts
    if ($LASTEXITCODE -ne 0) { throw "Packing failed: $package" }
}
```

Use a directory without older versions of the archives. Pass its absolute path to `--packages`. Without this option, the generated runner refers to package versions, which must be available through your configured package registry.

## Supply and install

Run from a directory where the installed `nelyx` command is available:

```text
nelyx supply --app MyApp --target web --packages <archive-directory>
npm --prefix MyApp/web/runner ci --workspaces=false
```

Supply copies archives into app-owned `.nelyx/supply/<target>/` and updates the runner manifest and lockfile. It does not install the runner dependency tree. Generated apps put shared source/configuration at the root, and runtime dependencies inside each independent runner.

## Target commands

After installation, run from `MyApp/web/runner/`:

```powershell
npx --no-install nelyx doctor --app ../.. --target web
npx --no-install nelyx prepare --app ../.. --target web
npx --no-install nelyx build --app ../.. --target web
npx --no-install nelyx run --app ../.. --target web --port 8080
```

`run` serves the built Web package at `http://127.0.0.1:8080/`. Use `npx --no-install nelyx dev --app ../.. --target web` for development on port 8081, or `npx --no-install nelyx pack --app ../.. --target web --output <new-path>` to export the built package. Stop a server with Ctrl+C.

Windows `build` uses fixed `.nelyx/windows/packages/Release/` and `Debug/` directories without timestamps. It verifies a staged package, replaces that configuration's output and updates the locator; a failed replacement restores the previous package. Close an app running from the same output before rebuilding. Staging and replacement backups are removed at exit, and successful builds prune old timestamped packages of the same app. The other fixed configuration, external outputs, foreign/modified packages and links are preserved. Explicit `--output` still requires a new directory. The result includes `cleanup.removed` and `cleanup.retained` with reasons.

| Operation | Purpose |
| --- | --- |
| `doctor` | Report target tooling/provider information |
| `prepare` | Generate runner configuration and prepare explicit native inputs |
| `build` | Build a selected target package |
| `dev` | Manage development server and native app launch where configured |
| `run` | Run an existing native package or serve a built Web package |
| `pack` | Export a built target package to a fresh destination |

Options vary by target; the parser in [`src/main.mjs`](src/main.mjs) defines accepted combinations. Doctor results and pack output do not prove device execution or production signing.

## Native prerequisites

Windows preparation/build accepts `--native-inputs <inputs.json>` and validates hashes, source inventory, and ABI. Linux preparation requires the manifest; builds also require pinned RNL/Hermes native sources. See the [Skia supply guide](../../../skia/README.md).

Windows `prepare` and `build` also accept `--engine hermes|v8|jsc` (default Hermes). V8 preparation builds the pinned Microsoft V8 24.1.10/RNW 0.83.2/native RN 0.83.4 supplier; `--engine-inputs <supplier-directory>` connects an existing verified supplier. V8 uses a distinct profile/cohort, owning-VM identity, source JS bundle, portable map and DLL/notice checks. Run/pack follow the package's engine and the existing fixed configuration slot/locator policy. Rebuild with `--engine hermes` to return to HBC. The Hermes inspector and development refresh are not supported for V8/JSC; qualification remains scoped to actual application validation.

JSC uses `--engine jsc --jsc-mode jit|interpreter` (JIT by default), with profile
`rn-jsc-graphite-vulkan` and cohort `rn-0.83.10-jsc`. Prepare downloads the
hash-pinned Playwright WebKit 2272 / WebKit26.4 Windows x64 engine and builds an
RNW0.83.2/native RN0.83.4 JSI21 adapter. Visual Studio C++ tools and 20 GiB free
space are required. Temporary archives/source/compiler trees are removed in
`finally`; only the reusable supplier remains. Both modes pass a native
Promise/host-job FIFO and language/exception admission before publication.

```powershell
npx --no-install nelyx prepare --app ../.. --target windows --engine jsc
npx --no-install nelyx build --app ../.. --target windows --engine jsc --jsc-mode interpreter
npx --no-install nelyx run --app ../.. --target windows
```

JSC consumes UTF-8 source, independently validates the owning VM/version/revision
and records the mode in the inventoried `jsc-mode.txt`. Mode changes require a
fresh process. Interpreter mode disables JS/RegExp JIT and WebAssembly before
VM creation; the pinned `VM::canUseAssembler()` seam rejects a mismatched actual
VM state. The JIT mode enables normal JSC tiers rather than guaranteeing that
each function is compiled. RNW's public engine enum has no JSC value: the
separate JSC supplier owns its default engine slot, and the VM identity remains
JSC. Hermes AOT/profile flags are rejected for this backend. Source and binary
licenses and upstream source locations travel with the package. References:
[WebKit Windows options](https://docs.webkit.org/Ports/WindowsPort.html),
[pinned VM gate](https://github.com/WebKit/WebKit/blob/482d54b279fd6147a45aaa122242f2ac315f46df/Source/JavaScriptCore/runtime/VM.cpp),
[Playwright source build](https://github.com/microsoft/playwright/tree/v1.59.1/browser_patches/webkit).

Windows x64 Release supports experimental Static Hermes AOT with `--engine hermes --hermes-mode static-aot`. Prepare builds the pinned `94aa5e1d` compiler/runtime or reuses verified `--engine-inputs`. Build requires the `optimized` profile. The entire Metro root compiles to native code; selected bodies use type specialization, and other bodies retain dynamic JavaScript operations in the same RNW/Skia Node-API VM. Preparation requires 20 GiB free, VS C++ tools, LLVM clang/clang-cl, CMake and Ninja. One app load per process is supported; Debug and refresh are outside this experiment. Compilation does not establish whole-app coverage, automatic type-policy acceptance or FPS improvement.

Windows bytecode bundles default to Hermes `-Og` with the pinned `94aa5e1d` compiler. Its unrestricted `-O` bytecode incorrectly updates loop-carried bisection bounds and can hang `Cubic` animations after scrolling. The native application still uses the requested Debug/Release configuration. Build acknowledgements and packages record `hermesCompilerFlags`; older packages must be rebuilt, and older runners must take the current `windows/runner/build.mjs` template. The historical compiler regression compared actual product code and x86/x64 bytecode with pinned Dart; its intermediate-tool harness was retired on 2026-10-18. Changing the compiler or optimization policy requires an equivalent product comparison and native app validation.

Frame wire 6 effects and existing rounded/Path/matrix/paint/layer records require matching core/SDK/renderer archives and rebuilt native suppliers; native ABI remains 1. After replacing local archives, update the runner installation and compare installed source hashes. See the Windows runner guide for compiled-source supplier rebuilding.

Android CLI packages require `--configuration Release` and accept `--architecture arm64-v8a|x86_64`; run accepts `--device <adb-serial>`. Debug/Metro development uses the separate `dev` operation. Apple native operations require macOS/Xcode; runtime patches are applied during explicit preparation against matching source hashes and protocol.

Prepare inputs and dependencies before execution. Importing the SDK does not start a download, vendor source build, or development server.

## Linux supply

`nelyx supply --app <app> --target linux --packages <archive-directory> --rnl-supply <supply.json>` also supplies the hash-checked RNL archives.

Prepare a clean pinned RNL checkout with `node <cli>/src/prepare-rnl.mjs <clean-pinned-checkout> <new-staging>`. Install dependencies and build the packages in staging, then run `node <cli>/src/pack-rnl.mjs <staging>`. `<cli>` is the installed CLI package directory.

Canonical pins, overlays, and patches live in [`Nelyx/upstream/`](../../../upstream/). The CLI's packaged `upstream/` assets are generated during the repository build.

## Templates and license

[`templates/nelyx-app/`](templates/nelyx-app/) contains the shared `src/index.ts` entrypoint and platform runners. SDK native hosts own app lifetime policy; Skia owns GPU/JSI/components. See the [SDK guide](../../README.md) for the ownership boundary.

Nelyx-authored code uses [BSD-3-Clause](LICENSE.md). Upstream template and runtime notices remain with their imported sources. Platform qualification, full reload/loss recovery, and production signing remain `notVerified`.


After supplying local archives, run npm install in the runner to install them. Supply updates the regular lock while preserving the hidden lock for the packages actually installed, so replacing a local archive at the same version is detected by the next install.

Windows Static Hermes AOT uses `--engine hermes --hermes-mode static-aot` with the verified toolchain and `optimized` profile. `prepare` accepts the same mode and an explicit `--engine-inputs <directory>` for reuse. It is experimental and keeps the default engine selection. The automatic source/checker policy specializes closed scalar bodies with guarded arguments. Unproven fields, lexical reads, callbacks, classes and collections retain ordinary JS representations in the same native image. Source maps, actual compiler functions and release-elimination evidence must account for every body; incomplete native coverage or policy evidence rejects a package. Existing constructors, modules and public TypeScript APIs retain their owners. The supplied VM disables eval/JIT and rejects source/bytecode fallback after native startup.

The typed leaf, dynamic RN/Metro root and pinned RNW JSI host-function manager link into one native image and share one Node-API VM. The manager initializes lazily on its exact original source/URL request; that request executes its precompiled native unit. The VM also uses native internal Promise/iterator JavaScript. The v5 plan binds both runtime sources, the complete body ledger and automatic type policy before startup; the ACK follows successful root and manager initialization. The package includes the original Metro, typed and RNW manager inputs plus a DLL-bound function-range PC map. Packaged execution needs no compiler cache. Compilation, native functionality, performance and physical display acceptance remain separate results.

Public mode names are `bytecode` and `static-aot`. The package is `@nelyx/static-aot`; CLI linking APIs are exported from `@nelyx/cli/windows-static-aot`. Retired mode/package/export names and previous native plan/metadata formats have no compatibility aliases; rebuild and resupply packages together.

Windows runner templates forward fatal React startup errors and available runtime frames to OutputDebugString. Native AOT addresses can be resolved with mapStaticAotPc; its source precision remains a function range.
