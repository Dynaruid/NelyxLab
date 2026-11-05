# @nelyx/material

Material 3 components and themes for Nelyx applications. The package builds on the shared Widget/Element/RenderObject framework in `@nelyx/core`.

Start with the [project guide](../../README.md) or explore the [Testbed](../../sample/nelyx-testbed-app-2/README.md). Component coverage is incomplete; available themes and declarations do not imply every Material component is implemented.

## Imports

Use the component aggregate or a feature subpath:

```ts
import {MaterialApp, FilledButton, TextField} from '@nelyx/material/widgets';
import {ThemeData} from '@nelyx/material/theme-data';
import {ColorScheme} from '@nelyx/material/color-scheme';
```

| Area | Subpaths |
| --- | --- |
| Application and theme | `app`, `theme`, `theme-data`, `color-scheme`, `text-theme` |
| Buttons | `filled-button`, `text-button`, `outlined-button`, `elevated-button`, `icon-button` |
| Selection | `checkbox`, `radio`, `switch`, `slider`, `range-slider` |
| Text and forms | `text-field`, `text-form-field`, `input-decoration` |
| Surfaces and feedback | `material`, `card`, `ink-well`, `tooltip`, `progress-indicator` |
| Navigation and scrolling | `page`, `page-transitions-theme`, `scrollbar`, `scroll-behavior` |
| Assets | `icons`, `icon-assets` |

All names are relative to `@nelyx/material/`. See [package.json](package.json) for the full export list.

## Themes and state

Wrap the application in MaterialApp and use the package's Theme/ThemeData for Material styling. Core's AppTheme/AppThemeData serves the common Nelyx adapter. Keep one shared Core instance across design packages.

This package targets Material 3. Material 2 configuration and compatibility aliases are unavailable.

Checkbox, Radio, Switch, Slider, and RangeSlider are controlled components: the application stores their values and applies changes requested through callbacks. Controllers and FocusNodes supplied by the application remain caller-owned.

Some source-typed generic values require explicit numeric carriers and type witnesses. For example:

```ts
import {ScrollbarThemeData} from '@nelyx/material/scrollbar-theme';
import {WidgetStatePropertyAll} from '@nelyx/core/framework/widgets/widget-state';
import {DartDouble} from '@nelyx/core/foundation/dart-numeric';
import {dartDoubleType, nullableDartType} from '@nelyx/core/foundation/dart-type-witness';

const thickness = new WidgetStatePropertyAll(
  nullableDartType(dartDoubleType), DartDouble.fromSource(12),
);
const scrollbarTheme = new ScrollbarThemeData({thickness});
```

Use the declarations for the selected component's exact value and callback types.

## Icons and assets

Material Icons metadata is exported from `@nelyx/material/icon-assets`. Declare the exported font and license through the application's `nelyx.assets` configuration, keeping `packageSource` and notice metadata together. See the [SDK asset guide](../../Nelyx/sdk/README.md#assets).

The package includes [MaterialIcons.otf](assets/MaterialIcons.otf) and [its license](licenses/MaterialIcons-LICENSE.txt).

## Build and use

From the repository root, after `npm ci`:

```powershell
npm run build:designs
npm run check --workspace @nelyx/material
```

Use `npm run build:sdk` for the full package set. Supply and reinstall the selected runner after changing local packages. The Testbed demonstrates components through their public APIs.

## License

Nelyx-authored code uses [BSD-3-Clause](LICENSE.md). Imported Flutter sources and assets retain the notices and source records in [licenses/](licenses/).

## Experimental C++ engine v2

Use the explicit `@nelyx/material/v2` entry point together with `@nelyx/core/v2`. It declares Core/native control state and Skia/CanvasKit painting; it does not call the v1 renderer. Supported constructor signatures are in [src/v2.ts](src/v2.ts). Buttons, selection controls, sliders, editors and composed surfaces are available; primary control colors resolve through the v2 theme. Material also provides range/progress/chip controls; Cupertino provides activity/list/form-section surfaces.

These are scoped v2 APIs. Full v1 constructor compatibility, form validation, complete typography/icons/shapes/transitions and general resolver migration are pending. The v2 Testbed exercises both design packages. See the [Core guide](../../Nelyx/README.md#experimental-v2-engine-protocol) and [current implementation boundaries](../../work8-2.md#lazy-list디자인-controlgestureime-후속-구현). Physical IME/reader and performance acceptance remain separate.
