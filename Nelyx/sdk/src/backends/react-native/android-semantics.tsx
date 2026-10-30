// SPDX-License-Identifier: BSD-3-Clause
import type { HostComponent, ViewProps } from 'react-native';
import type { ReactNode, ComponentRef } from 'react';
import type { SemanticsNode, SemanticsAction } from '@nelyx/core/ui/types';
import { LocaleStringAttribute, SpellOutStringAttribute } from '@nelyx/core/ui/string-attribute';
import type { ReactNativeBackend } from './registration.ts';
import type { NativeInteraction } from '../../runtime/native-interaction.ts';
interface NativeAttribute {
  readonly kind: 'locale' | 'spellOut';
  readonly start: number;
  readonly end: number;
  readonly locale?: string;
}
interface NativeProps extends ViewProps {
  readonly semanticsProtocol: 2;
  readonly textInput: {
    readonly value: string;
    readonly anchor: number;
    readonly focus: number;
    readonly readOnly: boolean;
    readonly obscured: boolean;
    readonly multiline: boolean;
    readonly focused: boolean;
    readonly focusable: boolean;
    readonly enabled: boolean;
    readonly target: number | null;
  } | null;
  readonly labelAttributes: readonly NativeAttribute[];
}
/** Keep Java UTF16 span offsets and the framework's logical child order. */
export function createAndroidSemantics(
  getBackend: () => Pick<ReactNativeBackend, 'react' | 'native'>,
) {
  let component: HostComponent<NativeProps> | undefined;
  return function AndroidSemantics({
    node,
    interaction,
    style,
    children,
  }: {
    readonly node: SemanticsNode;
    readonly interaction: NativeInteraction;
    readonly style: ViewProps['style'];
    readonly children?: ReactNode;
  }) {
    const { react, native } = getBackend();
    if (!component) {
      const config = native.UIManager.getViewManagerConfig('NelyxSemantics'),
        constants = config && 'Constants' in config ? config.Constants : undefined;
      if (
        !constants ||
        typeof constants !== 'object' ||
        !('semanticsProtocol' in constants) ||
        constants.semanticsProtocol !== 2
      )
        throw new Error('Android semantics protocol2 requires the current SDK native sources');
      component = native.requireNativeComponent<NativeProps>('NelyxSemantics');
    }
    react.useSyncExternalStore(interaction.subscribe, interaction.snapshot);
    const ref = react.useRef<ComponentRef<HostComponent<NativeProps>>>(null),
      token = react.useRef({});
    react.useLayoutEffect(
      () =>
        interaction.attachSemanticsNode(node.id, token.current, () =>
          native.findNodeHandle(ref.current),
        ),
      [interaction, node.id, native],
    );
    const labelAttributes: NativeAttribute[] = (node.nameAttributes ?? []).map((attribute) => {
      const range = { start: attribute.range.start, end: attribute.range.end };
      if (attribute instanceof LocaleStringAttribute)
        return { kind: 'locale', ...range, locale: attribute.locale.toLanguageTag() };
      if (attribute instanceof SpellOutStringAttribute) return { kind: 'spellOut', ...range };
      throw new Error('Unsupported Android semantics string attribute');
    });
    const actionNames = new Set(Object.keys(node.actions ?? {}));
    if (node.activate) actionNames.add('activate');
    const accessible =
      node.role === 'text-field' || node.role === 'button' || !node.children?.length;
    const textInput =
      node.role === 'text-field'
        ? {
            value: node.value ?? '',
            anchor: node.textSelection?.anchor ?? 0,
            focus: node.textSelection?.focus ?? 0,
            readOnly: node.readOnly ?? false,
            obscured: node.obscured ?? false,
            multiline: node.multiline ?? false,
            focused: node.focused ?? false,
            focusable: node.focusable !== false,
            enabled: node.enabled,
            target: interaction.editorNativeTag(node.id),
          }
        : null;
    // Unlike a flattenable RN View, this native ordering container always exists.
    // Exclude structural groups themselves while preserving their descendants.
    return react.createElement(
      component,
      {
        ref,
        style,
        pointerEvents: 'box-none',
        semanticsProtocol: 2,
        textInput,
        labelAttributes,
        accessible,
        focusable: false,
        importantForAccessibility: accessible ? 'auto' : 'no',
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
        ...(node.semanticsIdentifier !== undefined ? { testID: node.semanticsIdentifier } : {}),
        accessibilityState: {
          disabled: !node.enabled,
          ...(node.selected !== undefined ? { selected: node.selected } : {}),
          ...(node.checked !== undefined ? { checked: node.checked } : {}),
        },
        ...(node.role !== 'text-field' && node.value
          ? { accessibilityValue: { text: node.value } }
          : {}),
        accessibilityActions: [...actionNames].map((name) => ({ name })),
        onAccessibilityAction: (event) => {
          if (interaction.isLiveNodeSnapshot(node))
            interaction.performAction(node.id, event.nativeEvent.actionName as SemanticsAction);
        },
      },
      children,
    );
  };
}
