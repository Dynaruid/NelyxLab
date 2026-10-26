# Static Hermes AOT tooling

`@nelyx/static-aot` supplies source analysis, scalar specialization, and execution-plan checks for experimental Static Hermes builds. The [CLI](../cli/README.md#native-prerequisites) uses it for Windows `--engine hermes --hermes-mode static-aot`.

Application imports do not start compiler downloads or native builds. Prepare the matching toolchain explicitly before building.

## Modules

| Module | Responsibility |
| --- | --- |
| `source-graph` | Resolve installed TypeScript bodies, owners, source maps, and dependency components |
| `runtime-inventory` | Describe original and emitted bodies in the installed Metro graph |
| `numeric-partition` | Build IR for explicitly selected arithmetic scalar bodies |
| `partition` | Handle supported scalar arguments, locals, branches, and bounded loops |
| `product-partition` | Apply automatic guarded scalar specialization to the installed graph |
| `execution-plan` | Join source identities, frontend decisions, and native definitions |

See [package.json](package.json) for public exports. Inventory reports describe syntax and ownership; they do not establish native coverage by themselves.

## Specialization policy

The automatic policy requires scalar annotations, checker evidence, and supported IR to agree. Unproven fields, getters, captures, callbacks, and dynamic values keep ordinary JavaScript operations in the same native image.

Entry guards preserve the original body for values outside a specialized contract. Unsupported explicit lowerings report source-positioned `NELYX_TYPED_UNSUPPORTED` errors. Numeric compilation preserves binary64 evaluation with `-ffp-contract=off` and without fast math.

A full-runtime package requires complete source/body/native correspondence. Unclassified bodies, unresolved targets, or runtime code generation block its build. Native AOT coverage and type-specialization coverage are separate measures.

## Inspect and build

From the repository root, with the current Windows runner installed:

```powershell
npm run inspect:static-aot-runtime
```

This inspects the actual Release serializer and installed source maps. For a full application build, follow the [Windows Testbed guide](../../../../sample/nelyx-testbed-app-2/README.md#choose-an-execution-mode).

The RNW runtime's host-function manager and VM-internal Promise/iterator code use separately mapped native units in the same VM. The app's public execution mode is `static-aot`.

## Cache and diagnostics

The Windows runner keeps its current compiler cache in `.nelyx/windows/static-aot-cache`, outside the delivered package. Toolchain, source, flags, and output hashes determine reuse. Changed or damaged inputs rebuild; deleting the cache forces regeneration.

`STATIC_AOT_FRONTEND`, `STATIC_AOT_CACHE`, and `STATIC_AOT_BUILD` report build stages and timing. `mapStaticAotPc` from `@nelyx/cli/windows-static-aot` maps an image-relative PC to generated/original function candidates. Its precision is a function range, including folded aliases.

## Development checks

From the repository root:

```powershell
npm run test:static-aot-runtime
npm run test:static-aot
```

Native probes are opt-in through `NELYX_STATIC_HERMES_INPUTS`, pointing to a verified toolchain. Build success and source coverage do not establish UI behavior, performance, physical input, or display qualification.
