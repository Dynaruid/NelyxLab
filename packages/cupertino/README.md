# @nelyx/cupertino

Cupertino components, themes, and iOS-style route transitions for Nelyx applications. The package shares the `@nelyx/core` framework with Material and common widgets.

Start with the [project guide](../../README.md) or explore the [Testbed](../../sample/nelyx-testbed-app-2/README.md). This package implements a subset of the Cupertino library.

## Imports

Use the component aggregate or a feature subpath:

```ts
import {CupertinoApp, CupertinoButton, CupertinoTextField} from '@nelyx/cupertino/widgets';
import {CupertinoThemeData} from '@nelyx/cupertino/theme';
```

| Area | Subpaths |
| --- | --- |
| Application and theme | `app`, `theme`, `colors`, `text-theme` |
| Page structure | `page-scaffold`, `nav-bar`, `list-tile`, `list-section` |
| Controls | `button`, `checkbox`, `radio`, `switch`, `slider`, `picker`, `timer-picker`, `segmented-control`, `sliding-segmented-control` |
| Text and forms | `text-field`, `search-field`, `text-form-field-row`, `form-row`, `form-section` |
| Feedback and navigation | `activity-indicator`, `dialog`, `action-sheet`, `route` |
| Scrolling and selection | `refresh`, `scrollbar`, `scroll-behavior`, `text-selection` |
| Assets | `icons`, `icon-assets` |

All names are relative to `@nelyx/cupertino/`. See [package.json](package.json) for all exports.

## Themes, controls, and editing

Use CupertinoApp and CupertinoThemeData for Cupertino styling. Core's AppTheme/AppThemeData supplies the common Nelyx adapter. Cupertino and Material applications share one Core instance.

Selection controls use application-owned values and report requested changes through callbacks. CupertinoTextField composes the Core editor, while CupertinoTextFormFieldRow participates in the common Form system. Controllers and FocusNodes supplied by the application remain caller-owned.

`CupertinoSegmentedControl<T>` is the classic bordered control, distinct from `CupertinoSlidingSegmentedControl`. It follows [Flutter's pinned implementation](https://github.com/flutter/flutter/blob/71e4717a61786faab4c7aa39825989305ed29e8a/packages/flutter/lib/src/cupertino/segmented_control.dart). Supply an ordered map of at least two widgets and rebuild with the value reported by `onValueChanged`. A null `groupValue` selects nothing; `disabledChildren` can include the current selection without making it interactive. Segments share a width and height, and reverse visually in RTL. The outer corners use Core's rounded rectangles in place of Flutter's rounded superellipses.

Use `CupertinoPicker` with a list of children or `CupertinoPicker.builder` to construct items as the wheel brings them into view. Import `FixedExtentScrollController` from `@nelyx/cupertino/picker` to set an initial item or move to an index. Give the picker bounded width and height, and use `ChangeReportingBehavior.onScrollEnd` when a callback should run after the wheel settles.

`CupertinoTimerPicker` is available from `@nelyx/cupertino/timer-picker` or `@nelyx/cupertino/widgets`. Its initial and reported durations are numbers in **milliseconds**, following Core. The initial value must be in `[0, 86_400_000)`. Both intervals must be positive integer divisors of 60 and divide the initial whole-minute and whole-second counts respectively, even for a hidden column. The `hm`, `ms`, and `hms` modes report only visible components, at whole-second precision; minute and second wheels wrap independently, without carrying into the next unit. Mounting does not emit a change; use a new key to reset the initial selection or change mode. The default is to report during scrolling; pass `ChangeReportingBehavior.onScrollEnd` from `@nelyx/cupertino/picker` to report on settle. A `selectionOverlayBuilder` can replace or suppress the overlay for each column.

The picker follows [the pinned Flutter timer picker](https://github.com/flutter/flutter/blob/71e4717a61786faab4c7aa39825989305ed29e8a/packages/flutter/lib/src/cupertino/date_picker.dart). Timer numerals and unit labels currently use English; exact Flutter font measurement, baseline placement, and narrow-width golden parity are not implemented.

`CupertinoSearchTextField` configures the editor for Search submission and provides a localized placeholder and a clear action. Use `onSuffixTap` to replace the clear action. `restorationId` restores text under a Core restoration scope when the field owns its controller; restore caller-owned controllers at the application level.

Editing supports clear/Undo, line policies, validation, and platform input integration. Advanced editing, complete Cupertino API coverage, and physical IME/reader behavior require further qualification.

## Pull to refresh

`CupertinoSliverRefreshControl` follows the [pinned Flutter refresh sliver](https://github.com/flutter/flutter/blob/71e4717a61786faab4c7aa39825989305ed29e8a/packages/flutter/lib/src/cupertino/refresh.dart). Put it first in a downward `CustomScrollView`, before the content slivers, or after a sliver that preserves leading overscroll. Use Core's `BouncingScrollPhysics` with an `AlwaysScrollableScrollPhysics` parent to support short lists. Clamping physics cannot trigger refresh.

The default 100 logical-pixel pull threshold arms refresh without waiting for release. While `onRefresh`'s promise is pending, the sliver reserves 60 logical pixels by default. Settlement releases that space; another pull can arm only after retraction reaches 10% of the trigger distance. A custom `builder` receives `RefreshIndicatorMode` and the available extent; use `builder: null` to hide the indicator without disabling refresh. Refresh failures go to Core's error reporter and still release the retained space.

The Testbed **Sliver refresh** demo adds a row after asynchronous completion. Native haptic behavior and pinned/collapsing navigation-bar combinations have not been qualified.

## Routes

The `route` module supplies CupertinoPageRoute, page/fullscreen dialog transitions, and the back-gesture integration. Use the shared Core navigation and animation owners. Borrowed animation controllers retain their caller-owned lifetime.

`CupertinoActionSheet` bottom-aligns a title/message and a scrollable list of actions, with an optional separate cancel button. Explicit `messageScrollController` and `actionScrollController` instances remain caller-owned. Present the sheet with a Core modal route (the Testbed uses `createDialogRoute`); wire each `CupertinoActionSheetAction.onPressed` to return a result or dismiss the route as appropriate. Actions do not dismiss automatically. The widgets do not implement Flutter's `showCupertinoModalPopup` transition or its slide-across-actions selection gesture.

## Icons and assets

Icon metadata is exported from `@nelyx/cupertino/icon-assets`. Declare the font and license in `nelyx.assets`, preserving `packageSource` and notice metadata. See the [SDK asset guide](../../Nelyx/sdk/README.md#assets).

The package includes [CupertinoIcons.ttf](assets/CupertinoIcons.ttf) and [its license](licenses/CupertinoIcons-LICENSE.txt).

## Build and use

From the repository root, after `npm ci`:

```powershell
npm run build:designs
```

Use `npm run build:sdk` for the full package set. Supply and reinstall the selected runner after changing local packages. The [Testbed](../../sample/nelyx-testbed-app-2/README.md) consumes the public components and routes.

## License

Nelyx-authored code uses [BSD-3-Clause](LICENSE.md). Imported Flutter sources, localization data, and icon assets retain their notices in [licenses/](licenses/).

## Source framework migration

Version 0.2 uses the canonical Core Source framework. The former `/v2` exports and per-widget native registration APIs have been removed. Custom shapes, painters and layout delegates run their Source hooks. See the [W12 closing summary](../../history/26/11/14/work12-summary.md#현재-구현과-확인-범위) for verified and pending behavior.
