import type {SkTypefaceFontProvider} from './TypefaceFontProvider.ts';

export interface TypefaceFontProviderFactory {
  Make(): SkTypefaceFontProvider;
}
