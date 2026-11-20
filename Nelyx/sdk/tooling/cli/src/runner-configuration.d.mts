import type { WebPreparation } from './web-runner.mjs';
export function configureRunner(options: {
  app: string;
  target?: 'web' | 'pwa';
}): Promise<WebPreparation>;
