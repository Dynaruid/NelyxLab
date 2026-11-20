# Nelyx Demo

**English** | [한국어](README.ko.md)

An independent Material 3 components gallery inspired by
`DorotiLab/samples/DorotiDemoApp`. The app opens directly into **Components**,
with light/dark themes, one column up to 1,000px and two independently scrolling
columns on wider windows. The menu opens a drawer that filters component groups.

The 15 demos cover buttons, icon buttons, badges, progress, cards, dialogs,
dividers, destinations/drawer, checkboxes, chips, radios, sliders, switches,
text inputs, and images. Inputs support Korean/emoji, secure entry, multiline,
selection, clear and undo. Images support local/URL sources, cover/contain,
retry, and extraction of light/dark Material palettes. Remote images require
network access and, on Web, an appropriate CORS response.

Run from the repository root in PowerShell with Node.js >=24.3.0 <25:

```powershell
npm.cmd ci
npm.cmd run build:sdk
node Nelyx/skia/eng/prepare-web-runtime.mjs --check
npm.cmd run prepare:web --workspace @nelyx/demo
npm.cmd run dev:web --workspace @nelyx/demo
```

Open `http://127.0.0.1:8081/`; Ctrl+C stops the server. Web requires the prepared
Nelyx CanvasKit runtime and WebGL2. `npm.cmd run build:web --workspace @nelyx/demo`
writes the current static build to this app's `.nelyx/web/`.

Windows uses the direct Hermes host with Source widgets. Install Visual Studio C++ tools,
Windows SDK, LLVM, CMake and Ninja, and prepare the matching native Skia inputs:

```powershell
npm.cmd run prepare:windows --workspace @nelyx/demo
npm.cmd run build:windows --workspace @nelyx/demo
npm.cmd run run:windows --workspace @nelyx/demo
```

`prepare:windows` supplies and installs the current SDK, verifies
`Nelyx/skia/vendor/inputs/windows-x64/source-inputs.json`, and prepares the matching
Hermes toolchain in `.nelyx/windows-hermes/`. It records both suppliers in this app's
`.nelyx/native-windows/inputs.json`. To select another native Skia supplier, append
`-- <source-inputs.json>` to preparation or run
`node sample/nelyx-demo-app/eng/windows-inputs.mjs <inputs.json>` after installing
the runner. Missing or mismatched suppliers fail preparation explicitly.

`build:windows` builds optimized Hermes bytecode and the direct C++ host into
`.nelyx/native-windows/current-bytecode/`. `run:windows` refreshes changed repository
SDK inputs and rebuilds changed app/SDK/supplier inputs; an unchanged package is reused.
Close the app before replacing its package. The direct host remains experimental;
physical input and performance results are preserved in the [W12 closing summary](../../history/26/11/14/work12-summary.md).
For the calendar, maximize the window and choose **Menu → Selection → Choose date**.

To try the candidate interactively, run this from the repository root. It refreshes
the current SDK supply and builds when needed, then stays open until you close it.

```powershell
npm.cmd run run:windows:prepared --workspace @nelyx/demo
```

Equivalently, use `npm.cmd run run:windows --workspace @nelyx/demo -- --preparation split`.
Close the existing window before switching back with plain `run:windows` or
`--preparation legacy`. Changing the entry rebuilds the current package.
`--preparation` cannot be combined with an explicit `--package` snapshot.

Cold calendar production is experimental and off by default. App owners can select
`main(undefined, { calendarPreparation: true })`; it wraps only the date dialog in
`PageViewPreparation` with `childPolicy: { mode: 'split' }`. A PageView can also set
that policy directly. New State may initialize/build before display; cancellation
disposes it once, while user timers/subscriptions remain the State's responsibility.
The first implementation permits one unpublished generation per View, shares the
2,048 Element cap with optional retained children, and supports nested finite
grids/fixed lists with at most 64 children. LayoutBuilder discovery is unsupported
and fails before its builder runs. Required coverage completes the same production
cursor synchronously and performs layout before CPU publication. Web hosts without
an observed work deadline do not start optional production.

Use the current-source Windows runner to select the control or candidate.
See the [W5 results and limitations](../../history/26/11/17/work5-summary.md).
The current candidate produces dates ahead in the native Demo calendar. Full performance acceptance is pending,
and it remains disabled by default.

Android defaults to the x86_64 `emulator-vulkan` profile. Select a standard JDK 21
(Temurin is available on this Windows machine), then run from the repository root:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
npm.cmd run prepare:android --workspace @nelyx/demo
npm.cmd run build:android:emulator --workspace @nelyx/demo
npm.cmd run run:android --workspace @nelyx/demo -- --device emulator-5554
```

Use the JDK path and `adb` serial installed on your machine. The SDK CLI builds,
verifies and installs the Release APK; Metro is not required. For ARM64 hardware,
set `nelyx.targets.android.profile` to `graphite-vulkan` and pass
`-- --architecture arm64-v8a` to `build:android`.
See the [Korean guide](README.ko.md) for complete commands and the
[Testbed guide](../nelyx-testbed-app-2/README.md) for platform prerequisites.

Each `prepare:<platform>` supplies current SDK archives and installs that runner.
[package.json](package.json) declares the entrypoint, assets and profiles.

The app owns its shared sources and assets and does not import the Testbed.
It uses the public Source Widget/Material API with the Windows direct Hermes,
Android RN and Web backends. It adapts the available Nelyx components,
rather than claiming full Doroti component parity. Runner availability and
successful builds do not establish device, physical-input or performance acceptance.

Retain [Flutter attribution](LICENSE.flutter), the bundled Noto Sans KR and Noto Color Emoji OFL,
and the Material Icons notice copied during supply. The local image is by Mae Mu / Unsplash.
