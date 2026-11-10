// SPDX-License-Identifier: BSD-3-Clause
// The bounded friction branch uses the existing framework FrictionSimulation
// equations (Flutter BSD-3-Clause); no fast-math or per-frame Euler integration.
#pragma once
#include <algorithm>
#include <cmath>
#include <utility>

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
// Flutter PageScrollPhysics + the default ScrollPhysics spring (mass .5,
// stiffness 100, damping ratio 1.1). Closed-form _OverdampedSolution from
// physics/spring_simulation.dart at 71e4717a61786faab4c7aa39825989305ed29e8a.
struct PageSpring {
  static double target(double offset,double velocity,double extent,double minimum,double maximum,double scale) {
    const double tolerance=20/std::max(scale,0.001);
    const double page=offset/extent+(velocity>tolerance?.5:velocity<-tolerance?-.5:0);
    return std::clamp(std::floor(page+.5)*extent,minimum,maximum);
  }
  static std::pair<double,double> sample(double start,double target,double velocity,double seconds) {
    const double mass=.5,stiffness=100,damping=1.1*2*std::sqrt(mass*stiffness);
    const double root=std::sqrt(damping*damping-4*mass*stiffness);
    const double r1=(-damping-root)/(2*mass),r2=(-damping+root)/(2*mass);
    const double c2=(velocity-r1*(start-target))/(r2-r1),c1=start-target-c2;
    const double a=c1*std::exp(r1*seconds),b=c2*std::exp(r2*seconds);
    return {target+a+b,a*r1+b*r2};
  }
};
}
