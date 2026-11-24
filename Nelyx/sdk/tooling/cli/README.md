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

Pass `--port 0` to `run` to have the preview server bind a free port.

Deploy the full `.nelyx/web/` directory. Set the Wasm MIME type to `application/wasm`. For application route fallback use the deployment directory as the HTML base, and return 404 for missing assets. A `targets.web.pwa` declaration adds the manifest and service worker. The worker verifies all cached files, including the app backend Wasm. Refresh fixed-name assets and `sw.js` through cache revalidation.

### Web rendering and cross-origin isolation

Web rendering defaults to `direct`. Add `?renderMode=auto` to the app URL or set `renderMode: 'auto'` in the SDK's `ApplicationSurface` options to probe the dedicated worker and WebGL2 for the view. The SDK uses shared slots when the document and worker are isolated and the shared-memory round trip succeeds. A successful worker WebGL2 probe also supports transfer buffers. The SDK renders on the main thread when the worker path is unavailable. Use `worker-transfer` or `worker-shared` to compare paths with fallback enabled.

Set `nelyx.crossOriginIsolated` in the app's `package.json`. The default, `true`, adds `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` to web development and preview responses and to the Tauri app. Set it to `false` and restart the server or rebuild Tauri to disable the policy. With the setting disabled, pass `--cross-origin-isolated` to `nelyx dev` or `nelyx run` for a web session to enable it. The renderer checks shared-memory support separately at runtime.

For static web deployment, serve these headers on documents and worker scripts over HTTPS. Cross-origin assets need CORS or CORP according to how they are requested. Check embedding documents and iframe permissions. COOP `same-origin` severs the `window.opener` relationship with popups on other origins. [Cross-origin isolation deployment](https://web.dev/articles/coop-coep)

If the deployment uses CSP, check that it allows the same-origin render worker and the verified blob script used to initialize CanvasKit. PWAs revalidate the cached release's documents and render worker to pick up policy changes. Read the selected path, isolation, fallback reasons and frame metrics in `readWebApplicationDiagnostics()` or the application's `rendering` property.

In isolated WebViews that hide the global `SharedArrayBuffer` constructor, the SDK obtains it from shared `WebAssembly.Memory` and runs the same round-trip probe. The iOS Tauri Demo requests `auto` by default in an isolated context and honors the rendering preference saved by the app's toggle.

## Build and run Tauri

```powershell
npx.cmd --no-install nelyx prepare --app . --target tauri --platform windows
npx.cmd --no-install nelyx doctor --app . --target tauri --platform windows
npx.cmd --no-install nelyx build --app . --target tauri --platform windows
npx.cmd --no-install nelyx run --app . --target tauri --platform windows
```

Use `dev --target tauri --platform windows` for a WebView attached to Vite. For CI, use `build --target tauri --frontend-only` to publish `.nelyx/tauri/frontend/` and `pack --target tauri --platform <os> --frontend <directory>` from the same app source and SDK supply. The CLI generates `.nelyx/tauri/host/`, restores Cargo.lock, invokes the app's installed Tauri CLI and publishes packages under `.nelyx/tauri/<os>-<architecture>/`. The package metadata records the embedded frontend build ID and Rust target.

Set the identifier, window sizes and app capabilities in `targets.tauri`. This entry in `targets.tauri.windows` enables text clipboard, Android safe area, mobile haptics and Android system Back for the `main` WebView.

```json
{
  "label": "main",
  "clipboard": { "read": true, "write": true },
  "safeArea": true,
  "haptics": true,
  "androidBack": true
}
```

Omit `clipboard` to use the WebView clipboard. Each explicit `false` disables that action. Omit `haptics` to use WebView vibration, or set it to `false` to disable feedback. With `haptics: true`, Android and iOS use the native plugin and desktop calls complete quietly. Android registers a system Back listener while a framework owner requests it. The generated ACL is scoped to the declared WebView labels. Re-run `prepare --target tauri --platform <os> --update-lock` when adopting the plugin.

Use `deviceServices` on each `targets.tauri.windows[]` entry to enable services, for example `["location", "files", "store"]`. The host adds the required plugins and permissions for those WebViews. For iOS add app-authored `targets.tauri.deviceUsage` descriptions for the selected `location`, `camera` or `barcode`, `nfc` and `biometrics` services. Use the `camera` description for barcode. For incoming links, enable `deepLinks` on the window and set `targets.tauri.deepLinks.schemes`. Optional `domains` entries have `host` and `pathPrefix` fields. Associated HTTPS domains need the platform association files and signing configuration. [Tauri Deep Linking](https://v2.tauri.app/plugin/deep-linking/)

Place custom icons in `platform/icons/`. Place Android and Apple overrides relative to the generated project in `platform/android/project/` and `platform/ios/project/`. Optional `platform/<os>/tauri.conf.json` files accept bundle settings and CSP. Keep signing keys in the platform toolchain or build environment.

For Android and iOS, `run --no-launch` installs the published app and exits.

Use `--architecture x64` for an Android x86_64 emulator and `arm64` for a physical ARM64 device. For `dev` and `run`, pass the ADB serial in `--device`. Android dev also uses the unique AVD or phone name to select a device. For iOS use `arm64-sim` or `x64-sim` on a simulator. Physical iOS dev requires a reachable `--host` over trusted HTTPS and the device name. Physical run takes the device identifier. [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)
