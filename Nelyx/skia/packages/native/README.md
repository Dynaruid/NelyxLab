# Nelyx native Skia Engine

`@nelyx/skia-native` provides the shared native renderer, display-list encoding, paragraphs, images, paths, pictures, and JSI adapters. It has no React or React Native runtime dependency.

Both the direct Hermes host and the [React Native adapter](../rn/README.md) consume these implementations.

## Modules

Import explicit subpaths such as `@nelyx/skia-native/renderer`, `@nelyx/skia-native/text`, and `@nelyx/skia-native/skia/types/Skia`. See [package.json](package.json) for all exports.

React Native views and the declarative recorder belong to `@nelyx/skia-rn`. VM creation, windows, input, and OS services belong to the host.

## Native sources

Canonical JSI bindings live in [native/adapters/jsi/](../../native/adapters/jsi/), host contracts in [native/host/](../../native/host/), and shared renderer/GPU code in [native/](../../native/).

Source preparation derives the package's current C++ inputs. Direct Hermes and RN use the common recipe with their own pinned VM/JSI inputs; runtimes and handles must remain within their owning cohort.

## Frames and lifetime

Native scene encoding validates numeric packets and handles before replay. Pictures and rasterization use the same display-list encoder. Synchronous temporary wrappers retire after the call; recordings and resource leases remain owned until GPU retirement.

Await renderer disposal. Reentrant close calls share the same Promise, and a failed drain preserves unconfirmed resources and the original failure.

## Build and use

From the repository root, after `npm ci`:

```powershell
npm run build:skia
npm run check --workspace @nelyx/skia-native
```

Package builds prepare sources and TypeScript output. Target-native binaries require the [Skia supply recipes](../../README.md). See the [project guide](../../../../README.md#project-status) for platform limits.

## License

Derived API types and bindings retain their MIT notices in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and [licenses/](licenses/).
