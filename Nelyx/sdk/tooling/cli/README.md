# Nelyx CLI

**English** | [한국어](README.ko.md)

`@nelyx/cli` creates Nelyx applications and manages package supply, target preparation, builds, development, execution, and packaging. Use Node.js **>=24.3.0 <25** and npm.

For the repository sample, follow the [Testbed guide](../../../../sample/nelyx-testbed-app-2/README.md).

## Create an application

With the `nelyx` command installed and matching local package archives available:

```text
nelyx create MyApp --name MyApp --target web --packages <archive-directory>
npm --prefix MyApp/web/runner install --workspaces=false
npm --prefix MyApp/web/runner run dev
```

Open `http://127.0.0.1:8081/`; Ctrl+C stops the server. The first installation creates the runner lockfile.

The destination must be empty. Application names start with an uppercase letter and contain letters and digits. Select `web`, `windows`, `android`, `ios`, `macos`, or `linux` with `--target`. Use `--designs none`, `material`, `cupertino`, or `material,cupertino` to choose design packages.

The [starter template](templates/nelyx-app/README.md) owns the shared app and platform runners. Configure it through root `package.json` → `nelyx`; see the [SDK guide](../../README.md#configuration-and-providers).

## Source runner

New projects and platform runners load the Source main().definition application. The separate v2 project generator and --engine v2 application route have been removed. Select a platform backend with the ordinary target/host options; engine options on Windows select a JavaScript engine for the same Source framework. See the [SDK app entry](../../README.md#source-application-entry).

## Supply and install

The archive directory needs one archive each for Core, SDK, Skia-native, Skia-RN, Skia-Web, Metro, CLI, and Static AOT tooling, plus the selected Material/Cupertino packages. Keep one compatible package set in that directory.

In this repository, build the SDK before packing archives. Web archives also need the [prepared CanvasKit runtime](../../../skia/eng/source-build/README.md#vendor-build-recipes). The source CLI can be invoked with `node Nelyx/sdk/tooling/cli/src/main.mjs` in place of `nelyx`.

```text
nelyx supply --app MyApp --target web --packages <archive-directory>
npm --prefix MyApp/web/runner ci --workspaces=false
```

Supply copies archives into application-owned `.nelyx/supply/<target>/` and refreshes the runner manifest and lockfile. Install the runner afterward, including when archive contents change at the same version. Shared source and configuration stay at the app root; each runner owns its dependency tree.

## Target commands

After installation, run from `MyApp/web/runner/`:

```powershell
npx --no-install nelyx doctor --app ../.. --target web
npx --no-install nelyx prepare --app ../.. --target web
npx --no-install nelyx build --app ../.. --target web
npx --no-install nelyx run --app ../.. --target web --port 8080
```

The final command serves the built package at `http://127.0.0.1:8080/`.

| Operation | Purpose |
| --- | --- |
| `doctor` | Inspect target tools and provider information |
| `prepare` | Generate runner configuration and prepare native inputs |
| `build` | Build the selected target |
| `dev` | Start development services and the native app where configured |
| `run` | Open an existing native package or serve a Web package |
| `pack` | Export a built package to a new destination |

Use `npx --no-install nelyx dev --app ../.. --target web` for development on port 8081. Export with `npx --no-install nelyx pack --app ../.. --target web --output <new-path>`. Stop servers with Ctrl+C.

Options vary by target; [src/main.mjs](src/main.mjs) defines accepted combinations.

For Windows RNW, `run` compares application source, assets, Windows configuration, and installed Nelyx SDK contents with the package's recorded inputs. Changes trigger a rebuild with the same engine, execution mode, compiler profile, and build configuration. Unchanged inputs reuse the package; older packages without recorded inputs rebuild once. A failed build or inputs changing during the build stops launch. Supply and install updated SDK packages first for an external app. The repository Testbed's `run:windows` also refreshes workspace SDK packages automatically. Use `run --package <directory>` to execute a specific package without rebuilding it.

For an existing external app, update `windows/runner/build.mjs` from the current starter template once to enable application/SDK input acknowledgement and native SDK header invalidation. The repository Testbed already includes this update.

## Windows x64 Tauri

Create and supply a Web runner using the steps above. Install Rust with the
`x86_64-pc-windows-msvc` target, Visual Studio C++ x64 tools and the Windows
SDK, and WebView2 Evergreen. From the app root, install the pinned Tauri CLI.
For an npm workspace, run the install from the workspace root with
`--workspace <app-package>`. [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/#windows)

```powershell
npm.cmd install --save-dev --save-exact '@tauri-apps/cli@2.12.6'
```

Run the following from the installed app's `web/runner/`.

```powershell
npx.cmd --no-install nelyx doctor --app ../.. --target windows --host tauri
npx.cmd --no-install nelyx prepare --app ../.. --target windows --host tauri
npx.cmd --no-install nelyx build --app ../.. --target windows --host tauri
npx.cmd --no-install nelyx run --app ../.. --target windows --host tauri
npx.cmd --no-install nelyx dev --app ../.. --target windows --host tauri --port 1420
```

`doctor` reports the runner, host source, CLI versions, and Windows prerequisites.
`prepare` creates `src-tauri/` on first use and validates it on later runs. Edit that
directory to set the window title, app identifier, icon, and Rust commands.

`build` embeds the Release Web assets in the app's
`.nelyx/tauri/windows-x64/nelyx-tauri.exe`. Distribute that EXE to Windows x64 machines
with WebView2 Evergreen. Run it directly, or use `nelyx run` with optional EXE
arguments after `--`. Close the running EXE before replacing it.

`dev` uses the loopback HTTP `build.devUrl` in the Tauri configuration, which
defaults to `http://127.0.0.1:1420/` in the template. Pass `--port` to switch
ports for one session. Close the window or press Ctrl+C to stop the app and
Metro. The host supports `doctor`, `prepare`, `build`, `run`, and `dev`.

## Native prerequisites

| Target | Required setup |
| --- | --- |
| Windows | Visual Studio C++ tools, Windows SDK, and a matching x64 renderer supplier |
| Android | OpenJDK 21, Android SDK/NDK, and compatible renderer inputs |
| iOS / macOS | macOS, Xcode, Pods, and matching native packages |
| Linux | GTK4/X11, pinned RNL/Hermes sources, and an explicit native-input manifest |

See the [Skia guide](../../../skia/README.md) for native supply.

Windows defaults to the RNW host and Hermes bytecode. Select `--engine hermes|v8|jsc` during preparation/build. Hermes supports `--hermes-mode bytecode|static-aot`; Static AOT requires x64 Release and the optimized compiler profile. JSC accepts `--jsc-mode jit|interpreter`. V8/JSC and Static Hermes require their own prepared engine supplier; `--engine-inputs` reuses one.

The experimental direct Hermes host uses `--host native-hermes`. From the installed Windows runner:

```text
npx --no-install nelyx prepare --app ../.. --target windows --host native-hermes --native-inputs <inputs.json>
npx --no-install nelyx build --app ../.. --target windows --host native-hermes --hermes-mode bytecode
npx --no-install nelyx run --app ../.. --target windows --host native-hermes --hermes-mode bytecode
```

Use `static-aot` instead of `bytecode` to build/run its native AOT mode. Direct-host builds also require LLVM, CMake, and Ninja. Its current packages are `.nelyx/native-windows/current-bytecode/` and `current-static-aot/` inside the app. Default native runs compare the app, installed SDK and prepared suppliers and rebuild when they change; `--package` runs the chosen portable snapshot without rebuilding local sources.

Direct-host `build` and `run` accept `--entry src/variant.ts` to select a different
application-owned entry exporting `main()`. The path is relative to `--app`.
Changing the entry rebuilds the current package; omitting it selects the configured
`nelyx.appEntry`. An explicit `--package` already fixes its entry and cannot be
combined with `--entry`.

Windows RNW output uses fixed `.nelyx/windows/packages/Release/` and `Debug/` directories. Close the running package before rebuilding. Preparation must be repeated after changing native suppliers.

Android build accepts `--architecture arm64-v8a|x86_64` with a compatible app profile; Release packaging uses `--configuration Release`. Select a device for `run` with `--device <adb-serial>`. Use `dev` for the Debug/Metro path.

## Linux supply

`nelyx supply --app <app> --target linux --packages <archive-directory> --rnl-supply <supply.json>` adds hash-checked RNL archives.

Prepare a clean pinned RNL checkout with `node <cli>/src/prepare-rnl.mjs <checkout> <new-staging>`. Install and build its packages in staging, then run `node <cli>/src/pack-rnl.mjs <staging>`. Here `<cli>` is the installed CLI package directory. Canonical pins and overlays live in [upstream/](../../../upstream/).

## Templates and license

[templates/nelyx-app/](templates/nelyx-app/) contains the app entrypoint and runner guides. The SDK owns application-host lifetime and Skia owns graphics resources.

Nelyx is experimental; platform limits are described in the [project guide](../../../../README.md#project-status). Nelyx-authored code uses [BSD-3-Clause](LICENSE.md), and imported template/runtime notices remain with their sources.
