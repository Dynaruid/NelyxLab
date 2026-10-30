import assert from 'node:assert/strict';
/** Independent native primitive receiver for original VM predictive commands. */
export function paintOriginalPredictive(ck, canvas, commands) {
  const base = canvas.getSaveCount();
  try {
    for (let i = 0; i < commands.length; i++) {
      const c = commands[i];
      switch (c.kind) {
        case 'save':
          if (commands[i + 1]?.kind !== 'opacity') canvas.save();
          break;
        case 'restore':
          canvas.restore();
          break;
        case 'transform':
          canvas.concat(c.matrix.map((_, i) => c.matrix[(i % 4) * 4 + Math.floor(i / 4)]));
          break;
        case 'opacity': {
          if (c.parent === 'RenderOpacity' && c.alpha === 255) {
            canvas.save();
            canvas.translate(...c.offset);
            break;
          }
          const paint = new ck.Paint();
          try {
            paint.setColor(ck.Color(0, 0, 0, c.alpha / 255));
            canvas.saveLayer(paint);
            canvas.translate(...c.offset);
          } finally {
            paint.delete();
          }
          break;
        }
        case 'clipRRect': {
          assert(
            c.radius.every((r) => r === c.radius[0]),
            'Finite source fixture supplies uniform radii',
          );
          canvas.clipRRect(
            ck.RRectXY(ck.XYWHRect(...c.rect), c.radius[0], c.radius[1]),
            ck.ClipOp.Intersect,
            true,
          );
          break;
        }
        case 'rect': {
          const paint = new ck.Paint();
          try {
            paint.setAntiAlias(true);
            paint.setColor(
              ck.Color(
                (c.color >>> 16) & 255,
                (c.color >>> 8) & 255,
                c.color & 255,
                (c.color >>> 24) / 255,
              ),
            );
            canvas.drawRect(ck.XYWHRect(...c.rect), paint);
          } finally {
            paint.delete();
          }
          break;
        }
        default:
          throw Error('Unqualified original predictive command ' + c.kind);
      }
    }
    assert.equal(canvas.getSaveCount(), base);
  } finally {
    canvas.restoreToCount(base);
  }
}
