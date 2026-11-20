import { nativeEditingConfiguration } from './editing-configuration.ts';
import { freezeEditingConfiguration } from '@nelyx/core/hosting/interaction';
import { nativeControlInputProps } from './control-input.ts';
import { windowsSurfaceEnvelope } from './windows-surface-envelope.ts';
// SPDX-License-Identifier: BSD-3-Clause
import type { ComponentRef, ReactNode, Ref } from 'react';
import type { HostComponent, NativeSyntheticEvent, TextInput, ViewProps } from 'react-native';
import type { ReactNativeBackend } from './registration.ts';
import type {
  NativeEditingSnapshot,
  NativeEditorPort,
  NativeInteraction,
} from '../../runtime/native-interaction.ts';
import { createAndroidEditor } from './android-editor.tsx';
import { editorColor } from '../editor-style.ts';
export interface NativeStyle {
  readonly [property: string]: string | number | boolean | undefined;
}
export interface NativeLayerProps {
  readonly style?: NativeStyle;
  readonly children?: ReactNode;
  readonly passThrough?: boolean;
}
export interface NativeTextFieldHandle {
  replace(text: string, selection: { start: number; end: number }): void;
  focus(): void;
  blur(): void;
}
export interface NativeTextFieldProps {
  readonly label: string;
  readonly initialValue: string;
  readonly maxLength?: number;
  readonly style?: NativeStyle;
  readonly onText: (text: string, revision: number) => void;
  readonly onSelection: (start: number, end: number) => void;
  readonly onFocus: () => void;
  readonly onBlur: () => void;
  readonly interaction?: NativeInteraction;
  readonly controlId?: string;
}
export interface NativeButtonProps extends NativeLayerProps {
  readonly label: string;
  readonly onActivate: () => void;
  readonly interaction?: NativeInteraction;
  readonly controlId?: string;
}
interface AppleEditorTraitsProps extends ViewProps {
  readonly onNelyxEditing?: (event: NativeSyntheticEvent<NativeEditingSnapshot>) => void;
  readonly editorOptions: {
    readonly smartDashesType: 'enabled' | 'disabled';
    readonly smartQuotesType: 'enabled' | 'disabled';
    readonly stylusHandwritingEnabled: boolean;
    readonly multiline: boolean;
    readonly initialSelection?: { readonly anchor: number; readonly focus: number };
  };
}
/** Components are created once per platform composition and resolve initialized modules when rendered. */
export function createReactNativeControls(
  getBackend: () => Pick<ReactNativeBackend, 'react' | 'native'>,
) {
  const AndroidEditor = createAndroidEditor(getBackend);
  let AppleEditorTraits: HostComponent<AppleEditorTraitsProps> | null | undefined;
  function NativeLayer({ style, children, passThrough }: NativeLayerProps) {
    const { react, native } = getBackend();
    return react.createElement(
      native.View,
      {
        style,
        ...(native.Platform.OS === 'windows'
          ? { collapsable: false, testID: windowsSurfaceEnvelope(style) }
          : {}),
        pointerEvents: passThrough ? 'box-none' : 'auto',
      },
      children,
    );
  }
  function NativeText({
    style,
    children,
    scale = true,
  }: NativeLayerProps & { readonly scale?: boolean }) {
    const { react, native } = getBackend();
    return react.createElement(native.Text, { style, allowFontScaling: scale }, children);
  }
  function NativeButton({
    style,
    children,
    label,
    onActivate,
    interaction,
    controlId,
    passThrough,
  }: NativeButtonProps) {
    const { react, native } = getBackend();
    react.useSyncExternalStore(
      interaction?.subscribe ?? emptySubscribe,
      interaction?.snapshot ?? emptySnapshot,
    );
    const node = interaction?.node(controlId ?? '', 'button'),
      enabled = interaction ? !!node?.enabled : true;
    const activate = () => {
      if (interaction) {
        if (node && interaction.isLiveNodeSnapshot(node)) interaction.activate(controlId ?? '');
      } else onActivate();
    };
    return react.createElement(
      native.Pressable,
      {
        style,
        pointerEvents: passThrough ? 'none' : 'auto',
        disabled: !enabled,
        accessibilityRole: node?.isLink ? 'link' : 'button',
        accessibilityLabel: node?.name ?? label,
        ...(node?.semanticsIdentifier !== undefined ? { testID: node.semanticsIdentifier } : {}),
        accessibilityState: { disabled: !enabled },
        onPress: activate,
        ...nativeControlInputProps(native.Platform.OS, interaction, node),
        ...(native.Platform.OS === 'windows' ? { onAccessibilityTap: activate } : {}),
      },
      children,
    );
  }
  const emptySubscribe = () => () => {};
  const emptySnapshot = () => 0;
  /** React 19 supplies ref as a prop; hooks and native modules resolve after bootstrap. */
  function NativePublicTextField(
    props: NativeTextFieldProps & { readonly ref?: Ref<NativeTextFieldHandle> },
  ) {
    const { react, native: host } = getBackend();
    const native = react.useRef<TextInput>(null);
    const apple = react.useRef<ComponentRef<HostComponent<AppleEditorTraitsProps>>>(null);
    const appleRevision = react.useRef(0);
    const appleCommandSequence = react.useRef(0);
    const initialSelection = react.useRef(
      props.interaction?.editorValue(props.controlId ?? 'editor')?.selection,
    );
    const token = react.useRef({});
    const appleObserved =
      host.Platform.OS === 'ios' && props.interaction?.policy.nativeSnapshots === true;
    const sendApple = (command: Record<string, unknown>) =>
      apple.current?.setNativeProps({
        editingCommand: { ...command, sequence: ++appleCommandSequence.current },
      });
    const commands = react.useMemo<NativeEditorPort>(
      () => ({
        replace(text, selection, revision, request) {
          if (props.interaction && !props.interaction.policy.commands)
            throw new Error('Native editing replacement unavailable');
          if (appleObserved)
            sendApple({
              kind: 'replace',
              text,
              anchor: selection.start,
              focus: selection.end,
              revision: revision ?? appleRevision.current,
              request: request ?? null,
            });
          else native.current?.setNativeProps({ text, selection });
        },
        focus() {
          if (props.interaction && !props.interaction.policy.commands)
            throw new Error('Native editing focus unavailable');
          native.current?.focus();
        },
        blur() {
          if (props.interaction && !props.interaction.policy.commands)
            throw new Error('Native editing blur unavailable');
          native.current?.blur();
        },
        ...(appleObserved
          ? {
              replaceComposing: (text, selection, revision, request) =>
                sendApple({
                  kind: 'cancel',
                  text,
                  anchor: selection.start,
                  focus: selection.end,
                  revision,
                  request: request ?? null,
                }),
              applyCompositionLimit: ({ text, selection, composing }, revision) =>
                sendApple({
                  kind: 'limit',
                  text,
                  anchor: selection.anchor,
                  focus: selection.focus,
                  composingStart: composing.status === 'active' ? composing.start : -1,
                  composingEnd: composing.status === 'active' ? composing.end : -1,
                  revision,
                }),
            }
          : {}),
      }),
      [props.interaction, appleObserved],
    );
    react.useImperativeHandle(props.ref, () => commands, [commands]);
    react.useLayoutEffect(
      () => props.interaction?.attachEditor(props.controlId ?? '', token.current, commands),
      [props.interaction, props.controlId, commands],
    );
    react.useLayoutEffect(
      () =>
        props.interaction?.attachSemanticsNode(props.controlId ?? '', token.current, () =>
          host.findNodeHandle(native.current),
        ),
      [props.interaction, props.controlId, host],
    );
    react.useSyncExternalStore(
      props.interaction?.subscribe ?? emptySubscribe,
      props.interaction?.snapshot ?? emptySnapshot,
    );
    const node = props.interaction?.node(props.controlId ?? '', 'text-field'),
      enabled = props.interaction
        ? !!node?.enabled && !!props.interaction.editorValue(props.controlId ?? 'editor')
        : true;
    const action = props.interaction?.editorAction(props.controlId ?? 'editor') ?? 'done',
      configuration =
        props.interaction?.editorConfiguration(props.controlId ?? 'editor') ??
        freezeEditingConfiguration();
    if (host.Platform.OS === 'ios' && props.interaction && AppleEditorTraits === undefined) {
      AppleEditorTraits = host.UIManager.getViewManagerConfig('NelyxTextInputTraits')
        ? host.requireNativeComponent<AppleEditorTraitsProps>('NelyxTextInputTraits')
        : null;
    }
    const traits = props.interaction && AppleEditorTraits;
    const { position, left, top, right, bottom, width, height, ...editorStyle } = props.style ?? {};
    const input = react.createElement(host.TextInput, {
      ref: native,
      accessibilityLabel: node?.name ?? props.label,
      ...nativeEditingConfiguration(configuration, host.Platform.OS),
      ...(node?.editorStyle
        ? {
            allowFontScaling: false,
            selectionColor: editorColor(node.editorStyle.selectionColor),
            cursorColor: editorColor(node.editorStyle.cursorColor),
            underlineColorAndroid: 'transparent',
          }
        : {}),
      editable: enabled && !configuration.readOnly,
      focusable: node?.focusable !== false,
      accessibilityState: { disabled: !enabled },
      defaultValue:
        props.interaction?.editorValue(props.controlId ?? 'editor')?.text ?? props.initialValue,
      maxLength: props.maxLength,
      style: traits ? { ...editorStyle, alignSelf: 'stretch', flexGrow: 1 } : props.style,
      returnKeyType: action === 'enter' ? 'default' : action,
      submitBehavior: configuration.multiline && action === 'enter' ? 'newline' : 'submit',
      ...nativeControlInputProps(host.Platform.OS, props.interaction, node),
      onSubmitEditing: () => {
        if (appleObserved) sendApple({ kind: 'submit', action });
        else props.interaction?.observe(token.current, { kind: 'submit' });
      },
      onChange: ({ nativeEvent }) => {
        if (appleObserved) return;
        if (props.interaction)
          props.interaction.observe(token.current, {
            kind: 'text',
            text: nativeEvent.text,
            eventCount: nativeEvent.eventCount,
          });
        else props.onText(nativeEvent.text, nativeEvent.eventCount);
      },
      onSelectionChange: ({ nativeEvent }) => {
        if (appleObserved) sendApple({ kind: 'observe' });
        else if (props.interaction)
          props.interaction.observe(token.current, { kind: 'selection', ...nativeEvent.selection });
        else props.onSelection(nativeEvent.selection.start, nativeEvent.selection.end);
      },
      onFocus: () => {
        if (
          appleObserved ||
          !props.interaction ||
          props.interaction.observe(token.current, { kind: 'focus' })
        )
          props.onFocus();
      },
      onBlur: () => {
        if (
          appleObserved ||
          !props.interaction ||
          props.interaction.observe(token.current, { kind: 'blur' })
        )
          props.onBlur();
      },
    });
    return traits
      ? react.createElement(
          traits,
          {
            ref: apple,
            ...(appleObserved
              ? {
                  onNelyxEditing: ({
                    nativeEvent,
                  }: NativeSyntheticEvent<NativeEditingSnapshot>) => {
                    appleRevision.current = Math.max(appleRevision.current, nativeEvent.revision);
                    props.interaction!.observeSnapshot(token.current, nativeEvent);
                  },
                }
              : {}),
            style: { position, left, top, right, bottom, width, height } as ViewProps['style'],
            accessible: false,
            pointerEvents: 'box-none',
            editorOptions: {
              smartDashesType: configuration.smartDashesType ?? 'enabled',
              smartQuotesType: configuration.smartQuotesType ?? 'enabled',
              multiline: configuration.multiline,
              ...(appleObserved && initialSelection.current
                ? { initialSelection: initialSelection.current }
                : {}),
              stylusHandwritingEnabled:
                configuration.stylusHandwritingEnabled !== false &&
                !configuration.readOnly &&
                !configuration.obscureText,
            },
          },
          input,
        )
      : input;
  }
  function NativeTextField(
    props: NativeTextFieldProps & { readonly ref?: Ref<NativeTextFieldHandle> },
  ) {
    const { react, native } = getBackend();
    react.useSyncExternalStore(
      props.interaction?.subscribe ?? emptySubscribe,
      props.interaction?.snapshot ?? emptySnapshot,
    );
    if (props.interaction && native.Platform.OS === 'windows')
      throw new Error('Core Windows editing is owned by ApplicationSurface nonvisual input');
    const observed = props.interaction?.policy.nativeSnapshots,
      Editor = observed && native.Platform.OS === 'android' ? AndroidEditor : NativePublicTextField;
    return react.createElement(Editor, {
      ...props,
      key: props.interaction?.editorGeneration(props.controlId ?? 'editor') ?? 0,
    });
  }
  return { NativeLayer, NativeText, NativeButton, NativeTextField };
}
