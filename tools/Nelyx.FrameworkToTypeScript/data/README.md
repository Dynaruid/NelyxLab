# Framework conversion data

Metadata for framework conversion and managed product sources. SDK builds and applications consume tracked TypeScript and do not read this directory.

| Path | Purpose |
| --- | --- |
| [packages.json](packages.json) | Canonical workspace package owners |
| [work8/](work8/) | Recipes, manual declarations, host mappings, and generated/adopted output ownership |

## Historical ownership

The recipes, fingerprints and [module layout](../product-module-layout.mjs) describe the original conversion. Leave these records frozen. For product changes, edit and test the owning package directly, retaining source attribution, numeric annotations and licenses. Matching historical output hashes is not a release condition. See the [W11 migration plan](../../../work11.md).
