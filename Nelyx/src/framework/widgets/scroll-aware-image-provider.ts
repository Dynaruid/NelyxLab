// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { ImageProvider, imageCacheFor } from '../painting/image-provider.ts';
import type { ImageDecoderCallback } from '../painting/image-provider.ts';
import type { ImageConfiguration } from '../painting/image-configuration.ts';
import type {
  ImageStream,
  ImageStreamCompleter,
  ImageErrorListener,
} from '../painting/image-stream.ts';
import { DisposableBuildContext } from './disposable-build-context.ts';
import { SingleChildScrollView, LazyList } from './scroll.ts';
import { tickerScheduler } from './ticker-scheduler.ts';
import { valueEquals, hashValues } from '../painting/value-equality.ts';
/** Uses existing Nelyx viewport ancestors while the full source Scrollable API is ported. */
export class ScrollAwareImageProvider<T = unknown> extends ImageProvider<T> {
  constructor(
    readonly context: DisposableBuildContext,
    readonly imageProvider: ImageProvider<T>,
  ) {
    super();
  }
  obtainKey(configuration: ImageConfiguration): T | Promise<T> {
    return this.imageProvider.obtainKey(configuration);
  }
  loadImage(key: T, decode: ImageDecoderCallback): ImageStreamCompleter {
    return this.imageProvider.loadImage(key, decode);
  }
  override resolveStreamForKey(
    configuration: ImageConfiguration,
    stream: ImageStream,
    key: T,
    handleError: ImageErrorListener,
  ): void {
    const images = configuration.images;
    if (!images || images.isClosed) return;
    if (stream.completer !== null || imageCacheFor(images).containsKey(key)) {
      this.imageProvider.resolveStreamForKey(configuration, stream, key, handleError);
      return;
    }
    const context = this.context.context;
    if (!context) return;
    let defer = false;
    context.visitAncestorElements((element) => {
      const widget = element.widget,
        position =
          widget instanceof SingleChildScrollView
            ? widget.controller
            : widget instanceof LazyList
              ? widget.options.controller
              : null;
      if (!position) return true;
      defer = position.recommendDeferredLoading(context);
      return false;
    });
    if (defer) {
      tickerScheduler(context).scheduleFrameCallback(() => {
        void Promise.resolve()
          .then(() => {
            if (!images.isClosed) this.resolveStreamForKey(configuration, stream, key, handleError);
          })
          .catch((error) => handleError(error, null));
      });
      return;
    }
    this.imageProvider.resolveStreamForKey(configuration, stream, key, handleError);
  }
  equals(other: unknown): boolean {
    return (
      other instanceof ScrollAwareImageProvider &&
      other.context === this.context &&
      valueEquals(other.imageProvider, this.imageProvider)
    );
  }
  get hashCode(): number {
    return hashValues(this.context, this.imageProvider);
  }
}
