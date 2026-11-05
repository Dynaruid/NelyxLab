// SPDX-License-Identifier: BSD-3-Clause
import { NodeWidget } from './widgets.ts';
import type { Widget, NodeOptions } from './widgets.ts';
import type { AffineMatrix, PathSegment } from './codec.ts';

export class Transform extends NodeWidget {
  constructor(child: Widget, matrix: AffineMatrix, options: NodeOptions = {}) {
    super('transform', [child], {
      ...options,
      graphics: { ...options.graphics, transform: matrix },
    });
  }
  static translate(child: Widget, x: number, y: number, options: NodeOptions = {}): Transform {
    return new Transform(child, [1, 0, 0, 1, x, y], options);
  }
  static scale(child: Widget, x: number, y = x, options: NodeOptions = {}): Transform {
    return new Transform(child, [x, 0, 0, y, 0, 0], options);
  }
  static rotate(child: Widget, radians: number, options: NodeOptions = {}): Transform {
    const c = Math.cos(radians),
      s = Math.sin(radians);
    return new Transform(child, [c, s, -s, c, 0, 0], options);
  }
}
/** Immutable after construction; C++ validates and owns the prepared path. */
export class VectorPath {
  readonly segments: readonly PathSegment[];
  constructor(
    segments: readonly PathSegment[],
    readonly fillRule: 'winding' | 'evenOdd' = 'winding',
  ) {
    this.segments = Object.freeze(
      segments.map((segment) => Object.freeze([...segment]) as PathSegment),
    );
  }
}
export class PathShape extends NodeWidget {
  constructor(path: VectorPath, options: NodeOptions = {}) {
    super('path', [], {
      ...options,
      graphics: { ...options.graphics, path: path.segments, fillRule: path.fillRule },
    });
  }
}
export class ClipPath extends NodeWidget {
  constructor(child: Widget, path: VectorPath, options: NodeOptions = {}) {
    super('clip', [child], {
      ...options,
      graphics: { ...options.graphics, path: path.segments, fillRule: path.fillRule },
    });
  }
}
export class ClipRRect extends NodeWidget {
  constructor(child: Widget, radius: number, options: NodeOptions = {}) {
    super('clip', [child], { ...options, radius });
  }
}
export class ImageFiltered extends NodeWidget {
  constructor(child: Widget, sigma: number, options: NodeOptions = {}) {
    super('effect', [child], { ...options, graphics: { ...options.graphics, blur: sigma } });
  }
}
/** App supplies complete immutable geometry; it never runs inside native layout/paint. */
export class AppDrivenBoundary extends NodeWidget {
  constructor(
    width: number,
    height: number,
    children: readonly Widget[],
    options: NodeOptions = {},
  ) {
    super('stack', children, {
      ...options,
      properties: { ...options.properties, width, height },
      layout: false,
      appDrivenGeometry: true,
    });
  }
}
/** Static C++ extension; bounded normalized samples become an engine-owned path. */
export class NativeSparkline extends NodeWidget {
  constructor(values: readonly number[], width: number, height: number, options: NodeOptions = {}) {
    const samples = Object.freeze([...values]);
    super('path', [], {
      ...options,
      properties: { ...options.properties, width, height },
      layout: false,
      graphics: {
        ...options.graphics,
        stroke: options.graphics?.stroke ?? { width: 2, color: 0xff6750a4 },
      },
      nativeSparkline: { width, height, values: samples },
    });
  }
}
