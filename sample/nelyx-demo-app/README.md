# Nelyx Demo

**English** | [한국어](README.ko.md)

Switch between the Material and Cupertino galleries using the bottom tabs. The galleries include selection and editors, sliders, menus, an action sheet and dialogs.

Use **Settings → Render path** to switch between **Direct** and **Worker (automatic)**. The demo reopens Settings after a switch and shows the render path in use. The selection is saved for the next launch.

## Prepare and develop

Prepare Node.js 24.x and the pinned CanvasKit and Rust Wasm toolchains. Run from the Nelyx root, then change to this app directory. [SDK setup](../../README.md#run-testbed-or-demo)

```powershell
npm.cmd ci
npm.cmd run build:sdk
npm.cmd run prepare:sample -- --app sample/nelyx-demo-app
Set-Location sample/nelyx-demo-app
npm.cmd ci --workspaces=false
npm.cmd run prepare:web
npm.cmd run typecheck
npm.cmd run dev:web
```

## Web and Tauri

From the repository root, use `npm run deploy -- --app Demo` to build and run this sample. [Deployment helper](../../helpers/deploy-helper/README.md)

Run the commands for the delivery target from the app root.

```powershell
npm.cmd run build:web
npm.cmd run run:web -- --base /demo/
```

The browser release is published under `.nelyx/web/` with installation and offline support configured by `targets.web.pwa`.

```powershell
npm.cmd run prepare:tauri -- --platform windows
npm.cmd run build:tauri -- --platform windows
npm.cmd run run:tauri -- --platform windows
```

`dev:tauri` runs the app in a WebView connected to Vite. `build:tauri` creates its own frontend and generates the native host. Use the corresponding OS and toolchain for other platforms. The app owns `src/`, `backend/`, assets and `platform/`. [CLI commands](../../Nelyx/sdk/tooling/cli/README.md#build-and-run-tauri)

## Run on Android

Complete SDK supply and npm installation above, then use the app directory. Install JDK 21, Android Platform 36 for the SDK plugin, Android SDK Platform and Build-Tools 37.0, platform-tools and NDK 30.0.14904198.

```powershell
$env:JAVA_HOME = 'C:\path\to\jdk-21'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:NDK_HOME = Join-Path $env:ANDROID_HOME 'ndk\30.0.14904198'
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"
adb devices -l
rustup target add x86_64-linux-android
npm.cmd run prepare:tauri -- --platform android --architecture x64
npm.cmd run build:tauri -- --platform android --architecture x64
npm.cmd run run:tauri -- --platform android --device emulator-5554
```

On an ARM64 phone use `rustup target add aarch64-linux-android`, change `x64` to `arm64` and pass the phone's serial from `adb devices -l`. USB uses the phone's USB debugging prompt. Wi-Fi pairing is available from Android Studio. [Android wireless debugging](https://developer.android.com/studio/run/device#wireless)

`run:tauri` installs and launches the published debug APK. The architecture-specific directory contains the APK, AAB and signing status.
