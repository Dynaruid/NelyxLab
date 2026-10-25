import React from 'react';
import {
  Image,
  PixelRatio,
  Platform as RNPlatform,
  findNodeHandle,
  View,
} from "react-native";

import type {DataModule} from "@nelyx/skia-native/skia/types/Data/Data";
import {isRNModule, unwrapModule} from "@nelyx/skia-native/skia/types/Data/Data";

import type {IPlatform} from './IPlatform.ts';
function PlatformView(props: React.ComponentPropsWithRef<typeof View>) {
  return React.createElement(View, props);
}

export const Platform: IPlatform = {
  OS: String(RNPlatform.OS) as IPlatform["OS"],
  PixelRatio: PixelRatio.get(),
  resolveAsset: (source: DataModule) => {
    const asset = unwrapModule(source);
    if (typeof asset === "string") {
      return asset;
    }
    return isRNModule(asset) ? Image.resolveAssetSource(asset).uri : asset.uri;
  },
  findNodeHandle: (value) => findNodeHandle(value),
  View: PlatformView,
};
