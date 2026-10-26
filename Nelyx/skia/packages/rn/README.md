# Nelyx Skia for React Native

`@nelyx/skia-rn` provides the RN bootstrap, components/surfaces and declarative recorder. Shared Graphite rendering, paragraphs, resources and neutral types are owned by [`@nelyx/skia-native`](../native/README.md), which this adapter consumes directly. The bindings derive from React Native Skia.

## Modules and ownership

Use `@nelyx/skia-rn/runtime/native-bootstrap` for RN integration. Import shared rendering, text and neutral types from `@nelyx/skia-native/renderer`, `@nelyx/skia-native/text` and its explicit `skia/types/*` subpaths. See [package exports](package.json).

Skia owns device/session/renderer and native surface lifetimes. Application bootstrap, development bundle selection, and window/shutdown policy belong to the [SDK native host](../../../sdk/README.md#ownership-and-lifecycle). Skia does not import the SDK.

The text service requires native paragraph API2, including positive-infinite layout widths, full line metrics, UTF-16 line lookup and soft-hyphen policy. Rebuild the RN binding and shared native core together when those inputs change. The Web runtime has its own versioned paragraph API.

## Native targets

| Target | Renderer supply | Integration |
| --- | --- | --- |
| Android | m154 Graphite/Dawn | [Gradle/JNI binding](android/README.md) |
| iOS / macOS | m154 Graphite/Metal | Podspec, Apple sources, and pinned Apple binary packages |
| Windows | m153 native Graphite/Vulkan | [Windows binding](native/windows/README.md) |
| Linux | m153 native Graphite/Vulkan | [Linux binding](native/linux/README.md) |

The package includes platform adapters and CMake recipes under `native/vulkan/`, `native/windows/`, and `native/linux/`. Shared JSI/Vulkan sources are derived into `generated/jsi` and `generated/native-vulkan` from `skia/native/adapters/jsi`; shared Windows headers are in `generated/host/windows`. The Vulkan target consumes the common `engine.cmake` recipe with the RN cohort's headers. Edit canonical sources, then prepare the current generated inputs. Ownership state exposed by `nelyxStats` participates in shutdown drain.

On resize, an Nelyx recording for the previous backing is released after its GPU completion is confirmed. The host retains the displayed front buffer until a frame for the new backing arrives. Queued uploads and recordings without confirmed completion remain owned.

## Build and check

From the repository root after installing workspace dependencies:

```powershell
npm run build:skia
npm run check --workspace @nelyx/skia-rn
```

The package build emits ESM, declarations, and source maps. Native binary builds are separate; see the [Skia supply guide](../../README.md). Platform qualification remains `notVerified`.

## License

Nelyx contributions use [BSD-3-Clause](LICENSE.md). Imported RN Skia code retains MIT licensing and attribution in [third-party notices](THIRD_PARTY_NOTICES.md) and [licenses](licenses/).
