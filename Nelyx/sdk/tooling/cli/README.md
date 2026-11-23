# Nelyx CLI

**English** | [한국어](README.ko.md)

## Create and supply an app

Build the SDK with the pinned CanvasKit and Wasm toolchains, then run these commands from the Nelyx checkout.

```powershell
npm.cmd ci
npm.cmd run build:sdk
npm.cmd run pack:sdk -- C:/dev/nelyx-packages
node Nelyx/sdk/tooling/cli/src/main.mjs create C:/dev/MyApp --name MyApp --packages C:/dev/nelyx-packages
Set-Location C:/dev/MyApp
npm.cmd ci --workspaces=false
npx.cmd --no-install nelyx prepare --app . --target web
npm.cmd run typecheck
npx.cmd --no-install nelyx dev --app . --target web
```

`create` includes both design packages and both targets by default. Set `--designs none`, `--designs material` or `--designs cupertino` to choose a smaller starter. Choose `--target web --static --no-backend` for a regular website that uses the supplied default Wasm. Choose `--target tauri` for an installed app. On Linux and macOS use `npm` and `npx`.

Use `nelyx supply --app . --packages C:/dev/nelyx-packages` followed by `npm.cmd ci --workspaces=false` to update the SDK. Commit the app's npm lock and the `backend/locks/<target>/Cargo.lock` files produced by `prepare`. When Cargo dependencies change, run `prepare --update-lock` for each affected target. The build restores the selected lock and invokes Cargo with `--locked`.

## Publish Web

```powershell
npx.cmd --no-install nelyx build --app . --target web
npx.cmd --no-install nelyx run --app . --target web --base /demo/
```

Deploy the full `.nelyx/web/` directory. Set the Wasm MIME type to `application/wasm`. For application route fallback use the deployment directory as the HTML base, and return 404 for missing assets. A `targets.web.pwa` declaration adds the manifest and service worker. The worker verifies all cached files, including the app backend Wasm. Refresh fixed-name assets and `sw.js` through cache revalidation.

## Build and run Tauri

```powershell
npx.cmd --no-install nelyx prepare --app . --target tauri --platform windows
npx.cmd --no-install nelyx doctor --app . --target tauri --platform windows
npx.cmd --no-install nelyx build --app . --target tauri --platform windows
npx.cmd --no-install nelyx run --app . --target tauri --platform windows
```

Use `dev --target tauri --platform windows` for a WebView attached to Vite. For CI, use `build --target tauri --frontend-only` to publish `.nelyx/tauri/frontend/` and `pack --target tauri --platform <os> --frontend <directory>` from the same app source and SDK supply. The CLI generates `.nelyx/tauri/host/`, restores Cargo.lock, invokes the app's installed Tauri CLI and publishes packages under `.nelyx/tauri/<os>-<architecture>/`. The package metadata records the embedded frontend build ID and Rust target.

Set the identifier, window sizes and app capabilities in `targets.tauri`. A window can declare `clipboard: { read: true, write: true }`, `safeArea: true` and `windowTitle`. Place custom icons in `platform/icons/`. Place Android and Apple overrides relative to the generated project in `platform/android/project/` and `platform/ios/project/`. Optional `platform/<os>/tauri.conf.json` files accept bundle settings and CSP. Keep signing keys in the platform toolchain or build environment.

Use `--architecture x64` for an Android x86_64 emulator and `arm64` for a physical ARM64 device. For `dev` and `run`, pass the ADB serial in `--device`. Android dev also uses the unique AVD or phone name to select a device. For iOS use `arm64-sim` or `x64-sim` on a simulator. Physical iOS dev requires a reachable `--host` over trusted HTTPS and the device name. Physical run takes the device identifier. [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)
