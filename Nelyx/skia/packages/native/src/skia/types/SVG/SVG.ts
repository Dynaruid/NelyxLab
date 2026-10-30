import type { SkJSIInstance } from '../JsiInstance.ts';

export interface SkSVG extends SkJSIInstance<'SVG'> {
  width(): number;
  height(): number;
}
