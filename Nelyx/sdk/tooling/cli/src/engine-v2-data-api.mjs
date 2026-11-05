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
    'ui/color',
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
    /^@nelyx\/core\/(foundation\/[^/]+|framework\/physics\/[^/]+)$/.test(name)
  );
}
/** The runner and audit use this same original-import selection policy. */
export function engineV2ImportRoute(name) {
  return /^@nelyx\/(core|material|cupertino)\/v2$/.test(name) ||
    name === '@nelyx/sdk/engine-v2' ||
    isEngineV2DataApi(name)
    ? name
    : null;
}
/** A reused value API must not pull an old Widget, RenderObject or host into the bundle. */
export function isEngineV2DataImplementation(relative) {
  return /^(foundation\/|math\/|ui\/(color|color-source-adapter|size|offset|offset-base|rect|radius|rrect|rrect-data|geometry|types|clip|typography|matrix4|math|value-math)(\.js$|\/)|internal\/ui\/color-source-adapter\.js$|framework\/physics\/|framework\/animation\/(curves|bounce)\.js$|framework\/painting\/(alignment|edge-insets|border-radius|color-swatch|basic-types)\.js$|framework\/rendering\/constraints\.js$)/.test(
    relative,
  );
}
