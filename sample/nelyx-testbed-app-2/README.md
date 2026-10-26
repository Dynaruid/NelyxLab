# Nelyx Testbed

**English** | [한국어](README.ko.md)

A shared TypeScript application for exploring Nelyx's Material 3 and Cupertino components. It includes component galleries, text editors and forms, routes, theme controls, and a ListView example.

The app shares [src/](src/) across Web, Windows, and Android. Each target has its own runner, dependencies, and build configuration.

## Prerequisites

Use Node.js **>=24.3.0 <25**, npm, and Python 3. Run the following from the repository root before setting up a target:

```powershell
npm ci
npm run build:sdk
```

Run the commands in this guide from the repository root. In PowerShell, use `npm.cmd` when forwarding native options with `--`. After changing SDK or design sources, repeat the SDK build, target supply, runner installation, and target build.

## Web

Use a WebGL2-capable browser and the matching source-built CanvasKit runtime. For a fresh checkout, follow the [runtime preparation guide](../../Nelyx/skia/eng/source-build/README.md#vendor-build-recipes).

```powershell
node Nelyx/skia/eng/prepare-web-runtime.mjs --check
npm run prepare:sample -- web
npm --prefix sample/nelyx-testbed-app-2/web/runner install --ignore-scripts --workspaces=false
npm run dev:web --workspace @nelyx/testbed-2
```

Open `http://127.0.0.1:8081/`. Ctrl+C stops the server. Build static output with:

```powershell
npm run build:web --workspace @nelyx/testbed-2
```

Output is written under this application's `.nelyx/web/`. The [Web runner guide](web/runner/README.md) also covers serving and exporting a CLI-managed package.

## Windows

Windows defaults to **Hermes bytecode with the optimized Release profile on the RNW host**. Close the Testbed window before rebuilding its current package.

### Prepare Windows

Install Visual Studio C++ tools and the Windows SDK. Build or obtain a matching renderer supplier using the [Skia guide](../../Nelyx/skia/README.md#windows-native-inputs). The supplier must match the installed runner's native sources.

```powershell
npm.cmd run prepare:sample -- windows
npm.cmd --prefix sample/nelyx-testbed-app-2/windows/runner install --ignore-scripts --workspaces=false
npm.cmd --prefix sample/nelyx-testbed-app-2/windows/runner run prepare:native -- --native-inputs "C:\path\to\supplier\inputs.json"
```

Replace the example path with the supplier's actual `inputs.json`. Install the runner before compiling its supplier. Preparation remembers native inputs for later builds; repeat it after replacing the supplier.

### Choose an execution mode

| Mode | Command from the repository root |
| --- | --- |
| Hermes bytecode, optimized Release | `npm.cmd run start:windows:hermes --workspace @nelyx/testbed-2` |
| V8 | `npm.cmd run start:windows:v8 --workspace @nelyx/testbed-2` |
| JSC JIT | `npm.cmd run start:windows:jsc --workspace @nelyx/testbed-2` |
| JSC interpreter | `npm.cmd run start:windows:jsc:interpreter --workspace @nelyx/testbed-2` |
| Hermes bytecode with the debug compiler profile | `npm.cmd run start:windows:hermes:debug --workspace @nelyx/testbed-2` |
| Reopen the last built package | `npm.cmd run run:windows --workspace @nelyx/testbed-2` |

Prepare V8 once before its first build:

```powershell
npm.cmd --prefix sample/nelyx-testbed-app-2/windows/runner run prepare:native -- --engine v8
```

For **Static Hermes AOT**, use the launch script after preparing the runner:

```powershell
.\sample\nelyx-testbed-app-2\start-windows-static-aot.ps1
```

The script prepares the compiler/runtime, builds an optimized Windows x64 Release package, and launches it. Add `-RefreshSdk` after SDK changes to rebuild, supply, and reinstall packages first. The initial compiler/runtime preparation requires Visual Studio C++ tools, LLVM clang/clang-cl, CMake, Ninja, and 20 GiB free space.

The same script prepares and starts **JSC**:

```powershell
.\sample\nelyx-testbed-app-2\start-windows-static-aot.ps1 -Engine jsc -JscMode jit
.\sample\nelyx-testbed-app-2\start-windows-static-aot.ps1 -Engine jsc -JscMode interpreter
```

The script's default engine is Static Hermes; the ordinary npm build defaults to Hermes bytecode. JSC modes use source JavaScript and require a fresh process when switching modes. V8/JSC and Static Hermes use separate prepared engine inputs.

### Build and run options

Pass options directly to the runner:

```powershell
npm.cmd --prefix sample/nelyx-testbed-app-2/windows/runner run build -- --engine hermes --hermes-mode bytecode --hermes-profile debug --configuration Debug
npm.cmd run run:windows --workspace @nelyx/testbed-2
```

| Option | Values and purpose |
| --- | --- |
| `--engine` | `hermes`, `v8`, or `jsc`; default Hermes |
| `--hermes-mode` | `bytecode` or `static-aot`; AOT requires Hermes, Release, and the optimized profile |
| `--hermes-profile` | `optimized` or `debug`; defaults to optimized in Release and debug in Debug |
| `--jsc-mode` | `jit` or `interpreter`, for JSC |
| `--configuration` | `Release` or `Debug` |
| `--native-inputs` | Matching renderer supplier manifest |
| `--engine-inputs` | Verified supplier/toolchain for the selected engine |

`run` opens the last built package. To select an output explicitly:

```powershell
npm.cmd --prefix sample/nelyx-testbed-app-2/windows/runner run run -- --package ../../.nelyx/windows/packages/Release
```

Relative package paths resolve from the runner directory. Fixed outputs are `.nelyx/windows/packages/Release/` and `Debug/` inside this app.

The GPU defaults to the hardware adapter attached to the primary display. Set `NELYX_WINDOWS_GPU_VENDOR` before launch to select a vendor explicitly, such as `4098` for AMD.

### Development session

```powershell
npm.cmd --prefix sample/nelyx-testbed-app-2/windows/runner run dev -- --port 8081
```

This starts the Hermes Metro/native Debug session. Add `--launch false` to start Metro alone. Stop with Ctrl+C. V8/JSC and Static Hermes do not support this development refresh path.

### Experimental direct Hermes host

After supplying and installing the current Windows packages:

```powershell
node Nelyx/eng/run-native-hermes.mjs --hermes-mode bytecode
node Nelyx/eng/run-native-hermes.mjs --hermes-mode static-aot
```

These commands build and run the same app with the direct HWND/Skia/TSF/UIA host. They require Windows x64, matching native inputs, Visual Studio C++ tools, LLVM, CMake, and Ninja. Packages live in this app's `.nelyx/native-windows/current-bytecode/` and `current-static-aot/`. RNW remains the default host. See the [CLI guide](../../Nelyx/sdk/tooling/cli/README.md#native-prerequisites) for external apps.

## Android

Use a standard OpenJDK **21**, Android SDK/build tools **36**, NDK **27.1.12297006**, a Vulkan-capable x86_64 emulator, and the matching Android Skia supply. Set `JAVA_HOME` to your JDK before building. The native supplier archive referenced by the Android runner's package.json must exist before installation; `prepare:sample` supplies the Nelyx packages.

```powershell
npm.cmd run prepare:sample -- android
npm.cmd --prefix sample/nelyx-testbed-app-2/android/runner install --ignore-scripts --workspaces=false
Push-Location sample/nelyx-testbed-app-2/android/runner
try {
    npx.cmd --no-install nelyx build --app ../.. --target android --architecture x86_64 --configuration Release
    adb devices -l
    npx.cmd --no-install nelyx run --app ../.. --target android --device emulator-5554
} finally {
    Pop-Location
}
```

Replace `emulator-5554` with the serial from `adb devices -l`. The runner installs and launches the Release APK. The sample selects the `emulator-vulkan` profile, which requires x86_64; a physical ARM64 target also needs a compatible profile and native inputs. See the [Android runner](android/runner/README.md) for target details.

## Explore the app

| Page | What to try |
| --- | --- |
| Material 3 | Categories, buttons, selection controls, light/dark themes, and seed colors |
| Cupertino | Cupertino components, accents, dialogs, and navigation back to Material |
| Text inputs | Korean/emoji input, clear/Undo, secure input, selection, line limits, and internal scrolling |
| Forms | Name/email validation, Next/Done, save, and reset |
| Navigation | Open a route, change its counter, and return a result |
| ListView | Select from 1,000 rows, scroll to first/last, and clear selection |

The gallery labels demos as `ready`, `basic`, or `planned`. Use **준비 중 포함** to show planned entries. Themes and message state survive design-page changes; the ListView starts with fresh selection and scroll position when reopened.

## Application configuration

The root [package.json](package.json) → `nelyx` declares the shared entrypoint, assets, and target profiles. Each runner registers the platform component. Follow the [SDK guide](../../Nelyx/sdk/README.md#configuration-and-providers) when adding assets or targets.

## Troubleshooting

| Problem | Action |
| --- | --- |
| CanvasKit runtime missing or changed | Build and supply the runtime, then repeat Web preparation |
| Local package/source mismatch | Rebuild the SDK, supply the target, and reinstall its runner |
| Native compiled-source mismatch | Rebuild the matching renderer supplier and prepare its new manifest |
| Windows package cannot be replaced | Close the app running from that package |
| Android JDK image/jlink failure | Check that `JAVA_HOME` selects standard OpenJDK 21 |
| Wrong Android device | Select its exact `adb` serial with `--device` |

The app is experimental. Complete design coverage, graphics recovery, physical input/IME, screen readers, performance, and production signing require further qualification. The direct host and alternate engines are experimental options.

## License and assets

The gallery draws inspiration from DorotiTestbedApp's Components page. Flutter attribution is retained in [LICENSE.flutter](LICENSE.flutter). The [assets](assets/) include Noto Sans KR, Material Icons, Cupertino Icons, and a Mae Mu / Unsplash image; retain their notices when distributing the app.
