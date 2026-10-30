// SPDX-License-Identifier: BSD-3-Clause
import type { HostComponent, ViewProps, NativeSyntheticEvent } from 'react-native';
import type { ReactNode, ComponentRef } from 'react';
import type { SemanticsNode, SemanticsAction } from '@nelyx/core/ui/types';
import type { ReactNativeBackend } from './registration.ts';
import type { NativeInteraction } from '../../runtime/native-interaction.ts';
import type { ReactNativeSemanticsControlsProps } from './surface.tsx';
import { windowsSemanticsPacket } from '../../platforms/windows/semantics-packet.ts';
import { WindowsSemanticsActions } from './windows-semantics-actions.ts';
import type {
  WindowsSemanticsSurface,
  WindowsSemanticsAction,
  WindowsSemanticsPacket,
} from '../../platforms/windows/semantics-packet.ts';
// RNW's app-owned Fabric builder has no reflection/codegen view manager.
// @ts-ignore RN supplies Flow implementations without TypeScript declarations.
import { register } from 'react-native/Libraries/Renderer/shims/ReactNativeViewConfigRegistry';
// @ts-ignore RN supplies Flow implementations without TypeScript declarations.
import { createViewConfig } from 'react-native/Libraries/NativeComponent/ViewConfig';
// @ts-ignore RN supplies Flow implementations without TypeScript declarations.
import base from 'react-native/Libraries/NativeComponent/BaseViewConfig';

interface NativeProps extends ViewProps {
  readonly enableFocusRing?: boolean;
  readonly coreSnapshot: WindowsSemanticsPacket;
  readonly onCoreSemanticsAction: (event: NativeSyntheticEvent<WindowsSemanticsAction>) => void;
  readonly onCoreSemanticsError: (
    event: NativeSyntheticEvent<{ readonly message: string }>,
  ) => void;
}
/** The Composition component creates no painted content and owns no input client. */
export function createWindowsSemantics(
  getBackend: () => Pick<ReactNativeBackend, 'react' | 'native'>,
) {
  return createWindowsSemanticsRenderer(getBackend, true);
}
function createWindowsSemanticsRenderer(
  getBackend: () => Pick<ReactNativeBackend, 'react' | 'native'>,
  subscribe: boolean,
) {
  let component: HostComponent<NativeProps> | undefined;
  return function WindowsSemantics({
    node,
    interaction,
    surface,
    style,
    children,
    onError,
  }: {
    readonly node: SemanticsNode;
    readonly interaction: NativeInteraction;
    readonly surface: WindowsSemanticsSurface;
    readonly style: ViewProps['style'];
    readonly children?: ReactNode;
    readonly onError: (error: unknown) => void;
  }) {
    const { react, native } = getBackend();
    // A whole tree has one store subscription. Subscribing each descendant as
    // well schedules a separate synchronous React update for every native node
    // on each scroll snapshot, in addition to the parent's recursive render.
    // Standalone nodes still own their subscription.
    if (subscribe) react.useSyncExternalStore(interaction.subscribe, interaction.snapshot);
    if (!component) {
      if (native.NativeModules.NelyxWindowsSemantics?.getSemanticsProtocol?.() !== 4)
        throw new Error(
          'Windows Core semantics requires native protocol4; resupply and rebuild the host',
        );
      component = register('NelyxCoreSemantics', () =>
        createViewConfig({
          uiViewClassName: 'NelyxCoreSemantics',
          bubblingEventTypes: base.bubblingEventTypes,
          directEventTypes: {
            ...base.directEventTypes,
            topCoreSemanticsAction: { registrationName: 'onCoreSemanticsAction' },
            topCoreSemanticsError: { registrationName: 'onCoreSemanticsError' },
          },
          validAttributes: {
            ...base.validAttributes,
            coreSnapshot: true,
            onCoreSemanticsAction: true,
            onCoreSemanticsError: true,
          },
        }),
      ) as HostComponent<NativeProps>;
    }
    const ref = react.useRef<ComponentRef<HostComponent<NativeProps>>>(null),
      token = react.useRef({});
    react.useLayoutEffect(
      () =>
        interaction.attachSemanticsNode(node.id, token.current, () =>
          native.findNodeHandle(ref.current),
        ),
      [interaction, node.id, native],
    );
    const packet = windowsSemanticsPacket(node, interaction.owner, surface, interaction.snapshot());
    const actions = react.useRef<WindowsSemanticsActions | null>(null);
    if (actions.current === null) actions.current = new WindowsSemanticsActions();
    const receiver = actions.current;
    react.useLayoutEffect(() => {
      receiver.publish(interaction, node, packet);
    });
    react.useLayoutEffect(() => () => receiver.clear(), [receiver]);
    return react.createElement(
      component,
      {
        ref,
        style,
        pointerEvents: 'none',
        collapsable: false,
        focusable: node.enabled && packet.focusable,
        enableFocusRing: false,
        accessible: node.role === 'text-field' || node.role === 'button' || !node.children?.length,
        accessibilityLabel: node.name,
        accessibilityRole: node.isLink
          ? 'link'
          : node.role === 'button'
            ? 'button'
            : node.role === 'image'
              ? 'image'
              : node.role === 'text'
                ? 'text'
                : undefined,
        testID: node.semanticsIdentifier ?? node.id,
        accessibilityState: {
          disabled: !node.enabled,
          ...(node.selected !== undefined ? { selected: node.selected } : {}),
          ...(node.checked !== undefined ? { checked: node.checked } : {}),
        },
        ...(node.role !== 'text-field' && node.value
          ? { accessibilityValue: { text: node.value } }
          : {}),
        accessibilityActions: Object.keys(node.actions ?? {}).map((name) => ({ name })),
        onAccessibilityAction: (event) => {
          if (interaction.isLiveNodeSnapshot(node))
            interaction.performAction(node.id, event.nativeEvent.actionName as SemanticsAction);
        },
        coreSnapshot: packet,
        onCoreSemanticsAction: (event) => {
          receiver.perform(event.nativeEvent);
        },
        onCoreSemanticsError: (event) => onError(new Error(event.nativeEvent.message)),
      },
      children,
    );
  };
}

export function createWindowsSemanticsTree(
  getBackend: () => Pick<ReactNativeBackend, 'react' | 'native'>,
) {
  const Node = createWindowsSemanticsRenderer(getBackend, false);
  return function WindowsSemanticsTree({
    interaction,
    readView,
    readNativeMetrics,
    onError,
  }: ReactNativeSemanticsControlsProps) {
    const { react } = getBackend();
    react.useSyncExternalStore(interaction.subscribe, interaction.snapshot);
    const metrics = readView()?.currentMetrics,
      native = readNativeMetrics();
    if (
      !metrics ||
      !native ||
      metrics.nativeSurfaceGeneration == null ||
      native.nativeReactTag === undefined
    )
      return null;
    const surface = {
      surfaceId: native.nativeReactTag,
      nativeSurfaceGeneration: metrics.nativeSurfaceGeneration,
      viewportGeneration: metrics.viewportGeneration,
    };
    const render = (node: SemanticsNode, x = 0, y = 0): ReactNode =>
      react.createElement(
        Node,
        {
          key: node.id + ':' + node.sourceNodeId + ':' + (node.textInputGeneration ?? 0),
          node,
          interaction,
          surface,
          onError,
          style: {
            position: 'absolute',
            left: node.bounds.x - x,
            top: node.bounds.y - y,
            width: node.bounds.width,
            height: node.bounds.height,
          },
        },
        node.children?.map((child) => render(child, node.bounds.x, node.bounds.y)),
      );
    return react.createElement(
      react.Fragment,
      null,
      ...interaction.semanticNodes.map((node) => render(node)),
    );
  };
}
