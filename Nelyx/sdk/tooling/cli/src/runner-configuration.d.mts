import type { FrontendPreparation } from './web-runner.mjs';
export function configureRunner(options: {
  app: string;
  target?: 'web' | 'tauri';
}): Promise<FrontendPreparation>;
