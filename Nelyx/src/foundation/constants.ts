// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
/** Source foundation/constants.dart numerical tolerance, not a display DPR. */
export const precisionErrorTolerance = 1e-10;
/** Explicit host configuration for source debug/profile/release diagnostic policies. */
export type BuildMode = 'debug' | 'profile' | 'release';
export class FoundationBuildMode {
  private static current: BuildMode = 'release';
  static get mode(): BuildMode {
    return this.current;
  }
  static set mode(mode: BuildMode) {
    if (mode !== 'debug' && mode !== 'profile' && mode !== 'release')
      throw new TypeError('Unknown foundation build mode');
    this.current = mode;
  }
  static get debug(): boolean {
    return this.current === 'debug';
  }
  static get profile(): boolean {
    return this.current === 'profile';
  }
  static get release(): boolean {
    return this.current === 'release';
  }
}
