// SPDX-License-Identifier: BSD-3-Clause
// Opt-in, numeric observations of the ordinary lazy Gallery. No scroll driving,
// keep-alive changes, timers, frame requests, or retained rendering resources.
import { ChangeNotifier } from '@nelyx/core/foundation/notifier';
import type { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import type { ScrollController } from '@nelyx/core/framework/widgets/scroll-controller';
import type { SectionExtentIndex } from '@nelyx/core/framework/rendering/section-extent-index';
import { RenderBox } from '@nelyx/core/framework/rendering/object';
import type { ViewMetrics } from '@nelyx/core/ui/types';

export type GalleryColumn = 'primary' | 'secondary';
export interface GalleryRangeColumnBinding {
  ids: readonly string[];
  controller: ScrollController;
  index: SectionExtentIndex;
  viewport: GlobalKey;
}
interface ColumnSample {
  ids: readonly string[];
  measured: string[];
  visible: string[];
  ready: string[];
  min: number;
  max: number;
  offset: number;
  viewport: number;
  width: number;
  x: number;
  y: number;
}
export interface GalleryRangeSample {
  configuration: string;
  columns: Partial<Record<GalleryColumn, ColumnSample>>;
  frame: number;
  qpc: number;
}
interface Leg {
  column: GalleryColumn;
  configuration: string;
  start: number;
  end: number;
  min: number;
  max: number;
  viewport: number;
  previous: number;
  firstMovement: number | null;
  bottom: number | null;
  firstFrame: number | null;
  bottomFrame: number | null;
  frames: number;
  gap: number;
  faults: string[];
  sections: Record<string, { first: number; last: number; frames: number }>;
  sectionBuilds: number;
  imageFrameCallbacks: number;
}

export class GalleryRangeObservation extends ChangeNotifier {
  private readonly columns = new Map<GalleryColumn, GalleryRangeColumnBinding>();
  private readonly loaded = new Map<GalleryColumn, Set<string>>();
  private readonly imageReady = new Set<string>();
  private readonly errors = new Set<string>();
  private keys: ReadonlyMap<string, GlobalKey> = new Map();
  private theme: object | undefined;
  private revision = 0;
  private environment = '';
  private catalog = '';
  private latest: GalleryRangeSample | undefined;
  private leg: Leg | undefined;
  private active = false;
  private serial = 0;
  private sectionBuilds = 0;
  private imageFrameCallbacks = 0;
  private readonly positions = new WeakMap<object, number>();
  private nextPosition = 0;
  label = '{}';

  configure(
    columns: ReadonlyMap<GalleryColumn, GalleryRangeColumnBinding>,
    keys: ReadonlyMap<string, GlobalKey>,
    theme: object,
    includePlanned: boolean,
  ): void {
    const catalog = JSON.stringify([...columns].map(([name, value]) => [name, value.ids]));
    const changedOwner = [...columns].some(
      ([name, column]) => this.columns.get(name)?.index !== column.index,
    );
    if (theme !== this.theme || catalog !== this.catalog || changedOwner) {
      this.theme = theme;
      this.catalog = catalog;
      this.revision++;
      this.loaded.clear();
      if (this.active) this.fault('configuration-changed');
    }
    this.columns.clear();
    for (const [name, column] of columns) this.columns.set(name, column);
    this.keys = keys;
    this.includePlanned = includePlanned;
  }
  private includePlanned = false;
  builtSection(): void {
    this.sectionBuilds++;
  }
  imageFrame(id: string, frame: number | null): void {
    if (frame !== null) {
      this.imageReady.add(id);
      this.imageFrameCallbacks++;
    }
  }
  imageError(id: string): void {
    this.errors.add(id);
  }
  private fault(reason: string): void {
    if (this.leg && !this.leg.faults.includes(reason)) this.leg.faults.push(reason);
  }
  /** Capture after a successful scene build; commit only its submitted token. */
  capture(metrics: ViewMetrics, frame: number, qpc: number, owner = 0): GalleryRangeSample {
    const columns: GalleryRangeSample['columns'] = {};
    const positions: number[] = [];
    for (const [name, column] of this.columns) {
      const box = column.viewport.currentContext?.findRenderObject();
      if (
        !(box instanceof RenderBox) ||
        !box.hasSize ||
        box.needsLayout ||
        !column.controller.hasClients
      )
        continue;
      const position = column.controller.position;
      if (!position.hasContentDimensions) continue;
      let positionId = this.positions.get(position);
      if (positionId === undefined) {
        positionId = ++this.nextPosition;
        this.positions.set(position, positionId);
      }
      positions.push(positionId);
      const origin = box.localToGlobal({ x: 0, y: 0 });
      const visible: string[] = [],
        ready: string[] = [];
      for (const id of column.ids) {
        const section = this.keys.get(id)?.currentContext?.findRenderObject();
        if (
          !(section instanceof RenderBox) ||
          !section.attached ||
          !section.hasSize ||
          section.needsLayout
        )
          continue;
        let painted = true;
        for (let node = section; node.parent; node = node.parent as RenderBox)
          if (!node.parent.paintsChild(node)) {
            painted = false;
            break;
          }
        const point = section.localToGlobal({ x: 0, y: 0 });
        if (
          painted &&
          Math.min(point.y + section.size.height, origin.y + box.size.height) -
            Math.max(point.y, origin.y) >
            0.5
        ) {
          visible.push(id);
          if (id !== 'image' || this.imageReady.has(id)) ready.push(id);
        }
      }
      columns[name] = {
        ids: column.ids,
        visible,
        ready,
        measured: column.ids.filter((_, i) => column.index.measurement(i) === 'measured'),
        min: position.minScrollExtent,
        max: position.maxScrollExtent,
        offset: position.pixels,
        viewport: position.viewportDimension,
        width: box.size.width,
        x: origin.x,
        y: origin.y,
      };
    }
    const environment = JSON.stringify([
      metrics.logicalWidth,
      metrics.logicalHeight,
      metrics.scale,
      metrics.viewportGeneration,
      metrics.rendererGeneration,
      metrics.nativeContextGeneration,
      metrics.nativeSurfaceGeneration,
      metrics.environment?.textScale,
      owner,
      positions,
      ...Object.values(columns).map((column) => [
        column.width,
        column.viewport,
        column.x,
        column.y,
      ]),
    ]);
    if (this.environment !== environment) {
      this.environment = environment;
      this.loaded.clear();
      if (this.active) this.fault('environment-changed');
    }
    return { configuration: `${this.revision}:${environment}`, columns, frame, qpc };
  }
  submitted(sample: GalleryRangeSample): void {
    if (sample.configuration !== `${this.revision}:${this.environment}`) {
      if (this.active) this.fault('stale-submission');
      return;
    }
    this.latest = sample;
    for (const [name, column] of Object.entries(sample.columns)) {
      let loaded = this.loaded.get(name as GalleryColumn);
      if (!loaded) this.loaded.set(name as GalleryColumn, (loaded = new Set()));
      for (const id of column.ready) loaded.add(id);
    }
    const leg = this.leg;
    if (!leg || !this.active) return;
    const column = sample.columns[leg.column];
    if (!column || sample.configuration !== leg.configuration) {
      this.fault('configuration-changed');
      return;
    }
    if (Math.abs(column.max - leg.max) > 0.5 || Math.abs(column.min - leg.min) > 0.5)
      this.fault('extent-changed');
    if (column.measured.length !== column.ids.length) this.fault('unmeasured-section');
    const delta = column.offset - leg.previous;
    if (delta < -0.5) this.fault('reversed-offset');
    leg.gap = Math.max(leg.gap, delta);
    if (delta > column.viewport + 0.5) this.fault('skipped-viewport');
    if (column.offset > leg.start + 0.5 && leg.firstMovement === null) {
      leg.firstMovement = sample.qpc;
      leg.firstFrame = sample.frame;
    }
    if (
      Math.abs(column.offset - column.max) <= 0.5 &&
      column.visible.includes(column.ids.at(-1)!)
    ) {
      if (leg.bottom === null) {
        leg.bottom = sample.qpc;
        leg.bottomFrame = sample.frame;
      }
    }
    leg.previous = leg.end = column.offset;
    leg.frames++;
    for (const id of column.visible) {
      const section = (leg.sections[id] ??= { first: sample.qpc, last: sample.qpc, frames: 0 });
      section.last = sample.qpc;
      section.frames++;
    }
  }
  command(command: 'snapshot' | GalleryColumn | 'finish'): void {
    if (command === 'primary' || command === 'secondary') {
      const column = this.latest?.columns[command];
      if (!column || !this.latest) throw Error('Gallery range owner unavailable');
      this.leg = {
        column: command,
        configuration: this.latest.configuration,
        start: column.offset,
        end: column.offset,
        previous: column.offset,
        min: column.min,
        max: column.max,
        viewport: column.viewport,
        firstMovement: null,
        bottom: null,
        firstFrame: null,
        bottomFrame: null,
        frames: 0,
        gap: 0,
        faults: [],
        sections: {},
        sectionBuilds: this.sectionBuilds,
        imageFrameCallbacks: this.imageFrameCallbacks,
      };
      this.active = true;
      if (Math.abs(column.offset - column.min) > 0.5) this.fault('not-at-top');
    } else if (command === 'finish') {
      this.active = false;
      if (this.leg) {
        this.leg.sectionBuilds = this.sectionBuilds - this.leg.sectionBuilds;
        this.leg.imageFrameCallbacks = this.imageFrameCallbacks - this.leg.imageFrameCallbacks;
      }
    }
    this.label = JSON.stringify(this.snapshot(++this.serial));
    this.notifyListeners();
  }
  snapshot(serial = this.serial): object {
    return {
      schema: 1,
      serial,
      configuration: this.latest?.configuration,
      includePlanned: this.includePlanned,
      resourceErrors: [...this.errors],
      columns: Object.fromEntries(
        Object.entries(this.latest?.columns ?? {}).map(([name, column]) => [
          name,
          { ...column, loaded: [...(this.loaded.get(name as GalleryColumn) ?? [])] },
        ]),
      ),
      leg: this.leg
        ? { ...this.leg, sections: { ...this.leg.sections }, faults: [...this.leg.faults] }
        : null,
      scope: 'submitted frame geometry and finite image readiness; surface/scanout are separate',
    };
  }
}
