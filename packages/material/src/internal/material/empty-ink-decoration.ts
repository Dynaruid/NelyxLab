// SPDX-License-Identifier: BSD-3-Clause
import { Border } from '@nelyx/core/framework/painting/box-border';
import { ColorShapeDecoration } from '@nelyx/core/framework/painting/color-shape-decoration';
import { Color } from '@nelyx/core/ui/color';

// The private default owns no fill or border work. Keep the ordinary decoration
// value and Ink feature lifecycle, but do not ask for geometry for an empty paint.
// Caller-provided colors, shapes and decorations never acquire this identity.
const shape = new Border(),
  color = new Color(0);
Object.freeze(shape);
Object.freeze(color);
export const emptyInkDecoration = new ColorShapeDecoration(shape, color);
Object.freeze(emptyInkDecoration);
