# Linux Skia binding

Linux device/session/renderer, JSI, native components, and surface implementation for [`@nelyx/skia-rn`](../../README.md).

## Ownership

The binding owns GPU and surface resources. The SDK's GTK application host owns app bootstrap, shutdown signals, and development bundle selection. Skia does not import the SDK.

The native path checks provider cohort, GPU readiness, owner generation, window-system compatibility, and shutdown drain.

## Build and supply

Use the pinned x86_64 native Vulkan SDK and matching RNL/RN 0.81.6 module inputs. See the [Skia supply guide](../../../../README.md#linux-native-inputs) and [Linux app guide](../../../../../../Nelyx/sdk/tooling/cli/templates/nelyx-app/linux/runner/README.md).

A Linux desktop app also needs GTK4 development packages, X11, Vulkan, and matching RNL/Hermes sources. Native module compilation and supplier preparation do not establish GTK app or GPU execution. Platform qualification remains `notVerified`.
