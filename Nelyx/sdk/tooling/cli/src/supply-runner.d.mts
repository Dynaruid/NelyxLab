export function packageReferences(
  directory: string,
): Record<'core' | 'sdk' | 'web' | 'vite' | 'cli' | 'tooling-contracts', string> &
  Partial<Record<'material' | 'cupertino' | 'localizations', string>>;
export function supplyRunner(options: {
  readonly app: string;
  readonly target?: 'web' | 'pwa';
  readonly packages: string;
  readonly reuseCurrent?: boolean;
}): { runner: string; packages: string[] };
