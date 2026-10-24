// SPDX-License-Identifier: BSD-3-Clause
import {State, StatefulWidget} from '@nelyx/core/framework/widgets/framework';
import type {BuildContext, Widget} from '@nelyx/core/framework/widgets/framework';
import {Column, Row, Expanded, Padding, Text} from '@nelyx/core/framework/widgets/basic';
import {Icon} from '@nelyx/core/framework/widgets/icon';
import {ListView} from '@nelyx/core/framework/widgets/scroll-view';
import {ScrollController} from '@nelyx/core/framework/widgets/scroll-controller';
import {RepaintBoundary} from '@nelyx/core/framework/widgets/repaint-boundary';
import {Wrap} from '@nelyx/core/framework/widgets/wrap';
import {EdgeInsets} from '@nelyx/core/framework/painting/edge-insets';
import {Color} from '@nelyx/core/ui/color';
import {Divider} from '@nelyx/material/divider';
import {IconButton} from '@nelyx/material/icon-button';
import {Icons} from '@nelyx/material/icons';
import {ListTile} from '@nelyx/material/list-tile';
import {Material} from '@nelyx/material/material';
import {OutlinedButton} from '@nelyx/material/outlined-button';
import {TextButton} from '@nelyx/material/text-button';
import {Theme} from '@nelyx/material/theme';

const itemCount = 1000;
const itemLabel = (index: number): string => '항목 ' + String(index + 1).padStart(4, '0');

/** A separate route owns its scroll position and selection until it is closed. */
export class ListViewPage extends StatefulWidget {
  constructor(readonly onBack: () => void) {super();}
  createState(): State<ListViewPage> {return new ListViewPageState();}
}

class ListViewPageState extends State<ListViewPage> {
  private readonly scroll = new ScrollController({debugLabel: 'list-view-page'});
  private selected: number | null = null;

  override dispose(): void {this.scroll.dispose(); super.dispose();}

  private jump(toEnd: boolean): void {
    if (this.scroll.hasClients) this.scroll.jumpTo(toEnd ? this.scroll.position.maxScrollExtent : 0);
  }

  build(context: BuildContext): Widget {
    const colors = Theme.of(context).colorScheme;
    return new RepaintBoundary(new Material({color: new Color(colors.surface), child: new Column([
      new Padding(EdgeInsets.fromLTRB(12, 12, 20, 8), new Row([
        new IconButton({id: 'list-view-back', icon: new Icon(Icons.arrow_back), tooltip: '갤러리로 돌아가기', onPressed: this.widget.onBack}),
        new Expanded(new Text('ListView', {fontSize: 24})),
        new Text('1,000개 항목', {fontSize: 12, color: colors.onSurfaceVariant}),
      ], {crossAlign: 'center', spacing: 8})),
      new Padding(EdgeInsets.fromLTRB(20, 0, 20, 12), new Wrap([
        new OutlinedButton({id: 'list-view-first', child: new Text('처음으로'), onPressed: () => this.jump(false)}),
        new OutlinedButton({id: 'list-view-last', child: new Text('끝으로'), onPressed: () => this.jump(true)}),
        new TextButton({id: 'list-view-clear', child: new Text('선택 해제'), onPressed: this.selected === null ? null : () => this.setState(() => {this.selected = null;})}),
      ], {spacing: 8, runSpacing: 8})),
      new Divider({height: 1}),
      // Ink paints on its nearest Material, before the viewport's child pass.
      // Give the whole list one owner whose clip excludes the page chrome.
      // Its moving ink also owns a recording, so the title/buttons stay retained.
      new Expanded(new RepaintBoundary(new Material({color: new Color(colors.surface), clipBehavior: 'hardEdge', child: ListView.builder({
        controller: this.scroll, primary: false, padding: EdgeInsets.all(0),
        itemCount, itemExtent: 80,
        itemBuilder: (_context, index) => new Column([
          new Expanded(new ListTile({
            id: 'list-view-item-' + index,
            leading: new Icon(Icons.view_list, {size: 24}),
            title: new Text(itemLabel(index), {maxLines: 1, ellipsis: '…'}),
            subtitle: new Text('그룹 ' + String(Math.floor(index / 100) + 1).padStart(2, '0') + ' · 탭하여 선택', {maxLines: 1, ellipsis: '…'}),
            trailing: new Icon(this.selected === index ? Icons.check_circle : Icons.chevron_right, {size: 22}),
            selected: this.selected === index,
            selectedTileColor: new Color(colors.secondaryContainer),
            onTap: () => this.setState(() => {this.selected = index;}),
          })),
          new Divider({height: 1, indent: 56}),
        ], {crossAlign: 'stretch'}),
      })}))),
      new Divider({height: 1}),
      new Padding(EdgeInsets.symmetric({horizontal: 20, vertical: 12}), new Text(
        this.selected === null ? '항목을 선택하세요.' : '선택: ' + itemLabel(this.selected),
        {fontSize: 14, color: colors.onSurfaceVariant, maxLines: 1},
      )),
    ], {crossAlign: 'stretch'})}));
  }
}
