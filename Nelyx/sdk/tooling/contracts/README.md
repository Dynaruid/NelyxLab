# @nelyx/tooling-contracts

Pure TypeScript contracts for selecting an explicit platform tool and executing an operation. Runtime hosts, SDK initialization and CLI implementations are not dependencies. Platform packages supply their own descriptors when migrated; unsupported or ambiguous selections fail before loading a module.

## Node tooling

The app-assets, installed-supply, web-runtime and node-files subpaths provide the same checks to the Vite builder and CLI. They verify declared assets and notices, local npm archive identities, pinned CanvasKit contents and published file inventories.
