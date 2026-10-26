# Nelyx

**English** | [한국어](README.ko.md)

The project uses `@nelyx/*` packages, the `nelyx` CLI and `package.json` configuration key, and `NELYX_*` environment variables. SDK sources live in `Nelyx/`, the sample in `sample/nelyx-testbed-app-2/`, and generated app supply in `.nelyx/`. Build the SDK and prepare each runner before installing its packages.

Previous binaries are not supported. Build and adopt the [Nelyx CanvasKit runtime](Nelyx/skia/eng/source-build/README.md#vendor-build-recipes) before preparing or building the Web sample; the runtime manifest remains `requires-build` until fresh binaries are supplied.

### Bringing Flutter's widget and rendering system to TypeScript

Nelyx is an experimental UI SDK project whose main goal is to bring Flutter's widget and rendering system to TypeScript, so applications can share their UI across desktop, mobile, and the web.

The intended framework separates Widget configuration, Element state and lifetime, and RenderObject layout, painting, and hit testing. It aims to own the UI trees and the build → layout → paint pipeline, then render the result through Skia.

The implementation now includes a selected Widget/Element/RenderBox framework, host-driven scheduling, constraints, text, gestures, fixed-extent lazy lists, native editing sessions and navigation. The sample builds its shared UI from widgets. Scoped checks include actual Chrome WebGL2, Windows native UI and Android emulator interaction; platform acceptance and remaining physical-input qualifications are recorded in [W5 summary](history/26/10/10/work5-summary.md).

[Get started](#get-started) · [Platforms](#platforms) · [Documentation](#documentation)

The foundation-overhaul history is preserved in the [W18 summary](history/26/10/25/work18-summary.md). Its last record, dated 2026-10-26 KST, is IN_PROGRESS / PARTIAL; performance, memory, physical-input and display acceptance remain incomplete. [W17](history/26/10/25/work17-summary.md) is historical and CLOSED / SUPERSEDED BY W18. The [dated development history](history/README.md) indexes the archived design, research and work documents. Selected design imports moved to `@nelyx/material/widgets` and `@nelyx/cupertino/widgets`; see the [Core package import guide](Nelyx/README.md#design-package-imports). Deleted execution records are not required for resuming.

The current batches include the complete `SpringDescription` class with tracked manual simulation declarations. `PhysicalShape` uses actual path clipping and shadows. TextStyle carries Paint, baseline and package font names through the paragraph path. Supplied runner archives must be installed before building; runner checks reject a previous local archive even when its package version is unchanged. Current source, package and platform evidence is recorded separately in work8.

> [!WARNING]
> Nelyx is under active development. APIs and project structure may change. Platform implementations have different levels of validation.

## Highlights

- **Flutter-style widgets and rendering** — persistent keyed State, constraints, layout, painting and hit testing in TypeScript.
- **Shared TypeScript application code** — keep application state, scene construction, and the `main()` entrypoint in `src/`.
- **Platform SDK APIs** — connect applications, surfaces, input, and assets through explicit platform modules.
- **Skia rendering** — native targets use Graphite; the browser renderer uses CanvasKit with Ganesh/WebGL2.
- **Explicit resource lifetimes** — coordinate frame submissions, GPU retirement, assets, and host shutdown.
- **Independent platform runners** — each target owns its React Native or browser dependencies, Metro configuration, and native project.
- **CLI and templates** — create applications and prepare, build, run, develop, or package a selected target.

## Platforms

The table describes current runner configurations. Readiness varies across targets.

| Platform | Host | Rendering configuration | Current boundary |
| --- | --- | --- | --- |
| Windows | React Native Windows / Hermes | Graphite / native Vulkan | x64 Release sample exercised; full reload remains unresolved |
| Android | React Native / Hermes | Graphite / Dawn / Vulkan | x86_64 Release emulator exercised; latest ARM64 and physical-device acceptance remain open |
| iOS | React Native / UIKit | Graphite / Metal | Source integration; native build, runtime, and signing unverified |
| macOS | React Native macOS / AppKit | Graphite / Metal | Source integration; native build, runtime, and signing unverified |
| Linux | React Native Linux / GTK4 / X11 | Graphite / native Vulkan | Supplier and binding compiled; GTK host and GPU execution unverified |
| Web | React DOM / React Native Web | CanvasKit / Ganesh / WebGL2 | Build and headless interactions exercised; physical input and accessibility acceptance remain open |

Native builds require the matching platform toolchain and pinned renderer inputs. See the [sample guide](sample/nelyx-testbed-app-2/README.md) and [Skia guide](Nelyx/skia/README.md).

## Get started

Use **Node.js 24.3 or later in the 24.x series**, npm, **Python 3** for source-tree SDK preparation, and a WebGL2-capable browser for the Web sample. The first SDK build may download pinned inputs. Native targets require additional tools described in the sample guide.

Run from the repository root in PowerShell:

```powershell
git clone https://github.com/Dynaruid/NelyxLab.git
cd NelyxLab
npm ci
npm run build:sdk
npm run prepare:sample -- web
npm --prefix sample/nelyx-testbed-app-2/web/runner install --ignore-scripts
npm --prefix sample/nelyx-testbed-app-2/web/runner run dev
```

Open `http://127.0.0.1:8081/`. Stop the server with Ctrl+C. `prepare:sample` packs the current workspace packages, copies them into the application's `.nelyx/supply/web/`, and updates the runner lockfile; the following `npm install` prepares that runner's dependencies and lockfile.

For a static build, run `npm --prefix sample/nelyx-testbed-app-2/web/runner run build`. For other targets and applications outside this checkout, see the [sample](sample/nelyx-testbed-app-2/README.md) and [CLI](Nelyx/sdk/tooling/cli/README.md) guides.

## How it works

The framework direction follows Flutter's separation of UI configuration, persistent tree state, and rendering:

| Layer | Responsibility |
| --- | --- |
| Widget | Describe UI configuration declaratively |
| Element | Maintain widget identity, state, updates, and tree lifetime |
| RenderObject | Perform constraint-based layout, painting, and hit testing |
| Frame pipeline | Coordinate build, layout, paint, and submission to the renderer |

State changes should update the affected UI branches and produce frames for the Skia backend. The current implementation provides the following foundation for that pipeline:

```text
Shared TypeScript application: src/index.ts → main()
                         ↓
@nelyx/core: UI, frame, resource, and lifetime contracts
                         ↓
@nelyx/sdk: platform application, input, assets, and host lifetime
                         ↓
Platform runner + @nelyx/skia-rn or @nelyx/skia-web
                         ↓
Native GPU surface or browser canvas
```

The sample uses a common Widget tree for counter, editors, list, details and dialog. React Native and React DOM / React Native Web own the surface and native editing/accessibility controls; Nelyx owns the widget tree and layout. Import APIs from direct subpaths such as `@nelyx/core/framework/widgets/basic`, `@nelyx/core/framework/widgets/root` and `@nelyx/sdk/platforms/web/surface`. See the [core Widget example](Nelyx/README.md#widget-applications).

## Documentation

| Guide | Contents |
| --- | --- |
| [Core](Nelyx/README.md) | Platform-independent contracts and package builds |
| [SDK](Nelyx/sdk/README.md) | Platform APIs, host ownership, configuration, and providers |
| [Sample app](sample/nelyx-testbed-app-2/README.md) | Shared application, target setup, launch commands, and troubleshooting |
| [CLI and templates](Nelyx/sdk/tooling/cli/README.md) | Application creation, package supply, and target operations |
| [Metro](Nelyx/sdk/tooling/metro/README.md) | Runner configuration, assets, bundles, and development servers |
| [Skia](Nelyx/skia/README.md) | Native inputs, renderer packages, and source builds |

## Project status

Nelyx is experimental. The selected framework API is implemented with explicit limits: fixed-extent lists, bounded text width, affine transforms and native editor overlays. GlobalKey reparent, intrinsic/baseline flex, complete design-system parity, restoration/deep links and state-preserving reassemble remain open. Android has a native composing/selection bridge; physical IME/accessibility acceptance remains unverified, and stock RN/DOM composition limits are explicit. Provider qualification is `notVerified`; compiler and behavior checks do not establish complete platform support.

Windows uses stock RNW 0.83.2 Core. Private unload changes are preserved in [their manifest](Nelyx/upstream/react-native-windows-private-unload.json) and patch, and are not applied to the default product. Stock Core full reload and complete SDK/GPU failure cleanup and loss/recovery remain unresolved. Physical input, Korean IME, screen readers, scanout/FPS, signing, and clean-machine acceptance require separate verification.

## Repository layout

| Path | Contents |
| --- | --- |
| [`Nelyx/src/`](Nelyx/src/) | Platform-independent core |
| [`Nelyx/sdk/`](Nelyx/sdk/) | SDK, platform APIs, providers, and native app hosts |
| [`Nelyx/skia/`](Nelyx/skia/) | Common native renderer, RN/Web packages, and vendor inputs |
| [`Nelyx/sdk/tooling/`](Nelyx/sdk/tooling/) | CLI, Metro tooling, and application templates |
| [`Nelyx/eng/`](Nelyx/eng/) | Package builds, provider generation, and sample/template preparation |
| [`Nelyx/upstream/`](Nelyx/upstream/) | Upstream pins, patches, and runtime overlays |
| [`tools/Nelyx.FrameworkToTypeScript/`](tools/Nelyx.FrameworkToTypeScript/) | Independent Bun/Roslyn development tool and port rules |
| [`sample/nelyx-testbed-app-2/`](sample/nelyx-testbed-app-2/) | Shared sample and independent platform runners |

## License

Nelyx-authored code uses the [BSD 3-Clause License](Nelyx/LICENSE.md). Imported code retains its own licenses and notices; see the [license inventory](Nelyx/licenses/) and [Skia third-party notices](Nelyx/skia/THIRD_PARTY_NOTICES.md).
