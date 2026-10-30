import type { AssetRef } from '../foundation/assets.ts';
import type { PaintSnapshot } from './paint.ts';
import type { Offset } from './geometry.ts';
import type { PathSnapshot } from './path.ts';
import type { RRectSnapshot } from './rrect-data.ts';
import type { ParagraphOptions } from './text-styles.ts';
import type { StringAttribute } from './string-attribute.ts';
import type { SemanticsRole } from './semantics.ts';
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
export interface ClipOptions {
  readonly clipOp?: 'intersect' | 'difference';
  readonly doAntiAlias?: boolean;
}
export interface ViewOwner {
  readonly id: string;
  readonly generation: number;
}
export interface ViewEnvironment {
  readonly safeArea: {
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
    readonly left: number;
  };
  readonly safeAreaSource: 'native' | 'css' | 'application';
  readonly keyboardInset: number;
  readonly keyboardSource: 'native-ime' | 'visual-viewport-occlusion' | 'unavailable';
  readonly textScale: number;
  readonly textScaleSource?: 'native' | 'application';
  readonly gestureSettings?: {
    readonly physicalTouchSlop: number | null;
    readonly physicalDoubleTapSlop?: number | null;
  };
  readonly gestureSettingsSource?: 'native' | 'application' | 'unavailable';
}
export interface ViewMetrics {
  readonly logicalWidth: number;
  readonly logicalHeight: number;
  readonly physicalWidth: number;
  readonly physicalHeight: number;
  readonly scale: number;
  readonly viewportGeneration: number;
  readonly rendererGeneration: number;
  readonly nativeContextGeneration: number | null;
  readonly nativeSurfaceGeneration: number | null;
  readonly environment?: ViewEnvironment;
}
export interface FrameBuildToken {
  readonly owner: ViewOwner;
  readonly metrics: ViewMetrics;
  readonly sequence: number;
  readonly inputSequence?: number;
  readonly inputTimestamp?: number;
  readonly timing?: import('../foundation/clock.ts').FrameTiming;
}
export interface ResourceId {
  readonly id: string;
  readonly generation: number;
}
export interface ResourceDescriptor extends ResourceId {
  readonly kind: 'image' | 'paragraph' | 'font' | 'picture';
  readonly asset?: AssetRef;
}
export type PaintCommand =
  | { readonly op: 'drawPicture'; readonly resource: ResourceId }
  | { readonly op: 'clear'; readonly color: number }
  | { readonly op: 'save' | 'restore' }
  | { readonly op: 'transform'; readonly matrix: readonly number[] }
  | { readonly op: 'clip'; readonly rect: Rect }
  | { readonly op: 'rect'; readonly rect: Rect; readonly color: number }
  | { readonly op: 'rrect'; readonly rect: Rect; readonly radius: number; readonly color: number }
  | { readonly op: 'image'; readonly resource: ResourceId; readonly rect: Rect }
  | {
      readonly op: 'drawImageRect';
      readonly resource: ResourceId;
      readonly src: Rect;
      readonly dst: Rect;
      readonly paint: PaintSnapshot;
    }
  | {
      readonly op: 'drawImageNine';
      readonly resource: ResourceId;
      readonly center: Rect;
      readonly dst: Rect;
      readonly paint: PaintSnapshot;
    }
  | {
      readonly op: 'paragraph';
      readonly resource: ResourceId;
      readonly x: number;
      readonly y: number;
    }
  | { readonly op: 'drawRect'; readonly rect: Rect; readonly paint: PaintSnapshot }
  | { readonly op: 'drawPaint'; readonly paint: PaintSnapshot }
  | { readonly op: 'drawOval'; readonly rect: Rect; readonly paint: PaintSnapshot }
  | {
      readonly op: 'drawRRect';
      readonly rect: Rect;
      readonly radius: number;
      readonly paint: PaintSnapshot;
    }
  | { readonly op: 'drawRRect'; readonly rrect: RRectSnapshot; readonly paint: PaintSnapshot }
  | {
      readonly op: 'drawLine';
      readonly from: Offset;
      readonly to: Offset;
      readonly paint: PaintSnapshot;
    }
  | { readonly op: 'saveLayer'; readonly bounds: Rect | null; readonly paint: PaintSnapshot }
  // imageFilter describes the backdrop; other paint fields composite the layer.
  | { readonly op: 'saveBackdropFilter'; readonly paint: PaintSnapshot }
  | {
      readonly op: 'clipRect';
      readonly rect: Rect;
      readonly clipOp: 'intersect' | 'difference';
      readonly doAntiAlias: boolean;
    }
  | {
      readonly op: 'clipRRect';
      readonly rect: Rect;
      readonly radius: number;
      readonly clipOp: 'intersect' | 'difference';
      readonly doAntiAlias: boolean;
    }
  | {
      readonly op: 'clipRRect';
      readonly rrect: RRectSnapshot;
      readonly clipOp: 'intersect' | 'difference';
      readonly doAntiAlias: boolean;
    }
  | { readonly op: 'drawPath'; readonly path: PathSnapshot; readonly paint: PaintSnapshot }
  | {
      readonly op: 'drawShadow';
      readonly path: PathSnapshot;
      readonly color: number;
      readonly elevation: number;
      readonly transparentOccluder: boolean;
      readonly devicePixelRatio: number;
    }
  | {
      readonly op: 'clipPath';
      readonly path: PathSnapshot;
      readonly clipOp: 'intersect' | 'difference';
      readonly doAntiAlias: boolean;
    };
export interface PaintFrame {
  readonly token: FrameBuildToken;
  readonly commands: readonly PaintCommand[];
  readonly resources: readonly ResourceId[];
  readonly estimatedBytes: number;
}
export interface RendererCapabilities {
  readonly admission: 'bounded' | 'rate-limited-only';
  readonly completion: 'gpu-retired' | 'native-retained' | 'unobserved';
  readonly present: 'native-observed' | 'unobserved';
  readonly textRanges: boolean;
  readonly nativeIdentity: boolean;
  readonly notifications: 'submitted-and-retired' | 'submitted-only' | 'unavailable';
}
export type RendererNotification =
  | { readonly kind: 'submitted'; readonly submission: number; readonly token: FrameBuildToken }
  | {
      readonly kind: 'retired';
      readonly submission: number;
      readonly token: FrameBuildToken;
      readonly result: 'gpu-retired' | 'discarded' | 'drained';
    }
  | {
      readonly kind: 'failed';
      readonly submission: number;
      readonly token: FrameBuildToken;
      readonly reason: string;
    };
export type SubmitResult =
  | { readonly status: 'accepted'; readonly submission: number }
  | {
      readonly status: 'rejected';
      readonly reason: 'busy' | 'stale' | 'closed' | 'oversize' | 'zero-size';
    }
  | { readonly status: 'unknown'; readonly reason: string };
export interface TextLayoutInput extends ParagraphOptions {
  readonly text: string;
  readonly width: number;
  readonly font: ResourceId;
  readonly fontSize: number;
  readonly locale: string;
  readonly direction: 'ltr' | 'rtl';
  readonly scale: number;
  readonly textScale?: number;
  readonly color?: number;
  readonly maxLines?: number;
  readonly unlimitedLines?: boolean;
  readonly ellipsis?: string;
  readonly hyphens?: 'manual' | 'hidden';
}
export interface TextLine {
  readonly start: number;
  readonly end: number;
  readonly baseline: number;
  readonly bounds: Rect;
  readonly height?: number;
  readonly metrics?: import('./line-metrics.ts').LineMetricsOptions;
}
export interface TextLayoutGeometry {
  readonly width: number;
  readonly height: number;
  readonly alphabeticBaseline: number;
  readonly ideographicBaseline: number;
  readonly minIntrinsicWidth: number;
  readonly maxIntrinsicWidth: number;
  readonly longestLine: number;
  readonly overflow: boolean;
  readonly unresolvedGlyphs: number;
  readonly lines: readonly TextLine[];
  readonly placeholderBoxes?: readonly Rect[];
  readonly placeholderDirections?: readonly ('ltr' | 'rtl')[];
}
export interface TextLayout extends TextLayoutGeometry {
  readonly resource: ResourceId;
  readonly input: TextLayoutInput;
  readonly indexUnit: 'utf16';
}
export interface TextRangeBounds {
  readonly start: number;
  readonly end: number;
}
export interface TextClusterInfo extends TextRangeBounds {
  readonly bounds: Rect;
  readonly direction: 'ltr' | 'rtl';
}
export interface TextGlyphInfo extends TextClusterInfo {
  readonly isEllipsis: boolean;
}
export interface TextLayoutRequest {
  readonly replacing?: TextLayout;
  readonly transient?: boolean;
}
export interface TextBoxQuery {
  readonly heightStyle?: import('./text-box.ts').BoxHeightStyle;
  readonly widthStyle?: import('./text-box.ts').BoxWidthStyle;
}
export interface TextBoxGeometry {
  readonly rect: Rect;
  readonly direction: 'ltr' | 'rtl';
}
export interface TextLayoutService {
  nativeQueryReference?(layout: TextLayout): TextLayoutQueryReference;
  fontFamily?(resource: ResourceId): string;
  layout(input: TextLayoutInput, request?: TextLayoutRequest): TextLayout;
  range(layout: TextLayout, start: number, end: number): readonly Rect[];
  boxes?(
    layout: TextLayout,
    start: number,
    end: number,
    options?: TextBoxQuery,
  ): readonly TextBoxGeometry[];
  hit(layout: TextLayout, x: number, y: number): TextHit;
  closestGlyph?(layout: TextLayout, x: number, y: number): TextClusterInfo | null;
  glyphAt?(layout: TextLayout, offset: number): TextGlyphInfo | null;
  wordBoundary?(layout: TextLayout, offset: number): TextRangeBounds;
  lineNumberAt?(layout: TextLayout, offset: number): number | null;
}
export interface TextHit {
  readonly position: number;
  readonly affinity: 'upstream' | 'downstream';
  readonly start?: number;
  readonly end?: number;
  readonly bounds?: Rect;
  readonly direction?: 'ltr' | 'rtl';
}
export interface TextGlyphRun {
  readonly line: number;
  readonly glyphs: readonly number[];
  readonly utf8Starts: readonly number[];
  readonly utf16Starts: readonly number[];
  readonly inkBounds: readonly Rect[];
  readonly fontFamily: string;
  readonly typefaceId: number;
  readonly fontSource: 'bundled' | 'system-fallback' | 'unknown';
}
export interface TextSelection {
  readonly anchor: number;
  readonly focus: number;
}
export type Composition =
  | { readonly status: 'none' }
  | { readonly status: 'unavailable' }
  | { readonly status: 'active'; readonly start: number; readonly end: number };
export interface TextEditingValue {
  readonly text: string;
  readonly selection: TextSelection;
  readonly composing: Composition;
  readonly revision: number;
  readonly session: ViewOwner;
  readonly source: 'native' | 'programmatic';
}
export type EditingGeometry =
  | { readonly status: 'unavailable' }
  | {
      readonly status: 'observed';
      readonly coordinates: 'control-local';
      readonly nativeRevision: number;
      readonly width: number;
      readonly height: number;
      readonly caret: Rect;
      readonly selectionRects: readonly Rect[];
    };
/** Core paragraph geometry before the View transform. Native text layout never produces this value. */
export interface CoreEditingGeometry {
  readonly coordinates: 'editable-local';
  readonly epoch: number;
  readonly width: number;
  readonly height: number;
  readonly caret: Rect;
  readonly caretBaseline: Offset;
  readonly selectionRects: readonly Rect[];
}
/** Core -> OS input/semantics coordinates. Adapters convert logical View pixels to their screen space. */
export interface TextInputGeometryStamp {
  readonly owner: ViewOwner;
  readonly viewportGeneration: number;
  /** Committed layout/transform/clip epoch, independent of paragraph resource identity. */
  readonly layoutEpoch: number;
}
export interface TextInputGeometry extends TextInputGeometryStamp {
  /** Native backing generation sampled by the same Core frame, when present. */
  readonly nativeSurfaceGeneration?: number;
  readonly coordinates: 'view-logical';
  readonly scale: number;
  readonly transform: readonly number[];
  readonly bounds: Rect;
  readonly clip: Rect;
  readonly caret: Rect;
  readonly caretBaseline: Offset;
  readonly selectionRects: readonly Rect[];
}
export interface TextInputCharacterBounds extends TextInputGeometryStamp {
  readonly coordinates: 'view-logical';
  readonly rangeStart: number;
  readonly rects: readonly Rect[];
}
/** An empty range uses the actual paragraph caret at that UTF-16 position. */
export interface TextInputRangeBounds extends TextInputGeometryStamp {
  readonly coordinates: 'view-logical';
  readonly rangeStart: number;
  readonly rangeEnd: number;
  readonly rect: Rect;
}
export interface TextInputHitOptions {
  /** Permit the closest position outside a visible character box. */
  readonly nearest?: boolean;
  /** Inside a character, return its nearest caret edge rather than its start. */
  readonly roundNearest?: boolean;
}
/** Null query results mean unavailable; a current miss remains distinguishable. */
export type TextInputHitTest = TextInputGeometryStamp & { readonly coordinates: 'view-logical' } & (
    | {
        readonly status: 'hit';
        readonly position: number;
        readonly affinity: 'upstream' | 'downstream';
      }
    | { readonly status: 'miss' }
  );
export type SemanticsAction =
  | 'activate'
  | 'focus'
  | 'scroll-forward'
  | 'scroll-backward'
  | 'increase'
  | 'decrease'
  | 'long-press'
  | 'scroll-left'
  | 'scroll-right'
  | 'scroll-up'
  | 'scroll-down';
export interface SemanticsTextRange {
  readonly start: number;
  readonly end: number;
  readonly alignToTop: boolean;
}
export type SemanticsTextAction =
  | { readonly kind: 'set-text'; readonly text: string }
  | { readonly kind: 'set-selection'; readonly anchor: number; readonly focus: number }
  | ({ readonly kind: 'scroll-range' } & SemanticsTextRange);
/** An absolute value request, separate from source increase/decrease steps. */
export interface SemanticsRangeAction {
  readonly kind: 'set-range-value';
  readonly value: number;
}
export interface SemanticsTextActions {
  readonly setText?: (text: string) => void;
  readonly setSelection?: (selection: TextSelection) => void;
  /** Reveal a UTF-16 range without changing the editing value or focus. */
  readonly scrollRange?: (start: number, end: number, alignToTop: boolean) => void;
}
/** UTF-16 navigation units from the same Core paragraph as the painted editor. */
export interface SemanticsTextNavigation {
  readonly characters: readonly number[];
  readonly words?: readonly number[];
  readonly lines?: readonly number[];
}
/** A backend-owned read ticket for this exact immutable paragraph resource. */
export interface TextLayoutQueryReference {
  readonly protocol: 'native-paragraph-v1';
  readonly token: number;
}
export interface SemanticsTextParagraph {
  readonly resource: ResourceId;
  readonly reference: TextLayoutQueryReference;
  /** Paragraph origin inside the editable, including alignment and scroll. */
  readonly paintOffset: Offset;
}
export interface SemanticsNode {
  /** Typed accessibility edits use the same Core delegate as other user edits. */
  readonly textActions?: SemanticsTextActions;
  /** Actual Core content changes, independent of selection and transport acks. */
  readonly textRevision?: number;
  readonly textInputRevision?: number;
  /** Retires accessibility ranges/actions when the logical editing owner changes. */
  readonly textInputGeneration?: number;
  readonly textNavigation?: SemanticsTextNavigation;
  readonly textParagraph?: SemanticsTextParagraph;
  readonly textSelection?: { readonly anchor: number; readonly focus: number };
  readonly readOnly?: boolean;
  readonly obscured?: boolean;
  readonly multiline?: boolean;
  readonly textInputGeometry?: TextInputGeometry;
  /** Resolved style updates preserve the native editor, text revision and IME session. */
  readonly editorStyle?: import('../hosting/editor-style.ts').EditorStyle;
  /** Host editor layout before clipping; bounds remains the visible semantics/hit region.
   * Positive axis scales keep native text, caret and control decoration together. */
  readonly editorGeometry?: {
    readonly bounds: Rect;
    readonly scaleX: number;
    readonly scaleY: number;
  };
  /** Source semantics identity, separate from the embedding's stable string id. */
  readonly sourceNodeId?: number;
  /** Source roles/ranges survive the embedding's coarser legacy role vocabulary. */
  readonly sourceRole?: SemanticsRole;
  readonly minValue?: string;
  readonly maxValue?: string;
  /** Original slider flag and explicit embedding range, independent of formatted source value text. */
  readonly textDirection?: 'ltr' | 'rtl';
  readonly isSlider?: boolean;
  readonly numericRange?: {
    readonly min: number;
    readonly max: number;
    readonly value: number;
    readonly smallChange?: number;
    readonly largeChange?: number;
  };
  readonly rangeActions?: { readonly setValue: (value: number) => void };
  /** Framework-owned opaque tags; native bridges do not serialize them. */
  readonly tags?: readonly object[];
  readonly nameAttributes?: readonly StringAttribute[];
  readonly semanticsIdentifier?: string;
  readonly isLink?: boolean;
  /** Source tooltip metadata, separate from the accessible control label. */
  readonly tooltip?: string;
  readonly id: string;
  readonly role: 'button' | 'text-field' | 'text' | 'image' | 'group' | 'list';
  readonly name: string;
  readonly enabled: boolean;
  readonly bounds: Rect;
  readonly activate?: () => void;
  readonly value?: string;
  readonly selected?: boolean;
  readonly checked?: boolean;
  readonly focused?: boolean;
  readonly focusable?: boolean;
  readonly scrollPosition?: number;
  readonly indexInParent?: number;
  readonly actions?: Readonly<Partial<Record<SemanticsAction, () => void>>>;
  readonly children?: readonly SemanticsNode[];
}
