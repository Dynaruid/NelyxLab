# Nelyx Demo

**English** | [한국어](README.ko.md)

Switch between the Material and Cupertino component galleries using the bottom tabs. The Cupertino gallery includes text selection, switches, a slider, segmented controls, an action sheet and a dialog.

## Prepare and develop

From the Nelyx root, use Node.js 24.x and the pinned CanvasKit runtime. [SDK setup](../../README.md#run-testbed-or-demo)

```powershell
npm.cmd ci
npm.cmd run build:sdk
npm.cmd run prepare:sample -- web sample/nelyx-demo-app
npm.cmd ci --prefix sample/nelyx-demo-app/web/runner --workspaces=false
npm.cmd run dev --workspace @nelyx/demo
```

## PWA and Tauri

```powershell
npm.cmd run build:pwa --workspace @nelyx/demo
npm.cmd run run:pwa --workspace @nelyx/demo -- --base /demo/
```

The browser serves the published .nelyx/pwa directory. The PWA ID stays stable across builds. Each OS package consumes that same directory.

```powershell
npm.cmd run prepare:windows --workspace @nelyx/demo
npm.cmd run pack:windows --workspace @nelyx/demo
npm.cmd run run:windows --workspace @nelyx/demo
```

Run dev:windows to open an app window connected to Vite. Linux, macOS and iOS use the corresponding prepare, pack, run and dev scripts with their platform tools. On Windows, npm.cmd run build:windows runs the PWA build followed by pack:windows. [CLI commands](../../Nelyx/sdk/tooling/cli/README.md#add-a-tauri-host)

The app owns its sources, assets, notices and src-tauri configuration. [Core and package licenses](../../README.md#project-layout)

## Run on Android

From the repository root, follow [Prepare and develop](#prepare-and-develop) through the Demo runner's `npm.cmd ci` command. Install JDK 21 (such as Temurin), Rust with `rustup`, and the following packages in Android Studio's SDK Manager. Install Android Emulator and an x86_64 system image to run an x86_64 emulator.

- Android SDK Platform 37.0 and Build-Tools 37.0.0
- Android SDK Platform-Tools (ADB)
- NDK 30.0.14904198

In PowerShell, set `JAVA_HOME` to your JDK directory and adjust `ANDROID_HOME` if your SDK is installed elsewhere. Run the remaining commands in the same shell.

```powershell
$env:JAVA_HOME = 'C:\path\to\jdk-21'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:NDK_HOME = Join-Path $env:ANDROID_HOME 'ndk\30.0.14904198'
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"
```

### x86_64 emulator

Start an x86_64 virtual device in Android Studio's Device Manager. Check that `adb devices -l` lists it with status `device`. Replace `emulator-5554` if your emulator has a different serial.

```powershell
adb devices -l
rustup target add x86_64-linux-android
npm.cmd run prepare:android --workspace @nelyx/demo -- --architecture x64
npm.cmd run build:android --workspace @nelyx/demo -- --architecture x64
npm.cmd run run:android --workspace @nelyx/demo -- --device emulator-5554
```

### ARM64 phone

- For USB, enable USB debugging in Developer options, connect the phone and approve the debugging prompt on the phone.
- On Android 11 or later, connect the phone and computer to the same Wi-Fi network, enable Wireless debugging on the phone and pair it using **Pair Devices Using Wi-Fi** in Android Studio. [Android wireless debugging](https://developer.android.com/studio/run/device#wireless)

When prompted, enter the serial from the first column of `adb devices -l` for the phone with status `device`.

```powershell
adb devices -l
$device = Read-Host 'Phone ADB serial'
rustup target add aarch64-linux-android
npm.cmd run prepare:android --workspace @nelyx/demo -- --architecture arm64
npm.cmd run build:android --workspace @nelyx/demo -- --architecture arm64
npm.cmd run run:android --workspace @nelyx/demo -- --device $device
```

`build:android` builds the PWA and packages it with Tauri. `run:android` installs the signed debug APK and opens the app on the selected device. To run an existing build again, repeat the `run:android` command. The `app-universal-debug.apk` file is under `sample/nelyx-demo-app/.nelyx/tauri/android-x64/` or `sample/nelyx-demo-app/.nelyx/tauri/android-arm64/`.
