// Inlined only into the Testbed diagnostic entry. The ordinary ListView page
// remains covered separately by SetupTestbed. This fixture uses public Source
// widgets, natural text heights and actual OS wheel input.
import { ListViewPage } from './src/list-view.ts';
import { State } from '@nelyx/core/framework/widgets/framework';
import { Column, Row, Expanded, Padding, Text } from '@nelyx/core/framework/widgets/basic';
import { ListView } from '@nelyx/core/framework/widgets/scroll-view';
import { ScrollController } from '@nelyx/core/framework/widgets/scroll-controller';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { Material } from '@nelyx/material/material';
import { TextButton } from '@nelyx/material/text-button';
import { Theme } from '@nelyx/material/theme';
import { Color } from '@nelyx/core/ui/color';

const originalListState = ListViewPage.prototype.createState;
class VariableListState extends State {
  scroll = new ScrollController({ debugLabel: 'list-view-page' });
  dispose() {
    this.scroll.dispose();
    super.dispose();
  }
  build(context) {
    const colors = Theme.of(context).colorScheme;
    return new Material({
      color: new Color(colors.surface),
      child: new Column(
        [
          new Row([
            new TextButton({
              id: 'list-view-back',
              child: new Text('돌아가기'),
              onPressed: this.widget.onBack,
            }),
            new Text('가변 높이 · 한글 😀 목록'),
          ]),
          new Expanded(
            ListView.builder({
              controller: this.scroll,
              primary: false,
              itemCount: 1000,
              padding: EdgeInsets.all(0),
              itemBuilder: (_context, index) =>
                new Padding(
                  EdgeInsets.all(8),
                  new TextButton({
                    id: 'list-view-item-' + index,
                    child: new Column(
                      [
                        new Text('항목 ' + (index + 1)),
                        new Text(
                          Array.from(
                            { length: (index % 4) + 1 },
                            (_, line) => '한글 😀 é 줄 ' + (line + 1),
                          ).join('\n'),
                        ),
                      ],
                      { crossAlign: 'stretch' },
                    ),
                    onPressed: () => {},
                  }),
                ),
            }),
          ),
        ],
        { crossAlign: 'stretch' },
      ),
    });
  }
}
ListViewPage.prototype.createState = () => new VariableListState();
export function restoreVariableList() {
  ListViewPage.prototype.createState = originalListState;
}
