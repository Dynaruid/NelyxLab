# Nelyx Testbed

**English** | [한국어](README.ko.md)

A gallery for exercising Core, Material and Cupertino widgets, including lists, editors and accessibility.

## Prepare and develop

Prepare Node.js 24.x and the pinned CanvasKit and Rust Wasm toolchains. Run from the Nelyx root, then change to this app directory. [SDK setup](../../README.md#run-testbed-or-demo)

```powershell
npm.cmd ci
npm.cmd run build:sdk
npm.cmd run prepare:sample -- --app sample/nelyx-testbed-app-2
Set-Location sample/nelyx-testbed-app-2
npm.cmd ci --workspaces=false
npm.cmd run prepare:web
npm.cmd run typecheck
npm.cmd run dev:web
```

## Web and Tauri

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
