// SPDX-License-Identifier: BSD-3-Clause
import type { Key } from '@nelyx/core/foundation/key';
import { StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import { AutomaticKeepAliveClientMixin } from '@nelyx/core/framework/widgets/automatic-keep-alive';
import { SectionExtentIndex } from '@nelyx/core/framework/rendering/section-extent-index';
import { ChangeNotifier } from '@nelyx/core/foundation/notifier';

/** A control changes its section; navigation and theme changes rebuild the page. */
export class GalleryUpdates {
  readonly page = new ChangeNotifier();
  readonly status = new ChangeNotifier();
  private readonly sections = new Map<string, ChangeNotifier>();
  section(id: string): ChangeNotifier {
    let signal = this.sections.get(id);
    if (!signal) {
      signal = new ChangeNotifier();
      this.sections.set(id, signal);
    }
    return signal;
  }
  change(id: string, update: () => void, related: readonly string[] = []): void {
    update();
    this.sections.get(id)?.notifyListeners();
    for (const other of related) this.sections.get(other)?.notifyListeners();
  }
  dispose(): void {
    this.page.dispose();
    this.status.dispose();
    for (const signal of this.sections.values()) signal.dispose();
    this.sections.clear();
  }
}

/** Catalog membership changes preserve a surviving visible section by ID.
 * Explicit category/filter navigation resets this owner to the top. */
export class GallerySectionExtents {
  private ids: readonly string[] = [];
  private current: SectionExtentIndex | null = null;
  reset(): void {
    this.ids = [];
    this.current = null;
  }
  forItems(ids: readonly string[]): SectionExtentIndex {
    if (this.current && ids.length === this.ids.length && ids.every((id, i) => id === this.ids[i]))
      return this.current;
    const old = this.current?.anchor,
      anchorId = old ? this.ids[old.index] : undefined,
      next = new SectionExtentIndex(ids.length);
    const target = anchorId === undefined ? -1 : ids.indexOf(anchorId);
    if (target >= 0) next.requestItem(target, { offset: old!.offset });
    this.ids = [...ids];
    this.current = next;
    return next;
  }
}

/** Only editor sections retain their mounted Form/focus while outside the viewport. */
export class GallerySection extends StatefulWidget {
  constructor(
    readonly child: Widget,
    readonly retainEditor: boolean,
    key: Key,
  ) {
    super(key);
  }
  createState(): GallerySectionState {
    return new GallerySectionState();
  }
}
class GallerySectionState extends AutomaticKeepAliveClientMixin<GallerySection> {
  protected get wantKeepAlive(): boolean {
    return this.widget.retainEditor;
  }
  override didUpdateWidget(old: GallerySection): void {
    super.didUpdateWidget(old);
    this.updateKeepAlive();
  }
  override build(context: BuildContext): Widget {
    super.build(context);
    return this.widget.child;
  }
}
