# Static Hermes AOT tooling

Experimental Static Hermes build tooling (`@nelyx/static-aot`) for W15A. `source-graph` reads installed TypeScript
implementation bodies with `@typescript/typescript6@6.0.2` (API version 6.0.3), checks their emitted source maps,
and reports module owners, checker symbols, dependency components and dynamic
boundaries. The result is returned in memory; no history or receipt is written.

W15A adds `runtime-inventory` for the actual installed Release module graph.
It parses original TS/TSX with pinned Babel and original Flow (including Flow
without a pragma and component syntax) with pinned Hermes ESTree. Constructors,
accessors, nested functions, field/static/module initializers and emitted
helpers retain positions and hashes. Type-only declarations and JSON data do
not stand in for implementation bodies. Original and emitted inventories are
separate observations; their counts are not added into a coverage percentage.
This module has no typed lowering or native coverage authority: bodies remain
`unclassified`, semantic correspondence/coverage remain `notVerified`, and
`wholeAppNativeAot` remains false. Inventory schema v2 uses `nativeCoverage`,
`typeSpecializationCoverage` and `typePolicyAccepted` independently. Unknown
types can remain dynamic native operations; full type specialization is not
a prerequisite for native AOT. Previous package and schema names have no
compatibility aliases.

From the repository root, `npm run inspect:static-aot-runtime` observes Metro's
actual Release serializer, validates the complete source-map module set and
reports package ownership, SCCs, optional unresolved dependencies and generated
startup statements in memory. `npm run test:static-aot-runtime` checks this tooling.
Set `NELYX_STATIC_AOT_INVENTORY=1` to include the installed runner integration
and `NELYX_STATIC_HERMES_INPUTS` to include the same-VM native representation
probe. The latter measures only checked dynamic single-operation helpers;
it does not convert product classes or establish whole-app support. The active
implementation state and remaining gates are in [work15a.md](../../../../work15a.md).

The Windows CLI consumes this tooling only for explicit experimental
`--engine hermes --hermes-mode static-aot` builds. Importing it never downloads
a compiler or starts a native build. Compilation and product performance
acceptance remain separate gates.

`numeric-partition` builds a typed scalar IR from explicitly selected real
function or method bodies. The current subset accepts required `number`
parameters and one arithmetic return expression. It preserves source hashes,
checker identity, original TS positions and expression evaluation order.
Captures, calls, field access, defaults, statements, loops and generic bodies
produce a source-positioned `NELYX_TYPED_UNSUPPORTED` error.

`partition` extends the scalar IR to required scalar arguments, local variables,
arithmetic, comparisons, branches, bounded source `for` loops, breaks, throws
and numeric returns. Receivers, method calls and lexical bindings remain dynamic
in their original module, including observations after user callbacks. Number
reads and calls cross checked casts. Generic, closure, array and nominal-class
lowerings remain unsupported and report original TS positions.

`product-partition` uses the automatic `guarded-closed-scalar-v2` policy over
the actual installed Metro graph. Explicit scalar annotations, the checker
and checked IR must agree. Unproven fields, getters, lexical reads and calls
retain dynamic JS representations. Entry guards retain the original body
for values outside the scalar contract, compiled in the same native image.
The policy records source evidence and a reason for every decision. It rejects checker
errors, duplicate package resolution and multiple source/emitted identities.
Metro adapts selected method/function bodies before the shared native frontend;
constructors, exports, module evaluation and the original receiver stay owned
by the untyped application. The generated functions expose checked boundaries;
the trusted numeric ABI stays inside a closure. Only checked callables and
numeric call-count accessors cross into untyped JS. Typed arrays/objects are
never exported.
Compile typed C with `-ffp-contract=off`, without fast math, to preserve binary64
evaluation. Source segments identify TS input positions, not native PC addresses.

`execution-plan` v2 joins original source, generated helpers, the automatic
policy, pinned Metro elimination evidence and actual native C definitions.
Optional null module slots retain the qualified loader's native exception
path. Unclassified bodies, unresolved targets and runtime code generation
block a full-runtime package. The CLI additionally binds a function-range PC
map to the final DLL's hash and PE/PDB debug identity. PDB/C/object inputs are
temporary; `mapStaticAotPc` from `@nelyx/cli/windows-static-aot` resolves an
image-relative PC to generated and original function candidates. This is
function-level evidence, including folded aliases, rather than exact statement
or instruction source locations.

The Windows runner keeps one mutable native compiler cache outside its package
in `.nelyx/windows/static-aot-cache`. Input hashes include the verified toolchain,
native compiler/linker, producer code, flags, environment and unit source. A
matching image is reused only while its DLL hash matches; otherwise unchanged
unit objects and baseline/native function evidence can be reused before a fresh
link and PC map. Changed or damaged inputs rebuild. Objects and evidence replace
their current slots; C/PDB/staging files are temporary and no history is retained.
At most two units compile concurrently, bounded by CPU and memory. This does not
split the large app C translation unit or change its `-O3`/binary64 policy.
`STATIC_AOT_FRONTEND`, `STATIC_AOT_CACHE` and `STATIC_AOT_BUILD` report frontend,
cache status and separate optimized-frontend/baseline/evidence/Clang timings.
Metro's native worker stores frontend elimination and typed-consumption evidence
in the same cache entry as transformed code. Its transform options contain the
deterministic plan content, with no per-build temporary paths or sidecar files.

Run `npm run test:static-aot` from the repository root. Native probes are opt-in
with `NELYX_STATIC_HERMES_INPUTS` pointing at the prepared pinned toolchain.
The standalone multi-unit prototype uses the pinned `hermesvm` target. A
separate actual Node-API regression validates the v5 native root, unit order,
callbacks, getter/private identity, exceptions, GC and failure owners. Native
UI, package delivery, frame measurements and physical-device evidence are
qualified separately. No validation history or standalone installation is kept.

The full runtime also includes RNW0.83.2 JsiApi.cpp's embedded host-function manager as a separately mapped native unit. Its exact source/URL request initializes the same-VM unit lazily and never compiles source at runtime. Pinned VM internal Promise/iterator JavaScript uses a native SHUnit with the same no-CFG policy. These sources are recorded separately from the Metro graph and are not counted as native C++ boundaries.
