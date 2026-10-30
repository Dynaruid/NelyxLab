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

Run the commands in this guide from the repository root. In PowerShell, use `npm.cmd` when forwarding native options with `--`. Windows `run:windows` refreshes changed workspace SDK/design packages and rebuilds the app when needed. Other targets require repeating the SDK build, target supply, runner installation, and target build after source changes.

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
| Run, rebuilding when SDK inputs changed | `npm.cmd run run:windows --workspace @nelyx/testbed-2` |

`run:windows` compares actual workspace and installed SDK contents, compiles stale TypeScript, supplies and reinstalls changed packages, then rebuilds if the installed SDK differs from the last app package. It preserves that package's engine, AOT/bytecode mode, compiler profile, and Debug/Release configuration. Unchanged inputs reuse the package. Packages built before input tracking rebuild once. Close an existing Testbed before a rebuild; build failures stop launch. An explicit runner `run -- --package <directory>` opens the selected snapshot without refreshing it.

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

During scrolling, the gallery coalesces accessibility calculations for position changes to at most once every 300ms, then publishes the final position after 100ms without motion. Focus, value, enabled-state changes and accessibility actions bypass the delay; IME coordinates still update every frame. Adjust the app's `semanticsUpdateInterval` to change the interval; `0` publishes every changed frame.

All Components uses `childPolicy: {mode: 'bounded', capacity: 2, preparation: 'disabled'}` on its indexed section lists. Nearby sections can retain their live State and paint recordings for a return scroll. The engine accepts a per-list `capacity` of `0`–`8` optional sections (default `8`), within the shared View limits of 16 optional children and 2,048 Elements. Explicit editor keep-alive remains independent. Lowering capacity evicts optional sections through normal layout. Section creation is demand driven; a complex section's first build can still produce a long frame.

To inspect the actual gallery's CPU stages in Node/CanvasKit, run `node Nelyx/eng/profile-gallery-scroll.mjs` from the repository root. Add `--profile` for in-memory CPU sampling with hot function and caller paths, `--entries` for paragraph measurements in long frames, or `--viewport=wide` for the two-column page. `--pictures` uses the same bounded Picture owner as the product to include retained-layer composition and native Picture compilation. `--hover` adds equal scroll sweeps with a fixed synthetic mouse inside and outside text fields and the All Components ElevatedButton, including rebuild/layout counts. The `pointer-sweep` phases hold scrolling still and move the pointer between a control and the header; `includesPointerDispatch: true` identifies CPU timings that include input dispatch. With `--viewport=wide`, it also measures the text field in the actual two-column All Components page. Material shadow and color animations update through painting; shape, direction and caller-defined state-dependent layout changes still apply. Use `--children=legacy` for a fixture-only retention comparison. This prints diagnostics without saving profiles; these timings do not measure native FPS or physical trackpad/display performance.

The `gallery-all-text-hover-burst` diagnosis dispatches four hover packets per source frame while the two-column page scrolls. `hitTransforms.unused` counts transform reads for targets without a pointer handler. The native gallery fixture also includes a queued hover stream during scrolling; both are controlled workloads, separate from physical input acceptance.

The GPU defaults to the hardware adapter attached to the primary display. Set `NELYX_WINDOWS_GPU_VENDOR` before launch to select a vendor explicitly, such as `4098` for AMD.

### Development session

```powershell
npm.cmd --prefix sample/nelyx-testbed-app-2/windows/runner run dev -- --port 8081
```

This starts the Hermes Metro/native Debug session. Add `--launch false` to start Metro alone. Stop with Ctrl+C. V8/JSC and Static Hermes do not support this development refresh path.

### Resize diagnostics

After preparing Windows and reinstalling the runner packages, run this from the repository root. The fixture drags its temporary app with real OS mouse input; leave the mouse and trackpad idle while it runs.

```powershell
npm run test:windows-resize
```

This checks both corners in Material, ListView and Cupertino. It reports requested/actual input frequency, window rect changes, surface updates and captured display changes separately. Input defaults to 61Hz with a four-second round trip; set `NELYX_ANIMATION_DRAG_HZ` and `NELYX_ANIMATION_DRAG_DURATION_MS` to change them. Use `NELYX_ANIMATION_PIXELS=0` for a CPU/geometry comparison without capture. A pass covers screen and frame lifetime checks; it does not certify the target FPS. Evaluate capture overhead and the user's drag experience separately. The fixture app and temporary build are cleaned up on exit.

The default engine mode is Hermes bytecode. After preparing Static Hermes for this app, build and run the AOT fixture in a separate PowerShell process as follows. Each run also verifies native initialization and actual AOT function calls. This leaves the current product package in place; compare the two modes separately.

```powershell
pwsh -NoProfile -Command {
    $runtime = Get-Content sample/nelyx-testbed-app-2/.nelyx/windows/static-hermes-inputs.json -Raw | ConvertFrom-Json
    $env:NELYX_STATIC_HERMES_INPUTS = $runtime.directory
    $env:NELYX_ANIMATION_HERMES_MODE = 'static-aot'
    npm.cmd run test:windows-resize
    exit $LASTEXITCODE
}
```

`NELYX_ANIMATION_TRACE=1` connects Core metrics, frame requests, layout, paint, semantics, capture, and native submission using the same QPC clock. It separates all active frames from the exact native prepared-copy frames. Keep this instrumented run separate from measurements with tracing disabled.

Set `NELYX_ANIMATION_RESIZE_PAGES=material`, `NELYX_ANIMATION_RESIZE_WIDTH=600`, and `NELYX_ANIMATION_RESPONSIVE_SHORT_HEADER=1` together to check the short header's breakpoint. The title stays at 18px; the displayed width in the same desktop frame selects the expected 16↔28 padding coordinates. The taller header's 28↔36px title transition is outside this profile.

### Rendering continuity diagnostics

Use the same Windows preparation and installed runner, then run this from the repository root. Leave the mouse and trackpad idle during its real OS wheel input.

```powershell
npm run test:windows-render-liveness
```

This keeps the window size fixed and performs eight idle redraws and twelve OS scroll bursts. Each request must produce a distinct color in an owned desktop pixel and advance native frames, catching cases where JS state changes while rendering stops. This runs Hermes bytecode; it does not qualify Static Hermes performance or complete scanout. The app and temporary build are cleaned up on exit.

To check continuous input and close in the currently built Windows package, run:

```powershell
npm run test:windows-continuous-scroll
```

The test sends uninterrupted OS wheel streams and measures gaps between body pixel changes in Material, ListView, and Cupertino. It requests close immediately after input and separately checks window hiding/destruction, process exit, and native drain. Material also includes maximize/restore and mouse movement. Leave the physical mouse and trackpad idle during the test. This is bounded automated input for the current package, not physical trackpad or complete display performance acceptance.

To observe delays during actual use, start a fresh process with console diagnostics:

```powershell
$env:NELYX_WINDOWS_FRAME_DIAGNOSTICS='1'
try { npm run run:windows --workspace '@nelyx/testbed-2' }
finally { Remove-Item Env:NELYX_WINDOWS_FRAME_DIAGNOSTICS -ErrorAction SilentlyContinue }
```

This reports waits of at least 100ms in the frame clock, JS frame scheduling/work, native UI queue/work, GPU producer/retirement, and shutdown stages. Normal runs do not print these observations or create log files. An accepted window close hides the window first; the command returns after input, GPU, and RNW cleanup finishes.

When behavior depends on the launching terminal or tool session, observe the current app from a separate read-only process:

```powershell
$scrollApp = Get-Process NelyxRNHost | Select-Object -First 1
pwsh -NoProfile -File Nelyx/eng/windows-scroll-observer.ps1 -TargetProcessId $scrollApp.Id
# Read immediately after reproduction while keeping the app open.
pwsh -NoProfile -File Nelyx/eng/windows-scroll-observer.ps1 -TargetProcessId $scrollApp.Id -Read
# Stop observation while keeping the app open.
pwsh -NoProfile -File Nelyx/eng/windows-scroll-observer.ps1 -TargetProcessId $scrollApp.Id -Stop
```

The observer starts independently through Explorer. For up to 20 minutes, it observes OS wheel activity over this app, focus/capture, UI responsiveness, and a desktop hash of the app area. Shared memory holds only the latest roughly 102 seconds (512 samples); keyboard content, images, and file logs are not stored. Hooks, GDI resources, and shared memory are retired at app exit or timeout; the final records remain available for up to two minutes after app exit. OS wheel observation does not establish native-message, SDK, or Core receipt, and the desktop hash is not FPS or full display acceptance. It does not capture every DirectManipulation trackpad input.

To trace brief pauses during scrolling, start a fresh process from a package containing the current SDK and native diagnostics:

```powershell
$env:NELYX_WINDOWS_INPUT_TRACE='1'
try { npm run run:windows --workspace '@nelyx/testbed-2' }
finally { Remove-Item Env:NELYX_WINDOWS_INPUT_TRACE -ErrorAction SilentlyContinue }
```

Read immediately after reproduction from another terminal while keeping the app open. The optional desktop observer supports `-NoHook` to avoid installing an OS mouse hook:

```powershell
$scrollApp = Get-Process NelyxRNHost | Select-Object -First 1
pwsh -NoProfile -File Nelyx/eng/windows-input-trace.ps1 -TargetProcessId $scrollApp.Id
# Add -Raw for all currently retained samples.
pwsh -NoProfile -File Nelyx/eng/windows-scroll-observer.ps1 -TargetProcessId $scrollApp.Id -NoHook
```

Native diagnostics keep only counters/latest values for 32 stages and up to 8,192 numeric records in shared memory. Ordinary updates are sampled every 16 events; state changes, rejections, SDK/Core input latency of at least 200ms, JS frame work of at least 100ms, and stage gaps of at least 250ms are retained. There is no console/file output, extra frame request, or input hook; disabled runs allocate no memory. `payload-written` means native serialization, `sdk-received` means actual SDK ingress, and `core-dispatch-end` means the controller scope exited; handler failures also publish `core-drop` reason 4. Native packet sequence and Core input counter differ; Core observations link them through `input` and `a`. SDK generation/order drops and Core hidden/viewport drops are distinct. `gaps` reports sampled-stage intervals of at least 500ms. `frameGaps` reports submission intervals of at least 300ms with nearby gesture start/end/cancel events; only `consecutiveSubmissions=true` establishes a gap between actual consecutive submissions. An end/cancel event does not prove finger lift or normal idle. Trackpad updates use an active HWND timer independently of rendering; animation requests use DWM refresh deadlines. These scheduling ticks do not acknowledge presentation. Submission, GPU completion, surface update, and retirement are not display receipts; compare them with desktop observations. Native records disappear when the app exits.

For a brief recording of every event, also set `NELYX_WINDOWS_INPUT_TRACE_FULL='1'` before launch and remove it afterward. The same 8,192-entry ring overwrites its oldest events; read it immediately after scrolling. `sampleEvery` reports `1` for this mode and `16` for default sampling.

### Experimental direct Hermes host

After supplying and installing the current Windows packages:

```powershell
node Nelyx/eng/run-native-hermes.mjs --hermes-mode bytecode
node Nelyx/eng/run-native-hermes.mjs --hermes-mode static-aot
```

These commands build and run the same app with the direct HWND/Skia/TSF/UIA host. They require Windows x64, matching native inputs, Visual Studio C++ tools, LLVM, CMake, and Ninja. Packages live in this app's `.nelyx/native-windows/current-bytecode/` and `current-static-aot/`. RNW remains the default host. See the [CLI guide](../../Nelyx/sdk/tooling/cli/README.md#native-prerequisites) for external apps.

For CPU attribution in the actual two-column Gallery, use the bounded source-stage probe, then collect three fresh-process CPU trials:

```powershell
node Nelyx/eng/run-native-scroll.mjs --hermes-mode static-aot --viewport maximized --scroll-scenes --scope stages
node Nelyx/eng/run-native-scroll.mjs --hermes-mode static-aot --viewport maximized --scroll-scenes --scope cpu --repeat 3
node Nelyx/eng/run-native-scroll.mjs --hermes-mode static-aot --viewport maximized --scroll-scenes --scope gc
```

The four scenes separate first exposure, warm motion, button hover, and focused text editing. Scrolling and hover are driven through the framework; these are direct-host diagnostics, with RNW, OS wheel, physical trackpad, IME, and display acceptance remaining separate. Keep the desktop idle during trials. `stages` adds opt-in RAM samples; `cpu` disables them. `motion.intervals` excludes quiet/recontact gaps. Native replay combines synchronous buffer copy, validation, and recording; it is not GPU time. Temporary probe packages are removed on completion or failure, and the commands do not save profiles or verification logs.

Run `gc` separately to enable cumulative Hermes allocation/collection/pause counters. Its phase deltas do not locate an individual pause inside a frame, and its timings do not replace the `cpu` baseline.

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
