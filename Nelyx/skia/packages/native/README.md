# Nelyx native Skia Engine

`@nelyx/skia-native` owns the shared renderer, display-list encoder, paragraphs,
paint/path/image/picture adapters and neutral Skia types. It has no React or RN
runtime or type dependency. Both the direct Hermes host and RN surface adapter
consume these implementations directly.

Import the required subpath, such as `@nelyx/skia-native/renderer` or
`@nelyx/skia-native/text`. `NativeTextLayoutService` and `NativeFont` replace the
former RN-named paragraph APIs. RN views and their declarative recorder remain
in `@nelyx/skia-rn`; the neutral `Skia` interface excludes that recorder.

Canonical C++ bindings live in `skia/native/adapters/jsi`, shared host contracts
in `skia/native/host`, and GPU/core implementations in their respective native
directories. Preparation derives this package's current C++ inputs; direct
Hermes and RNW compile the same target recipe with separate pinned VM cohorts.
The direct host does not compile or resolve the RN package.

The native scene consumes Core commands directly into a bounded numeric packet.
Affine transforms use the existing inline column-major matrix opcode, with no
per-transform Matrix wrapper. Packet version and native float32 meaning remain
unchanged.
Retained Picture compilation, context restoration and `Picture.toImage` use the
same encoder through the recording owner's `nelyxReplayDisplayList` binding.
The complete packet and handles are validated before changing the open picture;
finished or disposed recorders reject further packets. Native Engine services
require this binding and fail on an older supplier. Adapters that explicitly
disable native display lists retain Canvas replay.
Packet handles and temporary native wrappers retire after the synchronous call;
recordings and resource leases remain owned through GPU retirement.

`GraphiteRenderer.dispose()` publishes one close Promise before native drain or
resource retirement callbacks run. Reentrant close callers share that Promise;
they cannot reset the context or clear retirement identities a second time.
A failed drain retains the rejected Promise and unconfirmed dependencies.

This extraction is part of [W18](../../../../history/26/10/25/work18-summary.md). Retained scene chunks,
text ABI consolidation and product performance, memory, display and physical
input acceptance remain in progress. The package does not establish those gates.

The derived API types and bindings retain their original MIT notices. See
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and [licenses](licenses/).
