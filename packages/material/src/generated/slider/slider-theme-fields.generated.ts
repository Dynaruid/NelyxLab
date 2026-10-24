// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated field/type projection from pinned analyzer-resolved IR. Methods live in slider-theme.ts.
import type {Color} from '@nelyx/core/ui/color';import type {Size} from '@nelyx/core/ui/size';import type {TextStyle} from '@nelyx/core/framework/painting/text-style';import type {EdgeInsetsGeometry} from '@nelyx/core/framework/painting/edge-insets';import type {MouseCursor} from '@nelyx/core/services/mouse-cursor';import type {WidgetStateProperty} from '@nelyx/core/framework/widgets/widget-state';import type {SliderInteraction} from './slider-values.generated.ts';
import type {SliderComponentShape,SliderTickMarkShape,SliderTrackShape,RangeSliderTickMarkShape,RangeSliderThumbShape,RangeSliderTrackShape,RangeSliderValueIndicatorShape} from "../../slider-shapes.ts";import type {RangeThumbSelector} from "../../range-slider-values.ts";import type {ShowValueIndicator} from './slider-theme-values.generated.ts';
export interface SliderThemeOptions {
 /** @dartType double? */
 readonly trackHeight?:number|null;
 readonly activeTrackColor?:Color|null;
 readonly inactiveTrackColor?:Color|null;
 readonly secondaryActiveTrackColor?:Color|null;
 readonly disabledActiveTrackColor?:Color|null;
 readonly disabledSecondaryActiveTrackColor?:Color|null;
 readonly disabledInactiveTrackColor?:Color|null;
 readonly activeTickMarkColor?:Color|null;
 readonly inactiveTickMarkColor?:Color|null;
 readonly disabledActiveTickMarkColor?:Color|null;
 readonly disabledInactiveTickMarkColor?:Color|null;
 readonly thumbColor?:Color|null;
 readonly overlappingShapeStrokeColor?:Color|null;
 readonly disabledThumbColor?:Color|null;
 readonly overlayColor?:Color|null;
 readonly valueIndicatorColor?:Color|null;
 readonly valueIndicatorStrokeColor?:Color|null;
 readonly overlayShape?:SliderComponentShape|null;
 readonly tickMarkShape?:SliderTickMarkShape|null;
 readonly thumbShape?:SliderComponentShape|null;
 readonly trackShape?:SliderTrackShape|null;
 readonly valueIndicatorShape?:SliderComponentShape|null;
 readonly rangeTickMarkShape?:RangeSliderTickMarkShape|null;
 readonly rangeThumbShape?:RangeSliderThumbShape|null;
 readonly rangeTrackShape?:RangeSliderTrackShape|null;
 readonly rangeValueIndicatorShape?:RangeSliderValueIndicatorShape|null;
 readonly showValueIndicator?:ShowValueIndicator|null;
 readonly valueIndicatorTextStyle?:TextStyle|null;
 /** @dartType double? */
 readonly minThumbSeparation?:number|null;
 /** @dartType Thumb? Function(TextDirection, RangeValues, double, Size, Size, double)? */
 readonly thumbSelector?:RangeThumbSelector|null;
 readonly mouseCursor?:WidgetStateProperty<MouseCursor|null>|null;
 readonly allowedInteraction?:SliderInteraction|null;
 readonly padding?:EdgeInsetsGeometry|null;
 readonly thumbSize?:WidgetStateProperty<Size|null>|null;
 /** @dartType double? */
 readonly trackGap?:number|null;
 readonly year2023?:boolean|null;
}
export const sliderThemeFieldNames=Object.freeze(["trackHeight","activeTrackColor","inactiveTrackColor","secondaryActiveTrackColor","disabledActiveTrackColor","disabledSecondaryActiveTrackColor","disabledInactiveTrackColor","activeTickMarkColor","inactiveTickMarkColor","disabledActiveTickMarkColor","disabledInactiveTickMarkColor","thumbColor","overlappingShapeStrokeColor","disabledThumbColor","overlayColor","valueIndicatorColor","valueIndicatorStrokeColor","overlayShape","tickMarkShape","thumbShape","trackShape","valueIndicatorShape","rangeTickMarkShape","rangeThumbShape","rangeTrackShape","rangeValueIndicatorShape","showValueIndicator","valueIndicatorTextStyle","minThumbSeparation","thumbSelector","mouseCursor","allowedInteraction","padding","thumbSize","trackGap","year2023"] as const);
export const sliderThemeColorFields=Object.freeze(["activeTrackColor","inactiveTrackColor","secondaryActiveTrackColor","disabledActiveTrackColor","disabledSecondaryActiveTrackColor","disabledInactiveTrackColor","activeTickMarkColor","inactiveTickMarkColor","disabledActiveTickMarkColor","disabledInactiveTickMarkColor","thumbColor","overlappingShapeStrokeColor","disabledThumbColor","overlayColor","valueIndicatorColor","valueIndicatorStrokeColor"] as const);
export const sliderThemeNumberFields=Object.freeze(["trackHeight","minThumbSeparation","trackGap"] as const);
export class SliderThemeFieldsBase {
 protected readonly specs:Readonly<SliderThemeOptions>;
 constructor(options:SliderThemeOptions={}){for(const key of Object.keys(options))if(!(sliderThemeFieldNames as readonly string[]).includes(key))throw new TypeError('Unknown slider theme field: '+key);this.specs=Object.freeze({...options});Object.defineProperty(this,'specs',{writable:false,configurable:false});}
 /** @dartType double? */
 get trackHeight():number|null{return this.specs.trackHeight??null;}
 get activeTrackColor():Color|null{return this.specs.activeTrackColor??null;}
 get inactiveTrackColor():Color|null{return this.specs.inactiveTrackColor??null;}
 get secondaryActiveTrackColor():Color|null{return this.specs.secondaryActiveTrackColor??null;}
 get disabledActiveTrackColor():Color|null{return this.specs.disabledActiveTrackColor??null;}
 get disabledSecondaryActiveTrackColor():Color|null{return this.specs.disabledSecondaryActiveTrackColor??null;}
 get disabledInactiveTrackColor():Color|null{return this.specs.disabledInactiveTrackColor??null;}
 get activeTickMarkColor():Color|null{return this.specs.activeTickMarkColor??null;}
 get inactiveTickMarkColor():Color|null{return this.specs.inactiveTickMarkColor??null;}
 get disabledActiveTickMarkColor():Color|null{return this.specs.disabledActiveTickMarkColor??null;}
 get disabledInactiveTickMarkColor():Color|null{return this.specs.disabledInactiveTickMarkColor??null;}
 get thumbColor():Color|null{return this.specs.thumbColor??null;}
 get overlappingShapeStrokeColor():Color|null{return this.specs.overlappingShapeStrokeColor??null;}
 get disabledThumbColor():Color|null{return this.specs.disabledThumbColor??null;}
 get overlayColor():Color|null{return this.specs.overlayColor??null;}
 get valueIndicatorColor():Color|null{return this.specs.valueIndicatorColor??null;}
 get valueIndicatorStrokeColor():Color|null{return this.specs.valueIndicatorStrokeColor??null;}
 get overlayShape():SliderComponentShape|null{return this.specs.overlayShape??null;}
 get tickMarkShape():SliderTickMarkShape|null{return this.specs.tickMarkShape??null;}
 get thumbShape():SliderComponentShape|null{return this.specs.thumbShape??null;}
 get trackShape():SliderTrackShape|null{return this.specs.trackShape??null;}
 get valueIndicatorShape():SliderComponentShape|null{return this.specs.valueIndicatorShape??null;}
 get rangeTickMarkShape():RangeSliderTickMarkShape|null{return this.specs.rangeTickMarkShape??null;}
 get rangeThumbShape():RangeSliderThumbShape|null{return this.specs.rangeThumbShape??null;}
 get rangeTrackShape():RangeSliderTrackShape|null{return this.specs.rangeTrackShape??null;}
 get rangeValueIndicatorShape():RangeSliderValueIndicatorShape|null{return this.specs.rangeValueIndicatorShape??null;}
 get showValueIndicator():ShowValueIndicator|null{return this.specs.showValueIndicator??null;}
 get valueIndicatorTextStyle():TextStyle|null{return this.specs.valueIndicatorTextStyle??null;}
 /** @dartType double? */
 get minThumbSeparation():number|null{return this.specs.minThumbSeparation??null;}
 /** @dartType Thumb? Function(TextDirection, RangeValues, double, Size, Size, double)? */
 get thumbSelector():RangeThumbSelector|null{return this.specs.thumbSelector??null;}
 get mouseCursor():WidgetStateProperty<MouseCursor|null>|null{return this.specs.mouseCursor??null;}
 get allowedInteraction():SliderInteraction|null{return this.specs.allowedInteraction??null;}
 get padding():EdgeInsetsGeometry|null{return this.specs.padding??null;}
 get thumbSize():WidgetStateProperty<Size|null>|null{return this.specs.thumbSize??null;}
 /** @dartType double? */
 get trackGap():number|null{return this.specs.trackGap??null;}
 get year2023():boolean|null{return this.specs.year2023??null;}
}
