# Nelyx application

**English** | [한국어](README.ko.md)

A Nelyx starter application with shared TypeScript UI, state, editors, drawing/text/keyboard examples, and navigation. Edit `src/index.ts` and the other modules in `src/` to build the shared interface.

Each platform has an independent runner for dependencies, registration, and native or browser build configuration.

## Get started

Use Node.js **>=24.3.0 <25** and npm. For a newly created Web app, run from the application root:

```powershell
npm --prefix web/runner install --workspaces=false
npm --prefix web/runner run check
npm --prefix web/runner run dev
```

Open `http://127.0.0.1:8081/`; Ctrl+C stops the server. Use `npm --prefix web/runner run build` for static output.

For an application whose runner already has a supplied lockfile, use `npm ci --workspaces=false` inside that runner. Supply compatible package archives and native inputs before building a native target.

## Platform guides

Follow the guide for the target selected during app creation:

| Target | Runner guide |
| --- | --- |
| Web | [Development and static builds](web/runner/README.md) |
| Windows | [Native inputs, builds, and execution](windows/runner/README.md) |
| Android | [SDK/NDK and APK builds](android/runner/README.md) |
| iOS | [Xcode, Pods, and simulator builds](ios/runner/README.md) |
| macOS | [Xcode, Pods, and native builds](macos/runner/README.md) |
| Linux | [RNL supply and the GTK host](linux/runner/README.md) |

Windows uses Hermes bytecode on RNW by default. Alternate engines and the experimental direct Hermes host require explicit CLI options and matching suppliers.

## Application configuration

Root `package.json` → `nelyx` declares the app entrypoint, native registration name, display name, assets, and target profiles. Each `<target>/runner/main.ts(x)` registers its platform component.

Edit that root configuration and rerun preparation to refresh generated `runner/app-config.json`. Declare fonts/images with their notices; tooling calculates omitted hashes and validates explicit ones. Add literal asset `require` entries where the runner's Metro map requires them.

## Project structure

| Path | Purpose |
| --- | --- |
| `src/` | Shared UI and application logic |
| `assets/` | Application assets and notices |
| `<target>/runner/` | Target dependencies, registration, and tooling |
| `.nelyx/` | Generated supply and build output |

Import explicit package subpaths such as `@nelyx/core/framework/widgets/basic` and `@nelyx/sdk/platforms/web/surface`. Dispose application-owned controllers and resources when their owner finishes.

Nelyx is experimental, with incomplete framework and platform coverage. Retain imported font, runtime, and renderer licenses when distributing the application.
