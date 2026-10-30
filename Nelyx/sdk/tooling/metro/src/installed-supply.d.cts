/** Check local archive location and integrity against the current npm install. */
export declare function assertInstalledSupply(
  runnerRoot: string,
  sourcePackages?: Readonly<Record<string, string>>,
): void;
