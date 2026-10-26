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
| Controls | `button`, `checkbox`, `radio`, `switch`, `slider` |
| Text and forms | `text-field`, `text-form-field-row`, `form-row`, `form-section` |
| Feedback and navigation | `activity-indicator`, `dialog`, `route` |
| Scrolling and selection | `scrollbar`, `scroll-behavior`, `text-selection` |
| Assets | `icons`, `icon-assets` |

All names are relative to `@nelyx/cupertino/`. See [package.json](package.json) for all exports.

## Themes, controls, and editing

Use CupertinoApp and CupertinoThemeData for Cupertino styling. Core's AppTheme/AppThemeData supplies the common Nelyx adapter. Cupertino and Material applications share one Core instance.

Selection controls use application-owned values and report requested changes through callbacks. CupertinoTextField composes the Core editor, while CupertinoTextFormFieldRow participates in the common Form system. Controllers and FocusNodes supplied by the application remain caller-owned.

Editing supports clear/Undo, line policies, validation, and platform input integration. Advanced editing, restoration, complete Cupertino API coverage, and physical IME/reader behavior require further qualification.

## Routes

The `route` module supplies CupertinoPageRoute, page/fullscreen dialog transitions, and the back-gesture integration. Use the shared Core navigation and animation owners. Borrowed animation controllers retain their caller-owned lifetime.

## Icons and assets

Icon metadata is exported from `@nelyx/cupertino/icon-assets`. Declare the font and license in `nelyx.assets`, preserving `packageSource` and notice metadata. See the [SDK asset guide](../../Nelyx/sdk/README.md#assets).

The package includes [CupertinoIcons.ttf](assets/CupertinoIcons.ttf) and [its license](licenses/CupertinoIcons-LICENSE.txt).

## Build and use

From the repository root, after `npm ci`:

```powershell
npm run build:designs
npm run check --workspace @nelyx/cupertino
```

Use `npm run build:sdk` for the full package set. Supply and reinstall the selected runner after changing local packages. The [Testbed](../../sample/nelyx-testbed-app-2/README.md) consumes the public components and routes.

## License

Nelyx-authored code uses [BSD-3-Clause](LICENSE.md). Imported Flutter sources, localization data, and icon assets retain their notices in [licenses/](licenses/).
