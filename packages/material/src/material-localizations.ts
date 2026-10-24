// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Selection messages from the pinned localization tables; date/time families remain separate.
import { InheritedWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import { Localizations } from '@nelyx/core/framework/widgets/app-data';
import { selectionMessages } from "./generated/localizations/selection-localizations-data.ts";
import {scriptCategories} from './generated/localizations/script-categories.ts';
import {ScriptCategory} from './script-category.ts';
import {refreshIndicatorLabels} from './generated/localizations/refresh-localizations-data.ts';
function localeCandidates(locale:string):string[]{
    const parts=locale.replaceAll('-','_').split('_'),language=parts[0]!,script=parts.find(value=>value.length===4),region=parts.find(value=>value.length===2&&value!==language||value.length===3);
    return [language,...(script?[language+'_'+script]:[]),...(region?[language+'_'+region]:[]),parts.join('_')];
}
function categoryFor(candidates:readonly string[]):ScriptCategory{return ScriptCategory[candidates.reduce<'englishLike'|'dense'|'tall'>((current,key)=>scriptCategories[key]??current,'englishLike')];}
export class MaterialLocalizations {
    private readonly messages: Readonly<Record<string, string>>;
    private readonly category: ScriptCategory;
    constructor(readonly locale = 'en') {
        const candidates=localeCandidates(locale);
        this.messages = Object.freeze(Object.assign({}, selectionMessages.en, ...candidates.map(key => selectionMessages[key] ?? {}), {
            refreshIndicatorSemanticLabel: candidates.reduce((label, key) => refreshIndicatorLabels[key] ?? label, refreshIndicatorLabels.en!)
        }));
        this.category=categoryFor(candidates);
    }
    get scriptCategory(): ScriptCategory {return this.category;}
    get refreshIndicatorSemanticLabel(): string {return this.message('refreshIndicatorSemanticLabel');}
    static of(context: BuildContext): MaterialLocalizations {
        return context.maybeDependOn(MaterialLocalizationsScope)?.data ?? new MaterialLocalizations(context.maybeDependOn(Localizations)?.locale ?? 'en');
    }
    static get supportedLocales(): readonly string[] {
        return Object.freeze(Object.keys(selectionMessages));
    }
    protected message(key: string): string {
        const value = this.messages[key];
        if (value === undefined)
            throw new Error('Missing Material selection localization: ' + key);
        return value;
    }
    get cutButtonLabel(): string {
        return this.message('cutButtonLabel');
    }
    get copyButtonLabel(): string {
        return this.message('copyButtonLabel');
    }
    get pasteButtonLabel(): string {
        return this.message('pasteButtonLabel');
    }
    get selectAllButtonLabel(): string {
        return this.message('selectAllButtonLabel');
    }
    get lookUpButtonLabel(): string {
        return this.message('lookUpButtonLabel');
    }
    get searchWebButtonLabel(): string {
        return this.message('searchWebButtonLabel');
    }
    get shareButtonLabel(): string {
        return this.message('shareButtonLabel');
    }
    get deleteButtonTooltip(): string {
        return this.message('deleteButtonTooltip');
    }
    get scanTextButtonLabel(): string {
        return this.message('scanTextButtonLabel');
    }
    get moreButtonTooltip(): string {
        return this.message('moreButtonTooltip');
    }
    get backButtonTooltip(): string {
        return this.message('backButtonTooltip');
    }
}
export class DefaultMaterialLocalizations extends MaterialLocalizations {
    constructor() {
        super('en');
    }
}
const defaultLocalizationsOf=MaterialLocalizations.of;
let scriptLocale:string|undefined,cachedScriptCategory=ScriptCategory.englishLike;
/** @internal Theme needs the immutable script category without materializing menu messages. */
export function materialScriptCategoryOf(context:BuildContext):ScriptCategory{
    if(MaterialLocalizations.of!==defaultLocalizationsOf)return MaterialLocalizations.of(context).scriptCategory;
    const provided=context.maybeDependOn(MaterialLocalizationsScope)?.data;
    if(provided!==undefined&&provided!==null)return provided.scriptCategory;
    const locale=context.maybeDependOn(Localizations)?.locale??'en';
    if(typeof locale!=='string')return new MaterialLocalizations(locale).scriptCategory;
    // The generated category table and enum are frozen. Keep only one scalar
    // locale result; public localization objects and mutable messages stay fresh.
    if(locale!==scriptLocale){cachedScriptCategory=categoryFor(localeCandidates(locale));scriptLocale=locale;}
    return cachedScriptCategory;
}
export class MaterialLocalizationsScope extends InheritedWidget {
    constructor(readonly data: MaterialLocalizations, child: Widget) {
        super(child);
    }
    updateShouldNotify(old: this): boolean {
        return old.data !== this.data;
    }
}
