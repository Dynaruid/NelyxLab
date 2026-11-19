// SPDX-License-Identifier: BSD-3-Clause
import { invariant } from '@nelyx/core/foundation/errors';
import { Curves } from '@nelyx/core/framework/animation/curves';
import { Alignment } from '@nelyx/core/framework/painting/alignment';
import { EdgeInsets, EdgeInsetsDirectional } from '@nelyx/core/framework/painting/edge-insets';
import { valueEquals } from '@nelyx/core/framework/painting/value-equality';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { AnimatedSize } from '@nelyx/core/framework/widgets/animated-size';
import {
  Column,
  ConstrainedBox,
  Expanded,
  Padding,
  Row,
  SizedBox,
} from '@nelyx/core/framework/widgets/basic';
import { State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { Icon } from '@nelyx/core/framework/widgets/icon';
import { AnimatedContainer } from '@nelyx/core/framework/widgets/implicit-animations';
import { MergeSemantics, Semantics } from '@nelyx/core/framework/widgets/semantics';
import { Visibility } from '@nelyx/core/framework/widgets/visibility';
import type { Color } from '@nelyx/core/ui/color';
import { Divider } from './divider.ts';
import { IconButton } from './icon-button.ts';
import { Icons } from './icons.ts';
import { InkWell } from './ink-well.ts';
import { Material } from './material.ts';

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

const headerPadding = EdgeInsets.symmetric({ vertical: 16 });
const collapsedHeader = new BoxConstraints(0, Infinity, 48);

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
    return new Column(
      children.map((panel, index) => {
        const expanded = this.expanded(panel);
        const previous = children[index - 1];
        const split = previous !== undefined && expanded !== this.expanded(previous);
        const press = () => this.press(index, panel);
        const hint = expanded ? 'Collapse' : 'Expand';
        const glyph = new Icon(
          expanded ? Icons.expand_less : Icons.expand_more,
          expandIconColor ? { color: expandIconColor } : {},
        );
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
              ? new SizedBox(48, 48, glyph)
              : new IconButton({
                  icon: glyph,
                  onPressed: press,
                  tooltip: hint,
                  splashColor: panel.splashColor,
                  highlightColor: panel.highlightColor,
                }),
          ),
        ]);
        return new Column(
          [
            new AnimatedSize({ duration, child: new SizedBox(undefined, split ? gap : 0) }),
            new Material({
              color: panel.backgroundColor,
              elevation: expanded ? elevation : 0,
              child: new Column(
                [
                  panel.canTapOnHeader
                    ? new MergeSemantics({
                        child: new Semantics({
                          button: true,
                          child: new InkWell({
                            child: header,
                            onTap: press,
                            splashColor: panel.splashColor,
                            highlightColor: panel.highlightColor,
                          }),
                        }),
                      })
                    : header,
                  new AnimatedSize({
                    duration,
                    alignment: Alignment.topCenter,
                    curve: Curves.fastOutSlowIn,
                    child: new Visibility(panel.body, { visible: expanded, maintainState: true }),
                  }),
                ],
                { mainSize: 'min', crossAlign: 'stretch' },
              ),
            }),
            !expanded && index + 1 < children.length && !this.expanded(children[index + 1]!)
              ? new Divider({ height: 1, color: dividerColor })
              : new SizedBox(0, 0),
          ],
          { mainSize: 'min', crossAlign: 'stretch' },
        );
      }),
      { mainSize: 'min', crossAlign: 'stretch' },
    );
  }
}
