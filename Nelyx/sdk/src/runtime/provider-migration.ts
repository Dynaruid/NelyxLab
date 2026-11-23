// SPDX-License-Identifier: BSD-3-Clause
import { validateProvider } from './providers.ts';
import type { ProviderDescriptor } from './providers.ts';

const migration =
  'Install the Nelyx Vite frontend and use nelyx.app/v4 with the React DOM cohort. Supply CanvasKit and rebuild.';
/** Removed recipe contracts are deliberately rejected before any native import or loader. */
export function migrateNativeProvider(_value: unknown): never {
  throw new Error(`Removed nelyx.native-provider/v1 contract. ${migration}`);
}
/** v4 is validated directly; v3 requires an explicit application/native composition migration. */
export function migrateProviderMetadata(value: unknown): ProviderDescriptor {
  if (
    value &&
    typeof value === 'object' &&
    'schema' in value &&
    value.schema === 'nelyx.provider/v4'
  )
    return validateProvider(value);
  throw new Error(`Removed nelyx.provider/v3 contract. ${migration}`);
}
