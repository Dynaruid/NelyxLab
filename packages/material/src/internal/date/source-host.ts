// SPDX-License-Identifier: BSD-3-Clause
// Constructor/collection ABI between generated Flutter bodies and Nelyx owners.
import { InheritedWidget, Widget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import {
  Align,
  Center,
  Column,
  Row,
  Stack,
  SizedBox,
  Expanded,
  Flexible,
  Padding,
  ConstrainedBox,
  Builder,
} from '@nelyx/core/framework/widgets/basic';
import type { AlignOptions, FlexOptions, StackOptions } from '@nelyx/core/framework/widgets/basic';
import { EdgeInsets, EdgeInsetsDirectional } from '@nelyx/core/framework/painting/edge-insets';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { MediaQuery, Directionality, Localizations } from '@nelyx/core/framework/widgets/app-data';
import type {
  MediaQueryClampedTextScalingOptions,
  MediaQueryRemovePaddingOptions,
} from '@nelyx/core/framework/widgets/app-data';
import { LayoutBuilder } from '@nelyx/core/framework/widgets/layout-builder';
import { PageView } from '@nelyx/core/framework/widgets/page-view';
import { ColorShapeDecoration } from '@nelyx/core/framework/painting/color-shape-decoration';
import type { ShapeBorder } from '@nelyx/core/framework/painting/borders';
import { Color } from '@nelyx/core/ui/color';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { FormState } from '@nelyx/core/framework/widgets/form';
import { RestorableProperty } from '@nelyx/core/framework/widgets/restoration';
import { RestorationMixin as CoreRestorationMixin } from '@nelyx/core/framework/widgets/restoration';
import type { StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import { ValueKey } from '@nelyx/core/foundation/key';
import { DartInt, boxSourceDartInt } from '@nelyx/core/internal/foundation/dart-numeric';
import { dartIntType } from '@nelyx/core/internal/foundation/dart-type-witness';
import { dartValueEquals, dartValueHash } from '@nelyx/core/internal/foundation/dart-value';
import { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { Intent, Action, CallbackAction } from '@nelyx/core/framework/widgets/actions';
import type { IntentType, ActionHandle } from '@nelyx/core/framework/widgets/actions';
import {
  NextFocusIntent,
  PreviousFocusIntent,
  DirectionalFocusIntent,
} from '@nelyx/core/framework/widgets/focus-traversal';
import { TraversalDirection } from '@nelyx/core/framework/widgets/focus-traversal-policy';
import { SingleActivator } from '@nelyx/core/framework/widgets/shortcuts';
import type { ShortcutActivator } from '@nelyx/core/framework/widgets/shortcuts';
import { FocusableActionDetector } from '@nelyx/core/framework/widgets/focusable-action-detector';
import type { FocusableActionDetectorOptions } from '@nelyx/core/framework/widgets/focusable-action-detector';
import { DartMap } from '@nelyx/core/internal/foundation/dart-collections';
import type { DartKeyPolicy } from '@nelyx/core/internal/foundation/dart-collections';
import type { Locale } from '@nelyx/core/ui/locale';
import { MaterialLocalizations } from '../../material-localizations.ts';
import { Material } from '../../material.ts';
import { DateTime, dateTimeType } from './date-time.ts';
import { GregorianCalendarDelegate } from '../../generated/date/date.generated.ts';
import { AutovalidateMode } from '../../generated/date/form.generated.ts';
import { Form } from '@nelyx/core/framework/widgets/form';
import { Shortcuts } from '@nelyx/core/framework/widgets/shortcuts';
import { ClampingScrollPhysics } from '@nelyx/core/framework/widgets/scroll-physics';
import { Radius } from '@nelyx/core/ui/radius';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { RoundedRectangleBorder } from '@nelyx/core/framework/painting/rounded-rectangle-border';
import { OutlineInputBorder, UnderlineInputBorder } from '../../input-border.ts';
import { Divider } from '../../divider.ts';
import { Icon } from '@nelyx/core/framework/widgets/icon';
import { constSourceSize } from '@nelyx/core/ui/size-source';
import type { ColorSwatch } from '@nelyx/core/framework/painting/color-swatch';
import { showDialog } from '@nelyx/core/framework/widgets/dialog';
import type { RouteSettings } from '@nelyx/core/framework/widgets/pages';
import type { Offset } from '@nelyx/core/ui/offset';
import { castSourceDartInt } from '@nelyx/core/internal/foundation/dart-numeric';
import type { _FocusedDate } from '../../generated/date/calendar_date_picker.generated.ts';
import { Navigator } from '@nelyx/core/framework/widgets/navigation';
import type { PageController } from '@nelyx/core/framework/widgets/page-view';
export { dateListAt, dateListAdd } from './source-values.ts';

type ChildOptions = WidgetOptions & { child?: Widget | null };
export const datePadding = ({
  padding,
  child,
  key = null,
}: ChildOptions & { padding: EdgeInsetsGeometry }) => new Padding(padding, child ?? undefined, key);
export const dateAlign = ({ child, ...options }: ChildOptions & AlignOptions) =>
  new Align(child ?? undefined, options);
export const dateCenter = ({ child, ...options }: ChildOptions & Omit<AlignOptions, 'alignment'>) =>
  new Center(child ?? undefined, options);
export const dateConstrainedBox = ({
  child,
  constraints,
  ...options
}: ChildOptions & { constraints: BoxConstraints }) =>
  new ConstrainedBox(child ?? undefined, constraints, options);
export const dateSizedBox = ({
  width,
  height,
  child,
  key = null,
}: ChildOptions & { width?: number | null; height?: number | null } = {}) =>
  new SizedBox(width ?? undefined, height ?? undefined, child ?? undefined, key);
export const dateColumn = ({
  children = [],
  ...options
}: FlexOptions & { children?: readonly Widget[] } = {}) => new Column(children, options);
export const dateRow = ({
  children = [],
  ...options
}: FlexOptions & { children?: readonly Widget[] } = {}) => new Row(children, options);
export const dateExpanded = ({
  child,
  flex = 1,
  key = null,
}: WidgetOptions & { child: Widget; flex?: number }) => new Expanded(child, flex, key);
export const dateFlexible = ({
  child,
  flex = 1,
  fit = 'loose',
  key = null,
}: WidgetOptions & { child: Widget; flex?: number; fit?: 'tight' | 'loose' }) =>
  new Flexible(child, flex, fit, key);
export const dateStack = ({
  children = [],
  ...options
}: StackOptions & { children?: readonly Widget[] } = {}) => new Stack(children, options);
export const dateBuilder = ({
  builder,
  ...options
}: WidgetOptions & { builder: (context: BuildContext) => Widget }) => new Builder(builder, options);
export const dateLayoutBuilder = ({
  builder,
  ...options
}: WidgetOptions & { builder: ConstructorParameters<typeof LayoutBuilder>[0] }) =>
  new LayoutBuilder(builder, options);
export const datePageViewBuilder = (options: Parameters<typeof PageView.builder>[0]) =>
  PageView.builder(options);
export const dateShapeDecoration = ({
  shape,
  color = null,
}: {
  shape: ShapeBorder;
  color?: Color | null;
}) => new ColorShapeDecoration(shape, color);
export const dateClampedTextScaling = (options: MediaQueryClampedTextScalingOptions) =>
  MediaQuery.withClampedTextScaling(options);
export const dateDirectionality = ({
  textDirection,
  child,
}: WidgetOptions & { textDirection: 'ltr' | 'rtl'; child: Widget }) =>
  new Directionality(textDirection, child);
export function dateLocalizationsOverride({
  context,
  locale,
  child,
}: {
  context: BuildContext;
  locale: Locale | null;
  child: Widget;
}): Widget {
  const old = Localizations.of(context);
  return new Localizations(
    locale?.toLanguageTag() ?? old.locale,
    old.messages,
    old.fallback,
    child,
  );
}
export function dateRemoveViewInsets({
  context,
  child,
  key = null,
  ...sides
}: MediaQueryRemovePaddingOptions): MediaQuery {
  const data = MediaQuery.of(context),
    insets = MediaQuery.viewInsetsOf(context),
    padding = MediaQuery.viewPaddingOf(context);
  const removed = EdgeInsets.only({
    left: sides.removeLeft ? 0 : insets.left,
    top: sides.removeTop ? 0 : insets.top,
    right: sides.removeRight ? 0 : insets.right,
    bottom: sides.removeBottom ? 0 : insets.bottom,
  });
  const viewPadding = EdgeInsets.only({
    left: Math.max(0, padding.left - (sides.removeLeft ? insets.left : 0)),
    top: Math.max(0, padding.top - (sides.removeTop ? insets.top : 0)),
    right: Math.max(0, padding.right - (sides.removeRight ? insets.right : 0)),
    bottom: Math.max(0, padding.bottom - (sides.removeBottom ? insets.bottom : 0)),
  });
  return new MediaQuery(
    { ...data, viewInsets: removed, viewPadding, keyboardInset: removed.bottom },
    child,
    { key },
  );
}
export class SourceInheritedHost extends InheritedWidget {
  constructor({ child, key = null }: WidgetOptions & { child: Widget }) {
    super(child, key);
  }
  updateShouldNotify(_old: this): boolean {
    return false;
  }
}
type FocusedDateScope = _FocusedDate;
let focusedDateType: (abstract new (...args: never[]) => FocusedDateScope) | undefined;
export function registerDateFocusedType(
  type: abstract new (...args: never[]) => FocusedDateScope,
): void {
  focusedDateType = type;
}
export function dateDependOnFocusedDate(context: BuildContext): FocusedDateScope | null {
  if (!focusedDateType) throw Error('Original focused-date scope was not registered');
  return context.maybeDependOn(focusedDateType) ?? null;
}
export abstract class SourceRestorableValue<T> extends RestorableProperty<T> {
  private initialized = false;
  private stored!: T;
  abstract createDefaultValue(): T;
  abstract didUpdateValue(oldValue: T): void;
  abstract fromPrimitives(value: unknown): T;
  get value(): T {
    if (!this.initialized) {
      this.stored = this.createDefaultValue();
      this.initialized = true;
    }
    return this.stored;
  }
  set value(value: T) {
    const old = this.value;
    if (dartValueEquals(old, value)) return;
    this.stored = value;
    this.didUpdateValue(old);
  }
  restore(value: unknown): void {
    this.value = this.fromPrimitives(value);
  }
  reset(): void {
    this.value = this.createDefaultValue();
  }
}
/** The three original date restoration properties serialize Dart int? values.
 * Their bodies retain boxed Dart numbers; only the storage wire uses JSON ints. */
export function dateRestorationWireProperty<T>(
  source: SourceRestorableValue<T>,
): RestorableProperty<T> {
  return new (class extends RestorableProperty<T> {
    get value(): T {
      return source.value;
    }
    set value(value: T) {
      source.value = value;
    }
    toPrimitives(): unknown {
      const value = source.toPrimitives();
      if (value === null) return null;
      if (!DartInt.is(value)) throw new TypeError('Date restoration requires Dart int?');
      return castSourceDartInt(value);
    }
    restore(value: unknown): void {
      if (value !== null && (typeof value !== 'number' || !Number.isSafeInteger(value)))
        throw new TypeError('Invalid date restoration wire value');
      source.restore(value === null ? null : boxSourceDartInt(value as number));
    }
    reset(): void {
      source.reset();
    }
    override addListener(listener: () => void): void {
      source.addListener(listener);
    }
    override removeListener(listener: () => void): void {
      source.removeListener(listener);
    }
  })();
}
export abstract class RestorationMixin<
  W extends StatefulWidget = StatefulWidget,
> extends CoreRestorationMixin<W> {
  private readonly sourceProperties = new WeakMap<
    RestorableProperty<unknown>,
    RestorableProperty<unknown>
  >();
  override registerForRestoration<T>(property: RestorableProperty<T>, id: string): void {
    if (!(property instanceof SourceRestorableValue)) {
      super.registerForRestoration(property, id);
      return;
    }
    let wire = this.sourceProperties.get(property);
    if (!wire) {
      wire = dateRestorationWireProperty(property);
      this.sourceProperties.set(property, wire);
    }
    super.registerForRestoration(wire, id);
  }
  override unregisterFromRestoration(property: RestorableProperty<unknown>): void {
    const wire = this.sourceProperties.get(property);
    super.unregisterFromRestoration(wire ?? property);
    this.sourceProperties.delete(property);
  }
}
export function dateFormKey({ debugLabel }: { debugLabel?: string } = {}): GlobalKey<FormState> {
  return new GlobalKey(debugLabel, FormState);
}
export const dateValueKey = (value: DateTime) =>
  new ValueKey(
    value,
    dateTimeType,
    (a, b) => a.equals(b),
    (date) => date.hashCode,
  );
export const dateYearKey = (value: DartInt) =>
  new ValueKey(value, dartIntType, dartValueEquals, dartValueHash);
export function dateGenerateFocusNodes(
  length: number,
  generate: (index: number) => FocusNode,
): readonly FocusNode[] {
  if (!Number.isSafeInteger(length) || length < 0)
    throw new RangeError('Invalid List.generate length');
  return Array.from({ length }, (_, index) => generate(index));
}
export const dateNextFocusIntentAction = ({
  onInvoke,
}: {
  onInvoke: (intent: NextFocusIntent) => unknown;
}) => new CallbackAction(NextFocusIntent, onInvoke);
export const datePreviousFocusIntentAction = ({
  onInvoke,
}: {
  onInvoke: (intent: PreviousFocusIntent) => unknown;
}) => new CallbackAction(PreviousFocusIntent, onInvoke);
export const dateDirectionalFocusIntentAction = ({
  onInvoke,
}: {
  onInvoke: (intent: DirectionalFocusIntent) => unknown;
}) => new CallbackAction(DirectionalFocusIntent, onInvoke);
function identityPolicy<T>(accepts: (value: unknown) => value is T): DartKeyPolicy<T> {
  return { accepts, hash: (value) => value, equals: (a, b) => a === b };
}
const traversalPolicy = identityPolicy((value: unknown): value is TraversalDirection =>
  Object.values(TraversalDirection).includes(value as TraversalDirection),
);
const shortcutPolicy = identityPolicy(
  (value: unknown): value is ShortcutActivator => value instanceof SingleActivator,
);
export function dateTypeActionMap(): DartMap<IntentType, Action<Intent>> {
  return new DartMap(
    identityPolicy((v: unknown): v is IntentType => typeof v === 'function'),
    (v): v is Action<Intent> => v instanceof Action,
  );
}
export const dateMapGet = <K, V>(map: DartMap<K, V>, key: unknown): V | null => map.get(key);
function nativeMap<K, V>(map: DartMap<K, V>): Map<K, V> {
  return new Map(Array.from(map.entries, ({ key, value }) => [key, value]));
}
export function dateFocusableActionDetector({
  child,
  shortcuts,
  actions,
  ...options
}: Omit<FocusableActionDetectorOptions, 'shortcuts' | 'actions'> & {
  child: Widget;
  shortcuts?: DartMap<ShortcutActivator, Intent> | null;
  actions?: DartMap<IntentType, Action<Intent>> | null;
}): Widget {
  return new FocusableActionDetector(child, {
    ...options,
    ...(shortcuts ? { shortcuts: nativeMap(shortcuts) } : {}),
    ...(actions ? { actions: nativeMap(actions) as ReadonlyMap<IntentType, ActionHandle> } : {}),
  });
}
export function debugCheckHasDirectionality(context: BuildContext): boolean {
  Directionality.of(context);
  return true;
}
export function debugCheckHasMaterialLocalizations(context: BuildContext): boolean {
  MaterialLocalizations.of(context);
  return true;
}
export function debugCheckHasMaterial(context: BuildContext): boolean {
  if (!context.findAncestorWidgetOfExactType(Material))
    throw Error('Date picker requires Material');
  return true;
}
export function debugIsSerializableForRestoration(value: unknown): boolean {
  return (
    value === null ||
    DartInt.is(value) ||
    typeof value === 'number' ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  );
}
export class View {
  static of(context: BuildContext) {
    const view = context.services.platformView;
    if (!view) throw Error('Date announcement requires an owning platform view');
    return view;
  }
}

// Source const call sites are finite. Canonical keys include constructor identity,
// normalized scalar fields and identities of already canonical child constants.
const constants = new Map<unknown, unknown>();
const negativeZero = Symbol('-0');
function canonical<T>(owner: object, fields: readonly unknown[], create: () => T): T {
  let map = constants;
  for (const field of [owner, ...fields]) {
    const key = Object.is(field, -0) ? negativeZero : field;
    let next = map.get(key) as Map<unknown, unknown> | undefined;
    if (!next) {
      next = new Map();
      map.set(key, next);
    }
    map = next;
  }
  if (!map.has(canonical)) map.set(canonical, create());
  return map.get(canonical) as T;
}
export function constdateTraversalDirectionintMap(
  entries: readonly (readonly [TraversalDirection, DartInt])[],
): DartMap<TraversalDirection, DartInt> {
  return canonical(traversalPolicy, entries.flat(), () => {
    const map = new DartMap(traversalPolicy, DartInt.is);
    for (const [k, v] of entries) map.set(k, v);
    return map.freeze();
  });
}
export function constdateShortcutActivatorIntentMap(
  entries: readonly (readonly [ShortcutActivator, Intent])[],
): DartMap<ShortcutActivator, Intent> {
  return canonical(shortcutPolicy, entries.flat(), () => {
    const map = new DartMap(shortcutPolicy, (v): v is Intent => v instanceof Intent);
    for (const [k, v] of entries) map.set(k, v);
    return map.freeze();
  });
}
export function constDateEdgeInsetsOnly(
  owner: typeof EdgeInsets,
  options: Parameters<typeof EdgeInsets.only>[0] = {},
): EdgeInsets {
  const { left = 0, top = 0, right = 0, bottom = 0 } = options;
  return canonical(owner, [left, top, right, bottom], () =>
    owner.only({ left, top, right, bottom }),
  );
}
export const constDateEdgeInsetsAll = (owner: typeof EdgeInsets, value: number) =>
  constDateEdgeInsetsOnly(owner, { left: value, top: value, right: value, bottom: value });
export const constDateEdgeInsetsSymmetric = (
  owner: typeof EdgeInsets,
  { horizontal = 0, vertical = 0 }: Parameters<typeof EdgeInsets.symmetric>[0] = {},
) =>
  constDateEdgeInsetsOnly(owner, {
    left: horizontal,
    right: horizontal,
    top: vertical,
    bottom: vertical,
  });
export const constDateEdgeInsetsDirectionalOnly = (
  owner: typeof EdgeInsetsDirectional,
  options: Parameters<typeof EdgeInsetsDirectional.only>[0] = {},
) => {
  const { start = 0, top = 0, end = 0, bottom = 0 } = options;
  return canonical(owner, [start, top, end, bottom], () => owner.only({ start, top, end, bottom }));
};
export const constDateSizedBox = (
  owner: typeof SizedBox,
  options: Parameters<typeof dateSizedBox>[0] = {},
) =>
  canonical(
    owner,
    [options.width ?? null, options.height ?? null, options.child ?? null, options.key ?? null],
    () => dateSizedBox(options),
  );
export const constDateSizedBoxShrink = (owner: typeof SizedBox) =>
  constDateSizedBox(owner, { width: 0, height: 0 });
export const constDateFlexible = (
  owner: typeof Flexible,
  options: Parameters<typeof dateFlexible>[0],
) =>
  canonical(
    owner,
    [options.child, options.flex ?? 1, options.fit ?? 'loose', options.key ?? null],
    () => dateFlexible(options),
  );
export const constDateSingleActivator = (
  owner: typeof SingleActivator,
  ...args: ConstructorParameters<typeof SingleActivator>
) =>
  canonical(
    owner,
    [
      args[0],
      args[1]?.control ?? false,
      args[1]?.shift ?? false,
      args[1]?.alt ?? false,
      args[1]?.meta ?? false,
      args[1]?.includeRepeats ?? true,
    ],
    () => new owner(...args),
  );
export const constDateDirectionalFocusIntent = (
  owner: typeof DirectionalFocusIntent,
  ...args: ConstructorParameters<typeof DirectionalFocusIntent>
) => canonical(owner, [args[0], args[1]?.ignoreTextFields ?? true], () => new owner(...args));
export const constDateNextFocusIntent = (owner: typeof NextFocusIntent) =>
  canonical(owner, [], () => new owner());
export function constGregorianCalendarDelegate(): GregorianCalendarDelegate {
  return canonical(GregorianCalendarDelegate, [], () => new GregorianCalendarDelegate());
}
export function constDateSpacer<T>(
  owner: new (options?: { flex?: number }) => T,
  options: { flex?: number } = {},
): T {
  return canonical(owner, [options.flex ?? 1], () => new owner(options));
}
export const constDateSize = constSourceSize;
export const constDateRadiusCircular = (owner: typeof Radius, value: number) =>
  canonical(owner, [value, value], () => owner.circular(value));
export const constDateBorderRadiusAll = (owner: typeof BorderRadius, value: Radius) =>
  canonical(owner, [value.x, value.y], () => owner.all(value));
export const constDateRoundedRectangleBorder = (
  owner: typeof RoundedRectangleBorder,
  options: ConstructorParameters<typeof RoundedRectangleBorder>[0] = {},
) =>
  canonical(
    owner,
    [options.borderRadius ?? BorderRadius.zero, options.side ?? null],
    () => new owner(options),
  );
export const constDateBoxConstraints = (
  owner: typeof BoxConstraints,
  options: { minWidth?: number; maxWidth?: number; minHeight?: number; maxHeight?: number } = {},
) => {
  const { minWidth = 0, maxWidth = Infinity, minHeight = 0, maxHeight = Infinity } = options;
  return canonical(
    owner,
    [minWidth, maxWidth, minHeight, maxHeight],
    () => new owner(minWidth, maxWidth, minHeight, maxHeight),
  );
};
export const constDateOutlineInputBorder = (owner: typeof OutlineInputBorder) =>
  canonical(owner, [], () => new owner());
export const constDateUnderlineInputBorder = (owner: typeof UnderlineInputBorder) =>
  canonical(owner, [], () => new owner());
export const constDateDivider = (owner: typeof Divider) => canonical(owner, [], () => new owner());
export const constDateClampingScrollPhysics = (owner: typeof ClampingScrollPhysics) =>
  canonical(owner, [], () => new owner());
export const constDateIcon = (owner: typeof Icon, icon: ConstructorParameters<typeof Icon>[0]) =>
  canonical(owner, [icon], () => new owner(icon));
export const dateColorSwatch = (swatch: ColorSwatch<number>, key: DartInt): Color | null =>
  swatch.get(castSourceDartInt(key));
export const dateNavigatorPop = (context: BuildContext, value?: DateTime | null): void => {
  Navigator.of(context).pop(value ?? undefined);
};
export const dateNextPage = (
  controller: PageController,
  options: Parameters<PageController['animateToPage']>[1],
) => controller.animateToPage(Math.round(controller.page ?? controller.initialPage) + 1, options);
export const datePreviousPage = (
  controller: PageController,
  options: Parameters<PageController['animateToPage']>[1],
) => controller.animateToPage(Math.round(controller.page ?? controller.initialPage) - 1, options);
export const dateOrientationOf = (context: BuildContext): 'portrait' | 'landscape' => {
  const data = MediaQuery.of(context);
  return data.width > data.height ? 'landscape' : 'portrait';
};
export const dateMaybeSupportsAnnounceOf = (context: BuildContext): boolean | null =>
  context.maybeDependOn(MediaQuery)?.data.supportsAnnounce ?? null;
export function dateForm({
  autovalidateMode,
  child,
  key = null,
}: { autovalidateMode: AutovalidateMode; child: Widget } & WidgetOptions): Form {
  if (autovalidateMode === AutovalidateMode.onUnfocus)
    throw Error('The current Core Form does not implement onUnfocus');
  const mode =
    autovalidateMode === AutovalidateMode.always
      ? 'always'
      : autovalidateMode === AutovalidateMode.onUserInteraction
        ? 'onUserInteraction'
        : 'disabled';
  return new Form({ autovalidateMode: mode, child, key });
}
export const dateShortcuts = ({
  shortcuts,
  ...options
}: Omit<ConstructorParameters<typeof Shortcuts>[0], 'shortcuts'> & {
  shortcuts: DartMap<ShortcutActivator, Intent>;
}) => new Shortcuts({ ...options, shortcuts: nativeMap(shortcuts) });
export async function dateShowDialog({
  context,
  builder,
  barrierDismissible,
  barrierColor,
  barrierLabel,
  useRootNavigator,
  routeSettings,
  anchorPoint,
}: {
  context: BuildContext;
  builder: (context: BuildContext) => Widget;
  barrierDismissible: boolean;
  barrierColor: Color | null;
  barrierLabel: string | null;
  useRootNavigator: boolean;
  routeSettings: RouteSettings | null;
  anchorPoint: Offset | null;
}): Promise<DateTime | null> {
  if (anchorPoint !== null)
    throw Error('The current Core dialog does not support display-feature anchorPoint');
  if (routeSettings?.arguments != null)
    throw Error('The current Core dialog does not forward route arguments');
  return (
    (await showDialog<DateTime>(context, {
      builder,
      barrierDismissible,
      barrierLabel,
      useRootNavigator,
      ...(barrierColor ? { barrierColor: barrierColor.toARGB32() } : {}),
      ...(routeSettings?.name ? { name: routeSettings.name } : {}),
    })) ?? null
  );
}
