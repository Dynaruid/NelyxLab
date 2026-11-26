# Nelyx sample deployment

**English** | [한국어](README.ko.md)

Run `npm run deploy` from the repository root to choose a platform and one of Demo, Testbed, or Testbed3. The helper supplies the SDK and reuses valid app dependencies. It runs `npm install` when the app needs an installation or update. Use `npm.cmd` for npm commands in Windows PowerShell. [Repository setup](../../README.md#run-testbed-or-demo)

```sh
npm run deploy
npm run deploy -- --list
npm run deploy -- --platform web --app Demo
npm run deploy -- --platform windows --app Testbed --no-launch
npm run deploy -- --platform web --app Testbed3
npm run deploy -- --platform android --target emulator --list
npm run deploy -- --platform ios --app Demo --target simulator
```

From another directory, run `node <path-to-NelyxLab>/helpers/deploy-helper/deploy.mjs` with the same options. Use `--platform` and `--app` to skip their menus. A single available mobile destination is selected automatically. For several destinations, use the menu or pass the ID from `--list` to `--device`. Use `q` or Ctrl+C to cancel, and `--dry-run` to print the commands and output location. Mobile dry runs read the destination list before printing the plan.

| Platform | Build and run | `--no-launch` |
| --- | --- | --- |
| Web | Builds `.nelyx/web/` and serves it on `127.0.0.1`. Opens the default browser after the server starts. | Serves the build with a URL you can open manually. |
| Windows | Builds the Tauri x64 EXE and NSIS installer under `.nelyx/tauri/windows-x64/`. Runs the EXE and waits for its window to close. | Builds the packages and exits. |
| Android | Publishes a debug APK in `.nelyx/tauri/android-<architecture>-debug/`. Verifies its ABI and signature, then installs the exact APK and launches it on the selected device. | Builds and installs the APK. |
| iOS | On macOS, builds the simulator app or signed device IPA under `.nelyx/tauri/ios-<architecture>/`. Boots the selected simulator when needed, then installs and launches the app. | Builds and installs the app. |

- **Web.** The server chooses a free port by default. Pass `--port 4173` for a stable URL and `--base /demo/` for a subpath. Ctrl+C stops the preview.
- **Windows.** Install Visual Studio C++ x64 build tools, a Windows SDK, the Rust MSVC target, and WebView2. [Tauri platform setup](../../Nelyx/sdk/tooling/cli/README.md#build-and-run-tauri)
- **Android.** Set `JAVA_HOME`, `ANDROID_HOME`, and `NDK_HOME` for packaging. `--list` uses `ANDROID_HOME` or `ANDROID_SDK_ROOT`, with `adb` on `PATH` as a fallback. The helper reads the device ABI to choose `arm64` or `x64`. Use `--target device` or `--target emulator` to filter the list. Use `build:tauri -- --platform android` to publish an APK and AAB for distribution. [Android setup](../../sample/nelyx-demo-app/README.md#run-on-android)
- **iOS.** Install Xcode and the matching Rust target. Set up an iOS simulator runtime or configure development signing for the physical device. Use `--target simulator` or `--target device` to filter the list. The helper picks `arm64` for a device and `arm64-sim` or `x64-sim` for a simulator according to the Mac CPU. [Tauri platform setup](../../Nelyx/sdk/tooling/cli/README.md#build-and-run-tauri)
