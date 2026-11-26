# Nelyx Testbed 3

**English** | [한국어](README.ko.md)

This sample ports the default Material 3 gallery from `DorotiLab/samples/DorotiTestbedApp` to Nelyx widgets. Components includes interactive button, navigation, selection, input, and image examples. Color, Typography, and Elevation show the current Material theme. Change the theme with a seed color or one of the bundled images. Wide layouts use a navigation rail and two independently scrolling component columns.

Platform views uses HTML host controls to demonstrate overlap and focus. WebView runs local HTML inside an iframe and can open external URLs on the Web target when the destination site permits embedding. Texture displays live frames on a canvas. Camera and WebCodecs depend on host support and permissions. The Acrylic control appears on supported Windows 11 Tauri windows.

## Run

Run from the repository root. [SDK setup](../../README.md#run-testbed-or-demo)

```powershell
npm.cmd run deploy -- --platform web --app Testbed3
npm.cmd run deploy -- --platform windows --app Testbed3
```

Supply the SDK before running the development server from this app directory.

```powershell
npm.cmd run build:sdk
npm.cmd run prepare:sample -- --app sample/nelyx-testbed-app-3
Set-Location sample/nelyx-testbed-app-3
npm.cmd install --workspaces=false
npm.cmd run prepare:web
npm.cmd run typecheck
npm.cmd run dev:web
```

On Windows, run `npm.cmd run dev:tauri -- --platform windows` in the same app directory for Tauri development.

## Credits

- The Material 3 examples follow DorotiTestbedApp and the Flutter samples. [Flutter license](LICENSE.flutter)
- The local sample photograph is by Mae Mu. [Unsplash photo](https://unsplash.com/photos/9002s2VnOAY)
- The six theme images come from the Flutter API documentation. [Image source](https://github.com/flutter/assets-for-api-docs/tree/main/assets/material) · [Asset license](assets/theme/LICENSE.txt)
- Roboto and the FFmpeg `testsrc2` video pattern come from the Doroti sample. [Roboto license](assets/fonts/LICENSE.roboto.txt)
