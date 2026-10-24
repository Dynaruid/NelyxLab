# iOS runner

Registers the shared `src/index.ts` application through the Nelyx platform SDK. This runner owns its dependencies, Metro/Babel configuration, and platform build settings.

## Install

From the application root, after supplying the Nelyx archives and pinned Apple binary dependency:

```powershell
npm --prefix ios/runner ci --workspaces=false
```

In NelyxLab, use `npm run build:sdk` and `npm run prepare:sample -- ios` from the repository root first. The preparation command supplies the pinned Apple binary archive.

## Build and run

From this runner directory:

```powershell
npm run check
npm run bundle
npm run build
npm run run
```

Native operations require macOS, Xcode, and CocoaPods. The build prepares runtime patches, installs Pods, and builds Release for an iOS Simulator destination with signing disabled. `run` delegates to the installed React Native iOS launcher. Source operations also include `prepare:native` and `codegen`.

Apple native build/runtime, Metal execution, physical input, and signing remain unverified. Source checks or a bundle do not establish native-platform acceptance.
