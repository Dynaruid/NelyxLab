// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {StatelessWidget} from '@nelyx/core/framework/widgets/framework';
import type {Widget,WidgetOptions,BuildContext} from '@nelyx/core/framework/widgets/framework';
import {Padding} from '@nelyx/core/framework/widgets/basic';
import {Semantics} from '@nelyx/core/framework/widgets/semantics';
import {EdgeInsets} from '@nelyx/core/framework/painting/edge-insets';
import type {EdgeInsetsGeometry} from '@nelyx/core/framework/painting/edge-insets';
import {BorderRadius} from '@nelyx/core/framework/painting/border-radius';
import {BorderSide} from '@nelyx/core/framework/painting/borders';
import type {ShapeBorder} from '@nelyx/core/framework/painting/borders';
import {RoundedRectangleBorder} from '@nelyx/core/framework/painting/rounded-rectangle-border';
import type {Color} from '@nelyx/core/ui/color';
import type {Clip} from '@nelyx/core/ui/clip';
import {invariant} from '@nelyx/core/foundation/errors';
import {CardTheme} from './card-theme.ts';
import type {CardThemeData} from './card-theme-data.ts';
import {Theme} from './theme.ts';
import {Material,MaterialType} from './material.ts';
import {Colors} from './colors.ts';
import {materialSchemeColor} from './internal/theme/default-color-schemes.ts';
import type {ColorScheme,ColorRole} from './color-scheme.ts';

export interface CardOptions extends WidgetOptions {
    readonly color?:Color|null;
    readonly shadowColor?:Color|null;
    readonly surfaceTintColor?:Color|null;
    /** @dartType double? */ readonly elevation?:number|null;
    readonly shape?:ShapeBorder|null;
    readonly borderOnForeground?:boolean;
    readonly clipBehavior?:Clip|null;
    readonly margin?:EdgeInsetsGeometry|null;
    readonly semanticContainer?:boolean;
    readonly child?:Widget|null;
}
type CardVariant='elevated'|'filled'|'outlined';
const namedVariants=new WeakMap<CardOptions,CardVariant>();
const variants=new WeakMap<Card,CardVariant>();
// These pinned source const expressions share the actual Core value owners.
function constant<T extends object>(value:T):T{Object.freeze(value);return value;}
const defaultMargin=constant(EdgeInsets.all(4));
const defaultShape=constant(new RoundedRectangleBorder({borderRadius:BorderRadius.circular(12)}));
type CardDefaults=Pick<CardThemeData,'color'|'shadowColor'|'surfaceTintColor'|'shape'> & {
    readonly elevation:number;readonly clipBehavior:Clip;readonly margin:EdgeInsetsGeometry;
};
function cardDefaults(context:BuildContext,variant:CardVariant):CardDefaults {
    let colors:ColorScheme|null=null;
    const color=(role:ColorRole):Color=>materialSchemeColor(colors??=Theme.of(context).colorScheme,role);
    return {
        clipBehavior:'none',elevation:variant==='elevated'?1:0,margin:defaultMargin,
        get color(){return color(variant==='elevated'?'surfaceContainerLow':variant==='filled'?'surfaceContainerHighest':'surface');},
        get shadowColor(){return color('shadow');},
        get surfaceTintColor(){return Colors.transparent;},
        get shape(){return variant==='outlined'?defaultShape.copyWith({side:new BorderSide({color:color('outlineVariant').toARGB32()})}):defaultShape;}
    };
}
/** M3 elevated, filled and outlined Card composition on the existing Material owner. */
export class Card extends StatelessWidget {
    readonly color:Color|null;
    readonly shadowColor:Color|null;
    readonly surfaceTintColor:Color|null;
    /** @dartType double? */ readonly elevation:number|null;
    readonly shape:ShapeBorder|null;
    readonly borderOnForeground:boolean;
    readonly clipBehavior:Clip|null;
    readonly margin:EdgeInsetsGeometry|null;
    readonly semanticContainer:boolean;
    readonly child:Widget|null;
    /** @dartParam elevation double? */
    constructor(options:CardOptions={}) {
        super(options.key??null);
        variants.set(this,namedVariants.get(options)??'elevated');
        this.color=options.color??null;this.shadowColor=options.shadowColor??null;this.surfaceTintColor=options.surfaceTintColor??null;
        this.elevation=options.elevation??null;this.shape=options.shape??null;this.borderOnForeground=options.borderOnForeground??true;
        this.clipBehavior=options.clipBehavior??null;this.margin=options.margin??null;this.semanticContainer=options.semanticContainer??true;this.child=options.child??null;
        invariant(this.elevation===null||Number.isFinite(this.elevation)&&this.elevation>=0,'invalid-card-elevation','Card elevation must be null or finite/nonnegative');
        Object.freeze(this);
    }
    /** @dartParam elevation double? */
    static filled(options:CardOptions={}):Card{return Card.named(options,'filled');}
    /** @dartParam elevation double? */
    static outlined(options:CardOptions={}):Card{return Card.named(options,'outlined');}
    private static named(options:CardOptions,variant:CardVariant):Card {
        const input:CardOptions={key:options.key??null,color:options.color??null,shadowColor:options.shadowColor??null,surfaceTintColor:options.surfaceTintColor??null,elevation:options.elevation??null,shape:options.shape??null,borderOnForeground:options.borderOnForeground??true,clipBehavior:options.clipBehavior??null,margin:options.margin??null,semanticContainer:options.semanticContainer??true,child:options.child??null};
        namedVariants.set(input,variant);
        try{return new Card(input);}finally{namedVariants.delete(input);}
    }
    override build(context:BuildContext):Widget {
        const theme=CardTheme.of(context),defaults=cardDefaults(context,variants.get(this)!);
        return new Semantics({container:this.semanticContainer,child:new Padding(this.margin??theme.margin??defaults.margin,
            new Material({type:MaterialType.card,color:this.color??theme.color??defaults.color,shadowColor:this.shadowColor??theme.shadowColor??defaults.shadowColor,
                surfaceTintColor:this.surfaceTintColor??theme.surfaceTintColor??defaults.surfaceTintColor,elevation:this.elevation??theme.elevation??defaults.elevation,
                shape:this.shape??theme.shape??defaults.shape,borderOnForeground:this.borderOnForeground,clipBehavior:this.clipBehavior??theme.clipBehavior??defaults.clipBehavior,
                child:new Semantics({explicitChildNodes:!this.semanticContainer,child:this.child})}))});
    }
}
