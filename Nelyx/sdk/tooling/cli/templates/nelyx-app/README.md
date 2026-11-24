# Nelyx application

Run `npm ci --workspaces=false` in this directory after supplying the SDK. The UI entry is `src/index.ts`. Register shared Rust commands in `backend/src/lib.rs` when the app has a backend directory.

For a declared Web target use `npm run prepare:web`, `npm run dev:web`, `npm run build:web` and `npm run run:web`. For a declared Tauri target on Windows use `npm run prepare:tauri -- --platform windows`, `npm run build:tauri -- --platform windows` and `npm run run:tauri -- --platform windows`. Select the platform that matches your toolchain. Commit the generated Cargo locks in `backend/locks/`.

In a Tauri app, set `haptics: true` and `androidBack: true` on the desired entry in `nelyx.targets.tauri.windows` to enable mobile haptics and Android system Back handling. Update the Cargo lock with `npm run prepare:tauri -- --platform android --update-lock`. The starter's Copy and Paste buttons use the standard widget clipboard API. Set the window's `clipboard.read` or `clipboard.write` to `false` to disable that native action, or omit the clipboard setting to use the WebView clipboard.
