# Nelyx application

**English** | [한국어](README.ko.md)

This application shares TypeScript state and drawing commands in `src/`, with independent platform runners. `src/index.ts` exports the shared `main()` entrypoint; root `package.json` → `nelyx` declares application metadata, assets, profiles, and runtime cohorts. Each `<target>/runner/main.ts(x)` imports its component and calls `registerApplication` directly.

Nelyx brings Flutter-inspired widgets and rendering to TypeScript. This template uses the shared Widget/Element/RenderObject framework for the counter, editors, drawing/text/traversal labs and navigation. Open Keyboard lab → Actions and focus for inherited overrides, prioritized actions, live shortcut registration and focus/hover highlights. Full Flutter APIs and platform acceptance remain incomplete. Use Core0.16.0, SDK0.20.0, Skia0.6.0 and Metro/CLI0.10.0 together; native ABI1/frame wire9/text-style1/boundary2/paragraph API2 and Android keyboard2/semantics1 are required. Rebuild the RN binding and shared native core together. The owned Web runtime uses its separately versioned paragraph API1.

The root `package.json` is the application configuration source; `app.json`, `application.json`, `nelyx.config.ts` and root bootstrap files are unnecessary. Keep the npm package `name` separate from `nelyx.name`, which must match the native application registration name. `nelyx.displayName` retains the human-readable label. When adding bundled images (or fonts on Apple/Linux), add literal `require` entries to the runner main asset map so Metro includes their bytes. Windows maps all declared assets to host URIs; Android maps declared fonts to hash-qualified native asset URIs. CLI preparation still writes build-owned `runner/app-config.json` for native build tools; edit the root package configuration and rerun prepare to refresh it.

Asset and notice `sha256` fields are optional and are omitted from the starter configuration. Runner preparation, type checking and Metro startup calculate them from the current files and write portable runtime metadata to generated `runner/app-config.json`; they never add hashes to the root package. Each runner main validates that generated asset metadata before registration. Package assets are compared with their installed source bytes before copying, and existing edited destinations are preserved and rejected. Explicit hash pins, when supplied, are still checked.

## Get started

Use Node.js **>=24.3.0 <25** and npm. Follow the guide for the target selected during app creation:

| Target | Runner guide |
| --- | --- |
| Web | [Browser development and static builds](web/runner/README.md) |
| Windows | [Native inputs, build, and execution](windows/runner/README.md) |
| Android | [SDK/NDK, architectures, and APK packaging](android/runner/README.md) |
| iOS | [Xcode, Pods, and simulator build](ios/runner/README.md) |
| macOS | [Xcode, Pods, and native build](macos/runner/README.md) |
| Linux | [RNL supply, native inputs, and GTK host](linux/runner/README.md) |

Supply package archives and generate the runner lockfile before installing with `npm ci --workspaces=false`. Install dependencies inside the selected runner. Additional targets require entries in root `package.json` → `nelyx` and matching package/native inputs.

For Web, after supplying the selected runner, run from the application root:

```powershell
npm --prefix web/runner ci --workspaces=false
npm --prefix web/runner run check
npm --prefix web/runner run dev
```

Open `http://127.0.0.1:8081/`; Ctrl+C stops the server. See the runner guide for native targets or CLI-managed packages.

## Application ownership

Keep common application logic in `src/` and platform registration/build configuration in `<target>/runner/`. Import explicit modules such as `@nelyx/core/ui/types` and `@nelyx/sdk/platforms/web/application`. The SDK connects application and host lifetimes; Skia owns renderer/GPU resources. Generated package supply and output live in `.nelyx/`.

Nelyx is experimental. Provider qualification remains `notVerified`; builds and sample execution do not establish physical input, IME, accessibility, GPU presentation, or production signing acceptance. Retain imported font, runtime, and renderer licenses when distributing the application.
