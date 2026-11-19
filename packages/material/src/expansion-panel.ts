// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/expansion_panel.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { invariant } from '@nelyx/core/foundation/errors';
import { ValueKey } from '@nelyx/core/foundation/key';
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import type { Animation } from '@nelyx/core/framework/animation/animation';
import { Curves, Interval } from '@nelyx/core/framework/animation/curves';
import { CurveTween } from '@nelyx/core/framework/animation/tween';
import { Alignment } from '@nelyx/core/framework/painting/alignment';
import { EdgeInsets, EdgeInsetsDirectional } from '@nelyx/core/framework/painting/edge-insets';
import { valueEquals } from '@nelyx/core/framework/painting/value-equality';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import {
  Column,
  ConstrainedBox,
  Expanded,
  Padding,
  Row,
} from '@nelyx/core/framework/widgets/basic';
import { ExcludeFocus } from '@nelyx/core/framework/widgets/focus-scope';
import { State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { AnimatedContainer } from '@nelyx/core/framework/widgets/implicit-animations';
import { IgnorePointer } from '@nelyx/core/framework/widgets/pointer-blocking';
import {
  ExcludeSemantics,
  MergeSemantics,
  Semantics,
} from '@nelyx/core/framework/widgets/semantics';
import { SingleTickerProviderStateMixin } from '@nelyx/core/framework/widgets/ticker-provider';
import { FadeTransition, SizeTransition } from '@nelyx/core/framework/widgets/transitions';
import type { Color } from '@nelyx/core/ui/color';
import { kMinInteractiveDimension } from './constants.ts';
import { ExpandIcon } from './expand-icon.ts';
import { InkWell } from './ink-well.ts';
import { MaterialGap, MaterialSlice, MergeableMaterial } from './mergeable-material.ts';
import { MaterialLocalizations } from './material-localizations.ts';

export type ExpansionPanelCallback = (panelIndex: number, isExpanded: boolean) => void;
export type ExpansionPanelHeaderBuilder = (context: BuildContext, isExpanded: boolean) => Widget;

export interface ExpansionPanelOptions {
  readonly headerBuilder: ExpansionPanelHeaderBuilder;
  readonly body: Widget;
  readonly isExpanded?: boolean;
  readonly canTapOnHeader?: boolean;
  readonly backgroundColor?: Color | null;
  readonly splashColor?: Color | null;
  readonly highlightColor?: Color | null;
}

export class ExpansionPanel {
  readonly headerBuilder: ExpansionPanelHeaderBuilder;
  readonly body: Widget;
  readonly isExpanded: boolean;
  readonly canTapOnHeader: boolean;
  readonly backgroundColor: Color | null;
  readonly splashColor: Color | null;
  readonly highlightColor: Color | null;
  constructor(options: ExpansionPanelOptions) {
    this.headerBuilder = options.headerBuilder;
    this.body = options.body;
    this.isExpanded = options.isExpanded ?? false;
    this.canTapOnHeader = options.canTapOnHeader ?? false;
    this.backgroundColor = options.backgroundColor ?? null;
    this.splashColor = options.splashColor ?? null;
    this.highlightColor = options.highlightColor ?? null;
  }
}

export interface ExpansionPanelRadioOptions<T extends {} = {}> extends Omit<
  ExpansionPanelOptions,
  'isExpanded'
> {
  readonly value: T;
}
export class ExpansionPanelRadio<T extends {} = {}> extends ExpansionPanel {
  readonly value: T;
  constructor(options: ExpansionPanelRadioOptions<T>) {
    super({ ...options, isExpanded: false });
    this.value = options.value;
  }
}

export interface ExpansionPanelListOptions extends WidgetOptions {
  readonly children?: readonly ExpansionPanel[];
  readonly expansionCallback?: ExpansionPanelCallback | null;
  readonly animationDuration?: number;
  readonly expandedHeaderPadding?: EdgeInsets;
  readonly dividerColor?: Color | null;
  readonly elevation?: number;
  readonly expandIconColor?: Color | null;
  readonly materialGapSize?: number;
}
export interface ExpansionPanelListRadioOptions<T extends {} = {}> extends Omit<
  ExpansionPanelListOptions,
  'children'
> {
  readonly children?: readonly ExpansionPanelRadio<T>[];
  readonly initialOpenPanelValue?: T | null;
}

const headerPadding = EdgeInsets.symmetric({ vertical: 64 - kMinInteractiveDimension });
const collapsedHeader = new BoxConstraints(0, Infinity, kMinInteractiveDimension);
const expandIconPadding = EdgeInsets.all(12);

export class ExpansionPanelList extends StatefulWidget {
  private radioMode = false;
  private initialValue: {} | null = null;
  readonly children: readonly ExpansionPanel[];
  readonly expansionCallback: ExpansionPanelCallback | null;
  readonly animationDuration: number;
  readonly expandedHeaderPadding: EdgeInsets;
  readonly dividerColor: Color | null;
  readonly elevation: number;
  readonly expandIconColor: Color | null;
  readonly materialGapSize: number;
  constructor(options: ExpansionPanelListOptions = {}) {
    super(options.key ?? null);
    this.children = Object.freeze([...(options.children ?? [])]);
    this.expansionCallback = options.expansionCallback ?? null;
    this.animationDuration = options.animationDuration ?? 200;
    this.expandedHeaderPadding = options.expandedHeaderPadding ?? headerPadding;
    this.dividerColor = options.dividerColor ?? null;
    this.elevation = options.elevation ?? 2;
    this.expandIconColor = options.expandIconColor ?? null;
    this.materialGapSize = options.materialGapSize ?? 16;
    invariant(
      Number.isFinite(this.animationDuration) &&
        this.animationDuration >= 0 &&
        Number.isFinite(this.materialGapSize) &&
        this.materialGapSize >= 0,
      'invalid-expansion-panel-animation',
      'Expansion duration and gap must be finite and nonnegative',
    );
  }
  static radio<T extends {}>(options: ExpansionPanelListRadioOptions<T> = {}): ExpansionPanelList {
    const list = new ExpansionPanelList(options);
    const seen: unknown[] = [];
    for (const panel of options.children ?? []) {
      invariant(
        panel instanceof ExpansionPanelRadio &&
          !seen.some((value) => valueEquals(value, panel.value)),
        'invalid-expansion-panel-radio',
        'Radio panels require distinct values',
      );
      seen.push(panel.value);
    }
    list.radioMode = true;
    list.initialValue = options.initialOpenPanelValue ?? null;
    return list;
  }
  get isRadio(): boolean {
    return this.radioMode;
  }
  get initialOpenPanelValue(): {} | null {
    return this.initialValue;
  }
  createState(): State<ExpansionPanelList> {
    return new ExpansionPanelListState();
  }
}

class ExpansionPanelListState extends State<ExpansionPanelList> {
  private open: {} | null = null;
  private initializeOpen(): void {
    const selected = this.widget.initialOpenPanelValue;
    this.open =
      this.widget.isRadio &&
      selected != null &&
      this.widget.children.some(
        (panel) => panel instanceof ExpansionPanelRadio && valueEquals(panel.value, selected),
      )
        ? selected
        : null;
  }
  override initState(): void {
    this.initializeOpen();
  }
  override didUpdateWidget(old: ExpansionPanelList): void {
    if (old.isRadio !== this.widget.isRadio) this.initializeOpen();
  }
  private expanded(panel: ExpansionPanel): boolean {
    return this.widget.isRadio
      ? panel instanceof ExpansionPanelRadio &&
          this.open !== null &&
          valueEquals(panel.value, this.open)
      : panel.isExpanded;
  }
  private press(index: number, panel: ExpansionPanel): void {
    if (!this.mounted || this.widget.children[index] !== panel) return;
    const target = !this.expanded(panel);
    const report = this.widget.expansionCallback;
    if (this.widget.isRadio && panel instanceof ExpansionPanelRadio) {
      const closing = this.widget.children.findIndex(
        (other) => other !== panel && this.expanded(other),
      );
      if (closing >= 0) report?.(closing, false);
      if (this.mounted)
        this.setState(() => {
          this.open = target ? panel.value : null;
        });
    }
    report?.(index, target);
  }
  build(context: BuildContext): Widget {
    const {
      children,
      animationDuration: duration,
      materialGapSize: gap,
      expandIconColor,
      expandedHeaderPadding,
      elevation,
      dividerColor,
    } = this.widget;
    const localizations = MaterialLocalizations.of(context);
    const items: (MaterialSlice | MaterialGap)[] = [];
    for (const [index, panel] of children.entries()) {
      const expanded = this.expanded(panel);
      const previous = children[index - 1];
      if (previous && (expanded || this.expanded(previous))) {
        items.push(new MaterialGap({ key: new ValueKey(index * 2 - 1), size: gap }));
      }
      const press = () => this.press(index, panel);
      const hint = expanded
        ? localizations.expandedIconTapHint
        : localizations.collapsedIconTapHint;
      const glyph = new ExpandIcon({
        color: expandIconColor,
        isExpanded: expanded,
        onPressed: press,
        padding: expandIconPadding,
        splashColor: panel.splashColor,
        highlightColor: panel.highlightColor,
      });
      const header = new Row([
        new Expanded(
          new AnimatedContainer({
            duration,
            curve: Curves.fastOutSlowIn,
            margin: expanded ? expandedHeaderPadding : EdgeInsets.zero,
            child: new ConstrainedBox(panel.headerBuilder(context, expanded), collapsedHeader),
          }),
        ),
        new Padding(
          EdgeInsetsDirectional.only({ end: 8 }),
          panel.canTapOnHeader
            ? new ExcludeFocus(new ExcludeSemantics(new IgnorePointer(glyph)))
            : new Semantics({ label: hint, container: true, child: glyph }),
        ),
      ]);
      const tappableHeader = panel.canTapOnHeader
        ? new MergeSemantics({
            child: new Semantics({
              button: true,
              onTapHint: hint,
              child: new InkWell({
                child: header,
                onTap: press,
                splashColor: panel.splashColor,
                highlightColor: panel.highlightColor,
              }),
            }),
          })
        : header;
      items.push(
        new MaterialSlice({
          key: new ValueKey(index * 2),
          color: panel.backgroundColor,
          child: new Column(
            [tappableHeader, new ExpansionPanelBody(panel.body, expanded, duration)],
            { mainSize: 'min', crossAlign: 'stretch' },
          ),
        }),
      );
    }
    return new MergeableMaterial({ children: items, elevation, dividerColor, hasDividers: true });
  }
}

class ExpansionPanelBody extends StatefulWidget {
  constructor(
    readonly child: Widget,
    readonly expanded: boolean,
    readonly duration: number,
  ) {
    super();
  }

  override createState(): State<ExpansionPanelBody> {
    return new ExpansionPanelBodyState();
  }
}

const bodyFade = new Interval(0.4, 1, { curve: Curves.fastOutSlowIn });
class ExpansionPanelBodyState extends SingleTickerProviderStateMixin<ExpansionPanelBody> {
  private controller!: AnimationController;
  private size!: Animation<number>;
  private opacity!: Animation<number>;

  override initState(): void {
    super.initState();
    this.controller = new AnimationController({
      vsync: this,
      value: this.widget.expanded ? 1 : 0,
      duration: this.widget.duration,
    });
    this.size = this.controller.drive(new CurveTween({ curve: Curves.fastOutSlowIn }));
    this.opacity = this.controller.drive(new CurveTween({ curve: bodyFade }));
  }

  override didUpdateWidget(old: ExpansionPanelBody): void {
    super.didUpdateWidget(old);
    this.controller.duration = this.widget.duration;
    if (old.expanded !== this.widget.expanded) {
      if (this.widget.expanded) this.controller.forward();
      else this.controller.reverse();
    }
  }

  override build(): Widget {
    const { expanded, child } = this.widget;
    return new SizeTransition({
      sizeFactor: this.size,
      alignment: Alignment.topCenter,
      child: new FadeTransition({
        opacity: this.opacity,
        child: new ExcludeFocus(
          new ExcludeSemantics({
            child: new IgnorePointer(child, { ignoring: !expanded }),
            excluding: !expanded,
          }),
          { excluding: !expanded },
        ),
      }),
    });
  }

  override dispose(): void {
    this.controller.dispose();
    super.dispose();
  }
}
