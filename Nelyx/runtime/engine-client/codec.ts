// SPDX-License-Identifier: BSD-3-Clause
import { protocol as p } from './schema.ts';
import { encodeUtf8, decodeUtf8 } from './utf8.ts';
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
}
export type AffineMatrix = readonly [number,number,number,number,number,number];
export type PathSegment = readonly ['move'|'line',number,number] | readonly ['quad',number,number,number,number] |
  readonly ['cubic',number,number,number,number,number,number] | readonly ['close'];
export interface GraphicsOptions {
  readonly transform?: AffineMatrix;
  readonly path?: readonly PathSegment[];
  readonly fillRule?: 'winding'|'evenOdd';
  readonly shadow?: {readonly x:number;readonly y:number;readonly sigma:number;readonly color:number};
  readonly stroke?: {readonly width:number;readonly color:number};
  readonly blur?:number;
}
export interface GraphicsSnapshot extends GraphicsOptions { readonly hasPath:boolean; }
export interface NodeLayout {
  readonly enabled?: boolean;
  readonly direction?: 'horizontal' | 'vertical';
  readonly mainSize?: 'min' | 'max';
  readonly mainAlign?: keyof typeof p.layoutMainAlign;
  readonly crossAlign?: keyof typeof p.layoutCrossAlign;
  readonly flex?: number;
  readonly fit?: 'tight' | 'loose';
  readonly gap?: number;
  readonly runGap?: number;
  readonly columns?: number;
  readonly padding?: {
    readonly left?: number;
    readonly top?: number;
    readonly right?: number;
    readonly bottom?: number;
  };
}
export interface ListOptions {
  readonly generation: bigint;
  readonly count: number;
  readonly begin: number;
  readonly end: number;
  readonly estimate: number;
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
}
export function eventValue(detail: bigint): number {
  const v = new DataView(new ArrayBuffer(8));
  v.setBigUint64(0, detail, true);
  return finite(v.getFloat64(0, true));
}
export function keyBody(publication: bigint, code: number, down = true, modifiers = 0): Uint8Array {
  return body(24, (v) => {
    v.setBigUint64(0, uint64(publication), true);
    v.setUint32(8, uint32(code), true);
    v.setUint32(12, uint32(modifiers), true);
    v.setUint32(16, down ? 1 : 0, true);
  });
}
export function uint32(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff)
    throw new RangeError('Expected uint32');
  return value;
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
export interface SemanticProperties {
  readonly role: keyof typeof p.semanticsRoles;
  readonly label?: string;
  readonly hint?: string;
  readonly flags?: number;
  readonly actions?: number;
}
export interface SemanticSnapshot {
  readonly role: number;
  readonly label: string;
  readonly hint: string;
  readonly flags: number;
  readonly actions: number;
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
export function focusBody(node: NodeHandle | null, publication: bigint, session = 0n): Uint8Array {
  return body(24, (v) => {
    writeHandle(v, 0, node ?? { slot: 0, generation: 0 });
    v.setBigUint64(8, uint64(publication), true);
    v.setBigUint64(16, uint64(session), true);
  });
}
export function semanticActionBody(
  node: NodeHandle,
  publication: bigint,
  action: keyof typeof p.semanticsActions,
  session = 0n,
): Uint8Array {
  return body(32, (v) => {
    writeHandle(v, 0, node);
    v.setBigUint64(8, uint64(publication), true);
    v.setUint32(16, p.semanticsActions[action], true);
    v.setBigUint64(24, uint64(session), true);
  });
}
export const commands = {
  graphics(node:NodeHandle, options:GraphicsOptions={}):Uint8Array {
    const path=options.path??[];if(path.length>p.limits.pathCommands)throw new RangeError('Path command budget');
    return command(p.commands.graphics,node,body(104+path.length*56,v=>{
      (options.transform??[1,0,0,1,0,0]).forEach((x,i)=>v.setFloat64(i*8,finite(x),true));
      v.setFloat64(48,finite(options.shadow?.x??0),true);v.setFloat64(56,finite(options.shadow?.y??0),true);
      v.setFloat64(64,finite(options.shadow?.sigma??0),true);v.setUint32(72,uint32(options.shadow?.color??0),true);
      v.setUint32(76,uint32(options.stroke?.color??0),true);v.setFloat64(80,finite(options.stroke?.width??0),true);
      v.setFloat64(88,finite(options.blur??0),true);v.setUint32(96,options.fillRule==='evenOdd'?1:0,true);
      v.setUint32(100,path.length,true);
      path.forEach((segment,i)=>{const verb={move:1,line:2,quad:3,cubic:4,close:5}[segment[0]];
        if(!verb)throw new RangeError('Unknown path verb');v.setUint32(104+i*56,verb,true);
        segment.slice(1).forEach((x,j)=>v.setFloat64(112+i*56+j*8,finite(x as number),true));});
    }));
  },
  editor(node: NodeHandle, flags = 0, maximumLength: number = p.limits.textBytes): Uint8Array {
    return command(
      p.commands.editor,
      node,
      body(8, (v) => {
        v.setUint32(0, uint32(flags), true);
        v.setUint32(4, uint32(maximumLength), true);
      }),
    );
  },
  semantics(node: NodeHandle, value: SemanticProperties | null): Uint8Array {
    const label = encodeUtf8(value?.label ?? '', p.limits.semanticsTextBytes),
      hint = encodeUtf8(value?.hint ?? '', p.limits.semanticsTextBytes);
    const bytes = body(24 + Math.ceil((label.length + hint.length) / 8) * 8, (v) => {
      v.setUint32(0, value ? p.semanticsRoles[value.role] : 0, true);
      v.setUint32(4, uint32(value?.flags ?? 0), true);
      v.setUint32(8, uint32(value?.actions ?? 0), true);
      v.setUint32(12, label.length, true);
      v.setUint32(16, hint.length, true);
    });
    bytes.set(label, 24);
    bytes.set(hint, 24 + label.length);
    return command(p.commands.semantics, node, bytes);
  },
  /** Prepared visual offsets, distinct from the logical content extent. */
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
      body(88, (v) => {
        v.setUint32(0, value.enabled === false ? 0 : 1, true);
        v.setUint32(4, value.direction === 'vertical' ? 1 : 0, true);
        v.setUint32(8, value.mainSize === 'max' ? 1 : 0, true);
        v.setUint32(12, p.layoutMainAlign[value.mainAlign ?? 'start'], true);
        v.setUint32(16, p.layoutCrossAlign[value.crossAlign ?? 'start'], true);
        v.setUint32(20, value.fit === 'loose' ? 1 : 0, true);
        v.setUint32(24, uint32(value.columns ?? 2), true);
        [
          value.flex ?? 0,
          value.gap ?? 0,
          value.runGap ?? 0,
          value.padding?.left ?? 0,
          value.padding?.top ?? 0,
          value.padding?.right ?? 0,
          value.padding?.bottom ?? 0,
        ].forEach((scalar, i) => v.setFloat64(32 + i * 8, finite(scalar), true));
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
    options: { readonly direction?: 'ltr' | 'rtl' } = {},
  ): Uint8Array {
    const bytes = encodeUtf8(text, p.limits.textBytes);
    const data = body(24 + Math.ceil(bytes.length / 8) * 8, (v) => {
      v.setUint32(0, uint32(color), true);
      v.setUint32(4, options.direction === 'rtl' ? 1 : 0, true);
      v.setFloat64(8, finite(fontSize), true);
      v.setUint32(16, bytes.length, true);
    });
    data.set(bytes, 24);
    return command(p.commands.text, node, data);
  },
  create(node: NodeHandle, kind: keyof typeof p.kinds): Uint8Array {
    return command(
      p.commands.create,
      node,
      body(8, (v) => v.setUint32(0, p.kinds[kind], true)),
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
      body(64, (v) => {
        values.forEach((scalar, i) => v.setFloat64(i * 8, finite(scalar), true));
        v.setUint32(56, p.extents[value.extent ?? 'finite'], true);
        v.setUint32(60, (value.horizontal ? 1 : 0) | (value.chaining ? 2 : 0), true);
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
  destroy(node: NodeHandle): Uint8Array {
    return command(p.commands.destroy, node);
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
    return command(
      p.commands.list,
      node,
      body(32, (v) => {
        v.setBigUint64(0, uint64(value?.generation ?? 0n), true);
        v.setUint32(8, uint32(value?.count ?? 0), true);
        v.setUint32(12, uint32(value?.begin ?? 0), true);
        v.setUint32(16, uint32(value?.end ?? 0), true);
        v.setFloat64(24, finite(value?.estimate ?? 0), true);
      }),
    );
  },
  gesture(node: NodeHandle, mask: number): Uint8Array {
    return command(
      p.commands.gesture,
      node,
      body(8, (v) => v.setUint32(0, uint32(mask), true)),
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
}
export interface RawInputSample extends InputPacket {
  readonly node: NodeHandle;
  readonly subscription: bigint;
}
export function inputBody(value: InputPacket): Uint8Array {
  return body(p.inputBytes, (v) => {
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
export interface EngineNodeSnapshot {
  readonly graphics:GraphicsSnapshot|null;
  readonly matrix:AffineMatrix;
  readonly bounds:TextRect;
  readonly depth:number;
  readonly localOpacity:number;
  readonly control: ControlSnapshot | null;
  readonly list: ListSnapshot | null;
  readonly editing: EditingSnapshot | null;
  readonly textGeometry: TextGeometry | null;
  readonly semantics: SemanticSnapshot | null;
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
  /** Content paint rectangle within the node's border box, in logical units. */
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
  readonly type: number;
  readonly handle: NodeHandle;
  readonly bytes: Uint8Array;
}
export interface EngineEvent {
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
  readonly memory: {readonly total:bigint;readonly peak:bigint;readonly cpu:bigint;readonly gpu:bigint;
    readonly staging:bigint;readonly engineHeap:bigint;readonly providerHeap:bigint;readonly rejected:bigint;readonly limit:bigint};
  readonly rawInputs: readonly RawInputSample[];
  readonly gestureRequests: readonly RawInputSample[];
  readonly focus: { readonly node: NodeHandle; readonly session: bigint } | null;
  readonly interactionCount: number;
  readonly editingWork: bigint;
  readonly semanticsWork: bigint;
  readonly queryWork: bigint;
  readonly gestureWork: bigint;
  readonly controlWork: bigint;
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
export function response(bytes: Uint8Array): EngineResponse {
  if (bytes.length < p.headerBytes + p.stateBytes || bytes.length > p.limits.packetBytes)
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
    blobCount > p.limits.nodes * 4 + p.limits.resources ||
    p.headerBytes + p.stateBytes + rows * p.nodeBytes + eventCount * p.eventBytes + blobBytes !==
      bytes.length
  )
    throw new Error('Malformed engine response tables');
  const u64 = (offset: number) => v.getBigUint64(b + offset, true);
  const u32 = (offset: number) => v.getUint32(b + offset, true);
  const nodes: EngineNodeSnapshot[] = [],
    events: EngineEvent[] = [];
  let cursor = p.headerBytes + p.stateBytes;
  for (let i = 0; i < rows; ++i, cursor += p.nodeBytes) {
    const f = (offset: number) => finite(v.getFloat64(cursor + offset, true));
    nodes.push(
      Object.freeze({
        editing: null,
        graphics: null,
        control: null,
        list: null,
        textGeometry: null,
        semantics: null,
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
        matrix:Object.freeze(Array.from({length:6},(_,i)=>f(p.nodeFields.matrix+i*8))) as unknown as AffineMatrix,
        bounds:Object.freeze({x:f(p.nodeFields.boundsX),y:f(p.nodeFields.boundsY),width:f(p.nodeFields.boundsWidth),height:f(p.nodeFields.boundsHeight)}),
        depth:v.getUint32(cursor+p.nodeFields.depth,true),localOpacity:f(p.nodeFields.localOpacity),
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
      }),
    );
  }
  for (let i = 0; i < eventCount; ++i, cursor += p.eventBytes)
    events.push(
      Object.freeze({
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
  const blobs: EngineBlob[] = [];
  for (let i = 0; i < blobCount; ++i) {
    if (cursor + 24 > bytes.length) throw new Error('Truncated engine blob');
    const type = v.getUint32(cursor, true),
      length = v.getUint32(cursor + 16, true);
    const stride = 24 + Math.ceil(length / 8) * 8;
    if (
      ![1, 2, 3, 4, 5, 6, 7, 8, 9, 10].includes(type) ||
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
          if (!phase || !source) throw new Error('Invalid raw input enum');
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
            publication: d.getBigUint64(b + 120, true),
          });
        }),
    );
  const enriched = nodes.map((node) => {
    let editing: EditingSnapshot | null = null,
      textGeometry: TextGeometry | null = null,
      semantics: SemanticSnapshot | null = null,
      list: ListSnapshot | null = null,
      control: ControlSnapshot | null = null;
    let graphics:GraphicsSnapshot|null=null;
    for (const blob of blobs) {
      if (
        blob.handle.slot !== node.node.slot ||
        blob.handle.generation !== node.node.generation ||
        blob.type < 3
      )
        continue;
      const d = new DataView(blob.bytes.buffer, blob.bytes.byteOffset, blob.bytes.byteLength),
        size = blob.bytes.length;
      if(blob.type===10){
        if(size<104||d.getUint32(96,true)>3||d.getUint32(100,true)>p.limits.pathCommands||size!==104+d.getUint32(100,true)*56)
          throw new Error('Invalid graphics record');
        const path:PathSegment[]=[];const verbs=['','move','line','quad','cubic','close'] as const;
        for(let i=0;i<d.getUint32(100,true);++i){const at=104+i*56,verb=d.getUint32(at,true);
          if(verb<1||verb>5||d.getUint32(at+4,true))throw new Error('Invalid graphics verb');
          const count=verb<=2?2:verb===3?4:verb===4?6:0;
          path.push(Object.freeze([verbs[verb],...Array.from({length:count},(_,j)=>finite(d.getFloat64(at+8+j*8,true)))]) as PathSegment);
        }
        graphics=Object.freeze({transform:Object.freeze(Array.from({length:6},(_,i)=>finite(d.getFloat64(i*8,true)))) as unknown as AffineMatrix,
          path:Object.freeze(path),hasPath:!!(d.getUint32(96,true)&2),fillRule:d.getUint32(96,true)&1?'evenOdd':'winding',
          shadow:Object.freeze({x:d.getFloat64(48,true),y:d.getFloat64(56,true),sigma:d.getFloat64(64,true),color:d.getUint32(72,true)}),
          stroke:Object.freeze({width:d.getFloat64(80,true),color:d.getUint32(76,true)}),blur:d.getFloat64(88,true)});
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
        if (
          semantics ||
          size < 24 ||
          d.getUint32(20, true) ||
          d.getUint32(0, true) > 7 ||
          d.getUint32(4, true) & ~63 ||
          d.getUint32(8, true) & ~63
        )
          throw new Error('Invalid semantics blob');
        const label = d.getUint32(12, true),
          hint = d.getUint32(16, true);
        if (
          label > p.limits.semanticsTextBytes ||
          hint > p.limits.semanticsTextBytes ||
          size !== 24 + label + hint
        )
          throw new Error('Invalid semantics text');
        semantics = Object.freeze({
          role: d.getUint32(0, true),
          flags: d.getUint32(4, true),
          actions: d.getUint32(8, true),
          label: decodeUtf8(blob.bytes.subarray(24, 24 + label)),
          hint: decodeUtf8(blob.bytes.subarray(24 + label)),
        });
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
        if (
          list ||
          size < 64 ||
          d.getUint32(28, true) > p.limits.listChildren ||
          size !== 64 + d.getUint32(28, true) * 40
        )
          throw new Error('Invalid list snapshot');
        list = Object.freeze({
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
              const at = 64 + i * 40;
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
    return Object.freeze({ ...node, editing, textGeometry, semantics, list, control, graphics });
  });
  const flags = u32(p.stateFields.flags),
    commit = u64(p.stateFields.surfaceCommit);
  return Object.freeze({
    memory:Object.freeze({total:u64(p.stateFields.memoryTotal),peak:u64(p.stateFields.memoryPeak),cpu:u64(p.stateFields.memoryCpu),gpu:u64(p.stateFields.memoryGpu),
      staging:u64(p.stateFields.memoryStaging),engineHeap:u64(p.stateFields.engineHeap),providerHeap:u64(p.stateFields.providerHeap),rejected:u64(p.stateFields.memoryRejected),limit:u64(p.stateFields.memoryLimit)}),
    rawInputs: samples(8),
    gestureRequests: samples(9),
    focus: u64(p.stateFields.focusSession)
      ? Object.freeze({
          node: readHandle(v, b + p.stateFields.focusNode),
          session: u64(p.stateFields.focusSession),
        })
      : null,
    interactionCount: u32(p.stateFields.interactionCount),
    editingWork: u64(p.stateFields.editingWork),
    semanticsWork: u64(p.stateFields.semanticsWork),
    queryWork: u64(p.stateFields.queryWork),
    gestureWork: u64(p.stateFields.gestureWork),
    controlWork: u64(p.stateFields.controlWork),
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
    layoutReused: u64(p.stateFields.layoutReused),
    layoutDocument: u64(p.stateFields.layoutDocument),
    layoutMetrics: u64(p.stateFields.layoutMetrics),
    fontRevision: u64(p.stateFields.fontRevision),
    coverageRequests: u64(p.stateFields.coverageRequests),
    coverageDeferred: u64(p.stateFields.coverageDeferred),
    coverageClamps: u64(p.stateFields.coverageClamps),
    coverageHandoffs: u64(p.stateFields.coverageHandoffs),
    renderWake: !!(flags & 128),
    blobs: Object.freeze(blobs),
    nodes: Object.freeze(enriched),
    events: Object.freeze(events),
  });
}
export interface ProviderMeasurement {
  readonly geometry?: TextGeometry;
  readonly width: number;
  readonly height: number;
  readonly minimum: number;
  readonly maximum: number;
  /** Alphabetic baseline, or -1 for a non-text leaf. */
  readonly baseline: number;
}
export function measurementBody(request: EngineResponse, value: ProviderMeasurement): Uint8Array {
  const node = request.nodes[0];
  if (!request.measureRequest || !node || request.nodes.length !== 1)
    throw new Error('No outstanding engine measurement');
  const g = value.geometry;
  if (g && g.selection.length > p.limits.selectionRects)
    throw new RangeError('Selection rectangle budget');
  return body(g ? 128 + g.selection.length * 32 : 80, (v) => {
    v.setBigUint64(0, request.measurePreparation || request.preparation, true);
    v.setBigUint64(8, request.metrics, true);
    v.setBigUint64(16, request.device, true);
    v.setBigUint64(24, request.measureRequest, true);
    writeHandle(v, 32, node.node);
    [value.width, value.height, value.minimum, value.maximum, value.baseline].forEach((scalar, i) =>
      v.setFloat64(40 + i * 8, finite(scalar), true),
    );
    if (g) {
      v.setBigUint64(80, uint64(g.revision), true);
      const rect = (o: number, r: TextRect) =>
        [r.x, r.y, r.width, r.height].forEach((n, i) => v.setFloat64(o + i * 8, finite(n), true));
      rect(88, g.caret);
      v.setUint32(120, g.selection.length, true);
      g.selection.forEach((r, i) => rect(128 + i * 32, r));
    }
  });
}
