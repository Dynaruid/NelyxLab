# Nelyx Core

**English** | [한국어](README.ko.md)

`@nelyx/core` is Nelyx's platform-independent TypeScript UI framework. It owns the Widget/Element/RenderObject trees, state, layout, painting, gestures, and application contracts. The [SDK](sdk/README.md) supplies platform integration, and [Skia](skia/README.md) supplies rendering.

For installation and the sample, start with the [project guide](../README.md).

## Experimental v2 engine protocol

`@nelyx/core/v2` exports the C++ engine's packet codec, commands, `EngineClient`, and `createWasmTransport`. The canonical protocol is [engine/schema/protocol.json](engine/schema/protocol.json); run `node Nelyx/engine/tools/generate-schema.mjs --check` from the repository root to check generated C++/TS agreement. `npm.cmd run build:core` builds this subpath together with the existing Core exports.

From the repository root, `npm.cmd run test:engine-v2` compiles and executes the common contracts on Windows x64 and both Node-hosted Wasm profiles. `npm.cmd run build:engine-v2` keeps the current headless native library/driver and separate `single-worker`/`threaded` artifacts in `Nelyx/engine/dist`. Wasm builds require an activated [Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html) **4.0.22**, found through `EMSDK` or the user cache's `.cache/tooling/emsdk`. Tests use a 20-minute timeout and remove their temporary builds; the supply builder removes staging and the previous output.

This entrypoint requires a v2 packet port. Current application runners do not supply a v2 Widget renderer. Windows host, browser surface, official CanvasKit adapter, and Content/Render owner bootstrap sources are in progress; host compilation, browser bundles/assets, actual screens, and independent execution remain unverified. Work is **PAUSED / PARTIAL** at the user's request. The builder still supplies headless profiles (`contentIndependent=false`). The previous engine dist remains with an older schema; do not use it with the current Core. Rebuild it from source when work resumes. Follow [work8-1](../work8-1.md#중간-마무리--사용자-외출로-명시-중단) for the resume steps. Standard layout, full gestures, and browser deployment remain incomplete.

The client keeps accepted document epochs separate from scene activation. After an ACK timeout, use `queryCommitResult()` or `retryCommit()` with the retained bytes; a timeout does not undo an accepted change. Close returns `busy` while provider frames are held: the host must release those holds before completing close. `reservedBytes` measures internal reservations, not process RSS or unconnected GPU/provider heaps.

## Modules

Import APIs from explicit subpaths. Core has no aggregate root API.

| Area | Responsibility | Example import |
| --- | --- | --- |
| [Foundation](src/foundation/) | Notifications, disposal, clocks, errors, and utilities | `@nelyx/core/foundation/notifier` |
| [UI](src/ui/) | Canvas, geometry, text, images, and frame contracts | `@nelyx/core/ui/canvas` |
| [Hosting](src/hosting/) | Application, View, resource, and service lifetimes | `@nelyx/core/hosting/runtime` |
| [Framework](src/framework/) | Widgets, rendering, scheduling, gestures, animation, and navigation | `@nelyx/core/framework/widgets/basic` |
| [Services](src/services/) | Editing, platform channels, keyboard, and OS-service contracts | `@nelyx/core/services/text-editing` |

Public subpaths are listed in [package.json](package.json). Core does not depend on React Native or OS APIs.

## Widget applications

```ts
import {widgetApplication} from '@nelyx/core/framework/widgets/root';
import {Column, Padding, Text} from '@nelyx/core/framework/widgets/basic';
import {allInsets} from '@nelyx/core/ui/geometry';

export function main() {
  return {
    definition: widgetApplication({
      id: 'hello',
      createRoot: () => new Padding(
        allInsets(24),
        new Column([
          new Text('Hello Nelyx', {fontId: 'app-font', fontSize: 24}),
        ]),
      ),
    }),
  };
}
```

Declare `app-font` in the application's `package.json` → `nelyx.assets`. Pass `main().definition` to the platform `ApplicationSurface`; the [Web runner](../sample/nelyx-testbed-app-2/web/runner/App.tsx) shows the complete integration.

Each View owns its BuildOwner, PipelineOwner, scheduler, focus, and mounted State. Use `StatefulWidget` and `State.setState` from `framework/widgets/framework` for local state, and keys to preserve identity when children move. The `createRoot(context, scheduler)` callback receives View services and the host-driven frame scheduler.

## Design package imports

| UI layer | Import |
| --- | --- |
| Common widgets | `@nelyx/core/framework/widgets/basic` |
| Material 3 | `@nelyx/material/widgets` |
| Cupertino | `@nelyx/cupertino/widgets` |

[Material](../packages/material/README.md) and [Cupertino](../packages/cupertino/README.md) own their components and canonical themes. Core's `AppTheme`/`AppThemeData` in `framework/widgets/app-data` provide the common Nelyx theme adapter. All three packages share one Core instance.

## Working with the framework

| Task | Modules |
| --- | --- |
| Layout and constraints | `framework/widgets/basic`, `framework/rendering/constraints` |
| Editable text | `framework/widgets/editable-text` |
| Lists and scrolling | `framework/widgets/scroll`, `framework/widgets/scroll-view` |
| Routes and navigation | `framework/widgets/navigation` |
| Focus and keyboard actions | `framework/widgets/focus-scope`, `framework/widgets/shortcuts` |
| Drawing | `ui/canvas`, `ui/paint`, `framework/widgets/custom-paint` |
| Images and decoration | `framework/widgets/image`, `framework/painting/box-decoration` |

Controllers, FocusNodes, images, and other resources supplied by the application retain their own lifetimes. Dispose them when their owner finishes. A TextEditingController belongs to one mounted EditableText; OS composition and selection are coordinated through the SDK's editing service.

Custom render objects use the common layout, paint, hit-test, and invalidation contracts in [framework/rendering/](src/framework/rendering/). Keep drawing in `paint`, invalidate layout or paint through the render object, and release owned resources during disposal.

Each requested frame paints and submits to the renderer. Renderer admission (`accepted`) does not confirm display. Matching geometry, paint versions or previous admission cannot suppress later redraw, animation or scrolling frames. Existing resource reuse within repaint boundaries and layers remains available.

For low-level scene consumers, `FrameworkRoot.build(scene)` returns a `FrameRecording`. Respect owner gates such as first-frame deferral through `shouldSubmitFrame()`, and call `frameSubmitted(token)` after renderer admission. The capture and disposal contracts live in [ui/frame.ts](src/ui/frame.ts); recordings and submitted GPU work have separate resource lifetimes.

## Build and check

From the repository root, after `npm ci`:

```powershell
npm run build:core
npm run check --workspace @nelyx/core
```

Use `npm run build:sdk` to build the complete package set. When consuming locally packed packages, supply and reinstall the runner after changes; see the [CLI guide](sdk/tooling/cli/README.md#supply-and-install).

Nelyx implements a subset of Flutter's APIs. Check a module's declarations and the [Testbed](../sample/nelyx-testbed-app-2/README.md) for available functionality. Platform readiness is described in the [project guide](../README.md#project-status).

## License

Nelyx-authored code uses [BSD-3-Clause](LICENSE.md). Imported source and assets retain their notices in [licenses/](licenses/); source pins and ownership metadata are maintained in [upstream/](upstream/).
