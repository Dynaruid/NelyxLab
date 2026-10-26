# Android runner

Registers the shared `src/index.ts` application through the Nelyx platform SDK. This runner owns its dependencies, Metro/Babel configuration, and platform build settings.

## Install

From the application root, after supplying the Nelyx archives and pinned Android Graphite dependency:

```powershell
npm --prefix android/runner ci --workspaces=false
```

In NelyxLab, use `npm run build:sdk` and `npm run prepare:sample -- android` from the repository root first. Prepare JDK 21, Android SDK/build tools 36, NDK 27.1.12297006, and an emulator or device visible to `adb devices -l`.

The sample's local Android supplier archive referenced by `package.json` must also exist before installation. Android `prepare:sample` refreshes the Nelyx archives only; keep the native supplier pinned to 154.1.0.

## Build and run

From this runner directory, for the sample's `emulator-vulkan` profile:

```powershell
npm run check
npx --no-install nelyx build --app ../.. --target android --architecture x86_64 --configuration Release
npx --no-install nelyx run --app ../.. --target android --device emulator-5554
```

Replace `emulator-5554` with the serial from `adb devices -l`. A physical ARM64 application needs a matching profile and architecture. The low-level `npm run build -- --architecture x86_64 --configuration Release` produces an APK; CLI `build` additionally packages and registers it for CLI `run`/`pack`.

The runner also supplies `bundle`, `start`, and `prepare:native`. Its `run` script delegates to React Native's launcher, whose flags differ from the Nelyx CLI. Builds use a local development key; physical input, Korean IME, accessibility, and production signing remain unverified.
