# @nelyx/vite

Configure Vite in the app root.

```ts
import { defineAppConfig } from '@nelyx/vite/config';

export default defineAppConfig(import.meta.dirname);
```

The HTML imports the app's `src/index.ts`. Mark the script with `data-nelyx-entry` to have Nelyx use the configured `appEntry`. The CLI selects the backend module and passes it to Vite. App assets and CanvasKit are verified in both targets. CSS uses Vite HMR and the development client closes owned React and CanvasKit resources before an application reload. Pass Vite options or plugins through the second `defineAppConfig` argument. [CLI guide](../cli/README.md)
