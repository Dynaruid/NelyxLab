// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { Path } from '../../ui/path.ts';
import { Rect } from '../../ui/rect.ts';
import { Offset } from '../../ui/offset.ts';
/** Source shape contract, shared by design packages and custom implementations. */
export abstract class NotchedShape {
  abstract getOuterPath(host: Rect, guest: Rect | null): Path;
}
export class CircularNotchedRectangle extends NotchedShape {
  readonly inverted: boolean;
  constructor({ inverted = false }: { readonly inverted?: boolean } = {}) {
    super();
    if (typeof inverted !== 'boolean') throw new TypeError('inverted must be a non-null bool');
    this.inverted = inverted;
    Object.freeze(this);
  }
  getOuterPath(host: Rect, guest: Rect | null): Path {
    const path = new Path();
    if (guest === null || !host.overlaps(guest)) {
      path.addRect(host);
      return path;
    }
    const r = guest.width / 2,
      invert = this.inverted ? -1 : 1;
    /** @dartType double */
    const s1 = 15;
    /** @dartType double */
    const s2 = 1;
    const a = -r - s2,
      b = (this.inverted ? host.bottom : host.top) - guest.center.dy;
    const n2 = Math.sqrt(b * b * r * r * (a * a + b * b - r * r));
    const xA = (a * r * r - n2) / (a * a + b * b),
      xB = (a * r * r + n2) / (a * a + b * b);
    const yA = Math.sqrt(r * r - xA * xA) * invert,
      yB = Math.sqrt(r * r - xB * xB) * invert;
    const cmp = b < 0 ? -1 : 1,
      p2 = cmp * yA > cmp * yB ? new Offset(xA, yA) : new Offset(xB, yB);
    const points = [
      new Offset(a - s1, b),
      new Offset(a, b),
      p2,
      new Offset(-p2.dx, p2.dy),
      new Offset(-a, b),
      new Offset(-(a - s1), b),
    ].map((p) => p.add(guest.center));
    path.moveTo(host.left, host.top);
    if (!this.inverted) {
      path.lineTo(points[0]!.dx, points[0]!.dy);
      path.quadraticBezierTo(points[1]!.dx, points[1]!.dy, points[2]!.dx, points[2]!.dy);
      appendNotchArc(path, r, points[2]!, points[3]!);
      path.quadraticBezierTo(points[4]!.dx, points[4]!.dy, points[5]!.dx, points[5]!.dy);
      path.lineTo(host.right, host.top);
      path.lineTo(host.right, host.bottom);
      path.lineTo(host.left, host.bottom);
    } else {
      path.lineTo(host.right, host.top);
      path.lineTo(host.right, host.bottom);
      path.lineTo(points[5]!.dx, points[5]!.dy);
      path.quadraticBezierTo(points[4]!.dx, points[4]!.dy, points[3]!.dx, points[3]!.dy);
      appendNotchArc(path, r, points[3]!, points[2]!);
      path.quadraticBezierTo(points[1]!.dx, points[1]!.dy, points[0]!.dx, points[0]!.dy);
      path.lineTo(host.left, host.bottom);
    }
    path.close();
    return path;
  }
}
// Circular, unrotated small CCW specialization of SkPathBuilder::arcTo at
// Flutter DEPS Skia 3136abef8f582a75e9a2791261be3fe5f2f770d1.
// Copyright 2015 Google Inc. BSD-style license: Nelyx/licenses/Skia-LICENSE.md.
// Preserve endpoint admission and native conic subdivision on the existing ABI.
function appendNotchArc(path: Path, radius: number, start: Offset, end: Offset): void {
  const f = Math.fround,
    sx = f(start.dx),
    sy = f(start.dy),
    ex = f(end.dx),
    ey = f(end.dy);
  let r = Math.abs(f(radius));
  if (r === 0 || (sx === ex && sy === ey)) {
    path.lineTo(ex, ey);
    return;
  }
  const mx = f(f(sx - ex) * 0.5),
    my = f(f(sy - ey) * 0.5),
    squareR = f(r * r);
  let radiiScale = f(f(f(mx * mx) / squareR) + f(f(my * my) / squareR));
  if (radiiScale > 1) {
    radiiScale = f(Math.sqrt(radiiScale));
    r = f(r * radiiScale);
  }
  const scale = f(1 / r),
    ux = f(scale * sx),
    uy = f(scale * sy),
    vx = f(scale * ex),
    vy = f(scale * ey);
  let dx = f(vx - ux),
    dy = f(vy - uy);
  const d = f(f(dx * dx) + f(dy * dy)),
    factor = -f(Math.sqrt(Math.max(f(f(1 / d) - 0.25), 0)));
  dx = f(dx * factor);
  dy = f(dy * factor);
  const cx = f(f(f(ux + vx) * 0.5) - dy),
    cy = f(f(f(uy + vy) * 0.5) + dx);
  const from = f(Math.atan2(f(uy - cy), f(ux - cx))),
    to = f(Math.atan2(f(vy - cy), f(vx - cx))),
    pi = f(Math.PI);
  let sweep = f(to - from);
  if (sweep > 0) sweep = f(sweep - f(pi * 2));
  if (Math.abs(sweep) < f(pi / 1_000_000)) {
    path.lineTo(ex, ey);
    return;
  }
  const segments = Math.ceil(Math.abs(f(sweep / f(f(2 * pi) / 3)))),
    width = f(sweep / segments),
    t = f(Math.tan(f(0.5 * width)));
  if (!Number.isFinite(t)) return;
  const weight = f(Math.sqrt(f(0.5 + f(f(Math.cos(width)) * 0.5))));
  const integers =
    Math.abs(f(f(pi / 2) - Math.abs(width))) <= 1 / 4096 && [r, ex, ey].every(Number.isInteger);
  const snap = (v: number) => (Math.abs(v) <= 1 / 65536 ? 0 : f(v));
  let theta = from;
  for (let i = 0; i < segments; i++) {
    const next = f(theta + width),
      sin = snap(Math.sin(next)),
      cos = snap(Math.cos(next));
    const px = f(cos + cx),
      py = f(sin + cy),
      qx = f(px + f(t * sin)),
      qy = f(py - f(t * cos));
    const points = [f(r * qx), f(r * qy), f(r * px), f(r * py)];
    if (integers) for (let j = 0; j < points.length; j++) points[j] = Math.floor(points[j]! + 0.5);
    if (i === segments - 1) {
      points[2] = ex;
      points[3] = ey;
    }
    path.conicTo(points[0]!, points[1]!, points[2]!, points[3]!, weight);
    theta = next;
  }
}
