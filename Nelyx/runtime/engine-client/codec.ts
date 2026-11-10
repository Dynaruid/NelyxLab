// SPDX-License-Identifier: BSD-3-Clause
import { protocol as p } from './schema.ts';
import { semanticBody, readSemanticBody } from './semantics.ts';
import { keyIdentityText, keyIdentityLocation, readKeyIdentity } from './keyboard.ts';
import type { KeyIdentity } from './keyboard.ts';
export type { KeyIdentity } from './keyboard.ts';
import type { SemanticProperties, SemanticSnapshot } from './semantics.ts';
export type { SemanticProperties, SemanticSnapshot, SemanticCustomAction } from './semantics.ts';
import { layoutProgramBytes } from './layout-program.ts';
import type { NativeLayoutProgram } from '@nelyx/core/framework/rendering/object';
import { encodeUtf8, decodeUtf8 } from './utf8.ts';
import { readObservationRow } from './observation-row.ts';
import type { ObservationDecodeCache } from './observation-cache.ts';
import type { ObservationStream, ObservationDelta } from './observation-stream.ts';
import { paragraphOptionsBytes, readParagraphOptions } from './paragraph.ts';
import { clipStyleBytes, readClipStyle } from './clip.ts';
import { nativePaintBody, readNativePaint } from './native-paint.ts';
import { paintPlacementBytes, readPaintPlacement } from './paint-placement.ts';
import type { PaintPlacementOptions } from './paint-placement.ts';
import { readFontBinding } from './font-resource.ts';
import type { FontResourceBinding } from './font-resource.ts';
import { readFontTransition } from './font-transition.ts';
import { imageStyleBytes, readImagePaint } from './image-style.ts';
import type { ImageStyleOptions, ImagePaintSnapshot } from './image-style.ts';
import type { FontTransitionState } from './font-transition.ts';
import { snapshotStyleBytes, readSnapshotStyle, readSnapshotDecision } from './snapshot.ts';
import type { NativeSnapshotConfiguration, SnapshotDecision } from './snapshot.ts';
import { layoutBuilderBytes, readLayoutBuilder, readLayoutBuildRequest } from './layout-builder.ts';
import type { LayoutBuilderOptions, LayoutBuildRequest } from './layout-builder.ts';
export type { LayoutBuilderOptions, LayoutBuildRequest } from './layout-builder.ts';
export type { PaintPlacementOptions } from './paint-placement.ts';
import type { NativePaintOptions, NativePaintSnapshot } from './native-paint.ts';
import type { ClipStyleOptions, ClipStyleSnapshot } from './clip.ts';
export type { ClipStyleOptions, ClipStyleSnapshot, ClipRadii } from './clip.ts';
import type { ParagraphOptions, ParagraphSnapshot } from './paragraph.ts';
export type { ParagraphOptions, ParagraphSnapshot } from './paragraph.ts';
export { protocol } from './schema.ts';

export interface NodeHandle {
  readonly slot: number;
  readonly generation: number;
}
export interface PacketOwner {
  readonly session: number;
  readonly app: number;
  readonly view: number;
  readonly generation: number;
}
export type AxisBound =
  | { readonly kind: 'finite'; readonly min: number; readonly max: number }
  | { readonly kind: 'unbounded'; readonly min?: number }
  | { readonly kind: 'expand' };
export interface NodeProperties {
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
  readonly opacity?: number;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly extent?: keyof typeof p.extents;
  readonly horizontal?: boolean;
  readonly chaining?: boolean;
  /** Native PageScrollPhysics with viewportFraction=1 and the default spring. */
  readonly pageSnapping?: boolean;
  /** Applied by Core only when this viewport generation is first activated. */
  readonly initialScrollOffset?: number;
}
export type AffineMatrix = readonly [number, number, number, number, number, number];
export type NativeTapRegionOptions =
  | { readonly kind: 'surface' }
  | {
      readonly kind: 'region';
      readonly surface: NodeHandle;
      readonly revision: bigint;
      readonly group?: number;
      readonly enabled?: boolean;
      readonly consumeOutside?: boolean;
      readonly downInside?: boolean;
      readonly downOutside?: boolean;
      readonly upInside?: boolean;
      readonly upOutside?: boolean;
    };
export type PathSegment =
  | readonly ['move' | 'line', number, number]
  | readonly ['quad', number, number, number, number]
  | readonly ['cubic', number, number, number, number, number, number]
  | readonly ['close'];
export interface GraphicsOptions {
  readonly transform?: AffineMatrix;
  /** Transform pivot resolved by Content from the final layout size. */
  readonly origin?: { readonly x: number; readonly y: number };
  readonly alignment?: { readonly x: number; readonly y: number };
  readonly path?: readonly PathSegment[];
  readonly fillRule?: 'winding' | 'evenOdd';
  readonly shadow?: {
    readonly x: number;
    readonly y: number;
    readonly sigma: number;
    readonly color: number;
  };
  readonly stroke?: { readonly width: number; readonly color: number };
  readonly blur?: number;
}
export interface GraphicsSnapshot extends GraphicsOptions {
  readonly hasPath: boolean;
}
export interface NodeLayout {
  /** Lay out the retained child while reporting the incoming minimum size. */
  readonly offstage?: boolean;
  readonly enabled?: boolean;
  /** Proxy/padding nodes preserve deflated incoming minima; stack expand also tightens maxima. */
  readonly childConstraints?: keyof typeof p.layoutChildConstraints;
  /** Clamp additional bounds into incoming constraints, as canonical ConstrainedBox does. */
  readonly enforceBounds?: boolean;
  readonly reverseMain?: boolean;
  readonly reverseCross?: boolean;
  readonly alignment?: { readonly x: number; readonly y: number };
  /** Align/Center sizing: fill finite axes unless a child-size factor is supplied. */
  readonly alignmentSizing?: boolean;
  readonly widthFactor?: number;
  readonly heightFactor?: number;
  readonly shrinkUnboundedMain?: boolean;
  readonly expandEmpty?: boolean;
  readonly clipOverflow?: boolean;
  readonly overflowClipBehavior?: keyof typeof p.clipBehaviors;
  readonly canonicalStack?: boolean;
  readonly textBaseline?: 'alphabetic' | 'ideographic';
  readonly positioned?: {
    readonly left?: number;
    readonly top?: number;
    readonly right?: number;
    readonly bottom?: number;
    readonly width?: number;
    readonly height?: number;
  };
  readonly paragraphSizing?: boolean;
  /** A paragraph recording does not affect its parent's layout or hit geometry. */
  readonly paintChild?: boolean;
  readonly preferredSize?: boolean;
  readonly expandPreferredWidth?: boolean;
  /** Canonical inline wrapper: scale the child's coordinates and layout size. */
  readonly inlineScale?: number;
  /** Center one child without propagating the minimum touch target to its layout. */
  readonly inputPadding?: boolean;
  readonly direction?: 'horizontal' | 'vertical';
  readonly mainSize?: 'min' | 'max';
  readonly mainAlign?: keyof typeof p.layoutMainAlign;
  readonly crossAlign?: keyof typeof p.layoutCrossAlign;
  readonly flex?: number;
  readonly fit?: 'tight' | 'loose';
  readonly gap?: number;
  readonly runGap?: number;
  readonly runAlign?: keyof typeof p.layoutMainAlign;
  readonly columns?: number;
  readonly padding?: {
    readonly left?: number;
    readonly top?: number;
    readonly right?: number;
    readonly bottom?: number;
  };
}
export interface ListOptions {
  readonly fixed?: boolean;
  readonly sequential?: boolean;
  readonly generation: bigint;
  readonly count: number;
  readonly begin: number;
  readonly end: number;
  readonly estimate: number;
}
export interface EditorViewportOptions {
  readonly minLines: number;
  /** Zero preserves the Source unbounded maximum. */
  readonly maxLines: number;
  readonly expands?: boolean;
}
export interface ListSnapshot extends ListOptions {
  readonly demandBegin: number;
  readonly demandEnd: number;
  readonly total: number;
  readonly preparedBegin: number;
  readonly preparedEnd: number;
  readonly items: readonly {
    readonly node: NodeHandle;
    readonly index: number;
    readonly key: bigint;
    readonly offset: number;
    readonly extent: number;
  }[];
}
export interface ControlOptions {
  readonly appearance?: 'filled' | 'outlined' | 'text' | 'elevated' | 'chip';
  readonly kind: keyof typeof p.controlKinds;
  readonly disabled?: boolean;
  readonly foreground?: number;
  readonly track?: number;
  readonly revision?: bigint;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly step?: number;
  readonly value?: number;
  readonly second?: number;
}
export interface ControlSnapshot {
  readonly appearance: number;
  readonly kind: number;
  readonly disabled: boolean;
  readonly pressed: boolean;
  readonly hovered: boolean;
  readonly foreground: number;
  readonly track: number;
  readonly revision: bigint;
  readonly minimum: number;
  readonly maximum: number;
  readonly step: number;
  readonly value: number;
  readonly second: number;
}
export interface GestureEvent {
  readonly kind: keyof typeof p.gestureKinds;
  readonly sequence: bigint;
  readonly x: number;
  readonly y: number;
  readonly value: number;
  readonly details?: GestureDetails;
}
export interface GestureDetails {
  readonly pointerKind: NonNullable<InputPacket['kind']>;
  readonly stream: number;
  /** Engine monotonic seconds, after host clock conversion. */
  readonly timestamp: number;
  readonly localX: number;
  readonly localY: number;
  readonly deltaX: number;
  readonly deltaY: number;
  readonly velocityX: number;
  readonly velocityY: number;
  readonly originX: number;
  readonly originY: number;
  readonly localOriginX: number;
  readonly localOriginY: number;
  readonly buttons: number;
  readonly flags: number;
}
export function eventValue(detail: bigint): number {
  const v = new DataView(new ArrayBuffer(8));
  v.setBigUint64(0, detail, true);
  return finite(v.getFloat64(0, true));
}
export function keyBody(
  publication: bigint,
  code: number,
  down = true,
  modifiers = 0,
  repeat = false,
  clipboardReadSnapshot = 0n,
  identity?: KeyIdentity,
): Uint8Array {
  const key = identity ? keyIdentityText(identity.key) : null,
    textCode = identity ? keyIdentityText(identity.code) : null;
  if (identity) keyIdentityLocation(identity.location);
  const bytes = body(
    identity
      ? p.keyIdentityBytes + Math.ceil((key!.length + textCode!.length) / 8) * 8
      : clipboardReadSnapshot
        ? p.keyClipboardBytes
        : 24,
    (v) => {
      v.setBigUint64(0, uint64(publication), true);
      v.setUint32(8, uint32(code), true);
      v.setUint32(12, uint32(modifiers), true);
      v.setUint32(16, down ? 1 : 0, true);
      v.setUint32(20, repeat ? 1 : 0, true);
      if (clipboardReadSnapshot) v.setBigUint64(24, uint64(clipboardReadSnapshot), true);
      if (identity) {
        v.setUint32(32, key!.length, true);
        v.setUint32(36, textCode!.length, true);
        v.setUint32(40, identity.location, true);
      }
    },
  );
  if (identity) {
    bytes.set(key!, p.keyIdentityBytes);
    bytes.set(textCode!, p.keyIdentityBytes + key!.length);
  }
  return bytes;
}
export function uint32(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff)
    throw new RangeError('Expected uint32');
  return value;
}
/** JavaScript bitwise OR produces a signed int32 when bit 31 is selected. */
export function capabilityMask(value: number): number {
  if (!Number.isInteger(value) || value < -0x80000000 || value > 0xffffffff)
    throw new RangeError('Invalid capability mask');
  return value >>> 0;
}
export function uint64(value: bigint): bigint {
  if (typeof value !== 'bigint' || value < 0n || value > 0xffff_ffff_ffff_ffffn)
    throw new RangeError('Expected uint64 BigInt');
  return value;
}
function finite(value: number): number {
  if (!Number.isFinite(value) || Math.abs(value) > 1e12)
    throw new RangeError('Invalid engine scalar');
  return value;
}
export function body(size: number, write: (view: DataView) => void): Uint8Array {
  const bytes = new Uint8Array(size);
  write(new DataView(bytes.buffer));
  return bytes;
}
export function writeHandle(v: DataView, offset: number, h: NodeHandle): void {
  v.setUint32(offset, uint32(h.slot), true);
  v.setUint32(offset + 4, uint32(h.generation), true);
}
function readHandle(v: DataView, offset: number): NodeHandle {
  return Object.freeze({
    slot: v.getUint32(offset, true),
    generation: v.getUint32(offset + 4, true),
  });
}
/** State and pending-work metadata without copying the desired scene. */
export function stateInspectionBody(): Uint8Array {
  return body(4, (view) => view.setUint32(0, p.inspectionFlags.stateOnly, true));
}
/** Geometry, list, focus/editing and semantics without renderer paint payloads. */
export function appObservationBody(): Uint8Array {
  return body(4, (view) => view.setUint32(0, p.inspectionFlags.appObservation, true));
}
/** Published interaction geometry including clip paths, without render payloads. */
export function browserObservationBody(): Uint8Array {
  return body(4, (view) => view.setUint32(0, p.inspectionFlags.browserObservation, true));
}
/** Active layout for registered observers plus each observer's direct parent. */
export function appLayoutSelectionBody(nodes: readonly NodeHandle[]): Uint8Array {
  if (nodes.length > p.limits.nodes) throw new RangeError('Layout observer budget exceeded');
  return body(8 + nodes.length * 8, (view) => {
    view.setUint32(0, p.inspectionFlags.appLayoutSelection, true);
    view.setUint32(4, nodes.length, true);
    nodes.forEach((node, index) => {
      view.setUint32(8 + index * 8, node.slot, true);
      view.setUint32(12 + index * 8, node.generation, true);
    });
  });
}
export function packet(
  opcode: number,
  owner: PacketOwner,
  payload: Uint8Array = new Uint8Array(0),
  id = 0n,
  base = 0n,
  count = 0,
): Uint8Array {
  if (payload.byteLength > p.limits.packetBytes - p.headerBytes)
    throw new RangeError('Engine packet budget exceeded');
  const bytes = body(p.headerBytes + payload.byteLength, (v) => {
    v.setUint32(p.headerFields.magic, p.magic, true);
    v.setUint16(p.headerFields.major, p.abiMajor, true);
    v.setUint16(p.headerFields.minor, p.abiMinor, true);
    v.setUint32(p.headerFields.schema, p.schema, true);
    v.setUint16(p.headerFields.opcode, uint32(opcode), true);
    v.setUint32(p.headerFields.length, v.byteLength, true);
    v.setUint32(p.headerFields.session, uint32(owner.session), true);
    v.setUint32(p.headerFields.app, uint32(owner.app), true);
    v.setUint32(p.headerFields.view, uint32(owner.view), true);
    v.setUint32(p.headerFields.generation, uint32(owner.generation), true);
    v.setBigUint64(p.headerFields.id, uint64(id), true);
    v.setBigUint64(p.headerFields.base, uint64(base), true);
    v.setUint32(p.headerFields.count, uint32(count), true);
  });
  bytes.set(payload, p.headerBytes);
  return bytes;
}
function command(
  op: number,
  node: NodeHandle,
  payload: Uint8Array = new Uint8Array(0),
): Uint8Array {
  if (payload.length % 8 !== 0) throw new RangeError('Unaligned engine command');
  const bytes = body(16 + payload.length, (v) => {
    v.setUint16(0, op, true);
    v.setUint32(4, v.byteLength, true);
    writeHandle(v, 8, node);
  });
  bytes.set(payload, 16);
  return bytes;
}
function axis(v: DataView, offset: number, bound: AxisBound): void {
  v.setUint32(offset, p.bounds[bound.kind], true);
  const minimum = bound.kind === 'expand' ? 0 : (bound.min ?? 0);
  const maximum = bound.kind === 'finite' ? bound.max : 0;
  if (minimum < 0 || maximum < 0 || (bound.kind === 'finite' && minimum > maximum))
    throw new RangeError('Invalid engine constraints');
  v.setFloat64(offset + 8, finite(minimum), true);
  v.setFloat64(offset + 16, finite(maximum), true);
}
export type LayoutQueryKind = keyof typeof p.layoutQueries;
export function layoutQueryBody(
  node: NodeHandle,
  kind: LayoutQueryKind,
  horizontal: AxisBound,
  vertical: AxisBound,
): Uint8Array {
  return body(64, (v) => {
    writeHandle(v, 0, node);
    v.setUint32(8, p.layoutQueries[kind], true);
    axis(v, 16, horizontal);
    axis(v, 40, vertical);
  });
}
export interface EngineLayoutQuery {
  readonly id: bigint;
  readonly document: bigint;
  readonly metrics: bigint;
  readonly font: bigint;
  readonly status: number;
  readonly mode: number;
  readonly width: number;
  readonly height: number;
  readonly baseline: number;
  readonly value: number;
}
export interface TextRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
export interface EditingSnapshot {
  readonly revision: bigint;
  readonly serial: bigint;
  readonly text: string;
  readonly base: number;
  readonly extent: number;
  readonly composingStart: number;
  readonly composingEnd: number;
  readonly flags: number;
  readonly maximumLength: number;
}
export interface TextGeometry {
  readonly revision: bigint;
  readonly caret: TextRect;
  readonly selection: readonly TextRect[];
}
export interface EditingUpdate {
  readonly revision: bigint;
  readonly session?: bigint;
  readonly publication?: bigint;
  readonly kind: keyof typeof p.editKinds;
  readonly policy?: keyof typeof p.compositionPolicies;
  readonly text?: string;
  readonly base?: number;
  readonly extent?: number;
  readonly composingStart?: number;
  readonly composingEnd?: number;
}
export function editBody(node: NodeHandle, value: EditingUpdate): Uint8Array {
  const text = encodeUtf8(value.text ?? '', p.limits.textBytes);
  const result = body(64 + Math.ceil(text.length / 8) * 8, (v) => {
    writeHandle(v, 0, node);
    v.setBigUint64(8, uint64(value.session ?? 0n), true);
    v.setBigUint64(16, uint64(value.revision), true);
    v.setUint32(24, p.editKinds[value.kind], true);
    v.setUint32(28, p.compositionPolicies[value.policy ?? 'preserve'], true);
    [
      value.base ?? 0,
      value.extent ?? 0,
      value.composingStart ?? -1,
      value.composingEnd ?? -1,
    ].forEach((n, i) => {
      if (!Number.isInteger(n) || n < -1 || n > p.limits.textBytes)
        throw new RangeError('Invalid UTF-16 editing range');
      v.setInt32(32 + i * 4, n, true);
    });
    v.setUint32(48, text.length, true);
    v.setBigUint64(56, uint64(value.publication ?? 0n), true);
  });
  result.set(text, 64);
  return result;
}
export function focusBody(
  node: NodeHandle | null,
  publication: bigint,
  session = 0n,
  exactSession = false,
): Uint8Array {
  return body(exactSession ? 32 : 24, (v) => {
    writeHandle(v, 0, node ?? { slot: 0, generation: 0 });
    v.setBigUint64(8, uint64(publication), true);
    v.setBigUint64(16, uint64(session), true);
    if (exactSession) v.setUint32(24, 1, true);
  });
}
export function semanticActionBody(
  node: NodeHandle,
  publication: bigint,
  action: keyof typeof p.semanticsActions,
  session = 0n,
  value?: number,
): Uint8Array {
  return body(32, (v) => {
    writeHandle(v, 0, node);
    v.setBigUint64(8, uint64(publication), true);
    v.setUint32(16, p.semanticsActions[action], true);
    if (action === 'custom') {
      v.setUint32(20, uint32(value ?? NaN), true);
      v.setBigUint64(24, uint64(session), true);
    } else if (action === 'setValue') v.setFloat64(24, finite(value ?? NaN), true);
    else v.setBigUint64(24, uint64(session), true);
  });
}
export interface LayerLinkOptions {
  readonly kind: 'leader' | 'follower';
  readonly leader?: NodeHandle | null;
  readonly showWhenUnlinked?: boolean;
  readonly offset?: { readonly x: number; readonly y: number };
  readonly leaderAnchor?: { readonly x: number; readonly y: number };
  readonly followerAnchor?: { readonly x: number; readonly y: number };
}
export interface TooltipPositionOptions {
  readonly target: () => NodeHandle | null;
  readonly verticalOffset: number;
  readonly margin: number;
  readonly preferBelow: boolean;
}
export interface IntrinsicSizingOptions {
  readonly minimumHeight: number;
  readonly minimumWidthPerHeight: number;
  readonly expandReportedWidth: boolean;
}
export const commands = {
  childAnchor(
    node: NodeHandle,
    options?: readonly [number, number, number, number, number, number],
  ): Uint8Array {
    return command(
      p.commands.childAnchor,
      node,
      options
        ? body(48, (data) => {
            if (options.length !== 6) throw Error('Invalid child anchor');
            options.forEach((value, index) => data.setFloat64(index * 8, finite(value), true));
          })
        : new Uint8Array(),
    );
  },
  layoutProgram(node: NodeHandle, options?: NativeLayoutProgram): Uint8Array {
    return command(p.commands.layoutProgram, node, layoutProgramBytes(options));
  },
  intrinsicSizing(node: NodeHandle, options?: IntrinsicSizingOptions): Uint8Array {
    return command(
      p.commands.intrinsicSizing,
      node,
      options
        ? body(24, (data) => {
            if (
              options.minimumHeight < 0 ||
              options.minimumWidthPerHeight < 0 ||
              typeof options.expandReportedWidth !== 'boolean'
            )
              throw Error('Invalid intrinsic sizing');
            data.setFloat64(0, finite(options.minimumHeight), true);
            data.setFloat64(8, finite(options.minimumWidthPerHeight), true);
            data.setUint32(16, options.expandReportedWidth ? 1 : 0, true);
          })
        : new Uint8Array(),
    );
  },
  tooltipPosition(node: NodeHandle, options?: TooltipPositionOptions): Uint8Array {
    return command(
      p.commands.tooltipPosition,
      node,
      options
        ? body(32, (data) => {
            const target = options.target();
            if (target) writeHandle(data, 0, target);
            if (typeof options.preferBelow !== 'boolean' || options.margin < 0)
              throw Error('Invalid tooltip position policy');
            data.setFloat64(8, finite(options.verticalOffset), true);
            data.setFloat64(16, finite(options.margin), true);
            data.setUint32(24, options.preferBelow ? 1 : 0, true);
          })
        : new Uint8Array(),
    );
  },
  layoutBuilder(node: NodeHandle, options?: LayoutBuilderOptions): Uint8Array {
    return command(p.commands.layoutBuilder, node, layoutBuilderBytes(options));
  },
  snapshot(node: NodeHandle, options?: NativeSnapshotConfiguration): Uint8Array {
    return command(p.commands.snapshot, node, snapshotStyleBytes(options));
  },
  tapRegion(node: NodeHandle, options?: NativeTapRegionOptions): Uint8Array {
    return command(
      p.commands.tapRegion,
      node,
      options
        ? body(p.tapRegionBytes, (v) => {
            if (options.kind === 'surface') {
              v.setUint32(0, p.tapRegionFlags.surface, true);
              return;
            }
            if (
              options.revision <= 0n ||
              options.revision > 0xffffffffffffffffn ||
              !Number.isInteger(options.group ?? 0) ||
              (options.group ?? 0) < 0 ||
              (options.group ?? 0) > p.limits.nodes
            )
              throw Error('Invalid native TapRegion registration');
            let flags = options.enabled === false ? 0 : p.tapRegionFlags.enabled;
            for (const key of [
              'consumeOutside',
              'downInside',
              'downOutside',
              'upInside',
              'upOutside',
            ] as const)
              if (options[key]) flags |= p.tapRegionFlags[key];
            v.setUint32(0, flags, true);
            v.setUint32(4, options.group ?? 0, true);
            writeHandle(v, 8, options.surface);
            v.setBigUint64(16, options.revision, true);
          })
        : new Uint8Array(),
    );
  },
  imageStyle(node: NodeHandle, options: ImageStyleOptions | null): Uint8Array {
    return command(p.commands.imageStyle, node, imageStyleBytes(options));
  },
  layerLink(node: NodeHandle, options?: LayerLinkOptions): Uint8Array {
    return command(
      p.commands.layerLink,
      node,
      options
        ? body(p.layerLinkBytes, (v) => {
            v.setUint32(0, options.kind === 'leader' ? 1 : 2, true);
            v.setUint32(
              4,
              options.kind === 'follower' && options.showWhenUnlinked !== false ? 1 : 0,
              true,
            );
            writeHandle(v, 8, options.leader ?? { slot: 0, generation: 0 });
            const values =
              options.kind === 'leader'
                ? [0, 0, 0, 0, 0, 0]
                : [
                    options.offset?.x ?? 0,
                    options.offset?.y ?? 0,
                    options.leaderAnchor?.x ?? -1,
                    options.leaderAnchor?.y ?? -1,
                    options.followerAnchor?.x ?? -1,
                    options.followerAnchor?.y ?? -1,
                  ];
            values.forEach((value, index) => v.setFloat64(16 + index * 8, finite(value), true));
          })
        : new Uint8Array(),
    );
  },
  nativePaint(node: NodeHandle, entries?: readonly NativePaintOptions[]) {
    return command(
      p.commands.nativePaint,
      node,
      entries ? nativePaintBody(entries) : new Uint8Array(0),
    );
  },
  clipStyle(node: NodeHandle, options: ClipStyleOptions | null = null): Uint8Array {
    return command(
      p.commands.clipStyle,
      node,
      options ? clipStyleBytes(options) : new Uint8Array(0),
    );
  },
  graphics(node: NodeHandle, options: GraphicsOptions = {}): Uint8Array {
    const path = options.path ?? [];
    if (path.length > p.limits.pathCommands) throw new RangeError('Path command budget');
    if (options.transform && options.transform.length !== 6)
      throw new RangeError('Expected a six-value affine transform');
    return command(
      p.commands.graphics,
      node,
      body(p.graphicsBytes + path.length * p.graphicsPathBytes, (v) => {
        (options.transform ?? [1, 0, 0, 1, 0, 0]).forEach((x, i) =>
          v.setFloat64(i * 8, finite(x), true),
        );
        v.setFloat64(48, finite(options.shadow?.x ?? 0), true);
        v.setFloat64(56, finite(options.shadow?.y ?? 0), true);
        v.setFloat64(64, finite(options.shadow?.sigma ?? 0), true);
        v.setUint32(72, uint32(options.shadow?.color ?? 0), true);
        v.setUint32(76, uint32(options.stroke?.color ?? 0), true);
        v.setFloat64(80, finite(options.stroke?.width ?? 0), true);
        v.setFloat64(88, finite(options.blur ?? 0), true);
        v.setUint32(
          p.graphicsFields.flags,
          (options.fillRule === 'evenOdd' ? p.graphicsFlags.evenOdd : 0) |
            (options.path !== undefined ? p.graphicsFlags.hasPath : 0) |
            (options.origin ? p.graphicsFlags.hasOrigin : 0) |
            (options.alignment ? p.graphicsFlags.hasAlignment : 0),
          true,
        );
        v.setUint32(p.graphicsFields.pathCount, path.length, true);
        v.setFloat64(p.graphicsFields.originX, finite(options.origin?.x ?? 0), true);
        v.setFloat64(p.graphicsFields.originY, finite(options.origin?.y ?? 0), true);
        v.setFloat64(p.graphicsFields.alignmentX, finite(options.alignment?.x ?? 0), true);
        v.setFloat64(p.graphicsFields.alignmentY, finite(options.alignment?.y ?? 0), true);
        path.forEach((segment, i) => {
          const verb = { move: 1, line: 2, quad: 3, cubic: 4, close: 5 }[segment[0]];
          if (!verb) throw new RangeError('Unknown path verb');
          v.setUint32(p.graphicsBytes + i * p.graphicsPathBytes, verb, true);
          segment
            .slice(1)
            .forEach((x, j) =>
              v.setFloat64(
                p.graphicsBytes + 8 + i * p.graphicsPathBytes + j * 8,
                finite(x as number),
                true,
              ),
            );
        });
      }),
    );
  },
  nativeExtension(
    node: NodeHandle,
    width: number,
    height: number,
    values: readonly number[],
  ): Uint8Array {
    if (values.length < 2 || values.length > 256)
      throw new RangeError('Native sparkline requires 2–256 samples');
    return command(
      p.commands.nativeExtension,
      node,
      body(24 + values.length * 8, (v) => {
        v.setUint32(0, p.extensions.sparkline, true);
        v.setUint32(4, values.length, true);
        v.setFloat64(8, finite(width), true);
        v.setFloat64(16, finite(height), true);
        values.forEach((value, index) => v.setFloat64(24 + index * 8, finite(value), true));
      }),
    );
  },
  editor(
    node: NodeHandle,
    flags = 0,
    maximumLength: number = p.limits.textBytes,
    viewport?: EditorViewportOptions,
  ): Uint8Array {
    if (
      viewport &&
      ((viewport.expands !== undefined && typeof viewport.expands !== 'boolean') ||
        !Number.isSafeInteger(viewport.minLines) ||
        !Number.isSafeInteger(viewport.maxLines) ||
        viewport.minLines < 0 ||
        viewport.maxLines < 0 ||
        viewport.minLines > p.limits.textBytes ||
        viewport.maxLines > p.limits.textBytes ||
        (viewport.expands
          ? viewport.minLines !== 0 || viewport.maxLines !== 0
          : viewport.minLines === 0 ||
            (viewport.maxLines !== 0 && viewport.maxLines < viewport.minLines)))
    )
      throw RangeError('Invalid editor viewport');
    return command(
      p.commands.editor,
      node,
      body(viewport ? p.editorViewportBytes : 8, (v) => {
        v.setUint32(0, uint32(flags), true);
        v.setUint32(4, uint32(maximumLength), true);
        if (viewport) {
          v.setUint32(8, viewport.minLines, true);
          v.setUint32(12, viewport.maxLines, true);
          v.setUint32(16, viewport.expands ? p.editorViewportFlags.expands : 0, true);
        }
      }),
    );
  },
  semantics(node: NodeHandle, value: SemanticProperties | null): Uint8Array {
    return command(p.commands.semantics, node, semanticBody(value));
  },
  coverage(
    node: NodeHandle,
    revision: bigint,
    range: { readonly minimum: number; readonly maximum: number } | null,
  ): Uint8Array {
    return command(
      p.commands.coverage,
      node,
      body(32, (v) => {
        v.setBigUint64(0, uint64(revision), true);
        v.setFloat64(8, finite(range?.minimum ?? 0), true);
        v.setFloat64(16, finite(range?.maximum ?? 0), true);
        v.setUint32(24, range ? 1 : 0, true);
      }),
    );
  },
  layout(node: NodeHandle, value: NodeLayout = {}): Uint8Array {
    return command(
      p.commands.layout,
      node,
      body(p.layoutBytes, (v) => {
        v.setUint32(0, value.enabled === false ? 0 : 1, true);
        v.setUint32(4, value.direction === 'vertical' ? 1 : 0, true);
        v.setUint32(8, value.mainSize === 'max' ? 1 : 0, true);
        v.setUint32(12, p.layoutMainAlign[value.mainAlign ?? 'start'], true);
        v.setUint32(16, p.layoutCrossAlign[value.crossAlign ?? 'start'], true);
        v.setUint32(20, value.fit === 'loose' ? 1 : 0, true);
        v.setUint32(24, uint32(value.columns ?? 2), true);
        v.setUint32(
          28,
          p.layoutChildConstraints[value.childConstraints ?? 'loose'] |
            (value.enforceBounds ? p.layoutConstraintFlags.enforceBounds : 0) |
            (value.reverseMain ? p.layoutConstraintFlags.reverseMain : 0) |
            (value.reverseCross ? p.layoutConstraintFlags.reverseCross : 0) |
            (value.alignment ? p.layoutConstraintFlags.alignment : 0) |
            (value.alignmentSizing ? p.layoutConstraintFlags.alignmentSizing : 0) |
            (value.shrinkUnboundedMain ? p.layoutConstraintFlags.shrinkUnboundedMain : 0) |
            (value.expandEmpty ? p.layoutConstraintFlags.expandEmpty : 0) |
            (value.clipOverflow ? p.layoutConstraintFlags.clipOverflow : 0) |
            (value.paragraphSizing ? p.layoutConstraintFlags.paragraphSizing : 0) |
            (value.preferredSize ? p.layoutConstraintFlags.preferredSize : 0) |
            (value.expandPreferredWidth ? p.layoutConstraintFlags.expandPreferredWidth : 0) |
            (value.paintChild ? p.layoutConstraintFlags.paintChild : 0) |
            (value.inlineScale !== undefined ? p.layoutConstraintFlags.inlineScale : 0) |
            (value.inputPadding ? p.layoutConstraintFlags.inputPadding : 0) |
            (value.offstage ? p.layoutConstraintFlags.offstage : 0) |
            (value.canonicalStack ? p.layoutConstraintFlags.canonicalStack : 0),
          true,
        );
        [
          value.flex ?? 0,
          value.gap ?? 0,
          value.runGap ?? 0,
          value.padding?.left ?? 0,
          value.padding?.top ?? 0,
          value.padding?.right ?? 0,
          value.padding?.bottom ?? 0,
          value.alignment?.x ?? 0,
          value.alignment?.y ?? 0,
          value.widthFactor ?? -1,
          value.heightFactor ?? -1,
          value.inlineScale ?? 1,
        ].forEach((scalar, i) => v.setFloat64(32 + i * 8, finite(scalar), true));
        v.setUint32(
          p.layoutFields.runAlign,
          uint32(p.layoutMainAlign[value.runAlign ?? 'start']),
          true,
        );
        v.setUint32(
          p.layoutFields.textBaseline,
          value.textBaseline === undefined
            ? 0
            : value.textBaseline === 'alphabetic'
              ? 1
              : value.textBaseline === 'ideographic'
                ? 2
                : uint32(NaN),
          true,
        );
        v.setUint32(
          p.layoutFields.overflowClipBehavior,
          uint32(
            p.clipBehaviors[
              value.overflowClipBehavior ?? (value.clipOverflow ? 'hardEdge' : 'none')
            ],
          ),
          true,
        );
        let positionedFlags = 0;
        for (const [index, name] of (
          ['left', 'top', 'right', 'bottom', 'width', 'height'] as const
        ).entries()) {
          const scalar = value.positioned?.[name];
          if (scalar !== undefined) {
            positionedFlags |= 1 << index;
            v.setFloat64(p.layoutFields.positioned + index * 8, finite(scalar), true);
          }
        }
        v.setUint32(p.layoutFields.positionedFlags, positionedFlags, true);
      }),
    );
  },
  paint(node: NodeHandle, color: number, radius = 0): Uint8Array {
    return command(
      p.commands.paint,
      node,
      body(16, (v) => {
        v.setUint32(0, uint32(color), true);
        v.setFloat64(8, finite(radius), true);
      }),
    );
  },
  text(
    node: NodeHandle,
    text: string,
    fontSize = 18,
    color = 0xff172033,
    options: { readonly direction?: 'ltr' | 'rtl'; readonly styleOnly?: boolean } = {},
  ): Uint8Array {
    const bytes = encodeUtf8(text, p.limits.textBytes);
    const data = body(24 + Math.ceil(bytes.length / 8) * 8, (v) => {
      v.setUint32(0, uint32(color), true);
      v.setUint32(4, options.direction === 'rtl' ? 1 : 0, true);
      v.setFloat64(8, finite(fontSize), true);
      v.setUint32(16, bytes.length, true);
      v.setUint32(20, options.styleOnly ? p.textFlags.styleOnly : 0, true);
    });
    data.set(bytes, 24);
    return command(p.commands.text, node, data);
  },
  paintPlacement(node: NodeHandle, value?: PaintPlacementOptions): Uint8Array {
    return command(
      p.commands.paintPlacement,
      node,
      value ? paintPlacementBytes(value) : new Uint8Array(),
    );
  },
  paragraphFont(
    node: NodeHandle,
    value?: { readonly resource: NodeHandle | null; readonly fontRevision: bigint },
  ): Uint8Array {
    return command(
      p.commands.paragraphFont,
      node,
      value
        ? body(16, (v) => {
            writeHandle(v, 0, value.resource ?? { slot: 0, generation: 0 });
            v.setBigUint64(8, uint64(value.fontRevision), true);
          })
        : new Uint8Array(),
    );
  },
  paragraphOptions(node: NodeHandle, value: ParagraphOptions | null): Uint8Array {
    return command(p.commands.paragraphOptions, node, paragraphOptionsBytes(value));
  },
  create(
    node: NodeHandle,
    kind: keyof typeof p.kinds,
    initialFlags = 0,
    placement?: { readonly parent: NodeHandle; readonly index?: number },
  ): Uint8Array {
    uint32(initialFlags);
    if (
      initialFlags > 7 ||
      (initialFlags & p.nodeCreationFlags.inheritChildConstraints &&
        !(initialFlags & p.nodeCreationFlags.layoutEnabled))
    )
      throw new RangeError('Invalid node creation flags');
    return command(
      p.commands.create,
      node,
      body(placement ? p.nodeAttachedCreationBytes : p.nodeCreationBytes, (v) => {
        v.setUint32(0, p.kinds[kind], true);
        v.setUint32(4, initialFlags, true);
        if (placement) {
          writeHandle(v, p.nodeCreationFields.parent, placement.parent);
          v.setUint32(p.nodeCreationFields.index, uint32(placement.index ?? 0), true);
        }
      }),
    );
  },
  properties(node: NodeHandle, value: NodeProperties): Uint8Array {
    const values = [
      value.x ?? 0,
      value.y ?? 0,
      value.width ?? 0,
      value.height ?? 0,
      value.opacity ?? 1,
      value.minimum ?? 0,
      value.maximum ?? 0,
    ];
    return command(
      p.commands.properties,
      node,
      body(p.nodeInitialPropertiesBytes, (v) => {
        v.setFloat64(64, finite(value.initialScrollOffset ?? 0), true);
        values.forEach((scalar, i) => v.setFloat64(i * 8, finite(scalar), true));
        v.setUint32(56, p.extents[value.extent ?? 'finite'], true);
        v.setUint32(
          60,
          (value.horizontal ? 1 : 0) | (value.chaining ? 2 : 0) | (value.pageSnapping ? 4 : 0),
          true,
        );
      }),
    );
  },
  attach(node: NodeHandle, parent: NodeHandle, index = 0): Uint8Array {
    return command(
      p.commands.attach,
      node,
      body(16, (v) => {
        writeHandle(v, 0, parent);
        v.setUint32(8, uint32(index), true);
      }),
    );
  },
  move(node: NodeHandle, parent: NodeHandle, index = 0): Uint8Array {
    const bytes = this.attach(node, parent, index);
    new DataView(bytes.buffer).setUint16(0, p.commands.move, true);
    return bytes;
  },
  detach(node: NodeHandle): Uint8Array {
    return command(p.commands.detach, node);
  },
  destroy(node: NodeHandle, detach = false): Uint8Array {
    if (typeof detach !== 'boolean') throw new TypeError('Invalid node destroy policy');
    return command(
      p.commands.destroy,
      node,
      detach ? body(8, (v) => v.setUint32(0, p.nodeDestroyFlags.detach, true)) : undefined,
    );
  },
  acquireResource(resource: NodeHandle, bytes: Uint8Array): Uint8Array {
    if (bytes.length > p.limits.packetBytes - 88)
      throw new RangeError('Engine resource packet budget exceeded');
    const payload = body(8 + Math.ceil(bytes.length / 8) * 8, (v) =>
      v.setUint32(0, bytes.length, true),
    );
    payload.set(bytes, 8);
    return command(p.commands.acquireResource, resource, payload);
  },
  releaseResource(resource: NodeHandle): Uint8Array {
    return command(p.commands.releaseResource, resource);
  },
  bindResource(node: NodeHandle, resource: NodeHandle | null): Uint8Array {
    return command(
      p.commands.bindResource,
      node,
      body(8, (v) => writeHandle(v, 0, resource ?? { slot: 0, generation: 0 })),
    );
  },
  eventPolicy(node: NodeHandle, flags: number): Uint8Array {
    return command(
      p.commands.eventPolicy,
      node,
      body(8, (v) => v.setUint32(0, uint32(flags), true)),
    );
  },
  list(node: NodeHandle, value: ListOptions | null): Uint8Array {
    if (value?.fixed !== undefined && typeof value.fixed !== 'boolean')
      throw RangeError('Invalid fixed list flag');
    if (
      (value?.sequential !== undefined && typeof value.sequential !== 'boolean') ||
      (value?.sequential && (value.fixed || value.estimate !== 0))
    )
      throw RangeError('Invalid sequential list policy');
    return command(
      p.commands.list,
      node,
      body(32, (v) => {
        v.setBigUint64(0, uint64(value?.generation ?? 0n), true);
        v.setUint32(8, uint32(value?.count ?? 0), true);
        v.setUint32(12, uint32(value?.begin ?? 0), true);
        v.setUint32(16, uint32(value?.end ?? 0), true);
        v.setUint32(
          20,
          (value?.fixed ? p.listFlags.fixedExtent : 0) |
            (value?.sequential ? p.listFlags.sequential : 0),
          true,
        );
        v.setFloat64(24, finite(value?.estimate ?? 0), true);
      }),
    );
  },
  gesture(node: NodeHandle, mask: number, devices = 63): Uint8Array {
    return command(
      p.commands.gesture,
      node,
      body(8, (v) => {
        if (uint32(devices) > 63) throw Error('Invalid gesture device mask');
        v.setUint32(0, uint32(mask), true);
        v.setUint32(4, devices, true);
      }),
    );
  },
  control(node: NodeHandle, value: ControlOptions | null): Uint8Array {
    return command(
      p.commands.control,
      node,
      body(64, (v) => {
        v.setUint32(0, p.controlKinds[value?.kind ?? 'none'], true);
        v.setUint32(
          4,
          (value?.disabled ? 1 : 0) |
            (['filled', 'outlined', 'text', 'elevated', 'chip'].indexOf(
              value?.appearance ?? 'filled',
            ) <<
              1),
          true,
        );
        v.setUint32(8, uint32(value?.foreground ?? 0xff286ee9), true);
        v.setUint32(12, uint32(value?.track ?? 0xffd0d7e2), true);
        v.setBigUint64(16, uint64(value?.revision ?? 0n), true);
        [
          value?.minimum ?? 0,
          value?.maximum ?? 1,
          value?.step ?? 0,
          value?.value ?? 0,
          value?.second ?? value?.maximum ?? 1,
        ].forEach((n, i) => v.setFloat64(24 + i * 8, finite(n), true));
      }),
    );
  },
  listItem(node: NodeHandle, value: { index: number; key: bigint } | null): Uint8Array {
    return command(
      p.commands.listItem,
      node,
      body(16, (v) => {
        v.setUint32(0, uint32(value?.index ?? 0), true);
        v.setBigUint64(8, uint64(value?.key ?? 0n), true);
      }),
    );
  },
  motion(
    node: NodeHandle,
    id: bigint,
    baseRevision: bigint,
    opacity: number,
    seconds: number,
  ): Uint8Array {
    return command(
      p.commands.motion,
      node,
      body(32, (v) => {
        v.setBigUint64(0, uint64(id), true);
        v.setBigUint64(8, uint64(baseRevision), true);
        v.setFloat64(16, finite(opacity), true);
        v.setFloat64(24, finite(seconds), true);
      }),
    );
  },
  constraints(node: NodeHandle, horizontal: AxisBound, vertical: AxisBound): Uint8Array {
    return command(
      p.commands.constraints,
      node,
      body(48, (v) => {
        axis(v, 0, horizontal);
        axis(v, 24, vertical);
      }),
    );
  },
};
export function transaction(
  owner: PacketOwner,
  id: bigint,
  base: bigint,
  changes: readonly Uint8Array[],
): Uint8Array {
  if (changes.length > p.limits.commands)
    throw new RangeError('Engine command count budget exceeded');
  const length = changes.reduce((sum, bytes) => sum + bytes.length, 0);
  if (length > p.limits.packetBytes - p.headerBytes)
    throw new RangeError('Engine transaction budget exceeded');
  const payload = new Uint8Array(length);
  let offset = 0;
  for (const bytes of changes) {
    payload.set(bytes, offset);
    offset += bytes.length;
  }
  return packet(p.opcodes.transaction, owner, payload, id, base, changes.length);
}
export interface InputPacket {
  /** Host publication installed when this sample was collected. */
  readonly publication?: bigint;
  readonly pointer?: boolean;
  readonly hover?: boolean;
  readonly sequence: bigint;
  readonly metrics: bigint;
  readonly target: NodeHandle;
  readonly stream: number;
  readonly phase: keyof typeof p.phases;
  readonly source: keyof typeof p.sources;
  /** Engine monotonic seconds, after host clock conversion. */
  readonly time: number;
  /** Original sample clock value; never subtracted from engine time. */
  readonly sample?: number;
  readonly x?: number;
  readonly y?: number;
  readonly dx?: number;
  readonly dy?: number;
  readonly velocity?: number;
  readonly clock?: number;
  readonly buttons?: number;
  readonly modifiers?: number;
  readonly device?: number;
  readonly contact?: number;
  readonly kind?: keyof typeof p.pointerKinds;
}
export interface RawInputSample extends InputPacket {
  readonly node: NodeHandle;
  readonly subscription: bigint;
}
export interface PointerSample extends InputPacket {
  readonly inverse: AffineMatrix;
}
function readInputSample(data: DataView, b: number): InputPacket {
  const phase = Object.entries(p.phases).find(
    ([, value]) => value === data.getUint32(b + 28, true),
  )?.[0] as InputPacket['phase'] | undefined;
  const source = Object.entries(p.sources).find(
    ([, value]) => value === data.getUint32(b + 32, true),
  )?.[0] as InputPacket['source'] | undefined;
  const kind = Object.entries(p.pointerKinds).find(
    ([, value]) => value === data.getUint32(b + p.inputFields.kind, true),
  )?.[0] as InputPacket['kind'];
  const flags = data.getUint32(b + 36, true),
    stream = data.getUint32(b + 24, true);
  if (
    !phase ||
    !source ||
    !kind ||
    flags & ~7 ||
    (flags & 4 && !(flags & 2)) ||
    !stream ||
    stream > p.limits.streams
  )
    throw Error('Invalid input sample');
  const number = (offset: number) => finite(data.getFloat64(b + offset, true));
  return Object.freeze({
    sequence: data.getBigUint64(b, true),
    metrics: data.getBigUint64(b + 8, true),
    target: readHandle(data, b + 16),
    stream,
    phase,
    source,
    pointer: !!(flags & 2),
    hover: !!(flags & 4),
    time: number(40),
    ...(flags & 1 ? { sample: number(48) } : {}),
    x: number(56),
    y: number(64),
    dx: number(72),
    dy: number(80),
    velocity: number(88),
    clock: data.getUint32(b + 96, true),
    buttons: data.getUint32(b + 100, true),
    modifiers: data.getUint32(b + 104, true),
    device: data.getUint32(b + 108, true),
    contact: data.getUint32(b + 112, true),
    kind,
    publication: data.getBigUint64(b + 120, true),
  });
}
export function inputBody(value: InputPacket): Uint8Array {
  return body(p.inputBytes, (v) => {
    v.setUint32(p.inputFields.kind, p.pointerKinds[value.kind ?? 'unknown'], true);
    v.setBigUint64(p.inputFields.publication, uint64(value.publication ?? 0n), true);
    v.setBigUint64(0, uint64(value.sequence), true);
    v.setBigUint64(8, uint64(value.metrics), true);
    writeHandle(v, 16, value.target);
    v.setUint32(24, uint32(value.stream), true);
    v.setUint32(28, p.phases[value.phase], true);
    v.setUint32(32, p.sources[value.source], true);
    v.setUint32(
      36,
      (value.sample === undefined ? 0 : 1) | (value.pointer ? 2 : 0) | (value.hover ? 4 : 0),
      true,
    );
    [
      value.time,
      value.sample ?? 0,
      value.x ?? 0,
      value.y ?? 0,
      value.dx ?? 0,
      value.dy ?? 0,
      value.velocity ?? 0,
    ].forEach((scalar, i) => v.setFloat64(40 + i * 8, finite(scalar), true));
    [
      value.clock ?? 1,
      value.buttons ?? 0,
      value.modifiers ?? 0,
      value.device ?? 0,
      value.contact ?? 0,
    ].forEach((scalar, i) => v.setUint32(96 + i * 4, uint32(scalar), true));
  });
}
export interface LayerCompositionSnapshot {
  readonly kind: 'leader' | 'follower';
  readonly leader: NodeHandle;
  readonly linked: boolean;
  readonly showWhenUnlinked: boolean;
  readonly transform: AffineMatrix | null;
  readonly linkedOffset: { readonly x: number; readonly y: number };
}
export interface EngineNodeSnapshot {
  readonly layoutBuilder: LayoutBuilderOptions | null;
  readonly snapshot: NativeSnapshotConfiguration | null;
  readonly imagePaint: ImagePaintSnapshot | null;
  readonly fontBinding: FontResourceBinding | null;
  readonly layerComposition: LayerCompositionSnapshot | null;
  readonly nativePaint: readonly NativePaintSnapshot[] | null;
  readonly paragraph: ParagraphSnapshot | null;
  readonly paintPlacement?: PaintPlacementOptions | null;
  readonly graphics: GraphicsSnapshot | null;
  readonly clipStyle: ClipStyleSnapshot | null;
  readonly matrix: AffineMatrix;
  readonly bounds: TextRect;
  readonly depth: number;
  readonly localOpacity: number;
  readonly control: ControlSnapshot | null;
  readonly list: ListSnapshot | null;
  readonly editing: EditingSnapshot | null;
  readonly textGeometry: TextGeometry | null;
  readonly semantics: SemanticSnapshot | null;
  readonly semanticTraversal: {
    readonly parent: NodeHandle;
    readonly index: number;
    readonly customSources: readonly { readonly id: number; readonly source: NodeHandle }[];
  } | null;
  readonly semanticGeometry?: {
    readonly bounds: TextRect;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly matrix: AffineMatrix;
  } | null;
  readonly hasFocus: boolean;
  readonly caretVisible: boolean;
  readonly node: NodeHandle;
  readonly kind: number;
  readonly parent: NodeHandle;
  readonly flags: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly offset: number;
  /** Provider content layout rectangle in logical units. Paragraph layout may
   * extend beyond its constrained border box. */
  readonly content: TextRect;
  readonly velocity: number;
  readonly scrollRevision: bigint;
  readonly opacity: number;
  readonly motion: bigint;
  readonly color: number;
  readonly order: number;
  readonly radius: number;
  readonly fontSize: number;
  readonly resource: NodeHandle;
  readonly baseline: number;
  readonly layoutRevision: bigint;
  readonly textDirection: number;
  readonly requestedOffset: number;
  readonly scrollMinimum: number;
  readonly scrollMaximum: number;
  readonly deferred: boolean;
  readonly preparedCoverage: {
    readonly minimum: number;
    readonly maximum: number;
    readonly revision: bigint;
  } | null;
  readonly clip: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
}
export interface EngineBlob {
  /** @internal Immutable ID within one observation owner/generation. */
  readonly registration?: bigint;
  readonly type: number;
  readonly handle: NodeHandle;
  readonly bytes: Uint8Array;
}
export interface EngineEvent {
  readonly keyIdentity?: KeyIdentity;
  readonly pointer?: PointerSample;
  /** Original annotation that contributed this published semantic action. */
  readonly semanticSource?: NodeHandle;
  readonly tapRegion?: {
    readonly batch: bigint;
    readonly surface: NodeHandle;
    readonly semanticTarget: NodeHandle;
    readonly device: number;
    readonly inverse: AffineMatrix;
  };
  readonly focusPeer?: NodeHandle;
  /** Host-owned clipboard view captured at this native paste key's ingress. */
  readonly clipboardReadSnapshot?: bigint;
  readonly gesture?: GestureDetails;
  readonly x: number;
  readonly y: number;
  readonly kind: number;
  readonly status: number;
  readonly id: bigint;
  readonly epoch: bigint;
  readonly detail: bigint;
  readonly node: NodeHandle;
}
export interface EngineResponse {
  readonly observation: ObservationDelta | null;
  readonly layoutBuildPending: boolean;
  readonly layoutBuildRequest: LayoutBuildRequest | null;
  readonly semanticRoute: {
    readonly sequence: bigint;
    readonly scope: NodeHandle | null;
    readonly name: NodeHandle | null;
    readonly label: string;
  } | null;
  readonly snapshotDecision: SnapshotDecision | null;
  readonly canonicalKeyboard: boolean;
  readonly memory: {
    readonly total: bigint;
    readonly peak: bigint;
    readonly cpu: bigint;
    readonly gpu: bigint;
    readonly staging: bigint;
    readonly engineHeap: bigint;
    readonly providerHeap: bigint;
    readonly rejected: bigint;
    readonly limit: bigint;
  };
  readonly rawInputs: readonly RawInputSample[];
  readonly gestureRequests: readonly RawInputSample[];
  readonly focus: {
    readonly node: NodeHandle;
    readonly peer: NodeHandle | null;
    readonly session: bigint;
  } | null;
  readonly publishedDocument: bigint;
  readonly publishedMetrics: bigint;
  readonly publishedDevice: bigint;
  readonly keyWork: bigint;
  readonly focusWork: bigint;
  readonly framePaintWork: bigint;
  readonly framePaintNodes: bigint;
  readonly framePlacementNodes: bigint;
  readonly interactionCount: number;
  readonly editingWork: bigint;
  readonly semanticsWork: bigint;
  readonly queryWork: bigint;
  readonly gestureWork: bigint;
  readonly controlWork: bigint;
  /** Last accepted transaction, identified by document; never summed across polls. */
  readonly transactionCost: Readonly<{
    blobRegistrations: bigint;
    blobBindings: bigint;
    blobBytes: bigint;
    nodeClones: bigint;
    slotPages: bigint;
    directories: bigint;
    childLists: bigint;
    fullValidations: bigint;
    incrementalValidations: bigint;
    validationVisits: bigint;
    siblingVisits: bigint;
  }>;
  readonly layoutQuery: EngineLayoutQuery | null;
  readonly measurePreparation: bigint;
  readonly measureDocument: bigint;
  readonly status: number;
  readonly opcode: number;
  readonly owner: PacketOwner;
  readonly id: bigint;
  readonly resultEpoch: bigint;
  readonly document: bigint;
  readonly activeDocument: bigint;
  readonly scene: bigint;
  readonly preparation: bigint;
  readonly metrics: bigint;
  readonly property: bigint;
  /** Latest Core viewport observation; it is independent of the activated layout. */
  readonly viewport: {
    readonly width: number;
    readonly height: number;
    readonly scale: number;
  } | null;
  readonly consumedThrough: bigint;
  readonly received: bigint;
  readonly consumed: bigint;
  readonly canceled: bigint;
  readonly rejected: bigint;
  readonly duplicates: bigint;
  readonly queued: number;
  readonly holds: number;
  readonly pendingDocument: bigint;
  readonly reservedBytes: bigint;
  readonly resourceBytes: bigint;
  readonly fontTransition: FontTransitionState | null;
  readonly nodeBlocks: bigint;
  readonly submission: bigint;
  readonly publication: bigint;
  readonly surfaceCommit: bigint | null;
  readonly submitted: bigint;
  readonly ticks: bigint;
  readonly activated: bigint;
  readonly device: bigint;
  readonly nodeCount: number;
  readonly closed: boolean;
  readonly visible: boolean;
  readonly focused: boolean;
  readonly wake: boolean;
  readonly preparationReady: boolean;
  readonly sharedMemory: boolean;
  readonly contentIndependent: boolean;
  readonly capabilities: number;
  readonly pendingPublication: bigint;
  readonly lastInput: bigint;
  readonly lastTransaction: bigint;
  readonly acknowledged: bigint;
  readonly activePreparation: bigint;
  readonly failedDocument: bigint;
  readonly sessionQueued: number;
  readonly sessionUpdates: number;
  /** Engine monotonic seconds; null means no command timer is needed. */
  readonly nextDeadline: number | null;
  readonly providerPending: boolean;
  readonly transactionWork: bigint;
  readonly contentWork: bigint;
  readonly contentOwner: bigint;
  readonly renderOwner: bigint;
  readonly renderWake: boolean;
  readonly preparationDocument: bigint;
  readonly measureRequest: bigint;
  readonly layoutWork: bigint;
  readonly imagePaintWork: bigint;
  readonly appFrameWork: bigint;
  readonly layoutReused: bigint;
  readonly layoutDocument: bigint;
  readonly layoutMetrics: bigint;
  readonly fontRevision: bigint;
  readonly coverageRequests: bigint;
  readonly coverageDeferred: bigint;
  readonly coverageClamps: bigint;
  readonly coverageHandoffs: bigint;
  readonly blobs: readonly EngineBlob[];
  readonly nodes: readonly EngineNodeSnapshot[];
  readonly events: readonly EngineEvent[];
}
export function response(
  bytes: Uint8Array,
  options: {
    appObservation?: boolean;
    /** Internal transport hands off this buffer for the snapshot's entire life. */
    ownedObservation?: boolean;
    observationCache?: ObservationDecodeCache;
    observationOwner?: string;
    observationStream?: ObservationStream;
  } = {},
): EngineResponse {
  if (bytes.length < p.headerBytes + p.stateBytes || bytes.length > p.limits.responseBytes)
    throw new Error('Malformed engine response length');
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    v.getUint32(p.headerFields.magic, true) !== p.magic ||
    v.getUint16(p.headerFields.major, true) !== p.abiMajor ||
    v.getUint32(p.headerFields.schema, true) !== p.schema ||
    v.getUint32(p.headerFields.length, true) !== bytes.length ||
    !(v.getUint16(p.headerFields.opcode, true) & 0x8000)
  )
    throw new Error('Incompatible engine response');
  const b = p.headerBytes,
    rows = v.getUint32(p.headerFields.count, true),
    eventCount = v.getUint32(b + p.stateFields.eventCount, true),
    blobCount = v.getUint32(b + p.stateFields.blobCount, true),
    blobBytes = v.getUint32(b + p.stateFields.blobBytes, true);
  if (
    rows > p.limits.nodes ||
    eventCount > p.limits.eventsPerPoll ||
    blobCount > p.limits.nodes * p.limits.nodeBlobs + p.limits.resources ||
    p.headerBytes + p.stateBytes + rows * p.nodeBytes + eventCount * p.eventBytes + blobBytes !==
      bytes.length
  )
    throw new Error('Malformed engine response tables');
  const u64 = (offset: number) => v.getBigUint64(b + offset, true);
  const u32 = (offset: number) => v.getUint32(b + offset, true);
  const nodes: EngineNodeSnapshot[] = [],
    events: EngineEvent[] = [];
  if (options.observationStream && eventCount)
    throw Error('Observation subscriptions cannot carry input events');
  let cursor = p.headerBytes + p.stateBytes;
  // Lazy App rows never retain a transport-owned/mutable caller buffer.
  const observationData =
    options.appObservation && rows
      ? options.ownedObservation
        ? v
        : new DataView(bytes.slice().buffer)
      : undefined;
  for (let i = 0; i < rows; ++i, cursor += p.nodeBytes) {
    if (observationData) {
      nodes.push(readObservationRow(observationData, cursor, finite));
      continue;
    }
    const f = (offset: number) => finite(v.getFloat64(cursor + offset, true));
    nodes.push({
      editing: null,
      layoutBuilder: null,
      snapshot: null,
      imagePaint: null,
      fontBinding: null,
      paragraph: null,
      graphics: null,
      clipStyle: null,
      layerComposition: null,
      nativePaint: null,
      control: null,
      list: null,
      textGeometry: null,
      semantics: null,
      semanticTraversal: null,
      hasFocus: !!(v.getUint32(cursor + 20, true) & 256),
      caretVisible: !!(v.getUint32(cursor + 20, true) & 512),
      node: readHandle(v, cursor),
      kind: v.getUint32(cursor + 8, true),
      parent: readHandle(v, cursor + 12),
      flags: v.getUint32(cursor + 20, true),
      x: f(24),
      y: f(32),
      width: f(40),
      height: f(48),
      matrix: Object.freeze(
        Array.from({ length: 6 }, (_, i) => f(p.nodeFields.matrix + i * 8)),
      ) as unknown as AffineMatrix,
      bounds: Object.freeze({
        x: f(p.nodeFields.boundsX),
        y: f(p.nodeFields.boundsY),
        width: f(p.nodeFields.boundsWidth),
        height: f(p.nodeFields.boundsHeight),
      }),
      depth: v.getUint32(cursor + p.nodeFields.depth, true),
      localOpacity: f(p.nodeFields.localOpacity),
      content: Object.freeze({
        x: f(p.nodeFields.contentX),
        y: f(p.nodeFields.contentY),
        width: f(p.nodeFields.contentWidth),
        height: f(p.nodeFields.contentHeight),
      }),
      offset: f(56),
      velocity: f(64),
      scrollRevision: v.getBigUint64(cursor + 72, true),
      opacity: f(80),
      motion: v.getBigUint64(cursor + 88, true),
      color: v.getUint32(cursor + p.nodeFields.color, true),
      order: v.getUint32(cursor + p.nodeFields.order, true),
      radius: f(p.nodeFields.radius),
      fontSize: f(p.nodeFields.fontSize),
      resource: readHandle(v, cursor + p.nodeFields.resource),
      baseline: f(p.nodeFields.baseline),
      layoutRevision: v.getBigUint64(cursor + p.nodeFields.layoutRevision, true),
      textDirection: v.getUint32(cursor + p.nodeFields.textDirection, true),
      requestedOffset: f(p.nodeFields.requestedOffset),
      scrollMinimum: f(p.nodeFields.scrollMinimum),
      scrollMaximum: f(p.nodeFields.scrollMaximum),
      deferred: !!(v.getUint32(cursor + 20, true) & 64),
      preparedCoverage:
        v.getUint32(cursor + 20, true) & 128
          ? Object.freeze({
              minimum: f(p.nodeFields.preparedMinimum),
              maximum: f(p.nodeFields.preparedMaximum),
              revision: v.getBigUint64(cursor + p.nodeFields.coverageRevision, true),
            })
          : null,
      clip: Object.freeze({
        x: f(p.nodeFields.clipX),
        y: f(p.nodeFields.clipY),
        width: f(p.nodeFields.clipWidth),
        height: f(p.nodeFields.clipHeight),
      }),
    });
  }
  for (let i = 0; i < eventCount; ++i, cursor += p.eventBytes) {
    const clipboardReadSnapshot =
      v.getUint32(cursor, true) === p.events.key
        ? v.getBigUint64(cursor + p.eventFields.clipboardReadSnapshot, true)
        : 0n;
    const focusPeer =
      v.getUint32(cursor, true) === p.events.focusChanged
        ? readHandle(v, cursor + p.eventFields.focusPeer)
        : undefined;
    if (focusPeer && !!focusPeer.slot !== !!focusPeer.generation) throw Error('Invalid focus peer');
    const flags = v.getUint32(cursor + p.eventFields.gestureFlags, true);
    if (flags & ~15) throw Error('Invalid gesture detail flags');
    let gesture: GestureDetails | undefined;
    if (flags & p.gestureDetailFlags.valid) {
      const pointerKind = Object.entries(p.pointerKinds).find(
        ([, value]) => value === v.getUint32(cursor + p.eventFields.pointerKind, true),
      )?.[0] as GestureDetails['pointerKind'] | undefined;
      const stream = v.getUint32(cursor + p.eventFields.stream, true),
        timestamp = finite(v.getFloat64(cursor + p.eventFields.timestamp, true));
      if (!pointerKind || stream > p.limits.streams || timestamp < 0)
        throw Error('Invalid gesture detail identity');
      const f = (field: keyof typeof p.eventFields) =>
        finite(v.getFloat64(cursor + p.eventFields[field], true));
      gesture = Object.freeze({
        pointerKind,
        stream,
        timestamp,
        flags,
        buttons: v.getUint32(cursor + p.eventFields.buttons, true),
        localX: f('localX'),
        localY: f('localY'),
        deltaX: f('deltaX'),
        deltaY: f('deltaY'),
        velocityX: f('velocityX'),
        velocityY: f('velocityY'),
        originX: f('originX'),
        originY: f('originY'),
        localOriginX: f('localOriginX'),
        localOriginY: f('localOriginY'),
      });
    }
    events.push(
      Object.freeze({
        ...(gesture ? { gesture } : {}),
        ...(focusPeer?.slot ? { focusPeer } : {}),
        ...(clipboardReadSnapshot ? { clipboardReadSnapshot } : {}),
        kind: v.getUint32(cursor, true),
        status: v.getUint32(cursor + 4, true),
        id: v.getBigUint64(cursor + 8, true),
        epoch: v.getBigUint64(cursor + 16, true),
        detail: v.getBigUint64(cursor + 24, true),
        node: readHandle(v, cursor + 32),
        x: finite(v.getFloat64(cursor + 40, true)),
        y: finite(v.getFloat64(cursor + 48, true)),
      }),
    );
  }
  let blobs: EngineBlob[] = [];
  for (let i = 0; i < blobCount; ++i) {
    if (cursor + 24 > bytes.length) throw new Error('Truncated engine blob');
    const type = v.getUint32(cursor, true),
      length = v.getUint32(cursor + 16, true);
    const stride = 24 + Math.ceil(length / 8) * 8;
    if (
      ![
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        p.layerCompositionBlob,
        p.paintPlacementBlob,
        p.fontUploadBlob,
        p.fontResourceChunkBlob,
        p.fontBindingBlob,
        p.fontTransitionBlob,
        p.imageUploadBlob,
        p.imageResourceChunkBlob,
        p.imageResourceBlob,
        p.imagePaintBlob,
        p.tapRegionEventBlob,
        p.semanticSourceEventBlob,
        p.snapshotStyleBlob,
        p.snapshotDecisionBlob,
        p.semanticRouteBlob,
        p.layoutBuilderBlob,
        p.layoutBuildRequestBlob,
        p.pointerEventBlob,
        p.semanticGeometryBlob,
        p.semanticTraversalBlob,
        p.keyIdentityEventBlob,
        p.observationDeltaBlob,
        p.observationReferencesBlob,
        p.observationRegistrationBlob,
      ].includes(type) ||
      stride > bytes.length - cursor ||
      v.getUint32(cursor + 4, true) ||
      v.getUint32(cursor + 20, true)
    )
      throw new Error('Invalid engine blob');
    blobs.push(
      Object.freeze({
        type,
        handle: readHandle(v, cursor + 8),
        bytes: bytes.slice(cursor + 24, cursor + 24 + length),
      }),
    );
    cursor += stride;
  }
  if (cursor !== bytes.length) throw new Error('Engine blob table length mismatch');
  const exposedBlobs = blobs;
  if (
    v.getUint16(p.headerFields.status, true) !== p.statuses.ok &&
    blobs.some((blob) => blob.type === p.observationDeltaBlob)
  )
    throw Error('Rejected observations must not update a subscription');
  const observation = blobs.some((blob) => blob.type === p.observationDeltaBlob)
    ? options.observationStream?.prepare(blobs, nodes)
    : undefined;
  if (
    !observation &&
    blobs.some((blob) =>
      (
        [
          p.observationDeltaBlob,
          p.observationReferencesBlob,
          p.observationRegistrationBlob,
        ] as readonly number[]
      ).includes(blob.type),
    )
  )
    throw Error('Observation delta requires an owner subscription');
  if (observation) blobs = observation.blobs;
  if (observation) {
    const { accepted, active, published } = observation.metadata.cohorts;
    if (
      accepted.document !== u64(p.stateFields.document) ||
      accepted.metrics !== u64(p.stateFields.metrics) ||
      accepted.device !== u64(p.stateFields.device) ||
      accepted.font !== u64(p.stateFields.fontRevision) ||
      active.document !== u64(p.stateFields.activeDocument) ||
      active.metrics !== u64(p.stateFields.layoutMetrics) ||
      active.preparation !== u64(p.stateFields.activePreparation) ||
      published.document !== u64(p.stateFields.publishedDocument) ||
      published.metrics !== u64(p.stateFields.publishedMetrics) ||
      published.device !== u64(p.stateFields.publishedDevice) ||
      published.publication !== u64(p.stateFields.publication)
    )
      throw Error('Observation metadata/rows have different consistency cohorts');
  }
  const decodeBlob = <T>(blob: EngineBlob, decode: (bytes: Uint8Array) => T): T => {
    const cache = options.observationCache;
    if (!cache) return decode(blob.bytes);
    return blob.registration
      ? cache.readRegistered(`${options.observationOwner}/${blob.registration}`, blob.bytes, decode)
      : cache.read(
          `${options.observationOwner}/${blob.type}/${blob.handle.slot}:${blob.handle.generation}`,
          blob.bytes,
          decode,
        );
  };
  const keyEvents = new Set<number>();
  for (const blob of blobs) {
    if (blob.type !== p.keyIdentityEventBlob) continue;
    if (blob.bytes.length < p.keyIdentityEventBytes)
      throw Error('Truncated keyboard identity event');
    const data = new DataView(blob.bytes.buffer, blob.bytes.byteOffset, blob.bytes.byteLength),
      index = data.getUint32(0, true),
      event = events[index];
    if (
      !event ||
      event.kind !== p.events.key ||
      keyEvents.has(index) ||
      blob.handle.slot !== event.node.slot ||
      blob.handle.generation !== event.node.generation ||
      data.getBigUint64(16, true) !== 0n
    )
      throw Error('Invalid keyboard identity event');
    const keyIdentity = readKeyIdentity(blob.bytes, p.keyIdentityEventBytes, 4);
    keyEvents.add(index);
    events[index] = Object.freeze({ ...event, keyIdentity });
  }
  const tapEvents = new Set<number>();
  const pointerEvents = new Set<number>();
  for (const blob of blobs) {
    if (blob.type !== p.pointerEventBlob) continue;
    if (blob.bytes.length !== p.pointerEventBytes) throw Error('Invalid pointer event size');
    const data = new DataView(blob.bytes.buffer, blob.bytes.byteOffset, blob.bytes.byteLength),
      index = data.getUint32(0, true),
      event = events[index];
    if (
      !event ||
      event.kind !== p.events.pointer ||
      pointerEvents.has(index) ||
      data.getUint32(4, true) ||
      blob.handle.slot !== event.node.slot ||
      blob.handle.generation !== event.node.generation
    )
      throw Error('Invalid pointer event identity');
    const sample = readInputSample(data, 8),
      inverse = Object.freeze(
        Array.from({ length: 6 }, (_, i) =>
          finite(data.getFloat64(8 + p.inputBytes + i * 8, true)),
        ),
      ) as unknown as AffineMatrix;
    if (
      sample.sequence !== event.id ||
      sample.x !== event.x ||
      sample.y !== event.y ||
      !sample.publication
    )
      throw Error('Invalid pointer event sample');
    pointerEvents.add(index);
    events[index] = Object.freeze({ ...event, pointer: Object.freeze({ ...sample, inverse }) });
  }
  if (events.some((event, index) => event.kind === p.events.pointer && !pointerEvents.has(index)))
    throw Error('Missing pointer event sample');
  const semanticSources = new Set<number>();
  for (const blob of blobs)
    if (blob.type === p.semanticSourceEventBlob) {
      if (blob.bytes.length !== p.semanticSourceEventBytes)
        throw Error('Invalid semantic source event size');
      const data = new DataView(blob.bytes.buffer, blob.bytes.byteOffset, blob.bytes.byteLength),
        index = data.getUint32(0, true),
        event = events[index],
        source = readHandle(data, 8);
      if (
        !event ||
        event.kind !== p.events.semanticAction ||
        semanticSources.has(index) ||
        data.getUint32(4, true) ||
        blob.handle.slot !== event.node.slot ||
        blob.handle.generation !== event.node.generation ||
        !source.slot ||
        !source.generation ||
        (source.slot === event.node.slot && source.generation === event.node.generation)
      )
        throw Error('Invalid semantic source event identity');
      semanticSources.add(index);
      events[index] = Object.freeze({ ...event, semanticSource: source });
    }
  for (const blob of blobs)
    if (blob.type === p.tapRegionEventBlob) {
      if (blob.bytes.length !== p.tapRegionEventBytes) throw Error('Invalid TapRegion event size');
      const data = new DataView(blob.bytes.buffer, blob.bytes.byteOffset, blob.bytes.byteLength),
        index = data.getUint32(0, true),
        event = events[index],
        surface = readHandle(data, 16),
        semanticTarget = readHandle(data, 24),
        batch = data.getBigUint64(8, true);
      if (
        !event ||
        tapEvents.has(index) ||
        !batch ||
        blob.handle.slot !== event.node.slot ||
        blob.handle.generation !== event.node.generation ||
        !!surface.slot !== !!surface.generation ||
        !!semanticTarget.slot !== !!semanticTarget.generation ||
        (event.kind === p.events.tapRegion
          ? !surface.slot || !event.gesture || event.status < 1 || event.status > 4
          : event.kind !== p.events.semanticAction ||
            surface.slot !== 0 ||
            semanticTarget.slot !== 0)
      )
        throw Error('Invalid TapRegion event identity');
      tapEvents.add(index);
      const inverse = Object.freeze(
        Array.from({ length: 6 }, (_, i) => finite(data.getFloat64(32 + i * 8, true))),
      ) as unknown as AffineMatrix;
      events[index] = Object.freeze({
        ...event,
        tapRegion: Object.freeze({
          batch,
          surface,
          semanticTarget,
          device: data.getUint32(4, true),
          inverse,
        }),
      });
    }
  for (const event of events)
    if (event.kind === p.events.tapRegion && !event.tapRegion)
      throw Error('Missing TapRegion event geometry');
  const samples = (type: number): readonly RawInputSample[] =>
    Object.freeze(
      blobs
        .filter((blob) => blob.type === type)
        .map((blob) => {
          if (blob.bytes.length !== 8 + p.inputBytes) throw new Error('Invalid raw input length');
          const d = new DataView(blob.bytes.buffer, blob.bytes.byteOffset, blob.bytes.byteLength),
            b = 8;
          const phase = Object.entries(p.phases).find(
            ([, value]) => value === d.getUint32(b + 28, true),
          )?.[0] as InputPacket['phase'] | undefined;
          const source = Object.entries(p.sources).find(
            ([, value]) => value === d.getUint32(b + 32, true),
          )?.[0] as InputPacket['source'] | undefined;
          const kind = Object.entries(p.pointerKinds).find(
            ([, value]) => value === d.getUint32(b + p.inputFields.kind, true),
          )?.[0] as NonNullable<InputPacket['kind']> | undefined;
          if (!phase || !source || !kind) throw new Error('Invalid raw input enum');
          const number = (offset: number) => finite(d.getFloat64(b + offset, true));
          return Object.freeze({
            node: blob.handle,
            subscription: d.getBigUint64(0, true),
            sequence: d.getBigUint64(b, true),
            metrics: d.getBigUint64(b + 8, true),
            target: readHandle(d, b + 16),
            stream: d.getUint32(b + 24, true),
            phase,
            source,
            pointer: !!(d.getUint32(b + 36, true) & 2),
            hover: !!(d.getUint32(b + 36, true) & 4),
            time: number(40),
            sample: number(48),
            x: number(56),
            y: number(64),
            dx: number(72),
            dy: number(80),
            velocity: number(88),
            clock: d.getUint32(b + 96, true),
            buttons: d.getUint32(b + 100, true),
            modifiers: d.getUint32(b + 104, true),
            device: d.getUint32(b + 108, true),
            contact: d.getUint32(b + 112, true),
            kind,
            publication: d.getBigUint64(b + 120, true),
          });
        }),
    );
  // Group once by the complete generational handle. Scanning every blob for
  // every node made each publication/layout observation quadratic on Hermes.
  const nodeKey = (handle: NodeHandle) => `${handle.slot}:${handle.generation}`;
  const nodeHandles = observation?.handles ?? new Set(nodes.map((node) => nodeKey(node.node)));
  const nodeBlobs = new Map<string, EngineBlob[]>();
  for (const blob of blobs) {
    if (blob.type < 3) continue;
    const key = nodeKey(blob.handle),
      group = nodeBlobs.get(key);
    if (group) group.push(blob);
    else nodeBlobs.set(key, [blob]);
  }
  for (const blob of blobs)
    if (
      (blob.type === p.layoutBuilderBlob ||
        blob.type === p.semanticGeometryBlob ||
        blob.type === p.semanticTraversalBlob) &&
      !nodeHandles.has(nodeKey(blob.handle))
    )
      throw Error('Foreign layout/semantics geometry owner');
  const changedRows = nodes.map((node): EngineNodeSnapshot => {
    if (observationData && !nodeBlobs.has(nodeKey(node.node))) return Object.freeze(node);
    let semanticGeometry: EngineNodeSnapshot['semanticGeometry'] = null;
    let semanticTraversal: EngineNodeSnapshot['semanticTraversal'] = null;
    let layoutBuilder: LayoutBuilderOptions | null = null;
    let snapshot: NativeSnapshotConfiguration | null = null;
    let editing: EditingSnapshot | null = null,
      textGeometry: TextGeometry | null = null,
      semantics: SemanticSnapshot | null = null,
      list: ListSnapshot | null = null,
      control: ControlSnapshot | null = null;
    let imagePaint: ImagePaintSnapshot | null = null;
    let paintPlacement: PaintPlacementOptions | null = null;
    let fontBinding: FontResourceBinding | null = null;
    let nativePaint: readonly NativePaintSnapshot[] | null = null;
    let layerComposition: LayerCompositionSnapshot | null = null;
    let graphics: GraphicsSnapshot | null = null,
      clipStyle: ClipStyleSnapshot | null = null,
      paragraph: ParagraphSnapshot | null = null;
    for (const blob of nodeBlobs.get(nodeKey(node.node)) ?? []) {
      const d = new DataView(blob.bytes.buffer, blob.bytes.byteOffset, blob.bytes.byteLength),
        size = blob.bytes.length;
      if (blob.type === p.semanticTraversalBlob) {
        if (semanticTraversal || size < p.semanticTraversalBytes || d.getBigUint64(16, true))
          throw Error('Invalid semantics traversal');
        const count = d.getUint32(12, true);
        if (
          count > p.limits.semanticsCustomActions ||
          size !== p.semanticTraversalBytes + count * p.semanticCustomSourceBytes
        )
          throw Error('Invalid semantics custom sources');
        const parent = readHandle(d, 0),
          index = d.getUint32(8, true);
        if (
          index >= p.limits.semanticsNodes ||
          (!parent.slot && parent.generation) ||
          (parent.slot && (!parent.generation || !nodeHandles.has(nodeKey(parent))))
        )
          throw Error('Foreign semantics traversal parent/index');
        const customSources: { readonly id: number; readonly source: NodeHandle }[] = [];
        for (let i = 0; i < count; ++i) {
          const at = p.semanticTraversalBytes + i * p.semanticCustomSourceBytes,
            id = d.getUint32(at, true),
            source = readHandle(d, at + 8);
          if (
            d.getUint32(at + 4, true) ||
            customSources.some((entry) => entry.id === id) ||
            !nodeHandles.has(nodeKey(source))
          )
            throw Error('Foreign/duplicate semantics custom source');
          customSources.push(Object.freeze({ id, source }));
        }
        semanticTraversal = Object.freeze({
          parent,
          index,
          customSources: Object.freeze(customSources),
        });
      }
      if (blob.type === p.semanticGeometryBlob) {
        if (
          semanticGeometry ||
          size !== p.semanticGeometryBytes ||
          !u64(p.stateFields.publication) ||
          (v.getUint16(p.headerFields.opcode, true) & 0x7fff) !== p.opcodes.semanticsSnapshot
        )
          throw Error('Invalid semantics geometry publication');
        const value = (at: number) => finite(d.getFloat64(at, true)),
          width = value(32),
          height = value(40),
          boundsWidth = value(16),
          boundsHeight = value(24);
        if (width < 0 || height < 0 || boundsWidth < 0 || boundsHeight < 0)
          throw Error('Invalid semantics geometry size');
        semanticGeometry = Object.freeze({
          bounds: Object.freeze({
            x: value(0),
            y: value(8),
            width: boundsWidth,
            height: boundsHeight,
          }),
          width,
          height,
          x: value(96),
          y: value(104),
          matrix: Object.freeze([
            value(48),
            value(56),
            value(64),
            value(72),
            value(80),
            value(88),
          ]) as AffineMatrix,
        });
      }
      if (blob.type === p.layoutBuilderBlob) {
        if (layoutBuilder || (node.kind !== p.kinds.box && node.kind !== p.kinds.sliver))
          throw Error('Duplicate/foreign layout builder');
        layoutBuilder = readLayoutBuilder(blob.bytes);
      }
      if (blob.type === p.snapshotStyleBlob) {
        if (snapshot || node.kind !== p.kinds.box) throw Error('Duplicate/foreign snapshot style');
        snapshot = readSnapshotStyle(blob.bytes);
      }
      if (blob.type === p.imagePaintBlob) {
        if (imagePaint || node.kind !== p.kinds.image) throw Error('Duplicate/foreign image paint');
        imagePaint = readImagePaint(blob.bytes);
      }
      if (blob.type === p.fontBindingBlob) {
        if (fontBinding || (node.kind !== p.kinds.paragraph && node.kind !== p.kinds.editable))
          throw Error('Duplicate/foreign paragraph font binding');
        fontBinding = readFontBinding(blob.bytes);
      }
      if (blob.type === p.layerCompositionBlob) {
        if (layerComposition || size !== p.layerCompositionBytes)
          throw Error('Invalid layer composition snapshot');
        const observation = (at: number) => {
          const value = d.getFloat64(at, true);
          if (!Number.isFinite(value)) throw RangeError('Invalid layer composition scalar');
          return value;
        };
        const role = d.getUint32(0, true),
          flags = d.getUint32(4, true),
          leader = readHandle(d, 8),
          matrix = Array.from({ length: 6 }, (_, i) => observation(16 + i * 8)),
          x = observation(64),
          y = observation(72);
        if (
          (role !== 1 && role !== 2) ||
          flags & ~7 ||
          (flags & 2 && !(flags & 1)) ||
          !!leader.slot !== !!leader.generation ||
          !!leader.slot !== !!(flags & 1) ||
          (role === 1 && flags) ||
          (!(flags & 2) && matrix.some((v) => v !== 0)) ||
          (!(flags & 1) && (x !== 0 || y !== 0))
        )
          throw Error('Invalid layer composition values');
        layerComposition = Object.freeze({
          kind: role === 1 ? 'leader' : 'follower',
          leader,
          linked: !!(flags & 1),
          showWhenUnlinked: !!(flags & p.layerCompositionFlags.showWhenUnlinked),
          transform: flags & 2 ? (Object.freeze(matrix) as unknown as AffineMatrix) : null,
          linkedOffset: Object.freeze({ x, y }),
        });
        continue;
      }
      if (blob.type === p.paintPlacementBlob) {
        if (paintPlacement) throw Error('Duplicate paragraph paint placement');
        paintPlacement = readPaintPlacement(blob.bytes);
        continue;
      }
      if (blob.type === 13) {
        if (nativePaint) throw Error('Duplicate native paint snapshot');
        nativePaint = readNativePaint(blob.bytes);
      }
      if (blob.type === 12) {
        if (clipStyle || node.kind !== p.kinds.clip)
          throw Error('Invalid duplicate or non-clip style');
        clipStyle = readClipStyle(blob.bytes);
        continue;
      }
      if (blob.type === 11) {
        if (paragraph) throw Error('Duplicate paragraph options');
        paragraph = decodeBlob(blob, readParagraphOptions);
        continue;
      }
      if (blob.type === 10) {
        if (
          size < p.graphicsBytes ||
          d.getUint32(p.graphicsFields.flags, true) > 15 ||
          d.getUint32(p.graphicsFields.pathCount, true) > p.limits.pathCommands ||
          size !==
            p.graphicsBytes + d.getUint32(p.graphicsFields.pathCount, true) * p.graphicsPathBytes
        )
          throw new Error('Invalid graphics record');
        const flags = d.getUint32(p.graphicsFields.flags, true),
          origin = Object.freeze({
            x: finite(d.getFloat64(p.graphicsFields.originX, true)),
            y: finite(d.getFloat64(p.graphicsFields.originY, true)),
          }),
          alignment = Object.freeze({
            x: finite(d.getFloat64(p.graphicsFields.alignmentX, true)),
            y: finite(d.getFloat64(p.graphicsFields.alignmentY, true)),
          });
        if (
          (!(flags & p.graphicsFlags.hasOrigin) && (origin.x || origin.y)) ||
          (!(flags & p.graphicsFlags.hasAlignment) && (alignment.x || alignment.y))
        )
          throw new Error('Invalid graphics pivot flags');
        const path: PathSegment[] = [];
        const verbs = ['', 'move', 'line', 'quad', 'cubic', 'close'] as const;
        for (let i = 0; i < d.getUint32(p.graphicsFields.pathCount, true); ++i) {
          const at = p.graphicsBytes + i * p.graphicsPathBytes,
            verb = d.getUint32(at, true);
          if (verb < 1 || verb > 5 || d.getUint32(at + 4, true))
            throw new Error('Invalid graphics verb');
          const count = verb <= 2 ? 2 : verb === 3 ? 4 : verb === 4 ? 6 : 0;
          path.push(
            Object.freeze([
              verbs[verb],
              ...Array.from({ length: count }, (_, j) =>
                finite(d.getFloat64(at + 8 + j * 8, true)),
              ),
            ]) as PathSegment,
          );
        }
        graphics = Object.freeze({
          ...(flags & p.graphicsFlags.hasOrigin ? { origin } : {}),
          ...(flags & p.graphicsFlags.hasAlignment ? { alignment } : {}),
          transform: Object.freeze(
            Array.from({ length: 6 }, (_, i) => finite(d.getFloat64(i * 8, true))),
          ) as unknown as AffineMatrix,
          path: Object.freeze(path),
          hasPath: !!(d.getUint32(96, true) & 2),
          fillRule: d.getUint32(96, true) & 1 ? 'evenOdd' : 'winding',
          shadow: Object.freeze({
            x: finite(d.getFloat64(48, true)),
            y: finite(d.getFloat64(56, true)),
            sigma: finite(d.getFloat64(64, true)),
            color: d.getUint32(72, true),
          }),
          stroke: Object.freeze({
            width: finite(d.getFloat64(80, true)),
            color: d.getUint32(76, true),
          }),
          blur: finite(d.getFloat64(88, true)),
        });
      }
      const rect = (o: number): TextRect => {
        const r = {
          x: finite(d.getFloat64(o, true)),
          y: finite(d.getFloat64(o + 8, true)),
          width: finite(d.getFloat64(o + 16, true)),
          height: finite(d.getFloat64(o + 24, true)),
        };
        if (r.width < 0 || r.height < 0) throw new Error('Invalid text geometry');
        return Object.freeze(r);
      };
      if (blob.type === 3) {
        if (semantics || size < p.semanticsBytes || !(d.getUint32(80, true) & 1))
          throw Error('Invalid semantics blob');
        semantics = decodeBlob(blob, readSemanticBody);
      } else if (blob.type === 4) {
        if (editing || size < 48 || d.getUint32(44, true) || size !== 48 + d.getUint32(40, true))
          throw new Error('Invalid editing blob');
        editing = Object.freeze({
          revision: d.getBigUint64(0, true),
          serial: d.getBigUint64(8, true),
          text: decodeUtf8(blob.bytes.subarray(48)),
          base: d.getInt32(16, true),
          extent: d.getInt32(20, true),
          composingStart: d.getInt32(24, true),
          composingEnd: d.getInt32(28, true),
          flags: d.getUint32(32, true),
          maximumLength: d.getUint32(36, true),
        });
      } else if (blob.type === 5) {
        if (
          textGeometry ||
          size < 48 ||
          d.getUint32(44, true) ||
          d.getUint32(40, true) > p.limits.selectionRects ||
          size !== 48 + d.getUint32(40, true) * 32
        )
          throw new Error('Invalid text geometry blob');
        const selection = Array.from({ length: d.getUint32(40, true) }, (_, i) =>
          rect(48 + i * 32),
        );
        textGeometry = Object.freeze({
          revision: d.getBigUint64(0, true),
          caret: rect(8),
          selection: Object.freeze(selection),
        });
      } else if (blob.type === 6) {
        if (size < 64) throw Error('Invalid list snapshot');
        const rows = d.getUint32(28, true),
          header = size === 72 + rows * 40 ? 72 : 64;
        if (
          list ||
          node.kind !== p.kinds.sliver ||
          rows > p.limits.listChildren ||
          size !== header + rows * 40 ||
          (header === 72 &&
            ((d.getUint32(64, true) !== p.listFlags.fixedExtent &&
              d.getUint32(64, true) !== p.listFlags.sequential) ||
              d.getUint32(68, true)))
        )
          throw new Error('Invalid list snapshot');
        list = Object.freeze({
          fixed: header === 72 && d.getUint32(64, true) === p.listFlags.fixedExtent,
          sequential: header === 72 && d.getUint32(64, true) === p.listFlags.sequential,
          generation: d.getBigUint64(0, true),
          count: d.getUint32(8, true),
          begin: d.getUint32(12, true),
          end: d.getUint32(16, true),
          demandBegin: d.getUint32(20, true),
          demandEnd: d.getUint32(24, true),
          estimate: finite(d.getFloat64(32, true)),
          total: finite(d.getFloat64(40, true)),
          preparedBegin: finite(d.getFloat64(48, true)),
          preparedEnd: finite(d.getFloat64(56, true)),
          items: Object.freeze(
            Array.from({ length: d.getUint32(28, true) }, (_, i) => {
              const at = header + i * 40;
              if (d.getUint32(at + 12, true)) throw new Error('Invalid list row');
              return Object.freeze({
                node: readHandle(d, at),
                index: d.getUint32(at + 8, true),
                key: d.getBigUint64(at + 16, true),
                offset: finite(d.getFloat64(at + 24, true)),
                extent: finite(d.getFloat64(at + 32, true)),
              });
            }),
          ),
        });
        if (
          !list.generation ||
          list.count > 1_000_000 ||
          list.begin > list.end ||
          list.end > list.count ||
          list.end - list.begin > p.limits.listChildren ||
          list.demandBegin > list.demandEnd ||
          list.demandEnd > list.count ||
          (list.sequential ? list.estimate < 0 : list.estimate <= 0) ||
          list.total < 0 ||
          list.preparedBegin < 0 ||
          list.preparedEnd < list.preparedBegin ||
          list.preparedEnd > list.total
        )
          throw Error('Invalid list snapshot bounds');
        const indices = new Set<number>(),
          keys = new Set<bigint>();
        for (const row of list.items) {
          if (
            !row.node.slot ||
            !row.node.generation ||
            row.node.slot > p.limits.nodes ||
            row.index >= list.count ||
            !row.key ||
            indices.has(row.index) ||
            keys.has(row.key) ||
            row.offset < 0 ||
            row.offset > list.total ||
            row.extent < 0
          )
            throw Error('Invalid list snapshot row');
          indices.add(row.index);
          keys.add(row.key);
        }
      } else if (blob.type === 7) {
        if (
          control ||
          size !== 72 ||
          d.getUint32(20, true) ||
          d.getUint32(0, true) > p.controlKinds.activity ||
          d.getUint32(8, true) & ~3
        )
          throw new Error('Invalid control snapshot');
        control = Object.freeze({
          kind: d.getUint32(0, true),
          disabled: !!(d.getUint32(4, true) & 1),
          appearance: d.getUint32(4, true) >>> 1,
          pressed: !!(d.getUint32(8, true) & 1),
          hovered: !!(d.getUint32(8, true) & 2),
          foreground: d.getUint32(12, true),
          track: d.getUint32(16, true),
          revision: d.getBigUint64(64, true),
          minimum: finite(d.getFloat64(24, true)),
          maximum: finite(d.getFloat64(32, true)),
          step: finite(d.getFloat64(40, true)),
          value: finite(d.getFloat64(48, true)),
          second: finite(d.getFloat64(56, true)),
        });
      }
    }
    if (
      fontBinding?.pinned &&
      (!paintPlacement || fontBinding.fontRevision !== paintPlacement.fontRevision)
    )
      throw Error('Pinned paragraph font revision differs from its recording');
    // This row is private until response() returns. Enrich it in place and
    // freeze once instead of copying every base field into a second object.
    return Object.freeze(
      Object.assign(node, {
        layoutBuilder,
        snapshot,
        editing,
        textGeometry,
        semantics,
        semanticTraversal,
        semanticGeometry,
        list,
        control,
        graphics,
        nativePaint,
        imagePaint,
        paintPlacement,
        fontBinding,
        layerComposition,
        clipStyle,
        paragraph,
      }),
    );
  });
  const enriched = observation ? observation.merge(changedRows) : Object.freeze(changedRows);
  let semanticNodes: Map<string, EngineNodeSnapshot> | undefined;
  const semanticNode = (handle: NodeHandle): EngineNodeSnapshot | undefined => {
    if (!semanticNodes) {
      semanticNodes = new Map();
      for (const node of enriched) semanticNodes.set(nodeKey(node.node), node);
    }
    return semanticNodes.get(nodeKey(handle));
  };
  const traversalIndices = new Set<number>();
  for (const node of observation &&
  !observation.metadata.full &&
  !observation.metadata.changedRows &&
  !observation.metadata.removedRows
    ? []
    : enriched)
    if (node.semanticTraversal) {
      const traversal = node.semanticTraversal;
      if (
        !node.semantics ||
        node.semantics.flags & p.semanticsFlags.hidden ||
        traversalIndices.has(traversal.index)
      )
        throw Error('Duplicate/hidden semantics traversal');
      traversalIndices.add(traversal.index);
      for (const entry of traversal.customSources) {
        if (
          !(node.semantics.actions & p.semanticsActions.custom) ||
          !node.semantics.customActions?.some(
            (action) => action.id === entry.id && action.invokable,
          )
        )
          throw Error('Unadvertised semantics custom source');
        let source = semanticNode(entry.source);
        let depth = 0;
        while (
          source &&
          (source.node.slot !== node.node.slot || source.node.generation !== node.node.generation)
        ) {
          if (++depth > p.limits.depth) throw Error('Cyclic custom semantics source');
          const parent = source.parent;
          source = semanticNode(parent);
        }
        if (!source) throw Error('Foreign custom semantics source ancestor');
      }
      if (traversal.parent.slot) {
        const parent = semanticNode(traversal.parent);
        if (!parent?.semanticTraversal || parent.semanticTraversal.index >= traversal.index)
          throw Error('Cyclic or unordered semantics traversal');
      }
    }
  const flags = u32(p.stateFields.flags),
    commit = u64(p.stateFields.surfaceCommit);
  const buildRequests = blobs.filter((blob) => blob.type === p.layoutBuildRequestBlob);
  let layoutBuildRequest: LayoutBuildRequest | null = null;
  if (buildRequests.length) {
    if (
      buildRequests.length !== 1 ||
      v.getUint16(p.headerFields.status, true) !== p.statuses.ok ||
      !(flags & p.layoutBuildPending) ||
      !(flags & 2) ||
      flags & 1
    )
      throw Error('Invalid layout build request state');
    layoutBuildRequest = readLayoutBuildRequest(buildRequests[0]!.bytes, buildRequests[0]!.handle);
    if (
      layoutBuildRequest.preparation !== u64(p.stateFields.preparation) ||
      layoutBuildRequest.document !== u64(p.stateFields.document) ||
      layoutBuildRequest.document !== u64(p.stateFields.preparationDocument) ||
      layoutBuildRequest.metrics !== u64(p.stateFields.metrics) ||
      layoutBuildRequest.device !== u64(p.stateFields.device)
    )
      throw Error('Stale layout build request');
  }
  const decisions = blobs.filter((blob) => blob.type === p.snapshotDecisionBlob);
  if (
    decisions.length > 1 ||
    (decisions.length &&
      (v.getUint16(p.headerFields.opcode, true) & 0x7fff) !== p.opcodes.snapshotPaint)
  )
    throw Error('Duplicate/foreign snapshot decision');
  const snapshotDecision = decisions.length ? readSnapshotDecision(decisions[0]!.bytes) : null;
  const routes = blobs.filter((blob) => blob.type === p.semanticRouteBlob);
  let semanticRoute: EngineResponse['semanticRoute'] = null;
  if (routes.length) {
    const blob = routes[0]!;
    if (
      routes.length !== 1 ||
      (v.getUint16(p.headerFields.opcode, true) & 0x7fff) !== p.opcodes.semanticsSnapshot ||
      v.getUint16(p.headerFields.status, true) !== p.statuses.ok ||
      !(flags & 2) ||
      flags & 1 ||
      !u64(p.stateFields.publication) ||
      u64(p.stateFields.publishedMetrics) !== u64(p.stateFields.metrics) ||
      u64(p.stateFields.publishedDevice) !== u64(p.stateFields.device) ||
      blob.handle.slot ||
      blob.handle.generation ||
      blob.bytes.length < p.semanticRouteBytes
    )
      throw Error('Invalid semantic route publication');
    const data = new DataView(blob.bytes.buffer, blob.bytes.byteOffset, blob.bytes.byteLength),
      sequence = data.getBigUint64(0, true),
      scope = readHandle(data, 8),
      name = readHandle(data, 16),
      length = data.getUint32(24, true);
    if (
      data.getUint32(28, true) ||
      length > p.limits.semanticsTextBytes ||
      p.semanticRouteBytes + length !== blob.bytes.length ||
      !!scope.slot !== !!scope.generation ||
      !!name.slot !== !!name.generation ||
      (!scope.slot && name.slot) ||
      !!name.slot !== !!length ||
      (scope.slot && !sequence)
    )
      throw Error('Invalid semantic route data');
    const label = decodeUtf8(blob.bytes.subarray(p.semanticRouteBytes)),
      same = (a: NodeHandle, b: NodeHandle) => a.slot === b.slot && a.generation === b.generation,
      scopeNode = semanticNode(scope),
      nameNode = semanticNode(name);
    if (
      scope.slot &&
      (!scopeNode?.semantics ||
        !(scopeNode.semantics.flags & p.semanticsFlags.scopesRoute) ||
        scopeNode.semantics.flags & p.semanticsFlags.hidden)
    )
      throw Error('Invalid semantic route scope');
    if (name.slot) {
      if (
        !nameNode?.semantics ||
        !(nameNode.semantics.flags & p.semanticsFlags.namesRoute) ||
        nameNode.semantics.flags & p.semanticsFlags.hidden ||
        nameNode.semantics.label !== label
      )
        throw Error('Invalid semantic route name');
      let at: EngineNodeSnapshot | undefined = nameNode,
        found = false;
      for (let depth = 0; at && depth <= p.limits.depth; ++depth) {
        if (same(at.node, scope)) {
          found = true;
          break;
        }
        const parent: NodeHandle = at.parent;
        at = semanticNode(parent);
      }
      if (!found) throw Error('Semantic route name outside scope');
    }
    semanticRoute = Object.freeze({
      sequence,
      scope: scope.slot ? scope : null,
      name: name.slot ? name : null,
      label,
    });
  }
  const viewportWidth = finite(v.getFloat64(b + p.stateFields.viewportWidth, true)),
    viewportHeight = finite(v.getFloat64(b + p.stateFields.viewportHeight, true)),
    viewportScale = finite(v.getFloat64(b + p.stateFields.viewportScale, true));
  if (
    viewportWidth < 0 ||
    viewportHeight < 0 ||
    viewportScale < 0 ||
    viewportScale > 16 ||
    (!viewportScale && (viewportWidth || viewportHeight || u64(p.stateFields.metrics)))
  )
    throw new Error('Invalid engine viewport observation');
  const result: EngineResponse = Object.freeze({
    layoutBuildPending: !!(flags & p.layoutBuildPending),
    transactionCost: Object.freeze({
      nodeClones: u64(p.stateFields.transactionNodeClones),
      slotPages: u64(p.stateFields.transactionSlotPages),
      directories: u64(p.stateFields.transactionDirectories),
      childLists: u64(p.stateFields.transactionChildLists),
      fullValidations: u64(p.stateFields.transactionFullValidations),
      incrementalValidations: u64(p.stateFields.transactionIncrementalValidations),
      validationVisits: u64(p.stateFields.transactionValidationVisits),
      siblingVisits: u64(p.stateFields.transactionSiblingVisits),
      blobRegistrations: u64(p.stateFields.transactionBlobRegistrations),
      blobBindings: u64(p.stateFields.transactionBlobBindings),
      blobBytes: u64(p.stateFields.transactionBlobBytes),
    }),
    layoutBuildRequest,
    semanticRoute,
    snapshotDecision,
    fontTransition: readFontTransition(blobs),
    memory: Object.freeze({
      total: u64(p.stateFields.memoryTotal),
      peak: u64(p.stateFields.memoryPeak),
      cpu: u64(p.stateFields.memoryCpu),
      gpu: u64(p.stateFields.memoryGpu),
      staging: u64(p.stateFields.memoryStaging),
      engineHeap: u64(p.stateFields.engineHeap),
      providerHeap: u64(p.stateFields.providerHeap),
      rejected: u64(p.stateFields.memoryRejected),
      limit: u64(p.stateFields.memoryLimit),
    }),
    rawInputs: samples(8),
    gestureRequests: samples(9),
    focus: u64(p.stateFields.focusSession)
      ? Object.freeze({
          node: readHandle(v, b + p.stateFields.focusNode),
          peer: u32(p.stateFields.focusPeer) ? readHandle(v, b + p.stateFields.focusPeer) : null,
          session: u64(p.stateFields.focusSession),
        })
      : null,
    interactionCount: u32(p.stateFields.interactionCount),
    editingWork: u64(p.stateFields.editingWork),
    semanticsWork: u64(p.stateFields.semanticsWork),
    queryWork: u64(p.stateFields.queryWork),
    gestureWork: u64(p.stateFields.gestureWork),
    controlWork: u64(p.stateFields.controlWork),
    publishedDocument: u64(p.stateFields.publishedDocument),
    publishedMetrics: u64(p.stateFields.publishedMetrics),
    publishedDevice: u64(p.stateFields.publishedDevice),
    keyWork: u64(p.stateFields.keyWork),
    focusWork: u64(p.stateFields.focusWork),
    framePaintWork: u64(p.stateFields.framePaintWork),
    framePaintNodes: u64(p.stateFields.framePaintNodes),
    framePlacementNodes: u64(p.stateFields.framePlacementNodes),
    layoutQuery: u64(p.stateFields.queryId)
      ? Object.freeze({
          id: u64(p.stateFields.queryId),
          document: u64(p.stateFields.queryDocument),
          metrics: u64(p.stateFields.queryMetrics),
          font: u64(p.stateFields.queryFont),
          status: u32(p.stateFields.queryStatus),
          mode: u32(p.stateFields.queryMode),
          width: finite(v.getFloat64(b + p.stateFields.queryWidth, true)),
          height: finite(v.getFloat64(b + p.stateFields.queryHeight, true)),
          baseline: finite(v.getFloat64(b + p.stateFields.queryBaseline, true)),
          value: finite(v.getFloat64(b + p.stateFields.queryValue, true)),
        })
      : null,
    measurePreparation: u64(p.stateFields.measurePreparation),
    measureDocument: u64(p.stateFields.measureDocument),
    status: v.getUint16(p.headerFields.status, true),
    opcode: v.getUint16(p.headerFields.opcode, true) & 0x7fff,
    owner: Object.freeze({
      session: v.getUint32(p.headerFields.session, true),
      app: v.getUint32(p.headerFields.app, true),
      view: v.getUint32(p.headerFields.view, true),
      generation: v.getUint32(p.headerFields.generation, true),
    }),
    id: v.getBigUint64(p.headerFields.id, true),
    resultEpoch: v.getBigUint64(p.headerFields.base, true),
    document: u64(p.stateFields.document),
    activeDocument: u64(p.stateFields.activeDocument),
    scene: u64(p.stateFields.scene),
    preparation: u64(p.stateFields.preparation),
    metrics: u64(p.stateFields.metrics),
    viewport: viewportScale
      ? Object.freeze({ width: viewportWidth, height: viewportHeight, scale: viewportScale })
      : null,
    property: u64(p.stateFields.property),
    consumedThrough: u64(p.stateFields.consumedThrough),
    received: u64(p.stateFields.received),
    consumed: u64(p.stateFields.consumed),
    canceled: u64(p.stateFields.canceled),
    rejected: u64(p.stateFields.rejected),
    duplicates: u64(p.stateFields.duplicates),
    queued: u32(p.stateFields.queued),
    holds: u32(p.stateFields.holds),
    pendingDocument: u64(p.stateFields.pendingDocument),
    reservedBytes: u64(p.stateFields.reservedBytes),
    resourceBytes: u64(p.stateFields.resourceBytes),
    nodeBlocks: u64(p.stateFields.nodeBlocks),
    submission: u64(p.stateFields.submission),
    publication: u64(p.stateFields.publication),
    surfaceCommit: commit === 0n ? null : commit,
    submitted: u64(p.stateFields.submitted),
    ticks: u64(p.stateFields.ticks),
    activated: u64(p.stateFields.activated),
    device: u64(p.stateFields.device),
    nodeCount: u32(p.stateFields.nodeCount),
    closed: !!(flags & 1),
    visible: !!(flags & 2),
    focused: !!(flags & 4),
    canonicalKeyboard: !!(flags & 256),
    wake: !!(flags & 8),
    preparationReady: !!(flags & 16),
    sharedMemory: !!(flags & 32),
    contentIndependent: !!(flags & 64),
    capabilities: u32(p.stateFields.capabilities),
    pendingPublication: u64(p.stateFields.pendingPublication),
    lastInput: u64(p.stateFields.lastInput),
    lastTransaction: u64(p.stateFields.lastTransaction),
    acknowledged: u64(p.stateFields.acknowledged),
    activePreparation: u64(p.stateFields.activePreparation),
    failedDocument: u64(p.stateFields.failedDocument),
    sessionQueued: u32(p.stateFields.sessionQueued),
    sessionUpdates: u32(p.stateFields.sessionUpdates),
    nextDeadline: v.getFloat64(b + p.stateFields.nextDeadline, true) || null,
    providerPending: !!u32(p.stateFields.providerPending),
    transactionWork: u64(p.stateFields.transactionWork),
    contentWork: u64(p.stateFields.contentWork),
    contentOwner: u64(p.stateFields.contentOwner),
    renderOwner: u64(p.stateFields.renderOwner),
    preparationDocument: u64(p.stateFields.preparationDocument),
    measureRequest: u64(p.stateFields.measureRequest),
    layoutWork: u64(p.stateFields.layoutWork),
    imagePaintWork: u64(p.stateFields.imagePaintWork),
    appFrameWork: u64(p.stateFields.appFrameWork),
    layoutReused: u64(p.stateFields.layoutReused),
    layoutDocument: u64(p.stateFields.layoutDocument),
    layoutMetrics: u64(p.stateFields.layoutMetrics),
    fontRevision: u64(p.stateFields.fontRevision),
    coverageRequests: u64(p.stateFields.coverageRequests),
    coverageDeferred: u64(p.stateFields.coverageDeferred),
    coverageClamps: u64(p.stateFields.coverageClamps),
    coverageHandoffs: u64(p.stateFields.coverageHandoffs),
    renderWake: !!(flags & 128),
    observation: observation?.metadata ?? null,
    blobs: Object.freeze(exposedBlobs),
    nodes: Object.freeze(enriched),
    events: Object.freeze(events),
  });
  observation?.commit();
  return result;
}
export interface ProviderMeasurement {
  readonly geometry?: TextGeometry;
  readonly placeholders?: readonly ParagraphBox[];
  readonly didExceedMaxLines?: boolean;
  readonly width: number;
  readonly height: number;
  readonly minimum: number;
  readonly maximum: number;
  /** Alphabetic baseline, or -1 for a non-text leaf. */
  readonly baseline: number;
  readonly ideographicBaseline?: number;
}
export interface ParagraphBox extends TextRect {
  readonly direction: 0 | 1;
}
export function measurementBody(request: EngineResponse, value: ProviderMeasurement): Uint8Array {
  const node = request.nodes[0];
  if (!request.measureRequest || !node || request.nodes.length !== 1)
    throw new Error('No outstanding engine measurement');
  const g = value.geometry;
  const placeholders = value.placeholders;
  if (g && g.selection.length > p.limits.selectionRects)
    throw new RangeError('Selection rectangle budget');
  if (placeholders && (g || placeholders.length > p.limits.paragraphPlaceholders))
    throw new RangeError('Invalid placeholder geometry');
  return body(
    g
      ? p.measurementGeometryBytes + g.selection.length * 32
      : placeholders
        ? p.measurementPlaceholderBytes + placeholders.length * p.paragraphBoxBytes
        : p.measurementBytes,
    (v) => {
      v.setBigUint64(0, request.measurePreparation || request.preparation, true);
      v.setBigUint64(8, request.metrics, true);
      v.setBigUint64(16, request.device, true);
      v.setBigUint64(24, request.measureRequest, true);
      writeHandle(v, 32, node.node);
      [value.width, value.height, value.minimum, value.maximum, value.baseline].forEach(
        (scalar, i) => v.setFloat64(40 + i * 8, finite(scalar), true),
      );
      v.setFloat64(
        p.measureFields.ideographicBaseline,
        finite(value.ideographicBaseline ?? -1),
        true,
      );
      v.setUint32(
        p.measureFields.flags,
        (value.didExceedMaxLines ? p.measurementFlags.didExceedMaxLines : 0) |
          (placeholders ? p.measurementFlags.hasPlaceholders : 0),
        true,
      );
      if (g) {
        v.setBigUint64(p.measureFields.geometryRevision, uint64(g.revision), true);
        const rect = (o: number, r: TextRect) =>
          [r.x, r.y, r.width, r.height].forEach((n, i) => v.setFloat64(o + i * 8, finite(n), true));
        rect(p.measureFields.caret, g.caret);
        v.setUint32(p.measureFields.selectionCount, g.selection.length, true);
        g.selection.forEach((r, i) => rect(p.measureFields.selection + i * 32, r));
      }
      if (placeholders) {
        v.setUint32(p.measureFields.placeholderCount, placeholders.length, true);
        placeholders.forEach((r, i) => {
          const offset = p.measurementPlaceholderBytes + i * p.paragraphBoxBytes;
          if (r.direction !== 0 && r.direction !== 1)
            throw new RangeError('Invalid placeholder direction');
          [r.x, r.y, r.width, r.height].forEach((n, j) =>
            v.setFloat64(offset + j * 8, finite(n), true),
          );
          v.setUint32(offset + 32, r.direction, true);
        });
      }
    },
  );
}
