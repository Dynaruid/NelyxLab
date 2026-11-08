// SPDX-License-Identifier: BSD-3-Clause
export const appServicesVersion = 2;
export const appServiceMethods = [
  'clipboard-read',
  'clipboard-write',
  'clipboard-has-strings',
  'semantics-tap',
  'semantics-longPress',
  'semantics-focus',
  'system-sound',
  'haptic-feedback',
] as const;
export type AppServiceMethod = (typeof appServiceMethods)[number];
export function appServiceReadsText(method: AppServiceMethod): boolean {
  return method === 'clipboard-read' || method === 'clipboard-has-strings';
}
export const appServiceTextUnits = 65536;
export function validateAppServiceText(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.length > appServiceTextUnits || value.includes('\0'))
    throw new Error('Clipboard text exceeds its UTF-16 or NUL boundary');
  for (let at = 0; at < value.length; ++at) {
    const unit = value.charCodeAt(at);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const low = value.charCodeAt(++at);
      if (!(low >= 0xdc00 && low <= 0xdfff))
        throw new Error('Clipboard text has an unpaired surrogate');
    } else if (unit >= 0xdc00 && unit <= 0xdfff)
      throw new Error('Clipboard text has an unpaired surrogate');
  }
}
