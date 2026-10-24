// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {State, Element} from '@nelyx/core/framework/widgets/framework';
import type {Widget, BuildContext} from '@nelyx/core/framework/widgets/framework';
import {FocusNode} from '@nelyx/core/framework/widgets/focus';
import {RadioGroup, RadioGroupRegistry} from '@nelyx/core/framework/widgets/radio-group';
import type {RadioClient} from '@nelyx/core/framework/widgets/radio-group';
import {ExcludeFocus} from '@nelyx/core/framework/widgets/focus-scope';
import {Transform} from '@nelyx/core/framework/widgets/basic';
import {dartValueEquals} from '@nelyx/core/internal/foundation/dart-value';
import {invariant} from '@nelyx/core/foundation/errors';
import {Color} from '@nelyx/core/ui/color';
import {Radio} from '../../radio.ts';
import {RadioTheme} from '../../radio-theme.ts';
import {Theme} from '../../theme.ts';
import {MaterialTapTargetSize} from '../../theme-data.ts';
import type {RadioListTile} from '../../radio-list-tile.ts';
import {composeToggleTile, toggleTileStates} from './toggle-list-tile-build.ts';

class RadioListTileState<T> extends State<RadioListTile<T>> implements RadioClient<T> {
    private internalFocus: FocusNode | null = null;
    private registry: RadioGroupRegistry<T> | null = null;
    private retired = false;
    constructor(private readonly adaptive: (widget: RadioListTile<T>) => boolean) {super();}
    get focusNode(): FocusNode {return this.widget.focusNode ?? (this.internalFocus ??= new FocusNode({debugLabel: 'RadioListTile'}));}
    get radioValue(): T {return this.widget.value;}
    get tristate(): boolean {return this.widget.toggleable;}
    get enabled(): boolean {return this.widget.enabled ?? this.registry !== null;}
    private readonly internalRegistry = new TileRadioRegistry(this);
    get groupValue(): T | null {return this.registry?.groupValue ?? null;}
    private resolve(): void {
        const o = this.widget.options, next = o.groupRegistry ?? (o.groupToken === undefined ? null : RadioGroup.maybeOf<T>(this.context, o.groupToken));
        invariant(this.widget.enabled !== true || next !== null, 'missing-radio-registry', 'Enabled RadioListTile requires a typed group or registry');
        if (next !== this.registry) {this.registry?.unregisterClient(this); this.registry = next; next?.registerClient(this);}
    }
    override didChangeDependencies(): void {super.didChangeDependencies(); this.resolve();}
    override didUpdateWidget(old: RadioListTile<T>): void {
        super.didUpdateWidget(old); this.resolve();
        if (old.enabled !== this.widget.enabled || old.focusNode !== this.widget.focusNode || !dartValueEquals(old.value, this.widget.value)) {this.registry?.unregisterClient(this); this.registry?.registerClient(this);}
    }
    readonly handleChange = (value: T | null): void => {
        if (!this.retired && this.mounted && (this.context as Element).active && this.enabled) this.registry!.onChanged(value);
    };
    private readonly handleTap = (): void => {
        const checked = dartValueEquals(this.radioValue, this.groupValue);
        if (!checked || this.tristate) this.handleChange(checked ? null : this.radioValue);
    };
    build(context: BuildContext): Widget {
        const tile = this.widget, options = {
            value: tile.value, groupRegistry: this.internalRegistry, toggleable: tile.toggleable, enabled: this.enabled,
            activeColor: tile.activeColor, fillColor: tile.fillColor, mouseCursor: tile.mouseCursor, hoverColor: tile.hoverColor,
            overlayColor: tile.overlayColor, splashRadius: tile.splashRadius, materialTapTargetSize: tile.materialTapTargetSize ?? MaterialTapTargetSize.shrinkWrap,
            autofocus: tile.autofocus, backgroundColor: tile.radioBackgroundColor, side: tile.radioSide, innerRadius: tile.radioInnerRadius
        };
        let control: Widget = new ExcludeFocus(this.adaptive(tile) ? Radio.adaptive({...options, useCupertinoCheckmarkStyle: tile.useCupertinoCheckmarkStyle}) : new Radio(options));
        if (tile.radioScaleFactor !== 1) control = Transform.scale(control, {scale: tile.radioScaleFactor});
        const selectedColor = tile.activeColor ?? RadioTheme.of(context).fillColor?.resolve(toggleTileStates(tile.selected)) ?? new Color(Theme.of(context).colorScheme.secondary);
        return composeToggleTile(tile, context, control, this.enabled, this.enabled ? this.handleTap : null, selectedColor, true, this.focusNode);
    }
    override deactivate(): void {this.registry?.unregisterClient(this); super.deactivate();}
    override activate(): void {super.activate(); this.registry?.registerClient(this);}
    override dispose(): void {this.retired = true; this.registry?.unregisterClient(this); this.registry = null; try {this.internalFocus?.dispose();} finally {super.dispose();}}
}
/** Source registry deliberately hides the embedded control from the outer typed group. */
class TileRadioRegistry<T> extends RadioGroupRegistry<T> {
    constructor(private readonly state: RadioListTileState<T>) {super();}
    get groupValue(): T | null {return this.state.groupValue;}
    get onChanged(): (value: T | null) => void {return this.state.handleChange;}
    registerClient(_client: RadioClient<T>): void {}
    unregisterClient(_client: RadioClient<T>): void {}
}
export function createRadioListTileState<T>(adaptive: (widget: RadioListTile<T>) => boolean): State<RadioListTile<T>> {return new RadioListTileState(adaptive);}
