import {Platform} from '../Platform/Platform.ts';

import {registerSkiaWorkletSerialization} from './SkiaWorkletSerialization.ts';

if (Platform.OS !== "web" && globalThis.SkiaApi == null) {
  // Initialize RN Skia
  const {default: SkiaModule} = require("../specs/NativeSkiaModule.ts");
  if (SkiaModule == null || typeof SkiaModule.install !== "function") {
    throw new Error(
      "Native RNSkia Module cannot be found! Make sure you correctly " +
        "installed native dependencies and rebuilt your app."
    );
  }
  const result = SkiaModule.install();
  if (result !== true) {
    throw new Error(
      `Native Skia Module failed to correctly install JSI Bindings! Result: ${result}`
    );
  }
  // Skia objects use the JSI NativeState pattern and need a custom
  // serializer to be transferable to worklet runtimes (Reanimated).
  registerSkiaWorkletSerialization();
}
