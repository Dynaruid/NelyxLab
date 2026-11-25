# Nelyx

**English** | [한국어](README.ko.md)

Nelyx brings Flutter's widget and rendering model to TypeScript. React DOM hosts the shared widget tree and CanvasKit/Ganesh renders it. An app uses `src/index.ts` for its UI and `backend/src/lib.rs` for shared Rust commands. The Web target calls Rust through Wasm. The Tauri target links it into the generated native host.

## Run Testbed or Demo

Use Node.js 24.3 or later in the 24.x range and npm 11. `npm install` installs the pinned CanvasKit runtime. To build the SDK, install the Rust Wasm target and wasm-bindgen-cli 0.2.128. [CanvasKit runtime](Nelyx/skia/README.md)

From the repository root in PowerShell, build and supply either sample. The root build commands supply the SDK and reuse the app's installed dependencies when they match. They run `npm install` in the app directory when an update is needed.

```powershell
npm.cmd install
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.128 --locked
npm.cmd run build:web -- --app sample/nelyx-demo-app
npm.cmd run build:tauri -- --app sample/nelyx-demo-app --platform windows
```

The app root owns the development commands. Run the one for the target you want to open.

```powershell
Set-Location sample/nelyx-demo-app
npm.cmd run dev:web
npm.cmd run dev:tauri -- --platform windows
npm.cmd run run:web -- --base /demo/
npm.cmd run run:tauri -- --platform windows
```

Compatible `build()` edits in app-owned TypeScript widgets reload in the current Web or Tauri view. The CLI reports the reason for a document or host restart and records which build stages ran or reused verified output. [Nelyx CLI development guide](Nelyx/sdk/tooling/cli/README.md#develop-the-app)

### Sample deployment helper

Run `npm.cmd run deploy` to choose Demo or Testbed and deploy to Web, Windows, Android, or iOS. Use `npm run deploy` on macOS and Linux. [Deployment options and prerequisites](helpers/deploy-helper/README.md)

### Run Demo on Android

Install the Android prerequisites. Use `--architecture x64` for an x86_64 emulator and `arm64` for an ARM64 phone. Pass the ADB serial to `run:tauri`. [Demo Android setup](sample/nelyx-demo-app/README.md#run-on-android)

## Project layout

| Path | Purpose |
| --- | --- |
| [Nelyx](Nelyx/README.md) | Core TypeScript framework |
| [Nelyx/sdk](Nelyx/sdk/README.md) | DOM frontend, host services and assets |
| [Nelyx/backend](Nelyx/backend/) | Common Rust API, Wasm adapter and Tauri plugin |
| [Nelyx/skia](Nelyx/skia/README.md) | Pinned CanvasKit supply and rendering |
| [CLI](Nelyx/sdk/tooling/cli/README.md) | Starter, supply and platform commands |
| [Material](packages/material/README.md) and [Cupertino](packages/cupertino/README.md) | Design packages |
| [Demo](sample/nelyx-demo-app/README.md) and [Testbed](sample/nelyx-testbed-app-2/README.md) | Sample applications |
| [Current work and verification](work.md) | Build changes and platform results |
| [Development history](history/README.md) | Previous changes |

Nelyx code uses BSD 3-Clause. Imported code retains its notices. [License](Nelyx/LICENSE.md) · [Skia notices](Nelyx/skia/THIRD_PARTY_NOTICES.md)
