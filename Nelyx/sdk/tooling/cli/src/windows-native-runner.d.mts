export interface NativeWindowsOptions {
  readonly app: string;
  readonly host?: 'native-hermes';
  readonly engine?: 'hermes';
  readonly configuration?: 'Release';
  readonly hermesProfile?: 'optimized';
  readonly mode?: 'bytecode' | 'static-aot';
  readonly hermesMode?: 'bytecode' | 'static-aot';
  readonly engineInputs?: string;
  readonly nativeInputs?: string;
  readonly output?: string;
  readonly directory?: string;
  readonly signal?: AbortSignal;
  readonly arguments?: readonly string[];
  readonly diagnosticEntry?: string;
  readonly cacheDirectory?: string | null;
}
export interface NativePackageManifest {
  readonly schema: 'nelyx.native-hermes-package/v1';
  readonly app: string;
  readonly mode: 'bytecode' | 'static-aot';
  readonly bundle: string;
  readonly revision: string;
  readonly toolchainSha256: string;
  readonly sourceSha256: string;
  readonly compilerPolicy: string;
  readonly nativeFunctions: number | null;
  readonly qualification: 'experimental' | 'diagnostic-only';
  readonly diagnosticEntrySha256?: string;
  readonly performanceAccepted: false;
  readonly physicalInputAccepted: 'notVerified';
  readonly files: readonly {
    readonly path: string;
    readonly bytes: number;
    readonly sha256: string;
  }[];
}
export declare function buildNativeApplication(options: NativeWindowsOptions): Promise<{
  readonly directory: string;
  readonly mode: string;
  readonly bundle: string;
  readonly executable: string;
  readonly assetRoot: string;
}>;
export declare function prepareNativeApplication(
  options: NativeWindowsOptions,
): Promise<Readonly<Record<string, unknown>>>;
export declare function verifyNativePackage(directory: string): {
  readonly directory: string;
  readonly manifest: NativePackageManifest;
  readonly files: number;
  readonly bytes: number;
};
export declare function runNativeApplication(options: NativeWindowsOptions): Promise<{
  readonly schema: 'nelyx.run/v2';
  readonly target: 'windows';
  readonly host: 'native-hermes';
  readonly exitCode: number | null;
  readonly signal: string | null;
  readonly error: string | null;
  readonly forced: boolean;
}>;
export declare function packNativeApplication(
  options: NativeWindowsOptions,
): Promise<Readonly<Record<string, unknown>>>;
export declare function nativeWindowsOperation(
  operation: string,
  options: NativeWindowsOptions,
): Promise<Readonly<Record<string, unknown>>>;
export declare function assertNativeRuntimeGraph(graph: unknown): void;
