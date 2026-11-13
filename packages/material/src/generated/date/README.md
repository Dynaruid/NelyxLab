# Pinned Flutter date widgets

Generated from Flutter `71e4717a61786faab4c7aa39825989305ed29e8a` (BSD-3-Clause).
The exact input files, normalized hashes and 75 selected declarations are in
`tools/Nelyx.FrameworkToTypeScript/data/material-date-picker.json`.

The generator retains the original single-date picker, calendar/day/year states,
input validation, date utilities, dialog, spacer and restoration method bodies.
For `DefaultMaterialLocalizations`, it selects the complete original date members
consumed by these widgets, plus their original private helpers and constant tables.
The range-picker UI and Cupertino picker are outside this input manifest.

`internal/date` adapts constructor arguments, numeric/collection representations,
Core-owned focus, navigation, editing and restoration. The current public theme
is Material 3; date messages use the original US-English default localization.
No handwritten calendar substitutes for the generated calendar widget.
The calendar recipe specializes analyzer-proven lexical nullable receivers with
one immediate property read into strict-null conditionals. It removes their
temporary IIFEs while retaining getter/Proxy reads, errors, type witnesses and
user state resolvers. Other receiver expressions keep single-evaluation lowering.
Generated enum constants register their Dart identity equality/hash policy; the
restorable mode setters use that same policy. Form membership and text editing
use the existing Core Form/TextFormField contract through constructor adapters.

The v2 bridge uses the original grid delegate to derive regular-tile parameters
from Content constraints, groups retained cells into native rows, and lets Core
measure/place/scroll them. Native page snapping uses the pinned default spring.
The first page uses Content viewport constraints and Core initial-offset policy,
matching the startup order of Flutter _PagePosition.applyViewportDimension.
Only the visible month blocks first publication; native neighbour preparation
follows, and an early adjacent-page animation waits for its accepted coverage.
Display-feature `anchorPoint` and assertive announcement events are not supported.
Polite announcements use the owning platform View. Feedback follows the pinned
Flutter engine's `web_ui/lib/src/engine/platform_dispatcher.dart` and
`safe_browser_api.dart`: optional browser vibration and acknowledged absent Web
system sounds. Windows' `shell/platform/windows/platform_handler.cc` leaves
haptics unimplemented; its response reaches the original OptionalMethodChannel.
This does not claim a Windows hardware haptics implementation.

From the repository root, with Bun and a Dart SDK satisfying `dart/pubspec.yaml`
(validated with Dart 3.14.0-296.0.dev):

```powershell
bun tools/Nelyx.FrameworkToTypeScript/generate-date-picker.ts --write --source reference/flutter-master --dart <dart.exe>
npm.cmd run build:core
npm.cmd run build --workspace @nelyx/material
bun tools/Nelyx.FrameworkToTypeScript/generate-date-picker.ts --check --verify --source reference/flutter-master --dart <dart.exe>
```

`--check` re-analyzes the original files and compares current generated output.
`--verify` also exercises compiler rejection boundaries and compares current dist
with an executable Dart oracle built from unchanged original member spans.
Temporary analysis/oracle files are removed in `finally`; no IR/log archive is kept.
