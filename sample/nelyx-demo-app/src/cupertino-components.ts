// SPDX-License-Identifier: BSD-3-Clause
import { Alignment } from '@nelyx/core/framework/painting/alignment';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import {
  Align,
  Builder,
  ConstrainedBox,
  Expanded,
  Row,
  Text,
} from '@nelyx/core/framework/widgets/basic';
import { DefaultSelectionStyle } from '@nelyx/core/framework/widgets/default-selection-style';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import { TextEditingController } from '@nelyx/core/framework/widgets/editable-text';
import { State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import { Navigator, Route } from '@nelyx/core/framework/widgets/navigation';
import { SafeArea } from '@nelyx/core/framework/widgets/safe-area';
import { ScrollConfiguration } from '@nelyx/core/framework/widgets/scroll-configuration';
import { ListView } from '@nelyx/core/framework/widgets/scroll-view';
import { Color } from '@nelyx/core/ui/color';
import { CupertinoActionSheet, CupertinoActionSheetAction } from '@nelyx/cupertino/action-sheet';
import { CupertinoButton } from '@nelyx/cupertino/button';
import { CupertinoColors } from '@nelyx/cupertino/colors';
import { CupertinoAlertDialog, CupertinoDialogAction } from '@nelyx/cupertino/dialog';
import { CupertinoIcons } from '@nelyx/cupertino/icons';
import { CupertinoListSection } from '@nelyx/cupertino/list-section';
import { CupertinoListTile, CupertinoListTileChevron } from '@nelyx/cupertino/list-tile';
import { CupertinoNavigationBar } from '@nelyx/cupertino/nav-bar';
import { CupertinoPageScaffold } from '@nelyx/cupertino/page-scaffold';
import { showCupertinoDialog, showCupertinoModalPopup } from '@nelyx/cupertino/route';
import { CupertinoScrollBehavior } from '@nelyx/cupertino/scroll-behavior';
import { CupertinoSlider } from '@nelyx/cupertino/slider';
import { CupertinoSlidingSegmentedControl } from '@nelyx/cupertino/sliding-segmented-control';
import { CupertinoSwitch } from '@nelyx/cupertino/switch';
import { CupertinoTextField, OverlayVisibilityMode } from '@nelyx/cupertino/text-field';
import { CupertinoTheme, CupertinoThemeData } from '@nelyx/cupertino/theme';
import { column, icon, inset } from './layout.ts';
import { TextSelectionScreen } from './text-selection-screen.ts';

const periods = ['Day', 'Week', 'Month'] as const;
type Period = (typeof periods)[number];
const textStyle = new TextStyle({
  fontFamily: 'NelyxSample',
  fontFamilyFallback: ['NelyxEmoji', 'NelyxHebrew', 'NelyxArabic'],
});
const scrollBehavior = new CupertinoScrollBehavior();

function actionRow(label: string, onPressed: () => void, value?: string): Widget {
  return new CupertinoButton({
    semanticsLabel: value === undefined ? label : label + ', ' + value,
    padding: EdgeInsets.zero,
    minimumSize: { width: 0, height: 44 },
    child: new CupertinoListTile({
      title: new Text(label),
      additionalInfo: value === undefined ? null : new Text(value),
      trailing: new CupertinoListTileChevron(),
    }),
    onPressed,
  });
}

export class CupertinoComponentsScreen extends StatefulWidget {
  constructor(
    readonly initialText: string,
    readonly dark: boolean,
    readonly toggleBrightness: () => void,
    readonly acrylic = false,
  ) {
    super();
  }

  createState(): State<CupertinoComponentsScreen> {
    return new CupertinoComponentsState();
  }
}

class CupertinoComponentsState extends State<CupertinoComponentsScreen> {
  private singleLine!: TextEditingController;
  private multiline!: TextEditingController;
  private notifications = false;
  private volume = 40;
  private period: Period = 'Week';

  private get sampleText(): string {
    return this.widget.initialText + ' 👋 שלום';
  }

  private get sampleParagraph(): string {
    return this.sampleText + '\nSelect across lines · 선택 영역\nمرحبا · End of the sample';
  }

  override initState(): void {
    super.initState();
    this.singleLine = new TextEditingController(this.sampleText);
    this.multiline = new TextEditingController(this.sampleParagraph);
  }

  override dispose(): void {
    this.singleLine.dispose();
    this.multiline.dispose();
    super.dispose();
  }

  private async choosePeriod(context: BuildContext): Promise<void> {
    const navigator = Navigator.of(context);
    const theme = CupertinoTheme.of(context);
    const period = await showCupertinoModalPopup<Period>(context, {
      builder: () =>
        new CupertinoTheme(
          theme,
          new CupertinoActionSheet({
            title: new Text('Choose a period'),
            actions: periods.map(
              (value) =>
                new CupertinoActionSheetAction({
                  child: new Text(value),
                  isDefaultAction: value === this.period,
                  onPressed: () => {
                    void navigator.pop(value);
                  },
                }),
            ),
            cancelButton: new CupertinoActionSheetAction({
              child: new Text('Cancel'),
              onPressed: () => {
                void navigator.pop();
              },
            }),
          }),
        ),
    });
    if (this.mounted && period !== undefined)
      this.setState(() => {
        this.period = period;
      });
  }

  private async confirmReset(context: BuildContext): Promise<void> {
    const navigator = Navigator.of(context);
    const reset = await showCupertinoDialog<boolean>(context, {
      builder: () =>
        new CupertinoAlertDialog({
          title: new Text('Reset examples?'),
          content: new Text('The sample text and controls will return to their defaults.'),
          actions: [
            new CupertinoDialogAction({
              child: new Text('Cancel'),
              isDefaultAction: true,
              onPressed: () => {
                void navigator.pop();
              },
            }),
            new CupertinoDialogAction({
              child: new Text('Reset'),
              isDestructiveAction: true,
              onPressed: () => {
                void navigator.pop(true);
              },
            }),
          ],
        }),
    });
    if (this.mounted && reset === true)
      this.setState(() => {
        this.singleLine.text = this.sampleText;
        this.multiline.text = this.sampleParagraph;
        this.notifications = false;
        this.volume = 40;
        this.period = 'Week';
      });
  }

  private textInputs(context: BuildContext): Widget {
    const labelColor = CupertinoColors.secondaryLabel.resolveFrom(context).toARGB32();
    return CupertinoListSection.insetGrouped({
      header: new Text('Text input'),
      hasLeading: false,
      children: [
        inset(
          16,
          column(
            new Text('Single line', { fontSize: 13, color: labelColor }),
            new CupertinoTextField({
              id: 'cupertino-demo-single',
              placeholder: 'Single line',
              controller: this.singleLine,
              style: textStyle,
              clearButtonMode: OverlayVisibilityMode.editing,
            }),
            new Text('Multiline', { fontSize: 13, color: labelColor }),
            new CupertinoTextField({
              id: 'cupertino-demo-multiline',
              placeholder: 'Multiline',
              controller: this.multiline,
              style: textStyle,
              minLines: 3,
              maxLines: 3,
            }),
          ),
        ),
        actionRow('Text selection examples', () => {
          const navigator = Navigator.of(context);
          void navigator.push(
            new Route(() => new TextSelectionScreen(navigator), '/text-selection'),
          );
        }),
      ],
    });
  }

  private controls(): Widget {
    return CupertinoListSection.insetGrouped({
      header: new Text('Controls'),
      hasLeading: false,
      children: [
        new CupertinoListTile({
          title: new Text('Notifications'),
          trailing: new CupertinoSwitch({
            id: 'cupertino-demo-notifications',
            semanticLabel: 'Notifications',
            value: this.notifications,
            onChanged: (value) =>
              this.setState(() => {
                this.notifications = value;
              }),
          }),
        }),
        inset(
          16,
          column(
            new Row([new Expanded(new Text('Volume')), new Text(this.volume + '%')]),
            new CupertinoSlider({
              id: 'cupertino-demo-volume',
              min: 0,
              max: 100,
              divisions: 20,
              value: this.volume,
              onChanged: (value) =>
                this.setState(() => {
                  this.volume = Math.round(value);
                }),
            }),
            new Text('Period'),
            new CupertinoSlidingSegmentedControl<Period>({
              children: new Map(periods.map((period) => [period, new Text(period)])),
              groupValue: this.period,
              onValueChanged: (value) => {
                if (value !== null)
                  this.setState(() => {
                    this.period = value;
                  });
              },
            }),
          ),
        ),
      ],
    });
  }

  build(): Widget {
    return new CupertinoTheme(
      new CupertinoThemeData({ brightness: this.widget.dark ? 'dark' : 'light' }),
      new Builder((context) => {
        const theme = CupertinoTheme.of(context);
        return new DefaultTextStyle(
          theme.textTheme.textStyle.merge(textStyle),
          new DefaultSelectionStyle({
            cursorColor: theme.primaryColor,
            selectionColor: new Color(theme.primaryColor).withOpacity(0.2).toARGB32(),
            child: new CupertinoPageScaffold({
              backgroundColor: this.widget.acrylic
                ? new Color(0)
                : CupertinoColors.systemGroupedBackground,
              navigationBar: new CupertinoNavigationBar({
                middle: new Text('Cupertino'),
                automaticallyImplyLeading: false,
                backgroundColor: CupertinoColors.systemBackground,
                leading: new CupertinoButton({
                  padding: EdgeInsets.zero,
                  minimumSize: { width: 44, height: 44 },
                  semanticsLabel: this.widget.dark ? 'Switch to light mode' : 'Switch to dark mode',
                  child: icon(this.widget.dark ? CupertinoIcons.sun_max : CupertinoIcons.moon_fill),
                  onPressed: this.widget.toggleBrightness,
                }),
              }),
              child: new SafeArea({
                top: false,
                bottom: false,
                child: new Align(
                  new ConstrainedBox(
                    new ScrollConfiguration({
                      behavior: scrollBehavior,
                      child: new ListView({
                        primary: false,
                        padding: EdgeInsets.symmetric({ vertical: 12 }),
                        children: [
                          this.textInputs(context),
                          this.controls(),
                          CupertinoListSection.insetGrouped({
                            header: new Text('Actions'),
                            hasLeading: false,
                            children: [
                              actionRow(
                                'Choose a period',
                                () => void this.choosePeriod(context),
                                this.period,
                              ),
                              actionRow('Reset examples', () => void this.confirmReset(context)),
                            ],
                          }),
                        ],
                      }),
                    }),
                    new BoxConstraints(0, 760),
                  ),
                  { alignment: Alignment.topCenter },
                ),
              }),
            }),
          }),
        );
      }),
    );
  }
}
