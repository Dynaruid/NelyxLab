// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/widgets/stretch_effect.dart; SHA256 456b8578d63dc8fdce5fc9e182ade7281028e71f1c9af610e3432021d17019e4
import { protect } from '../../ui/value-math.ts';
import { invariant } from '../../foundation/errors.ts';
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { dartStaticRead } from '../../foundation/dart-static-field.ts';
import { dartStaticWrite } from '../../foundation/dart-static-field.ts';
import { dartStaticSeal } from '../../foundation/dart-static-field.ts';
import { Color } from '../../ui/color.ts';
import { Canvas } from '../../ui/canvas.ts';
import { Offset } from '../../ui/offset.ts';
import { Size } from '../../ui/size.ts';
import { ScrollbarSourcePaint } from './scrollbar-painter-source-adapter.ts';
import { scrollbarIsPainter } from './scrollbar-painter-source-adapter.ts';
import { State } from './framework.ts';
import { Widget } from './framework.ts';
import { Key } from '../../foundation/key.ts';
import { Axis } from '../painting/basic-types.ts';
import { ScrollbarStatefulHost } from './scrollbar-raw-source-adapter.ts';
import { Directionality } from './app-data.ts';
import { applyDartType } from '../../foundation/dart-type-witness.ts';
import { captureDartType } from '../../foundation/dart-type-witness.ts';
import { scrollbarStatefulType } from './scrollbar-raw-source-adapter.ts';
import { scrollbarStateType } from './scrollbar-raw-source-adapter.ts';
import { scrollbarRawObjectEquals } from './scrollbar-raw-source-adapter.ts';
import { ScrollbarStatelessHost } from './scrollbar-themed-source-adapter.ts';
import { AlignmentDirectional } from '../painting/alignment.ts';
import { ImageFilter } from '../../ui/image-filter.ts';
import { StretchFragmentProgram } from './stretch-source-adapter.ts';
import { stretchTransform } from './stretch-source-adapter.ts';
import { stretchImageFiltered } from './stretch-source-adapter.ts';
import { stretchCustomPaint } from './stretch-source-adapter.ts';
import { scrollbarStatelessType } from './scrollbar-themed-source-adapter.ts';
import { CustomPainter } from '../rendering/custom-paint.ts';
import { stretchPainterType } from './stretch-source-adapter.ts';
import { constSourceColorARGB } from '../../ui/color-source-adapter.ts';
import { Matrix4 } from '../../math/matrix4.ts';
import { stretchDrawPoints } from './stretch-source-adapter.ts';
import { StretchStateHost } from './stretch-source-adapter.ts';
import type { ScrollbarTextDirection } from './scrollbar-painter-source-adapter.ts';
import type { BuildContext } from './framework.ts';
import type { AlignmentGeometry } from '../painting/alignment.ts';
import type { StretchFragmentShader } from './stretch-source-adapter.ts';
export class StretchEffect extends ScrollbarStatelessHost {
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  readonly stretchStrength: number;
  readonly axis: Axis;
  readonly child: Widget;
  /**
   * @dartParam stretchStrength double
   * @dartParamOrigin stretchStrength inferred
   */
  constructor({
    key = null,
    stretchStrength = 0,
    axis,
    child,
  }: {
    readonly key?: Key | null;
    readonly stretchStrength?: number;
    readonly axis: Axis;
    readonly child: Widget;
  }) {
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const _initialField0 = stretchStrength;
    const _initialField1 = axis;
    const _initialField2 = child;
    if (FoundationBuildMode.debug)
      invariant(
        stretchStrength >= -1 && stretchStrength <= 1,
        'generated-source-assert',
        'stretchStrength must be between -1.0 and 1.0',
      );
    super({ key: key });
    captureDartType(
      this,
      applyDartType<StretchEffect>(StretchEffect, 'StretchEffect', [], [scrollbarStatelessType]),
    );
    this.stretchStrength = _initialField0;
    this.axis = _initialField1;
    this.child = _initialField2;
    protect(this, ['stretchStrength', 'axis', 'child']);
  }
  _dart_68e9b32ef498cec4_getAlignment(direction: ScrollbarTextDirection): AlignmentGeometry {
    const isForward: boolean = this.stretchStrength > 0;
    if (scrollbarRawObjectEquals(this.axis, Axis.vertical)) {
      return isForward ? AlignmentDirectional.topCenter : AlignmentDirectional.bottomCenter;
    }
    if (scrollbarRawObjectEquals(direction, 'rtl')) {
      return isForward ? AlignmentDirectional.centerEnd : AlignmentDirectional.centerStart;
    } else {
      return isForward ? AlignmentDirectional.centerStart : AlignmentDirectional.centerEnd;
    }
  }
  override build(context: BuildContext): Widget {
    if (ImageFilter.isShaderFilterSupported) {
      return new SourceStretchOverscrollEffect({
        stretchStrength: this.stretchStrength,
        axis: this.axis,
        child: this.child,
      });
    }
    const textDirection: ScrollbarTextDirection = Directionality.of(context);
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    let x: number = 1;
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    let y: number = 1;
    switch (this.axis) {
      case Axis.horizontal: {
        x += Math.abs(this.stretchStrength);
        break;
      }
      case Axis.vertical: {
        y += Math.abs(this.stretchStrength);
        break;
      }
      default:
        throw new TypeError('Invalid value outside exhaustive Dart switch');
    }
    return stretchTransform({
      alignment: this._dart_68e9b32ef498cec4_getAlignment(textDirection),
      transform: Matrix4.diagonal3Values(x, y, 1),
      filterQuality: this.stretchStrength === 0 ? null : 'medium',
      child: this.child,
    });
  }
}
export class SourceStretchOverscrollEffect extends ScrollbarStatefulHost {
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  readonly stretchStrength: number;
  readonly axis: Axis;
  readonly child: Widget;
  /**
   * @dartParam stretchStrength double
   * @dartParamOrigin stretchStrength inferred
   */
  constructor({
    stretchStrength = 0,
    axis,
    child,
  }: {
    readonly stretchStrength?: number;
    readonly axis: Axis;
    readonly child: Widget;
  }) {
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const _initialField0 = stretchStrength;
    const _initialField1 = axis;
    const _initialField2 = child;
    if (FoundationBuildMode.debug)
      invariant(
        stretchStrength >= -1 && stretchStrength <= 1,
        'generated-source-assert',
        'stretchStrength must be between -1.0 and 1.0',
      );
    super();
    captureDartType(
      this,
      applyDartType<SourceStretchOverscrollEffect>(
        SourceStretchOverscrollEffect,
        '_StretchOverscrollEffect',
        [],
        [scrollbarStatefulType],
      ),
    );
    this.stretchStrength = _initialField0;
    this.axis = _initialField1;
    this.child = _initialField2;
    protect(this, ['stretchStrength', 'axis', 'child']);
  }
  override createState(): State<SourceStretchOverscrollEffect> {
    return new SourceStretchOverscrollEffectState();
  }
}
export class SourceStretchOverscrollEffectState extends StretchStateHost<SourceStretchOverscrollEffect> {
  _dart_68e9b32ef498cec4_fragmentShader: StretchFragmentShader | null;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  static readonly maxStretchIntensity: number = 1;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  static readonly interpolationStrength: number = 0.7;
  static get _dart_68e9b32ef498cec4_emptyFilter(): ImageFilter {
    return dartStaticRead<ImageFilter>(
      SourceStretchOverscrollEffectState,
      'package:flutter/src/widgets/stretch_effect.dart::_StretchOverscrollEffectState._emptyFilter:FIELD',
      (): ImageFilter => ImageFilter.matrix(Matrix4.identity().storage),
    );
  }
  constructor() {
    super();
    captureDartType(
      this,
      applyDartType<SourceStretchOverscrollEffectState>(
        SourceStretchOverscrollEffectState,
        '_StretchOverscrollEffectState',
        [],
        [
          scrollbarStateType<SourceStretchOverscrollEffect>(
            applyDartType<SourceStretchOverscrollEffect>(
              SourceStretchOverscrollEffect,
              '_StretchOverscrollEffect',
              [],
              [scrollbarStatefulType],
            ),
          ),
        ],
      ),
    );
    this._dart_68e9b32ef498cec4_fragmentShader = null;
  }
  override dispose(): void {
    void (this._dart_68e9b32ef498cec4_fragmentShader?.dispose() ?? null);
    super.dispose();
  }
  override initState(): void {
    super.initState();
    SourceStretchEffectShader.initializeShader();
  }
  override build(context: BuildContext): Widget {
    const isShaderNeeded: boolean = Math.abs(this.widget.stretchStrength) > 1e-10;
    let imageFilter: ImageFilter;
    if (SourceStretchEffectShader._dart_68e9b32ef498cec4_initialized) {
      void (this._dart_68e9b32ef498cec4_fragmentShader?.dispose() ?? null);
      this._dart_68e9b32ef498cec4_fragmentShader = (() => {
        const _dartTemporary0 = SourceStretchEffectShader._dart_68e9b32ef498cec4_program;
        if (_dartTemporary0 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary0!;
      })().fragmentShader();
      (() => {
        const _dartTemporary1 = this._dart_68e9b32ef498cec4_fragmentShader;
        if (_dartTemporary1 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary1!;
      })().setFloat(2, SourceStretchOverscrollEffectState.maxStretchIntensity);
      if (scrollbarRawObjectEquals(this.widget.axis, Axis.vertical)) {
        (() => {
          const _dartTemporary2 = this._dart_68e9b32ef498cec4_fragmentShader;
          if (_dartTemporary2 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary2!;
        })().setFloat(3, 0);
        (() => {
          const _dartTemporary3 = this._dart_68e9b32ef498cec4_fragmentShader;
          if (_dartTemporary3 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary3!;
        })().setFloat(4, this.widget.stretchStrength);
      } else {
        (() => {
          const _dartTemporary4 = this._dart_68e9b32ef498cec4_fragmentShader;
          if (_dartTemporary4 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary4!;
        })().setFloat(3, this.widget.stretchStrength);
        (() => {
          const _dartTemporary5 = this._dart_68e9b32ef498cec4_fragmentShader;
          if (_dartTemporary5 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary5!;
        })().setFloat(4, 0);
      }
      (() => {
        const _dartTemporary6 = this._dart_68e9b32ef498cec4_fragmentShader;
        if (_dartTemporary6 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary6!;
      })().setFloat(5, SourceStretchOverscrollEffectState.interpolationStrength);
      imageFilter = ImageFilter.shader(
        (() => {
          const _dartTemporary7 = this._dart_68e9b32ef498cec4_fragmentShader;
          if (_dartTemporary7 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary7!;
        })(),
      );
    } else {
      void (this._dart_68e9b32ef498cec4_fragmentShader?.dispose() ?? null);
      this._dart_68e9b32ef498cec4_fragmentShader = null;
      imageFilter = SourceStretchOverscrollEffectState._dart_68e9b32ef498cec4_emptyFilter;
    }
    return stretchImageFiltered({
      imageFilter: imageFilter,
      enabled: isShaderNeeded,
      child: stretchCustomPaint({
        painter: isShaderNeeded ? new SourceStretchEffectPainter() : null,
        child: this.widget.child,
      }),
    });
  }
}
protect(SourceStretchOverscrollEffectState, ['maxStretchIntensity', 'interpolationStrength']);
dartStaticSeal(SourceStretchOverscrollEffectState, ['_dart_68e9b32ef498cec4_emptyFilter']);
export class SourceStretchEffectPainter extends CustomPainter {
  constructor() {
    super();
    captureDartType(
      this,
      applyDartType<SourceStretchEffectPainter>(
        SourceStretchEffectPainter,
        '_StretchEffectPainter',
        [],
        [stretchPainterType],
      ),
    );
  }
  override paint(canvas: Canvas, size: Size): void {
    const paint: ScrollbarSourcePaint = (() => {
      const _dartTemporary8 = new ScrollbarSourcePaint();
      _dartTemporary8.sourceColor = constSourceColorARGB(Color, 1, 0, 0, 0);
      _dartTemporary8.style = 'fill';
      return _dartTemporary8;
    })();
    stretchDrawPoints(
      canvas,
      'points',
      [
        Offset.zero,
        new Offset(size.width - 1, 0),
        new Offset(0, size.height - 1),
        new Offset(size.width - 1, size.height - 1),
      ],
      paint,
    );
  }
  override shouldRepaint(oldDelegate: CustomPainter): boolean {
    if (!scrollbarIsPainter(oldDelegate))
      throw new TypeError('Invalid covariant argument: oldDelegate');
    return false;
  }
}
export class SourceStretchEffectShader {
  static get _dart_68e9b32ef498cec4_initCalled(): boolean {
    return dartStaticRead<boolean>(
      SourceStretchEffectShader,
      'package:flutter/src/widgets/stretch_effect.dart::_StretchEffectShader._initCalled:FIELD',
      (): boolean => false,
    );
  }
  static set _dart_68e9b32ef498cec4_initCalled(value: boolean) {
    dartStaticWrite<boolean>(
      SourceStretchEffectShader,
      'package:flutter/src/widgets/stretch_effect.dart::_StretchEffectShader._initCalled:FIELD',
      value,
    );
  }
  static get _dart_68e9b32ef498cec4_initialized(): boolean {
    return dartStaticRead<boolean>(
      SourceStretchEffectShader,
      'package:flutter/src/widgets/stretch_effect.dart::_StretchEffectShader._initialized:FIELD',
      (): boolean => false,
    );
  }
  static set _dart_68e9b32ef498cec4_initialized(value: boolean) {
    dartStaticWrite<boolean>(
      SourceStretchEffectShader,
      'package:flutter/src/widgets/stretch_effect.dart::_StretchEffectShader._initialized:FIELD',
      value,
    );
  }
  static get _dart_68e9b32ef498cec4_program(): StretchFragmentProgram | null {
    return dartStaticRead<StretchFragmentProgram | null>(
      SourceStretchEffectShader,
      'package:flutter/src/widgets/stretch_effect.dart::_StretchEffectShader._program:FIELD',
      (): StretchFragmentProgram | null => null,
    );
  }
  static set _dart_68e9b32ef498cec4_program(value: StretchFragmentProgram | null) {
    dartStaticWrite<StretchFragmentProgram | null>(
      SourceStretchEffectShader,
      'package:flutter/src/widgets/stretch_effect.dart::_StretchEffectShader._program:FIELD',
      value,
    );
  }
  constructor() {
    captureDartType(
      this,
      applyDartType<SourceStretchEffectShader>(
        SourceStretchEffectShader,
        '_StretchEffectShader',
        [],
        [],
      ),
    );
  }
  static initializeShader(): void {
    if (!SourceStretchEffectShader._dart_68e9b32ef498cec4_initCalled) {
      StretchFragmentProgram.fromAsset('shaders/stretch_effect.frag').then(
        (program: StretchFragmentProgram): null => {
          SourceStretchEffectShader._dart_68e9b32ef498cec4_program = program;
          SourceStretchEffectShader._dart_68e9b32ef498cec4_initialized = true;
          return null;
        },
      );
      SourceStretchEffectShader._dart_68e9b32ef498cec4_initCalled = true;
    }
  }
}
dartStaticSeal(SourceStretchEffectShader, [
  '_dart_68e9b32ef498cec4_initCalled',
  '_dart_68e9b32ef498cec4_initialized',
  '_dart_68e9b32ef498cec4_program',
]);
