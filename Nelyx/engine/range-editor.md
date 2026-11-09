# Native Range shapes and scroll curves

The original `RangeSlider`, `SliderThemeData`, `Curve` and `ScrollController`
remain the application APIs. These extensions describe configuration for the
Core layout/paint/animation owners. They do not execute application Canvas,
layout or Curve callbacks on the native render thread.

`registerNativeRangeSliderShape` is exported by
`@nelyx/material/slider-shapes`. Register the **exact custom class prototype**
once, with one of `track`, `thumb`, `tick`, `overlay` or `indicator`. An
unregistered subclass, another role, or methods changed after registration
fails explicitly. The original shape must still implement its Source API.
`getPreferredSize` supplies intrinsic configuration; final dimensions and
positions are expressions evaluated by Core.

Track readers receive the actual enabled/discrete arguments. Source requests
the default disabled rect for thumb centers and the input rect; the enabled
paint rect is a separate request. Thumb and track readers receive the shared
pressed-size/track-gap policy. Indicator readers receive label paragraph
resources, text scale, viewport width, activation and overlap order. Return
label placement as program geometry and preserve its paragraph resource.
Readers must be pure and bounded and must not retain paragraph resources or
invoke synchronous final layout queries. Scene resource holders own their
copies until retirement; removing or replacing a shape removes its old paint.

Concrete tick readers run in Source index order. There is no special 127
divisions limit. Their output must fit the common 65-entry/512-expression paint
budget, including track, overlay and thumbs. For many ticks, a `kind: 'tick',
repeat: true` adapter receives `tickIndex` and center expressions using Core's
`index`; it returns exactly **one non-repeating program entry**. Core repeats
that entry `divisions + 1` times in index order, subject to its 2048-draw and
operation budgets and Source density visibility. This single-entry restriction
preserves per-tick paint order. Arbitrary multi-entry concrete tick callbacks
and unbounded divisions remain explicit API obligations; exceeding a resource
budget fails, rather than silently removing ticks or changing the API baseline.

`registerNativeCurveConfiguration` is exported by
`@nelyx/core/framework/animation/curves`. Register an exact custom `Curve`
prototype with a reader for linear, cubic, split, interval, flipped, threshold,
sawTooth, decelerate, bounce or elastic data. Built-in methods must be unchanged;
custom methods must retain their registered identities. The runtime captures
every number and child before queuing the command, rejects cycles, non-finite
or out-of-range numbers and unknown kinds, and bounds composition to 32 nodes
and depth 16. A degenerate interval, a zero/near-zero elastic period, and
ThreePointCubic normalization producing non-finite data are explicitly rejected.
Arbitrary Curve callbacks and CatmullRom are not implicitly sampled or treated
as compatible. Original API correspondence remains incomplete.

Scroll wire bodies retain the original 56-byte linear form. A nonempty tail
contains an 8-byte node count/root header and 64-byte postorder nodes. Core
requires earlier child references, root = count - 1, no unreachable nodes and
zero reserved/unused fields. It executes the Source cubic tolerance and
equations, including endpoint semantics and overshoot. Duration is 0–60000 ms;
the client deadline is duration + 2000 ms (maximum 62000 ms). `scrollCancel`
takes an 8-byte command ID and cancels only that command. Repeating cancellation
of a retained terminal result succeeds; expired results are harmless to the
client. View reservations include curves and retained request bytes.

Both ordinary scrolls and editor viewport scrolls use `ScrollController`.
Animation survives an intermediate offset equal to its current position and
finishes after the duration and editor layout reaches the clamped destination.
User pointer/wheel/edit input, controller replacement, visibility/focus loss,
metrics/device invalidation, node removal and close cancel the old command.
Cancellation resets pending editor offsets; a delayed cancel cannot affect a
new command. Source animateTo futures also settle when interrupted, matching
the Source controller contract. Timeout and invalid commands remain errors.
Programmatic indexed and numeric list seeks use the same interrupt/rebase
policy as ordinary scroll commands, canceling only input in their viewport.
An ordinary input end preserves an accepted deferred destination while Content
prepares its window; input cancellation discards that destination. This lets
reverse trackpad scrolling restore leading lazy rows beyond the current cache.
Editor custom physics/scrollBehavior and physical/display/performance
acceptance remain separate obligations.

The [Demo shapes](../../sample/nelyx-demo-app/src/range-demo-shapes.ts) implement
all five Source shape roles and their readers. Selection shows a 200-division
custom Range with enabled, direction and shape replacement controls. Text
inputs provide a long message, a registered Interval/ThreePointCubic animation,
and stop/jump controls using the actual Source scroll controller.
