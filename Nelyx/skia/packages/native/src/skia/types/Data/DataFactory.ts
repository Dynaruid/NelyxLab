import type { SkData } from './Data.ts';

export interface DataFactory {
  /** Actual compiled process architecture and shared native core ABI; no surface is created. */
  nelyxArchitecture(): string;
  nelyxCoreAbi(): number;
  /** Optional native extension; a supported SDK bootstrap requires it before GPU use. */
  nelyxConfigureGpuPolicy?(allowSoftware: boolean): void;
  /**
   * Creates a new Data object from an Uri, either locally or remotely.
   * @param uri Uri to a valid resource
   */
  fromURI(uri: string, maxBytes?: number): Promise<SkData>;
  /** Native-only bounded local file IO; distinct from confined application assets.
   * Completion uses the host's tracked async owner. Older native suppliers lack it. */
  nelyxFromFile?(uri: string, maxBytes: number): Promise<SkData>;
  /**
   * Creates a new Data object from a byte array.
   * @param bytes An array of bytes representing the data
   */
  fromBytes(bytes: Uint8Array): SkData;
  /**
   * Creates a new Data object from a base64 encoded string.
   * @param base64 A Base64 encoded string representing the data
   */
  fromBase64(base64: string): SkData;
}
