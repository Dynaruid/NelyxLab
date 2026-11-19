// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/autocomplete.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { invariant } from '@nelyx/core/foundation/errors';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import {
  AutocompleteHighlightedOption,
  RawAutocomplete,
} from '@nelyx/core/framework/widgets/autocomplete';
import type {
  AutocompleteFieldViewBuilder,
  RawAutocompleteOptions,
} from '@nelyx/core/framework/widgets/autocomplete';
import { ColoredBox, ConstrainedBox, Padding, Text } from '@nelyx/core/framework/widgets/basic';
import {
  Element,
  State,
  StatefulWidget,
  StatelessWidget,
} from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { ScrollController } from '@nelyx/core/framework/widgets/scroll-controller';
import { ListView } from '@nelyx/core/framework/widgets/scroll-view';
import { Scrollable } from '@nelyx/core/framework/widgets/scrollable';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import type { TextEditingController } from '@nelyx/core/framework/widgets/editable-text';
import type { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { InkWell } from './ink-well.ts';
import { Material } from './material.ts';
import { TextFormField } from './text-form-field.ts';
import { Theme } from './theme.ts';

export {
  AutocompleteHighlightedOption,
  OptionsViewOpenDirection,
  RawAutocomplete,
} from '@nelyx/core/framework/widgets/autocomplete';
export type {
  AutocompleteFieldViewBuilder,
  AutocompleteOnSelected,
  AutocompleteOptionsBuilder,
  AutocompleteOptionsViewBuilder,
  AutocompleteOptionToString,
  RawAutocompleteOptions,
} from '@nelyx/core/framework/widgets/autocomplete';

export interface AutocompleteOptions<T extends {}> extends Omit<
  RawAutocompleteOptions<T>,
  'optionsViewBuilder'
> {
  readonly optionsViewBuilder?: RawAutocompleteOptions<T>['optionsViewBuilder'] | null;
  readonly optionsMaxHeight?: number;
}

export class Autocomplete<T extends {}> extends StatelessWidget {
  constructor(readonly options: AutocompleteOptions<T>) {
    super(options.key ?? null);
    invariant(
      options.optionsMaxHeight === undefined || options.optionsMaxHeight >= 0,
      'invalid-autocomplete-height',
      'Autocomplete max height must be nonnegative',
    );
  }

  override build(_context: BuildContext): Widget {
    const {
      optionsMaxHeight = 200,
      displayStringForOption = RawAutocomplete.defaultStringForOption,
      fieldViewBuilder = defaultField,
      optionsViewBuilder,
      key: _key,
      ...options
    } = this.options;
    return new RawAutocomplete<T>({
      ...options,
      displayStringForOption,
      fieldViewBuilder: fieldViewBuilder ?? defaultField,
      optionsViewBuilder:
        optionsViewBuilder ??
        ((context, select, items) =>
          new Material({
            elevation: 4,
            child: new ConstrainedBox(
              new AutocompleteOptionsList(
                Array.from(items),
                AutocompleteHighlightedOption.of(context),
                displayStringForOption,
                select,
              ),
              new BoxConstraints(0, Infinity, 0, optionsMaxHeight),
            ),
          })),
    });
  }
}

const defaultField: AutocompleteFieldViewBuilder = (_context, controller, focus, submit) =>
  new AutocompleteField(controller, focus, submit);
let nextAutocompleteField = 0;

class AutocompleteField extends StatefulWidget {
  constructor(
    readonly controller: TextEditingController,
    readonly focus: FocusNode,
    readonly submit: () => void,
  ) {
    super();
  }
  override createState(): State<AutocompleteField> {
    return new AutocompleteFieldState();
  }
}

class AutocompleteFieldState extends State<AutocompleteField> {
  private readonly id = `material-autocomplete-${++nextAutocompleteField}`;
  override build(): Widget {
    const { controller, focus, submit } = this.widget;
    return new TextFormField({
      id: this.id,
      controller,
      focusNode: focus,
      onEditingComplete: () => {},
      onSubmitted: submit,
    });
  }
}

class AutocompleteOptionsList<T> extends StatefulWidget {
  constructor(
    readonly items: readonly T[],
    readonly highlighted: number,
    readonly display: (option: T) => string,
    readonly select: (option: T) => void,
  ) {
    super();
  }
  override createState(): State<AutocompleteOptionsList<T>> {
    return new AutocompleteOptionsListState();
  }
}

class AutocompleteOptionsListState<T> extends State<AutocompleteOptionsList<T>> {
  private readonly scroll = new ScrollController();
  private readonly itemKeys = new Map<number, GlobalKey>();

  override didUpdateWidget(old: AutocompleteOptionsList<T>): void {
    super.didUpdateWidget(old);
    const { highlighted, items } = this.widget;
    if (items.length < old.items.length)
      for (const index of this.itemKeys.keys())
        if (index >= items.length) this.itemKeys.delete(index);
    if (old.highlighted === highlighted) return;
    const owner = (this.context as Element).owner;
    const reveal = (): boolean => {
      const context = this.itemKeys.get(highlighted)?.currentContext;
      if (!context) return false;
      void Scrollable.ensureVisible(context, { alignment: 0.5 });
      return true;
    };
    owner.postFrame(() => {
      if (
        !this.mounted ||
        this.widget.highlighted !== highlighted ||
        !this.scroll.hasClients ||
        reveal()
      )
        return;
      const position = this.scroll.position;
      const fraction = highlighted / Math.max(1, this.widget.items.length - 1);
      this.scroll.jumpTo(
        position.minScrollExtent + (position.maxScrollExtent - position.minScrollExtent) * fraction,
      );
      owner.postFrame(() => {
        if (this.mounted && this.widget.highlighted === highlighted) reveal();
      });
    });
  }

  override build(context: BuildContext): Widget {
    const { items, highlighted, display, select } = this.widget;
    const highlight = Theme.of(context).focusColor.toARGB32();
    return ListView.builder({
      padding: EdgeInsets.zero,
      shrinkWrap: true,
      primary: false,
      controller: this.scroll,
      itemCount: items.length,
      itemBuilder: (_context, index) => {
        let key = this.itemKeys.get(index);
        if (!key) this.itemKeys.set(index, (key = new GlobalKey(`Autocomplete option ${index}`)));
        const item = items[index]!;
        const label = new Padding(EdgeInsets.all(16), new Text(display(item)));
        return new Semantics({
          key,
          button: true,
          selected: highlighted === index,
          child: new InkWell({
            canRequestFocus: false,
            onTap: () => select(item),
            child:
              highlighted === index ? new ColoredBox({ color: highlight, child: label }) : label,
          }),
        });
      },
    });
  }

  override dispose(): void {
    this.scroll.dispose();
    super.dispose();
  }
}
