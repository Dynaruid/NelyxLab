# Nelyx

**English** | [한국어](README.ko.md)

Nelyx is an experimental UI SDK that brings Flutter's widget and rendering model to TypeScript. Build shared interfaces for desktop, mobile, and the web with a Widget tree, constraint-based layout, and Skia rendering.

Nelyx manages widgets, state, layout, painting, and hit testing. Platform runners connect that UI to a window or browser canvas, input, accessibility, and OS services.

[Get started](#get-started) · [Platforms](#platforms) · [Documentation](#documentation)

## Features

- **Shared TypeScript UI** — compose widgets and keep application logic in one `src/` tree.
- **Flutter-style framework** — Widget configuration, persistent Element state, and RenderObject layout and painting.
- **Skia rendering** — Graphite on native targets and CanvasKit/Ganesh with WebGL2 in the browser.
- **Application services** — text editing, gestures, navigation, assets, and platform messaging.
- **Design packages** — Material 3 and Cupertino components built on the common framework.
- **Platform tooling** — a CLI, application templates, and independent runners for each target.

## Get started

Use **Node.js 24.x, version 24.3 or later**, npm, and **Python 3**. The Web sample also needs a WebGL2-capable browser and the matching Nelyx CanvasKit runtime. On a fresh checkout, prepare that runtime using the [source-build guide](Nelyx/skia/eng/source-build/README.md#vendor-build-recipes).

Run from PowerShell:

```powershell
git clone https://github.com/Dynaruid/NelyxLab.git
cd NelyxLab
npm ci
npm run build:sdk
node Nelyx/skia/eng/prepare-web-runtime.mjs --check
npm run prepare:sample -- web
npm --prefix sample/nelyx-testbed-app-2/web/runner install --ignore-scripts --workspaces=false
npm run dev:web --workspace @nelyx/testbed-2
```

Open `http://127.0.0.1:8081/`. Stop the server with Ctrl+C. The runtime check verifies the prepared CanvasKit files; if they are absent or differ from the manifest, follow the source-build guide before preparing the sample.

For a static Web build:

```powershell
npm run build:web --workspace @nelyx/testbed-2
```

See the [Testbed guide](sample/nelyx-testbed-app-2/README.md) for Windows and Android setup, or the [CLI guide](Nelyx/sdk/tooling/cli/README.md) to create a separate application from local package archives.

## Platforms

| Target | Default host | Renderer |
| --- | --- | --- |
| Windows | React Native Windows / Hermes | Graphite / Vulkan |
| Android | React Native / Hermes | Graphite / Dawn / Vulkan |
| iOS | React Native / UIKit | Graphite / Metal |
| macOS | React Native macOS / AppKit | Graphite / Metal |
| Linux | React Native Linux / GTK4 / X11 | Graphite / Vulkan |
| Web | React DOM / React Native Web | CanvasKit / Ganesh / WebGL2 |

Native targets require their platform toolchain and matching renderer inputs. Windows also offers explicit V8/JSC engine choices and an experimental direct Hermes host. The [sample](sample/nelyx-testbed-app-2/README.md) and [Skia](Nelyx/skia/README.md) guides describe setup and available modes.

## How it works

| Layer | Responsibility |
| --- | --- |
| Widget | Describe the interface |
| Element | Maintain identity, state, dependencies, and tree lifetime |
| RenderObject | Compute layout, paint, and hit-test geometry |
| Core | Coordinate the UI tree, frames, and resource contracts |
| SDK | Connect the application to platform input, assets, services, and host lifetime |
| Skia | Render frames and manage native or browser graphics resources |

The shared application exports `main()` from `src/index.ts`. A platform runner registers it and provides the rendering surface. Import APIs through package subpaths such as `@nelyx/core/framework/widgets/basic`, `@nelyx/material/widgets`, and `@nelyx/sdk/platforms/web/surface`. See the [Widget example](Nelyx/README.md#widget-applications).

## Documentation

| Guide | Contents |
| --- | --- |
| [Core](Nelyx/README.md) | Widget applications, module imports, state, and rendering |
| [SDK](Nelyx/sdk/README.md) | Platform APIs, application configuration, assets, and lifecycle |
| [Material](packages/material/README.md) / [Cupertino](packages/cupertino/README.md) | Design components, themes, and icon assets |
| [Testbed](sample/nelyx-testbed-app-2/README.md) | Component galleries and Web, Windows, and Android launch commands |
| [CLI](Nelyx/sdk/tooling/cli/README.md) | Application creation, package supply, builds, and execution |
| [Metro](Nelyx/sdk/tooling/metro/README.md) | Runner configuration, assets, and bundling |
| [Skia](Nelyx/skia/README.md) | Renderer packages and native inputs |
| [Development history](history/) | Archived design decisions and work summaries |

## Project status

Nelyx is under active development. APIs may change, and the framework implements a subset of Flutter's APIs. Material and Cupertino coverage is incomplete; the Testbed marks unavailable demos as planned.

Platform readiness varies. Apple native build, runtime, and signing, and Linux GTK/GPU execution remain unverified. Windows full reload and complete graphics recovery remain unresolved. Physical input, IME, screen readers, performance, and production distribution require further qualification. Available runners do not imply production support for every target.

## Repository layout

| Path | Contents |
| --- | --- |
| [`Nelyx/src/`](Nelyx/src/) | Platform-independent Core framework |
| [`Nelyx/sdk/`](Nelyx/sdk/) | Platform SDK and application hosts |
| [`Nelyx/skia/`](Nelyx/skia/) | Shared renderer and native/Web adapters |
| [`packages/`](packages/) | Material and Cupertino design packages |
| [`Nelyx/sdk/tooling/`](Nelyx/sdk/tooling/) | CLI, Metro, and application templates |
| [`sample/nelyx-testbed-app-2/`](sample/nelyx-testbed-app-2/) | Shared sample and platform runners |
| [`Nelyx/eng/`](Nelyx/eng/) | Workspace build and maintenance tools |

## License

Nelyx-authored code uses the [BSD 3-Clause License](Nelyx/LICENSE.md). Imported code retains its licenses and notices; see the [license inventory](Nelyx/licenses/) and [Skia notices](Nelyx/skia/THIRD_PARTY_NOTICES.md).
