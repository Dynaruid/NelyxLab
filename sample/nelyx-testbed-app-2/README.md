# Nelyx Testbed

**English** | [한국어](README.ko.md)

A gallery for exercising shared Core, Material and Cupertino widgets, including lists, editors and accessibility.

## Prepare and develop

From the Nelyx root, use Node.js 24.x and the pinned CanvasKit runtime. [SDK setup](../../README.md#run-testbed-or-demo)

```powershell
npm.cmd run build:sdk
npm.cmd run prepare:sample -- web sample/nelyx-testbed-app-2
npm.cmd ci --prefix sample/nelyx-testbed-app-2/web/runner --workspaces=false
npm.cmd run dev --workspace @nelyx/testbed-2
```

## PWA and Tauri

```powershell
npm.cmd run build:pwa --workspace @nelyx/testbed-2
npm.cmd run run:pwa --workspace @nelyx/testbed-2 -- --base /demo/
```

The browser serves the published .nelyx/pwa directory. The PWA ID stays stable across builds. Each OS package consumes that same directory.

```powershell
npm.cmd run prepare:windows --workspace @nelyx/testbed-2
npm.cmd run pack:windows --workspace @nelyx/testbed-2
npm.cmd run run:windows --workspace @nelyx/testbed-2
```

Run dev:windows to open an app window connected to Vite. Android, Linux, macOS and iOS use the corresponding prepare, pack, run and dev scripts with their platform tools. On Windows, npm.cmd run build:windows runs the PWA build followed by pack:windows. [CLI commands](../../Nelyx/sdk/tooling/cli/README.md#add-a-tauri-host)

The app owns its sources, assets, notices and src-tauri configuration. [Core and package licenses](../../README.md#project-layout)
