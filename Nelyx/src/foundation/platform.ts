// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from the pinned Flutter foundation/platform.dart and conditional implementations.
import { FoundationBuildMode } from './constants.ts';
import { FlutterError } from './flutter-error.ts';

export type TargetPlatform = 'android' | 'fuchsia' | 'iOS' | 'linux' | 'macOS' | 'windows';
export type BrowserOperatingSystem = Exclude<TargetPlatform, 'fuchsia'> | 'unknown';
export interface NativePlatformEnvironment {
  readonly kind: 'native';
  readonly operatingSystem: string;
  readonly isTest?: boolean;
}
/** The host may supply getters; browser OS detection stays outside core. */
export interface WebPlatformEnvironment {
  readonly kind: 'web';
  readonly operatingSystem: BrowserOperatingSystem;
  readonly isTest?: boolean;
  readonly debugOperatingSystemOverride?: BrowserOperatingSystem | null;
}
export type FoundationPlatformEnvironment = NativePlatformEnvironment | WebPlatformEnvironment;

function _operatingSystemToTargetPlatform(os: BrowserOperatingSystem): TargetPlatform {
  return os === 'unknown' ? 'android' : os;
}
/** One realm-wide source platform selection, configured by SDK composition. */
export class FoundationPlatform {
  private static environment: FoundationPlatformEnvironment = {
    kind: 'native',
    operatingSystem: 'unknown',
  };
  private static _debugDefaultTargetPlatformOverride: TargetPlatform | null = null;
  private static browserCached: TargetPlatform | undefined;
  /** Reconfiguring the host starts a new browser cache; overrides remain explicit. */
  static configure(environment: FoundationPlatformEnvironment): void {
    if (environment !== this.environment) {
      this.environment = environment;
      this.browserCached = undefined;
    }
  }
  static get hostEnvironment(): FoundationPlatformEnvironment {
    return this.environment;
  }
  static get defaultTargetPlatform(): TargetPlatform {
    return this.environment.kind === 'web' ? this._webTargetPlatform : this._nativeTargetPlatform;
  }
  static get debugDefaultTargetPlatformOverride(): TargetPlatform | null {
    return this._debugDefaultTargetPlatformOverride;
  }
  static set debugDefaultTargetPlatformOverride(value: TargetPlatform | null) {
    if (!FoundationBuildMode.debug)
      throw new FlutterError(
        'Cannot modify debugDefaultTargetPlatformOverride in non-debug builds.',
      );
    this._debugDefaultTargetPlatformOverride = value;
  }
  private static get _nativeTargetPlatform(): TargetPlatform {
    const environment = this.environment;
    if (environment.kind !== 'native') throw new TypeError('Native platform environment required');
    const os = environment.operatingSystem;
    let result: TargetPlatform | null =
      os === 'ios'
        ? 'iOS'
        : os === 'macos'
          ? 'macOS'
          : ['android', 'fuchsia', 'linux', 'windows'].includes(os)
            ? (os as TargetPlatform)
            : null;
    if (FoundationBuildMode.debug && environment.isTest) result = 'android';
    if (FoundationBuildMode.debug && this._debugDefaultTargetPlatformOverride !== null)
      result = this._debugDefaultTargetPlatformOverride;
    if (result === null)
      throw new FlutterError(
        'Unknown platform.\n' +
          os +
          ' was not recognized as a target platform. Consider updating the list of TargetPlatforms to include this platform.',
      );
    return result;
  }
  private static get _webTargetPlatform(): TargetPlatform {
    return this._debugDefaultTargetPlatformOverride ?? this._testPlatform ?? this._browserPlatform;
  }
  private static get _testPlatform(): TargetPlatform | null {
    const environment = this.environment;
    if (environment.kind !== 'web' || !FoundationBuildMode.debug || !environment.isTest)
      return null;
    return environment.debugOperatingSystemOverride != null
      ? _operatingSystemToTargetPlatform(environment.operatingSystem)
      : 'android';
  }
  private static get _browserPlatform(): TargetPlatform {
    const environment = this.environment;
    if (environment.kind !== 'web') throw new TypeError('Web platform environment required');
    return (this.browserCached ??= _operatingSystemToTargetPlatform(environment.operatingSystem));
  }
}
