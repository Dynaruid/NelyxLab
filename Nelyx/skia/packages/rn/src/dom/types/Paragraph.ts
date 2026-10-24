import type {SkParagraph} from '../../skia/types/Paragraph/Paragraph.ts';

import type {GroupProps} from './Common.ts';

export interface ParagraphProps extends GroupProps {
  paragraph: SkParagraph | null;
  x: number;
  y: number;
  width: number;
}
