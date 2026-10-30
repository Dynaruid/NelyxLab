import type { SkJSIInstance } from '../JsiInstance.ts';

export const isColorFilter = (obj: SkJSIInstance<string> | null): obj is SkColorFilter =>
  obj !== null && obj.__typename__ === 'ColorFilter';

export interface SkColorFilter extends SkJSIInstance<'ColorFilter'> {}
