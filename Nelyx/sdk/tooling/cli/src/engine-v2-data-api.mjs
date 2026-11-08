// SPDX-License-Identifier: BSD-3-Clause
/** These APIs retain their canonical implementation and public constructor signatures. */
export const engineV2DataApis = Object.freeze(
  [
    'foundation/constants',
    'foundation/numbers',
    'foundation/errors',
    'foundation/key',
    'foundation/notifier',
    'foundation/disposable',
    'foundation/clock',
    'services/asset-bundle',
    'services/asset-manifest',
    'ui/color',
    'ui/immutable-buffer',
    'ui/image-descriptor',
    'ui/image-decoder',
    'ui/codec',
    'ui/image',
    'ui/size',
    'ui/offset',
    'ui/rect',
    'ui/radius',
    'ui/rrect',
    'ui/geometry',
    'ui/types',
    'ui/clip',
    'ui/typography',
    'ui/matrix4',
    'framework/painting/alignment',
    'framework/painting/edge-insets',
    'framework/painting/border-radius',
    'framework/painting/color-swatch',
    'framework/painting/basic-types',
    'framework/animation/curves',
    'framework/rendering/constraints',
  ]
    .map((name) => '@nelyx/core/' + name)
    .concat('@nelyx/material/colors'),
);
export function isEngineV2DataApi(name) {
  return (
    engineV2DataApis.includes(name) ||
    /^@nelyx\/core\/(foundation\/[^/]+|math\/[^/]+|framework\/physics\/[^/]+)$/.test(name)
  );
}
/** The runner and audit use this same original-import selection policy. */
export function engineV2ImportRoute(name) {
  return /^@nelyx\/(core|material|cupertino)\/v2$/.test(name) ||
    name === '@nelyx/core/v2/original' ||
    name === '@nelyx/core/engine' ||
    name === '@nelyx/core/internal/runtime/app' ||
    name === '@nelyx/sdk/app' ||
    name === '@nelyx/sdk/engine' ||
    name === '@nelyx/sdk/engine-v2-original' ||
    name === '@nelyx/sdk/engine-v2' ||
    isEngineV2DataApi(name)
    ? name
    : null;
}
/** Candidate App imports require the explicit original-elements SDK entry in the bundle. */
export function engineV2OriginalAppRoute(name) {
  return /^@nelyx\/(?:core\/(framework\/(widgets|rendering|painting|animation|gestures|scheduler|semantics)\/[^/]+|ui\/[^/]+|services\/(mouse-cursor|keyboard-key|hardware-keyboard|font-loader|input-formatters|clipboard|binary-messenger|channel-binding|message-codec|message-codecs)|hosting\/(resources|interaction))|(?:material|cupertino)\/[^/]+)$/.test(
    name,
  )
    ? name
    : null;
}
/** Canonical App implementation stays available; the native bridge rejects unported operations before execution. Root and platform hosts remain excluded. */
export function isEngineV2OriginalAppImplementation(relative) {
  return (
    /^(foundation\/|math\/|ui\/|services\/|framework\/)/.test(relative) ||
    /^runtime\/(owner-transaction|dependency-scope|depth-queue)\.js$/.test(relative) ||
    /^hosting\/(section-lifetime|editor-style|input-geometry|resources|images|flex-layout|text-fonts|text-layout-budget|interaction|editing-configuration)\.js$/.test(
      relative,
    )
  );
}
/** A reused value API must not pull an old Widget, RenderObject or host into the bundle. */
export function isEngineV2DataImplementation(relative) {
  return /^(hosting\/(images|resources)\.js$|foundation\/|math\/|services\/(asset-bundle|asset-loader-binding|asset-manifest|json-serialization|message-codec|message-codecs|value-string)\.js$|ui\/(color|color-source-adapter|size|offset|offset-base|rect|radius|rrect|rrect-data|geometry|types|clip|typography|matrix4|math|value-math|immutable-buffer|immutable-buffer-binding|image|codec|image-descriptor|image-descriptor-binding|image-decoder|resource-retention|frame-resource-list-binding)(\.js$|\/)|internal\/ui\/color-source-adapter\.js$|framework\/physics\/|framework\/animation\/(curves|bounce)\.js$|framework\/painting\/(alignment|edge-insets|border-radius|color-swatch|basic-types)\.js$|framework\/rendering\/constraints\.js$)/.test(
    relative,
  );
}
