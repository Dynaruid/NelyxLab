export declare function packageReferences(
  directory: string,
): Record<'core' | 'sdk' | 'native' | 'rn' | 'web' | 'metro' | 'cli' | 'static-aot', string> &
  Partial<Record<'material' | 'cupertino' | 'localizations', string>>;
export declare function readRnlSupply(file: string): Record<string, string>;
export declare function supplyRunner(options: {
  readonly app: string;
  readonly target: 'windows' | 'android' | 'web' | 'ios' | 'macos' | 'linux';
  readonly packages: string;
  readonly extra?: Readonly<Record<string, string>>;
  readonly reuseCurrent?: boolean;
}): { runner: string; packages: string[] };
