// SPDX-License-Identifier: BSD-3-Clause
import type { BinaryMessenger } from '@nelyx/core/services/binary-messenger';

export const deviceFeatures = [
  'location', 'notifications', 'files', 'openUrl', 'deepLinks', 'store',
  'camera', 'barcode', 'nfc', 'biometrics', 'credentials', 'battery', 'sensors',
  'bluetooth', 'share',
] as const;
export type DeviceFeature = typeof deviceFeatures[number];
export type DevicePermission = 'granted' | 'prompt' | 'denied' | 'unknown';
export type DeviceValue =
  | null | boolean | number | string
  | readonly DeviceValue[]
  | { readonly [key: string]: DeviceValue };

export interface DeviceSubscription {
  dispose(): Promise<void>;
}
export interface DevicePosition {
  readonly latitude: number;
  readonly longitude: number;
  /** Horizontal accuracy and altitude fields are measured in meters. */
  readonly accuracy: number;
  readonly altitude: number | null;
  readonly altitudeAccuracy: number | null;
  readonly heading: number | null;
  readonly speed: number | null;
  /** Unix time in milliseconds. */
  readonly timestamp: number;
}
export interface DeviceNotification {
  readonly title: string;
  readonly body?: string;
}
export interface DeviceFileFilter {
  readonly name: string;
  readonly extensions: readonly string[];
}
export interface DeviceFileOptions {
  readonly multiple?: boolean;
  readonly filters?: readonly DeviceFileFilter[];
}
export interface DeviceFile {
  readonly name: string;
  read(): Promise<Uint8Array>;
}
export interface DeviceCamera extends DeviceSubscription {
  readonly stream: MediaStream;
}
export const deviceBarcodeFormats = [
  'aztec', 'codabar', 'code_39', 'code_93', 'code_128', 'data_matrix', 'ean_8',
  'ean_13', 'itf', 'pdf417', 'qr_code', 'upc_a', 'upc_e',
] as const;
export type DeviceBarcodeFormat = typeof deviceBarcodeFormats[number];
export interface DeviceBarcode {
  readonly text: string;
  readonly format: DeviceBarcodeFormat | 'unknown';
}
export interface DeviceNfcText {
  readonly text: string;
  readonly language?: string;
}
export interface DeviceBattery {
  readonly level: number;
  readonly charging: boolean;
}
export type DeviceSensor =
  | {
      readonly kind: 'orientation';
      readonly alpha: number | null;
      readonly beta: number | null;
      readonly gamma: number | null;
      readonly absolute: boolean;
    }
  | {
      readonly kind: 'acceleration';
      readonly x: number | null;
      readonly y: number | null;
      readonly z: number | null;
    };
export interface DeviceBluetooth extends DeviceSubscription {
  readonly name: string | null;
  read(characteristic: string): Promise<Uint8Array>;
  write(characteristic: string, value: Uint8Array): Promise<void>;
}

export interface DeviceServices {
  readonly location?: {
    current(options?: PositionOptions): Promise<DevicePosition>;
    watch(
      change: (position: DevicePosition) => void,
      failure?: (error: unknown) => void,
      options?: PositionOptions,
    ): Promise<DeviceSubscription>;
  };
  readonly notifications?: {
    permission(): Promise<DevicePermission>;
    requestPermission(): Promise<DevicePermission>;
    show(notification: DeviceNotification): Promise<void>;
  };
  readonly files?: {
    pick(options?: DeviceFileOptions, signal?: AbortSignal): Promise<readonly DeviceFile[]>;
  };
  readonly openUrl?: (url: string | URL) => Promise<void>;
  readonly deepLinks?: {
    current(): Promise<readonly string[]>;
    watch(change: (urls: readonly string[]) => void): Promise<DeviceSubscription>;
  };
  readonly store?: {
    get(key: string): Promise<DeviceValue | undefined>;
    set(key: string, value: DeviceValue): Promise<void>;
    remove(key: string): Promise<void>;
  };
  readonly camera?: {
    open(options?: MediaTrackConstraints): Promise<DeviceCamera>;
  };
  readonly barcode?: {
    scan(formats?: readonly DeviceBarcodeFormat[], signal?: AbortSignal): Promise<DeviceBarcode>;
  };
  readonly nfc?: {
    available(): Promise<boolean>;
    read(signal?: AbortSignal): Promise<DeviceNfcText | null>;
    /** The host controls the active tag write after it has been submitted. */
    write(record: DeviceNfcText): Promise<void>;
  };
  readonly biometrics?: {
    available(): Promise<boolean>;
    authenticate(reason: string): Promise<void>;
  };
  readonly credentials?: {
    /** Send the returned assertion to the server that issued the challenge. */
    get(options: PublicKeyCredentialRequestOptions, signal?: AbortSignal): Promise<PublicKeyCredential>;
  };
  readonly battery?: {
    current(): Promise<DeviceBattery>;
    watch(change: (battery: DeviceBattery) => void): Promise<DeviceSubscription>;
  };
  readonly sensors?: {
    watch(kind: DeviceSensor['kind'], change: (reading: DeviceSensor) => void): Promise<DeviceSubscription>;
  };
  readonly bluetooth?: {
    connect(service: string, namePrefix?: string): Promise<DeviceBluetooth>;
  };
  readonly share?: (content: { readonly title?: string; readonly text?: string; readonly url?: string }) => Promise<void>;
}

const viewServices = new WeakMap<BinaryMessenger, DeviceServices>();

/** Obtain the services of a widget or application startup context. Absent features are unavailable. */
export function deviceServicesFor(context: { readonly binaryMessenger?: BinaryMessenger }): DeviceServices | undefined {
  return context.binaryMessenger && viewServices.get(context.binaryMessenger);
}

/** @internal */
export function bindDeviceServices(messenger: BinaryMessenger, services: DeviceServices): () => void {
  viewServices.set(messenger, services);
  return () => { viewServices.delete(messenger); };
}
