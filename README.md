# Nelyx

**English** | [한국어](README.ko.md)

Nelyx brings Flutter's widget and rendering model to TypeScript. A shared Widget, Element and RenderObject tree powers Material and Cupertino applications. React DOM owns the browser surface, and CanvasKit/Ganesh renders it with WebGL2. A Vite PWA runs in the browser and can be embedded in a Tauri application.

## Run Testbed or Demo

Use Node.js 24.3 or later in the 24.x range and npm 11. Prepare the pinned CanvasKit JS and Wasm on a fresh checkout. [CanvasKit source build](Nelyx/skia/eng/source-build/README.md)

From the repository root in PowerShell:

```
npm.cmd ci
npm.cmd run build:sdk
npm.cmd run prepare:sample -- web
npm.cmd ci --prefix sample/nelyx-testbed-app-2/web/runner --workspaces=false
npm.cmd run dev --workspace @nelyx/testbed-2
```

Open the development URL printed by the command. For a browser installation or distribution, build the PWA and serve its output.

```
npm.cmd run build:pwa --workspace @nelyx/testbed-2
npm.cmd run run:pwa --workspace @nelyx/testbed-2 -- --base /demo/
```

Package the existing PWA for Windows from the repository root. Tauri CLI and the OS toolchain are needed for this step.

```
npm.cmd run prepare:windows --workspace @nelyx/testbed-2
npm.cmd run pack:windows --workspace @nelyx/testbed-2
npm.cmd run run:windows --workspace @nelyx/testbed-2
```

## Project layout

| Path | Purpose |
| --- | --- |
| [Nelyx](Nelyx/README.md) | Core TypeScript framework |
| [Nelyx/sdk](Nelyx/sdk/README.md) | React DOM surface, browser services and assets |
| [Nelyx/skia](Nelyx/skia/README.md) | Pinned CanvasKit supply and rendering |
| [CLI](Nelyx/sdk/tooling/cli/README.md) | Starter creation, SDK supply, Vite and Tauri commands |
| [Material](packages/material/README.md) and [Cupertino](packages/cupertino/README.md) | Design packages |
| [Demo](sample/nelyx-demo-app/README.md) and [Testbed](sample/nelyx-testbed-app-2/README.md) | Sample applications |
| [Platform qualification](work3.md#7-최종-인수와-현재-상태) | Packaging and test coverage by environment |
| [Development history](history/README.md) | Previous plans and implementation records |

Nelyx-authored code uses BSD 3-Clause. Imported code retains its notices. [License](Nelyx/LICENSE.md) · [Skia notices](Nelyx/skia/THIRD_PARTY_NOTICES.md)
