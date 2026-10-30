// Independent native reference for the unchanged source VM command recipes.
import assert from 'node:assert/strict';
const matrix = (m) => m.map((_, i) => m[(i % 4) * 4 + Math.floor(i / 4)]),
  rgba = (ck, color) =>
    ck.Color((color >>> 16) & 255, (color >>> 8) & 255, color & 255, (color >>> 24) / 255);
export function paintOriginalZoom(
  ck,
  canvas,
  commands,
  { makeSurface = (width, height) => ck.MakeSurface(width, height), imageStorage = 'cpu-png' } = {},
) {
  const base = canvas.getSaveCount(),
    temporaries = [];
  try {
    for (let index = 0; index < commands.length; index++) {
      const command = commands[index];
      switch (command.kind) {
        case 'save':
          if (!['opacity', 'filterMatrix'].includes(commands[index + 1]?.kind)) canvas.save();
          break;
        case 'restore':
          canvas.restore();
          break;
        case 'transform':
          canvas.concat(matrix(command.matrix));
          break;
        case 'opacity': {
          const paint = new ck.Paint();
          try {
            paint.setColor(ck.Color(0, 0, 0, command.alpha / 255));
            canvas.saveLayer(paint);
            canvas.translate(...command.offset);
          } finally {
            paint.delete();
          }
          break;
        }
        case 'filterMatrix': {
          const m = command.matrix,
            filter = ck.ImageFilter.MakeMatrixTransform(
              [m[0], m[4], m[12], m[1], m[5], m[13], m[3], m[7], m[15]],
              { filter: ck.FilterMode.Linear, mipmap: ck.MipmapMode.Linear },
              null,
            ),
            paint = new ck.Paint();
          try {
            paint.setImageFilter(filter);
            canvas.saveLayer(paint);
          } finally {
            paint.delete();
            filter.delete();
          }
          break;
        }
        case 'rect': {
          const paint = new ck.Paint();
          try {
            paint.setAntiAlias(true);
            paint.setColor(rgba(ck, command.color));
            canvas.drawRect(ck.XYWHRect(...command.rect), paint);
          } finally {
            paint.delete();
          }
          break;
        }
        case 'image': {
          const surface = makeSurface(command.width, command.height);
          assert(surface);
          let capture, image;
          try {
            const target = surface.getCanvas();
            target.clear(ck.TRANSPARENT);
            target.scale(command.ratio, command.ratio);
            paintOriginalZoom(ck, target, command.capture, { makeSurface, imageStorage });
            surface.flush();
            capture = surface.makeImageSnapshot();
            if (imageStorage === 'cpu-png')
              image = ck.MakeImageFromEncoded(capture.encodeToBytes());
            else {
              const info = {
                width: command.width,
                height: command.height,
                colorType: ck.ColorType.RGBA_8888,
                alphaType: ck.AlphaType.Premul,
                colorSpace: ck.ColorSpace.SRGB,
              };
              image = ck.MakeImage(info, capture.readPixels(0, 0, info), command.width * 4);
            }
            assert(image);
            const paint = new ck.Paint();
            try {
              paint.setAntiAlias(true);
              paint.setColor(rgba(ck, command.color));
              canvas.drawImageRectOptions(
                image,
                ck.XYWHRect(...command.src),
                ck.XYWHRect(...command.dst),
                ck.FilterMode.Linear,
                ck.MipmapMode.Linear,
                paint,
              );
            } finally {
              paint.delete();
            }
          } finally {
            if (image) temporaries.push(image);
            if (capture) temporaries.push(capture);
            temporaries.push(surface);
          }
          break;
        }
        default:
          throw Error('Unqualified source native command ' + command.kind);
      }
    }
    assert.equal(canvas.getSaveCount(), base, 'Balanced original command scopes');
  } finally {
    canvas.restoreToCount(base);
    for (const temporary of temporaries.reverse()) temporary.delete();
  }
}
export function readSourcePixels(ck, surface) {
  surface.flush();
  const image = surface.makeImageSnapshot();
  try {
    return image.readPixels(0, 0, {
      width: 240,
      height: 160,
      colorType: ck.ColorType.RGBA_8888,
      alphaType: ck.AlphaType.Unpremul,
      colorSpace: ck.ColorSpace.SRGB,
    });
  } finally {
    image.delete();
  }
}
export function equalSourcePixels(actual, expected, label) {
  assert.equal(actual.length, expected.length);
  let difference;
  for (let i = 0; i < actual.length; i++)
    if (actual[i] !== expected[i]) {
      difference = {
        x: Math.floor(i / 4) % 240,
        y: Math.floor(i / 4 / 240),
        channel: i % 4,
        actual: actual[i],
        expected: expected[i],
      };
      break;
    }
  assert.equal(difference, undefined, JSON.stringify({ label, difference }));
}
