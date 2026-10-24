# Third-party notices

Nelyx-authored code and contributions use BSD-3-Clause under `LICENSE.md`.
The license does not replace the copyright or license of imported source.

The RN Skia source fork retains its original MIT notice in
`licenses/react-native-skia-MIT.md`, including the William Candillon and
Shopify copyrights. Existing source-file notices, including those in
`cpp/api/third_party`, remain in place. The RN package declares
`BSD-3-Clause AND MIT` for the Nelyx and RN Skia portions.

The Windows Skia vendor's original BSD-3-Clause notice is retained in
`licenses/skia-BSD-3-Clause.txt`. Skia/Dawn/CanvasKit headers, libraries and
other dependencies retain their own licenses and source notices. The
upstream source archive preserves the original source and license files.

The explicit m153 RN Vulkan WebP supplement uses libwebp revision
`845d5476a866141ba35ac133f856fa62f0b7445f`, as specified by the original Skia
`DEPS`. Its original copyright/conditions, patent grant and author list are
retained in `licenses/libwebp-COPYING.txt`, `licenses/libwebp-PATENTS.txt` and
`licenses/libwebp-AUTHORS.txt`. The offline source preparation also retains those
files beside the original build sources. Archive identity is recorded in
`eng/source-build/libwebp.lock.json`; this exception does not rebuild Skia core.

This document covers the explicitly retained notices. The full notice
inventory for prebuilt Skia/Dawn binaries remains a separate qualification;
retained common notices are in `Nelyx/licenses/` in the repository.

The Windows keyboard pairing kernel in `native/windows/WindowsKeyboardInput.h`
adapts the Flutter engine Windows KeyboardManager session at Flutter revision
`71e4717a61786faab4c7aa39825989305ed29e8a`. Its original 2013 Flutter Authors
BSD-3-Clause notice is retained in `licenses/FlutterEngine-LICENSE.md`.
The RNW event, focus and lifetime integration is an Nelyx adaptation; this
retained notice does not qualify the full native dependency notice inventory.

The contact/inertia protocol in `native/windows/WindowsPrecisionTrackpad.h`
adapts Flutter engine `shell/platform/windows/direct_manipulation.cc`, reviewed
source SHA-256 `fa9ce84227c9096bc9a214569854d3ff49822e85d885e1dacb76d514341b955b`.
Its 2013 Flutter Authors BSD-3-Clause notice is retained in the same license.
