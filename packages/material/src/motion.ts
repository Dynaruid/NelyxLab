// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/motion.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { Cubic, Curves } from '@nelyx/core/framework/animation/curves';

/** Material motion durations in milliseconds. */
export const Durations = Object.freeze({
  short1: 50,
  short2: 100,
  short3: 150,
  short4: 200,
  medium1: 250,
  medium2: 300,
  medium3: 350,
  medium4: 400,
  long1: 450,
  long2: 500,
  long3: 550,
  long4: 600,
  extralong1: 700,
  extralong2: 800,
  extralong3: 900,
  extralong4: 1000,
});

export const Easing = Object.freeze({
  emphasizedAccelerate: new Cubic(0.3, 0, 0.8, 0.15),
  emphasizedDecelerate: new Cubic(0.05, 0.7, 0.1, 1),
  linear: new Cubic(0, 0, 1, 1),
  standard: new Cubic(0.2, 0, 0, 1),
  standardAccelerate: new Cubic(0.3, 0, 1, 1),
  standardDecelerate: new Cubic(0, 0, 0, 1),
  legacyDecelerate: new Cubic(0, 0, 0.2, 1),
  legacyAccelerate: new Cubic(0.4, 0, 1, 1),
  legacy: Curves.fastOutSlowIn,
});
