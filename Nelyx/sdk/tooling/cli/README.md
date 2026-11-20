# Nelyx CLI

**English** | [한국어](README.ko.md)

## Generate and supply

Prepare the pinned CanvasKit runtime, then run from the Nelyx checkout.

```
npm.cmd ci
npm.cmd run build:sdk
npm.cmd run pack:sdk -- C:/dev/nelyx-packages
node Nelyx/sdk/tooling/cli/src/main.mjs create C:/dev/MyApp --name MyApp --packages C:/dev/nelyx-packages
Set-Location C:/dev/MyApp/web/runner
npm.cmd ci --workspaces=false
npx.cmd --no-install nelyx prepare --app ../..
npm.cmd run typecheck
npx.cmd --no-install nelyx dev --app ../..
```

The starter includes both design packages. Use --designs none, --designs material or --designs cupertino to select the starter dependencies. To update an installed runner, run nelyx supply --app ../.. --packages C:/dev/nelyx-packages followed by npm.cmd ci --workspaces=false. On Linux and macOS use npm and npx.

## Publish the PWA

```
npx.cmd --no-install nelyx build --app ../..
npx.cmd --no-install nelyx run --app ../.. --base /demo/
```

Build writes .nelyx/pwa. Deploy the full directory over HTTPS. Use the installation action in the browser and wait for the service worker to finish caching before testing offline. Root and subdirectory deployments use the same bytes. Path-based navigation needs an HTML fallback for application routes with a base URL matching the deployed directory. Return 404 for missing assets and revalidate sw.js, HTML and files with fixed names.

## Add a Tauri host

In the app root run npm.cmd install --save-dev --save-exact @tauri-apps/cli@2.12.6. From web/runner:

```
npx.cmd --no-install nelyx prepare --app ../.. --platform windows
npx.cmd --no-install nelyx doctor --app ../.. --platform windows
npx.cmd --no-install nelyx pack --app ../.. --platform windows --package ../../.nelyx/pwa
npx.cmd --no-install nelyx run --app ../.. --platform windows
```

Use `dev --platform windows` to open the app's Vite session in a WebView. Desktop packaging requires the named OS, and iOS uses Xcode on macOS.

Android requires a JDK, SDK, NDK, adb and a Rust Android target. Pack with `--architecture x64` for an x86_64 emulator or `--architecture arm64` for an arm64 device. For `dev` and `run`, `--device` accepts an adb serial and the CLI reads its ABI. Tauri development also uses the AVD or phone name, so the chosen device must have a unique name among connected devices. The APK uses the local debug signing configuration. The AAB uses the app's release signing configuration.

Use `--architecture arm64-sim` or `x64-sim` for iOS Simulator. For physical iOS development, pass `--architecture arm64`, the device name in `--device` and a device-reachable `--host` with trusted HTTPS. For `run`, use the device identifier. iOS packaging accepts `--export-method debugging`, `release-testing` or `app-store-connect`.

Preparation preserves the existing src-tauri project. App-owned Tauri and platform config files control identifiers, capabilities, icons and signing. The CLI owns the frontend build and dev server, so remove beforeBuildCommand, beforeBundleCommand and beforeDevCommand for these commands. The published directory is .nelyx/tauri/<os>-<architecture>.

## Migrate a v2 Web app

Keep app sources and replace the Web runner inputs with the starter index.html, vite.config.ts and Vite entry wiring. Move custom resolver or transformer settings into Vite plugins and use React imports and DOM elements in the runner. Supply the new archives and reinstall the runner. A v2 targets.web component is read in memory, and the old cohort override must be removed. Move native target settings into app-owned Tauri config files. Run doctor for migration guidance.

See the [platform prerequisites](https://v2.tauri.app/start/prerequisites/) and [qualification records](../../../../work3.md#7-최종-인수와-현재-상태).
