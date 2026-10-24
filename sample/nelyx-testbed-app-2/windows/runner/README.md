# Windows runner

Registers the shared `src/index.ts` application through the Nelyx platform SDK. This runner owns its dependencies, Metro/Babel configuration, and platform build settings.

## Install

From the application root, after supplying local archives with `nelyx supply --app . --target windows --packages <archive-directory>`:

```powershell
npm --prefix windows/runner ci --workspaces=false
```

In the NelyxLab checkout, use `npm run build:sdk` and `npm run prepare:sample -- windows` from the repository root before installing the sample runner.

## Prepare and run

From this runner directory, with matching native inputs available:

```powershell
npx --no-install nelyx prepare --app ../.. --target windows --native-inputs <inputs.json>
npm run check
npm run build
npm run run
```

Native inputs require the exact RNW 0.83.2 / JSI21 x64 Release/MD supplier. Visual Studio C++ tools and the Windows SDK are required. Preparation remembers the manifest for subsequent builds.

Build packages use fixed `../../.nelyx/windows/packages/Release/` or `Debug/` directories. Close an app running from that output before rebuilding. The new package is verified in staging, replaces the same configuration on success, and restores the previous output on failure. Staging and replacement backups are cleaned up after the build.

After binding C++ sources change, the remembered supplier can fail the compiled-source hash check. In the NelyxLab checkout, rebuild it with `python Nelyx/skia/eng/build-windows-rn.py --runner <installed-runner> --supplier Nelyx/skia/vendor/inputs/windows-x64 --output <new-build-directory>`, then prepare with the current `<new-build-directory>/supplier/inputs.json`. A source mismatch requires a matching build input. Retain only the current successful output and remove temporary or superseded outputs after their owners finish.

W7 effects use frame wire 6 with native ABI 1 and additional JSI shader/cubic filter bindings. W6 suppliers, including `w6-rounded-3e2a13223120d3ca`, remain historical inputs and fail the new compiled-source check. Rebuild for the current installed runner with the command above and prepare its new manifest. A supplier build is separate from native application qualification.

The host selects the hardware adapter attached to the primary display by default. Set `NELYX_WINDOWS_GPU_VENDOR` before running to select a vendor explicitly (`4098` for AMD). The startup log identifies the selected adapter; other adapters and display migration require separate qualification.

Use `npm run dev` for the managed Metro/native development session, `npm run bundle` for a bundle, and `npm run pack` to export a built package. Stock Core is the default; private unload patches are not automatically applied. Full reload and complete graphics loss/recovery remain unresolved; qualification is `notVerified`.

App fonts are copied from verified declarations and loaded by Skia from the same bytes/hash. Rebuild after changing app assets. The host has no visible editor component or editor font registry.

ApplicationSurface owns nonvisual TSF protocol3 input and Core semantics protocol2 proxies. Core/Skia paints text, selection, composing underline and caret. From the repository root, `npm run test:windows-input-surface` tests this public surface with actual GPU pixels, TSF/UIA edits, ordered OS-injected keys, resize and input/GPU retirement. Physical IME/reader/FPS and the current sample EXE require separate qualification.
