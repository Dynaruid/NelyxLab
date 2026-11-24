import { StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import { AutomaticKeepAliveClientMixin } from '@nelyx/core/framework/widgets/automatic-keep-alive';
import { SectionExtentIndex } from '@nelyx/core/framework/rendering/section-extent-index';
import { ChangeNotifier } from '@nelyx/core/foundation/notifier';
/** A control changes its section; navigation and theme changes rebuild the page. */
export class GalleryUpdates {
    page = new ChangeNotifier();
    status = new ChangeNotifier();
    sections = new Map();
    section(id) {
        let signal = this.sections.get(id);
        if (!signal) {
            signal = new ChangeNotifier();
            this.sections.set(id, signal);
        }
        return signal;
    }
    change(id, update, related = []) {
        update();
        this.sections.get(id)?.notifyListeners();
        for (const other of related)
            this.sections.get(other)?.notifyListeners();
    }
    dispose() {
        this.page.dispose();
        this.status.dispose();
        for (const signal of this.sections.values())
            signal.dispose();
        this.sections.clear();
    }
}
/** Catalog membership changes preserve a surviving visible section by ID.
 * Explicit category/filter navigation resets this owner to the top. */
export class GallerySectionExtents {
    ids = [];
    current = null;
    reset() {
        this.ids = [];
        this.current = null;
    }
    forItems(ids) {
        if (this.current && ids.length === this.ids.length && ids.every((id, i) => id === this.ids[i]))
            return this.current;
        const old = this.current?.anchor, anchorId = old ? this.ids[old.index] : undefined, next = new SectionExtentIndex(ids.length);
        const target = anchorId === undefined ? -1 : ids.indexOf(anchorId);
        if (target >= 0)
            next.requestItem(target, { offset: old.offset });
        this.ids = [...ids];
        this.current = next;
        return next;
    }
}
/** Only editor sections retain their mounted Form/focus while outside the viewport. */
export class GallerySection extends StatefulWidget {
    child;
    retainEditor;
    constructor(child, retainEditor, key) {
        super(key);
        this.child = child;
        this.retainEditor = retainEditor;
    }
    createState() {
        return new GallerySectionState();
    }
}
class GallerySectionState extends AutomaticKeepAliveClientMixin {
    get wantKeepAlive() {
        return this.widget.retainEditor;
    }
    didUpdateWidget(old) {
        super.didUpdateWidget(old);
        this.updateKeepAlive();
    }
    build(context) {
        super.build(context);
        return this.widget.child;
    }
}
