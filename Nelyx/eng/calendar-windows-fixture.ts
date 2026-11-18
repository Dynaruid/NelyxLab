// SPDX-License-Identifier: BSD-3-Clause
import { defineApp } from '@nelyx/sdk/app';
import { Center, SizedBox } from '@nelyx/core/framework/widgets/basic';
import { MaterialApp } from '@nelyx/material/app';
import { Material } from '@nelyx/material/material';
import { ColorScheme } from '@nelyx/material/color-scheme';
import { ThemeData } from '@nelyx/material/theme-data';
import { CalendarDatePicker, DateTime } from '@nelyx/material/date-picker';

export function main() {
  return { definition: defineApp({
    id: 'calendar.compare', defaultFont: 'sample-font', accessibilityEnabled: true,
    createRoot: () => new MaterialApp({
      locale: 'en-US',
      theme: new ThemeData({ fontFamily: 'NelyxSample', colorScheme: ColorScheme.fromSeed({ seedColor: 0xff6750a4 }) }),
      home: new Material({ child: new Center(new SizedBox(360, 400, new CalendarDatePicker({
        initialDate: new DateTime(2025, 2, 15), currentDate: new DateTime(2025, 2, 15),
        firstDate: new DateTime(2024, 1, 1), lastDate: new DateTime(2026, 12, 31),
        onDateChanged() {},
      }))) }),
    }),
  }) };
}
