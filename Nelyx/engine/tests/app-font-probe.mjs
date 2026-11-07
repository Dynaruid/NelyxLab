// SPDX-License-Identifier: BSD-3-Clause
import { AppTextLayoutService } from '@nelyx/core/v2/original';
import { ResourceRegistry } from '@nelyx/core/hosting/resources';
import { TextPainter } from '@nelyx/core/framework/painting/text-painter';
import { TextSpan } from '@nelyx/core/framework/painting/text-span';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { Canvas } from '@nelyx/core/ui/canvas';
import { Offset } from '@nelyx/core/ui/offset';
import { fontCatalogBytes, readFontCatalog } from '../../runtime/engine-client/font-catalog.ts';

const check = (value, message) => {
  if (!value) throw Error(message);
};
const rejects = (action, message) => {
  try {
    action();
  } catch (error) {
    return error;
  }
  throw Error(message);
};
/** Actual C++ font decoding, synchronous Source queries, recording holders and
 * quota admission. It deliberately does not claim a Core/Content/Render switch. */
export function appFontProbe(backend, bytes) {
  let pendingStage;
  let fontLeases = 0;
  const resources = new ResourceRegistry(),
    font = resources.allocateId('font-generation-probe');
  resources.register({ ...font, kind: 'font' }, () => {});
  const text = new AppTextLayoutService(
      backend,
      resources,
      resources.captureResource(font),
      (reason) => {
        throw Error(reason);
      },
      (revision) => {
        // This local recording control has no Core upload. The actual engine
        // transition tests exercise the matching Core resource and producer.
        ++fontLeases;
        return {
          binding: {
            resource: revision === 1 ? null : { slot: 50, generation: revision },
            fontRevision: BigInt(revision),
          },
          release() {
            if (--fontLeases < 0) throw Error('Font lease released twice');
          },
        };
      },
    ),
    context = { text, resources, font, scale: 1 },
    painters = new Set(),
    canvases = new Set(),
    make = (family, value = 'אבג ABC') => {
      const painter = new TextPainter(
        {
          text: new TextSpan({
            text: value,
            style: new TextStyle({ fontSize: 24, ...(family ? { fontFamily: family } : {}) }),
          }),
          textDirection: 'ltr',
        },
        context,
      );
      painters.add(painter);
      painter.layout({ minWidth: 240, maxWidth: 240 });
      return painter;
    },
    dispose = (painter) => {
      painter.dispose();
      painters.delete(painter);
    },
    capture = (painter) => {
      const canvas = new Canvas();
      canvases.add(canvas);
      painter.paint(canvas, new Offset(0, 0));
      return { canvas, resource: canvas.commands[0].resource };
    },
    observe = (revision) => text.observeFontRevision(BigInt(revision)),
    prepare = (data) => {
      const token = backend.prepareFonts(data);
      pendingStage = token;
      return token;
    },
    finish = (token, committed) => {
      backend.finishFonts(token, committed);
      pendingStage = undefined;
    },
    activate = (data) => {
      const stage = prepare(data),
        revision = backend.activateFonts(stage);
      observe(revision);
      finish(stage, true);
      return revision;
    };
  let report;
  try {
    const beforeFamily = backend.snapshot(),
      paddedFont = new Uint8Array(bytes.length + 16);
    paddedFont.set(bytes, 8);
    const intrinsicFamily = backend.fontFamily(paddedFont.subarray(8, 8 + bytes.length));
    check(
      intrinsicFamily === 'Noto Sans Hebrew',
      'C++ must read the intrinsic family from the exact view',
    );
    check(
      backend.snapshot().fontLoads === beforeFamily.fontLoads + 1 &&
        backend.snapshot().fontRevision === beforeFamily.fontRevision &&
        backend.snapshot().fontStages === 0,
      'Intrinsic family decoding is observed without publication',
    );
    rejects(() => backend.fontFamily(new Uint8Array(0)), 'An empty font cannot be queried');
    rejects(
      () => backend.fontFamily(new Uint8Array(16)),
      'The real decoder must reject malformed fonts',
    );
    const credits = [],
      initialCredit = backend.snapshot();
    let creditError;
    try {
      for (const value of [0, -1, Infinity, 0.5, 64 * 1024 * 1024])
        rejects(() => backend.reserveFontBytes(value), 'Invalid font buffer credit was accepted');
      const first = backend.reserveFontBytes(65536);
      credits.push(first);
      check(
        backend.snapshot().fontBuffers === 1 &&
          backend.snapshot().fontBufferBytes === 65536 &&
          backend.snapshot().reservedBytes === initialCredit.reservedBytes + 65536,
        'Font buffer allocation must be preceded by its exact credit',
      );
      rejects(() => backend.close(), 'Closing cannot discard a live font buffer credit');
      rejects(
        () => backend.releaseFontBytes(first + 1000),
        'Foreign font buffer credit was released',
      );
      backend.releaseFontBytes(first);
      credits.pop();
      rejects(() => backend.releaseFontBytes(first), 'Font buffer credit was released twice');
      for (let i = 0; i < 30; ++i) {
        try {
          credits.push(backend.reserveFontBytes(16 * 1024 * 1024));
        } catch (error) {
          creditError = error;
          break;
        }
      }
      check(
        credits.length > 0 &&
          credits.length < 30 &&
          /quota|budget|memory/i.test(String(creditError)),
        'Font buffer credits must be bounded inside the admitted App quota',
      );
      const oversized = new Uint8Array(8 * 1024 * 1024),
        decodes = backend.snapshot().fontLoads;
      oversized.set(bytes);
      const exhausted = rejects(
        () => backend.fontFamily(oversized),
        'Family inference must reserve before C++ decoding',
      );
      check(
        /quota|budget|memory/i.test(String(exhausted)) && backend.snapshot().fontLoads === decodes,
        'Rejected family inference must preserve the decoder count',
      );
    } finally {
      for (const credit of credits) backend.releaseFontBytes(credit);
    }
    const creditAdmissions = credits.length;
    check(
      backend.snapshot().fontBuffers === 0 &&
        backend.snapshot().fontBufferBytes === 0 &&
        backend.snapshot().reservedBytes === initialCredit.reservedBytes,
      'Font buffer credits must return to their baseline',
    );
    const old = make(),
      original = old._layoutSnapshot(),
      oldBoxes = text.boxes(original, 0, 3),
      oldPaint = capture(old),
      data = fontCatalogBytes({
        fonts: [{ family: 'ReviewHebrew', bytes }],
        fallback: ['ReviewHebrew', 'NelyxDefault', 'NelyxArabic', 'NelyxEmoji'],
      });
    check(
      readFontCatalog(data).fonts[0].bytes.length === bytes.length,
      'Neutral font catalog owns the exact supplied input',
    );
    rejects(() => make('ReviewHebrew'), 'Unknown family must fail before a font is published');
    // make() tracks a rejected painter too, so finally still retires it.
    const initial = backend.snapshot(),
      paddedInput = new Uint8Array(data.length + 8);
    paddedInput.set(data, 4);
    const copiedInput = paddedInput.subarray(4, 4 + data.length),
      stage = prepare(copiedInput);
    copiedInput.fill(0);
    const chunk = backend.fontChunk(stage, 0, Math.min(data.length, 256 * 1024));
    check(
      chunk.every((value, index) => value === data[index]),
      'Core upload reads the immutable catalog decoded by App, including offset input',
    );
    chunk.fill(0);
    check(
      backend.fontChunk(stage, 0, 32).every((value, index) => value === data[index]),
      'A copied chunk cannot mutate its stage',
    );
    rejects(() => backend.fontChunk(stage, -1, 32), 'Negative font chunk offset must fail');
    rejects(() => backend.fontChunk(stage, 0, 256 * 1024 + 1), 'Font chunks are bounded');
    rejects(
      () => backend.fontChunk(stage, data.length - 1, 2),
      'Font chunk cannot cross its stage',
    );
    rejects(() => backend.fontChunk(stage + 1, 0, 32), 'Foreign font stage read must fail');
    check(
      backend.snapshot().fontRevision === 1 && backend.snapshot().fontStages === 1,
      'Preparation must leave the active generation intact',
    );
    rejects(() => backend.close(), 'A prepared stage must prevent premature close');
    rejects(() => backend.prepareFonts(data), 'One pending candidate per owner');
    rejects(() => backend.activateFonts(stage + 1), 'Foreign stage must be rejected');
    rejects(() => backend.finishFonts(stage, true), 'Unactivated stage cannot commit');
    const revision = backend.activateFonts(stage);
    check(revision > 1, 'Activation must allocate a new revision');
    const whilePending = make();
    check(
      whilePending._layoutSnapshot().maxIntrinsicWidth === original.maxIntrinsicWidth,
      'Source can still synchronously shape its observed cohort while a candidate awaits Core',
    );
    dispose(whilePending);
    check(
      backend.snapshot(1).fontRevision === 1 &&
        !backend.snapshot(1).fontFamilies.includes('ReviewHebrew'),
      'Previous cohort has its own family selection',
    );
    rejects(() => backend.snapshot(Number.MAX_SAFE_INTEGER), 'Unknown font revisions are rejected');
    rejects(() => backend.activateFonts(stage), 'Repeated activation must be rejected');
    rejects(
      () => make('ReviewHebrew'),
      'Source must observe the exact backend revision before new layout',
    );
    observe(revision);
    finish(stage, true);
    rejects(() => backend.fontChunk(stage, 0, 32), 'Retired stage bytes must not be readable');
    observe(1); // A late old publication cannot change the current Source cohort.
    rejects(() => backend.finishFonts(stage, true), 'Retired stage cannot commit twice');
    const custom = make('ReviewHebrew', 'אבג'),
      control = make('NelyxHebrew', 'אבג');
    check(
      custom._layoutSnapshot().unresolvedGlyphs === 0,
      'New family must actually resolve glyphs',
    );
    check(
      custom.maxIntrinsicWidth === control.maxIntrinsicWidth && custom.height === control.height,
      'Decoded custom face must match the bundled face C++ control',
    );
    check(
      JSON.stringify(text.boxes(original, 0, 3)) === JSON.stringify(oldBoxes),
      'An older paragraph keeps its original font geometry',
    );
    const oldCapture = text.capturePaint(oldPaint.resource);
    check(
      oldCapture.fontRevision === 1n &&
        oldCapture.fontBinding.resource === null &&
        Object.isFrozen(oldCapture.fontBinding),
      'An older recording retains its original revision',
    );
    const customPaint = capture(custom);
    dispose(custom);
    dispose(control);
    dispose(old);
    const customCapture = text.capturePaint(customPaint.resource);
    check(
      customCapture.fontRevision === BigInt(revision) &&
        customCapture.fontBinding.resource.generation === revision,
      'Recording outlives its Source painter',
    );

    const reset = fontCatalogBytes({ fonts: [] }),
      rollbackStage = prepare(reset),
      rollbackRevision = backend.activateFonts(rollbackStage);
    observe(rollbackRevision);
    const provisional = make(),
      provisionalLayout = provisional._layoutSnapshot(),
      provisionalPaint = capture(provisional);
    finish(rollbackStage, false);
    observe(revision);
    check(
      backend.snapshot().fontRevision === revision &&
        text.capturePaint(provisionalPaint.resource).fontRevision === BigInt(rollbackRevision),
      'Rollback restores current identity and preserves provisional holders',
    );
    text.boxes(provisionalLayout, 0, 3);
    dispose(provisional);
    provisionalPaint.canvas.dispose();
    canvases.delete(provisionalPaint.canvas);
    const resetRevision = activate(reset);
    check(resetRevision > rollbackRevision, 'A rolled back revision must never be reused');
    rejects(() => make('ReviewHebrew'), 'Removing a custom family must affect subsequent layout');
    check(
      text.capturePaint(customPaint.resource).fontRevision === BigInt(revision),
      'Removal cannot retire a retained recording',
    );
    const heldCatalogs = backend.snapshot().fontCatalogs;
    customPaint.canvas.dispose();
    canvases.delete(customPaint.canvas);
    check(
      backend.snapshot().fontCatalogs === heldCatalogs - 1,
      'Last recording holder retires its custom collection',
    );
    oldPaint.canvas.dispose();
    canvases.delete(oldPaint.canvas);

    const fallbackRevision = activate(
        fontCatalogBytes({
          fonts: [],
          fallback: ['NelyxHebrew', 'NelyxDefault', 'NelyxArabic', 'NelyxEmoji'],
        }),
      ),
      fallback = make(undefined, 'ABC אבג'),
      fallbackControl = make('NelyxHebrew', 'ABC אבג');
    check(
      fallback.maxIntrinsicWidth === fallbackControl.maxIntrinsicWidth &&
        fallback.height === fallbackControl.height,
      'Fallback order must reach the C++ paragraph builder',
    );
    dispose(fallback);
    dispose(fallbackControl);

    const replacementRevision = activate(
        fontCatalogBytes({
          fonts: [{ family: 'NelyxDefault', bytes }],
          fallback: ['NelyxDefault', 'NelyxArabic', 'NelyxEmoji'],
        }),
      ),
      replacement = make(undefined, 'ABC אבג'),
      replacementControl = make('NelyxHebrew', 'ABC אבג');
    check(
      replacement.maxIntrinsicWidth === replacementControl.maxIntrinsicWidth &&
        replacement.height === replacementControl.height,
      'Replacing a bundled alias must use the supplied face, without mutating the base cohort',
    );
    dispose(replacement);
    dispose(replacementControl);

    const beforeFailure = backend.snapshot(),
      malformed = data.slice();
    malformed[20] = 1;
    rejects(() => backend.prepareFonts(malformed), 'Nonzero reserved catalog input must fail');
    for (const [at, value] of [
      [0, 0],
      [4, 2],
      [8, 65],
      [12, 9],
      [32, 0],
      [36, 0],
      [40, 1],
    ]) {
      const corrupted = data.slice();
      new DataView(corrupted.buffer).setUint32(at, value, true);
      rejects(
        () => readFontCatalog(corrupted),
        'Neutral decoder must reject malformed font metadata',
      );
      rejects(
        () => backend.prepareFonts(corrupted),
        'Backend must independently reject malformed font metadata',
      );
    }
    for (const [at, value] of [
      [40, 255],
      [40, 88],
      [52, 1],
    ]) {
      const corrupted = fontCatalogBytes({ fonts: [] });
      corrupted[at] = value;
      rejects(() => readFontCatalog(corrupted), 'Neutral fallback names/padding are strict');
      rejects(() => backend.prepareFonts(corrupted), 'Backend fallback names/padding are strict');
    }
    rejects(
      () => backend.prepareFonts(data.subarray(0, data.length - 1)),
      'Truncated font input must fail',
    );
    rejects(
      () =>
        backend.prepareFonts(
          fontCatalogBytes({ fonts: [{ family: 'Broken', bytes: new Uint8Array(12) }] }),
        ),
      'Actual C++ decoder must reject an invalid font',
    );
    check(
      backend.snapshot().fontRevision === replacementRevision &&
        backend.snapshot().fontStages === 0 &&
        backend.snapshot().fontCatalogs === beforeFailure.fontCatalogs,
      'Font failure must preserve the current collection and release its candidate',
    );
    const abortStage = prepare(reset);
    finish(abortStage, false);
    rejects(() => backend.activateFonts(abortStage), 'Aborted candidate cannot later activate');

    // Pin old paragraphs until admission rejects a subsequent collection. Four
    // legal faces per generation reach both Native and Web quotas in <=30 tries.
    const pressure = fontCatalogBytes({
      fonts: Array.from({ length: 4 }, () => ({ family: 'QuotaHebrew', bytes })),
    });
    let admitted = 0,
      budgetError;
    for (; admitted < 30; ++admitted) {
      let candidate;
      try {
        candidate = prepare(pressure);
      } catch (error) {
        budgetError = error;
        break;
      }
      const next = backend.activateFonts(candidate);
      observe(next);
      finish(candidate, true);
      make('QuotaHebrew', 'אבג');
    }
    check(
      admitted > 0 && admitted < 30 && /quota|memory|budget/i.test(String(budgetError)),
      'Live immutable collections must be bounded before C++ allocation',
    );
    for (const painter of painters) painter.dispose();
    painters.clear();
    activate(reset);
    check(
      backend.snapshot().fontCatalogs === 2 && backend.snapshot().fontStages === 0,
      'Unused generations retire after releasing their last paragraph',
    );
    const recovered = make();
    dispose(recovered);
    const execution = text.execution;
    check(
      execution.layouts > 0 &&
        execution.layouts === execution.sdkLayouts &&
        execution.queries === execution.sdkQueries &&
        execution.tsFallbacks === 0,
      'Actual C++ font-generation work must equal SDK work with no TS shaping',
    );
    check(
      execution.paragraphs === 0 && execution.fontLoads >= 1 + admitted * 4,
      'All paragraph holders drain and supplied faces are decoded in C++',
    );
    report = {
      intrinsicFamily,
      creditAdmissions,
      revision,
      rollbackRevision,
      resetRevision,
      fallbackRevision,
      replacementRevision,
      admitted,
      initialCatalogs: initial.fontCatalogs,
      execution,
    };
  } finally {
    for (const painter of painters) painter.dispose();
    for (const canvas of canvases) canvas.dispose();
    if (pendingStage !== undefined) backend.finishFonts(pendingStage, false);
    resources.dispose();
    check(fontLeases === 0, 'Font binding leases follow paragraph and recording retirement');
    text.close();
  }
  return { ...report, closed: text.execution };
}
