# Nelyx Testbed 3

**English** | [한국어](README.ko.md)

This sample ports the default Material 3 gallery from `DorotiLab/samples/DorotiTestbedApp` to Nelyx widgets. Components includes interactive button, navigation, selection, input, and image examples. Color, Typography, and Elevation show the current Material theme. Change the theme with a seed color or one of the bundled images. Wide layouts use a navigation rail and two independently scrolling component columns.

Platform views uses HTML host controls to demonstrate overlap and focus. WebView runs local HTML inside an iframe and can open external URLs on the Web target when the destination site permits embedding. Texture displays live frames on a canvas. Camera and WebCodecs depend on host support and permissions. The Acrylic control appears on supported Windows 11 Tauri windows.

## Composited views

Open **Composited views** from the navigation bar. On the compact rail, select the last layers icon. The **+** buttons increment the Nelyx counter. The editor and iframe receive input through the tinted cards outside those buttons. Use **Hide overlay**, **Reverse views**, and scrolling to check that the controls preserve their state. **Open composited views modal** blocks pointer and Tab access to the controls beneath it.

The Web and Tauri WebView targets share the same `PlatformView` widgets and DOM factories. On the Web target, the `platformFrame` query parameter accepts an HTTP(S) fixture on a different origin that posts a ready message. The sample verifies the message origin and source before reporting readiness. Tauri loads the bundled HTML document. [Widgets and factories](src/platform-views.ts) · [Acceptance criteria](../../history/26/11/27/work9-summary.md#수락-기준)

Select **Open Win32 editor demo**, **Open Android editor demo**, or **Open GTK editor demo** to run the same `+` overlay over a system editor. Windows displays the layered Win32 `EDIT` beside WebView2 and draws the card in DirectComposition. Android uses `EditText` and a transparent `TextureView`. Its scrollable demo uses the native keyboard inset while the soft keyboard is open. Linux uses `GtkTextView` and a transparent Skia foreground in `GtkOverlay`. Scroll the GTK demo in a short window to clip the editor at the viewport edge. [Platform verification](../../history/26/11/27/work9-summary.md#플랫폼별-검증)

On iOS, select **Open UIKit editor demo** to exercise the overlay over a `UITextView`. The demo scroll region accounts for the native keyboard inset. On macOS, select **Open AppKit editor demo** to exercise it over an `NSTextView`. The Apple host puts the editor and a transparent `CAMetalLayer` beside WKWebView. Packaged rendering, keyboard behavior, and VoiceOver still require verification on an Xcode host. [Apple run commands](../../history/26/11/27/work9-summary.md#apple-실행-명령)

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

On Windows, run `npm.cmd run dev:tauri -- --platform windows` in the same app directory for Tauri development. On a Linux build host with GTK 3 and WebKitGTK 4.1 development packages, run the following from the supplied app directory.

```sh
npm run prepare:tauri -- --platform linux
npm run build:tauri -- --platform linux
npm run run:tauri -- --platform linux
```

## Credits

- The Material 3 examples follow DorotiTestbedApp and the Flutter samples. [Flutter license](LICENSE.flutter)
- The local sample photograph is by Mae Mu. [Unsplash photo](https://unsplash.com/photos/9002s2VnOAY)
- The six theme images come from the Flutter API documentation. [Image source](https://github.com/flutter/assets-for-api-docs/tree/main/assets/material) · [Asset license](assets/theme/LICENSE.txt)
- Roboto and the FFmpeg `testsrc2` video pattern come from the Doroti sample. [Roboto license](assets/fonts/LICENSE.roboto.txt)
