# Windows runner

Connects the shared application to the Nelyx Windows SDK. This runner owns dependencies, Metro/Babel configuration, and build scripts.

## Install

From the application root, after supplying compatible archives:

```powershell
npm --prefix windows/runner ci --workspaces=false
```

For a new app without a runner lockfile, use `install --workspaces=false` once. In NelyxLab, build the SDK and run `npm run prepare:sample -- windows` from the repository root before installing the sample runner.

## Prepare and run

Use Visual Studio C++ tools, the Windows SDK, and a matching RNW 0.83.2 / JSI21 x64 Release/MD renderer supplier. From this runner directory:

```text
npx --no-install nelyx prepare --app ../.. --target windows --native-inputs <inputs.json>
npm run check
npm run build
npm run run
```

The default is Hermes bytecode with the optimized Release profile on RNW. Preparation remembers the native-input manifest. After changing native sources, rebuild the supplier against the installed packages and prepare its new manifest.

Build output uses fixed `../../.nelyx/windows/packages/Release/` and `Debug/` directories. Close an app running from that output before rebuilding. Use `npm run dev` for the Hermes Metro/native Debug session and `npm run pack` to export a built package.

## Input and graphics

Core/Skia paints the interface, text, selection, composing underline, and caret. The SDK connects nonvisual TSF editing and UIA semantics to that geometry. Declared font bytes are verified and loaded by Skia; rebuild after changing assets.

The app declares `windowViewport` on its full-window `ApplicationSurface`. Its native HWND supplies resize metrics directly and presents the Skia surface through a native composition target on that window. Mount a declared window surface at the untransformed client origin and remount to change ownership. Leave the option unset for an embedded surface that follows Fabric layout. Generated Windows app templates include the full-window declaration.

The GPU defaults to the hardware adapter attached to the primary display. Set `NELYX_WINDOWS_GPU_VENDOR` before launch to select a vendor explicitly, such as `4098` for AMD.

Full reload, graphics recovery, physical IME, screen readers, and production distribution require further qualification. Consult the installed CLI README for alternate engine and direct-host prerequisites.

## NelyxLab live resize regression

The regression first injects a real OS click and requires the Core button action to run. Its text probe follows connected glyph strokes through a calibrated text row, separating unrelated pointer overlays. The standalone glyph test still rejects vertical/horizontal stretching, translated text and exposed backgrounds; the native pointer test checks coordinate mapping, wheel packets, capture cancellation and retirement.

After supplying and installing the current Windows packages, run from the repository root:

```powershell
$env:NELYX_ANIMATION_MODE='live-resize'
try {
    node --test --test-timeout=1200000 Nelyx/eng/tests/windows-animation.test.mjs
} finally {
    Remove-Item Env:NELYX_ANIMATION_MODE -ErrorAction SilentlyContinue
}
```

This takes foreground focus and drags the sample's bottom-right and top-left borders on Material, ListView, and Cupertino pages. It checks exact content dimensions when window geometry commits, proposed-frame preparation deadlines, frame retirement, cancellation recovery and clean shutdown. Windows Graphics Capture samples a fixed-size desktop frame; temporary native caption/border colors identify the displayed client bounds in the same pixels. Inspection is limited to the owned window's header region, and the native colors are restored afterward. Header glyph dimensions, dark window-background exposure and a fixture-only two-pixel marker with a reserved color at the right edge detect stretching, padding and stale content on the default light pages. This marker avoids confusing scrollbar/thumb/icon pixels with its layout position and is absent from the product app. No captured images are retained. The drag stays inside one responsive layout range. It reports update gaps, resize latency, distinct captured widths and geometry mismatches. Sampled desktop frames do not measure full display scanout or every displayed frame.
