// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { CupertinoTextThemeData, defaultCupertinoTextTheme } from '@nelyx/cupertino/text-theme';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { FontWeight, TextDecoration } from '@nelyx/core/ui/typography';
const timeout = 1_200_000,
  primary = 0xff123456,
  label = 0xff203040,
  inactive = 0xff506070;
// Pinned cupertino/text_theme.dart role defaults, using Nelyx's published
// CupertinoSystemText/Display font aliases and ARGB colour ABI.
const roles = {
  textStyle: [17, -0.41, null, label, 'CupertinoSystemText', TextDecoration.none],
  actionTextStyle: [17, -0.41, null, primary, 'CupertinoSystemText', TextDecoration.none],
  actionSmallTextStyle: [15, -0.23, null, primary, 'CupertinoSystemText', TextDecoration.none],
  tabLabelTextStyle: [10, -0.24, FontWeight.w500, inactive, 'CupertinoSystemText', null],
  navTitleTextStyle: [17, -0.41, FontWeight.w600, label, 'CupertinoSystemText', null],
  navLargeTitleTextStyle: [34, 0.38, FontWeight.w700, label, 'CupertinoSystemDisplay', null],
  navActionTextStyle: [17, -0.41, null, primary, 'CupertinoSystemText', TextDecoration.none],
  pickerTextStyle: [21, -0.6, FontWeight.w400, label, 'CupertinoSystemDisplay', null],
  dateTimePickerTextStyle: [21, 0.4, FontWeight.normal, label, 'CupertinoSystemDisplay', null],
};
test(
  'Cupertino text roles retain defaults, colour capture and stable public styles regardless of access order',
  { timeout },
  () => {
    const colors = { label, inactive },
      theme = new CupertinoTextThemeData({ primaryColor: primary }, colors);
    assert(Object.isFrozen(theme));
    colors.label = 0xffeeeeee;
    colors.inactive = 0xffdddddd;
    for (const role of Object.keys(roles).reverse()) {
      const style = theme[role];
      assert(style instanceof TextStyle);
      assert.equal(style, theme[role]);
      assert.equal(style.inherit, false);
      assert.deepEqual(
        [
          style.fontSize,
          style.letterSpacing,
          style.fontWeight,
          style.color,
          style.fontFamily,
          style.decoration,
        ],
        roles[role],
        role,
      );
    }
  },
);
test(
  'all caller overrides retain identity and copying leaves the original role values intact',
  { timeout },
  () => {
    const options = { primaryColor: primary },
      styles = new Map();
    for (const role of Object.keys(roles)) {
      const style = new TextStyle({ fontFamily: 'Caller', fontSize: 23, color: 0xffabcdef });
      styles.set(role, style);
      options[role] = style;
    }
    const theme = new CupertinoTextThemeData(options, { label, inactive });
    for (const role of Object.keys(roles)) {
      options[role] = null;
      assert.equal(theme[role], styles.get(role));
    }
    const copied = theme.copyWith({ primaryColor: 0xff998877 });
    for (const role of Object.keys(roles)) assert.equal(copied[role], styles.get(role));
    assert.equal(theme.primaryColor, primary);
    assert.equal(copied.primaryColor, 0xff998877);
    assert(
      theme.equals(
        new CupertinoTextThemeData(
          { ...Object.fromEntries(styles), primaryColor: primary },
          { label, inactive },
        ),
      ),
    );
  },
);
test(
  'default helper preserves contextual label colours and independent style copies',
  { timeout },
  () => {
    const theme = defaultCupertinoTextTheme(primary, { label, inactive });
    for (const role of Object.keys(roles)) {
      const style = theme[role];
      assert.equal(style.color, roles[role][3], role);
      assert.equal(style.fontSize, roles[role][0], role);
    }
    assert.notEqual(theme.textStyle, theme.textStyle);
    assert(theme.textStyle.equals(theme.textStyle));
    const replacement = theme.textStyle.copyWith({ fontSize: 29 });
    assert.equal(replacement.fontSize, 29);
    assert.equal(theme.textStyle.fontSize, 17);
  },
);
