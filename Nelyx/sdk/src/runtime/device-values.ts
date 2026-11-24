// SPDX-License-Identifier: BSD-3-Clause
import type { DeviceFileFilter, DeviceNfcText, DevicePermission, DevicePosition } from '../devices.ts';
import { deviceError } from './device-scope.ts';

export function externalUrl(input: URL | string): string {
  let url: URL;
  try {
    url = new URL(String(input));
  } catch {
    throw deviceError('invalid-arguments', 'A valid absolute HTTP(S) URL is required');
  }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
    throw deviceError('invalid-arguments', 'An HTTP(S) URL without credentials is required');
  return url.href;
}

export function selectedFilters(filters: readonly DeviceFileFilter[] | undefined) {
  return filters?.map(({ name, extensions }) => {
    if (!name.trim() || !extensions.length || extensions.some((value) => !/^[a-z0-9][a-z0-9+-]{0,15}$/i.test(value)))
      throw deviceError('invalid-arguments', 'File filters need a name and extensions without a dot');
    return { name, extensions: [...extensions] };
  });
}

export function deviceKey(key: string): string {
  if (typeof key !== 'string' || !key.trim() || key.includes('\0') || key.length > 200)
    throw deviceError('invalid-arguments', 'A storage key must contain 1 to 200 characters');
  return key;
}

export function permission(value: unknown): DevicePermission {
  switch (value) {
    case 'granted': return 'granted';
    case 'denied': return 'denied';
    case 'prompt':
    case 'default':
    case 'prompt-with-rationale': return 'prompt';
    default: return 'unknown';
  }
}

type Position = Pick<GeolocationPosition, 'timestamp'> & { coords: Partial<GeolocationCoordinates> };

export function position({ coords, timestamp }: Position): DevicePosition {
  const { latitude, longitude, accuracy } = coords;
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) ||
      typeof longitude !== 'number' || !Number.isFinite(longitude) ||
      typeof accuracy !== 'number' || !Number.isFinite(accuracy) || !Number.isFinite(timestamp))
    throw deviceError('unavailable', 'Location is unavailable');
  return {
    latitude,
    longitude,
    accuracy,
    timestamp,
    altitude: coords.altitude ?? null,
    altitudeAccuracy: coords.altitudeAccuracy ?? null,
    heading: coords.heading ?? null,
    speed: coords.speed ?? null,
  };
}

export function locationError(error: unknown): unknown {
  const location = error as { code?: unknown; message?: string } | null;
  const message = location?.message ?? 'Unable to get your location';
  switch (location?.code) {
    case 1: return deviceError('permission-denied', message);
    case 2: return deviceError('unavailable', message);
    case 3: return deviceError('timeout', message);
    default: return error;
  }
}

export function nfcText(record: DeviceNfcText): { text: string; language: string } {
  const language = record.language ?? 'en';
  if (typeof record.text !== 'string' || !/^[A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})*$/.test(language) || language.length > 63)
    throw deviceError('invalid-arguments', 'A text payload and a language tag are required');
  return { text: record.text, language };
}
