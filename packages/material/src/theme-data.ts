import { materialFactoryDefaults } from './internal/theme/factory-defaults.ts';
import {
  defaultMaterialColorScheme,
  materialSchemeColor,
} from './internal/theme/default-color-schemes.ts';
import { kDefaultIconLightColor, kDefaultIconDarkColor } from './constants.ts';
import {
  appBarThemeData,
  inputDecorationThemeData,
} from './internal/theme/theme-value-wrappers.ts';
import type { AppBarTheme } from './app-bar-theme.ts';
import type { InputDecorationTheme } from './input-decoration-theme.ts';
import { PageTransitionsTheme } from './page-transitions-theme.ts';
import { cupertinoMaterialColorScheme } from './internal/theme/transition-theme-context.ts';
import { SystemColor } from '@nelyx/core/ui/system-color';
import { concreteStyleFrom } from './internal/button/concrete-style-from.ts';
import { BorderSide } from '@nelyx/core/framework/painting/borders';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { ColorProperty } from '@nelyx/core/framework/painting/color-property';
import { DiagnosticsProperty } from '@nelyx/core/foundation/diagnostics';
import { IterableProperty, EnumProperty } from '@nelyx/core/foundation/diagnostic-properties';
import { AppBarThemeData } from './app-bar-theme-data.ts';
import { MaterialBannerThemeData } from './material-banner-theme-data.ts';
import { BottomAppBarThemeData } from './bottom-app-bar-theme-data.ts';
import { BottomNavigationBarThemeData } from './bottom-navigation-bar-theme-data.ts';
import { BottomSheetThemeData } from './bottom-sheet-theme-data.ts';
import { DataTableThemeData } from './data-table-theme-data.ts';
import { DatePickerThemeData } from './date-picker-theme-data.ts';
import { DropdownMenuThemeData } from './dropdown-menu-theme-data.ts';
import { NavigationRailThemeData } from './navigation-rail-theme-data.ts';
import { PopupMenuThemeData } from './popup-menu-theme-data.ts';
import { SnackBarThemeData } from './snack-bar-theme-data.ts';
import { TabBarThemeData } from './tab-bar-theme-data.ts';
import { TimePickerThemeData } from './time-picker-theme-data.ts';
import { ToggleButtonsThemeData } from './toggle-buttons-theme-data.ts';
import { InputDecorationThemeData } from './input-decoration-theme-data.ts';
import { ActionIconThemeData } from './action-icon-theme-data.ts';
import { BadgeThemeData } from './badge-theme-data.ts';
import { CardThemeData } from './card-theme-data.ts';
import { CarouselViewThemeData } from './carousel-view-theme-data.ts';
import { DrawerThemeData } from './drawer-theme-data.ts';
import { ExpansionTileThemeData } from './expansion-tile-theme-data.ts';
import { NavigationBarThemeData } from './navigation-bar-theme-data.ts';
import { NavigationDrawerThemeData } from './navigation-drawer-theme-data.ts';
import { SearchBarThemeData } from './search-bar-theme-data.ts';
import { SearchViewThemeData } from './search-view-theme-data.ts';
import { SegmentedButtonThemeData } from './segmented-button-theme-data.ts';
import { MenuBarThemeData } from './menu-bar-theme-data.ts';
import { MenuButtonThemeData } from './menu-button-theme-data.ts';
import { MenuThemeData } from './menu-theme-data.ts';
import { FloatingActionButtonThemeData } from './floating-action-button-theme-data.ts';
import { DialogThemeData } from './dialog-theme-data.ts';
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InkSparkle } from './ink-sparkle.ts';
import { SourceScrollbarThemeData } from './generated/scrollbar/scrollbar-theme-data.generated.ts';
import { Color } from '@nelyx/core/ui/color';
import { constSourceColor } from '@nelyx/core/internal/ui/color-source-adapter';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import type { TargetPlatform } from '@nelyx/core/foundation/platform';
import { CupertinoThemeData, NoDefaultCupertinoThemeData } from '@nelyx/cupertino/theme';
import type { CupertinoThemeDataOptions } from '@nelyx/cupertino/theme';
import type { BuildContext } from '@nelyx/core/framework/widgets/framework';
import { Colors, MaterialColor } from './colors.ts';
import { TextSelectionThemeData } from './text-selection-theme-data.ts';
import { ColorScheme } from './color-scheme.ts';
import { TextTheme } from './text-theme.ts';
import { DividerThemeData } from './divider-theme-data.ts';
import { ListTileThemeData } from './list-tile-theme-data.ts';
import { IconButtonThemeData } from './icon-button-theme-data.ts';
import { Typography } from './typography.ts';
import { IconThemeData } from '@nelyx/core/framework/widgets/icon-theme-data';
import { ChipThemeData } from './chip-theme-data.ts';
import { TooltipThemeData } from './tooltip-theme-data.ts';
import type { InteractiveInkFeatureFactory } from './ink-feature.ts';
import { InkRipple } from './ink-effects.ts';
import { SliderThemeData } from './slider-theme-data.ts';
import { ProgressIndicatorThemeData } from './progress-indicator-theme-data.ts';
import { FilledButtonThemeData } from './filled-button-theme-data.ts';
import { TextButtonThemeData } from './text-button-theme-data.ts';
import { OutlinedButtonThemeData } from './outlined-button-theme-data.ts';
import { ElevatedButtonThemeData } from './elevated-button-theme-data.ts';
import {
  CheckboxThemeData,
  RadioThemeData,
  SwitchThemeData,
} from './generated/theme/toggle-theme-data.generated.ts';
import { Adaptation } from './adaptation.ts';
import type { ThemeAdaptation, ThemeType } from './adaptation.ts';
import { ThemeExtension } from './theme-extension.ts';
import type { ThemeExtensionEntry } from './theme-extension.ts';
import {
  ReadonlyThemeMap,
  requireThemeValue,
  validateThemeType,
  themeValueHasType,
  themeTypeKey,
} from './internal/theme/theme-types.ts';
import { dartObjectType } from '@nelyx/core/foundation/dart-type-witness';
export { Adaptation } from './adaptation.ts';
export type { ThemeAdaptation, ThemeType } from './adaptation.ts';
export { ThemeExtension } from './theme-extension.ts';
export type { ThemeExtensionEntry } from './theme-extension.ts';
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Complete VisualDensity and MaterialTapTargetSize contracts from pinned theme_data.dart.
import { Diagnosticable } from '@nelyx/core/foundation/diagnosticable';
import { DoubleProperty } from '@nelyx/core/foundation/diagnostic-properties';
import type { DiagnosticPropertiesBuilder } from '@nelyx/core/foundation/diagnostics';
import { debugFormatDouble } from '@nelyx/core/foundation/debug';
import { invariant } from '@nelyx/core/foundation/errors';
import { Offset } from '@nelyx/core/ui/offset';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { valueEquals, hashValues } from '@nelyx/core/framework/painting/value-equality';
import { lerpDouble } from '@nelyx/core/internal/ui/lerp-double.generated';
const primaryIconWhite = new IconThemeData({ color: Colors.white }),
  primaryIconBlack = new IconThemeData({ color: Colors.black });
class AdaptationMap extends Map<object, ThemeAdaptation> {
  override set(key: object, value: ThemeAdaptation): this {
    if (!(value instanceof Adaptation))
      throw new TypeError('ThemeData adaptations require canonical Adaptation values');
    if (!themeValueHasType(value, dartObjectType))
      throw new TypeError('ThemeData adaptations require non-nullable T');
    return super.set(themeTypeKey(key), value);
  }
  private lookupKey(key: object): object | null {
    try {
      return themeTypeKey(key);
    } catch (error) {
      if (error instanceof TypeError) return null;
      throw error;
    }
  }
  override get(key: object): ThemeAdaptation | undefined {
    const type = this.lookupKey(key);
    return type === null ? undefined : super.get(type);
  }
  override has(key: object): boolean {
    const type = this.lookupKey(key);
    return type !== null && super.has(type);
  }
  override delete(key: object): boolean {
    const type = this.lookupKey(key);
    return type !== null && super.delete(type);
  }
}
export interface ThemeDataOptions {
  readonly pageTransitionsTheme?: PageTransitionsTheme | null;
  readonly useSystemColors?: boolean | null;
  readonly appBarTheme?: AppBarThemeData | AppBarTheme | null;
  readonly bannerTheme?: MaterialBannerThemeData | null;
  readonly bottomAppBarTheme?: BottomAppBarThemeData | null;
  readonly bottomNavigationBarTheme?: BottomNavigationBarThemeData | null;
  readonly bottomSheetTheme?: BottomSheetThemeData | null;
  readonly dataTableTheme?: DataTableThemeData | null;
  readonly datePickerTheme?: DatePickerThemeData | null;
  readonly dropdownMenuTheme?: DropdownMenuThemeData | null;
  readonly navigationRailTheme?: NavigationRailThemeData | null;
  readonly popupMenuTheme?: PopupMenuThemeData | null;
  readonly snackBarTheme?: SnackBarThemeData | null;
  readonly tabBarTheme?: TabBarThemeData | null;
  readonly timePickerTheme?: TimePickerThemeData | null;
  readonly toggleButtonsTheme?: ToggleButtonsThemeData | null;
  readonly inputDecorationTheme?: InputDecorationThemeData | InputDecorationTheme | null;
  readonly actionIconTheme?: ActionIconThemeData | null;
  readonly badgeTheme?: BadgeThemeData | null;
  readonly cardTheme?: CardThemeData | null;
  readonly carouselViewTheme?: CarouselViewThemeData | null;
  readonly drawerTheme?: DrawerThemeData | null;
  readonly expansionTileTheme?: ExpansionTileThemeData | null;
  readonly navigationBarTheme?: NavigationBarThemeData | null;
  readonly navigationDrawerTheme?: NavigationDrawerThemeData | null;
  readonly searchBarTheme?: SearchBarThemeData | null;
  readonly searchViewTheme?: SearchViewThemeData | null;
  readonly segmentedButtonTheme?: SegmentedButtonThemeData | null;
  readonly menuBarTheme?: MenuBarThemeData | null;
  readonly menuButtonTheme?: MenuButtonThemeData | null;
  readonly menuTheme?: MenuThemeData | null;
  readonly floatingActionButtonTheme?: FloatingActionButtonThemeData | null;
  readonly dialogTheme?: DialogThemeData | null;
  readonly adaptations?: Iterable<ThemeAdaptation> | null;
  readonly extensions?: Iterable<ThemeExtensionEntry> | null;
  readonly listTileTheme?: ListTileThemeData | null;
  readonly iconButtonTheme?: IconButtonThemeData | null;
  readonly dividerTheme?: DividerThemeData | null;
  readonly dividerColor?: Color | null;
  readonly visualDensity?: VisualDensity | null;
  readonly materialTapTargetSize?: MaterialTapTargetSize | null;
  readonly disabledColor?: Color | null;
  readonly primaryColor?: Color | null;
  readonly primarySwatch?: MaterialColor | null;
  readonly primaryColorLight?: Color | null;
  readonly primaryColorDark?: Color | null;
  readonly scaffoldBackgroundColor?: Color | null;
  readonly secondaryHeaderColor?: Color | null;
  readonly hintColor?: Color | null;
  readonly unselectedWidgetColor?: Color | null;
  readonly tooltipTheme?: TooltipThemeData | null;
  readonly chipTheme?: ChipThemeData | null;
  readonly iconTheme?: IconThemeData | null;
  readonly primaryIconTheme?: IconThemeData | null;
  readonly typography?: Typography | null;
  readonly fontFamily?: string | null;
  readonly fontFamilyFallback?: readonly string[] | null;
  readonly package?: string | null;
  readonly focusColor?: Color | null;
  readonly hoverColor?: Color | null;
  readonly splashColor?: Color | null;
  readonly splashFactory?: InteractiveInkFeatureFactory | null;
  readonly canvasColor?: Color | null;
  readonly cardColor?: Color | null;
  readonly shadowColor?: Color | null;
  readonly scrollbarTheme?: SourceScrollbarThemeData | null;
  readonly highlightColor?: Color | null;
  readonly brightness?: 'light' | 'dark' | null;
  readonly platform?: TargetPlatform | null;
  readonly colorScheme?: ColorScheme | null;
  readonly colorSchemeSeed?: Color | number | null;
  readonly textSelectionTheme?: TextSelectionThemeData | null;
  readonly cupertinoOverrideTheme?: NoDefaultCupertinoThemeData | null;
  readonly textTheme?: TextTheme | null;
  readonly primaryTextTheme?: TextTheme | null;
  readonly sliderTheme?: SliderThemeData | null;
  readonly progressIndicatorTheme?: ProgressIndicatorThemeData | null;
  readonly filledButtonTheme?: FilledButtonThemeData | null;
  readonly textButtonTheme?: TextButtonThemeData | null;
  readonly outlinedButtonTheme?: OutlinedButtonThemeData | null;
  readonly elevatedButtonTheme?: ElevatedButtonThemeData | null;
  readonly checkboxTheme?: CheckboxThemeData | null;
  readonly radioTheme?: RadioThemeData | null;
  readonly switchTheme?: SwitchThemeData | null;
}
/** Complete M3 raw snapshot; every source field is required and factory defaults are bypassed. */
export type ThemeDataRawOptions = Pick<
  ThemeData,
  | 'cupertinoOverrideTheme'
  | 'extensions'
  | 'adaptationMap'
  | 'inputDecorationTheme'
  | 'materialTapTargetSize'
  | 'pageTransitionsTheme'
  | 'platform'
  | 'scrollbarTheme'
  | 'splashFactory'
  | 'visualDensity'
  | 'canvasColor'
  | 'cardColor'
  | 'colorScheme'
  | 'disabledColor'
  | 'dividerColor'
  | 'focusColor'
  | 'highlightColor'
  | 'hintColor'
  | 'hoverColor'
  | 'primaryColor'
  | 'primaryColorDark'
  | 'primaryColorLight'
  | 'scaffoldBackgroundColor'
  | 'secondaryHeaderColor'
  | 'shadowColor'
  | 'splashColor'
  | 'unselectedWidgetColor'
  | 'iconTheme'
  | 'primaryIconTheme'
  | 'primaryTextTheme'
  | 'textTheme'
  | 'typography'
  | 'actionIconTheme'
  | 'appBarTheme'
  | 'badgeTheme'
  | 'bannerTheme'
  | 'bottomAppBarTheme'
  | 'bottomNavigationBarTheme'
  | 'bottomSheetTheme'
  | 'cardTheme'
  | 'carouselViewTheme'
  | 'checkboxTheme'
  | 'chipTheme'
  | 'dataTableTheme'
  | 'datePickerTheme'
  | 'dialogTheme'
  | 'dividerTheme'
  | 'drawerTheme'
  | 'dropdownMenuTheme'
  | 'elevatedButtonTheme'
  | 'expansionTileTheme'
  | 'filledButtonTheme'
  | 'floatingActionButtonTheme'
  | 'iconButtonTheme'
  | 'listTileTheme'
  | 'menuBarTheme'
  | 'menuButtonTheme'
  | 'menuTheme'
  | 'navigationBarTheme'
  | 'navigationDrawerTheme'
  | 'navigationRailTheme'
  | 'outlinedButtonTheme'
  | 'popupMenuTheme'
  | 'progressIndicatorTheme'
  | 'radioTheme'
  | 'searchBarTheme'
  | 'searchViewTheme'
  | 'segmentedButtonTheme'
  | 'sliderTheme'
  | 'snackBarTheme'
  | 'switchTheme'
  | 'tabBarTheme'
  | 'textButtonTheme'
  | 'textSelectionTheme'
  | 'timePickerTheme'
  | 'toggleButtonsTheme'
  | 'tooltipTheme'
>;
const themeDataFields = [
  'cupertinoOverrideTheme',
  'extensions',
  'adaptationMap',
  'inputDecorationTheme',
  'materialTapTargetSize',
  'pageTransitionsTheme',
  'platform',
  'scrollbarTheme',
  'splashFactory',
  'visualDensity',
  'canvasColor',
  'cardColor',
  'colorScheme',
  'disabledColor',
  'dividerColor',
  'focusColor',
  'highlightColor',
  'hintColor',
  'hoverColor',
  'primaryColor',
  'primaryColorDark',
  'primaryColorLight',
  'scaffoldBackgroundColor',
  'secondaryHeaderColor',
  'shadowColor',
  'splashColor',
  'unselectedWidgetColor',
  'iconTheme',
  'primaryIconTheme',
  'primaryTextTheme',
  'textTheme',
  'typography',
  'actionIconTheme',
  'appBarTheme',
  'badgeTheme',
  'bannerTheme',
  'bottomAppBarTheme',
  'bottomNavigationBarTheme',
  'bottomSheetTheme',
  'cardTheme',
  'carouselViewTheme',
  'checkboxTheme',
  'chipTheme',
  'dataTableTheme',
  'datePickerTheme',
  'dialogTheme',
  'dividerTheme',
  'drawerTheme',
  'dropdownMenuTheme',
  'elevatedButtonTheme',
  'expansionTileTheme',
  'filledButtonTheme',
  'floatingActionButtonTheme',
  'iconButtonTheme',
  'listTileTheme',
  'menuBarTheme',
  'menuButtonTheme',
  'menuTheme',
  'navigationBarTheme',
  'navigationDrawerTheme',
  'navigationRailTheme',
  'outlinedButtonTheme',
  'popupMenuTheme',
  'progressIndicatorTheme',
  'radioTheme',
  'searchBarTheme',
  'searchViewTheme',
  'segmentedButtonTheme',
  'sliderTheme',
  'snackBarTheme',
  'switchTheme',
  'tabBarTheme',
  'textButtonTheme',
  'textSelectionTheme',
  'timePickerTheme',
  'toggleButtonsTheme',
  'tooltipTheme',
] as const;
function themeMapEquals(a: ReadonlyMap<object, unknown>, b: ReadonlyMap<object, unknown>): boolean {
  return (
    a === b ||
    (a.size === b.size &&
      Array.from(a, ([key, value]) => b.has(key) && valueEquals(value, b.get(key))).every(Boolean))
  );
}
function rejectRemovedThemeOptions(options: object): void {
  for (const name of [
    'useMaterial3',
    'applyElevationOverlayColor',
    'buttonTheme',
    'buttonBarTheme',
    'dialogBackgroundColor',
    'indicatorColor',
  ])
    if (Object.hasOwn(options, name))
      throw new TypeError('Removed Material 2 or deprecated theme option: ' + name);
}
export class ThemeData extends Diagnosticable(class {}) {
  readonly pageTransitionsTheme: PageTransitionsTheme;
  readonly appBarTheme: AppBarThemeData;
  readonly bannerTheme: MaterialBannerThemeData;
  readonly bottomAppBarTheme: BottomAppBarThemeData;
  readonly bottomNavigationBarTheme: BottomNavigationBarThemeData;
  readonly bottomSheetTheme: BottomSheetThemeData;
  readonly dataTableTheme: DataTableThemeData;
  readonly datePickerTheme: DatePickerThemeData;
  readonly dropdownMenuTheme: DropdownMenuThemeData;
  readonly navigationRailTheme: NavigationRailThemeData;
  readonly popupMenuTheme: PopupMenuThemeData;
  readonly snackBarTheme: SnackBarThemeData;
  readonly tabBarTheme: TabBarThemeData;
  readonly timePickerTheme: TimePickerThemeData;
  readonly toggleButtonsTheme: ToggleButtonsThemeData;
  readonly inputDecorationTheme: InputDecorationThemeData;
  readonly actionIconTheme: ActionIconThemeData | null;
  readonly badgeTheme: BadgeThemeData;
  readonly cardTheme: CardThemeData;
  readonly carouselViewTheme: CarouselViewThemeData;
  readonly drawerTheme: DrawerThemeData;
  readonly expansionTileTheme: ExpansionTileThemeData;
  readonly navigationBarTheme: NavigationBarThemeData;
  readonly navigationDrawerTheme: NavigationDrawerThemeData;
  readonly searchBarTheme: SearchBarThemeData;
  readonly searchViewTheme: SearchViewThemeData;
  readonly segmentedButtonTheme: SegmentedButtonThemeData;
  readonly menuBarTheme: MenuBarThemeData;
  readonly menuButtonTheme: MenuButtonThemeData;
  readonly menuTheme: MenuThemeData;
  readonly floatingActionButtonTheme: FloatingActionButtonThemeData;
  readonly dialogTheme: DialogThemeData;
  /** @dartType int */ private static readonly localizedThemeDataCacheSize = 5;
  private static readonly localizedThemes: {
    base: ThemeData;
    geometry: TextTheme;
    result: ThemeData;
  }[] = [];
  private readonly textValues: { textTheme: TextTheme; primaryTextTheme: TextTheme };
  private readonly themeMaps: {
    adaptations: Map<object, ThemeAdaptation>;
    extensions: ReadonlyMap<object, ThemeExtensionEntry>;
  };
  get adaptationMap(): Map<object, ThemeAdaptation> {
    return this.themeMaps.adaptations;
  }
  get extensions(): ReadonlyMap<object, ThemeExtensionEntry> {
    return this.themeMaps.extensions;
  }
  readonly listTileTheme: ListTileThemeData;
  readonly iconButtonTheme: IconButtonThemeData;
  readonly dividerTheme: DividerThemeData;
  readonly dividerColor: Color;
  readonly visualDensity: VisualDensity;
  readonly materialTapTargetSize: MaterialTapTargetSize;
  readonly disabledColor: Color;
  readonly primaryColor: Color;
  readonly primaryColorLight: Color;
  readonly primaryColorDark: Color;
  readonly scaffoldBackgroundColor: Color;
  readonly secondaryHeaderColor: Color;
  readonly hintColor: Color;
  readonly unselectedWidgetColor: Color;
  readonly tooltipTheme: TooltipThemeData;
  readonly chipTheme: ChipThemeData;
  readonly iconTheme: IconThemeData;
  readonly primaryIconTheme: IconThemeData;
  readonly typography: Typography;
  readonly focusColor: Color;
  readonly hoverColor: Color;
  readonly splashColor: Color;
  readonly splashFactory: InteractiveInkFeatureFactory;
  readonly canvasColor: Color;
  readonly cardColor: Color;
  readonly shadowColor: Color;
  readonly scrollbarTheme: SourceScrollbarThemeData;
  readonly highlightColor: Color;
  readonly platform: TargetPlatform;
  readonly colorScheme: ColorScheme;
  readonly textSelectionTheme: TextSelectionThemeData;
  readonly cupertinoOverrideTheme: NoDefaultCupertinoThemeData | null;
  get textTheme(): TextTheme {
    return this.textValues.textTheme;
  }
  get primaryTextTheme(): TextTheme {
    return this.textValues.primaryTextTheme;
  }
  readonly sliderTheme: SliderThemeData;
  readonly progressIndicatorTheme: ProgressIndicatorThemeData;
  readonly filledButtonTheme: FilledButtonThemeData;
  readonly textButtonTheme: TextButtonThemeData;
  readonly outlinedButtonTheme: OutlinedButtonThemeData;
  readonly elevatedButtonTheme: ElevatedButtonThemeData;
  readonly checkboxTheme: CheckboxThemeData;
  readonly radioTheme: RadioThemeData;
  readonly switchTheme: SwitchThemeData;
  constructor(options: ThemeDataOptions = {}) {
    super();
    this.pageTransitionsTheme =
      options.pageTransitionsTheme ?? materialFactoryDefaults.pageTransitionsTheme;
    rejectRemovedThemeOptions(options);
    const cupertinoOverride = options.cupertinoOverrideTheme?.noDefault() ?? null,
      inputDecoration = inputDecorationThemeData(options.inputDecorationTheme);
    invariant(
      options.colorSchemeSeed == null ||
        (options.colorScheme == null &&
          options.primaryColor == null &&
          options.primarySwatch == null),
      'invalid-color-scheme-seed',
      'colorSchemeSeed cannot be combined with colorScheme, primaryColor or primarySwatch',
    );
    invariant(
      options.brightness == null ||
        options.colorScheme == null ||
        options.brightness === options.colorScheme.brightness,
      'color-scheme-brightness-mismatch',
      'ThemeData.brightness must match ColorScheme.brightness',
    );
    const brightness = options.brightness ?? options.colorScheme?.brightness ?? 'light';
    const colorScheme =
      options.colorSchemeSeed == null
        ? (options.colorScheme ?? defaultMaterialColorScheme(brightness))
        : ColorScheme.fromSeed({ seedColor: options.colorSchemeSeed, brightness });
    const platform = options.platform ?? FoundationPlatform.defaultTargetPlatform;
    const {
      listTileTheme = null,
      iconButtonTheme = null,
      dividerTheme = null,
      dividerColor = null,
      visualDensity = null,
      materialTapTargetSize = null,
      disabledColor = null,
      primaryColor = null,
      tooltipTheme = null,
      chipTheme = null,
      iconTheme = null,
      focusColor = null,
      hoverColor = null,
      splashColor = null,
      splashFactory = null,
      canvasColor = null,
      cardColor = null,
      shadowColor = null,
      textSelectionTheme = null,
      scrollbarTheme = null,
      highlightColor = null,
      textTheme,
      primaryTextTheme,
      sliderTheme = null,
      progressIndicatorTheme = null,
      filledButtonTheme = null,
      textButtonTheme = null,
      outlinedButtonTheme = null,
      elevatedButtonTheme = null,
      checkboxTheme = null,
      radioTheme = null,
      switchTheme = null,
    } = options;
    this.listTileTheme = listTileTheme ?? materialFactoryDefaults.listTileTheme;
    this.iconButtonTheme = iconButtonTheme ?? materialFactoryDefaults.iconButtonTheme;
    this.dividerTheme = dividerTheme ?? materialFactoryDefaults.dividerTheme;
    this.dividerColor = dividerColor ?? materialSchemeColor(colorScheme, 'outline');
    this.tooltipTheme = tooltipTheme ?? materialFactoryDefaults.tooltipTheme;
    this.chipTheme = chipTheme ?? materialFactoryDefaults.chipTheme;
    this.iconTheme =
      iconTheme ??
      new IconThemeData({
        color: colorScheme.brightness === 'dark' ? kDefaultIconLightColor : kDefaultIconDarkColor,
      });
    this.sliderTheme = sliderTheme ?? materialFactoryDefaults.sliderTheme;
    this.progressIndicatorTheme =
      progressIndicatorTheme ?? materialFactoryDefaults.progressIndicatorTheme;
    this.actionIconTheme = options.actionIconTheme ?? null;
    this.badgeTheme = options.badgeTheme ?? materialFactoryDefaults.badgeTheme;
    this.cardTheme = options.cardTheme ?? materialFactoryDefaults.cardTheme;
    this.carouselViewTheme = options.carouselViewTheme ?? materialFactoryDefaults.carouselViewTheme;
    this.drawerTheme = options.drawerTheme ?? materialFactoryDefaults.drawerTheme;
    this.expansionTileTheme =
      options.expansionTileTheme ?? materialFactoryDefaults.expansionTileTheme;
    this.navigationBarTheme =
      options.navigationBarTheme ?? materialFactoryDefaults.navigationBarTheme;
    this.navigationDrawerTheme =
      options.navigationDrawerTheme ?? materialFactoryDefaults.navigationDrawerTheme;
    this.searchBarTheme = options.searchBarTheme ?? materialFactoryDefaults.searchBarTheme;
    this.searchViewTheme = options.searchViewTheme ?? materialFactoryDefaults.searchViewTheme;
    this.segmentedButtonTheme =
      options.segmentedButtonTheme ?? materialFactoryDefaults.segmentedButtonTheme;
    this.menuBarTheme = options.menuBarTheme ?? materialFactoryDefaults.menuBarTheme;
    this.menuButtonTheme = options.menuButtonTheme ?? materialFactoryDefaults.menuButtonTheme;
    this.menuTheme = options.menuTheme ?? materialFactoryDefaults.menuTheme;
    this.floatingActionButtonTheme =
      options.floatingActionButtonTheme ?? materialFactoryDefaults.floatingActionButtonTheme;
    this.dialogTheme = options.dialogTheme ?? materialFactoryDefaults.dialogTheme;
    this.inputDecorationTheme = inputDecoration ?? materialFactoryDefaults.inputDecorationTheme;
    this.bannerTheme = options.bannerTheme ?? materialFactoryDefaults.bannerTheme;
    this.bottomAppBarTheme = options.bottomAppBarTheme ?? materialFactoryDefaults.bottomAppBarTheme;
    this.bottomNavigationBarTheme =
      options.bottomNavigationBarTheme ?? materialFactoryDefaults.bottomNavigationBarTheme;
    this.bottomSheetTheme = options.bottomSheetTheme ?? materialFactoryDefaults.bottomSheetTheme;
    this.dataTableTheme = options.dataTableTheme ?? materialFactoryDefaults.dataTableTheme;
    this.datePickerTheme = options.datePickerTheme ?? materialFactoryDefaults.datePickerTheme;
    this.dropdownMenuTheme = options.dropdownMenuTheme ?? materialFactoryDefaults.dropdownMenuTheme;
    this.navigationRailTheme =
      options.navigationRailTheme ?? materialFactoryDefaults.navigationRailTheme;
    this.popupMenuTheme = options.popupMenuTheme ?? materialFactoryDefaults.popupMenuTheme;
    this.snackBarTheme = options.snackBarTheme ?? materialFactoryDefaults.snackBarTheme;
    this.tabBarTheme = options.tabBarTheme ?? materialFactoryDefaults.tabBarTheme;
    this.timePickerTheme = options.timePickerTheme ?? materialFactoryDefaults.timePickerTheme;
    this.toggleButtonsTheme =
      options.toggleButtonsTheme ?? materialFactoryDefaults.toggleButtonsTheme;
    this.filledButtonTheme = filledButtonTheme ?? materialFactoryDefaults.filledButtonTheme;
    this.textButtonTheme = textButtonTheme ?? materialFactoryDefaults.textButtonTheme;
    this.outlinedButtonTheme = outlinedButtonTheme ?? materialFactoryDefaults.outlinedButtonTheme;
    this.elevatedButtonTheme = elevatedButtonTheme ?? materialFactoryDefaults.elevatedButtonTheme;
    this.checkboxTheme = checkboxTheme ?? materialFactoryDefaults.checkboxTheme;
    this.radioTheme = radioTheme ?? materialFactoryDefaults.radioTheme;
    this.switchTheme = switchTheme ?? materialFactoryDefaults.switchTheme;
    this.focusColor =
      focusColor ?? new Color(colorScheme.brightness === 'dark' ? 0x1fffffff : 0x1f000000);
    this.hoverColor =
      hoverColor ?? new Color(colorScheme.brightness === 'dark' ? 0x0affffff : 0x0a000000);
    this.splashColor =
      splashColor ??
      constSourceColor(Color, colorScheme.brightness === 'dark' ? 0x40cccccc : 0x66c8c8c8);
    this.splashFactory =
      splashFactory ??
      (platform === 'android' && FoundationPlatform.hostEnvironment.kind !== 'web'
        ? InkSparkle.splashFactory
        : InkRipple.splashFactory);
    this.canvasColor = canvasColor ?? materialSchemeColor(colorScheme, 'surface');
    this.cardColor = cardColor ?? materialSchemeColor(colorScheme, 'surface');
    this.shadowColor = shadowColor ?? Colors.black;
    this.platform = platform;
    this.visualDensity = visualDensity ?? VisualDensity.defaultDensityForPlatform(platform);
    this.materialTapTargetSize =
      materialTapTargetSize ??
      (['android', 'iOS', 'fuchsia'].includes(platform)
        ? MaterialTapTargetSize.padded
        : MaterialTapTargetSize.shrinkWrap);
    this.disabledColor =
      disabledColor ?? (colorScheme.brightness === 'dark' ? Colors.white38 : Colors.black38);
    this.primaryColor =
      primaryColor ??
      materialSchemeColor(colorScheme, colorScheme.brightness === 'dark' ? 'surface' : 'primary');
    const swatch = options.primarySwatch ?? Colors.blue,
      isDark = brightness === 'dark';
    this.primaryColorLight =
      options.primaryColorLight ?? (isDark ? Colors.grey.shade500 : swatch.shade100);
    this.primaryColorDark = options.primaryColorDark ?? (isDark ? Colors.black : swatch.shade700);
    this.scaffoldBackgroundColor =
      options.scaffoldBackgroundColor ?? materialSchemeColor(colorScheme, 'surface');
    this.secondaryHeaderColor =
      options.secondaryHeaderColor ?? (isDark ? Colors.grey.shade700 : swatch.shade50);
    this.hintColor = options.hintColor ?? (isDark ? Colors.white60 : Colors.black.withOpacity(0.6));
    this.unselectedWidgetColor =
      options.unselectedWidgetColor ?? (isDark ? Colors.white70 : Colors.black54);
    this.colorScheme = colorScheme;
    this.textSelectionTheme = textSelectionTheme ?? materialFactoryDefaults.textSelectionTheme;
    this.cupertinoOverrideTheme = cupertinoOverride;
    this.scrollbarTheme = scrollbarTheme ?? materialFactoryDefaults.scrollbarTheme;
    this.highlightColor =
      highlightColor ??
      constSourceColor(Color, colorScheme.brightness === 'dark' ? 0x40cccccc : 0x66bcbcbc);
    const primaryIsDark = ThemeData.estimateBrightnessForColor(this.primaryColor) === 'dark';
    this.typography = options.typography ?? Typography.material2021({ platform, colorScheme });
    this.primaryIconTheme =
      options.primaryIconTheme ?? (primaryIsDark ? primaryIconWhite : primaryIconBlack);
    let defaultTextTheme =
      colorScheme.brightness === 'dark' ? this.typography.white : this.typography.black;
    let defaultPrimaryTextTheme = primaryIsDark ? this.typography.white : this.typography.black;
    if (options.fontFamily != null) {
      defaultTextTheme = defaultTextTheme.apply({ fontFamily: options.fontFamily });
      defaultPrimaryTextTheme = defaultPrimaryTextTheme.apply({ fontFamily: options.fontFamily });
    }
    if (options.fontFamilyFallback != null) {
      defaultTextTheme = defaultTextTheme.apply({ fontFamilyFallback: options.fontFamilyFallback });
      defaultPrimaryTextTheme = defaultPrimaryTextTheme.apply({
        fontFamilyFallback: options.fontFamilyFallback,
      });
    }
    if (options.package != null) {
      defaultTextTheme = defaultTextTheme.apply({ package: options.package });
      defaultPrimaryTextTheme = defaultPrimaryTextTheme.apply({ package: options.package });
    }
    this.textValues = {
      textTheme: defaultTextTheme.merge(textTheme),
      primaryTextTheme: defaultPrimaryTextTheme.merge(primaryTextTheme),
    };
    this.appBarTheme = appBarThemeData(options.appBarTheme) ?? materialFactoryDefaults.appBarTheme;
    this.themeMaps = {
      adaptations: ThemeData.createAdaptationMap(options.adaptations ?? []),
      extensions: ThemeData.createExtensionMap(options.extensions ?? []),
    };
    Object.freeze(this);
    if (options.useSystemColors === true) return this.overrideWithSystemColors();
  }
  get brightness(): 'light' | 'dark' {
    return this.colorScheme.brightness;
  }
  getAdaptation<T>(type: ThemeType<T>): Adaptation<T> | null {
    validateThemeType(type);
    const value = this.adaptationMap.get(themeTypeKey(type));
    if (value === undefined) return null;
    if (!(value instanceof Adaptation) || !themeValueHasType(value, type))
      throw new TypeError('Adaptation map key does not match its value type');
    // Collection ingress and exact key identity establish this generic association.
    return value as Adaptation<T>;
  }
  extension<T>(type: ThemeType<T>): T | null {
    validateThemeType(type);
    const value = this.extensions.get(themeTypeKey(type));
    return value === undefined ? null : requireThemeValue(value, type);
  }
  static from({
    colorScheme,
    textTheme = null,
  }: {
    readonly colorScheme: ColorScheme;
    readonly textTheme?: TextTheme | null;
  }): ThemeData {
    return new ThemeData({
      colorScheme,
      textTheme,
      dividerColor: new Color(colorScheme.onSurface).withOpacity(0.12),
    });
  }
  static light(): ThemeData {
    return new ThemeData();
  }
  static dark(): ThemeData {
    return new ThemeData({ brightness: 'dark' });
  }
  static fallback(): ThemeData {
    return ThemeData.light();
  }
  static localize(baseTheme: ThemeData, localTextGeometry: TextTheme): ThemeData {
    const cached = ThemeData.localizedThemes.find(
      (entry) => entry.base === baseTheme && entry.geometry === localTextGeometry,
    );
    if (cached) return cached.result;
    const result = baseTheme.copyWith({
      textTheme: localTextGeometry.merge(baseTheme.textTheme),
      primaryTextTheme: localTextGeometry.merge(baseTheme.primaryTextTheme),
    });
    if (ThemeData.localizedThemes.length === ThemeData.localizedThemeDataCacheSize)
      ThemeData.localizedThemes.shift();
    ThemeData.localizedThemes.push({ base: baseTheme, geometry: localTextGeometry, result });
    return result;
  }
  static estimateBrightnessForColor(color: Color | number): 'light' | 'dark' {
    /** @dartType double */ const relativeLuminance = (
      typeof color === 'number' ? new Color(color) : color
    ).computeLuminance();
    /** @dartType double */ const kThreshold = 0.15;
    return (relativeLuminance + 0.05) * (relativeLuminance + 0.05) > kThreshold ? 'light' : 'dark';
  }
  static raw(options: ThemeDataRawOptions): ThemeData {
    rejectRemovedThemeOptions(options);
    const result = Object.create(ThemeData.prototype) as ThemeData;
    for (const field of themeDataFields) {
      if (!(field in options)) throw new TypeError('ThemeData.raw requires ' + field);
      const value = options[field];
      if (
        value === undefined ||
        (value === null && field !== 'cupertinoOverrideTheme' && field !== 'actionIconTheme')
      )
        throw new TypeError('ThemeData.raw requires ' + field);
      Object.defineProperty(result, field, { value, enumerable: true });
    }
    Object.freeze(result);
    return result;
  }
  private static createAdaptationMap(
    values: Iterable<ThemeAdaptation>,
  ): Map<object, ThemeAdaptation> {
    const map = new AdaptationMap();
    for (const value of values) {
      if (!(value instanceof Adaptation))
        throw new TypeError('ThemeData adaptations require canonical Adaptation values');
      const type = value.type;
      validateThemeType(type);
      map.set(themeTypeKey(type), value);
    }
    return map;
  }
  private static createExtensionMap(
    values: Iterable<ThemeExtensionEntry>,
  ): ReadonlyMap<object, ThemeExtensionEntry> {
    const map = new Map<object, ThemeExtensionEntry>();
    for (const value of values) {
      if (!(value instanceof ThemeExtension))
        throw new TypeError('ThemeData extensions require canonical ThemeExtension values');
      const type = value.type;
      validateThemeType(type);
      map.set(themeTypeKey(type), value);
    }
    return new ReadonlyThemeMap(map);
  }
  copyWith(
    options: Omit<
      ThemeDataOptions,
      | 'fontFamily'
      | 'fontFamilyFallback'
      | 'package'
      | 'colorSchemeSeed'
      | 'primarySwatch'
      | 'useSystemColors'
    > = {},
  ): ThemeData {
    rejectRemovedThemeOptions(options);
    const cupertinoOverride =
        options.cupertinoOverrideTheme?.noDefault() ?? this.cupertinoOverrideTheme,
      inputDecoration =
        inputDecorationThemeData(options.inputDecorationTheme) ?? this.inputDecorationTheme;
    const adaptations =
        options.adaptations == null
          ? this.adaptationMap
          : ThemeData.createAdaptationMap(options.adaptations),
      extensions =
        options.extensions == null
          ? this.extensions
          : ThemeData.createExtensionMap(options.extensions);
    return ThemeData.raw({
      cupertinoOverrideTheme: cupertinoOverride,
      extensions,
      adaptationMap: adaptations,
      inputDecorationTheme: inputDecoration,
      materialTapTargetSize: options.materialTapTargetSize ?? this.materialTapTargetSize,
      pageTransitionsTheme: options.pageTransitionsTheme ?? this.pageTransitionsTheme,
      platform: options.platform ?? this.platform,
      scrollbarTheme: options.scrollbarTheme ?? this.scrollbarTheme,
      splashFactory: options.splashFactory ?? this.splashFactory,
      visualDensity: options.visualDensity ?? this.visualDensity,
      canvasColor: options.canvasColor ?? this.canvasColor,
      cardColor: options.cardColor ?? this.cardColor,
      colorScheme: (options.colorScheme ?? this.colorScheme).copyWith({
        brightness: options.brightness ?? null,
      }),
      disabledColor: options.disabledColor ?? this.disabledColor,
      dividerColor: options.dividerColor ?? this.dividerColor,
      focusColor: options.focusColor ?? this.focusColor,
      highlightColor: options.highlightColor ?? this.highlightColor,
      hintColor: options.hintColor ?? this.hintColor,
      hoverColor: options.hoverColor ?? this.hoverColor,
      primaryColor: options.primaryColor ?? this.primaryColor,
      primaryColorDark: options.primaryColorDark ?? this.primaryColorDark,
      primaryColorLight: options.primaryColorLight ?? this.primaryColorLight,
      scaffoldBackgroundColor: options.scaffoldBackgroundColor ?? this.scaffoldBackgroundColor,
      secondaryHeaderColor: options.secondaryHeaderColor ?? this.secondaryHeaderColor,
      shadowColor: options.shadowColor ?? this.shadowColor,
      splashColor: options.splashColor ?? this.splashColor,
      unselectedWidgetColor: options.unselectedWidgetColor ?? this.unselectedWidgetColor,
      iconTheme: options.iconTheme ?? this.iconTheme,
      primaryIconTheme: options.primaryIconTheme ?? this.primaryIconTheme,
      primaryTextTheme: options.primaryTextTheme ?? this.primaryTextTheme,
      textTheme: options.textTheme ?? this.textTheme,
      typography: options.typography ?? this.typography,
      actionIconTheme: options.actionIconTheme ?? this.actionIconTheme,
      appBarTheme: appBarThemeData(options.appBarTheme) ?? this.appBarTheme,
      badgeTheme: options.badgeTheme ?? this.badgeTheme,
      bannerTheme: options.bannerTheme ?? this.bannerTheme,
      bottomAppBarTheme: options.bottomAppBarTheme ?? this.bottomAppBarTheme,
      bottomNavigationBarTheme: options.bottomNavigationBarTheme ?? this.bottomNavigationBarTheme,
      bottomSheetTheme: options.bottomSheetTheme ?? this.bottomSheetTheme,
      cardTheme: options.cardTheme ?? this.cardTheme,
      carouselViewTheme: options.carouselViewTheme ?? this.carouselViewTheme,
      checkboxTheme: options.checkboxTheme ?? this.checkboxTheme,
      chipTheme: options.chipTheme ?? this.chipTheme,
      dataTableTheme: options.dataTableTheme ?? this.dataTableTheme,
      datePickerTheme: options.datePickerTheme ?? this.datePickerTheme,
      dialogTheme: options.dialogTheme ?? this.dialogTheme,
      dividerTheme: options.dividerTheme ?? this.dividerTheme,
      drawerTheme: options.drawerTheme ?? this.drawerTheme,
      dropdownMenuTheme: options.dropdownMenuTheme ?? this.dropdownMenuTheme,
      elevatedButtonTheme: options.elevatedButtonTheme ?? this.elevatedButtonTheme,
      expansionTileTheme: options.expansionTileTheme ?? this.expansionTileTheme,
      filledButtonTheme: options.filledButtonTheme ?? this.filledButtonTheme,
      floatingActionButtonTheme:
        options.floatingActionButtonTheme ?? this.floatingActionButtonTheme,
      iconButtonTheme: options.iconButtonTheme ?? this.iconButtonTheme,
      listTileTheme: options.listTileTheme ?? this.listTileTheme,
      menuBarTheme: options.menuBarTheme ?? this.menuBarTheme,
      menuButtonTheme: options.menuButtonTheme ?? this.menuButtonTheme,
      menuTheme: options.menuTheme ?? this.menuTheme,
      navigationBarTheme: options.navigationBarTheme ?? this.navigationBarTheme,
      navigationDrawerTheme: options.navigationDrawerTheme ?? this.navigationDrawerTheme,
      navigationRailTheme: options.navigationRailTheme ?? this.navigationRailTheme,
      outlinedButtonTheme: options.outlinedButtonTheme ?? this.outlinedButtonTheme,
      popupMenuTheme: options.popupMenuTheme ?? this.popupMenuTheme,
      progressIndicatorTheme: options.progressIndicatorTheme ?? this.progressIndicatorTheme,
      radioTheme: options.radioTheme ?? this.radioTheme,
      searchBarTheme: options.searchBarTheme ?? this.searchBarTheme,
      searchViewTheme: options.searchViewTheme ?? this.searchViewTheme,
      segmentedButtonTheme: options.segmentedButtonTheme ?? this.segmentedButtonTheme,
      sliderTheme: options.sliderTheme ?? this.sliderTheme,
      snackBarTheme: options.snackBarTheme ?? this.snackBarTheme,
      switchTheme: options.switchTheme ?? this.switchTheme,
      tabBarTheme: options.tabBarTheme ?? this.tabBarTheme,
      textButtonTheme: options.textButtonTheme ?? this.textButtonTheme,
      textSelectionTheme: options.textSelectionTheme ?? this.textSelectionTheme,
      timePickerTheme: options.timePickerTheme ?? this.timePickerTheme,
      toggleButtonsTheme: options.toggleButtonsTheme ?? this.toggleButtonsTheme,
      tooltipTheme: options.tooltipTheme ?? this.tooltipTheme,
    });
  }
  /** @dartParam t double */
  private static lerpExtensions(
    a: ThemeData,
    b: ThemeData,
    t: number,
  ): ReadonlyMap<object, ThemeExtensionEntry> {
    const result = new Map<object, ThemeExtensionEntry>();
    for (const [key, value] of a.extensions) {
      // Exact normalized type keys establish the erased self-type callback association.
      result.set(key, value.lerp((b.extensions.get(key) ?? null) as never, t));
    }
    for (const [key, value] of b.extensions) if (!a.extensions.has(key)) result.set(key, value);
    return result;
  }
  /** @dartParam t double */
  static lerp(a: ThemeData, b: ThemeData, t: number): ThemeData {
    if (a === b) return a;
    return ThemeData.raw({
      adaptationMap: t < 0.5 ? a.adaptationMap : b.adaptationMap,
      cupertinoOverrideTheme: t < 0.5 ? a.cupertinoOverrideTheme : b.cupertinoOverrideTheme,
      extensions: ThemeData.lerpExtensions(a, b, t),
      inputDecorationTheme: t < 0.5 ? a.inputDecorationTheme : b.inputDecorationTheme,
      materialTapTargetSize: t < 0.5 ? a.materialTapTargetSize : b.materialTapTargetSize,
      pageTransitionsTheme: t < 0.5 ? a.pageTransitionsTheme : b.pageTransitionsTheme,
      platform: t < 0.5 ? a.platform : b.platform,
      scrollbarTheme: SourceScrollbarThemeData.lerp(a.scrollbarTheme, b.scrollbarTheme, t),
      splashFactory: t < 0.5 ? a.splashFactory : b.splashFactory,
      visualDensity: VisualDensity.lerp(a.visualDensity, b.visualDensity, t),
      canvasColor: Color.lerp(a.canvasColor, b.canvasColor, t)!,
      cardColor: Color.lerp(a.cardColor, b.cardColor, t)!,
      colorScheme: ColorScheme.lerp(a.colorScheme, b.colorScheme, t),
      disabledColor: Color.lerp(a.disabledColor, b.disabledColor, t)!,
      dividerColor: Color.lerp(a.dividerColor, b.dividerColor, t)!,
      focusColor: Color.lerp(a.focusColor, b.focusColor, t)!,
      highlightColor: Color.lerp(a.highlightColor, b.highlightColor, t)!,
      hintColor: Color.lerp(a.hintColor, b.hintColor, t)!,
      hoverColor: Color.lerp(a.hoverColor, b.hoverColor, t)!,
      primaryColor: Color.lerp(a.primaryColor, b.primaryColor, t)!,
      primaryColorDark: Color.lerp(a.primaryColorDark, b.primaryColorDark, t)!,
      primaryColorLight: Color.lerp(a.primaryColorLight, b.primaryColorLight, t)!,
      scaffoldBackgroundColor: Color.lerp(a.scaffoldBackgroundColor, b.scaffoldBackgroundColor, t)!,
      secondaryHeaderColor: Color.lerp(a.secondaryHeaderColor, b.secondaryHeaderColor, t)!,
      shadowColor: Color.lerp(a.shadowColor, b.shadowColor, t)!,
      splashColor: Color.lerp(a.splashColor, b.splashColor, t)!,
      unselectedWidgetColor: Color.lerp(a.unselectedWidgetColor, b.unselectedWidgetColor, t)!,
      iconTheme: IconThemeData.lerp(a.iconTheme, b.iconTheme, t),
      primaryIconTheme: IconThemeData.lerp(a.primaryIconTheme, b.primaryIconTheme, t),
      primaryTextTheme: TextTheme.lerp(a.primaryTextTheme, b.primaryTextTheme, t),
      textTheme: TextTheme.lerp(a.textTheme, b.textTheme, t),
      typography: Typography.lerp(a.typography, b.typography, t),
      actionIconTheme: ActionIconThemeData.lerp(a.actionIconTheme, b.actionIconTheme, t),
      appBarTheme: AppBarThemeData.lerp(a.appBarTheme, b.appBarTheme, t),
      badgeTheme: BadgeThemeData.lerp(a.badgeTheme, b.badgeTheme, t),
      bannerTheme: MaterialBannerThemeData.lerp(a.bannerTheme, b.bannerTheme, t),
      bottomAppBarTheme: BottomAppBarThemeData.lerp(a.bottomAppBarTheme, b.bottomAppBarTheme, t),
      bottomNavigationBarTheme: BottomNavigationBarThemeData.lerp(
        a.bottomNavigationBarTheme,
        b.bottomNavigationBarTheme,
        t,
      ),
      bottomSheetTheme: BottomSheetThemeData.lerp(a.bottomSheetTheme, b.bottomSheetTheme, t)!,
      cardTheme: CardThemeData.lerp(a.cardTheme, b.cardTheme, t),
      carouselViewTheme: CarouselViewThemeData.lerp(a.carouselViewTheme, b.carouselViewTheme, t),
      checkboxTheme: CheckboxThemeData.lerp(a.checkboxTheme, b.checkboxTheme, t),
      chipTheme: ChipThemeData.lerp(a.chipTheme, b.chipTheme, t)!,
      dataTableTheme: DataTableThemeData.lerp(a.dataTableTheme, b.dataTableTheme, t),
      datePickerTheme: DatePickerThemeData.lerp(a.datePickerTheme, b.datePickerTheme, t),
      dialogTheme: DialogThemeData.lerp(a.dialogTheme, b.dialogTheme, t),
      dividerTheme: DividerThemeData.lerp(a.dividerTheme, b.dividerTheme, t),
      drawerTheme: DrawerThemeData.lerp(a.drawerTheme, b.drawerTheme, t)!,
      dropdownMenuTheme: DropdownMenuThemeData.lerp(a.dropdownMenuTheme, b.dropdownMenuTheme, t),
      elevatedButtonTheme: ElevatedButtonThemeData.lerp(
        a.elevatedButtonTheme,
        b.elevatedButtonTheme,
        t,
      )!,
      expansionTileTheme: ExpansionTileThemeData.lerp(
        a.expansionTileTheme,
        b.expansionTileTheme,
        t,
      )!,
      filledButtonTheme: FilledButtonThemeData.lerp(a.filledButtonTheme, b.filledButtonTheme, t)!,
      floatingActionButtonTheme: FloatingActionButtonThemeData.lerp(
        a.floatingActionButtonTheme,
        b.floatingActionButtonTheme,
        t,
      )!,
      iconButtonTheme: IconButtonThemeData.lerp(a.iconButtonTheme, b.iconButtonTheme, t)!,
      listTileTheme: ListTileThemeData.lerp(a.listTileTheme, b.listTileTheme, t)!,
      menuBarTheme: MenuBarThemeData.lerp(a.menuBarTheme, b.menuBarTheme, t)!,
      menuButtonTheme: MenuButtonThemeData.lerp(a.menuButtonTheme, b.menuButtonTheme, t)!,
      menuTheme: MenuThemeData.lerp(a.menuTheme, b.menuTheme, t)!,
      navigationBarTheme: NavigationBarThemeData.lerp(
        a.navigationBarTheme,
        b.navigationBarTheme,
        t,
      )!,
      navigationDrawerTheme: NavigationDrawerThemeData.lerp(
        a.navigationDrawerTheme,
        b.navigationDrawerTheme,
        t,
      )!,
      navigationRailTheme: NavigationRailThemeData.lerp(
        a.navigationRailTheme,
        b.navigationRailTheme,
        t,
      )!,
      outlinedButtonTheme: OutlinedButtonThemeData.lerp(
        a.outlinedButtonTheme,
        b.outlinedButtonTheme,
        t,
      )!,
      popupMenuTheme: PopupMenuThemeData.lerp(a.popupMenuTheme, b.popupMenuTheme, t)!,
      progressIndicatorTheme: ProgressIndicatorThemeData.lerp(
        a.progressIndicatorTheme,
        b.progressIndicatorTheme,
        t,
      )!,
      radioTheme: RadioThemeData.lerp(a.radioTheme, b.radioTheme, t),
      searchBarTheme: SearchBarThemeData.lerp(a.searchBarTheme, b.searchBarTheme, t)!,
      searchViewTheme: SearchViewThemeData.lerp(a.searchViewTheme, b.searchViewTheme, t)!,
      segmentedButtonTheme: SegmentedButtonThemeData.lerp(
        a.segmentedButtonTheme,
        b.segmentedButtonTheme,
        t,
      ),
      sliderTheme: SliderThemeData.lerp(a.sliderTheme, b.sliderTheme, t),
      snackBarTheme: SnackBarThemeData.lerp(a.snackBarTheme, b.snackBarTheme, t),
      switchTheme: SwitchThemeData.lerp(a.switchTheme, b.switchTheme, t),
      tabBarTheme: TabBarThemeData.lerp(a.tabBarTheme, b.tabBarTheme, t),
      textButtonTheme: TextButtonThemeData.lerp(a.textButtonTheme, b.textButtonTheme, t)!,
      textSelectionTheme: TextSelectionThemeData.lerp(
        a.textSelectionTheme,
        b.textSelectionTheme,
        t,
      )!,
      timePickerTheme: TimePickerThemeData.lerp(a.timePickerTheme, b.timePickerTheme, t),
      toggleButtonsTheme: ToggleButtonsThemeData.lerp(
        a.toggleButtonsTheme,
        b.toggleButtonsTheme,
        t,
      )!,
      tooltipTheme: TooltipThemeData.lerp(a.tooltipTheme, b.tooltipTheme, t)!,
    });
  }
  equals(other: unknown): boolean {
    return (
      other instanceof ThemeData &&
      Object.getPrototypeOf(other) === Object.getPrototypeOf(this) &&
      themeDataFields.every((field) =>
        field === 'adaptationMap' || field === 'extensions'
          ? themeMapEquals(this[field], other[field])
          : valueEquals(this[field], other[field]),
      )
    );
  }
  /** @dartType int */
  get hashCode(): number {
    return hashValues(
      ...this.adaptationMap.keys(),
      ...this.adaptationMap.values(),
      this.cupertinoOverrideTheme,
      ...this.extensions.keys(),
      ...this.extensions.values(),
      this.inputDecorationTheme,
      this.materialTapTargetSize,
      this.pageTransitionsTheme,
      this.platform,
      this.scrollbarTheme,
      this.splashFactory,
      this.visualDensity,
      this.canvasColor,
      this.cardColor,
      this.colorScheme,
      this.disabledColor,
      this.dividerColor,
      this.focusColor,
      this.highlightColor,
      this.hintColor,
      this.hoverColor,
      this.primaryColor,
      this.primaryColorDark,
      this.primaryColorLight,
      this.scaffoldBackgroundColor,
      this.secondaryHeaderColor,
      this.shadowColor,
      this.splashColor,
      this.unselectedWidgetColor,
      this.iconTheme,
      this.primaryIconTheme,
      this.primaryTextTheme,
      this.textTheme,
      this.typography,
      this.actionIconTheme,
      this.appBarTheme,
      this.badgeTheme,
      this.bannerTheme,
      this.bottomAppBarTheme,
      this.bottomNavigationBarTheme,
      this.bottomSheetTheme,
      this.cardTheme,
      this.carouselViewTheme,
      this.checkboxTheme,
      this.chipTheme,
      this.dataTableTheme,
      this.datePickerTheme,
      this.dialogTheme,
      this.dividerTheme,
      this.drawerTheme,
      this.dropdownMenuTheme,
      this.elevatedButtonTheme,
      this.expansionTileTheme,
      this.filledButtonTheme,
      this.floatingActionButtonTheme,
      this.iconButtonTheme,
      this.listTileTheme,
      this.menuBarTheme,
      this.menuButtonTheme,
      this.menuTheme,
      this.navigationBarTheme,
      this.navigationDrawerTheme,
      this.navigationRailTheme,
      this.outlinedButtonTheme,
      this.popupMenuTheme,
      this.progressIndicatorTheme,
      this.radioTheme,
      this.searchBarTheme,
      this.searchViewTheme,
      this.segmentedButtonTheme,
      this.sliderTheme,
      this.snackBarTheme,
      this.switchTheme,
      this.tabBarTheme,
      this.textButtonTheme,
      this.textSelectionTheme,
      this.timePickerTheme,
      this.toggleButtonsTheme,
      this.tooltipTheme,
    );
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    const defaultData = ThemeData.fallback();
    properties.add(
      new IterableProperty('adaptations', this.adaptationMap.values(), {
        defaultValue: defaultData.adaptationMap.values(),
        level: 'debug',
      }),
    );
    properties.add(
      new DiagnosticsProperty('cupertinoOverrideTheme', this.cupertinoOverrideTheme, {
        defaultValue: defaultData.cupertinoOverrideTheme,
        level: 'debug',
        typeName: 'NoDefaultCupertinoThemeData',
      }),
    );
    properties.add(
      new IterableProperty('extensions', this.extensions.values(), {
        defaultValue: defaultData.extensions.values(),
        level: 'debug',
      }),
    );
    properties.add(
      new DiagnosticsProperty('inputDecorationTheme', this.inputDecorationTheme, {
        level: 'debug',
        typeName: 'InputDecorationThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('materialTapTargetSize', this.materialTapTargetSize, {
        level: 'debug',
        typeName: 'MaterialTapTargetSize',
      }),
    );
    properties.add(
      new DiagnosticsProperty('pageTransitionsTheme', this.pageTransitionsTheme, {
        level: 'debug',
        typeName: 'PageTransitionsTheme',
      }),
    );
    properties.add(
      new EnumProperty('platform', this.platform, {
        defaultValue: FoundationPlatform.defaultTargetPlatform,
        level: 'debug',
      }),
    );
    properties.add(
      new DiagnosticsProperty('scrollbarTheme', this.scrollbarTheme, {
        defaultValue: defaultData.scrollbarTheme,
        level: 'debug',
        typeName: 'SourceScrollbarThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('splashFactory', this.splashFactory, {
        defaultValue: defaultData.splashFactory,
        level: 'debug',
        typeName: 'InteractiveInkFeatureFactory',
      }),
    );
    properties.add(
      new DiagnosticsProperty('visualDensity', this.visualDensity, {
        defaultValue: defaultData.visualDensity,
        level: 'debug',
        typeName: 'VisualDensity',
      }),
    );
    properties.add(
      new ColorProperty('canvasColor', this.canvasColor, {
        defaultValue: defaultData.canvasColor,
        level: 'debug',
      }),
    );
    properties.add(
      new ColorProperty('cardColor', this.cardColor, {
        defaultValue: defaultData.cardColor,
        level: 'debug',
      }),
    );
    properties.add(
      new DiagnosticsProperty('colorScheme', this.colorScheme, {
        defaultValue: defaultData.colorScheme,
        level: 'debug',
        typeName: 'ColorScheme',
      }),
    );
    properties.add(
      new ColorProperty('disabledColor', this.disabledColor, {
        defaultValue: defaultData.disabledColor,
        level: 'debug',
      }),
    );
    properties.add(
      new ColorProperty('dividerColor', this.dividerColor, {
        defaultValue: defaultData.dividerColor,
        level: 'debug',
      }),
    );
    properties.add(
      new ColorProperty('focusColor', this.focusColor, {
        defaultValue: defaultData.focusColor,
        level: 'debug',
      }),
    );
    properties.add(
      new ColorProperty('highlightColor', this.highlightColor, {
        defaultValue: defaultData.highlightColor,
        level: 'debug',
      }),
    );
    properties.add(
      new ColorProperty('hintColor', this.hintColor, {
        defaultValue: defaultData.hintColor,
        level: 'debug',
      }),
    );
    properties.add(
      new ColorProperty('hoverColor', this.hoverColor, {
        defaultValue: defaultData.hoverColor,
        level: 'debug',
      }),
    );
    properties.add(
      new ColorProperty('primaryColorDark', this.primaryColorDark, {
        defaultValue: defaultData.primaryColorDark,
        level: 'debug',
      }),
    );
    properties.add(
      new ColorProperty('primaryColorLight', this.primaryColorLight, {
        defaultValue: defaultData.primaryColorLight,
        level: 'debug',
      }),
    );
    properties.add(
      new ColorProperty('primaryColor', this.primaryColor, {
        defaultValue: defaultData.primaryColor,
        level: 'debug',
      }),
    );
    properties.add(
      new ColorProperty('scaffoldBackgroundColor', this.scaffoldBackgroundColor, {
        defaultValue: defaultData.scaffoldBackgroundColor,
        level: 'debug',
      }),
    );
    properties.add(
      new ColorProperty('secondaryHeaderColor', this.secondaryHeaderColor, {
        defaultValue: defaultData.secondaryHeaderColor,
        level: 'debug',
      }),
    );
    properties.add(
      new ColorProperty('shadowColor', this.shadowColor, {
        defaultValue: defaultData.shadowColor,
        level: 'debug',
      }),
    );
    properties.add(
      new ColorProperty('splashColor', this.splashColor, {
        defaultValue: defaultData.splashColor,
        level: 'debug',
      }),
    );
    properties.add(
      new ColorProperty('unselectedWidgetColor', this.unselectedWidgetColor, {
        defaultValue: defaultData.unselectedWidgetColor,
        level: 'debug',
      }),
    );
    properties.add(
      new DiagnosticsProperty('iconTheme', this.iconTheme, {
        level: 'debug',
        typeName: 'IconThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('primaryIconTheme', this.primaryIconTheme, {
        level: 'debug',
        typeName: 'IconThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('primaryTextTheme', this.primaryTextTheme, {
        level: 'debug',
        typeName: 'TextTheme',
      }),
    );
    properties.add(
      new DiagnosticsProperty('textTheme', this.textTheme, {
        level: 'debug',
        typeName: 'TextTheme',
      }),
    );
    properties.add(
      new DiagnosticsProperty('typography', this.typography, {
        defaultValue: defaultData.typography,
        level: 'debug',
        typeName: 'Typography',
      }),
    );
    properties.add(
      new DiagnosticsProperty('actionIconTheme', this.actionIconTheme, {
        level: 'debug',
        typeName: 'ActionIconThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('appBarTheme', this.appBarTheme, {
        defaultValue: defaultData.appBarTheme,
        level: 'debug',
        typeName: 'AppBarThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('badgeTheme', this.badgeTheme, {
        defaultValue: defaultData.badgeTheme,
        level: 'debug',
        typeName: 'BadgeThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('bannerTheme', this.bannerTheme, {
        defaultValue: defaultData.bannerTheme,
        level: 'debug',
        typeName: 'MaterialBannerThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('bottomAppBarTheme', this.bottomAppBarTheme, {
        defaultValue: defaultData.bottomAppBarTheme,
        level: 'debug',
        typeName: 'BottomAppBarThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('bottomNavigationBarTheme', this.bottomNavigationBarTheme, {
        defaultValue: defaultData.bottomNavigationBarTheme,
        level: 'debug',
        typeName: 'BottomNavigationBarThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('bottomSheetTheme', this.bottomSheetTheme, {
        defaultValue: defaultData.bottomSheetTheme,
        level: 'debug',
        typeName: 'BottomSheetThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('cardTheme', this.cardTheme, {
        level: 'debug',
        typeName: 'CardThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('carouselViewTheme', this.carouselViewTheme, {
        defaultValue: defaultData.carouselViewTheme,
        level: 'debug',
        typeName: 'CarouselViewThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('checkboxTheme', this.checkboxTheme, {
        defaultValue: defaultData.checkboxTheme,
        level: 'debug',
        typeName: 'CheckboxThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('chipTheme', this.chipTheme, {
        level: 'debug',
        typeName: 'ChipThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('dataTableTheme', this.dataTableTheme, {
        defaultValue: defaultData.dataTableTheme,
        level: 'debug',
        typeName: 'DataTableThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('datePickerTheme', this.datePickerTheme, {
        defaultValue: defaultData.datePickerTheme,
        level: 'debug',
        typeName: 'DatePickerThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('dialogTheme', this.dialogTheme, {
        defaultValue: defaultData.dialogTheme,
        level: 'debug',
        typeName: 'DialogThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('dividerTheme', this.dividerTheme, {
        defaultValue: defaultData.dividerTheme,
        level: 'debug',
        typeName: 'DividerThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('drawerTheme', this.drawerTheme, {
        defaultValue: defaultData.drawerTheme,
        level: 'debug',
        typeName: 'DrawerThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('dropdownMenuTheme', this.dropdownMenuTheme, {
        defaultValue: defaultData.dropdownMenuTheme,
        level: 'debug',
        typeName: 'DropdownMenuThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('elevatedButtonTheme', this.elevatedButtonTheme, {
        defaultValue: defaultData.elevatedButtonTheme,
        level: 'debug',
        typeName: 'ElevatedButtonThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('expansionTileTheme', this.expansionTileTheme, {
        level: 'debug',
        typeName: 'ExpansionTileThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('filledButtonTheme', this.filledButtonTheme, {
        defaultValue: defaultData.filledButtonTheme,
        level: 'debug',
        typeName: 'FilledButtonThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('floatingActionButtonTheme', this.floatingActionButtonTheme, {
        defaultValue: defaultData.floatingActionButtonTheme,
        level: 'debug',
        typeName: 'FloatingActionButtonThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('iconButtonTheme', this.iconButtonTheme, {
        defaultValue: defaultData.iconButtonTheme,
        level: 'debug',
        typeName: 'IconButtonThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('listTileTheme', this.listTileTheme, {
        defaultValue: defaultData.listTileTheme,
        level: 'debug',
        typeName: 'ListTileThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('menuBarTheme', this.menuBarTheme, {
        defaultValue: defaultData.menuBarTheme,
        level: 'debug',
        typeName: 'MenuBarThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('menuButtonTheme', this.menuButtonTheme, {
        defaultValue: defaultData.menuButtonTheme,
        level: 'debug',
        typeName: 'MenuButtonThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('menuTheme', this.menuTheme, {
        defaultValue: defaultData.menuTheme,
        level: 'debug',
        typeName: 'MenuThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('navigationBarTheme', this.navigationBarTheme, {
        defaultValue: defaultData.navigationBarTheme,
        level: 'debug',
        typeName: 'NavigationBarThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('navigationDrawerTheme', this.navigationDrawerTheme, {
        defaultValue: defaultData.navigationDrawerTheme,
        level: 'debug',
        typeName: 'NavigationDrawerThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('navigationRailTheme', this.navigationRailTheme, {
        defaultValue: defaultData.navigationRailTheme,
        level: 'debug',
        typeName: 'NavigationRailThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('outlinedButtonTheme', this.outlinedButtonTheme, {
        defaultValue: defaultData.outlinedButtonTheme,
        level: 'debug',
        typeName: 'OutlinedButtonThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('popupMenuTheme', this.popupMenuTheme, {
        defaultValue: defaultData.popupMenuTheme,
        level: 'debug',
        typeName: 'PopupMenuThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('progressIndicatorTheme', this.progressIndicatorTheme, {
        defaultValue: defaultData.progressIndicatorTheme,
        level: 'debug',
        typeName: 'ProgressIndicatorThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('radioTheme', this.radioTheme, {
        defaultValue: defaultData.radioTheme,
        level: 'debug',
        typeName: 'RadioThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('searchBarTheme', this.searchBarTheme, {
        defaultValue: defaultData.searchBarTheme,
        level: 'debug',
        typeName: 'SearchBarThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('searchViewTheme', this.searchViewTheme, {
        defaultValue: defaultData.searchViewTheme,
        level: 'debug',
        typeName: 'SearchViewThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('segmentedButtonTheme', this.segmentedButtonTheme, {
        defaultValue: defaultData.segmentedButtonTheme,
        level: 'debug',
        typeName: 'SegmentedButtonThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('sliderTheme', this.sliderTheme, {
        level: 'debug',
        typeName: 'SliderThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('snackBarTheme', this.snackBarTheme, {
        defaultValue: defaultData.snackBarTheme,
        level: 'debug',
        typeName: 'SnackBarThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('switchTheme', this.switchTheme, {
        defaultValue: defaultData.switchTheme,
        level: 'debug',
        typeName: 'SwitchThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('tabBarTheme', this.tabBarTheme, {
        level: 'debug',
        typeName: 'TabBarThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('textButtonTheme', this.textButtonTheme, {
        defaultValue: defaultData.textButtonTheme,
        level: 'debug',
        typeName: 'TextButtonThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('textSelectionTheme', this.textSelectionTheme, {
        defaultValue: defaultData.textSelectionTheme,
        level: 'debug',
        typeName: 'TextSelectionThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('timePickerTheme', this.timePickerTheme, {
        defaultValue: defaultData.timePickerTheme,
        level: 'debug',
        typeName: 'TimePickerThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('toggleButtonsTheme', this.toggleButtonsTheme, {
        level: 'debug',
        typeName: 'ToggleButtonsThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('tooltipTheme', this.tooltipTheme, {
        level: 'debug',
        typeName: 'TooltipThemeData',
      }),
    );
  }
  private overrideWithSystemColors(): ThemeData {
    if (!SystemColor.platformProvidesSystemColors) return this;
    const colors = this.brightness === 'dark' ? SystemColor.dark : SystemColor.light;
    let theme = this.copyWith({
      colorScheme: this.colorScheme.copyWith({
        secondary: colors.accentColor.value?.toARGB32() ?? null,
        onSecondary: colors.accentColorText.value?.toARGB32() ?? null,
        surface: colors.canvas.value?.toARGB32() ?? null,
        onSurface: colors.canvasText.value?.toARGB32() ?? null,
      }),
      textTheme: this.textTheme.apply({
        displayColor: colors.canvasText.value?.toARGB32() ?? null,
        bodyColor: colors.canvasText.value?.toARGB32() ?? null,
      }),
    });
    if (
      colors.buttonFace.value !== null ||
      colors.buttonBorder.value !== null ||
      colors.buttonText.value !== null
    ) {
      const style = {
        foregroundColor: colors.buttonText.value,
        backgroundColor: colors.buttonFace.value,
        side:
          colors.buttonBorder.value === null
            ? null
            : new BorderSide({ color: colors.buttonBorder.value.toARGB32() }),
      };
      theme = theme.copyWith({
        elevatedButtonTheme: new ElevatedButtonThemeData({
          style: concreteStyleFrom(style, 'elevated'),
        }),
        textButtonTheme: new TextButtonThemeData({ style: concreteStyleFrom(style, 'text') }),
        outlinedButtonTheme: new OutlinedButtonThemeData({
          style: concreteStyleFrom(style, 'outlined'),
        }),
        filledButtonTheme: new FilledButtonThemeData({ style: concreteStyleFrom(style, 'filled') }),
        floatingActionButtonTheme: new FloatingActionButtonThemeData({
          backgroundColor: colors.buttonFace.value,
          foregroundColor: colors.buttonText.value,
        }),
      });
    }
    if (colors.field.value !== null || colors.fieldText.value !== null) {
      const input = this.inputDecorationTheme,
        color = colors.fieldText.value?.toARGB32() ?? null;
      theme = theme.copyWith({
        inputDecorationTheme: input.copyWith({
          fillColor: colors.field.value,
          labelStyle: input.labelStyle?.copyWith({ color }) ?? new TextStyle({ color }),
          hintStyle: input.hintStyle?.copyWith({ color }) ?? new TextStyle({ color }),
          helperStyle: input.helperStyle?.copyWith({ color }) ?? new TextStyle({ color }),
          prefixStyle: input.prefixStyle?.copyWith({ color }) ?? new TextStyle({ color }),
          suffixStyle: input.suffixStyle?.copyWith({ color }) ?? new TextStyle({ color }),
          counterStyle: input.counterStyle?.copyWith({ color }) ?? new TextStyle({ color }),
        }),
      });
    }
    return theme;
  }
}
/** Cupertino values inherit Material colors while preserving raw explicit overrides. */
export class MaterialBasedCupertinoThemeData extends CupertinoThemeData {
  private readonly materialTheme: ThemeData;
  private readonly overrideTheme: NoDefaultCupertinoThemeData;
  constructor(
    { materialTheme }: { readonly materialTheme: ThemeData },
    /** @internal Source private-constructor specification adapter. */
    overrideTheme: NoDefaultCupertinoThemeData = (
      materialTheme.cupertinoOverrideTheme ?? new CupertinoThemeData()
    ).noDefault(),
    /** @internal Resolved ARGB defaults remain separate from explicit overrides. */
    sourceDefaults?: ConstructorParameters<typeof CupertinoThemeData>[1],
  ) {
    const specified = MaterialBasedCupertinoThemeData.specificationsOf(overrideTheme);
    super(
      {
        ...specified,
        selectionHandleColor:
          specified.selectionHandleColor ?? materialTheme.textSelectionTheme.selectionHandleColor,
      },
      sourceDefaults,
    );
    this.materialTheme = materialTheme;
    this.overrideTheme = overrideTheme;
    Object.freeze(this);
  }
  override get brightness(): 'light' | 'dark' {
    return this.overrideTheme.brightness ?? this.materialTheme.brightness;
  }
  /** Shared Cupertino brightness lookup must see the derived Material brightness. */
  override get specifiedBrightness(): 'light' | 'dark' {
    return this.brightness;
  }
  protected override color(
    field:
      | 'primaryColor'
      | 'primaryContrastingColor'
      | 'barBackgroundColor'
      | 'scaffoldBackgroundColor'
      | 'selectionHandleColor',
  ): NonNullable<CupertinoThemeDataOptions['primaryColor']> {
    const specified = MaterialBasedCupertinoThemeData.specificationsOf(this.overrideTheme);
    if (field === 'primaryColor')
      return specified.primaryColor ?? this.materialTheme.colorScheme.primary;
    if (field === 'primaryContrastingColor')
      return specified.primaryContrastingColor ?? this.materialTheme.colorScheme.onPrimary;
    if (field === 'scaffoldBackgroundColor')
      return specified.scaffoldBackgroundColor ?? this.materialTheme.scaffoldBackgroundColor;
    return super.color(field);
  }
  override copyWith(options: CupertinoThemeDataOptions = {}): MaterialBasedCupertinoThemeData {
    return new MaterialBasedCupertinoThemeData(
      { materialTheme: this.materialTheme },
      this.overrideTheme.copyWith(options),
    );
  }
  override resolveFrom(context: BuildContext): MaterialBasedCupertinoThemeData {
    const overrides = this.overrideTheme
      .copyWith({ textTheme: this.textTheme })
      .resolveFrom(context);
    return new MaterialBasedCupertinoThemeData(
      { materialTheme: this.materialTheme },
      overrides,
      this.resolveDefaults(context),
    );
  }
}
/** Material fallback for a Cupertino-only subtree, using the canonical M3 seed factory. */
export class CupertinoBasedMaterialThemeData {
  readonly materialTheme: ThemeData;
  constructor({ themeData }: { readonly themeData: CupertinoThemeData }) {
    this.materialTheme = new ThemeData({ colorScheme: cupertinoMaterialColorScheme(themeData) });
    Object.freeze(this);
  }
}
const enumToken = Symbol('MaterialTapTargetSize');
export class MaterialTapTargetSize {
  /** @dartType int */ readonly index: number;
  /** @dartParam index int */
  private constructor(
    index: number,
    readonly name: string,
    token: typeof enumToken,
  ) {
    invariant(
      token === enumToken,
      'invalid-enum-construction',
      'MaterialTapTargetSize values cannot be constructed',
    );
    this.index = index;
    Object.freeze(this);
  }
  static readonly padded = new MaterialTapTargetSize(0, 'padded', enumToken);
  static readonly shrinkWrap = new MaterialTapTargetSize(1, 'shrinkWrap', enumToken);
  static readonly values: readonly MaterialTapTargetSize[] = Object.freeze([
    MaterialTapTargetSize.padded,
    MaterialTapTargetSize.shrinkWrap,
  ]);
  toString(): string {
    return 'MaterialTapTargetSize.' + this.name;
  }
}
Object.freeze(MaterialTapTargetSize.prototype);
Object.freeze(MaterialTapTargetSize);
export interface VisualDensityOptions {
  /** @dartType double */ readonly horizontal?: number;
  /** @dartType double */ readonly vertical?: number;
}
export class VisualDensity extends Diagnosticable(class {}) {
  /** @dartType double */ static readonly minimumDensity = -4;
  /** @dartType double */ static readonly maximumDensity = 4;
  /** @dartType double */ readonly horizontal: number;
  /** @dartType double */ readonly vertical: number;
  /** @dartParam horizontal double
   * @dartParam vertical double */
  constructor({ horizontal = 0, vertical = 0 }: VisualDensityOptions = {}) {
    super();
    invariant(
      horizontal >= VisualDensity.minimumDensity &&
        horizontal <= VisualDensity.maximumDensity &&
        vertical >= VisualDensity.minimumDensity &&
        vertical <= VisualDensity.maximumDensity,
      'invalid-visual-density',
      'VisualDensity axes must be between -4 and 4',
    );
    this.horizontal = horizontal;
    this.vertical = vertical;
    if (new.target === VisualDensity) Object.freeze(this);
  }
  static readonly standard = new VisualDensity();
  static readonly comfortable = new VisualDensity({ horizontal: -1, vertical: -1 });
  static readonly compact = new VisualDensity({ horizontal: -2, vertical: -2 });
  static get adaptivePlatformDensity(): VisualDensity {
    return this.defaultDensityForPlatform(FoundationPlatform.defaultTargetPlatform);
  }
  static defaultDensityForPlatform(platform: TargetPlatform): VisualDensity {
    switch (platform) {
      case 'android':
      case 'iOS':
      case 'fuchsia':
        return VisualDensity.standard;
      case 'linux':
      case 'macOS':
      case 'windows':
        return VisualDensity.compact;
    }
  }
  /** @dartParam horizontal double?
   * @dartParam vertical double? */
  copyWith({
    horizontal = null,
    vertical = null,
  }: {
    readonly horizontal?: number | null;
    readonly vertical?: number | null;
  } = {}): VisualDensity {
    return new VisualDensity({
      horizontal: horizontal ?? this.horizontal,
      vertical: vertical ?? this.vertical,
    });
  }
  get baseSizeAdjustment(): Offset {
    return new Offset(this.horizontal * 4, this.vertical * 4);
  }
  /** @dartParam t double */
  static lerp(a: VisualDensity, b: VisualDensity, t: number): VisualDensity {
    if (a === b) return a;
    return new VisualDensity({
      horizontal: lerpDouble(a.horizontal, b.horizontal, t)!,
      vertical: lerpDouble(a.vertical, b.vertical, t)!,
    });
  }
  effectiveConstraints(constraints: BoxConstraints): BoxConstraints {
    constraints.debugAssertIsValid();
    const offset = this.baseSizeAdjustment;
    return constraints.copyWith({
      minWidth: Math.min(constraints.maxWidth, Math.max(0, constraints.minWidth + offset.dx)),
      minHeight: Math.min(constraints.maxHeight, Math.max(0, constraints.minHeight + offset.dy)),
    });
  }
  equals(other: unknown): boolean {
    return (
      other instanceof VisualDensity &&
      other.constructor === this.constructor &&
      other.horizontal === this.horizontal &&
      other.vertical === this.vertical
    );
  }
  get hashCode(): number {
    return hashValues(this.horizontal, this.vertical);
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DoubleProperty('horizontal', this.horizontal, { defaultValue: 0 }));
    properties.add(new DoubleProperty('vertical', this.vertical, { defaultValue: 0 }));
  }
  override toStringShort(): string {
    return `${super.toStringShort()}(h: ${debugFormatDouble(this.horizontal)}, v: ${debugFormatDouble(this.vertical)})`;
  }
}
