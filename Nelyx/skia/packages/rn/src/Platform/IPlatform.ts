/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NodeHandle, View } from "react-native";

import type {DataModule} from '../skia/types/Data/Data.ts';

export interface IPlatform {
  OS: string;
  PixelRatio: number;
  findNodeHandle: (
    componentOrHandle:
      null | number | React.Component<any, any> | React.ComponentClass<any>
  ) => null | NodeHandle;
  resolveAsset: (source: DataModule) => string;
  View: React.ComponentType<React.ComponentPropsWithRef<typeof View>>;
}
