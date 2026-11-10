// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/dialog.dart; SHA256 22c88ffd00e0d7ed125f5f18f8936a7ee97ed808795599e9655e6567a7589fd8
import { protect } from '@nelyx/core/internal/ui/value-math';
import { invariant } from '@nelyx/core/foundation/errors';
import { FoundationBuildMode } from '@nelyx/core/foundation/constants';
import { dartLateInitialize } from '@nelyx/core/internal/foundation/dart-late';
import { Color } from '@nelyx/core/ui/color';
import { Radius } from '@nelyx/core/ui/radius';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { Widget } from '@nelyx/core/framework/widgets/framework';
import { Key } from '@nelyx/core/foundation/key';
import { Curves } from '@nelyx/core/framework/animation/curves';
import { Curve } from '@nelyx/core/framework/animation/curves';
import { scrollbarRawObjectEquals } from '@nelyx/core/internal/framework/widgets/scrollbar-raw-source-adapter';
import { boxSourceDartInt } from '@nelyx/core/internal/foundation/dart-numeric';
import { ScrollbarStatelessHost } from '@nelyx/core/internal/framework/widgets/scrollbar-themed-source-adapter';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { MaterialType } from '../material/material-values.generated.ts';
import { Material } from '../../material.ts';
import { ShapeBorder } from '@nelyx/core/framework/painting/borders';
import { Alignment } from '@nelyx/core/framework/painting/alignment';
import { AlignmentGeometry } from '@nelyx/core/framework/painting/alignment';
import { TextTheme } from '../../text-theme.ts';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { DialogThemeData } from '../../dialog-theme-data.ts';
import { DialogTheme } from '../../dialog-theme.ts';
import { AnimatedPadding } from '@nelyx/core/framework/widgets/implicit-animations';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { RoundedRectangleBorder } from '@nelyx/core/framework/painting/rounded-rectangle-border';
import { IconThemeData } from '@nelyx/core/framework/widgets/icon-theme-data';
import { Colors } from '../colors/colors.generated.ts';
import { dateAlign } from '../../internal/date/source-host.ts';
import { dateConstrainedBox } from '../../internal/date/source-host.ts';
import { SemanticsRole } from '@nelyx/core/ui/semantics';
import { dateColorSwatch } from '../../internal/date/source-host.ts';
import { dateRemoveViewInsets } from '../../internal/date/source-host.ts';
import { constDateEdgeInsetsOnly } from '../../internal/date/source-host.ts';
import { constDateEdgeInsetsSymmetric } from '../../internal/date/source-host.ts';
import { constDateBoxConstraints } from '../../internal/date/source-host.ts';
import { constDateRoundedRectangleBorder } from '../../internal/date/source-host.ts';
import { constDateBorderRadiusAll } from '../../internal/date/source-host.ts';
import { constDateRadiusCircular } from '../../internal/date/source-host.ts';
import { SourceDateThemeData } from '../../internal/date/source-theme.ts';
import { SourceDateColorScheme } from '../../internal/date/source-theme.ts';
import { SourceDateTheme } from '../../internal/date/source-theme.ts';
import type { BuildContext } from '@nelyx/core/framework/widgets/framework';
import type { Clip } from '@nelyx/core/ui/clip';
export const _defaultInsetPadding: EdgeInsets = constDateEdgeInsetsSymmetric(EdgeInsets, {
  horizontal: 40,
  vertical: 24,
});
export class Dialog extends ScrollbarStatelessHost {
  readonly backgroundColor: Color | null;
  /**
   * @dartType double?
   * @dartTypeOrigin explicit
   */
  readonly elevation: number | null;
  readonly shadowColor: Color | null;
  readonly surfaceTintColor: Color | null;
  readonly insetAnimationDuration: number;
  readonly insetAnimationCurve: Curve;
  readonly insetPadding: EdgeInsets | null;
  readonly clipBehavior: Clip | null;
  readonly shape: ShapeBorder | null;
  readonly alignment: AlignmentGeometry | null;
  readonly child: Widget | null;
  readonly _dart_1e081a14de75f374_fullscreen: boolean;
  readonly semanticsRole: SemanticsRole;
  readonly constraints: BoxConstraints | null;
  /**
   * @dartParam elevation double?
   * @dartParamOrigin elevation inferred
   */
  constructor({
    key = null,
    backgroundColor = null,
    elevation = null,
    shadowColor = null,
    surfaceTintColor = null,
    insetAnimationDuration = 0 + 100 * 1,
    insetAnimationCurve = Curves.decelerate,
    insetPadding = null,
    clipBehavior = null,
    shape = null,
    alignment = null,
    child = null,
    semanticsRole = SemanticsRole.dialog,
    constraints = null,
  }: {
    readonly key?: Key | null;
    readonly backgroundColor?: Color | null;
    readonly elevation?: number | null;
    readonly shadowColor?: Color | null;
    readonly surfaceTintColor?: Color | null;
    readonly insetAnimationDuration?: number;
    readonly insetAnimationCurve?: Curve;
    readonly insetPadding?: EdgeInsets | null;
    readonly clipBehavior?: Clip | null;
    readonly shape?: ShapeBorder | null;
    readonly alignment?: AlignmentGeometry | null;
    readonly child?: Widget | null;
    readonly semanticsRole?: SemanticsRole;
    readonly constraints?: BoxConstraints | null;
  } = {}) {
    const _initialField0 = backgroundColor;
    /**
     * @dartType double?
     * @dartTypeOrigin inferred
     */
    const _initialField1 = elevation;
    const _initialField2 = shadowColor;
    const _initialField3 = surfaceTintColor;
    const _initialField4 = insetAnimationDuration;
    const _initialField5 = insetAnimationCurve;
    const _initialField6 = insetPadding;
    const _initialField7 = clipBehavior;
    const _initialField8 = shape;
    const _initialField9 = alignment;
    const _initialField10 = child;
    const _initialField11 = semanticsRole;
    const _initialField12 = constraints;
    if (FoundationBuildMode.debug)
      invariant(
        elevation === null || (elevation as number) >= 0,
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    const _initialField13 = false;
    super({ key: key });
    this.backgroundColor = _initialField0;
    this.elevation = _initialField1;
    this.shadowColor = _initialField2;
    this.surfaceTintColor = _initialField3;
    this.insetAnimationDuration = _initialField4;
    this.insetAnimationCurve = _initialField5;
    this.insetPadding = _initialField6;
    this.clipBehavior = _initialField7;
    this.shape = _initialField8;
    this.alignment = _initialField9;
    this.child = _initialField10;
    this._dart_1e081a14de75f374_fullscreen = _initialField13;
    this.semanticsRole = _initialField11;
    this.constraints = _initialField12;
    protect(this, [
      'backgroundColor',
      'elevation',
      'shadowColor',
      'surfaceTintColor',
      'insetAnimationDuration',
      'insetAnimationCurve',
      'insetPadding',
      'clipBehavior',
      'shape',
      'alignment',
      'child',
      '_dart_1e081a14de75f374_fullscreen',
      'semanticsRole',
      'constraints',
    ]);
  }
  override build(context: BuildContext): Widget {
    const theme: SourceDateThemeData = SourceDateTheme.of(context);
    const dialogTheme: DialogThemeData = DialogTheme.of(context);
    const effectivePadding: EdgeInsets = MediaQuery.viewInsetsOf(context).add(
      this.insetPadding ?? dialogTheme.insetPadding ?? _defaultInsetPadding,
    );
    const defaults: DialogThemeData = theme.useMaterial3
      ? this._dart_1e081a14de75f374_fullscreen
        ? new _DialogFullscreenDefaultsM3(context)
        : new _DialogDefaultsM3(context)
      : new _DialogDefaultsM2(context);
    const boxConstraints: BoxConstraints =
      this.constraints ??
      dialogTheme.constraints ??
      constDateBoxConstraints(BoxConstraints, { minWidth: 280 });
    let dialogChild: Widget;
    if (this._dart_1e081a14de75f374_fullscreen) {
      void (dialogChild = new Material({
        color: this.backgroundColor ?? dialogTheme.backgroundColor ?? defaults.backgroundColor,
        child: this.child,
      }));
    } else {
      void (dialogChild = dateAlign({
        alignment:
          this.alignment ??
          dialogTheme.alignment ??
          (() => {
            const _dartTemporary0 = defaults.alignment;
            if (_dartTemporary0 === null)
              throw new TypeError('Null check operator used on a null value');
            return _dartTemporary0!;
          })(),
        child: dateConstrainedBox({
          constraints: boxConstraints,
          child: new Material({
            color: this.backgroundColor ?? dialogTheme.backgroundColor ?? defaults.backgroundColor,
            elevation:
              this.elevation ??
              dialogTheme.elevation ??
              (() => {
                const _dartTemporary1 = defaults.elevation;
                if (_dartTemporary1 === null)
                  throw new TypeError('Null check operator used on a null value');
                return _dartTemporary1!;
              })(),
            shadowColor: this.shadowColor ?? dialogTheme.shadowColor ?? defaults.shadowColor,
            surfaceTintColor:
              this.surfaceTintColor ?? dialogTheme.surfaceTintColor ?? defaults.surfaceTintColor,
            shape:
              this.shape ??
              dialogTheme.shape ??
              (() => {
                const _dartTemporary2 = defaults.shape;
                if (_dartTemporary2 === null)
                  throw new TypeError('Null check operator used on a null value');
                return _dartTemporary2!;
              })(),
            type: MaterialType.card,
            clipBehavior:
              this.clipBehavior ??
              dialogTheme.clipBehavior ??
              (() => {
                const _dartTemporary3 = defaults.clipBehavior;
                if (_dartTemporary3 === null)
                  throw new TypeError('Null check operator used on a null value');
                return _dartTemporary3!;
              })(),
            child: this.child,
          }),
        }),
      }));
    }
    return new Semantics({
      role: this.semanticsRole,
      child: new AnimatedPadding({
        padding: effectivePadding,
        duration: this.insetAnimationDuration,
        curve: this.insetAnimationCurve,
        child: dateRemoveViewInsets({
          removeLeft: true,
          removeTop: true,
          removeRight: true,
          removeBottom: true,
          context: context,
          child: dialogChild,
        }),
      }),
    });
  }
  static fullscreen({
    key = null,
    backgroundColor = null,
    insetAnimationDuration = 0,
    insetAnimationCurve = Curves.decelerate,
    child = null,
    semanticsRole = SemanticsRole.dialog,
  }: {
    readonly key?: Key | null;
    readonly backgroundColor?: Color | null;
    readonly insetAnimationDuration?: number;
    readonly insetAnimationCurve?: Curve;
    readonly child?: Widget | null;
    readonly semanticsRole?: SemanticsRole;
  } = {}): Dialog {
    return _dartTemporary4({
      key,
      backgroundColor,
      insetAnimationDuration,
      insetAnimationCurve,
      child,
      semanticsRole,
    });
  }
}
function _dartTemporary4({
  key = null,
  backgroundColor = null,
  insetAnimationDuration = 0,
  insetAnimationCurve = Curves.decelerate,
  child = null,
  semanticsRole = SemanticsRole.dialog,
}: {
  readonly key?: Key | null;
  readonly backgroundColor?: Color | null;
  readonly insetAnimationDuration?: number;
  readonly insetAnimationCurve?: Curve;
  readonly child?: Widget | null;
  readonly semanticsRole?: SemanticsRole;
} = {}): Dialog {
  const _initialField0 = backgroundColor;
  const _initialField1 = insetAnimationDuration;
  const _initialField2 = insetAnimationCurve;
  const _initialField3 = child;
  const _initialField4 = semanticsRole;
  /**
   * @dartType double
   * @dartTypeOrigin inferred
   */
  const _initialField5 = 0;
  const _initialField6 = null;
  const _initialField7 = null;
  const _initialField8 = EdgeInsets.zero;
  const _initialField9 = 'none';
  const _initialField10 = null;
  const _initialField11 = null;
  const _initialField12 = null;
  const _initialField13 = true;
  const _dartTemporary5: InstanceType<typeof ScrollbarStatelessHost> & {
    backgroundColor: Color | null;
    elevation: number | null;
    shadowColor: Color | null;
    surfaceTintColor: Color | null;
    insetAnimationDuration: number;
    insetAnimationCurve: Curve;
    insetPadding: EdgeInsets | null;
    clipBehavior: Clip | null;
    shape: ShapeBorder | null;
    alignment: AlignmentGeometry | null;
    child: Widget | null;
    _dart_1e081a14de75f374_fullscreen: boolean;
    semanticsRole: SemanticsRole;
    constraints: BoxConstraints | null;
  } = Reflect.construct(
    ScrollbarStatelessHost,
    [{ key: key }] satisfies ConstructorParameters<typeof ScrollbarStatelessHost>,
    Dialog,
  ) as InstanceType<typeof ScrollbarStatelessHost> & {
    backgroundColor: Color | null;
    elevation: number | null;
    shadowColor: Color | null;
    surfaceTintColor: Color | null;
    insetAnimationDuration: number;
    insetAnimationCurve: Curve;
    insetPadding: EdgeInsets | null;
    clipBehavior: Clip | null;
    shape: ShapeBorder | null;
    alignment: AlignmentGeometry | null;
    child: Widget | null;
    _dart_1e081a14de75f374_fullscreen: boolean;
    semanticsRole: SemanticsRole;
    constraints: BoxConstraints | null;
  };
  _dartTemporary5.backgroundColor = _initialField0;
  _dartTemporary5.elevation = _initialField5;
  _dartTemporary5.shadowColor = _initialField6;
  _dartTemporary5.surfaceTintColor = _initialField7;
  _dartTemporary5.insetAnimationDuration = _initialField1;
  _dartTemporary5.insetAnimationCurve = _initialField2;
  _dartTemporary5.insetPadding = _initialField8;
  _dartTemporary5.clipBehavior = _initialField9;
  _dartTemporary5.shape = _initialField10;
  _dartTemporary5.alignment = _initialField11;
  _dartTemporary5.child = _initialField3;
  _dartTemporary5._dart_1e081a14de75f374_fullscreen = _initialField13;
  _dartTemporary5.semanticsRole = _initialField4;
  _dartTemporary5.constraints = _initialField12;
  protect(_dartTemporary5, [
    'backgroundColor',
    'elevation',
    'shadowColor',
    'surfaceTintColor',
    'insetAnimationDuration',
    'insetAnimationCurve',
    'insetPadding',
    'clipBehavior',
    'shape',
    'alignment',
    'child',
    '_dart_1e081a14de75f374_fullscreen',
    'semanticsRole',
    'constraints',
  ]);
  return _dartTemporary5 as Dialog;
}
export class _DialogDefaultsM2 extends DialogThemeData {
  readonly context: BuildContext;
  get theme(): SourceDateThemeData {
    return dartLateInitialize<SourceDateThemeData>(
      this,
      'package:flutter/src/material/dialog.dart::_DialogDefaultsM2.theme:FIELD',
      'theme',
      () => SourceDateTheme.of(this.context),
      true,
    );
  }
  get textTheme(): TextTheme {
    return dartLateInitialize<TextTheme>(
      this,
      'package:flutter/src/material/dialog.dart::_DialogDefaultsM2.textTheme:FIELD',
      'textTheme',
      () => this.theme.textTheme,
      true,
    );
  }
  get iconTheme(): IconThemeData {
    return dartLateInitialize<IconThemeData>(
      this,
      'package:flutter/src/material/dialog.dart::_DialogDefaultsM2.iconTheme:FIELD',
      'iconTheme',
      () => this.theme.iconTheme,
      true,
    );
  }
  constructor(context: BuildContext) {
    const _initialField0 = context;
    super({
      alignment: Alignment.center,
      elevation: 24,
      shape: constDateRoundedRectangleBorder(RoundedRectangleBorder, {
        borderRadius: constDateBorderRadiusAll(BorderRadius, constDateRadiusCircular(Radius, 4)),
      }),
      clipBehavior: 'none',
    });
    this.context = _initialField0;
    protect(this, ['context']);
  }
  override get iconColor(): Color | null {
    return this.iconTheme.color;
  }
  override get backgroundColor(): Color | null {
    return scrollbarRawObjectEquals(this.theme.brightness, 'dark')
      ? (() => {
          const _dartTemporary6 = dateColorSwatch(Colors.grey, boxSourceDartInt(800));
          if (_dartTemporary6 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary6!;
        })()
      : Colors.white;
  }
  override get shadowColor(): Color | null {
    return this.theme.shadowColor;
  }
  override get titleTextStyle(): TextStyle | null {
    return this.textTheme.titleLarge;
  }
  override get contentTextStyle(): TextStyle | null {
    return this.textTheme.titleMedium;
  }
  override get actionsPadding(): EdgeInsetsGeometry | null {
    return EdgeInsets.zero;
  }
}
export class _DialogFullscreenDefaultsM3 extends DialogThemeData {
  readonly context: BuildContext;
  constructor(context: BuildContext) {
    const _initialField0 = context;
    super({ clipBehavior: 'none' });
    this.context = _initialField0;
    protect(this, ['context']);
  }
  override get backgroundColor(): Color | null {
    return SourceDateTheme.of(this.context).colorScheme.surface;
  }
}
export class _DialogDefaultsM3 extends DialogThemeData {
  readonly context: BuildContext;
  get _dart_1e081a14de75f374_colors(): SourceDateColorScheme {
    return dartLateInitialize<SourceDateColorScheme>(
      this,
      'package:flutter/src/material/dialog.dart::_DialogDefaultsM3._colors:FIELD',
      '_colors',
      () => SourceDateTheme.of(this.context).colorScheme,
      true,
    );
  }
  get _dart_1e081a14de75f374_textTheme(): TextTheme {
    return dartLateInitialize<TextTheme>(
      this,
      'package:flutter/src/material/dialog.dart::_DialogDefaultsM3._textTheme:FIELD',
      '_textTheme',
      () => SourceDateTheme.of(this.context).textTheme,
      true,
    );
  }
  constructor(context: BuildContext) {
    const _initialField0 = context;
    super({
      alignment: Alignment.center,
      elevation: 6,
      shape: constDateRoundedRectangleBorder(RoundedRectangleBorder, {
        borderRadius: constDateBorderRadiusAll(BorderRadius, constDateRadiusCircular(Radius, 28)),
      }),
      clipBehavior: 'none',
    });
    this.context = _initialField0;
    protect(this, ['context']);
  }
  override get iconColor(): Color | null {
    return this._dart_1e081a14de75f374_colors.secondary;
  }
  override get backgroundColor(): Color | null {
    return this._dart_1e081a14de75f374_colors.surfaceContainerHigh;
  }
  override get shadowColor(): Color | null {
    return Colors.transparent;
  }
  override get surfaceTintColor(): Color | null {
    return Colors.transparent;
  }
  override get titleTextStyle(): TextStyle | null {
    return this._dart_1e081a14de75f374_textTheme.headlineSmall;
  }
  override get contentTextStyle(): TextStyle | null {
    return this._dart_1e081a14de75f374_textTheme.bodyMedium;
  }
  override get actionsPadding(): EdgeInsetsGeometry | null {
    return constDateEdgeInsetsOnly(EdgeInsets, { left: 24, right: 24, bottom: 24 });
  }
}
