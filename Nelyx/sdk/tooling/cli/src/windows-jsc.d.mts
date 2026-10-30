export type WindowsJscMode = 'jit' | 'interpreter';
export interface WindowsJscManifest {
  readonly schema: 'nelyx.windows-jsc/v1';
  readonly rnw: '0.83.2';
  readonly nativeReactNative: '0.83.4';
  readonly jsi: 21;
  readonly architecture: 'x64';
  readonly crt: 'MD';
  readonly version: string;
  readonly revision: string;
  readonly archiveSha256: string;
  readonly bridgeSha256: string;
  readonly patchedHostSha256: string;
  readonly microtaskAdapterSha256: string;
  readonly producerSha256: string;
  readonly qualification: 'notVerified';
  readonly files: readonly {
    readonly path: string;
    readonly bytes: number;
    readonly sha256: string;
  }[];
}
export interface WindowsJscSupplier {
  readonly directory: string;
  readonly sha256: string;
  readonly manifest: WindowsJscManifest;
}
export declare const windowsJscPin: Readonly<{
  version: string;
  revision: string;
  playwright: string;
  build: string;
  archiveSha256: string;
  url: string;
  runtimeSha256: string;
}>;
export declare function windowsJscMode(mode?: string, engine?: string): WindowsJscMode;
export declare function patchWindowsJscSource(source: string): string;
export declare function patchJscMicrotasks(source: string): string;
export declare function verifyWindowsJsc(
  directory: string,
  options?: { readonly embedded?: boolean },
): WindowsJscSupplier;
export declare function prepareWindowsJsc(options: {
  readonly runner: string;
  readonly output: string;
  readonly signal?: AbortSignal;
  readonly bridgeDirectory?: string;
}): Promise<WindowsJscSupplier>;
