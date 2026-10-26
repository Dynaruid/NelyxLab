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

The GPU defaults to the hardware adapter attached to the primary display. Set `NELYX_WINDOWS_GPU_VENDOR` before launch to select a vendor explicitly, such as `4098` for AMD.

Full reload, graphics recovery, physical IME, screen readers, and production distribution require further qualification. Consult the installed CLI README for alternate engine and direct-host prerequisites.
