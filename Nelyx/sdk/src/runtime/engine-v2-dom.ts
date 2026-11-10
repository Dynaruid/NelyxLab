// SPDX-License-Identifier: BSD-3-Clause
// These carriers belong exclusively to the browser interaction/ARIA owner.
// Remember requested CSS strings because CSSOM normalizes values (0 -> 0px,
// matrix spacing, etc.). Comparing its normalized strings would still rewrite
// unchanged geometry on every compositor publication.
const styles = new WeakMap<HTMLElement, Record<string, string>>();
export function setManagedStyles(
  element: HTMLElement,
  values: Readonly<Record<string, string>>,
): number {
  let previous = styles.get(element);
  if (!previous) styles.set(element, (previous = Object.create(null) as Record<string, string>));
  let writes = 0;
  for (const name in values) {
    const value = values[name]!;
    if (previous[name] === value) continue;
    (element.style as unknown as Record<string, string>)[name] = value;
    previous[name] = value;
    ++writes;
  }
  return writes;
}
export function setManagedAttribute(
  element: HTMLElement,
  name: string,
  value: string | null,
): void {
  if (element.getAttribute(name) === value) return;
  if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}
export function setManagedText(element: HTMLElement, value: string): void {
  if (element.textContent !== value) element.textContent = value;
}
