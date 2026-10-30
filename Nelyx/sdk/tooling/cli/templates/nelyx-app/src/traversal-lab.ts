// SPDX-License-Identifier: BSD-3-Clause
import { StatefulWidget, State } from '@nelyx/core/framework/widgets/framework';
import type { Widget, BuildContext } from '@nelyx/core/framework/widgets/framework';
import { Column, Row, Expanded, Padding, Text } from '@nelyx/core/framework/widgets/basic';
import { Focus, FocusScope } from '@nelyx/core/framework/widgets/focus-scope';
import { FocusScopeNode } from '@nelyx/core/framework/widgets/focus';
import { FocusTraversalGroup } from '@nelyx/core/framework/widgets/focus-traversal-group';
import { FocusTraversalOrder } from '@nelyx/core/framework/widgets/focus-traversal-order';
import {
  OrderedTraversalPolicy,
  NumericFocusOrder,
  LexicalFocusOrder,
} from '@nelyx/core/framework/widgets/focus-traversal-policy';
import type { TraversalEdgeBehavior } from '@nelyx/core/framework/widgets/focus-traversal-policy';
import { Directionality, AppTheme } from '@nelyx/core/framework/widgets/app-data';
import { Scaffold, FilledButton } from '@nelyx/material/widgets';
import { ScrollController, SingleChildScrollView } from '@nelyx/core/framework/widgets/scroll';
import type { FrameScheduler } from '@nelyx/core/framework/scheduler/scheduler';
import { allInsets } from '@nelyx/core/ui/geometry';

/** A complete keyboard route with independent policies, live order and scope edges. */
export class TraversalLab extends StatefulWidget {
  constructor(
    readonly scheduler: FrameScheduler,
    readonly onBack: () => void,
  ) {
    super();
  }
  createState(): State {
    return new TraversalLabState();
  }
}
class TraversalLabState extends State<TraversalLab> {
  private readonly scroll = new ScrollController();
  private readonly numericScope = new FocusScopeNode({ debugLabel: 'Numeric grid' });
  private readonly numericPolicy = new OrderedTraversalPolicy();
  private readonly lexicalPolicy = new OrderedTraversalPolicy();
  private rtl = false;
  private reverse = false;
  private includeNumeric = true;
  private enableB = true;
  private edge: TraversalEdgeBehavior = 'parentScope';
  private focused = 'none';
  private activated = 'none';
  private count = 0;
  private button(
    id: string,
    label: string,
    onPressed: (() => void) | undefined,
    focusLabel = label,
  ): Widget {
    return new Focus(new FilledButton(id, label, onPressed), {
      canRequestFocus: false,
      skipTraversal: true,
      includeSemantics: false,
      onFocusChange: (value) => {
        if (!this.mounted) return;
        const next = value ? focusLabel : this.focused === focusLabel ? 'none' : this.focused;
        if (next !== this.focused)
          this.setState(() => {
            this.focused = next;
          });
      },
    });
  }
  private target(letter: string, number: number): Widget {
    const label = 'Numeric ' + letter,
      button = this.button(
        'traversal-numeric-' + letter,
        label,
        letter === 'B' && !this.enableB ? undefined : () => this.activateTarget(label),
      );
    return new Expanded(
      new FocusTraversalOrder(new NumericFocusOrder(this.reverse ? -number : number), button),
    );
  }
  private activateTarget(label: string): void {
    this.setState(() => {
      this.activated = label;
      this.count++;
    });
  }
  override dispose(): void {
    this.numericScope.dispose();
    this.scroll.dispose();
  }
  build(context: BuildContext): Widget {
    const color = AppTheme.of(context).foreground;
    const grid = new FocusScope(
      new FocusTraversalGroup(
        new Column(
          [
            new Row([this.target('A', 3), this.target('B', 1)], { spacing: 8 }),
            new Row([this.target('C', 4), this.target('D', 2)], { spacing: 8 }),
          ],
          { spacing: 8, crossAlign: 'stretch' },
        ),
        { policy: this.numericPolicy, descendantsAreTraversable: this.includeNumeric },
      ),
      {
        node: this.numericScope,
        includeSemantics: false,
        skipTraversal: !this.includeNumeric,
        traversalEdgeBehavior: this.edge,
        directionalTraversalEdgeBehavior: this.edge,
      },
    );
    const lexical = new FocusTraversalGroup(
      new Row(
        [
          new Expanded(
            new FocusTraversalOrder(
              new LexicalFocusOrder('beta'),
              this.button('traversal-beta', 'Lexical beta', () =>
                this.activateTarget('Lexical beta'),
              ),
            ),
          ),
          new Expanded(
            new FocusTraversalOrder(
              new LexicalFocusOrder('alpha'),
              this.button('traversal-alpha', 'Lexical alpha', () =>
                this.activateTarget('Lexical alpha'),
              ),
            ),
          ),
        ],
        { spacing: 8 },
      ),
      { policy: this.lexicalPolicy },
    );
    return new Scaffold(
      'Traversal lab',
      new SingleChildScrollView(
        new Padding(
          allInsets(12),
          new Directionality(
            this.rtl ? 'rtl' : 'ltr',
            new Column(
              [
                new Text('Tab follows explicit order. Arrows follow geometry.', {
                  fontSize: 15,
                  color,
                }),
                new Text('Focus: ' + this.focused, { fontSize: 18, color }),
                new Text(`Activated: ${this.activated} · ${this.count}`, { fontSize: 16, color }),
                this.button(
                  'traversal-direction',
                  this.rtl ? 'Direction: RTL' : 'Direction: LTR',
                  () =>
                    this.setState(() => {
                      this.rtl = !this.rtl;
                    }),
                  'Direction',
                ),
                this.button(
                  'traversal-order',
                  this.reverse ? 'Order: C A D B' : 'Order: B D A C',
                  () =>
                    this.setState(() => {
                      this.reverse = !this.reverse;
                    }),
                  'Order',
                ),
                this.button(
                  'traversal-enable',
                  this.enableB ? 'Disable Numeric B' : 'Enable Numeric B',
                  () =>
                    this.setState(() => {
                      this.enableB = !this.enableB;
                    }),
                  'Enable',
                ),
                this.button(
                  'traversal-skip',
                  this.includeNumeric ? 'Skip numeric group' : 'Include numeric group',
                  () =>
                    this.setState(() => {
                      this.includeNumeric = !this.includeNumeric;
                    }),
                  'Traversal',
                ),
                this.button(
                  'traversal-edge',
                  'Edge: ' + this.edge,
                  () =>
                    this.setState(() => {
                      this.edge =
                        this.edge === 'parentScope'
                          ? 'closedLoop'
                          : this.edge === 'closedLoop'
                            ? 'stop'
                            : 'parentScope';
                    }),
                  'Edge',
                ),
                grid,
                lexical,
              ],
              { spacing: 10, crossAlign: 'stretch' },
            ),
          ),
        ),
        this.scroll,
        this.widget.scheduler,
      ),
      this.button('traversal-back', 'Back', this.widget.onBack),
    );
  }
}
