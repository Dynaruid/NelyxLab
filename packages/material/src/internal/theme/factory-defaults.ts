// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Known source const default expressions in the resolved ThemeData factory.
// This module owns selected Material policy values; Core owns the Dart const runtime.
import {InputDecorationThemeData} from "../../input-decoration-theme-data.ts";
import {PageTransitionsTheme} from "../../page-transitions-theme.ts";
import {constScrollbarThemeData} from "../../generated/scrollbar/scrollbar-theme-data.generated.ts";
import {BadgeThemeData} from "../../badge-theme-data.ts";
import {MaterialBannerThemeData} from "../../material-banner-theme-data.ts";
import {BottomAppBarThemeData} from "../../bottom-app-bar-theme-data.ts";
import {BottomNavigationBarThemeData} from "../../bottom-navigation-bar-theme-data.ts";
import {BottomSheetThemeData} from "../../bottom-sheet-theme-data.ts";
import {CardThemeData} from "../../card-theme-data.ts";
import {CarouselViewThemeData} from "../../carousel-view-theme-data.ts";
import {CheckboxThemeData} from "../../generated/theme/toggle-theme-data.generated.ts";
import {ChipThemeData} from "../../chip-theme-data.ts";
import {DataTableThemeData} from "../../data-table-theme-data.ts";
import {DatePickerThemeData} from "../../date-picker-theme-data.ts";
import {DialogThemeData} from "../../dialog-theme-data.ts";
import {DividerThemeData} from "../../divider-theme-data.ts";
import {DrawerThemeData} from "../../drawer-theme-data.ts";
import {DropdownMenuThemeData} from "../../dropdown-menu-theme-data.ts";
import {ElevatedButtonThemeData} from "../../elevated-button-theme-data.ts";
import {ExpansionTileThemeData} from "../../expansion-tile-theme-data.ts";
import {FilledButtonThemeData} from "../../filled-button-theme-data.ts";
import {FloatingActionButtonThemeData} from "../../floating-action-button-theme-data.ts";
import {IconButtonThemeData} from "../../icon-button-theme-data.ts";
import {ListTileThemeData} from "../../list-tile-theme-data.ts";
import {MenuBarThemeData} from "../../menu-bar-theme-data.ts";
import {MenuButtonThemeData} from "../../menu-button-theme-data.ts";
import {MenuThemeData} from "../../menu-theme-data.ts";
import {NavigationBarThemeData} from "../../navigation-bar-theme-data.ts";
import {NavigationDrawerThemeData} from "../../navigation-drawer-theme-data.ts";
import {NavigationRailThemeData} from "../../navigation-rail-theme-data.ts";
import {OutlinedButtonThemeData} from "../../outlined-button-theme-data.ts";
import {PopupMenuThemeData} from "../../popup-menu-theme-data.ts";
import {ProgressIndicatorThemeData} from "../../progress-indicator-theme-data.ts";
import {RadioThemeData} from "../../generated/theme/toggle-theme-data.generated.ts";
import {SearchBarThemeData} from "../../search-bar-theme-data.ts";
import {SearchViewThemeData} from "../../search-view-theme-data.ts";
import {SegmentedButtonThemeData} from "../../segmented-button-theme-data.ts";
import {SliderThemeData} from "../../slider-theme-data.ts";
import {SnackBarThemeData} from "../../snack-bar-theme-data.ts";
import {SwitchThemeData} from "../../generated/theme/toggle-theme-data.generated.ts";
import {TabBarThemeData} from "../../tab-bar-theme-data.ts";
import {TextButtonThemeData} from "../../text-button-theme-data.ts";
import {TextSelectionThemeData} from "../../text-selection-theme-data.ts";
import {TimePickerThemeData} from "../../time-picker-theme-data.ts";
import {ToggleButtonsThemeData} from "../../toggle-buttons-theme-data.ts";
import {TooltipThemeData} from "../../tooltip-theme-data.ts";
import {AppBarThemeData} from "../../app-bar-theme-data.ts";
function constantDefault<T extends object>(value:T):T{Object.freeze(value);return value;}
export const materialFactoryDefaults=Object.freeze({
    inputDecorationTheme:constantDefault(new InputDecorationThemeData()),
    pageTransitionsTheme:constantDefault(new PageTransitionsTheme()),
    scrollbarTheme:constScrollbarThemeData({}),
    badgeTheme:constantDefault(new BadgeThemeData()),
    bannerTheme:constantDefault(new MaterialBannerThemeData()),
    bottomAppBarTheme:constantDefault(new BottomAppBarThemeData()),
    bottomNavigationBarTheme:constantDefault(new BottomNavigationBarThemeData()),
    bottomSheetTheme:constantDefault(new BottomSheetThemeData()),
    cardTheme:constantDefault(new CardThemeData()),
    carouselViewTheme:constantDefault(new CarouselViewThemeData()),
    checkboxTheme:constantDefault(new CheckboxThemeData()),
    chipTheme:constantDefault(new ChipThemeData()),
    dataTableTheme:constantDefault(new DataTableThemeData()),
    datePickerTheme:constantDefault(new DatePickerThemeData()),
    dialogTheme:constantDefault(new DialogThemeData()),
    dividerTheme:constantDefault(new DividerThemeData()),
    drawerTheme:constantDefault(new DrawerThemeData()),
    dropdownMenuTheme:constantDefault(new DropdownMenuThemeData()),
    elevatedButtonTheme:constantDefault(new ElevatedButtonThemeData()),
    expansionTileTheme:constantDefault(new ExpansionTileThemeData()),
    filledButtonTheme:constantDefault(new FilledButtonThemeData()),
    floatingActionButtonTheme:constantDefault(new FloatingActionButtonThemeData()),
    iconButtonTheme:constantDefault(new IconButtonThemeData()),
    listTileTheme:constantDefault(new ListTileThemeData()),
    menuBarTheme:constantDefault(new MenuBarThemeData()),
    menuButtonTheme:constantDefault(new MenuButtonThemeData()),
    menuTheme:constantDefault(new MenuThemeData()),
    navigationBarTheme:constantDefault(new NavigationBarThemeData()),
    navigationDrawerTheme:constantDefault(new NavigationDrawerThemeData()),
    navigationRailTheme:constantDefault(new NavigationRailThemeData()),
    outlinedButtonTheme:constantDefault(new OutlinedButtonThemeData()),
    popupMenuTheme:constantDefault(new PopupMenuThemeData()),
    progressIndicatorTheme:constantDefault(new ProgressIndicatorThemeData()),
    radioTheme:constantDefault(new RadioThemeData()),
    searchBarTheme:constantDefault(new SearchBarThemeData()),
    searchViewTheme:constantDefault(new SearchViewThemeData()),
    segmentedButtonTheme:constantDefault(new SegmentedButtonThemeData()),
    sliderTheme:constantDefault(new SliderThemeData()),
    snackBarTheme:constantDefault(new SnackBarThemeData()),
    switchTheme:constantDefault(new SwitchThemeData()),
    tabBarTheme:constantDefault(new TabBarThemeData()),
    textButtonTheme:constantDefault(new TextButtonThemeData()),
    textSelectionTheme:constantDefault(new TextSelectionThemeData()),
    timePickerTheme:constantDefault(new TimePickerThemeData()),
    toggleButtonsTheme:constantDefault(new ToggleButtonsThemeData()),
    tooltipTheme:constantDefault(new TooltipThemeData()),
    appBarTheme:constantDefault(new AppBarThemeData())
});
