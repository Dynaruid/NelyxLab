# Android Skia binding

The Android library for `@nelyx/skia-rn` contains Gradle/CMake integration, JNI bindings, and native views. Consumer applications build it through their Android runner.

## Integration

[`build.gradle`](build.gradle) applies the Android library and React Native plugins, generates Fabric/TurboModule bindings, and resolves native libraries from `react-native-skia-graphite-android`. The pinned supply is 154.1.0 / m154 Graphite/Dawn; the library requires Android API 26 or later.

The build verifies required Dawn libraries and, when `react-native-webgpu` is installed, checks its Dawn identity against the Skia supply. Use the exact pinned supplier and matching architecture.

## Build the sample

After preparing the repository packages, run from the repository root:

```powershell
npm run prepare:sample -- android
npm --prefix sample/nelyx-testbed-app-2/android/runner install --ignore-scripts
npm --prefix sample/nelyx-testbed-app-2/android/runner run build -- --architecture x86_64 --configuration Release
```

This produces the sample APK using its `emulator-vulkan` profile. See the [Android sample guide](../../../../../sample/nelyx-testbed-app-2/README.md#android) for prerequisites and CLI packaging/launch. An emulator build does not verify physical ARM64 execution, IME, accessibility, or production signing.

## Related guides

- [Renderer package](../README.md)
- [Native supply](../../../README.md)
