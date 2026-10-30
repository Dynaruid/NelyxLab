// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Owned Image handle adaptation of the pinned dart:ui painting.dart.
import { invariant } from '../foundation/errors.ts';
import type { ResourceRegistry } from '../hosting/resources.ts';
import { FoundationBuildMode } from '../foundation/constants.ts';
import type { ResourceId } from './types.ts';
import { resourceKey } from './resource-retention.ts';
export type ImageByteFormat =
  | 'rawRgba'
  | 'rawStraightRgba'
  | 'rawUnmodified'
  | 'rawExtendedRgba128'
  | 'png';
export type ImageByteReader = (format: ImageByteFormat) => Promise<Uint8Array | null>;
const handles = new WeakMap<ResourceRegistry, Map<string, Set<Image>>>();
export class Image {
  static onCreate: ((image: Image) => void) | null = null;
  static onDispose: ((image: Image) => void) | null = null;
  private dead = false;
  private disposing = false;
  private readonly hold: { dispose(): void };
  private readonly identifier: ResourceId;
  private readonly stack = FoundationBuildMode.debug ? (new Error().stack ?? '') : null;
  private constructor(
    private readonly registry: ResourceRegistry,
    resource: ResourceId,
    readonly width: number,
    readonly height: number,
    private readonly readBytes: ImageByteReader | null,
  ) {
    invariant(
      Number.isSafeInteger(width) && width > 0 && Number.isSafeInteger(height) && height > 0,
      'invalid-image-size',
      'Image dimensions must be positive integers',
    );
    this.identifier = registry.captureResource(resource);
    this.hold = registry.retainProducer(this.identifier);
    let groups: Map<string, Set<Image>> | undefined,
      group: Set<Image> | undefined,
      key: string | undefined;
    try {
      groups = handles.get(registry);
      if (!groups) handles.set(registry, (groups = new Map()));
      key = this.key;
      group = groups.get(key);
      if (!group) groups.set(key, (group = new Set()));
      group.add(this);
      Image.onCreate?.(this);
      invariant(!this.dead, 'disposed-image', 'Image was disposed by its onCreate observer');
    } catch (error) {
      if (group && key !== undefined) {
        group.delete(this);
        if (!group.size) groups?.delete(key);
      }
      this.dead = true;
      try {
        this.hold.dispose();
      } catch (cleanup) {
        throw new AggregateError([error, cleanup], 'Image creation observer and retirement failed');
      }
      throw error;
    }
  }
  /** Host adapter: the registry's initial producer remains independently owned. */
  static fromResource(
    registry: ResourceRegistry,
    resource: ResourceId,
    width: number,
    height: number,
    readBytes: ImageByteReader | null = null,
  ): Image {
    return new Image(registry, resource, width, height, readBytes);
  }
  private get key(): string {
    return resourceKey(this.identifier);
  }
  private assertLive(): void {
    invariant(
      !this.dead && this.registry.has(this.identifier),
      'disposed-image',
      'Cannot use a disposed Image or closed image owner',
    );
  }
  get resource(): ResourceId {
    this.assertLive();
    return this.identifier;
  }
  get debugDisposed(): boolean {
    return this.dead;
  }
  get colorSpace(): 'sRGB' {
    return 'sRGB';
  }
  clone(): Image {
    this.assertLive();
    return new Image(this.registry, this.identifier, this.width, this.height, this.readBytes);
  }
  isCloneOf(other: Image): boolean {
    return (
      other instanceof Image &&
      other.registry === this.registry &&
      other.identifier.id === this.identifier.id &&
      other.identifier.generation === this.identifier.generation
    );
  }
  debugGetOpenHandleStackTraces(): readonly (string | null)[] | null {
    return FoundationBuildMode.debug
      ? [...(handles.get(this.registry)?.get(this.key) ?? [])].map((image) => image.stack)
      : null;
  }
  async toByteData({
    format = 'rawRgba',
  }: { readonly format?: ImageByteFormat } = {}): Promise<Uint8Array | null> {
    this.assertLive();
    invariant(
      ['rawRgba', 'rawStraightRgba', 'rawUnmodified', 'rawExtendedRgba128', 'png'].includes(format),
      'invalid-image-byte-format',
      'Unknown image byte format',
    );
    invariant(
      this.readBytes !== null,
      'unsupported-image-bytes',
      'This image backend does not expose pixel/encoded byte readback',
    );
    const lease = this.registry.acquire([this.identifier]);
    let bytes: Uint8Array | null = null;
    const errors: unknown[] = [];
    try {
      const value = await this.readBytes(format);
      bytes = value === null ? null : new Uint8Array(value);
    } catch (error) {
      errors.push(error);
    }
    try {
      lease.returnBy('caller');
    } catch (error) {
      errors.push(error);
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, 'Image readback and retirement failed');
    return bytes;
  }
  dispose(): void {
    invariant(
      !this.dead && !this.disposing,
      'disposed-image',
      'Image cannot be disposed more than once or reentrantly',
    );
    this.disposing = true;
    const errors: unknown[] = [];
    try {
      Image.onDispose?.(this);
    } catch (error) {
      errors.push(error);
    }
    this.dead = true;
    this.disposing = false;
    const group = handles.get(this.registry)?.get(this.key);
    group?.delete(this);
    if (group?.size === 0) handles.get(this.registry)?.delete(this.key);
    try {
      this.hold.dispose();
    } catch (error) {
      errors.push(error);
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, 'Image disposal failed');
  }
  toString(): string {
    return `[${this.width}\u00d7${this.height}]`;
  }
}
