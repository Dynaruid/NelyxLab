export interface AppleRuntimePreparation {
  readonly result: 'PASS-scoped';
  readonly target: 'ios' | 'macos';
  readonly package: string;
  readonly version: string;
  readonly applied: boolean;
  readonly files: readonly { file: string; baseSha256: string | null; sha256: string }[];
  readonly shutdownProtocol: 3;
  readonly nativeCompileRuntime: 'SKIPPED/notVerified';
}
/** Pin-check the runner-owned RN/RNM source, then apply the checked drain-before-replacement hooks.
 * Repeated calls verify the saved originals and installed patched bytes. Native execution is separate. */
export function patchAppleRuntime(options: {
  target: 'ios' | 'macos';
  runner: string;
}): AppleRuntimePreparation;
