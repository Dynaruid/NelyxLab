// SPDX-License-Identifier: BSD-3-Clause
interface LanguageAttributes {
  readonly lang: string | null;
  readonly dir: string | null;
}

interface LocaleOwner {
  readonly ownsDocument: boolean;
  language: LanguageAttributes | null;
}

const documents = new WeakMap<
  Document,
  {
    readonly owners: Set<LocaleOwner>;
    beforeOverride: LanguageAttributes | null;
  }
>();

function read(element: HTMLElement): LanguageAttributes {
  return { lang: element.getAttribute('lang'), dir: element.getAttribute('dir') };
}

function apply(element: HTMLElement, language: LanguageAttributes): void {
  for (const name of ['lang', 'dir'] as const) {
    const value = language[name];
    if (element.getAttribute(name) === value) continue;
    if (value === null) element.removeAttribute(name);
    else element.setAttribute(name, value);
  }
}

/** Document metadata belongs to an SDK-owned single view. Every view owns its boundary. */
export function bindViewLocale(
  boundary: () => HTMLElement,
  ownsDocument: boolean,
): { update(locale: string, direction: 'ltr' | 'rtl'): void; dispose(): void } {
  const initial = read(boundary());
  const document = boundary().ownerDocument;
  const root = document.documentElement;
  let state = documents.get(document);
  if (!state) {
    state = { beforeOverride: null, owners: new Set() };
    documents.set(document, state);
  }
  const { owners } = state;
  const owner: LocaleOwner = { ownsDocument, language: null };
  const updateDocument = () => {
    const only = owners.size === 1 ? owners.values().next().value : undefined;
    if (only?.ownsDocument && only.language) {
      state.beforeOverride ??= read(root);
      apply(root, only.language);
    } else if (state.beforeOverride) {
      apply(root, state.beforeOverride);
      state.beforeOverride = null;
    }
  };
  owners.add(owner);
  updateDocument();
  return {
    update(locale, direction) {
      if (!owners.has(owner)) return;
      const language = { lang: locale, dir: direction };
      apply(boundary(), language);
      owner.language = language;
      updateDocument();
    },
    dispose() {
      if (!owners.delete(owner)) return;
      apply(boundary(), initial);
      updateDocument();
      if (owners.size === 0) documents.delete(document);
    },
  };
}
