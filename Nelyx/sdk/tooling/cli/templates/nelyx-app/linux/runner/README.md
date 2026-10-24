# Linux runner

Registers the shared `src/index.ts` application through the Nelyx platform SDK. This runner owns its dependencies, Metro/Babel configuration, and platform build settings.

## Install

First prepare the pinned RNL archives and native supplier. From the application root:

```text
nelyx supply --app . --target linux --packages <archive-directory> --rnl-supply <supply.json>
npm --prefix linux/runner ci --workspaces=false
```

From an NelyxLab checkout, supply a generated Linux application with `npm run prepare:sample -- linux <absolute-app-path> <supply.json>`. The Components Gallery sample targets Web, Windows, and Android; create a separate Linux app from this template.

## Prepare and run

Use a Linux host with C++ tools, CMake/Ninja, GTK4 development packages, X11, Vulkan, and pinned RNL/Hermes sources. From this runner directory:

```text
npx --no-install nelyx prepare --app ../.. --target linux --native-inputs <inputs.json>
npm run check
npx --no-install nelyx build --app ../.. --target linux --native-inputs <inputs.json> --hermes-source <pinned-hermes-source>
npm run run
```

The runner also provides `bundle`, `doctor`, `dev`, and `pack` scripts. Native module/supplier compilation does not establish GTK host or GPU execution. Linux GPU execution and platform qualification remain `notVerified`.
