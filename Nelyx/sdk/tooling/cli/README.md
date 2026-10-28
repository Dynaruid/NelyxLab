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

For Windows RNW, `run` rebuilds when the installed Nelyx SDK files differ from the package's recorded inputs, preserving its engine, execution mode, compiler profile, and build configuration. Unchanged inputs reuse the package; older packages without recorded inputs rebuild once. A failed build stops launch. Supply and install updated SDK packages first for an external app. The repository Testbed's `run:windows` also refreshes workspace SDK packages automatically. Use `run --package <directory>` to execute a specific package without rebuilding it.

For an existing external app, update `windows/runner/build.mjs` from the current starter template once to enable SDK input acknowledgement and native header invalidation. The repository Testbed already includes this update.

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

Use `static-aot` instead of `bytecode` to build/run its native AOT mode. Direct-host builds also require LLVM, CMake, and Ninja. Its current packages are `.nelyx/native-windows/current-bytecode/` and `current-static-aot/` inside the app.

Windows RNW output uses fixed `.nelyx/windows/packages/Release/` and `Debug/` directories. Close the running package before rebuilding. Preparation must be repeated after changing native suppliers.

Android build accepts `--architecture arm64-v8a|x86_64` with a compatible app profile; Release packaging uses `--configuration Release`. Select a device for `run` with `--device <adb-serial>`. Use `dev` for the Debug/Metro path.

## Linux supply

`nelyx supply --app <app> --target linux --packages <archive-directory> --rnl-supply <supply.json>` adds hash-checked RNL archives.

Prepare a clean pinned RNL checkout with `node <cli>/src/prepare-rnl.mjs <checkout> <new-staging>`. Install and build its packages in staging, then run `node <cli>/src/pack-rnl.mjs <staging>`. Here `<cli>` is the installed CLI package directory. Canonical pins and overlays live in [upstream/](../../../upstream/).

## Templates and license

[templates/nelyx-app/](templates/nelyx-app/) contains the app entrypoint and runner guides. The SDK owns application-host lifetime and Skia owns graphics resources.

Nelyx is experimental; platform limits are described in the [project guide](../../../../README.md#project-status). Nelyx-authored code uses [BSD-3-Clause](LICENSE.md), and imported template/runtime notices remain with their sources.
