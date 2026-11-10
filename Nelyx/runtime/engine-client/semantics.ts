// SPDX-License-Identifier: BSD-3-Clause
import { protocol as p } from './schema.ts';
import { encodeUtf8, decodeUtf8 } from './utf8.ts';

export interface SemanticCustomAction {
  readonly id: number;
  readonly label: string;
  readonly hint?: string;
  /** Source SemanticsAction bit identity; zero means an ordinary named action. */
  readonly overrideAction?: number;
  /** Hint overrides can describe a standard action without installing a callback. */
  readonly invokable?: boolean;
  readonly hintOverride?: boolean;
}
export interface SemanticProperties {
  readonly role: keyof typeof p.semanticsRoles;
  readonly label?: string;
  readonly hint?: string;
  readonly flags?: number;
  readonly actions?: number;
  readonly value?: string;
  readonly increasedValue?: string;
  readonly decreasedValue?: string;
  readonly identifier?: string;
  readonly textDirection?: 'ltr' | 'rtl' | null;
  readonly sortKey?: { readonly order: number; readonly name?: string | null } | null;
  readonly customActions?: readonly SemanticCustomAction[];
  readonly configuration?: {
    readonly flags: number;
    readonly explicitRole: boolean;
    readonly declaredRole: boolean;
  };
  readonly range?: {
    readonly minimum: number;
    readonly maximum: number;
    readonly value: number;
    readonly smallChange?: number;
    readonly largeChange?: number;
    readonly readOnly?: boolean;
  };
}
export interface SemanticSnapshot extends Omit<SemanticProperties, 'role' | 'flags' | 'actions'> {
  readonly role: number;
  readonly label: string;
  readonly hint: string;
  readonly flags: number;
  readonly actions: number;
}
const finite = (value: number) => {
  if (!Number.isFinite(value)) throw Error('Non-finite semantics value');
  return value;
};
const uint = (value: number) => {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff)
    throw Error('Invalid semantics integer');
  return value;
};
const align = (value: number) => Math.ceil(value / 8) * 8;
const customValid = (action: SemanticCustomAction) => {
  uint(action.id);
  const override = uint(action.overrideAction ?? 0);
  if (
    (override && ((override & (override - 1)) !== 0 || override > 2 ** 25)) ||
    (override ? action.label !== '' || !action.hint : !action.label || !!action.hint) ||
    (action.hintOverride && !override)
  )
    throw Error('Invalid custom semantics action');
};
export function semanticBody(value: SemanticProperties | null): Uint8Array {
  const text = [
      value?.label,
      value?.hint,
      value?.value,
      value?.increasedValue,
      value?.decreasedValue,
      value?.identifier,
      value?.sortKey?.name,
    ].map((s) => encodeUtf8(s ?? '', p.limits.semanticsTextBytes)),
    custom = value?.customActions ?? [];
  if (custom.length > p.limits.semanticsCustomActions)
    throw RangeError('Custom semantics action budget');
  const ids = new Set<number>();
  const actions = custom.map((action) => {
    customValid(action);
    if (ids.has(action.id)) throw Error('Duplicate custom semantics action');
    ids.add(action.id);
    return [
      encodeUtf8(action.label, p.limits.semanticsTextBytes),
      encodeUtf8(action.hint ?? '', p.limits.semanticsTextBytes),
    ] as const;
  });
  const strings = text.reduce((n, s) => n + s.length, 0),
    bytes = new Uint8Array(
      p.semanticsBytes +
        align(strings) +
        actions.reduce(
          (n, a) => n + p.semanticCustomActionBytes + align(a[0].length + a[1].length),
          0,
        ),
    ),
    d = new DataView(bytes.buffer),
    range = value?.range,
    configuration = value?.configuration,
    sort = value?.sortKey;
  d.setUint32(0, value ? p.semanticsRoles[value.role] : 0, true);
  d.setUint32(4, uint(value?.flags ?? 0), true);
  d.setUint32(8, uint(value?.actions ?? 0), true);
  [12, 16, 20, 72, 76, 84, 100].forEach((at, i) => d.setUint32(at, text[i]!.length, true));
  d.setUint32(24, range ? 1 | (range.readOnly ? 2 : 0) : 0, true);
  d.setUint32(28, uint(configuration?.flags ?? 0), true);
  d.setUint32(
    80,
    configuration
      ? 1 | (configuration.explicitRole ? 2 : 0) | (configuration.declaredRole ? 4 : 0)
      : 0,
    true,
  );
  [
    range?.minimum ?? 0,
    range?.maximum ?? 0,
    range?.value ?? 0,
    range?.smallChange ?? 0,
    range?.largeChange ?? 0,
  ].forEach((n, i) => d.setFloat64(32 + i * 8, finite(n), true));
  d.setFloat64(88, finite(sort?.order ?? 0), true);
  d.setUint32(96, sort ? 1 | (sort.name == null ? 0 : 2) : 0, true);
  d.setUint32(104, custom.length, true);
  d.setUint32(
    108,
    value?.textDirection === 'ltr' ? 1 : value?.textDirection === 'rtl' ? 2 : 0,
    true,
  );
  let cursor = p.semanticsBytes;
  for (const part of text) {
    bytes.set(part, cursor);
    cursor += part.length;
  }
  cursor = p.semanticsBytes + align(strings);
  custom.forEach((action, i) => {
    const parts = actions[i]!;
    d.setUint32(cursor, action.id, true);
    d.setUint32(cursor + 4, action.overrideAction ?? 0, true);
    d.setUint32(cursor + 8, parts[0].length, true);
    d.setUint32(cursor + 12, parts[1].length, true);
    d.setUint32(
      cursor + 16,
      Number(action.invokable ?? !action.overrideAction) | (action.hintOverride ? 2 : 0),
      true,
    );
    bytes.set(parts[0], cursor + p.semanticCustomActionBytes);
    bytes.set(parts[1], cursor + p.semanticCustomActionBytes + parts[0].length);
    cursor += p.semanticCustomActionBytes + align(parts[0].length + parts[1].length);
  });
  return bytes;
}
export function readSemanticBody(bytes: Uint8Array): SemanticSnapshot {
  const d = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < p.semanticsBytes) throw Error('Truncated semantics');
  const role = d.getUint32(0, true),
    flags = d.getUint32(4, true),
    actions = d.getUint32(8, true),
    configuration = d.getUint32(80, true),
    source = d.getUint32(28, true),
    rangeFlags = d.getUint32(24, true),
    sortFlags = d.getUint32(96, true),
    direction = d.getUint32(108, true),
    count = d.getUint32(104, true),
    order = finite(d.getFloat64(88, true)),
    lengths = [12, 16, 20, 72, 76, 84, 100].map((at) => d.getUint32(at, true));
  if (
    role > p.semanticsRoles.dialog ||
    flags & ~2047 ||
    actions & ~511 ||
    source > 0x7fffffff ||
    configuration > 7 ||
    (configuration & 4 && !(configuration & 2)) ||
    (!(configuration & 1) && (source || configuration)) ||
    rangeFlags > 3 ||
    rangeFlags === 2 ||
    sortFlags > 3 ||
    sortFlags === 2 ||
    (!(sortFlags & 1) && order !== 0) ||
    (!(sortFlags & 2) && lengths[6]) ||
    direction > 2 ||
    count > p.limits.semanticsCustomActions ||
    d.getBigUint64(112, true) ||
    lengths.some((n) => n > p.limits.semanticsTextBytes)
  )
    throw Error('Invalid semantics metadata');
  for (let shift = 2; shift <= 12; shift += 2)
    if (((source >>> shift) & 3) === 3) throw Error('Invalid nullable semantics state');
  if (flags & p.semanticsFlags.mergedIntoParent && !(flags & p.semanticsFlags.hidden))
    throw Error('Merged semantic annotation must be hidden');
  if (
    flags & p.semanticsFlags.mixed &&
    (role !== p.semanticsRoles.checkbox || flags & p.semanticsFlags.checked)
  )
    throw Error('Invalid mixed semantics');
  if (
    actions & p.semanticsActions.deselect &&
    (role !== p.semanticsRoles.radio ||
      !(flags & p.semanticsFlags.checked) ||
      !(actions & p.semanticsActions.activate))
  )
    throw Error('Invalid deselection semantics');
  const strings = lengths.reduce((a, b) => a + b, 0);
  let cursor = p.semanticsBytes;
  if (p.semanticsBytes + align(strings) > bytes.length) throw Error('Truncated semantics text');
  const text = lengths.map((length) => {
    const value = decodeUtf8(bytes.subarray(cursor, cursor + length));
    cursor += length;
    return value;
  });
  const padding = (end: number) => {
    if (end > bytes.length) throw Error('Truncated semantics padding');
    for (; cursor < end; cursor++) if (bytes[cursor]) throw Error('Nonzero semantics padding');
  };
  padding(p.semanticsBytes + align(strings));
  const customActions: SemanticCustomAction[] = [],
    ids = new Set<number>();
  for (let i = 0; i < count; i++) {
    if (cursor + p.semanticCustomActionBytes > bytes.length) throw Error('Truncated custom action');
    const start = cursor,
      id = d.getUint32(start, true),
      overrideAction = d.getUint32(start + 4, true),
      labelLength = d.getUint32(start + 8, true),
      hintLength = d.getUint32(start + 12, true),
      invokable = d.getUint32(start + 16, true);
    if (
      ids.has(id) ||
      invokable > 3 ||
      d.getUint32(start + 20, true) ||
      labelLength > p.limits.semanticsTextBytes ||
      hintLength > p.limits.semanticsTextBytes ||
      start + p.semanticCustomActionBytes + align(labelLength + hintLength) > bytes.length
    )
      throw Error('Invalid custom action metadata');
    ids.add(id);
    cursor += p.semanticCustomActionBytes;
    const label = decodeUtf8(bytes.subarray(cursor, cursor + labelLength));
    cursor += labelLength;
    const hint = decodeUtf8(bytes.subarray(cursor, cursor + hintLength));
    cursor += hintLength;
    const action = {
      id,
      label,
      invokable: !!(invokable & 1),
      hintOverride: !!(invokable & 2),
      ...(hint ? { hint } : {}),
      ...(overrideAction ? { overrideAction } : {}),
    };
    customValid(action);
    customActions.push(Object.freeze(action));
    padding(start + p.semanticCustomActionBytes + align(labelLength + hintLength));
  }
  if (cursor !== bytes.length) throw Error('Trailing semantics data');
  const [minimum, maximum, value, smallChange, largeChange] = [32, 40, 48, 56, 64].map((at) =>
    finite(d.getFloat64(at, true)),
  ) as [number, number, number, number, number];
  if (
    rangeFlags
      ? minimum > maximum ||
        value < minimum ||
        value > maximum ||
        smallChange < 0 ||
        largeChange < 0
      : minimum !== 0 || maximum !== 0 || value !== 0 || smallChange !== 0 || largeChange !== 0
  )
    throw Error('Invalid semantic numeric range');
  return Object.freeze({
    role,
    flags,
    actions,
    configuration: Object.freeze({
      flags: source,
      explicitRole: !!(configuration & 2),
      declaredRole: !!(configuration & 4),
    }),
    label: text[0]!,
    hint: text[1]!,
    ...(text[2] ? { value: text[2] } : {}),
    ...(text[3] ? { increasedValue: text[3] } : {}),
    ...(text[4] ? { decreasedValue: text[4] } : {}),
    ...(text[5] ? { identifier: text[5] } : {}),
    ...(sortFlags & 1
      ? { sortKey: Object.freeze({ order, name: sortFlags & 2 ? text[6]! : null }) }
      : {}),
    ...(direction ? { textDirection: direction === 1 ? ('ltr' as const) : ('rtl' as const) } : {}),
    ...(customActions.length ? { customActions: Object.freeze(customActions) } : {}),
    ...(rangeFlags
      ? {
          range: Object.freeze({
            minimum,
            maximum,
            value,
            smallChange,
            largeChange,
            readOnly: !!(rangeFlags & 2),
          }),
        }
      : {}),
  });
}
