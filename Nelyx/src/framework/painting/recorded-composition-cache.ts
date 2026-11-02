// SPDX-License-Identifier: BSD-3-Clause
// CPU comparison metadata owns no resource hold. Clear it when a live Layer
// loses its recording, rather than retaining dead command graphs until GC.
import type { Layer, ContainerLayer, PictureLayer } from '../rendering/layer.ts';
import type { Picture } from '../../ui/picture.ts';
import type { Rect, PaintCommand } from '../../ui/types.ts';
import type { PictureBatchPart } from './picture-batching.ts';

interface CompositionEntry {
  readonly mark: number;
  readonly layer: Layer;
  readonly parent: ContainerLayer | null;
}
export interface CompositionStructure {
  readonly layer: Layer;
  readonly parent: ContainerLayer | null;
  readonly children: readonly Layer[] | null;
  readonly picture: Picture | null;
}
export interface CompositionCommand {
  readonly value: PaintCommand;
  readonly resourceOwner: object | null;
  readonly shaderOwner: object | null;
}
interface CompositionPicture {
  readonly layer: PictureLayer;
  readonly picture: Picture;
  readonly parent: ContainerLayer;
}
export interface CompositionPart extends PictureBatchPart {
  readonly picture: CompositionPicture | null;
}
export interface CompositionBatch {
  readonly commands: readonly CompositionCommand[] | null;
  readonly parts: readonly CompositionPart[];
}
export interface RetainedComposition {
  readonly body: ContainerLayer;
  readonly bounds: Rect;
  readonly commands: readonly CompositionCommand[] | null;
  readonly pictures: readonly CompositionBatch[];
  readonly entries: readonly CompositionEntry[];
  readonly structure: readonly CompositionStructure[];
}
export const retainedCompositions = new WeakMap<Layer, RetainedComposition>();
export const recordedLayerPictures = new WeakMap<Layer, readonly CompositionBatch[]>();

/** @internal Structural edits and disposal retire this recording's comparisons,
 * not GPU holds. Ancestor recordings still compare their owned structure on
 * their next compose; a retained insertion can move without erasing that history. */
export function forgetRecordedComposition(layer: Layer): void {
  retainedCompositions.delete(layer);
  recordedLayerPictures.delete(layer);
}
