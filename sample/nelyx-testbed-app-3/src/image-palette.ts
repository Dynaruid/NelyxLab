// SPDX-License-Identifier: BSD-3-Clause
import type { ImageProvider } from '@nelyx/core/framework/painting/image-provider';
import type { BuildContext } from '@nelyx/core/framework/widgets/framework';
import { createLocalImageConfiguration } from '@nelyx/core/framework/widgets/image';
import { ColorScheme } from '@nelyx/material/color-scheme';

export const sampleImage = 'component-image';
export const themeImages = ['Leaves', 'Peonies', 'Bubbles', 'Seaweed', 'Sea Grapes', 'Petals'];

export function themeImageAsset(index: number): string {
  return `theme-image-${index + 1}`;
}

export function imageScheme(context: BuildContext, provider: ImageProvider) {
  const rasterizer = context.services.rasterizer;
  if (!rasterizer) throw new Error('Image colors require the view rasterizer.');
  return ColorScheme.fromImageProvider({
    provider,
    configuration: createLocalImageConfiguration(context),
    rasterizer,
  });
}
