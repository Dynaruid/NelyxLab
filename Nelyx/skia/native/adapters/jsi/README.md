# Shared Skia JSI binding

`cpp/` and `vulkan/` are the canonical binding sources. `engine.cmake` assembles
the common Vulkan binding target with the embedder's verified JSI headers,
compile definitions and vendor inputs. VM creation and window/OS services stay
in the embedder. The common GPU/recording contracts in `native/rendering` and
`native/core` do not expose JSI or platform UI types.

`eng/prepare-native.mjs` derives the current `skia-native` package's `cpp/`,
`native/jsi` and `native/vulkan` inputs from these sources. RN consumes a derived
`generated/jsi` and `generated/native-vulkan` tree from the same owner. Edit the
canonical inputs here; generated package copies are replaced during preparation.
Windows helper headers are canonical in `native/host/windows`.

The direct Windows host builds this target through `@nelyx/skia-native` and
does not resolve or link the RN adapter package. RN's Vulkan target uses the
same recipe with its separately verified RN/JSI cohort. These are distinct
adapters; their runtimes and handles cannot be mixed. Other platform recipes
retain their existing integration and require their own qualification.

The binding keeps React Native Skia's MIT notices. This source extraction does
not establish new scene ABI, performance, memory or physical-input acceptance.
