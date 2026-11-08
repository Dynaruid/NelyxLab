// SPDX-License-Identifier: BSD-3-Clause
import { registerNativeWidgetAdapter } from '@nelyx/core/framework/widgets/framework';
import type { BuildOwner } from '@nelyx/core/framework/widgets/framework';
import { EditableText } from '@nelyx/core/framework/widgets/editable-text';
import { resolveTextConfiguration } from '@nelyx/core/internal/framework/widgets/text-input';
import type { EditingHost, EditingBinding, EditingOptions } from '@nelyx/core/hosting/interaction';
import { freezeEditingConfiguration } from '@nelyx/core/hosting/interaction';
import type { TextEditingValue, ViewOwner } from '@nelyx/core/ui/types';
import { ObjectKey } from '@nelyx/core/foundation/key';
import { EditingController } from '../engine-client/scene.ts';
import { OriginalNativeNode } from './native-node.ts';
import type { OriginalNativeRender } from './native-node.ts';
import type { EngineViewClient } from '../engine-client/client.ts';
import { EngineError } from '../engine-client/client.ts';
import type { EditingSnapshot, EngineResponse, NodeHandle } from '../engine-client/codec.ts';
import { protocol as p } from '../engine-client/schema.ts';

type Record = {
  controller: EditingController;
  value: TextEditingValue;
  options: EditingOptions;
  changed: (value: TextEditingValue) => void;
  active: boolean;
  revision: bigint;
  render?: OriginalNativeRender;
  initialized: boolean;
  pending: (() => Promise<void>)[];
  running?: Promise<void> | undefined;
  focused: boolean;
  focus?: { focused: boolean; session: bigint } | undefined;
  initial: TextEditingValue;
};
/** Source EditableTextState retains controllers/formatters/undo/focus. Only the
 * render configuration and asynchronous authoritative edit transport are replaced. */
export class OriginalEditingBridge implements EditingHost {
  readonly owner: ViewOwner;
  readonly capabilities = {
    indexUnit: 'utf16',
    composing: 'observed',
    selectionDirection: 'observed',
    geometry: 'unavailable',
  } as const;
  private readonly records = new Map<string, Record>();
  private publication: EngineResponse | undefined;
  private closed = false;
  private readonly inflight = new Set<Promise<void>>();
  constructor(
    private readonly view: EngineViewClient,
    private readonly handle: (render: OriginalNativeRender) => NodeHandle | null,
    private readonly schedule: () => void,
    private readonly error: (error: unknown) => void,
    private readonly fail: (reason: string) => never,
    private readonly focusChanged: (apply: () => void) => void,
  ) {
    this.owner = Object.freeze({
      id: `engine-v2:${view.owner.session}:${view.owner.app}:${view.owner.view}`,
      generation: view.owner.generation,
    });
  }
  install(owner: BuildOwner): void {
    registerNativeWidgetAdapter(owner, 'editable-text', (widget, context) => {
      if (Object.getPrototypeOf(widget) !== EditableText.prototype)
        return this.fail('custom-editable-text');
      const source = widget as EditableText,
        record = this.records.get(source.id),
        options = source.inputOptions ?? {};
      if (!record?.active) throw Error('Original editor has no live binding');
      const configuration = freezeEditingConfiguration(record.options.configuration),
        resolved = resolveTextConfiguration(context, {
          ...(options.textStyle ? { style: options.textStyle } : {}),
          ...(options.textDirection ? { direction: options.textDirection } : {}),
          ...(options.textScaler ? { textScaler: options.textScaler } : {}),
        });
      if (
        options.expands ||
        options.scrollController ||
        options.scrollPhysics ||
        options.scrollBehavior ||
        options.strutStyle ||
        (options.textAlign && options.textAlign !== 'start')
      )
        return this.fail('editable-layout-configuration');
      const enabled = options.enabled !== false,
        flags =
          (configuration.readOnly ? p.editFlags.readOnly : 0) |
          (configuration.multiline ? p.editFlags.multiline : 0) |
          (configuration.obscureText ? p.editFlags.password : 0) |
          (!enabled ? p.editFlags.disabled : 0);
      const style = resolved.style.toRunStyle(resolved.scaler);
      // Native editor shaping owns the metrics, caret, scroll and password paint.
      return new OriginalNativeNode(
        'editable',
        [],
        {
          key: new ObjectKey(record),
          pointerHitTest: 'self',
          layout: { paragraphSizing: true, clipOverflow: true },
          paragraph: {
            fontFamily:
              style.fontFamilies?.[0] === 'CupertinoSystemText'
                ? 'NelyxDefault'
                : (style.fontFamilies?.[0] ?? 'NelyxDefault'),
            fontWeight: style.fontWeight ?? 400,
            letterSpacing: style.letterSpacing ?? 0,
            wordSpacing: style.wordSpacing ?? 0,
            locale: style.locale ?? 'en',
            wrap: configuration.multiline,
            maxLines: configuration.multiline ? 0 : 1,
            ...(style.height === undefined ? {} : { height: style.height }),
          },
          vertical: {
            kind: 'unbounded',
            min: Math.max(source.height, options.minHeight ?? 48),
          },
          semantics: {
            role: 'textField',
            label: source.label,
            flags: p.semanticsFlags.focusable | (!enabled ? p.semanticsFlags.disabled : 0),
            actions:
              p.semanticsActions.focus |
              p.semanticsActions.setValue |
              p.semanticsActions.setSelection,
          },
          onFocusChanged: (focused) => {
            if (!record.active) return;
            record.focused = focused;
            this.focusChanged(() => {
              if (record.active && !this.closed) record.options.focusChanged?.(focused);
            });
          },
          onKey: (event) => {
            if (Number(event.detail & 0xffff_ffffn) === 13 && event.status === p.keyKinds.down)
              record.options.onAction?.(record.value);
          },
        },
        (render) => {
          record.render = render;
        },
        {
          text: {
            value: record.controller.initialText,
            size: style.fontSize ?? 18,
            color: style.color ?? 0xff172033,
            direction: resolved.painterOptions.textDirection ?? 'ltr',
          },
          editor: record.controller,
          flags,
          maximumLength: p.limits.textBytes,
        },
      );
    });
  }
  bind(
    owner: ViewOwner,
    initial: TextEditingValue,
    changed: (value: TextEditingValue) => void,
    options?: EditingOptions,
  ): EditingBinding {
    if (
      this.closed ||
      !options ||
      this.records.has(options.id) ||
      owner.id !== this.owner.id ||
      owner.generation !== this.owner.generation
    )
      throw Error('Original editing owner/id is unavailable or duplicated');
    const record: Record = {
      controller: new EditingController(initial.text),
      value: initial,
      initial,
      options,
      changed,
      active: true,
      revision: 0n,
      initialized: false,
      pending: [],
      focused: false,
    };
    this.records.set(options.id, record);
    const release = record.controller.subscribe((value) => this.receive(record, value, 'native'));
    const replace = (value: TextEditingValue, request?: number, cancel = false) =>
      this.enqueue(record, async () => {
        const handle = record.render && this.handle(record.render);
        if (!handle) return;
        try {
          const current = await this.view.editSnapshot(handle),
            state = await this.view.request(p.opcodes.inspect);
          const result = await this.view.edit(handle, {
            kind: 'replace',
            revision: current.revision,
            session:
              state.focus?.node.slot === handle.slot &&
              state.focus.node.generation === handle.generation
                ? state.focus.session
                : 0n,
            policy: cancel ? 'cancel' : 'preserve',
            text: value.text,
            base: value.selection.anchor,
            extent: value.selection.focus,
          });
          if (result.revision < record.revision) {
            if (request !== undefined) record.options.synchronizationRejected?.(request, 'stale');
            return;
          }
          this.receive(record, result, 'programmatic');
          record.controller.publish(result);
        } catch (error) {
          if (
            error instanceof EngineError &&
            (error.status === p.statuses.stale || error.status === p.statuses.busy)
          ) {
            if (request !== undefined)
              record.options.synchronizationRejected?.(
                request,
                error.status === p.statuses.busy ? 'composing' : 'stale',
              );
          } else throw error;
        }
      });
    return {
      get isComposing() {
        return record.value.composing.status === 'active';
      },
      read: () => record.value,
      replace: (value, request) => replace(value, request),
      replaceComposing: (value, request) => replace(value, request, true),
      focus: () => {
        if (record.focused) return;
        record.focus = { focused: true, session: this.publication?.focus?.session ?? 0n };
        this.pumpFocus(record);
      },
      blur: () => {
        if (!record.focused) return;
        record.focus = { focused: false, session: this.publication?.focus?.session ?? 0n };
        this.pumpFocus(record);
      },
      readGeometry: () => ({ status: 'unavailable' }),
      dispose: () => {
        record.active = false;
        release();
        if (this.records.get(options.id) === record) this.records.delete(options.id);
        record.pending = [];
      },
    };
  }
  private receive(
    record: Record,
    snapshot: EditingSnapshot,
    source: 'native' | 'programmatic',
  ): void {
    // An event poll may observe the admitted edit before its request resolves.
    // That observation cannot retire Source's programmatic synchronization.
    // A receipt for the same canonical revision still acknowledges that request;
    // an older receipt must never roll back a later native value.
    if (
      !record.active ||
      this.closed ||
      snapshot.revision < record.revision ||
      (snapshot.revision === record.revision && source === 'native')
    )
      return;
    record.revision = snapshot.revision;
    record.value = {
      text: snapshot.text,
      selection: { anchor: snapshot.base, focus: snapshot.extent },
      composing:
        snapshot.composingStart < 0
          ? { status: 'none' }
          : { status: 'active', start: snapshot.composingStart, end: snapshot.composingEnd },
      revision: record.value.revision + 1,
      session: this.owner,
      source,
    };
    record.changed(record.value);
    this.schedule();
  }
  private enqueue(record: Record, action: () => Promise<void>): void {
    if (!record.active || this.closed) return;
    if (record.pending.length >= 32) throw Error('Original edit mailbox exceeded');
    record.pending.push(action);
    this.pump(record);
  }
  private pump(record: Record): void {
    if (!record.initialized || record.running || !record.active || this.closed) return;
    record.running = (async () => {
      while (record.active && !this.closed && record.pending.length)
        await record.pending.shift()!();
    })()
      .catch(this.error)
      .finally(() => {
        this.inflight.delete(record.running!);
        record.running = undefined;
        if (record.pending.length) this.pump(record);
      });
    this.inflight.add(record.running);
  }
  private pumpFocus(record: Record): void {
    const frame = this.publication,
      handle = record.render && this.handle(record.render);
    if (
      !record.active ||
      this.closed ||
      record.focus === undefined ||
      !handle ||
      !frame?.publication ||
      !frame.nodes.some(
        (n) => n.node.slot === handle.slot && n.node.generation === handle.generation,
      )
    )
      return;
    const request = record.focus;
    record.focus = undefined;
    if ((frame.focus?.session ?? 0n) !== request.session) return;
    this.enqueue(record, async () => {
      try {
        await this.view.focus(
          request.focused ? handle : null,
          frame.publication,
          request.session,
          true,
        );
      } catch (error) {
        if (error instanceof EngineError && error.status === p.statuses.stale) {
          if ((error.result?.focus?.session ?? 0n) === request.session) record.focus = request;
          return;
        }
        throw error;
      }
    });
  }
  observePublication(state: EngineResponse): void {
    this.publication = state;
    for (const record of this.records.values()) this.pumpFocus(record);
  }
  async finishBuild(): Promise<void> {
    for (const record of this.records.values())
      if (record.active && record.render && this.handle(record.render) && !record.initialized) {
        record.initialized = true;
        const handle = this.handle(record.render)!;
        const snapshot = await this.view.editSnapshot(handle);
        if (
          snapshot.base !== record.initial.selection.anchor ||
          snapshot.extent !== record.initial.selection.focus
        ) {
          const value = await this.view.edit(handle, {
            kind: 'replace',
            revision: snapshot.revision,
            session: 0n,
            text: record.initial.text,
            base: record.initial.selection.anchor,
            extent: record.initial.selection.focus,
          });
          this.receive(record, value, 'programmatic');
          record.controller.publish(value);
        } else {
          this.receive(record, snapshot, 'programmatic');
          record.controller.publish(snapshot);
        }
        this.pump(record);
        this.pumpFocus(record);
      }
  }
  dispose(): void {
    this.closed = true;
    for (const record of this.records.values()) {
      record.active = false;
      record.pending = [];
    }
    this.records.clear();
  }
  async close(): Promise<void> {
    const running = [...this.inflight];
    this.dispose();
    await Promise.all(running);
  }
}
