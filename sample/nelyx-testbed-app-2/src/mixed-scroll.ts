// SPDX-License-Identifier: BSD-3-Clause
import { State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import {
  Column,
  Row,
  Expanded,
  Padding,
  Text,
  SliverToBoxAdapter,
} from '@nelyx/core/framework/widgets/basic';
import { Icon } from '@nelyx/core/framework/widgets/icon';
import { CustomScrollView } from '@nelyx/core/framework/widgets/scroll-view';
import { ScrollController } from '@nelyx/core/framework/widgets/scroll-controller';
import { TextEditingController } from '@nelyx/core/framework/widgets/editable-text';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { Wrap } from '@nelyx/core/framework/widgets/wrap';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { Color } from '@nelyx/core/ui/color';
import { Card } from '@nelyx/material/card';
import { Divider } from '@nelyx/material/divider';
import { ElevatedButton } from '@nelyx/material/elevated-button';
import { FilledButton } from '@nelyx/material/filled-button';
import { IconButton } from '@nelyx/material/icon-button';
import { Icons } from '@nelyx/material/icons';
import { InputDecoration } from '@nelyx/material/input-decoration';
import { OutlineInputBorder } from '@nelyx/material/input-border';
import { Material } from '@nelyx/material/material';
import { OutlinedButton } from '@nelyx/material/outlined-button';
import { TextField } from '@nelyx/material/text-field';
import { Theme } from '@nelyx/material/theme';

const itemCount = 12;

/** Finite page content: every row is mounted at entry and lives until route close. */
export class MixedScrollPage extends StatefulWidget {
  readonly onBack: () => void;
  constructor(onBack: () => void) {
    super();
    this.onBack = onBack;
  }
  createState(): State<MixedScrollPage> {
    return new MixedScrollPageState();
  }
}

class MixedScrollPageState extends State<MixedScrollPage> {
  private readonly scroll = new ScrollController();
  private readonly content = new Column(
    Array.from({ length: itemCount }, (_, index) => new MixedScrollRow(index)),
    { crossAlign: 'stretch', spacing: 12, mainSize: 'min' },
  );

  override dispose(): void {
    this.scroll.dispose();
    super.dispose();
  }

  build(context: BuildContext): Widget {
    const colors = Theme.of(context).colorScheme;
    return new Material({
      color: new Color(colors.surface),
      child: new Column(
        [
          new Padding(
            EdgeInsets.fromLTRB(12, 12, 20, 8),
            new Row(
              [
                new IconButton({
                  id: 'mixed-scroll-back',
                  icon: new Icon(Icons.arrow_back),
                  tooltip: '갤러리로 돌아가기',
                  onPressed: this.widget.onBack,
                }),
                new Expanded(new Text('Text fields & buttons', { fontSize: 24 })),
              ],
              { crossAlign: 'center', spacing: 8 },
            ),
          ),
          new Padding(
            EdgeInsets.fromLTRB(20, 0, 20, 12),
            new Wrap(
              [
                new OutlinedButton({
                  id: 'mixed-scroll-first',
                  child: new Text('처음으로'),
                  onPressed: () => {
                    if (this.scroll.hasClients) this.scroll.jumpTo(0);
                  },
                }),
                new OutlinedButton({
                  id: 'mixed-scroll-last',
                  child: new Text('끝으로'),
                  onPressed: () => {
                    if (this.scroll.hasClients)
                      this.scroll.jumpTo(this.scroll.position.maxScrollExtent);
                  },
                }),
                new Text('텍스트필드 ' + itemCount + '개 · 버튼 ' + itemCount * 3 + '개', {
                  fontSize: 12,
                  color: colors.onSurfaceVariant,
                }),
              ],
              { spacing: 8, runSpacing: 8, crossAxisAlignment: 'center' },
            ),
          ),
          new Divider({ height: 1 }),
          new Expanded(
            new Material({
              color: new Color(colors.surface),
              clipBehavior: 'hardEdge',
              // One box owns the complete Column. No builder, child delegate or
              // visibility-based mounting: all rows build and lay out at entry.
              child: new CustomScrollView({
                controller: this.scroll,
                primary: false,
                slivers: [
                  new SliverToBoxAdapter({ child: new Padding(EdgeInsets.all(20), this.content) }),
                ],
              }),
            }),
          ),
        ],
        { crossAlign: 'stretch' },
      ),
    });
  }
}

class MixedScrollRow extends StatefulWidget {
  readonly index: number;
  constructor(index: number) {
    super();
    this.index = index;
  }
  createState(): State<MixedScrollRow> {
    return new MixedScrollRowState();
  }
}

class MixedScrollRowState extends State<MixedScrollRow> {
  private readonly text = new TextEditingController();
  private presses = 0;
  private message = '메시지를 입력하고 버튼을 눌러보세요.';

  override dispose(): void {
    this.text.dispose();
    super.dispose();
  }

  build(context: BuildContext): Widget {
    const index = this.widget.index,
      label = String(index + 1).padStart(2, '0'),
      colors = Theme.of(context).colorScheme;
    return new Card({
      margin: EdgeInsets.zero,
      child: new Padding(
        EdgeInsets.all(20),
        new Column(
          [
            new Text('항목 ' + label, { fontSize: 18 }),
            new TextField({
              id: 'mixed-scroll-field-' + index,
              controller: this.text,
              minLines: index % 3 === 2 ? 2 : 1,
              maxLines: index % 3 === 2 ? 3 : 1,
              decoration: new InputDecoration({
                labelText: '메시지 ' + label,
                filled: index % 2 === 0,
                ...(index % 2 ? { border: new OutlineInputBorder() } : {}),
              }),
            }),
            new Wrap(
              [
                new FilledButton({
                  id: 'mixed-scroll-send-' + index,
                  child: new Text('전송'),
                  onPressed: () =>
                    this.setState(() => {
                      this.message = this.text.text
                        ? '전송: ' + this.text.text
                        : '메시지가 비어 있습니다.';
                    }),
                }),
                new ElevatedButton({
                  id: 'mixed-scroll-count-' + index,
                  child: new Text('누른 횟수 ' + this.presses),
                  onPressed: () =>
                    this.setState(() => {
                      this.presses++;
                    }),
                }),
                new OutlinedButton({
                  id: 'mixed-scroll-clear-' + index,
                  child: new Text('초기화'),
                  onPressed: () => {
                    this.text.clear();
                    this.setState(() => {
                      this.presses = 0;
                      this.message = '메시지를 입력하고 버튼을 눌러보세요.';
                    });
                  },
                }),
              ],
              { spacing: 8, runSpacing: 8 },
            ),
            new Semantics({
              transportId: 'mixed-scroll-status-' + index,
              container: true,
              liveRegion: true,
              label: this.message,
              excludeSemantics: true,
              child: new Text(this.message, {
                color: colors.onSurfaceVariant,
                maxLines: 1,
                ellipsis: '…',
              }),
            }),
          ],
          { crossAlign: 'stretch', mainSize: 'min', spacing: 12 },
        ),
      ),
    });
  }
}
