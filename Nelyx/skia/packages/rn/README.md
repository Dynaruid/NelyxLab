# Nelyx Skia for React Native

`@nelyx/skia-rn` provides JSI bindings, Graphite recording, native components/surfaces, and text services. It is derived from React Native Skia with Nelyx renderer adapters.

## Modules and ownership

Import explicit subpaths such as `@nelyx/skia-rn/renderer`, `@nelyx/skia-rn/text`, or `@nelyx/skia-rn/runtime/native-bootstrap`; see [package exports](package.json).

Skia owns device/session/renderer and native surface lifetimes. Application bootstrap, development bundle selection, and window/shutdown policy belong to the [SDK native host](../../../sdk/README.md#ownership-and-lifecycle). Skia does not import the SDK.

## Native targets

| Target | Renderer supply | Integration |
| --- | --- | --- |
| Android | m154 Graphite/Dawn | [Gradle/JNI binding](android/README.md) |
| iOS / macOS | m154 Graphite/Metal | Podspec, Apple sources, and pinned Apple binary packages |
| Windows | m153 native Graphite/Vulkan | [Windows binding](native/windows/README.md) |
| Linux | m153 native Graphite/Vulkan | [Linux binding](native/linux/README.md) |

The package includes native headers and CMake recipes under `native/vulkan/`, `native/windows/`, and `native/linux/`. Generated SDK/core/GPU source is prepared from common product source. Ownership state exposed by `nelyxStats` participates in shutdown drain.

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


The text service requires native paragraph API2. It preserves positive-infinite layout widths, complete line metrics, UTF16 line lookup and soft-hyphen policy. Both the RN binding and shared native core must be rebuilt together; an API1 runner is rejected before layout. `unlimitedLines` omits SkParagraph's `maxLines` option while the host still enforces its result/geometry budget. This preserves the engine's distinct unlimited-line ellipsis behavior. The owned Web runtime remains paragraph API1 because it already supports positive-infinite widths.
