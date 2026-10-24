// SPDX-License-Identifier: BSD-3-Clause
// A design-owned scope over the single Core inherited tree; value modules import its data type only.
import {InheritedTheme} from '@nelyx/core/framework/widgets/inherited-theme';
import {InheritedElement} from '@nelyx/core/framework/widgets/framework';
import type {BuildContext, Widget} from '@nelyx/core/framework/widgets/framework';
import type {ThemeData} from '../../theme-data.ts';

export abstract class MaterialThemeScope extends InheritedTheme {
    protected constructor(readonly data: ThemeData, child: Widget) {
        super(child);
    }
    abstract resolveData(context: BuildContext): ThemeData;
}

export function maybeMaterialThemeScopeOf(context: BuildContext): MaterialThemeScope | null {
    let scope: MaterialThemeScope | null = null;
    context.visitAncestorElements(element => {
        if (element instanceof InheritedElement && element.widget instanceof MaterialThemeScope) {
            scope = context.dependOnInheritedElement<MaterialThemeScope>(element);
            return false;
        }
        return true;
    });
    return scope;
}

export function maybeMaterialThemeDataOf(context: BuildContext): ThemeData | null {
    return maybeMaterialThemeScopeOf(context)?.resolveData(context) ?? null;
}
