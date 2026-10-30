// SPDX-License-Identifier: BSD-3-Clause
import type { HostComponent, NativeSyntheticEvent, ViewProps } from 'react-native';
import type { ViewEnvironment } from '@nelyx/core/ui/types';
import type { ReactNativeBackend } from './registration.ts';
interface Snapshot {
  readonly revision: number;
  readonly environment: ViewEnvironment;
}
interface NativeProps extends ViewProps {
  readonly onNelyxEnvironment: (event: NativeSyntheticEvent<Snapshot>) => void;
}
export function createAndroidEnvironment(
  getBackend: () => Pick<ReactNativeBackend, 'react' | 'native'>,
) {
  let component: HostComponent<NativeProps> | undefined;
  return function AndroidEnvironment(props: { readonly changed: (snapshot: Snapshot) => void }) {
    const { react, native } = getBackend();
    component ??= native.requireNativeComponent<NativeProps>('NelyxEnvironment');
    return react.createElement(component, {
      style: { position: 'absolute', left: 0, top: 0, width: 0, height: 0 },
      pointerEvents: 'none',
      accessible: false,
      onNelyxEnvironment: (event) => props.changed(event.nativeEvent),
    });
  };
}
