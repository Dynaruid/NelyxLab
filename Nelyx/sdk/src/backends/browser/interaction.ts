// SPDX-License-Identifier: BSD-3-Clause
import { freezeEditingConfiguration } from '@nelyx/core/hosting/interaction';
import type {
  EditingHost,
  EditingBinding,
  SemanticsHost,
  EditingConfiguration,
} from '@nelyx/core/hosting/interaction';
import type { SemanticsInputObserver } from '@nelyx/core/hosting/interaction';
import type { SemanticsAction } from '@nelyx/core/ui/types';
import type { TextEditingValue, SemanticsNode } from '@nelyx/core/ui/types';
import { freezeEditing } from '@nelyx/core/ui/editing';
import { sameOwner } from '@nelyx/core/ui/frame';
import { freezeTextRect } from '@nelyx/core/ui/text';
import { freezeSemantics, flattenSemantics } from '@nelyx/core/framework/semantics/semantics';
import { LocaleStringAttribute, SpellOutStringAttribute } from '@nelyx/core/ui/string-attribute';
import { SemanticsRole } from '@nelyx/core/ui/semantics';
import type { BrowserMouseCursor } from './mouse-cursor.ts';
import { createBrowserEditContext, hasBrowserEditContext } from './edit-context.ts';
import type { BrowserInputViewport } from './edit-context.ts';
interface Editor {
  element: HTMLElement;
  configuration?: EditingConfiguration;
  binding?: EditingBinding;
  value?: TextEditingValue;
  changed?: (value: TextEditingValue) => void;
  composing: boolean;
  used: boolean;
}
const inputCarrierStyle = {
  pointerEvents: 'none',
  opacity: '0',
  color: 'transparent',
  caretColor: 'transparent',
  background: 'transparent',
  border: '0',
  outline: 'none',
  boxShadow: 'none',
  resize: 'none',
  appearance: 'none',
  overflow: 'hidden',
  forcedColorAdjust: 'none',
  fontSize: '16px',
  boxSizing: 'border-box',
};
/* oxlint-disable no-control-regex -- Control code points are deliberately matched for input validation or normalization. */
const hasLineBreak = (text: string) => /[\r\n\u0085\u000b\u000c\u2028\u2029]/.test(text);
/* oxlint-enable no-control-regex */
/** Stable DOM controls per editor; native composition ranges remain unavailable. */
export function createDomInteraction(
  input: HTMLInputElement,
  button: HTMLButtonElement,
  cursor?: BrowserMouseCursor,
  readViewport?: () => BrowserInputViewport,
  accessibilityEnabled = true,
) {
  let closed = false,
    bound = false,
    moving = false;
  const parent = input.parentElement,
    buttonParent = button.parentElement;
  if (!parent || !buttonParent) throw new Error('DOM interaction requires attached controls');
  const inputSibling = input.nextSibling,
    buttonSibling = button.nextSibling;
  // React retains these placeholder nodes across surface effects. Return them
  // to their owning parents before removing our temporary semantics groups.
  const restore = (element: HTMLElement, container: HTMLElement, sibling: ChildNode | null) => {
    element.style.display = 'none';
    if (element.parentElement !== container)
      container.insertBefore(element, sibling?.parentNode === container ? sibling : null);
  };
  let publishedNodes = new Map<string, SemanticsNode>(),
    publishedElements = new Set<HTMLElement>(),
    inputObserver: SemanticsInputObserver | undefined;
  const ownsSemanticEvent = (element: HTMLElement, event: Event): boolean => {
    let target = event.target instanceof HTMLElement ? event.target : null;
    while (target && !publishedElements.has(target)) target = target.parentElement;
    return target === element;
  };
  const attributedLabels = new WeakMap<HTMLElement, HTMLElement>();
  function label(node: SemanticsNode, element: HTMLElement): void {
    if (node.tooltip) element.setAttribute('aria-description', node.tooltip);
    else element.removeAttribute('aria-description');
    if (node.semanticsIdentifier !== undefined)
      element.dataset.semanticsIdentifier = node.semanticsIdentifier;
    else delete element.dataset.semanticsIdentifier;
    if (node.role === 'button') {
      if (node.isLink) element.setAttribute('role', 'link');
      else element.removeAttribute('role');
    }
    if (
      !node.nameAttributes?.length ||
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement
    ) {
      attributedLabels.get(element)?.remove();
      element.setAttribute('aria-label', node.name);
      return;
    }
    // A flat aria-label would hide descendant language changes from readers.
    // Native spelling support depends on the browser's CSS Speech implementation.
    element.removeAttribute('aria-label');
    let container = attributedLabels.get(element);
    if (!container) {
      container = document.createElement('span');
      container.style.color = 'transparent';
      attributedLabels.set(element, container);
    }
    container.replaceChildren();
    if (container.parentNode !== element) element.prepend(container);
    if (element instanceof HTMLButtonElement)
      for (const child of Array.from(element.childNodes)) if (child !== container) child.remove();
    const cuts = [
      ...new Set([
        0,
        node.name.length,
        ...node.nameAttributes.flatMap((attribute) => [attribute.range.start, attribute.range.end]),
      ]),
    ].sort((a, b) => a - b);
    for (let i = 0; i < cuts.length - 1; i++) {
      const start = cuts[i]!,
        end = cuts[i + 1]!,
        span = document.createElement('span');
      span.textContent = node.name.slice(start, end);
      for (const attribute of node.nameAttributes)
        if (attribute.range.start <= start && attribute.range.end >= end) {
          if (attribute instanceof LocaleStringAttribute)
            span.lang = attribute.locale.toLanguageTag();
          else if (attribute instanceof SpellOutStringAttribute) {
            span.style.setProperty('speak-as', 'spell-out');
            span.dataset.nelyxSpellOut = 'true';
          }
        }
      container.appendChild(span);
    }
  }
  const performAction = (node: SemanticsNode, action: SemanticsAction, perform: () => void) => {
    const current = () => !closed && bound && publishedNodes.get(node.id) === node && node.enabled;
    if (!current()) return;
    const guarded = () => {
      if (current()) perform();
    };
    if (inputObserver) inputObserver.dispatchAction(node.id, action, guarded);
    else guarded();
  };
  const fields = new Map<string, Editor>(),
    buttons = new Map<string, HTMLButtonElement>(),
    passive = new Map<string, HTMLDivElement>();
  let inputUsed = false,
    buttonUsed = false;
  const origins = new WeakMap<HTMLElement, { readonly x: number; readonly y: number }>();
  origins.set(parent, { x: 0, y: 0 });
  const originOf = (element: HTMLElement) => {
    let x = 0,
      y = 0;
    for (
      let current: HTMLElement | null = element;
      current && current !== parent;
      current = current.parentElement
    ) {
      const local = origins.get(current);
      if (local) {
        x += local.x;
        y += local.y;
      }
    }
    return { x, y };
  };
  const containsComposition = (element: HTMLElement) =>
    [...fields.values()].some(
      (editor) =>
        editor.composing && (editor.element === element || element.contains(editor.element)),
    );
  // Source semantic groups can appear/disappear while an editor is focused.
  // Retain old composing ancestry on older browsers until the commit snapshot.
  function place(
    element: HTMLElement,
    container: HTMLElement,
    before: Node | null = null,
  ): boolean {
    if (element.parentElement === container && element.nextSibling === before) return true;
    const stateful = container as HTMLElement & {
      moveBefore?: (node: Node, before: Node | null) => void;
    };
    if (element.isConnected && container.isConnected && typeof stateful.moveBefore === 'function') {
      stateful.moveBefore(element, before);
      return true;
    }
    if (containsComposition(element)) return false;
    const focused = document.activeElement,
      restore =
        focused instanceof HTMLElement && (element === focused || element.contains(focused));
    const selection =
      restore && (focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement)
        ? {
            start: focused.selectionStart,
            end: focused.selectionEnd,
            direction: focused.selectionDirection,
          }
        : undefined;
    moving = true;
    try {
      container.insertBefore(element, before);
      if (restore) {
        focused.focus({ preventScroll: true });
        if (
          selection &&
          selection.start !== null &&
          selection.end !== null &&
          (focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement)
        )
          focused.setSelectionRange(
            selection.start,
            selection.end,
            selection.direction ?? undefined,
          );
      }
    } finally {
      moving = false;
    }
    return true;
  }
  function field(id: string): Editor {
    let editor = fields.get(id);
    if (!editor) {
      const element = inputUsed ? document.createElement('input') : input;
      inputUsed = true;
      if (element !== input) parent!.appendChild(element);
      element.style.cssText =
        'position:absolute;display:none;pointer-events:none;opacity:0;color:transparent;caret-color:transparent;background:transparent;border:0;outline:none;box-shadow:none;resize:none;appearance:none;overflow:hidden;forced-color-adjust:none;font-size:16px;box-sizing:border-box';
      editor = { element, composing: false, used: false };
      fields.set(id, editor);
    }
    return editor;
  }
  const editing: EditingHost = {
    capabilities: {
      indexUnit: 'utf16',
      composing: 'unavailable',
      selectionDirection: 'observed',
      geometry: 'unavailable',
    },
    bind(owner, initial, changed, options) {
      if (closed || !sameOwner(owner, initial.session))
        throw new Error('DOM editing owner/session mismatch');
      const configuration = freezeEditingConfiguration(options?.configuration);
      if (configuration.obscureText && /[\r\n]/.test(initial.text))
        throw new Error('Browser password editors cannot represent CR/LF');
      const editor = field(options?.id ?? 'editor');
      if (editor.binding) throw new Error('DOM editing session already bound');
      if (
        readViewport &&
        hasBrowserEditContext() &&
        !configuration.obscureText &&
        !configuration.autofillHints?.length
      ) {
        const previous = editor.element;
        cursor?.remove(previous);
        const connection = createBrowserEditContext({
          owner,
          initial,
          options: { ...options, id: options?.id ?? 'editor', configuration },
          viewport: readViewport,
          moving: () => moving,
          changed: (value) => {
            editor.composing = connection.composing;
            editor.value = value;
            changed(value);
          },
        });
        const element = connection.element;
        if (!accessibilityEnabled) element.setAttribute('aria-hidden', 'true');
        parent!.appendChild(element);
        if (previous !== input) previous.remove();
        else previous.style.display = 'none';
        editor.element = element;
        editor.used = true;
        editor.configuration = configuration;
        editor.value = initial;
        const port = connection.binding,
          binding: EditingBinding = {
            get isComposing() {
              return connection.composing;
            },
            read: () => port.read(),
            replace: (value) => port.replace(value),
            replaceComposing: (value) => port.replaceComposing!(value),
            updateGeometry: (geometry) => port.updateGeometry!(geometry),
            focus: () => port.focus(),
            blur: () => port.blur(),
            dispose() {
              if (editor.binding !== binding) return;
              port.dispose();
              delete editor.binding;
              delete editor.value;
              editor.composing = false;
            },
          };
        editor.binding = binding;
        return binding;
      }
      const textarea =
        configuration.multiline || (!configuration.obscureText && hasLineBreak(initial.text));
      if (editor.used || textarea !== editor.element instanceof HTMLTextAreaElement) {
        const previous = editor.element;
        cursor?.remove(previous);
        const next = textarea
          ? document.createElement('textarea')
          : document.createElement('input');
        next.style.cssText = previous.style.cssText;
        next.style.display = 'none';
        parent!.appendChild(next);
        if (previous !== input) previous.remove();
        else previous.style.display = 'none';
        editor.element = next;
      }
      editor.used = true;
      editor.configuration = configuration;
      editor.element.dataset.nelyxInputCarrier = 'true';
      const control = editor.element;
      if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement))
        throw new Error('Native input carrier is unavailable');
      let element: HTMLInputElement | HTMLTextAreaElement = control;
      Object.assign(element.style, inputCarrierStyle);
      if (!accessibilityEnabled) element.setAttribute('aria-hidden', 'true');
      else element.removeAttribute('aria-hidden');
      editor.value = freezeEditing(initial);
      editor.changed = changed;
      element.value = initial.text;
      setSelection(element, initial);
      if (element instanceof HTMLInputElement)
        element.type = configuration.obscureText ? 'password' : 'text';
      else element.wrap = configuration.multiline ? 'soft' : 'off';
      element.readOnly = configuration.readOnly;
      element.inputMode = (
        {
          text: 'text',
          number: 'numeric',
          decimal: 'decimal',
          phone: 'tel',
          email: 'email',
          url: 'url',
        } as const
      )[configuration.keyboardType];
      element.autocapitalize = configuration.capitalization;
      element.spellcheck = configuration.enableSuggestions && configuration.autocorrect;
      element.setAttribute('autocorrect', configuration.autocorrect ? 'on' : 'off');
      element.setAttribute(
        'autocomplete',
        !configuration.readOnly && configuration.autofillHints
          ? (configuration.autofillSection
              ? 'section-' + configuration.autofillSection + ' '
              : '') + configuration.autofillHints[0]!
          : 'off',
      );
      setSelection(element, initial);
      element.enterKeyHint = options?.action ?? (configuration.multiline ? 'enter' : 'done');
      let alive = true,
        canceling = false,
        pendingReplacement: TextEditingValue | undefined,
        restoreAfterCancellation = false;
      const current = () => {
        if (!alive || closed || !editor.value) throw new Error('DOM editor session closed');
        return editor.value;
      };
      const admitsInput = () =>
        alive && !closed && options?.readInputState?.().enabled !== false && alive && !closed;
      const observe = (force = false) => {
        if (!alive || closed || (!canceling && !admitsInput())) return;
        const value = current();
        if (configuration.readOnly && element.value !== value.text) {
          element.value = value.text;
          setSelection(element, value);
          return;
        }
        const start = element.selectionStart ?? 0,
          end = element.selectionEnd ?? start,
          selection =
            element.selectionDirection === 'backward'
              ? { anchor: end, focus: start }
              : { anchor: start, focus: end };
        if (
          !force &&
          element.value === value.text &&
          selection.anchor === value.selection.anchor &&
          selection.focus === value.selection.focus
        )
          return;
        editor.value = freezeEditing({
          ...value,
          text: element.value,
          selection,
          composing: editor.composing ? { status: 'unavailable' } : { status: 'none' },
          revision: value.revision + 1,
          source: 'native',
        });
        if (!canceling) editor.changed?.(editor.value);
      };
      const start = () => {
          if (!admitsInput()) return;
          editor.composing = true;
          element.dataset.nelyxComposing = 'true';
          observe(true);
        },
        end = () => {
          editor.composing = false;
          delete element.dataset.nelyxComposing;
          observe(true);
          if (pendingReplacement)
            queueMicrotask(() => {
              if (!alive || closed || !canceling || editor.composing) return;
              const pending = pendingReplacement,
                restore = restoreAfterCancellation;
              pendingReplacement = undefined;
              restoreAfterCancellation = false;
              canceling = false;
              if (pending) replace({ ...pending, revision: current().revision });
              if (restore && admitsInput()) element.focus({ preventScroll: true });
            });
        };
      const submit: EventListener = (event) => {
        const key = event as KeyboardEvent;
        if (!admitsInput() || event.defaultPrevented || key.isComposing || editor.composing) return;
        if ((key.ctrlKey || key.metaKey) && !key.altKey) {
          const letter = key.key.toLowerCase(),
            command =
              letter === 'z'
                ? key.shiftKey
                  ? options?.onRedo
                  : options?.onUndo
                : letter === 'y'
                  ? options?.onRedo
                  : undefined;
          if (command) {
            event.preventDefault();
            command();
            return;
          }
        }
        if (key.key === 'Enter' && !key.repeat) {
          if (
            configuration.multiline &&
            (options?.action ?? 'enter') === 'enter' &&
            !key.ctrlKey &&
            !key.metaKey
          )
            return;
          observe();
          if (!admitsInput()) return;
          event.preventDefault();
          options?.onAction?.(current());
        }
      };
      const listeners: readonly [string, EventListener][] = [
        ['input', () => observe()],
        ['select', () => observe()],
        ['keydown', submit],
        ['keyup', () => observe()],
        ['mouseup', () => observe()],
        ['compositionstart', start],
        ['compositionend', end],
        [
          'focus',
          () => {
            if (!moving && !canceling && admitsInput()) options?.focusChanged?.(true);
          },
        ],
        [
          'blur',
          () => {
            if (!moving && !canceling) options?.focusChanged?.(false);
          },
        ],
      ];
      for (const [name, listener] of listeners) element.addEventListener(name, listener);
      function admitText(text: string): boolean {
        if (!hasLineBreak(text)) return false;
        if (configuration.obscureText) {
          if (/[\r\n]/.test(text))
            throw new Error('Browser password editors cannot represent CR/LF');
          return false;
        }
        if (element instanceof HTMLTextAreaElement) return false;
        const previous = element,
          next = document.createElement('textarea'),
          focused = document.activeElement === previous;
        for (const attribute of Array.from(previous.attributes))
          if (attribute.name !== 'type') next.setAttribute(attribute.name, attribute.value);
        next.wrap = 'off';
        Object.assign(next, {
          onkeydown: previous.onkeydown,
          onpointerdown: previous.onpointerdown,
          onpointermove: previous.onpointermove,
          onpointerup: previous.onpointerup,
          onpointercancel: previous.onpointercancel,
          onpointerleave: previous.onpointerleave,
        });
        for (const [name, listener] of listeners) previous.removeEventListener(name, listener);
        cursor?.remove(previous);
        previous.parentElement!.insertBefore(next, previous);
        if (previous !== input) previous.remove();
        else previous.style.display = 'none';
        element = next;
        editor.element = next;
        for (const [name, listener] of listeners) next.addEventListener(name, listener);
        return focused;
      }
      function replace(next: TextEditingValue): void {
        const value = current(),
          snapshot = freezeEditing(next);
        if (!sameOwner(snapshot.session, owner) || snapshot.revision !== value.revision)
          throw new Error('Stale DOM editing revision');
        if (editor.composing) {
          if (
            canceling ||
            snapshot.text !== value.text ||
            JSON.stringify(snapshot.composing) !== JSON.stringify(value.composing)
          )
            throw new Error('Native composition active;replacement rejected');
          setSelection(element, snapshot);
          editor.value = freezeEditing({
            ...snapshot,
            revision: value.revision + 1,
            source: 'programmatic',
          });
          editor.changed?.(editor.value);
          return;
        }
        const focused = admitText(snapshot.text);
        element.value = snapshot.text;
        setSelection(element, snapshot);
        if (focused && admitsInput()) {
          moving = true;
          try {
            element.focus({ preventScroll: true });
          } finally {
            moving = false;
          }
        }
        editor.value = freezeEditing({
          ...snapshot,
          revision: value.revision + 1,
          source: 'programmatic',
        });
        editor.changed?.(editor.value);
      }
      const binding: EditingBinding = {
        get isComposing() {
          return editor.composing;
        },
        read: current,
        replace,
        replaceComposing(next) {
          const value = current(),
            snapshot = freezeEditing(next);
          if (
            !sameOwner(snapshot.session, owner) ||
            snapshot.revision !== value.revision ||
            snapshot.composing.status !== 'none'
          )
            throw new Error('Stale/invalid DOM composition replacement');
          if (canceling) {
            pendingReplacement = snapshot;
            return;
          }
          if (!editor.composing) {
            replace(snapshot);
            return;
          }
          pendingReplacement = snapshot;
          canceling = true;
          restoreAfterCancellation = document.activeElement === element;
          element.blur();
        },
        focus() {
          current();
          if (admitsInput()) element.focus({ preventScroll: true });
        },
        blur() {
          current();
          element.blur();
        },
        dispose() {
          if (!alive) return;
          alive = false;
          canceling = false;
          pendingReplacement = undefined;
          restoreAfterCancellation = false;
          for (const [name, listener] of listeners) element.removeEventListener(name, listener);
          delete editor.binding;
          delete editor.value;
          delete editor.changed;
          editor.composing = false;
          delete element.dataset.nelyxComposing;
          element.value = '';
          element.style.display = 'none';
        },
      };
      editor.binding = binding;
      return binding;
    },
    dispose() {
      for (const editor of fields.values()) editor.binding?.dispose();
    },
  };
  function apply(node: SemanticsNode, element: HTMLElement) {
    const rect = freezeTextRect(node.bounds);
    label(node, element);
    Object.assign(element.style, {
      position: 'absolute',
      left: rect.x + 'px',
      top: rect.y + 'px',
      width: rect.width + 'px',
      height: rect.height + 'px',
      display: 'block',
    });
    if (
      node.editorGeometry &&
      (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)
    ) {
      const { bounds: full, scaleX, scaleY } = node.editorGeometry;
      const top = Math.max(0, rect.y - full.y) / scaleY,
        left = Math.max(0, rect.x - full.x) / scaleX,
        right = Math.max(0, full.x + full.width - rect.x - rect.width) / scaleX,
        bottom = Math.max(0, full.y + full.height - rect.y - rect.height) / scaleY;
      Object.assign(element.style, {
        left: full.x + 'px',
        top: full.y + 'px',
        width: full.width / scaleX + 'px',
        height: full.height / scaleY + 'px',
        transformOrigin: '0 0',
        transform: `scale(${scaleX},${scaleY})`,
        clipPath: `inset(${top}px ${right}px ${bottom}px ${left}px)`,
      });
    } else {
      element.style.transform = '';
      element.style.transformOrigin = '';
      element.style.clipPath = '';
    }
    if (element.dataset.nelyxEditContext === 'true') {
      element.tabIndex = node.focusable === false ? -1 : 0;
      element.setAttribute('aria-disabled', String(!node.enabled));
      if (node.focusable === false && document.activeElement === element) element.blur();
    }
    cursor?.add(element);
    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLButtonElement
    )
      element.disabled = !node.enabled;
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      element.tabIndex = node.focusable === false ? -1 : 0;
      if (node.focusable === false && document.activeElement === element) element.blur();
    }
  }

  function publish(tree: readonly SemanticsNode[]) {
    if (closed) throw new Error('DOM semantics closed');
    const roots = freezeSemantics(tree),
      nodes = flattenSemantics(roots);
    publishedNodes = new Map(nodes.map((node) => [node.id, node]));
    publishedElements = new Set();
    const ids = new Set(nodes.map((node) => node.id));
    for (const [id, editor] of fields)
      if (!ids.has(id)) {
        cursor?.remove(editor.element);
        editor.element.style.display = 'none';
        editor.element.onkeydown = null;
        if (!editor.binding) {
          if (editor.element !== input) editor.element.remove();
          fields.delete(id);
        }
      }
    for (const [id, element] of buttons)
      if (!ids.has(id)) {
        cursor?.remove(element);
        element.onclick = null;
        element.onkeydown = null;
        element.remove();
        buttons.delete(id);
      }
    const order = new Map<HTMLElement, HTMLElement[]>();
    const publishNode = (node: SemanticsNode, container: HTMLElement) => {
      let element: HTMLElement;
      if (node.role === 'text-field') element = field(node.id).element;
      else if (node.role === 'button') {
        let control = buttons.get(node.id);
        if (!control) {
          control = buttonUsed ? document.createElement('button') : button;
          buttonUsed = true;
          control.style.cssText =
            'position:absolute;background:transparent;color:transparent;border:0;pointer-events:none';
          buttons.set(node.id, control);
        }
        control.onclick = (event) => {
          if (!ownsSemanticEvent(control!, event)) return;
          event.stopPropagation();
          performAction(node, 'activate', () => {
            (node.actions?.activate ?? node.activate)?.();
          });
        };
        element = control;
      } else {
        let control = passive.get(node.id);
        if (!control) {
          control = document.createElement('div');
          control.style.cssText = 'position:absolute;pointer-events:none';
          passive.set(node.id, control);
        }
        control.setAttribute(
          'role',
          node.isSlider
            ? 'slider'
            : node.sourceRole === SemanticsRole.progressBar ||
                node.sourceRole === SemanticsRole.loadingSpinner
              ? 'progressbar'
              : node.role === 'text'
                ? 'note'
                : node.role === 'image'
                  ? 'img'
                  : node.role === 'list'
                    ? 'list'
                    : 'group',
        );
        element = control;
      }
      if (element.parentElement !== container) place(element, container);
      const actualParent = element.parentElement!;
      const origin = originOf(actualParent);
      apply(
        {
          ...node,
          bounds: { ...node.bounds, x: node.bounds.x - origin.x, y: node.bounds.y - origin.y },
          ...(node.editorGeometry
            ? {
                editorGeometry: {
                  ...node.editorGeometry,
                  bounds: {
                    ...node.editorGeometry.bounds,
                    x: node.editorGeometry.bounds.x - origin.x,
                    y: node.editorGeometry.bounds.y - origin.y,
                  },
                },
              }
            : {}),
        },
        element,
      );
      origins.set(element, { x: node.bounds.x - origin.x, y: node.bounds.y - origin.y });
      publishedElements.add(element);
      const siblings = order.get(actualParent) ?? [];
      siblings.push(element);
      order.set(actualParent, siblings);
      if (node.selected !== undefined) element.setAttribute('aria-selected', String(node.selected));
      else element.removeAttribute('aria-selected');
      if (node.checked !== undefined) element.setAttribute('aria-checked', String(node.checked));
      else element.removeAttribute('aria-checked');
      if (node.value !== undefined) element.setAttribute('aria-valuetext', node.value);
      else element.removeAttribute('aria-valuetext');
      if (node.isSlider) element.setAttribute('aria-disabled', String(!node.enabled));
      else element.removeAttribute('aria-disabled');
      const progress = node.sourceRole === SemanticsRole.progressBar,
        loading = node.sourceRole === SemanticsRole.loadingSpinner;
      for (const [attribute, value] of [
        ['aria-valuemin', node.minValue],
        ['aria-valuemax', node.maxValue],
        ['aria-valuenow', node.value],
      ] as const) {
        if (
          progress &&
          value !== undefined &&
          value.trim() !== '' &&
          Number.isFinite(Number(value))
        )
          element.setAttribute(attribute, value);
        else element.removeAttribute(attribute);
      }
      if (node.isSlider && node.numericRange) {
        element.setAttribute('aria-valuemin', String(node.numericRange.min));
        element.setAttribute('aria-valuemax', String(node.numericRange.max));
        element.setAttribute('aria-valuenow', String(node.numericRange.value));
      }
      if (loading) element.setAttribute('aria-busy', 'true');
      else element.removeAttribute('aria-busy');
      element.onkeydown = (event) => {
        if (event.defaultPrevented) return;
        if (
          publishedNodes.get(node.id) === node &&
          node.enabled &&
          node.isSlider &&
          ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)
        ) {
          const increase =
              event.key === 'ArrowUp' ||
              event.key === (node.textDirection === 'rtl' ? 'ArrowLeft' : 'ArrowRight'),
            type = increase ? 'increase' : 'decrease',
            action = node.actions?.[type];
          if (action) {
            event.preventDefault();
            performAction(node, type, action);
            return;
          }
        }
        if (
          publishedNodes.get(node.id) === node &&
          node.enabled &&
          ['ArrowDown', 'PageDown', 'ArrowUp', 'PageUp'].includes(event.key)
        ) {
          const type =
              event.key === 'ArrowDown' || event.key === 'PageDown'
                ? 'scroll-forward'
                : 'scroll-backward',
            action = node.actions?.[type];
          if (action) {
            event.preventDefault();
            performAction(node, type, action);
          }
        }
      };
      // Native text-field focus remains the editing channel. Other semantics
      // controls expose their actual DOM focus action without inventing an IME origin.
      element.onfocus =
        node.role !== 'text-field' && node.actions?.focus
          ? () => {
              if (!moving) performAction(node, 'focus', node.actions!.focus!);
            }
          : null;
      const pointer =
        (kind: 'down' | 'move' | 'up' | 'cancel' | 'leave') => (event: PointerEvent) => {
          if (
            event.target !== element ||
            closed ||
            !bound ||
            publishedNodes.get(node.id) !== node ||
            !node.enabled
          )
            return;
          const rect = parent!.getBoundingClientRect();
          inputObserver?.observePointer?.({
            kind: kind === 'move' && event.buttons === 0 ? 'hover' : kind,
            pointer: event.pointerId,
            device:
              event.pointerType === 'mouse' ||
              event.pointerType === 'touch' ||
              event.pointerType === 'pen'
                ? event.pointerType
                : 'unknown',
            buttons: event.buttons,
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
            timestamp: event.timeStamp,
          });
        };
      element.onpointerdown = pointer('down');
      element.onpointermove = pointer('move');
      element.onpointerup = pointer('up');
      element.onpointercancel = pointer('cancel');
      element.onpointerleave = pointer('leave');
      if (node.role !== 'text-field' && node.role !== 'button')
        element.tabIndex = node.focusable === true || node.role === 'list' ? 0 : -1;
      node.children?.forEach((child) => publishNode(child, element));
    };
    roots.forEach((node) => publishNode(node, parent!));
    // Reorder siblings around the focused editor instead of removing/reinserting its DOM subtree.
    const focused = document.activeElement;
    for (const [container, siblings] of order) {
      let anchor: Node | null = null;
      for (const element of [...siblings].reverse()) {
        if (element !== focused && !element.contains(focused) && element.nextSibling !== anchor)
          place(element, container, anchor);
        anchor = element;
      }
    }
    // Retire groups after live editors moved out. A deferred composing ancestor
    // is only a positioning shell and must not expose stale accessible labels.
    for (const [id, element] of passive)
      if (!ids.has(id)) {
        cursor?.remove(element);
        element.onkeydown = null;
        for (const attribute of ['role', 'aria-label', 'aria-description', 'tabindex'])
          element.removeAttribute(attribute);
        if (!containsComposition(element)) {
          element.remove();
          passive.delete(id);
        }
      }
  }
  const hide = () => {
    bound = false;
    inputObserver = undefined;
    publishedNodes.clear();
    for (const element of publishedElements) cursor?.remove(element);
    publishedElements.clear();
    for (const editor of fields.values()) editor.element.style.display = 'none';
    for (const element of buttons.values()) element.style.display = 'none';
    for (const element of passive.values()) element.style.display = 'none';
  };
  const semantics: SemanticsHost = {
    capability: accessibilityEnabled ? 'dom' : 'unavailable',
    bind(nodes, observer) {
      if (!accessibilityEnabled || closed || bound) throw new Error('DOM semantics already bound');
      publish(nodes);
      inputObserver = observer;
      bound = true;
      let alive = true;
      return {
        update(next) {
          if (!alive) throw new Error('DOM semantics closed');
          publish(next);
        },
        dispose() {
          if (!alive) return;
          alive = false;
          hide();
        },
      };
    },
    dispose: hide,
  };
  return {
    editing,
    semantics,
    ownsEditingTarget: (target: EventTarget | null) =>
      !closed &&
      [...fields.values()].some((editor) => !!editor.binding && editor.element === target),
    ownsSemanticsTarget: (target: EventTarget | null) =>
      !closed && bound && target instanceof HTMLElement && publishedElements.has(target),
    dispose() {
      if (closed) return;
      editing.dispose();
      semantics.dispose();
      closed = true;
      button.onclick = null;
      button.onkeydown = null;
      input.onkeydown = null;
      restore(button, buttonParent, buttonSibling);
      restore(input, parent, inputSibling);
      for (const editor of fields.values()) {
        editor.element.onkeydown = null;
        if (editor.element !== input) editor.element.remove();
      }
      for (const element of buttons.values()) {
        element.onclick = null;
        element.onkeydown = null;
        if (element !== button) element.remove();
      }
      for (const element of passive.values()) {
        element.onkeydown = null;
        element.remove();
      }
      fields.clear();
      buttons.clear();
      passive.clear();
    },
  };
}
function setSelection(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: TextEditingValue,
): void {
  element.setSelectionRange(
    Math.min(value.selection.anchor, value.selection.focus),
    Math.max(value.selection.anchor, value.selection.focus),
    value.selection.anchor > value.selection.focus ? 'backward' : 'forward',
  );
}
