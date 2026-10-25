import type {SkParagraph} from "@nelyx/skia-native/skia/types/Paragraph/Paragraph";

import type {GroupProps} from './Common.ts';

export interface ParagraphProps extends GroupProps {
  paragraph: SkParagraph | null;
  x: number;
  y: number;
  width: number;
}
