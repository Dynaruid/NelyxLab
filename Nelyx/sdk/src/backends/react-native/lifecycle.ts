// SPDX-License-Identifier: BSD-3-Clause

export interface ReactNativeAppStatePort {
  readonly isAvailable: boolean;
  readonly currentState: string | null;
  addEventListener(type: 'change', changed: (state: string) => void): { remove(): void };
}
/** Native platform adapters must supply an observed visibility port; absence never implies active. */
export function bindReactNativeVisibility(
  port: ReactNativeAppStatePort,
  changed: (visible: boolean) => void,
) {
  if (!port.isAvailable)
    throw new Error('React Native AppState is unavailable; supply a native visibility adapter');
  let live = true;
  const subscription = port.addEventListener('change', (state) => {
    if (live) changed(state === 'active');
  });
  return {
    visible: port.currentState === 'active',
    dispose() {
      if (!live) return;
      live = false;
      subscription.remove();
    },
  };
}
