# @nelyx/vite

Configure Vite in the app root.

```ts
import { defineAppConfig } from '@nelyx/vite/config';

export default defineAppConfig(import.meta.dirname);
```

The HTML imports the app's `src/index.ts`. Mark the script with `data-nelyx-entry` to have Nelyx use the configured `appEntry`. The CLI selects the backend module and passes it to Vite. App assets and CanvasKit are verified in both targets. Pass Vite options or plugins through the second `defineAppConfig` argument.

CSS uses Vite HMR. Compatible `build()` body edits in app-owned `.ts` classes derived from `State` or `StatelessWidget` use the existing view and widget tree. `super`, JavaScript private fields, changed imports and class structure trigger a controlled reload. The development client closes owned roots and their resources before navigation. [CLI development guide](../cli/README.md#develop-the-app)

The app template uses `startLazyFrontend` to load the application screen while preparing the backend and CanvasKit. An entry with an already imported component can use `startFrontend(App)`.

```ts
import { startLazyFrontend } from '@nelyx/vite/client';

startLazyFrontend(() => import('./app-surface.tsx').then(({ App }) => App));
```
