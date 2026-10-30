// SPDX-License-Identifier: BSD-3-Clause
import { androidBackend, androidEnvironment, androidAssets } from './application.ts';
import type { AndroidSurfaceKind } from './application.ts';
import { createReactNativeSurface } from '../../backends/react-native/surface.tsx';
import type { ReactNativeSurfaceProps } from '../../backends/react-native/surface.tsx';
import { acquireAndroidAssets, androidAssetService } from './assets.ts';
import { AndroidInteraction } from './interaction.ts';

export interface ApplicationSurfaceProps extends ReactNativeSurfaceProps {
  readonly surface?: AndroidSurfaceKind;
}
const Surface = createReactNativeSurface<ApplicationSurfaceProps>({
  target: 'android',
  backend: androidBackend,
  assets: androidAssets,
  environment: androidEnvironment,
  assetServices: { acquire: acquireAndroidAssets, service: androidAssetService },
  visibility: () => androidBackend().native.AppState,
  interaction: (owner) => new AndroidInteraction(owner),
  nativeViewProps: (props) => ({
    android: { surfaceType: props.surface === 'surface' ? 'SurfaceView' : 'TextureView' },
  }),
});
/** Android owns the native TextureView/SurfaceView choice; shared RN code owns the mounted session. */
export function ApplicationSurface(props: ApplicationSurfaceProps) {
  return androidBackend().react.createElement(Surface, props);
}
