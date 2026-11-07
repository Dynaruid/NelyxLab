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

For Windows, prepare the matching renderer inputs, Visual Studio C++ tools and Windows SDK:

```powershell
npm.cmd run prepare:windows --workspace @nelyx/demo
npm.cmd run build:windows --workspace @nelyx/demo
npm.cmd run run:windows --workspace @nelyx/demo
```

Build the [Windows native supplier](../../Nelyx/skia/README.ko.md#windows-네이티브-입력)
with `--runner sample/nelyx-demo-app/windows/runner`. `prepare:windows` verifies and
references the current `.nelyx/windows-rnw-native/supplier/inputs.json` directly,
without copying native libraries into each app. To select another supplier, append
`-- <inputs.json>` to preparation or run
`node sample/nelyx-demo-app/eng/windows-inputs.mjs <inputs.json>` after installing
the runner. If the supplier is absent, build it after runner installation, then register it.

Windows uses RNW/Hermes bytecode. The run command refreshes changed repository
SDK inputs and rebuilds changed application inputs. Close the app before replacing its package.

Android includes an independent RN runner. Use `prepare:android`, then build/run
from `sample/nelyx-demo-app/android/runner` with `--architecture arm64-v8a` and
`--device <adb-serial>`. For an emulator, set `nelyx.targets.android.profile` to
`emulator-vulkan` in `package.json` and build with `--architecture x86_64`.
See the [Korean guide](README.ko.md) for complete commands and the
[Testbed guide](../nelyx-testbed-app-2/README.md) for platform prerequisites.

`npm.cmd run check --workspace @nelyx/demo` checks shared UI types. After preparing
a runner, `check:web`, `check:windows`, or `check:android` checks that target.
Each `prepare:<platform>` supplies current SDK archives and installs that runner.
[package.json](package.json) declares the entrypoint, assets and profiles.

The app owns its shared sources and assets and does not import the Testbed.
It uses the existing public Widget/Material API and RNW/RN/Web runners; a C++ v2
engine port is outside this project. It adapts the available Nelyx components,
rather than claiming full Doroti component parity. Runner availability and
successful builds do not establish device, physical-input or performance acceptance.

Retain [Flutter attribution](LICENSE.flutter), the bundled Noto Sans KR and Noto Color Emoji OFL,
and the Material Icons notice copied during supply. The local image is by Mae Mu / Unsplash.
