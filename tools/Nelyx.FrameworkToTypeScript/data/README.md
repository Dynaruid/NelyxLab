# Framework conversion data

Metadata for framework conversion and managed product sources. SDK builds and applications consume tracked TypeScript and do not read this directory.

| Path | Purpose |
| --- | --- |
| [packages.json](packages.json) | Canonical workspace package owners |
| [work8/](work8/) | Recipes, manual declarations, host mappings, and generated/adopted output ownership |

## Maintaining managed output

Preserve source pins, numeric annotations, licenses, generated/adopted ownership, base fingerprints, and direct product edits. Before reusing a recipe, connect a current product validator; missing validation must fail.

[product-module-layout.mjs](../product-module-layout.mjs) connects canonical module destinations to managed owners. Feature generators also validate their source and output identities before writing. Run `npm run check:design-ownership` from the repository root when changing design-source ownership.

Ownership metadata describes how sources are maintained; it does not qualify current runtime behavior. See the [tool guide](../README.md) for setup and boundaries.
