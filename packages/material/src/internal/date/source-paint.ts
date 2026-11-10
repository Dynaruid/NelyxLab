// SPDX-License-Identifier: BSD-3-Clause
import { Color } from '@nelyx/core/ui/color';
import { Text } from '@nelyx/core/framework/widgets/basic';
import type { TextOptions } from '@nelyx/core/framework/widgets/basic';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { BorderSide, withSourceBorderSideColor } from '@nelyx/core/framework/painting/borders';
import type { OutlinedBorder } from '@nelyx/core/framework/painting/borders';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
export { sourceBorderSideColor as dateBorderSideColor } from '@nelyx/core/framework/painting/borders';
const colors = new WeakMap<TextStyle, Color>();
export function dateTextStyleColor(style: TextStyle): Color | null {
  return colors.get(style) ?? (style.color === null ? null : new Color(style.color));
}
function capture(style: TextStyle, color: Color | null): TextStyle {
  if (color !== null) colors.set(style, color);
  return style;
}
export function dateTextStyleApply(
  style: TextStyle,
  { color = null }: { color?: Color | null },
): TextStyle {
  return capture(
    style.apply({ color: color?.toARGB32() ?? null }),
    color ?? dateTextStyleColor(style),
  );
}
export function dateTextStyleCopyWith(
  style: TextStyle,
  { color = null }: { color?: Color | null },
): TextStyle {
  return capture(
    style.copyWith({ color: color?.toARGB32() ?? null }),
    color ?? dateTextStyleColor(style),
  );
}
export function dateBorderSideCopyWith(
  side: BorderSide,
  { color = null }: { color?: Color | null },
): BorderSide {
  return color === null ? side.copyWith() : withSourceBorderSideColor(side, color);
}
export function dateOutlinedBorderCopyWith(
  border: OutlinedBorder,
  { side = null }: { side?: BorderSide | null },
): OutlinedBorder {
  return border.copyWith(side === null ? {} : { side });
}
class SourceDateText extends Text {
  constructor(
    text: string,
    options: TextOptions,
    readonly semanticsLabel: string,
  ) {
    super(text, options);
  }
  override build(context: BuildContext): Widget {
    return new Semantics({
      label: this.semanticsLabel,
      excludeSemantics: true,
      child: super.build(context),
    });
  }
}
export function dateText(
  value: string,
  {
    style = null,
    semanticsLabel = null,
    ...options
  }: Omit<TextOptions, 'style'> & { style?: TextStyle | null; semanticsLabel?: string | null } = {},
): Text {
  const input = { ...options, ...(style === null ? {} : { style }) };
  return semanticsLabel === null
    ? new Text(value, input)
    : new SourceDateText(value, input, semanticsLabel);
}
