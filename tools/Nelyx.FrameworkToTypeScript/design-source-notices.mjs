// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const root = '.tmp/work6/flutter-source',
  revision = '71e4717a61786faab4c7aa39825989305ed29e8a';
const hash = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const git = spawnSync('git', ['-C', root, 'rev-parse', 'HEAD'], {
  encoding: 'utf8',
  windowsHide: true,
  timeout: 1200000,
});
assert.equal(git.status, 0);
assert.equal(git.stdout.trim(), revision);
assert.equal(
  fs.readFileSync('Nelyx/licenses/FlutterEngine-LICENSE.md', 'utf8').replaceAll('\r\n', '\n'),
  fs.readFileSync(root + '/engine/src/flutter/LICENSE', 'utf8').replaceAll('\r\n', '\n'),
  'Retained engine notice must match the pinned source license',
);
for (const pkg of ['cupertino', 'material']) {
  assert.equal(
    fs.readFileSync(`packages/${pkg}/licenses/Flutter-LICENSE.md`, 'utf8').replaceAll('\r\n', '\n'),
    fs.readFileSync(root + '/LICENSE', 'utf8').replaceAll('\r\n', '\n'),
    'Retained notice must match the pinned Flutter license text',
  );
  const sources =
    pkg === 'cupertino'
      ? [
          'colors.dart',
          'text_theme.dart',
          'theme.dart',
          'app.dart',
          'button.dart',
          'constants.dart',
          'checkbox.dart',
          'radio.dart',
          'switch.dart',
          'activity_indicator.dart',
          'slider.dart',
          'thumb_painter.dart',
          'icon_theme_data.dart',
          'icons.dart',
          'list_tile.dart',
          'list_section.dart',
        ]
      : [
          'colors.dart',
          'text_theme.dart',
          'typography.dart',
          'theme_data.dart',
          'app.dart',
          'button_style.dart',
          'button_style_button.dart',
          'filled_button.dart',
          'text_button.dart',
          'outlined_button.dart',
          'elevated_button.dart',
          'checkbox.dart',
          'radio.dart',
          'switch.dart',
          'checkbox_theme.dart',
          'radio_theme.dart',
          'switch_theme.dart',
          'progress_indicator.dart',
          'progress_indicator_theme.dart',
          'slider.dart',
          'slider_theme.dart',
          'range_slider.dart',
          'range_slider_parts.dart',
          'slider_parts.dart',
          'slider_value_indicator_shape.dart',
          'material.dart',
          'elevation_overlay.dart',
          'ink_decoration.dart',
          'ink_well.dart',
          'ink_highlight.dart',
          'ink_splash.dart',
          'ink_ripple.dart',
          'no_splash.dart',
          'chip_theme.dart',
          'chip.dart',
          'action_chip.dart',
          'choice_chip.dart',
          'filter_chip.dart',
          'input_chip.dart',
          'icons.dart',
          'tooltip.dart',
          'tooltip_theme.dart',
          'tooltip_visibility.dart',
          'divider.dart',
          'divider_theme.dart',
          'list_tile.dart',
          'list_tile_theme.dart',
          'icon_button_theme.dart',
        ];
  const file = `packages/${pkg}/licenses/design-foundation-sources.json`;
  const record = {
    schema: 'nelyx.design-source-notices/v1',
    revision,
    license: 'BSD-3-Clause',
    notice: 'Flutter-LICENSE.md',
    noticeSha256: hash(`packages/${pkg}/licenses/Flutter-LICENSE.md`),
    scope:
      'Selected W11 palette data, functional theme/text-role/application and selected button/check/radio/switch/activity/progress/Cupertino and Material sliders, slider theme/value compositions and generated original shape bodies; no whole design library/native/font/asset qualification.',
    sources: [
      ...sources.map((name) => {
        const source = `packages/flutter/lib/src/${pkg}/${name}`;
        return { source, sha256: hash(root + '/' + source) };
      }),
      ...(pkg === 'material'
        ? [
            'packages/flutter/lib/src/widgets/safe_area.dart',
            'packages/flutter/lib/src/widgets/feedback.dart',
            'packages/flutter/lib/src/painting/shape_decoration.dart',
            'packages/flutter/lib/src/material/ink_sparkle.dart',
            'packages/flutter/lib/src/material/shaders/ink_sparkle.frag',
          ].map((source) => ({ source, sha256: hash(root + '/' + source) }))
        : []),
    ],
    numericPolicy:
      'Generated and finite field-projection Dart annotations retain resolved analyzer provenance. Handwritten TypeScript uses the existing Core ARGB/TextStyle ABI and adds no fictitious Dart annotations. Core IconData.codePoint and its constructor parameter annotations are checked against their exact analyzer-resolved int field/parameter records; generated catalog literal arguments preserve those resolved records.',
    ownership:
      pkg === 'cupertino'
        ? 'Palette: managed Dart batch/3-way merge. CupertinoCheckbox has14 nondeprecated resolved fields,12 managed source constants, full finite source gradient/check/dash/press/focus comparisons and actual Root/adaptive/Babel/public checks. It uses shared source input/motion policies with direct value paint; inactiveColor is intentionally removed. Theme/text-theme, selected App/button/radio/switch/activity compositions: explicit functional TypeScript source using shared Core interaction/state owners. Cupertino slider/thumb paint and callback bodies are compared independently. The complete1322 Cupertino icon constants are resolved-IR data on Core IconData with the unchanged font and MIT notice. CupertinoIconThemeData preserves the repeated Diagnosticable mixin order, subtype-copy and ambient dynamic color resolution; the original diagnostic body supplies only its color property. CupertinoListTile/base/notched/chevron and ListSection/base/insetGrouped supply resolved public fields/defaults and five numeric field annotations, canonical section enum, actual State/async tap latch including failure and mounted guards, typography/slot/padding/dynamic colors/separator/header/footer/shape/clip compositions. Full unchanged original libraries execute on finite native receivers; actual Root paragraphs/glyphs/pointer/clip hit and lifetime have separate proof. Source ClipRSuperellipse is represented privately by Core ClipPath and RoundedSuperellipseBorder geometry; full public RSuperellipse API/native hierarchy is not claimed. Async callback rejection is reported to the owning host error channel while preserving the source latch; this does not claim the original Zone implementation.'
        : 'Palette/M3 role and typography data: finite AST extraction with edit conflict rejection. Swatch/theme/text-role/App/button/check/radio/switch/progress compositions: explicit functional TypeScript source using shared Core contracts; selected M3 button color decisions are compared with original bodies. Slider data fields are a managed resolved-IR projection and RangeValues/RangeLabels/enums are complete finite body generation; Material Slider/defaults/overlay are finite functional ports on current Core owners. Three original slider/range/value-indicator libraries supply40 complete generated declarations with private helpers; RangeSlider is a finite functional State/Render port with actual two-focus/two-source-node input/overlay ownership. Original range default getters, preferred geometry and callback/selection/semantic decision bodies are compared independently. Tooltip/theme/visibility are explicit source-shaped ports on Core RawTooltip with fifteen theme fields, source duration copy/lerp omissions and actual glyph/semantics/hover/touch/Escape/retirement verification; whole source hierarchy and latest native delivery remain separate. MaterialType is a complete managed resolved-IR enum preserving canonical values/index/name/toString and integer provenance. Material surface/InkFeature/elevation and Ink/InkDecoration/image are finite functional ports on existing physical shape, decoration/image, ticker and render owners; unchanged original build/elevation/circle/decoration bodies are compared independently. InkResponse/InkWell and Highlight/Splash/Ripple/NoSplash are finite functional ports using actual Core gesture/focus/keep-alive/ticker/Material owners. Interactive base clipping and effect bodies/private helpers, selected response callbacks/enable decisions and complete Feedback platform decisions are compared independently with unchanged native Dart bodies. Feedback uses explicit per-View messengers. Material is M3-only: source M3 Sparkle on supported Android uses current RuntimeShader suppliers, otherwise Ripple. M2 selection/factories/defaults are removed. Current emulator/shader receipts qualify their declared scope; broader native delivery remains separate. RefreshProgressIndicator uses actual circular Material, geometry/arrow, opacity/rotation/phase/semantics/ticker ownership. Complete original Refresh widget/State/painter and source progress theme16-field diagnostics/hash equality relations are compared independently; public progress fields are supplied. Host hash values are not native VM hash numbers. Complete8825 Material icon constants and20 adaptive getters are resolved-IR data on Core IconData with the unchanged Google Material icon font and CC BY4.0 notice. ChipThemeData supplies all23 source fields/copy/lerp/equality/hash/diagnostics and actual inherited ChipTheme; ChipAnimationStyle supplies four nullable styles. Native original-body comparisons retain source state-side empty-state interpolation and invalid dual-null resolution. ThemeData supplies canonical Core icon and Material chip data. Checkbox/Radio/Switch theme data supplies all28 source fields, null-retaining copy/non-null empty lerp, numeric generic DartDouble carriers, property/side/shape/padding interpolation and equality/diagnostics. Three inherited themes use source value-based notification and nearest/global lookup. Private M3 defaults have full unchanged finite native source comparisons; original control State/paint/public API and tile wrappers remain separate. RawChip/Chip/Action/Choice/Filter/Input resolved public APIs, complete defaults and functional State/render/input/ink/tooltip/focus/semantics/animation owners are supplied on Core. Complete original private renderer/layout/hit/noncompositing paint and M3 defaults/background methods have independent finite native comparisons. Core AnimatedSwitcher retains keyed outgoing-child fade/layout/controller lifetime. Color/shape-only chip ink adapts the original outlined-border interior inset. Transport-only source semantics ids add no synthetic enabled flag; actual SDK nested DOM buttons dispatch only their owning semantic action. Source constructor assertions are enforced in host modes. Divider/VerticalDivider and DividerThemeData use source build/default/border-selection/copy/lerp/equality/diagnostic contracts on canonical Core Container/Border/InheritedTheme owners, including explicit zero-area hairlines and M3 outlineVariant. Twelve public numeric fields retain resolved analyzer provenance. ThemeData supplies source dividerTheme and M3 dividerColor defaults. Independent unchanged source-body/actual CPU pixel/RN Babel/public archive checks cover this selection. ListTile and its theme supply the resolved source public API and canonical enums, four-slot wet/dry/intrinsic/baseline/RTL/paint/hit decisions, selected M3 defaults, state color/cursor precedence, actual Material/Ink/focus/semantics ownership, source modern merge/wrap omissions, diagnostics and divideTiles. Obsolete ListTileTheme constructor/getter aliases are omitted. The private selected SafeArea composition consumes horizontal safe insets; it does not supply the full public SafeArea/SliverSafeArea API. IconButtonThemeData and inherited theme use the existing finite seven-field ButtonStyle ABI, whose supported field interpolation/equality/hash are supplied; arbitrary source ButtonStyle properties and IconButton widget remain open. Eight ListTile/theme nullable double fields preserve resolved provenance. Full native hierarchy/retained compositor/serialized diagnostics/swipe RefreshIndicator, every-shape paint/font and broader native/physical delivery remain open.',
  };
  const bytes = JSON.stringify(record, null, 2) + '\n';
  if (process.argv.includes('--check')) assert.equal(fs.readFileSync(file, 'utf8'), bytes, file);
  else fs.writeFileSync(file, bytes);
}
const coreFile = 'Nelyx/licenses/design-foundation-sources.json',
  coreRecord = {
    schema: 'nelyx.design-source-notices/v1',
    revision,
    license: 'BSD-3-Clause',
    notice: 'Flutter-LICENSE.md',
    noticeSha256: hash('Nelyx/licenses/Flutter-LICENSE.md'),
    additionalNotices: [
      { file: 'FlutterEngine-LICENSE.md', sha256: hash('Nelyx/licenses/FlutterEngine-LICENSE.md') },
      { file: 'Skia-LICENSE.md', sha256: hash('Nelyx/licenses/Skia-LICENSE.md') },
    ],
    skiaPathArcs: {
      revision: '3136abef8f582a75e9a2791261be3fe5f2f770d1',
      notice: 'Skia-LICENSE.md',
      sources: ['SkPathBuilder.cpp', 'SkGeometry.cpp', 'SkScalar.h', 'SkFloatingPoint.h'].map(
        (name) => ({ name, sha256: hash('.tmp/work8/w11-path-arc-sources/' + name) }),
      ),
    },
    sources: [
      'packages/flutter/lib/src/painting/colors.dart',
      'packages/flutter/lib/src/widgets/app.dart',
      'packages/flutter/lib/src/widgets/navigator.dart',
      'packages/flutter/lib/src/widgets/localizations.dart',
      'engine/src/flutter/lib/ui/platform_dispatcher.dart',
      'packages/flutter/lib/src/widgets/toggleable.dart',
      'packages/flutter/lib/src/widgets/radio_group.dart',
      'packages/flutter/lib/src/widgets/raw_radio.dart',
      'packages/flutter/lib/src/widgets/basic.dart',
      'packages/flutter/lib/src/cupertino/switch.dart',
      'packages/flutter/lib/src/material/switch.dart',
      'engine/src/flutter/lib/ui/painting.dart',
      'engine/src/flutter/lib/ui/painting/rrect.cc',
      'packages/flutter/lib/src/cupertino/slider.dart',
      'packages/flutter/lib/src/material/slider.dart',
      'engine/src/flutter/lib/ui/geometry.dart',
      'engine/src/flutter/lib/ui/painting/path.cc',
      'packages/flutter/lib/src/widgets/overlay.dart',
      'packages/flutter/lib/src/widgets/lookup_boundary.dart',
      'packages/flutter/lib/src/rendering/object.dart',
      'packages/flutter/lib/src/rendering/proxy_box.dart',
      'packages/flutter/lib/src/painting/circle_border.dart',
      'packages/flutter/lib/src/painting/stadium_border.dart',
      'packages/flutter/lib/src/painting/borders.dart',
      'packages/flutter/lib/src/widgets/icon_theme_data.dart',
      'packages/flutter/lib/src/widgets/icon_theme.dart',
      'packages/flutter/lib/src/widgets/icon_data.dart',
      'packages/flutter/lib/src/widgets/widget_state.dart',
      'packages/flutter/lib/src/widgets/icon.dart',
      'packages/flutter/lib/src/widgets/focus_scope.dart',
      'packages/flutter/lib/src/widgets/media_query.dart',
      'packages/flutter/lib/src/painting/text_scaler.dart',
      'packages/flutter/lib/src/widgets/raw_tooltip.dart',
      'packages/flutter/lib/src/painting/geometry.dart',
      'packages/flutter/lib/src/widgets/animated_switcher.dart',
    ].map((source) => ({ source, sha256: hash(root + '/' + source) })),
    ownership:
      'Core ColorShapeDecoration is the shared finite color/shape-only ShapeDecoration receiver used by Material chip/ListTile and Cupertino section on canonical border/path/canvas/painter owners. Full image/gradient/shadow/decoration APIs are not claimed by that adapter. Core WidgetStateColor and WidgetStateMouseCursor factories use canonical Core Color/cursor plus the generated generic property/mapper owner, source const default-state Set identity/immutability, canonical transparent Color, callback policies and live source maps; ordinary mapper color/cursor fields reject access. The multiple-interface bridge retains generated mapper storage/type witnesses and symmetric generic-map equality. Hash checks admit canonical values at each selected source map lookup, preserving mutation boundaries. Canonical MouseCursor virtual identity/system-value hash semantics are registered for generic source maps. Original factory/policy bodies are independently compared on finite receivers; native cursor channels are not newly qualified. Core AnimatedSwitcher uses current ticker/controller/curves/keyed subtree/fade/Stack owners, retaining multiple outgoing children and source callback layout contracts. Source-only semantics transport ids stay separate from legacy host annotations and do not synthesize enabled flags. Core border-side source Color adapters retain floating Color and reviewed nominal subclass receivers while preserving the ARGB8 paint ABI; exact final-Color capture remains strict. Core CustomPaint captures getter-backed Size width/height explicitly. Complete HSL/HSV and three hue helpers have resolved numeric8 fields, source debug assertions, const/root/value owners and native source comparisons. Explicit typed const Lists reuse the existing SourceList/type/value owner with boxed numeric admission, type-sensitive canonical identity and immutable mutation guards; general compiler const-list emission stays open. Core RawTooltip reuses actual View gesture/focus/ticker/semantics and bounded OverlayEntry owners with live target paint/hit/semantics geometry; exclusive mouse hit testing, timing cancellation and per-View Escape handlers retain source decisions. Source tooltip metadata is carried to SDK DOM aria-description. The complete emitted positionDependentBox body retains resolved numeric provenance and uses finite owning Core imports, including retained min/max carriers. Material Tooltip/theme/visibility use current Core owners and preserve source copy/lerp omissions. Core IconThemeData/IconTheme/IconData, Icon, state BorderSide factories/maps/lerp, StadiumBorder and both private transitions use existing Core value/diagnostic/theme/shape owners. BorderSide retains the owning floating Color between lerp/copy/scale/merge while exposing the existing ARGB8 paint ABI. Full original native data and Stadium/private geometry bodies are compared on explicit finite receivers; Icon composes actual RichText/semantics/direction/variation/foreground and source scaling; complete catalog fields use resolved integer provenance and canonical Core IconData, with original native body/constant comparisons. MediaQuery explicit nonlinear TextScaler notifies by source value equality and actual text uses that scaler. Source Focus/FocusScope build semantics omit debug labels, preserve scope explicit children and the iOS onFocus rule. Both original icon font/notice files are delivered as declared package-source assets through current SDK/Metro/CLI and real browser/Skia providers. JS/font tree shaking and full native/reader/physical supply remain open. Core LookupBoundary preserves actual Element/inherited/state/render visibility, explicit constructor tokens replace erased generic queries. CircleBorder and ShapeBorderClipper use existing ShapeBorder/Path/clip owners. The source paintsChild hook and zero-alpha RenderOpacity visibility qualify actual ink transform paths. Core ColorSwatch is an explicit functional TS port on the existing Color/Map ABI. Live source map, get key adapter, source key witnesses and lerp are preserved. Generic TS erasure needs an explicit type token/witness; host Map keeps JS key/iteration semantics. Stable local primary hash does not expose Dart VM map identity hash. Locale aliases are finite AST data from engine Locale; App locale and initial-route algorithms are functional ports on locale-tag/immutable Route ABI. AppFocus/routing and finite control input/state/position/radio-group compositions reuse Nelyx owners. Standard Material Checkbox supplies all19 constructor fields and M3 theme/state/size/shape/side/error decisions; full original checkbox and radial painter bodies are compared on finite receivers. Core ToggleableControl source motion provides exact selected-null, previous-value, easeIn/easeOut position and100/50ms reaction/focus/hover contracts over current control input/ticker owners. Complete changed Core input/toggle modules execute under RN Babel on canonical framework owners. CupertinoCheckbox supplies all14 nondeprecated fields,12 source defaults,14/44/custom tap sizes, full source gradient/check/dash/focus/press paint and direct value replacement without a position animation. Deprecated unused inactiveColor is removed. Checkbox.adaptive selects Cupertino on iOS/macOS with exact12 forwarded/seven ignored fields while preserving its outer State. Source toggle pointer input preserves existing focus; keyed reparent preserves in-flight motion and held interactions. Full Radio/Switch/list wrappers remain open. Generic RadioGroup uses an explicit type token. Source semantics properties can carry a stable Nelyx transportId; tap events use an explicit per-View messenger. Slider input policies share Core gesture/focus/ticker/state ownership and source bounded/unbounded height rules. Manually assembled source nodes retain explicit numeric ranges through transport without parsing labels. Original slider flags and formatted values survive transport; separate explicit numeric ranges reach browser ARIA without parsing display text. Source Size/Offset generic and const values require exact Core class capture. Retained num operations preserve resolved input carriers and reject raw-number provenance and unsafe integers. Overlay entry dirty/removal rebuilds defer across persistent frame phases and survive route retirement. Mark geometry is an Nelyx functional painter; full original shape/ink/haptic/motion APIs remain open. Canvas.drawArc and Path.addArc/arcTo use rational conics with pinned Skia float conversion/current-contour decisions on the existing path ABI with an explicit operation budget; inverted source RRect bounds normalize at paint capture as the pinned engine does. Full source hierarchy, default page motion, engine VM hashes and native delivery are not inferred.',
  };
const coreBytes = JSON.stringify(coreRecord, null, 2) + '\n';
if (process.argv.includes('--check'))
  assert.equal(fs.readFileSync(coreFile, 'utf8'), coreBytes, coreFile);
else fs.writeFileSync(coreFile, coreBytes);
console.log(
  JSON.stringify({
    status: 'PASS-scoped',
    revision,
    packages: 2,
    checkOnly: process.argv.includes('--check'),
  }),
);
