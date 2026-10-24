// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
export {FadeForwardsPageTransitionsBuilder,ZoomPageTransitionsBuilder} from './internal/route/page-transition-builders.ts';
export type {FadeForwardsPageTransitionsBuilderOptions,ZoomPageTransitionsBuilderOptions} from './internal/route/page-transition-builders.ts';
import {State,StatefulWidget} from '@nelyx/core/framework/widgets/framework';
import type {Widget,BuildContext} from '@nelyx/core/framework/widgets/framework';
import {PageTransitionsBuilder} from '@nelyx/core/framework/widgets/page-transitions-builder';
import type {PageRoute} from '@nelyx/core/framework/widgets/pages';
import type {Animation} from '@nelyx/core/framework/animation/animation';
import type {DelegatedTransitionBuilder} from '@nelyx/core/framework/widgets/transitions';
import type {TargetPlatform} from '@nelyx/core/foundation/platform';
import {DiagnosticsProperty} from '@nelyx/core/foundation/diagnostics';
import {Diagnosticable} from '@nelyx/core/foundation/diagnosticable';
import type {DiagnosticPropertiesBuilder} from '@nelyx/core/foundation/diagnostics';
import {hashValues,valueEquals} from '@nelyx/core/framework/painting/value-equality';
import {CupertinoPageTransitionsBuilder} from '@nelyx/cupertino/route';
import {ZoomPageTransitionsBuilder} from './internal/route/page-transition-builders.ts';
import {PredictiveBackPageTransitionsBuilder} from './predictive-back-page-transitions-builder.ts';
import {materialTransitionThemeOf} from './internal/theme/transition-theme-context.ts';

const platforms:readonly TargetPlatform[]=['android','fuchsia','iOS','linux','macOS','windows'];
const predictiveDefault=new PredictiveBackPageTransitionsBuilder(),cupertinoDefault=new CupertinoPageTransitionsBuilder(),zoomDefault=new ZoomPageTransitionsBuilder();
/** ReadonlyMap facade preserves source const-map protection without exposing a second collection runtime. */
const defaultBuilderEntries:readonly (readonly [TargetPlatform,PageTransitionsBuilder])[]=[['android',predictiveDefault],['iOS',cupertinoDefault],['macOS',cupertinoDefault],['windows',zoomDefault],['linux',zoomDefault]];
const defaultBuilderMap=new Map(defaultBuilderEntries);
const defaultBuilders:ReadonlyMap<TargetPlatform,PageTransitionsBuilder>=Object.freeze({get size(){return defaultBuilderMap.size;},get:(key:TargetPlatform)=>defaultBuilderMap.get(key),has:(key:TargetPlatform)=>defaultBuilderMap.has(key),entries:()=>defaultBuilderMap.entries(),keys:()=>defaultBuilderMap.keys(),values:()=>defaultBuilderMap.values(),[Symbol.iterator]:()=>defaultBuilderMap[Symbol.iterator](),forEach:(callback:(value:PageTransitionsBuilder,key:TargetPlatform,map:ReadonlyMap<TargetPlatform,PageTransitionsBuilder>)=>void,thisArg?:unknown)=>defaultBuilderMap.forEach((value,key)=>callback.call(thisArg,value,key,defaultBuilders))});
export interface PageTransitionsThemeOptions {readonly builders?:ReadonlyMap<TargetPlatform,PageTransitionsBuilder>;}
export class PageTransitionsTheme extends Diagnosticable(class {}) {
    readonly builders:ReadonlyMap<TargetPlatform,PageTransitionsBuilder>;
    constructor({builders=defaultBuilders}:PageTransitionsThemeOptions={}){super();this.builders=builders;}
    /** @dartParam animation Animation<double>
     * @dartParam secondaryAnimation Animation<double> */
    buildTransitions<T>(route:PageRoute<T>,_context:BuildContext,animation:Animation<number>,secondaryAnimation:Animation<number>,child:Widget):Widget{return new PageTransitionsThemeTransitions(this.builders,route,animation,secondaryAnimation,child);}
    /** @dartReturn Widget? Function(BuildContext, Animation<double>, Animation<double>, bool, Widget?)? */
    delegatedTransition(platform:TargetPlatform):DelegatedTransitionBuilder|null{return (this.builders.get(platform)??zoomDefault).delegatedTransition;}
    equals(other:unknown):boolean{
        if(this===other)return true;
        if(!(other instanceof PageTransitionsTheme)||other.constructor!==this.constructor)return false;
        return other.builders===this.builders||platforms.every(platform=>valueEquals(this.builders.get(platform),other.builders.get(platform)));
    }
    /** @dartReturn int */
    get hashCode():number{return hashValues(...platforms.map(platform=>this.builders.get(platform)??null));}
    override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new DiagnosticsProperty('builders',this.builders,{defaultValue:defaultBuilders}));}
}
class PageTransitionsThemeTransitions<T> extends StatefulWidget {
    /** @dartType Animation<double> */
    readonly animation:Animation<number>;
    /** @dartType Animation<double> */
    readonly secondaryAnimation:Animation<number>;
    /** @dartParam animation Animation<double>
     * @dartParam secondaryAnimation Animation<double> */
    constructor(readonly builders:ReadonlyMap<TargetPlatform,PageTransitionsBuilder>,readonly route:PageRoute<T>,animation:Animation<number>,secondaryAnimation:Animation<number>,readonly child:Widget){super();this.animation=animation;this.secondaryAnimation=secondaryAnimation;}
    createState():State{return new PageTransitionsThemeTransitionsState<T>();}
}
class PageTransitionsThemeTransitionsState<T> extends State<PageTransitionsThemeTransitions<T>> {
    private transitionPlatform:TargetPlatform|null=null;
    build(context:BuildContext):Widget{let platform=materialTransitionThemeOf(context).platform;if(this.widget.route.popGestureInProgress){this.transitionPlatform??=platform;platform=this.transitionPlatform;}else this.transitionPlatform=null;const builder=this.widget.builders.get(platform)??(platform==='iOS'?cupertinoDefault:zoomDefault);return builder.buildTransitions(this.widget.route,context,this.widget.animation,this.widget.secondaryAnimation,this.widget.child);}
}
