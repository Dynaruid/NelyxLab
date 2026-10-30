// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/cupertino/colors.dart; SHA256 2fc790aaae0252327e59ed52d4e167cb85933d1959ffcb91da33496e2d4f98e7
import { protect } from '@nelyx/core/internal/ui/value-math';
import { Color } from '@nelyx/core/ui/color';
import { constSourceColor } from '@nelyx/core/internal/ui/color-source-adapter';
import { CupertinoDynamicColor } from './dynamic-color.generated.ts';
import { constCupertinoDynamicColorWithBrightness } from './dynamic-color.generated.ts';
import { constSourceColorARGB } from '@nelyx/core/internal/ui/color-source-adapter';
import { constCupertinoDynamicColor } from './dynamic-color.generated.ts';
import { constCupertinoDynamicColorWithBrightnessAndContrast } from './dynamic-color.generated.ts';
export abstract class CupertinoColors {
  static readonly systemBlue: CupertinoDynamicColor =
    constCupertinoDynamicColorWithBrightnessAndContrast({
      debugLabel: 'systemBlue',
      color: constSourceColorARGB(Color, 255, 0, 122, 255),
      darkColor: constSourceColorARGB(Color, 255, 10, 132, 255),
      highContrastColor: constSourceColorARGB(Color, 255, 0, 64, 221),
      darkHighContrastColor: constSourceColorARGB(Color, 255, 64, 156, 255),
    });
  static readonly activeBlue: CupertinoDynamicColor = CupertinoColors.systemBlue;
  static readonly systemGreen: CupertinoDynamicColor =
    constCupertinoDynamicColorWithBrightnessAndContrast({
      debugLabel: 'systemGreen',
      color: constSourceColorARGB(Color, 255, 52, 199, 89),
      darkColor: constSourceColorARGB(Color, 255, 48, 209, 88),
      highContrastColor: constSourceColorARGB(Color, 255, 36, 138, 61),
      darkHighContrastColor: constSourceColorARGB(Color, 255, 48, 219, 91),
    });
  static readonly activeGreen: CupertinoDynamicColor = CupertinoColors.systemGreen;
  static readonly systemOrange: CupertinoDynamicColor =
    constCupertinoDynamicColorWithBrightnessAndContrast({
      debugLabel: 'systemOrange',
      color: constSourceColorARGB(Color, 255, 255, 149, 0),
      darkColor: constSourceColorARGB(Color, 255, 255, 159, 10),
      highContrastColor: constSourceColorARGB(Color, 255, 201, 52, 0),
      darkHighContrastColor: constSourceColorARGB(Color, 255, 255, 179, 64),
    });
  static readonly activeOrange: CupertinoDynamicColor = CupertinoColors.systemOrange;
  static readonly white: Color = constSourceColor(Color, 4294967295);
  static readonly black: Color = constSourceColor(Color, 4278190080);
  static readonly transparent: Color = constSourceColor(Color, 0);
  static readonly lightBackgroundGray: Color = constSourceColor(Color, 4293256682);
  static readonly extraLightBackgroundGray: Color = constSourceColor(Color, 4293914612);
  static readonly darkBackgroundGray: Color = constSourceColor(Color, 4279703319);
  static readonly inactiveGray: CupertinoDynamicColor = constCupertinoDynamicColorWithBrightness({
    debugLabel: 'inactiveGray',
    color: constSourceColor(Color, 4288256409),
    darkColor: constSourceColor(Color, 4285887861),
  });
  static readonly systemRed: CupertinoDynamicColor =
    constCupertinoDynamicColorWithBrightnessAndContrast({
      debugLabel: 'systemRed',
      color: constSourceColorARGB(Color, 255, 255, 59, 48),
      darkColor: constSourceColorARGB(Color, 255, 255, 69, 58),
      highContrastColor: constSourceColorARGB(Color, 255, 215, 0, 21),
      darkHighContrastColor: constSourceColorARGB(Color, 255, 255, 105, 97),
    });
  static readonly destructiveRed: CupertinoDynamicColor = CupertinoColors.systemRed;
  static readonly systemMint: CupertinoDynamicColor =
    constCupertinoDynamicColorWithBrightnessAndContrast({
      debugLabel: 'systemMint',
      color: constSourceColorARGB(Color, 255, 0, 199, 190),
      darkColor: constSourceColorARGB(Color, 255, 99, 230, 226),
      highContrastColor: constSourceColorARGB(Color, 255, 12, 129, 123),
      darkHighContrastColor: constSourceColorARGB(Color, 255, 102, 212, 207),
    });
  static readonly systemIndigo: CupertinoDynamicColor =
    constCupertinoDynamicColorWithBrightnessAndContrast({
      debugLabel: 'systemIndigo',
      color: constSourceColorARGB(Color, 255, 88, 86, 214),
      darkColor: constSourceColorARGB(Color, 255, 94, 92, 230),
      highContrastColor: constSourceColorARGB(Color, 255, 54, 52, 163),
      darkHighContrastColor: constSourceColorARGB(Color, 255, 125, 122, 255),
    });
  static readonly systemPink: CupertinoDynamicColor =
    constCupertinoDynamicColorWithBrightnessAndContrast({
      debugLabel: 'systemPink',
      color: constSourceColorARGB(Color, 255, 255, 45, 85),
      darkColor: constSourceColorARGB(Color, 255, 255, 55, 95),
      highContrastColor: constSourceColorARGB(Color, 255, 211, 15, 69),
      darkHighContrastColor: constSourceColorARGB(Color, 255, 255, 100, 130),
    });
  static readonly systemBrown: CupertinoDynamicColor =
    constCupertinoDynamicColorWithBrightnessAndContrast({
      debugLabel: 'systemBrown',
      color: constSourceColorARGB(Color, 255, 162, 132, 94),
      darkColor: constSourceColorARGB(Color, 255, 172, 142, 104),
      highContrastColor: constSourceColorARGB(Color, 255, 127, 101, 69),
      darkHighContrastColor: constSourceColorARGB(Color, 255, 181, 148, 105),
    });
  static readonly systemPurple: CupertinoDynamicColor =
    constCupertinoDynamicColorWithBrightnessAndContrast({
      debugLabel: 'systemPurple',
      color: constSourceColorARGB(Color, 255, 175, 82, 222),
      darkColor: constSourceColorARGB(Color, 255, 191, 90, 242),
      highContrastColor: constSourceColorARGB(Color, 255, 137, 68, 171),
      darkHighContrastColor: constSourceColorARGB(Color, 255, 218, 143, 255),
    });
  static readonly systemTeal: CupertinoDynamicColor =
    constCupertinoDynamicColorWithBrightnessAndContrast({
      debugLabel: 'systemTeal',
      color: constSourceColorARGB(Color, 255, 90, 200, 250),
      darkColor: constSourceColorARGB(Color, 255, 100, 210, 255),
      highContrastColor: constSourceColorARGB(Color, 255, 0, 113, 164),
      darkHighContrastColor: constSourceColorARGB(Color, 255, 112, 215, 255),
    });
  static readonly systemCyan: CupertinoDynamicColor =
    constCupertinoDynamicColorWithBrightnessAndContrast({
      debugLabel: 'systemCyan',
      color: constSourceColorARGB(Color, 255, 50, 173, 230),
      darkColor: constSourceColorARGB(Color, 255, 100, 210, 255),
      highContrastColor: constSourceColorARGB(Color, 255, 0, 113, 164),
      darkHighContrastColor: constSourceColorARGB(Color, 255, 112, 215, 255),
    });
  static readonly systemYellow: CupertinoDynamicColor =
    constCupertinoDynamicColorWithBrightnessAndContrast({
      debugLabel: 'systemYellow',
      color: constSourceColorARGB(Color, 255, 255, 204, 0),
      darkColor: constSourceColorARGB(Color, 255, 255, 214, 10),
      highContrastColor: constSourceColorARGB(Color, 255, 160, 90, 0),
      darkHighContrastColor: constSourceColorARGB(Color, 255, 255, 212, 38),
    });
  static readonly systemGrey: CupertinoDynamicColor =
    constCupertinoDynamicColorWithBrightnessAndContrast({
      debugLabel: 'systemGrey',
      color: constSourceColorARGB(Color, 255, 142, 142, 147),
      darkColor: constSourceColorARGB(Color, 255, 142, 142, 147),
      highContrastColor: constSourceColorARGB(Color, 255, 108, 108, 112),
      darkHighContrastColor: constSourceColorARGB(Color, 255, 174, 174, 178),
    });
  static readonly systemGrey2: CupertinoDynamicColor =
    constCupertinoDynamicColorWithBrightnessAndContrast({
      debugLabel: 'systemGrey2',
      color: constSourceColorARGB(Color, 255, 174, 174, 178),
      darkColor: constSourceColorARGB(Color, 255, 99, 99, 102),
      highContrastColor: constSourceColorARGB(Color, 255, 142, 142, 147),
      darkHighContrastColor: constSourceColorARGB(Color, 255, 124, 124, 128),
    });
  static readonly systemGrey3: CupertinoDynamicColor =
    constCupertinoDynamicColorWithBrightnessAndContrast({
      debugLabel: 'systemGrey3',
      color: constSourceColorARGB(Color, 255, 199, 199, 204),
      darkColor: constSourceColorARGB(Color, 255, 72, 72, 74),
      highContrastColor: constSourceColorARGB(Color, 255, 174, 174, 178),
      darkHighContrastColor: constSourceColorARGB(Color, 255, 84, 84, 86),
    });
  static readonly systemGrey4: CupertinoDynamicColor =
    constCupertinoDynamicColorWithBrightnessAndContrast({
      debugLabel: 'systemGrey4',
      color: constSourceColorARGB(Color, 255, 209, 209, 214),
      darkColor: constSourceColorARGB(Color, 255, 58, 58, 60),
      highContrastColor: constSourceColorARGB(Color, 255, 188, 188, 192),
      darkHighContrastColor: constSourceColorARGB(Color, 255, 68, 68, 70),
    });
  static readonly systemGrey5: CupertinoDynamicColor =
    constCupertinoDynamicColorWithBrightnessAndContrast({
      debugLabel: 'systemGrey5',
      color: constSourceColorARGB(Color, 255, 229, 229, 234),
      darkColor: constSourceColorARGB(Color, 255, 44, 44, 46),
      highContrastColor: constSourceColorARGB(Color, 255, 216, 216, 220),
      darkHighContrastColor: constSourceColorARGB(Color, 255, 54, 54, 56),
    });
  static readonly systemGrey6: CupertinoDynamicColor =
    constCupertinoDynamicColorWithBrightnessAndContrast({
      debugLabel: 'systemGrey6',
      color: constSourceColorARGB(Color, 255, 242, 242, 247),
      darkColor: constSourceColorARGB(Color, 255, 28, 28, 30),
      highContrastColor: constSourceColorARGB(Color, 255, 235, 235, 240),
      darkHighContrastColor: constSourceColorARGB(Color, 255, 36, 36, 38),
    });
  static readonly label: CupertinoDynamicColor = constCupertinoDynamicColor({
    debugLabel: 'label',
    color: constSourceColorARGB(Color, 255, 0, 0, 0),
    darkColor: constSourceColorARGB(Color, 255, 255, 255, 255),
    highContrastColor: constSourceColorARGB(Color, 255, 0, 0, 0),
    darkHighContrastColor: constSourceColorARGB(Color, 255, 255, 255, 255),
    elevatedColor: constSourceColorARGB(Color, 255, 0, 0, 0),
    darkElevatedColor: constSourceColorARGB(Color, 255, 255, 255, 255),
    highContrastElevatedColor: constSourceColorARGB(Color, 255, 0, 0, 0),
    darkHighContrastElevatedColor: constSourceColorARGB(Color, 255, 255, 255, 255),
  });
  static readonly secondaryLabel: CupertinoDynamicColor = constCupertinoDynamicColor({
    debugLabel: 'secondaryLabel',
    color: constSourceColorARGB(Color, 153, 60, 60, 67),
    darkColor: constSourceColorARGB(Color, 153, 235, 235, 245),
    highContrastColor: constSourceColorARGB(Color, 173, 60, 60, 67),
    darkHighContrastColor: constSourceColorARGB(Color, 173, 235, 235, 245),
    elevatedColor: constSourceColorARGB(Color, 153, 60, 60, 67),
    darkElevatedColor: constSourceColorARGB(Color, 153, 235, 235, 245),
    highContrastElevatedColor: constSourceColorARGB(Color, 173, 60, 60, 67),
    darkHighContrastElevatedColor: constSourceColorARGB(Color, 173, 235, 235, 245),
  });
  static readonly tertiaryLabel: CupertinoDynamicColor = constCupertinoDynamicColor({
    debugLabel: 'tertiaryLabel',
    color: constSourceColorARGB(Color, 76, 60, 60, 67),
    darkColor: constSourceColorARGB(Color, 76, 235, 235, 245),
    highContrastColor: constSourceColorARGB(Color, 96, 60, 60, 67),
    darkHighContrastColor: constSourceColorARGB(Color, 96, 235, 235, 245),
    elevatedColor: constSourceColorARGB(Color, 76, 60, 60, 67),
    darkElevatedColor: constSourceColorARGB(Color, 76, 235, 235, 245),
    highContrastElevatedColor: constSourceColorARGB(Color, 96, 60, 60, 67),
    darkHighContrastElevatedColor: constSourceColorARGB(Color, 96, 235, 235, 245),
  });
  static readonly quaternaryLabel: CupertinoDynamicColor = constCupertinoDynamicColor({
    debugLabel: 'quaternaryLabel',
    color: constSourceColorARGB(Color, 45, 60, 60, 67),
    darkColor: constSourceColorARGB(Color, 40, 235, 235, 245),
    highContrastColor: constSourceColorARGB(Color, 66, 60, 60, 67),
    darkHighContrastColor: constSourceColorARGB(Color, 61, 235, 235, 245),
    elevatedColor: constSourceColorARGB(Color, 45, 60, 60, 67),
    darkElevatedColor: constSourceColorARGB(Color, 40, 235, 235, 245),
    highContrastElevatedColor: constSourceColorARGB(Color, 66, 60, 60, 67),
    darkHighContrastElevatedColor: constSourceColorARGB(Color, 61, 235, 235, 245),
  });
  static readonly systemFill: CupertinoDynamicColor = constCupertinoDynamicColor({
    debugLabel: 'systemFill',
    color: constSourceColorARGB(Color, 51, 120, 120, 128),
    darkColor: constSourceColorARGB(Color, 91, 120, 120, 128),
    highContrastColor: constSourceColorARGB(Color, 71, 120, 120, 128),
    darkHighContrastColor: constSourceColorARGB(Color, 112, 120, 120, 128),
    elevatedColor: constSourceColorARGB(Color, 51, 120, 120, 128),
    darkElevatedColor: constSourceColorARGB(Color, 91, 120, 120, 128),
    highContrastElevatedColor: constSourceColorARGB(Color, 71, 120, 120, 128),
    darkHighContrastElevatedColor: constSourceColorARGB(Color, 112, 120, 120, 128),
  });
  static readonly secondarySystemFill: CupertinoDynamicColor = constCupertinoDynamicColor({
    debugLabel: 'secondarySystemFill',
    color: constSourceColorARGB(Color, 40, 120, 120, 128),
    darkColor: constSourceColorARGB(Color, 81, 120, 120, 128),
    highContrastColor: constSourceColorARGB(Color, 61, 120, 120, 128),
    darkHighContrastColor: constSourceColorARGB(Color, 102, 120, 120, 128),
    elevatedColor: constSourceColorARGB(Color, 40, 120, 120, 128),
    darkElevatedColor: constSourceColorARGB(Color, 81, 120, 120, 128),
    highContrastElevatedColor: constSourceColorARGB(Color, 61, 120, 120, 128),
    darkHighContrastElevatedColor: constSourceColorARGB(Color, 102, 120, 120, 128),
  });
  static readonly tertiarySystemFill: CupertinoDynamicColor = constCupertinoDynamicColor({
    debugLabel: 'tertiarySystemFill',
    color: constSourceColorARGB(Color, 30, 118, 118, 128),
    darkColor: constSourceColorARGB(Color, 61, 118, 118, 128),
    highContrastColor: constSourceColorARGB(Color, 51, 118, 118, 128),
    darkHighContrastColor: constSourceColorARGB(Color, 81, 118, 118, 128),
    elevatedColor: constSourceColorARGB(Color, 30, 118, 118, 128),
    darkElevatedColor: constSourceColorARGB(Color, 61, 118, 118, 128),
    highContrastElevatedColor: constSourceColorARGB(Color, 51, 118, 118, 128),
    darkHighContrastElevatedColor: constSourceColorARGB(Color, 81, 118, 118, 128),
  });
  static readonly quaternarySystemFill: CupertinoDynamicColor = constCupertinoDynamicColor({
    debugLabel: 'quaternarySystemFill',
    color: constSourceColorARGB(Color, 20, 116, 116, 128),
    darkColor: constSourceColorARGB(Color, 45, 118, 118, 128),
    highContrastColor: constSourceColorARGB(Color, 40, 116, 116, 128),
    darkHighContrastColor: constSourceColorARGB(Color, 66, 118, 118, 128),
    elevatedColor: constSourceColorARGB(Color, 20, 116, 116, 128),
    darkElevatedColor: constSourceColorARGB(Color, 45, 118, 118, 128),
    highContrastElevatedColor: constSourceColorARGB(Color, 40, 116, 116, 128),
    darkHighContrastElevatedColor: constSourceColorARGB(Color, 66, 118, 118, 128),
  });
  static readonly placeholderText: CupertinoDynamicColor = constCupertinoDynamicColor({
    debugLabel: 'placeholderText',
    color: constSourceColorARGB(Color, 76, 60, 60, 67),
    darkColor: constSourceColorARGB(Color, 76, 235, 235, 245),
    highContrastColor: constSourceColorARGB(Color, 96, 60, 60, 67),
    darkHighContrastColor: constSourceColorARGB(Color, 96, 235, 235, 245),
    elevatedColor: constSourceColorARGB(Color, 76, 60, 60, 67),
    darkElevatedColor: constSourceColorARGB(Color, 76, 235, 235, 245),
    highContrastElevatedColor: constSourceColorARGB(Color, 96, 60, 60, 67),
    darkHighContrastElevatedColor: constSourceColorARGB(Color, 96, 235, 235, 245),
  });
  static readonly systemBackground: CupertinoDynamicColor = constCupertinoDynamicColor({
    debugLabel: 'systemBackground',
    color: constSourceColorARGB(Color, 255, 255, 255, 255),
    darkColor: constSourceColorARGB(Color, 255, 0, 0, 0),
    highContrastColor: constSourceColorARGB(Color, 255, 255, 255, 255),
    darkHighContrastColor: constSourceColorARGB(Color, 255, 0, 0, 0),
    elevatedColor: constSourceColorARGB(Color, 255, 255, 255, 255),
    darkElevatedColor: constSourceColorARGB(Color, 255, 28, 28, 30),
    highContrastElevatedColor: constSourceColorARGB(Color, 255, 255, 255, 255),
    darkHighContrastElevatedColor: constSourceColorARGB(Color, 255, 36, 36, 38),
  });
  static readonly secondarySystemBackground: CupertinoDynamicColor = constCupertinoDynamicColor({
    debugLabel: 'secondarySystemBackground',
    color: constSourceColorARGB(Color, 255, 242, 242, 247),
    darkColor: constSourceColorARGB(Color, 255, 28, 28, 30),
    highContrastColor: constSourceColorARGB(Color, 255, 235, 235, 240),
    darkHighContrastColor: constSourceColorARGB(Color, 255, 36, 36, 38),
    elevatedColor: constSourceColorARGB(Color, 255, 242, 242, 247),
    darkElevatedColor: constSourceColorARGB(Color, 255, 44, 44, 46),
    highContrastElevatedColor: constSourceColorARGB(Color, 255, 235, 235, 240),
    darkHighContrastElevatedColor: constSourceColorARGB(Color, 255, 54, 54, 56),
  });
  static readonly tertiarySystemBackground: CupertinoDynamicColor = constCupertinoDynamicColor({
    debugLabel: 'tertiarySystemBackground',
    color: constSourceColorARGB(Color, 255, 255, 255, 255),
    darkColor: constSourceColorARGB(Color, 255, 44, 44, 46),
    highContrastColor: constSourceColorARGB(Color, 255, 255, 255, 255),
    darkHighContrastColor: constSourceColorARGB(Color, 255, 54, 54, 56),
    elevatedColor: constSourceColorARGB(Color, 255, 255, 255, 255),
    darkElevatedColor: constSourceColorARGB(Color, 255, 58, 58, 60),
    highContrastElevatedColor: constSourceColorARGB(Color, 255, 255, 255, 255),
    darkHighContrastElevatedColor: constSourceColorARGB(Color, 255, 68, 68, 70),
  });
  static readonly systemGroupedBackground: CupertinoDynamicColor = constCupertinoDynamicColor({
    debugLabel: 'systemGroupedBackground',
    color: constSourceColorARGB(Color, 255, 242, 242, 247),
    darkColor: constSourceColorARGB(Color, 255, 0, 0, 0),
    highContrastColor: constSourceColorARGB(Color, 255, 235, 235, 240),
    darkHighContrastColor: constSourceColorARGB(Color, 255, 0, 0, 0),
    elevatedColor: constSourceColorARGB(Color, 255, 242, 242, 247),
    darkElevatedColor: constSourceColorARGB(Color, 255, 28, 28, 30),
    highContrastElevatedColor: constSourceColorARGB(Color, 255, 235, 235, 240),
    darkHighContrastElevatedColor: constSourceColorARGB(Color, 255, 36, 36, 38),
  });
  static readonly secondarySystemGroupedBackground: CupertinoDynamicColor =
    constCupertinoDynamicColor({
      debugLabel: 'secondarySystemGroupedBackground',
      color: constSourceColorARGB(Color, 255, 255, 255, 255),
      darkColor: constSourceColorARGB(Color, 255, 28, 28, 30),
      highContrastColor: constSourceColorARGB(Color, 255, 255, 255, 255),
      darkHighContrastColor: constSourceColorARGB(Color, 255, 36, 36, 38),
      elevatedColor: constSourceColorARGB(Color, 255, 255, 255, 255),
      darkElevatedColor: constSourceColorARGB(Color, 255, 44, 44, 46),
      highContrastElevatedColor: constSourceColorARGB(Color, 255, 255, 255, 255),
      darkHighContrastElevatedColor: constSourceColorARGB(Color, 255, 54, 54, 56),
    });
  static readonly tertiarySystemGroupedBackground: CupertinoDynamicColor =
    constCupertinoDynamicColor({
      debugLabel: 'tertiarySystemGroupedBackground',
      color: constSourceColorARGB(Color, 255, 242, 242, 247),
      darkColor: constSourceColorARGB(Color, 255, 44, 44, 46),
      highContrastColor: constSourceColorARGB(Color, 255, 235, 235, 240),
      darkHighContrastColor: constSourceColorARGB(Color, 255, 54, 54, 56),
      elevatedColor: constSourceColorARGB(Color, 255, 242, 242, 247),
      darkElevatedColor: constSourceColorARGB(Color, 255, 58, 58, 60),
      highContrastElevatedColor: constSourceColorARGB(Color, 255, 235, 235, 240),
      darkHighContrastElevatedColor: constSourceColorARGB(Color, 255, 68, 68, 70),
    });
  static readonly separator: CupertinoDynamicColor = constCupertinoDynamicColor({
    debugLabel: 'separator',
    color: constSourceColorARGB(Color, 73, 60, 60, 67),
    darkColor: constSourceColorARGB(Color, 153, 84, 84, 88),
    highContrastColor: constSourceColorARGB(Color, 94, 60, 60, 67),
    darkHighContrastColor: constSourceColorARGB(Color, 173, 84, 84, 88),
    elevatedColor: constSourceColorARGB(Color, 73, 60, 60, 67),
    darkElevatedColor: constSourceColorARGB(Color, 153, 210, 210, 210),
    highContrastElevatedColor: constSourceColorARGB(Color, 94, 60, 60, 67),
    darkHighContrastElevatedColor: constSourceColorARGB(Color, 173, 84, 84, 88),
  });
  static readonly opaqueSeparator: CupertinoDynamicColor = constCupertinoDynamicColor({
    debugLabel: 'opaqueSeparator',
    color: constSourceColorARGB(Color, 255, 198, 198, 200),
    darkColor: constSourceColorARGB(Color, 255, 56, 56, 58),
    highContrastColor: constSourceColorARGB(Color, 255, 198, 198, 200),
    darkHighContrastColor: constSourceColorARGB(Color, 255, 56, 56, 58),
    elevatedColor: constSourceColorARGB(Color, 255, 198, 198, 200),
    darkElevatedColor: constSourceColorARGB(Color, 255, 56, 56, 58),
    highContrastElevatedColor: constSourceColorARGB(Color, 255, 198, 198, 200),
    darkHighContrastElevatedColor: constSourceColorARGB(Color, 255, 56, 56, 58),
  });
  static readonly link: CupertinoDynamicColor = constCupertinoDynamicColor({
    debugLabel: 'link',
    color: constSourceColorARGB(Color, 255, 0, 122, 255),
    darkColor: constSourceColorARGB(Color, 255, 9, 132, 255),
    highContrastColor: constSourceColorARGB(Color, 255, 0, 122, 255),
    darkHighContrastColor: constSourceColorARGB(Color, 255, 9, 132, 255),
    elevatedColor: constSourceColorARGB(Color, 255, 0, 122, 255),
    darkElevatedColor: constSourceColorARGB(Color, 255, 9, 132, 255),
    highContrastElevatedColor: constSourceColorARGB(Color, 255, 0, 122, 255),
    darkHighContrastElevatedColor: constSourceColorARGB(Color, 255, 9, 132, 255),
  });
  constructor() {}
}
protect(CupertinoColors, [
  'activeBlue',
  'activeGreen',
  'activeOrange',
  'white',
  'black',
  'transparent',
  'lightBackgroundGray',
  'extraLightBackgroundGray',
  'darkBackgroundGray',
  'inactiveGray',
  'destructiveRed',
  'systemBlue',
  'systemGreen',
  'systemMint',
  'systemIndigo',
  'systemOrange',
  'systemPink',
  'systemBrown',
  'systemPurple',
  'systemRed',
  'systemTeal',
  'systemCyan',
  'systemYellow',
  'systemGrey',
  'systemGrey2',
  'systemGrey3',
  'systemGrey4',
  'systemGrey5',
  'systemGrey6',
  'label',
  'secondaryLabel',
  'tertiaryLabel',
  'quaternaryLabel',
  'systemFill',
  'secondarySystemFill',
  'tertiarySystemFill',
  'quaternarySystemFill',
  'placeholderText',
  'systemBackground',
  'secondarySystemBackground',
  'tertiarySystemBackground',
  'systemGroupedBackground',
  'secondarySystemGroupedBackground',
  'tertiarySystemGroupedBackground',
  'separator',
  'opaqueSeparator',
  'link',
]);
