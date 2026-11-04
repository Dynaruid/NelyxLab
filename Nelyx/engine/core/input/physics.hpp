// SPDX-License-Identifier: BSD-3-Clause
// The bounded friction branch uses the existing framework FrictionSimulation
// equations (Flutter BSD-3-Clause); no fast-math or per-frame Euler integration.
#pragma once
#include <algorithm>
#include <cmath>

namespace nelyx::v2 {
struct Friction {
  static constexpr double drag = 0.135;
  static double position(double start, double velocity, double seconds) {
    return start + velocity * (std::pow(drag, seconds) - 1) / std::log(drag);
  }
  static double velocity(double startVelocity, double seconds) {
    return startVelocity * std::pow(drag, seconds);
  }
};
}
