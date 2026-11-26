// SPDX-License-Identifier: BSD-3-Clause
import { Localizations } from '@nelyx/core/framework/widgets/app-data';
import { Text } from '@nelyx/core/framework/widgets/basic';
import { TextEditingController } from '@nelyx/core/framework/widgets/editable-text';
import { State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { Widget } from '@nelyx/core/framework/widgets/framework';
import { SingleBoxScrollView } from '@nelyx/core/framework/widgets/scroll-view';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { AppBar } from '@nelyx/material/app-bar';
import { DateTime, InputDatePickerFormField, showDatePicker } from '@nelyx/material/date-picker';
import { DateTimeRange, showDateRangePicker } from '@nelyx/material/date-range-picker';
import { InputDecoration } from '@nelyx/material/input-decoration';
import { MaterialLocalizations } from '@nelyx/material/material-localizations';
import { Scaffold } from '@nelyx/material/scaffold';
import { TextButton } from '@nelyx/material/text-button';
import { TextField } from '@nelyx/material/text-field';
import { column, flow } from './layout.ts';

export type DemoLocale = 'en-US' | 'ko-KR' | undefined;
export const localizationMessages = {
  en: {
    'locale.title': 'Language and dates',
    'locale.single': 'Choose a date',
    'locale.range': 'Choose a date range',
    'locale.english': 'English date dialog',
    'locale.portuguese': 'Portuguese date dialog',
    'locale.arabic': 'Arabic range dialog',
  },
  ko: {
    'locale.title': '언어와 날짜',
    'locale.single': '날짜 선택',
    'locale.range': '날짜 범위 선택',
    'locale.english': '영어 날짜 대화상자',
    'locale.portuguese': '포르투갈어 날짜 대화상자',
    'locale.arabic': '아랍어 범위 대화상자',
  },
};

const firstDate = new DateTime(2023, 1, 1);
const lastDate = new DateTime(2025, 12, 31);
const leapDay = new DateTime(2024, 2, 29);
const end = new DateTime(2024, 3, 2);

export class LocalizationScreen extends StatefulWidget {
  constructor(readonly onLocaleChanged: (locale: DemoLocale) => void) {
    super();
  }
  override createState(): State<LocalizationScreen> {
    return new LocalizationScreenState();
  }
}

class LocalizationScreenState extends State<LocalizationScreen> {
  private selected = leapDay;
  private range = new DateTimeRange({ start: leapDay, end });
  private readonly editor = new TextEditingController('Nelyx 한글 العربية');

  private async openDate(locale: string | null = null): Promise<void> {
    const date = await showDatePicker({
      context: this.context,
      locale,
      firstDate,
      lastDate,
      initialDate: this.selected,
    });
    if (this.mounted && date)
      this.setState(() => {
        this.selected = date;
      });
  }

  private async openRange(locale: string | null = null): Promise<void> {
    const range = await showDateRangePicker({
      context: this.context,
      locale,
      firstDate,
      lastDate,
      initialDateRange: this.range,
    });
    if (this.mounted && range)
      this.setState(() => {
        this.range = range;
      });
  }

  override build(): Widget {
    const localization = Localizations.of(this.context);
    const dates = MaterialLocalizations.of(this.context);
    const button = (label: string, onPressed: () => void) =>
      new TextButton({ child: new Text(label), onPressed });
    return new Scaffold({
      appBar: new AppBar({ title: new Text(localization.text('locale.title')) }),
      body: new SingleBoxScrollView({
        padding: EdgeInsets.all(20),
        child: column(
          flow(
            button('English (US)', () => this.widget.onLocaleChanged('en-US')),
            button('한국어', () => this.widget.onLocaleChanged('ko-KR')),
            button('System', () => this.widget.onLocaleChanged(undefined)),
          ),
          new Text(localization.locale),
          new TextField({
            id: 'localization-editor',
            controller: this.editor,
            decoration: new InputDecoration({ labelText: 'Sample text' }),
            style: new TextStyle({ fontFamilyFallback: ['NelyxArabic'] }),
          }),
          new InputDatePickerFormField({
            firstDate,
            lastDate,
            initialDate: this.selected,
            onDateSubmitted: (date) =>
              this.setState(() => {
                this.selected = date;
              }),
          }),
          new Text(dates.formatFullDate(this.selected)),
          flow(
            button(localization.text('locale.single'), () => this.openDate()),
            button(localization.text('locale.range'), () => this.openRange()),
          ),
          flow(
            button(localization.text('locale.english'), () => this.openDate('en-US')),
            button(localization.text('locale.portuguese'), () => this.openDate('pt-PT')),
            button(localization.text('locale.arabic'), () => this.openRange('ar-EG')),
          ),
        ),
      }),
    });
  }

  override dispose(): void {
    this.editor.dispose();
    super.dispose();
  }
}
