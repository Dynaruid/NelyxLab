import type { SkFontMgr } from './FontMgr.ts';

export interface FontMgrFactory {
  System(): SkFontMgr;
}
