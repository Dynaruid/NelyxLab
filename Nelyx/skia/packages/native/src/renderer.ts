import { createEnginePath } from './path.ts';
import { submitNativeScene } from './scene.ts';
import type { DisplayListTarget, DisplayListCanvas } from './display-list.ts';
import type { PathSnapshot, PathQueryService } from '@nelyx/core/ui/path';
import type { Offset } from '@nelyx/core/ui/geometry';
import type { SkCanvas } from './skia/types/Drawing.ts';
import type { SkGraphiteContext } from './skia/types/Graphite.ts';
import type { SkImage, SkPicture } from './skia/types/Drawing.ts';
import type { Skia } from './skia/types/Skia.ts';
import { isCurrent, resourceKey } from '@nelyx/core/ui/frame';
import type {
  PaintFrame,
  RendererCapabilities,
  RendererNotification,
  SubmitResult,
  ViewMetrics,
  ViewOwner,
} from '@nelyx/core/ui/types';
import type { Renderer } from '@nelyx/core/hosting/runtime';
import { RendererEvents } from '@nelyx/core/hosting/renderer-events';
import type { ResourceLease } from '@nelyx/core/hosting/resources';
import type { ParagraphPaint } from './text.ts';
import type { PaintSnapshot } from '@nelyx/core/ui/paint';
import type { SkPaint } from './skia/types/Drawing.ts';
import { applyPaintEffects } from './paint-effects.ts';
import { createRuntimeShaderCache } from './paint-effects.ts';
import type { Disposable } from '@nelyx/core/foundation/disposable';
export { createRuntimeShaderCache } from './paint-effects.ts';
export function createPathQueries(api: Skia, assertOpen: () => void): PathQueryService {
  return Object.freeze({
    contains(path: PathSnapshot, point: Offset): boolean {
      assertOpen();
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y))
        throw new Error('Path query point must be finite');
      const native = createEnginePath(api, path),
        errors: unknown[] = [];
      let value = false;
      try {
        value = native.contains(point.x, point.y);
      } catch (error) {
        errors.push(error);
      } finally {
        try {
          native.dispose();
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length === 1) throw errors[0];
      if (errors.length) throw new AggregateError(errors, 'Native path query/retirement failed');
      return value;
    },
  });
}
type SkiaAPI = Skia;
export interface NelyxGraphiteContext extends SkGraphiteContext {
  nelyxConfigure(): void;
  nelyxIdentity(): number;
  nelyxReserve(
    identity: number,
    width: number,
    height: number,
    bytes: number,
    density: number,
  ): number;
  nelyxReserveEpoch?(
    identity: number,
    width: number,
    height: number,
    bytes: number,
    density: number,
    surface: number,
  ): number;
  nelyxCancel(): void;
  nelyxClose(): void;
  nelyxReset(): void;
  nelyxStats(): number[];
  nelyxCoreVersion(): number;
  nelyxWireVersion(): number;
  nelyxSubmit(
    recording: ReturnType<SkGraphiteContext['finishRecording']>,
    submission: number,
  ): void;
  nelyxSubmitFrame?(
    recording: ReturnType<SkGraphiteContext['finishRecording']>,
    submission: number,
    owner: number,
    viewport: number,
    frame: number,
    input: number,
    inputTimestamp: number,
    tick: number,
    uncertainty: number,
  ): void;
  nelyxNotifications(): number[];
}
export interface GraphiteResources {
  image(id: string): SkImage;
  paragraph(id: string): ParagraphPaint;
  picture?(id: string): SkPicture;
  readonly runtimePrograms?: ReturnType<typeof createRuntimeShaderCache>;
  readonly nativeDisplayLists?: boolean;
}
/** Drain polling is host work, separate from an application's retired timers. */
export interface GraphiteRetirementClock {
  now(): number;
  delay(milliseconds: number): Promise<void>;
}
const retirementClock: GraphiteRetirementClock = {
  now: () => performance.now(),
  delay: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
};
import { configurePaint } from './paint.ts';
export function replayFrame(
  api: SkiaAPI,
  canvas: SkCanvas,
  frame: PaintFrame,
  resources: GraphiteResources,
  programs: GraphiteResources['runtimePrograms'] = resources.runtimePrograms,
): void {
  const temporary: unknown[] = [],
    errors: unknown[] = [],
    own = <T>(value: T): T => {
      temporary.push(value);
      return value;
    };
  // Native canvas calls copy their const SkPaint. Reuse a small palette of
  // ordinary fills within this replay, then retire each wrapper exactly once.
  // Effects and backdrop paint mutations keep independent temporary owners.
  const fills = new Map<number, SkPaint>();
  const batch = canvas as Partial<DisplayListCanvas>,
    nativeFills = new Set<PaintFrame['commands'][number]>();
  const isPlainFill = (value: PaintSnapshot): boolean =>
    value.blendMode === 'srcOver' &&
    value.style === 'fill' &&
    value.isAntiAlias &&
    value.strokeWidth === 0 &&
    value.strokeCap === 'butt' &&
    value.strokeJoin === 'miter' &&
    value.strokeMiterLimit === 4 &&
    !value.shader &&
    !value.colorFilter &&
    !value.imageFilter &&
    !value.maskFilter &&
    (value.filterQuality ?? 'none') === 'none' &&
    !value.invertColors &&
    !value.dither;
  const rounded = (v: readonly number[]) => {
    const rect = own(api.XYWHRect(0, 0, 0, 0));
    rect.setLTRB(v[0]!, v[1]!, v[2]!, v[3]!);
    return {
      rect,
      topLeft: { x: v[4]!, y: v[5]! },
      topRight: { x: v[6]!, y: v[7]! },
      bottomRight: { x: v[8]!, y: v[9]! },
      bottomLeft: { x: v[10]!, y: v[11]! },
    };
  };
  const styledPaint = (paint: SkPaint, value: PaintSnapshot) => {
    configurePaint(api, paint, value);
    return applyPaintEffects(api, paint, value, own, (key) => resources.image(key), programs);
  };
  try {
    const paint = own(api.Paint());
    paint.setAntiAlias(true);
    // Resolve effects before any canvas mutation. Recordings hold the native
    // references after temporary wrappers are released.
    const imageRefs = new Map<PaintFrame['commands'][number], SkImage>(),
      paragraphRefs = new Map<PaintFrame['commands'][number], ParagraphPaint>(),
      pictureRefs = new Map<PaintFrame['commands'][number], SkPicture>();
    for (const command of frame.commands)
      if ('resource' in command) {
        const key = resourceKey(command.resource);
        if (command.op === 'paragraph') paragraphRefs.set(command, resources.paragraph(key));
        else if (command.op === 'drawPicture') {
          const picture = resources.picture?.(key);
          if (!picture) throw new Error('Stale native frame picture');
          pictureRefs.set(command, picture);
        } else imageRefs.set(command, resources.image(key));
      }
    const styles = new Map<PaintFrame['commands'][number], SkPaint | null>(),
      backdrops = new Map<PaintFrame['commands'][number], ReturnType<typeof applyPaintEffects>>();
    for (const command of frame.commands)
      if ('paint' in command) {
        // A plain zero-alpha srcOver primitive cannot change the destination.
        // Keep the captured commands and frame resource admission intact. Layers,
        // image draws and effects retain their normal replay and failure paths.
        const paintValue = command.paint,
          primitive =
            command.op === 'drawRect' ||
            command.op === 'drawOval' ||
            command.op === 'drawRRect' ||
            command.op === 'drawLine' ||
            command.op === 'drawPath' ||
            command.op === 'drawPaint';
        if (
          primitive &&
          paintValue.color >>> 24 === 0 &&
          paintValue.blendMode === 'srcOver' &&
          !paintValue.shader &&
          !paintValue.colorFilter &&
          !paintValue.imageFilter &&
          !paintValue.maskFilter &&
          !paintValue.invertColors
        ) {
          styles.set(command, null);
          continue;
        }
        const shared = command.op !== 'saveBackdropFilter' && isPlainFill(command.paint);
        if (
          shared &&
          batch.nelyxFillRect &&
          (command.op === 'drawRect' || command.op === 'drawOval')
        ) {
          nativeFills.add(command);
          continue;
        }
        let value = shared ? fills.get(command.paint.color) : undefined;
        if (!value) {
          value = own(api.Paint());
          // JsiSkPaint::createCtor owns a fresh default SkPaint with anti-alias
          // enabled. Plain fills already match every scalar/effect default;
          // only their colour needs a native call. General scalar configuration
          // stays unchanged for effectful paints and existing public callers.
          if (shared) value.setColor(api.Color(command.paint.color));
          else {
            const filter = styledPaint(value, command.paint);
            if (command.op === 'saveBackdropFilter') {
              backdrops.set(command, filter);
              value.setImageFilter(null);
            }
          }
          if (shared && fills.size < 64) fills.set(command.paint.color, value);
        }
        styles.set(command, value);
      }
    for (const command of frame.commands) {
      const styled = styles.get(command)!;
      if (styled === null) continue;
      switch (command.op) {
        case 'drawPicture':
          canvas.drawPicture(pictureRefs.get(command)!);
          break;
        case 'clear':
          canvas.clear(api.Color(command.color));
          break;
        case 'save':
          canvas.save();
          break;
        case 'restore':
          canvas.restore();
          break;
        case 'transform': {
          if (command.matrix.length === 16) {
            const native = canvas as SkCanvas & { nelyxConcat44?: (matrix: number[]) => void };
            if (typeof native.nelyxConcat44 !== 'function')
              throw new Error('Matching Nelyx native SkM44 canvas binding is required');
            native.nelyxConcat44([...command.matrix]);
          } else {
            const [a, b, c, d, x, y] = command.matrix as readonly [
              number,
              number,
              number,
              number,
              number,
              number,
            ];
            canvas.concat(own(api.Matrix([a, c, x, b, d, y, 0, 0, 1])));
          }
          break;
        }
        // The pinned Skia ClipOp enum is Difference=0, Intersect=1.
        case 'clip':
          canvas.clipRect(
            own(
              api.XYWHRect(command.rect.x, command.rect.y, command.rect.width, command.rect.height),
            ),
            1,
            true,
          );
          break;
        case 'rect':
        case 'rrect': {
          if (batch.nelyxFillRect) {
            batch.nelyxFillRect(
              command.rect,
              command.color,
              command.op === 'rect' ? 0 : 2,
              command.op === 'rect' ? 0 : command.radius,
            );
            break;
          }
          paint.setColor(api.Color(command.color));
          const r = own(
            api.XYWHRect(command.rect.x, command.rect.y, command.rect.width, command.rect.height),
          );
          if (command.op === 'rect') canvas.drawRect(r, paint);
          else canvas.drawRRect(own(api.RRectXY(r, command.radius, command.radius)), paint);
          break;
        }
        case 'image': {
          const image = imageRefs.get(command)!;
          paint.setColor(api.Color(0xff000000));
          canvas.drawImageRect(
            image,
            own(api.XYWHRect(0, 0, image.width(), image.height())),
            own(
              api.XYWHRect(command.rect.x, command.rect.y, command.rect.width, command.rect.height),
            ),
            paint,
          );
          break;
        }
        case 'drawImageRect':
        case 'drawImageNine': {
          const image = imageRefs.get(command)!,
            src = command.op === 'drawImageRect' ? command.src : command.center,
            source = own(api.XYWHRect(src.x, src.y, src.width, src.height)),
            dst = own(
              api.XYWHRect(command.dst.x, command.dst.y, command.dst.width, command.dst.height),
            ),
            quality = command.paint.filterQuality ?? 'none';
          if (command.op === 'drawImageNine')
            canvas.drawImageNine(image, source, dst, quality === 'none' ? 0 : 1, styled);
          else if (quality === 'high')
            canvas.drawImageRectCubic(image, source, dst, 1 / 3, 1 / 3, styled);
          else
            canvas.drawImageRectOptions(
              image,
              source,
              dst,
              quality === 'none' ? 0 : 1,
              quality === 'medium' ? 2 : 0,
              styled,
            );
          break;
        }
        case 'paragraph': {
          const paragraph = paragraphRefs.get(command)!;
          const batch = canvas as Partial<DisplayListCanvas>;
          if (batch.nelyxParagraph) {
            if (!paragraph.nativeParagraph)
              throw new Error('Native display-list paragraph handle unavailable');
            batch.nelyxParagraph(paragraph.nativeParagraph, command.x, command.y);
          } else paragraph.paint(canvas, command.x, command.y);
          break;
        }
        case 'drawRect':
        case 'drawOval': {
          if (nativeFills.has(command)) {
            batch.nelyxFillRect!(
              command.rect,
              command.paint.color,
              command.op === 'drawRect' ? 0 : 1,
            );
            break;
          }
          const r = own(
            api.XYWHRect(command.rect.x, command.rect.y, command.rect.width, command.rect.height),
          );
          if (command.op === 'drawRect') canvas.drawRect(r, styled);
          else canvas.drawOval(r, styled);
          break;
        }
        case 'drawRRect': {
          if ('rrect' in command) canvas.drawRRect(rounded(command.rrect.values), styled);
          else {
            const r = own(
              api.XYWHRect(command.rect.x, command.rect.y, command.rect.width, command.rect.height),
            );
            canvas.drawRRect(own(api.RRectXY(r, command.radius, command.radius)), styled);
          }
          break;
        }
        case 'drawLine':
          canvas.drawLine(command.from.x, command.from.y, command.to.x, command.to.y, styled);
          break;
        case 'saveBackdropFilter':
          canvas.saveLayer(styled, null, backdrops.get(command) ?? null);
          break;
        case 'saveLayer': {
          const r = command.bounds;
          canvas.saveLayer(styled, r ? own(api.XYWHRect(r.x, r.y, r.width, r.height)) : null);
          break;
        }
        case 'clipRect': {
          const r = own(
            api.XYWHRect(command.rect.x, command.rect.y, command.rect.width, command.rect.height),
          );
          canvas.clipRect(r, command.clipOp === 'intersect' ? 1 : 0, command.doAntiAlias);
          break;
        }
        case 'clipRRect': {
          const op = command.clipOp === 'intersect' ? 1 : 0;
          if ('rrect' in command)
            canvas.clipRRect(rounded(command.rrect.values), op, command.doAntiAlias);
          else {
            const r = own(
              api.XYWHRect(command.rect.x, command.rect.y, command.rect.width, command.rect.height),
            );
            canvas.clipRRect(
              own(api.RRectXY(r, command.radius, command.radius)),
              op,
              command.doAntiAlias,
            );
          }
          break;
        }
        case 'drawShadow': {
          if (typeof canvas.nelyxDrawShadow !== 'function')
            throw new Error('Matching Nelyx native shadow canvas binding is required');
          const path = own(createEnginePath(api, command.path));
          canvas.nelyxDrawShadow(
            path,
            command.color,
            command.elevation,
            command.transparentOccluder,
            command.devicePixelRatio,
          );
          break;
        }
        case 'drawPaint':
          canvas.drawPaint(styled);
          break;
        case 'drawPath':
        case 'clipPath': {
          const path = own(createEnginePath(api, command.path));
          if (command.op === 'drawPath') {
            canvas.drawPath(path, styled);
          } else canvas.clipPath(path, command.clipOp === 'intersect' ? 1 : 0, command.doAntiAlias);
          break;
        }
        default:
          throw new Error(
            'Unsupported native paint command: ' + String((command as { op: string }).op),
          );
      }
    }
    (canvas as Partial<DisplayListCanvas>).nelyxFlush?.();
  } catch (error) {
    errors.push(error);
  } finally {
    for (const value of temporary.reverse())
      try {
        const disposable = value as { dispose?: () => void };
        if (typeof disposable?.dispose === 'function') disposable.dispose();
      } catch (error) {
        errors.push(error);
      }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length)
    throw new AggregateError(errors, 'Native paint replay/temporary disposal failed');
}
/** Owns bounded native submissions and returns leases after actual GPU retirement. */
export class GraphiteRenderer implements Renderer {
  readonly capabilities: RendererCapabilities;
  private metrics: ViewMetrics | undefined;
  private closed = false;
  private sequence = 0;
  private failed = false;
  private visible = true;
  private unknown: ResourceLease[] = [];
  private leases = new Map<number, ResourceLease>();
  private events: RendererEvents;
  private nativeIdentity: number | undefined;
  private closePromise: Promise<void> | undefined;
  private readonly runtimePrograms: ReturnType<typeof createRuntimeShaderCache>;
  private readonly ownsRuntimePrograms: boolean;
  get debugRuntimePrograms() {
    return this.runtimePrograms.debugStats;
  }
  constructor(
    private readonly api: SkiaAPI,
    private readonly context: () => SkGraphiteContext,
    private readonly owner: ViewOwner,
    private readonly resources: GraphiteResources,
    private readonly retirement: GraphiteRetirementClock = retirementClock,
  ) {
    this.ownsRuntimePrograms = !resources.runtimePrograms;
    this.runtimePrograms = resources.runtimePrograms ?? createRuntimeShaderCache(api);
    this.events = new RendererEvents(owner);
    {
      const native = context() as NelyxGraphiteContext & Partial<DisplayListTarget>;
      if (this.resources.nativeDisplayLists && typeof native.nelyxReplayDisplayList !== 'function')
        throw new Error('Native display-list1 binding required; rebuild the native supplier');
      if (
        typeof native.nelyxReserve !== 'function' ||
        typeof native.nelyxSubmit !== 'function' ||
        typeof native.nelyxNotifications !== 'function'
      )
        throw new Error('Nelyx native admission and retirement notification patch is required');
      if (native.nelyxCoreVersion() !== 1) throw new Error('Native Skia core ABI mismatch');
      if (typeof native.nelyxWireVersion !== 'function' || native.nelyxWireVersion() !== 11)
        throw new Error(
          'Native Skia frame wire 11 is required; rebuild the matching native supplier',
        );
      native.nelyxConfigure();
      this.nativeIdentity = native.nelyxIdentity();
    }
    this.capabilities = Object.freeze({
      admission: 'bounded',
      completion: 'gpu-retired',
      present: 'unobserved',
      textRanges: true,
      nativeIdentity: true,
      notifications: 'submitted-and-retired',
    });
  }
  observe(listener: (event: RendererNotification) => void): Disposable {
    return this.events.subscribe(listener);
  }
  get hasPendingSubmissions() {
    return this.leases.size > 0;
  }
  canBuildFrame(): boolean {
    // Closed/failed submission still follows submit's existing rejection path.
    // This hint only suppresses work during temporary native backpressure.
    if (this.closed || this.failed) return true;
    this.pollNotifications();
    const stats = (this.context() as NelyxGraphiteContext).nelyxStats();
    if (
      stats.length !== 5 ||
      stats[0] !== this.nativeIdentity ||
      ![0, 1].includes(stats[1]!) ||
      stats.slice(2).some((value) => !Number.isSafeInteger(value) || value < 0)
    )
      throw new Error('Invalid native recording capacity snapshot');
    // The last completed front recording remains owned for redraw even after
    // its JS lease retires. Count that native owner too: leases alone miss a
    // full target while the next recording is queued/being presented.
    return stats[1] === 0 && stats[2]! < 2 && this.leases.size < 2;
  }
  pollNotifications(): number {
    if (this.closed) return 0;
    try {
      return this.readNotifications();
    } catch (error) {
      if (!this.failed) {
        this.failed = true;
        for (const submission of this.leases.keys()) this.events.failed(submission, String(error));
      }
      throw error;
    }
  }
  private readNotifications(): number {
    const values = (this.context() as NelyxGraphiteContext).nelyxNotifications();
    if (values.length > 6 || values.length % 3)
      throw new Error('Invalid native retirement notification batch');
    for (let index = 0; index < values.length; index += 3) {
      const identity = values[index],
        submission = values[index + 1]!,
        result = values[index + 2];
      if (
        identity !== this.nativeIdentity ||
        !Number.isSafeInteger(submission) ||
        submission < 1 ||
        ![0, 1].includes(result!)
      )
        throw new Error('Invalid/foreign native retirement notification');
      const lease = this.leases.get(submission);
      if (!lease) {
        if (this.closed && this.failed) continue;
        throw new Error('Unknown/duplicate native retirement notification');
      }
      this.leases.delete(submission);
      try {
        lease.returnBy('renderer');
      } finally {
        this.events.retired(submission, result === 0 ? 'gpu-retired' : 'discarded');
      }
    }
    return values.length / 3;
  }
  updateMetrics(metrics: ViewMetrics): void {
    this.metrics = metrics;
  }
  setVisible(visible: boolean): void {
    this.visible = visible;
  }
  submit(frame: PaintFrame, lease: ResourceLease): SubmitResult {
    if (this.closed || this.failed) return { status: 'rejected', reason: 'closed' };
    if (!this.visible) return { status: 'rejected', reason: 'busy' };
    if (!this.metrics || !isCurrent(frame, this.owner, this.metrics))
      return { status: 'rejected', reason: 'stale' };
    if (!this.metrics.physicalWidth || !this.metrics.physicalHeight)
      return { status: 'rejected', reason: 'zero-size' };
    {
      this.pollNotifications();
      if (this.leases.size >= 2) return { status: 'rejected', reason: 'busy' };
    }
    const context = this.context();
    let open = false;
    const native = context as NelyxGraphiteContext;
    {
      const reserve = native.nelyxReserveEpoch ?? native.nelyxReserve;
      const result = reserve.call(
        native,
        this.metrics.nativeContextGeneration ?? -1,
        this.metrics.physicalWidth,
        this.metrics.physicalHeight,
        frame.estimatedBytes,
        this.metrics.scale,
        this.metrics.nativeSurfaceGeneration ?? -1,
      );
      if (result !== 0) {
        const reasons = {
          1: 'busy',
          2: 'stale',
          3: 'closed',
          4: 'oversize',
          5: 'zero-size',
        } as const;
        return { status: 'rejected', reason: reasons[result as keyof typeof reasons] ?? 'closed' };
      }
    }
    try {
      const canvas = context.beginRecording();
      open = true;
      const target = context as SkGraphiteContext & Partial<DisplayListTarget>;
      if (this.resources.nativeDisplayLists && typeof target.nelyxReplayDisplayList !== 'function')
        throw new Error('Native display-list1 binding required; rebuild the native supplier');
      if (this.resources.nativeDisplayLists)
        submitNativeScene(
          this.api,
          target as DisplayListTarget,
          frame,
          this.resources,
          this.runtimePrograms,
        );
      else replayFrame(this.api, canvas, frame, this.resources, this.runtimePrograms);
      const recording = context.finishRecording();
      open = false;
      const submission = this.sequence + 1;
      try {
        if (native.nelyxSubmitFrame)
          native.nelyxSubmitFrame(
            recording,
            submission,
            frame.token.owner.generation,
            frame.token.metrics.viewportGeneration,
            frame.token.sequence,
            frame.token.inputSequence ?? 0,
            frame.token.inputTimestamp ?? -1,
            frame.token.timing?.tick ?? -1,
            frame.token.timing?.clockUncertainty ?? 0,
          );
        else native.nelyxSubmit(recording, submission);
      } finally {
        recording.dispose();
      }
      lease.transfer();
      {
        this.leases.set(submission, lease);
        this.events.accepted(submission, frame.token);
      }
      this.sequence = submission;
      return { status: 'accepted', submission };
    } catch (error) {
      // Upstream has no cancelRecording: snap/dispose to close an opened recording, then poison this renderer.
      if (open) {
        try {
          context.finishRecording().dispose();
        } catch {
          /* requires native retirement */
        }
      }
      native.nelyxCancel();
      this.failed = true;
      this.unknown.push(lease);
      return { status: 'unknown', reason: String(error) };
    }
  }
  dispose(): Promise<void> {
    if (this.closePromise) return this.closePromise;
    // Returning a GPU lease can invoke resource retirement callbacks. They
    // must join this drain before it touches native context/event ownership.
    let resolve!: () => void, reject!: (error: unknown) => void;
    const closing = new Promise<void>((done, fail) => {
      resolve = done;
      reject = fail;
    });
    this.closePromise = closing;
    this.closed = true;
    this.events.stop();
    void (async () => {
      {
        (this.context() as NelyxGraphiteContext).nelyxClose();
        const deadline = this.retirement.now() + 5000;
        for (;;) {
          this.readNotifications();
          const values = (this.context() as NelyxGraphiteContext).nelyxStats(),
            stats = {
              recordings: values[2],
              reserved: values[1],
              consuming: values[4],
              queued: values[3],
            };
          if (
            stats.recordings === 0 &&
            stats.reserved === 0 &&
            stats.consuming === 0 &&
            stats.queued === 0
          )
            break;
          if (this.retirement.now() > deadline)
            throw new Error('Native close did not retire owned recordings');
          await this.retirement.delay(16);
        }
        if (this.leases.size)
          throw new Error('Native drain missed accepted submission retirements');
        if (this.ownsRuntimePrograms) this.runtimePrograms.dispose();
        const context = this.context() as NelyxGraphiteContext;
        context.nelyxReset();
        context.dispose();
      }
      for (const lease of this.unknown) if (!lease.released) lease.returnBy('caller');
      this.unknown = [];
      this.events.drain();
    })().then(resolve, reject);
    return closing;
  }
}
