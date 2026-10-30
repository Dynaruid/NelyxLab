// SPDX-License-Identifier: BSD-3-Clause
// Browser OS text-input transport. Core owns the document, painting and geometry.
import type { EditingBinding, EditingOptions } from '@nelyx/core/hosting/interaction';
import type { Rect, TextEditingValue, TextInputGeometry, ViewOwner } from '@nelyx/core/ui/types';
import { freezeEditing, freezeTextInputGeometry } from '@nelyx/core/ui/editing';
import { sameOwner } from '@nelyx/core/ui/frame';

interface EditContextPort extends EventTarget {
  readonly text: string;
  readonly selectionStart: number;
  readonly selectionEnd: number;
  updateText(start: number, end: number, text: string): void;
  updateSelection(start: number, end: number): void;
  updateControlBounds(bounds: DOMRect): void;
  updateSelectionBounds(bounds: DOMRect): void;
  updateCharacterBounds(start: number, bounds: DOMRect[]): void;
}
interface EditContextConstructor {
  new (options: { text: string; selectionStart: number; selectionEnd: number }): EditContextPort;
}
interface TextUpdate extends Event {
  readonly updateRangeStart: number;
  readonly updateRangeEnd: number;
  readonly text: string;
}
interface CharacterBoundsUpdate extends Event {
  readonly rangeStart: number;
  readonly rangeEnd: number;
}
export interface BrowserInputViewport {
  readonly bounds: DOMRect;
  readonly width: number;
  readonly height: number;
  readonly generation: number;
}
export interface BrowserEditContext {
  readonly element: HTMLDivElement;
  readonly binding: EditingBinding;
  readonly composing: boolean;
}
function constructor(): EditContextConstructor | null {
  return (globalThis as unknown as { EditContext?: EditContextConstructor }).EditContext ?? null;
}
export function hasBrowserEditContext(): boolean {
  return constructor() !== null;
}

/** Secure text/autofill use a separate OS carrier; this port admits plain EditContext input. */
export function createBrowserEditContext({
  owner,
  initial,
  options,
  viewport,
  changed,
  moving,
}: {
  readonly owner: ViewOwner;
  readonly initial: TextEditingValue;
  readonly options: EditingOptions;
  readonly viewport: () => BrowserInputViewport;
  readonly changed: (value: TextEditingValue) => void;
  readonly moving: () => boolean;
}): BrowserEditContext {
  const Constructor = constructor();
  if (!Constructor) throw new Error('Browser EditContext is unavailable');
  const initialValue = freezeEditing(initial);
  if (!sameOwner(initialValue.session, owner)) throw new Error('Mismatched EditContext owner');
  const element = document.createElement('div'),
    context = new Constructor({
      text: initialValue.text,
      selectionStart: initialValue.selection.anchor,
      selectionEnd: initialValue.selection.focus,
    });
  const target = element as HTMLDivElement & { editContext: EditContextPort | null };
  const configuration = options.configuration ?? {};
  if (configuration.obscureText || configuration.autofillHints?.length)
    throw new Error('EditContext cannot provide secure-text or autofill semantics');
  element.dataset.nelyxEditContext = 'true';
  element.tabIndex = 0;
  element.setAttribute('role', 'textbox');
  element.setAttribute('aria-multiline', String(configuration.multiline ?? false));
  element.setAttribute('aria-readonly', String(configuration.readOnly ?? false));
  element.setAttribute(
    'inputmode',
    (
      {
        text: 'text',
        number: 'numeric',
        decimal: 'decimal',
        phone: 'tel',
        email: 'email',
        url: 'url',
      } as const
    )[configuration.keyboardType ?? 'text'],
  );
  element.setAttribute('autocapitalize', configuration.capitalization ?? 'sentences');
  element.spellcheck =
    configuration.autocorrect !== false && configuration.enableSuggestions !== false;
  element.style.cssText =
    'position:absolute;display:none;pointer-events:none;outline:none;background:transparent;color:transparent;border:0;user-select:none';
  if (!configuration.readOnly) target.editContext = context;
  let alive = true,
    composing = false,
    canceling = false,
    range: { start: number; end: number } | undefined,
    value = freezeEditing(initial),
    geometry: TextInputGeometry | undefined,
    geometrySource: TextInputGeometry | undefined;
  let geometryValue: Pick<TextEditingValue, 'text' | 'selection'> | undefined,
    lastBoundsKey: string | null | undefined;
  let pendingReplacement: TextEditingValue | undefined,
    pendingBounds: { start: number; end: number } | undefined,
    restoreAfterCancellation = false;
  const current = () => {
    if (!alive) throw new Error('Browser EditContext session closed');
    return value;
  };
  const admitsInput = () => alive && options.readInputState?.().enabled !== false && alive;
  const inputRect = (rect: Rect): DOMRect => {
    const view = viewport();
    return new DOMRect(
      view.bounds.x + (rect.x * view.bounds.width) / view.width,
      view.bounds.y + (rect.y * view.bounds.height) / view.height,
      (rect.width * view.bounds.width) / view.width,
      (rect.height * view.bounds.height) / view.height,
    );
  };
  const emit = (source: 'native' | 'programmatic') => {
    if (source === 'native' && !canceling && !admitsInput()) return;
    value = freezeEditing({
      text: context.text,
      selection: { anchor: context.selectionStart, focus: context.selectionEnd },
      composing: composing
        ? range
          ? { status: 'active', ...range }
          : { status: 'unavailable' }
        : { status: 'none' },
      revision: value.revision + 1,
      session: owner,
      source,
    });
    if (!canceling) changed(value);
  };
  const resetBounds = () => {
    if (lastBoundsKey === null) return;
    lastBoundsKey = null;
    // EditContext specifies initially empty control/selection/character bounds.
    context.updateControlBounds(new DOMRect());
    context.updateSelectionBounds(new DOMRect());
    context.updateCharacterBounds(0, []);
  };
  const syncBounds = () => {
    if (!alive) return;
    if (!admitsInput()) {
      pendingBounds = undefined;
      if (alive) resetBounds();
      return;
    }
    const view = viewport(),
      core = options.readValue?.(),
      currentBounds = options.readCharacterBounds?.(0, 0);
    if (
      !admitsInput() ||
      !geometry ||
      !geometryValue ||
      !core ||
      geometryValue.text !== core.text ||
      geometryValue.selection.anchor !== core.selection.anchor ||
      geometryValue.selection.focus !== core.selection.focus ||
      context.text !== core.text ||
      context.selectionStart !== core.selection.anchor ||
      context.selectionEnd !== core.selection.focus ||
      !currentBounds ||
      !sameOwner(currentBounds.owner, owner) ||
      currentBounds.layoutEpoch !== geometry.layoutEpoch ||
      currentBounds.viewportGeneration !== geometry.viewportGeneration ||
      geometry.viewportGeneration !== view.generation ||
      view.width <= 0 ||
      view.height <= 0 ||
      view.bounds.width <= 0 ||
      view.bounds.height <= 0
    ) {
      if (alive) resetBounds();
      return;
    }
    let characters: ReturnType<NonNullable<EditingOptions['readCharacterBounds']>> | undefined;
    if (pendingBounds) {
      const request = pendingBounds;
      if (request.end > context.text.length) {
        pendingBounds = undefined;
        return;
      }
      characters = options.readCharacterBounds?.(request.start, request.end);
      if (
        !admitsInput() ||
        !characters ||
        !sameOwner(characters.owner, owner) ||
        characters.viewportGeneration !== geometry.viewportGeneration ||
        characters.layoutEpoch !== geometry.layoutEpoch
      ) {
        if (alive) resetBounds();
        return;
      }
    }
    const key = [
      geometry.layoutEpoch,
      view.generation,
      view.width,
      view.height,
      view.bounds.x,
      view.bounds.y,
      view.bounds.width,
      view.bounds.height,
    ].join(':');
    if (lastBoundsKey !== key) {
      context.updateControlBounds(inputRect(geometry.clip));
      context.updateSelectionBounds(inputRect(geometry.caret));
      lastBoundsKey = key;
    }
    if (characters) {
      context.updateCharacterBounds(characters.rangeStart, characters.rects.map(inputRect));
      pendingBounds = undefined;
    }
  };
  const replace = (next: TextEditingValue) => {
    const previous = current(),
      snapshot = freezeEditing(next);
    if (!sameOwner(snapshot.session, owner) || snapshot.revision !== previous.revision)
      throw new Error('Stale EditContext replacement');
    if (composing) {
      if (
        canceling ||
        snapshot.text !== previous.text ||
        JSON.stringify(snapshot.composing) !== JSON.stringify(previous.composing)
      )
        throw new Error('Native composition active; replacement requires cancellation');
      context.updateSelection(snapshot.selection.anchor, snapshot.selection.focus);
      emit('programmatic');
      syncBounds();
      return;
    }
    context.updateText(0, context.text.length, snapshot.text);
    context.updateSelection(snapshot.selection.anchor, snapshot.selection.focus);
    emit('programmatic');
    syncBounds();
  };
  const textUpdate = (event: Event) => {
    if (!alive) return;
    if (configuration.readOnly || (!canceling && !admitsInput())) {
      if (alive) {
        context.updateText(0, context.text.length, value.text);
        context.updateSelection(value.selection.anchor, value.selection.focus);
      }
      return;
    }
    const update = event as TextUpdate;
    // The platform's replacement text is the composing range in a textupdate.
    // No range is inferred from an unavailable composition-start event.
    if (composing)
      range = { start: update.updateRangeStart, end: update.updateRangeStart + update.text.length };
    emit('native');
  };
  const compositionStart = () => {
    if (!admitsInput()) return;
    composing = true;
    range = undefined;
    emit('native');
  };
  const compositionEnd = () => {
    if (!alive) return;
    composing = false;
    range = undefined;
    if (pendingReplacement)
      queueMicrotask(() => {
        if (!alive || !canceling || composing) return;
        const pending = pendingReplacement,
          restore = restoreAfterCancellation;
        pendingReplacement = undefined;
        restoreAfterCancellation = false;
        canceling = false;
        if (pending) replace({ ...pending, revision: value.revision });
        if (restore && !configuration.readOnly && admitsInput())
          element.focus({ preventScroll: true });
      });
    else emit('native');
  };
  const characterBounds = (event: Event) => {
    if (!alive) return;
    const request = event as CharacterBoundsUpdate;
    pendingBounds = { start: request.rangeStart, end: request.rangeEnd };
    syncBounds();
  };
  const focus = () => {
      if (!canceling && !moving() && admitsInput()) options.focusChanged?.(true);
    },
    blur = () => {
      if (alive && !canceling && !moving()) options.focusChanged?.(false);
    };
  const key = (event: KeyboardEvent) => {
    if (!admitsInput() || event.defaultPrevented || event.isComposing || composing) return;
    if (
      event.key === 'Enter' &&
      !event.repeat &&
      (!configuration.multiline ||
        (options.action ?? 'enter') !== 'enter' ||
        event.ctrlKey ||
        event.metaKey)
    ) {
      event.preventDefault();
      options.onAction?.(current());
    }
  };
  const copy = (event: ClipboardEvent) => {
    if (!admitsInput() || !event.clipboardData) return;
    const { anchor, focus } = value.selection;
    event.preventDefault();
    event.clipboardData.setData(
      'text/plain',
      value.text.slice(Math.min(anchor, focus), Math.max(anchor, focus)),
    );
  };
  const cut = (event: ClipboardEvent) => {
    if (!admitsInput() || configuration.readOnly || composing || !event.clipboardData) return;
    copy(event);
    const start = Math.min(value.selection.anchor, value.selection.focus),
      end = Math.max(value.selection.anchor, value.selection.focus);
    context.updateText(start, end, '');
    context.updateSelection(start, start);
    emit('native');
  };
  const paste = (event: ClipboardEvent) => {
    if (!admitsInput() || configuration.readOnly || composing || !event.clipboardData) return;
    event.preventDefault();
    const text = event.clipboardData.getData('text/plain'),
      start = Math.min(value.selection.anchor, value.selection.focus),
      end = Math.max(value.selection.anchor, value.selection.focus);
    context.updateText(start, end, text);
    context.updateSelection(start + text.length, start + text.length);
    emit('native');
  };
  const contextListeners: readonly [string, EventListener][] = [
    ['textupdate', textUpdate],
    ['compositionstart', compositionStart],
    ['compositionend', compositionEnd],
    ['characterboundsupdate', characterBounds],
  ];
  for (const [name, listener] of contextListeners) context.addEventListener(name, listener);
  element.addEventListener('focus', focus);
  element.addEventListener('blur', blur);
  element.addEventListener('keydown', key);
  element.addEventListener('copy', copy);
  element.addEventListener('cut', cut);
  element.addEventListener('paste', paste);
  const pageScroll = () => syncBounds();
  window.addEventListener('scroll', pageScroll, true);
  window.addEventListener('resize', pageScroll);
  window.visualViewport?.addEventListener('resize', pageScroll);
  window.visualViewport?.addEventListener('scroll', pageScroll);
  const binding: EditingBinding = {
    get isComposing() {
      return composing;
    },
    read: current,
    replace,
    replaceComposing(next) {
      const previous = current(),
        snapshot = freezeEditing(next);
      if (
        !sameOwner(snapshot.session, owner) ||
        snapshot.revision !== previous.revision ||
        snapshot.composing.status !== 'none'
      )
        throw new Error('Stale/invalid EditContext cancellation');
      if (canceling) {
        pendingReplacement = snapshot;
        return;
      }
      if (!composing) {
        replace(snapshot);
        return;
      }
      pendingReplacement = snapshot;
      canceling = true;
      // Blurring deactivates the browser's OS input context. The actual
      // compositionend is required; merely detaching EditContext does not
      // complete composition on all supported Chromium versions. Apply on a
      // microtask after the browser finishes its composition-end stack.
      restoreAfterCancellation = document.activeElement === element;
      element.blur();
    },
    updateGeometry(next) {
      current();
      if (next === null) {
        geometry = undefined;
        geometrySource = undefined;
        geometryValue = undefined;
        resetBounds();
        return;
      }
      if (next === geometrySource) {
        syncBounds();
        return;
      }
      const snapshot = freezeTextInputGeometry(next);
      if (!sameOwner(snapshot.owner, owner)) throw new Error('Foreign EditContext geometry');
      geometry = snapshot;
      geometrySource = next;
      const core = options.readValue?.();
      geometryValue = core
        ? { text: core.text, selection: Object.freeze({ ...core.selection }) }
        : undefined;
      syncBounds();
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
      composing = false;
      canceling = false;
      range = undefined;
      pendingReplacement = undefined;
      pendingBounds = undefined;
      geometry = undefined;
      geometrySource = undefined;
      geometryValue = undefined;
      for (const [name, listener] of contextListeners) context.removeEventListener(name, listener);
      element.removeEventListener('focus', focus);
      element.removeEventListener('blur', blur);
      element.removeEventListener('keydown', key);
      element.removeEventListener('copy', copy);
      element.removeEventListener('cut', cut);
      element.removeEventListener('paste', paste);
      window.removeEventListener('scroll', pageScroll, true);
      window.removeEventListener('resize', pageScroll);
      window.visualViewport?.removeEventListener('resize', pageScroll);
      window.visualViewport?.removeEventListener('scroll', pageScroll);
      target.editContext = null;
      element.style.display = 'none';
    },
  };
  return {
    element,
    binding,
    get composing() {
      return composing;
    },
  };
}
