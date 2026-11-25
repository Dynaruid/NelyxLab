// SPDX-License-Identifier: BSD-3-Clause
import { Column, Padding } from '@nelyx/core/framework/widgets/basic';
import type { Widget } from '@nelyx/core/framework/widgets/framework';
import { Wrap } from '@nelyx/core/framework/widgets/wrap';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { Icon } from '@nelyx/core/framework/widgets/icon';
import type { IconData } from '@nelyx/core/framework/widgets/icon-data';
import { Color } from '@nelyx/core/ui/color';

export const column = (...children: Widget[]): Widget =>
  new Column(children, { mainSize: 'min', crossAlign: 'stretch', spacing: 12 });
export const flow = (...children: Widget[]): Widget =>
  new Wrap(children, { spacing: 10, runSpacing: 10, crossAxisAlignment: 'center' });
export const inset = (value: number, child: Widget): Widget =>
  new Padding(EdgeInsets.all(value), child);
export const icon = (data: IconData, color?: number, size = 22): Icon =>
  new Icon(data, { size, ...(color === undefined ? {} : { color: new Color(color) }) });
