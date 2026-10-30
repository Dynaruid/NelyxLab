// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from pinned widgets/image.dart; IO/codec ownership stays with the app ImageService.
import '../../foundation/errors.ts';
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { FoundationPlatform } from '../../foundation/platform.ts';
import { FlutterError } from '../../foundation/flutter-error.ts';
import { FlutterErrorDetails } from '../../foundation/assertions.ts';
import { ErrorDescription, DiagnosticsProperty } from '../../foundation/diagnostics.ts';
import type { DiagnosticPropertiesBuilder } from '../../foundation/diagnostics.ts';
import type { Disposable } from '../../foundation/disposable.ts';
import type { AssetBundle } from '../../services/asset-bundle.ts';
import { Size } from '../../ui/size.ts';
import { ImageConfiguration } from '../painting/image-configuration.ts';
import { Alignment } from '../painting/alignment.ts';
import {
  ImageProvider,
  MemoryImage,
  FileImage,
  NetworkImage,
  AssetImage,
  ExactAssetImage,
  ResizeImage,
} from '../painting/image-provider.ts';
import type { WebHtmlElementStrategy } from '../painting/image-provider.ts';
import { valueEquals } from '../painting/value-equality.ts';
import { ImageStreamListener } from '../painting/image-stream.ts';
import type {
  ImageInfo,
  ImageStream,
  ImageChunkEvent,
  ImageErrorListener,
  ImageStreamCompleterHandle,
} from '../painting/image-stream.ts';
import type { FrameScheduler } from '../scheduler/scheduler.ts';
import { StatefulWidget, State, ErrorWidget } from './framework.ts';
import type { BuildContext, Widget } from './framework.ts';
import { Directionality, Localizations, MediaQuery } from './app-data.ts';
import { DefaultAssetBundle } from './default-asset-bundle.ts';
import { RawImage } from './raw-image.ts';
import type { RawImageOptions } from './raw-image.ts';
import { Semantics } from './semantics.ts';
import { TickerMode } from './ticker-mode.ts';
import { tickerScheduler } from './ticker-scheduler.ts';
import { DisposableBuildContext } from './disposable-build-context.ts';
import { ScrollAwareImageProvider } from './scroll-aware-image-provider.ts';
export function createLocalImageConfiguration(
  context: BuildContext,
  { size = null }: { readonly size?: Size | null } = {},
): ImageConfiguration {
  return new ImageConfiguration({
    images: context.services.images ?? null,
    bundle: DefaultAssetBundle.of(context),
    devicePixelRatio:
      context.maybeDependOn(MediaQuery)?.data.scale ?? context.services.readMetrics().scale,
    locale: context.maybeDependOn(Localizations)?.locale ?? null,
    textDirection: context.maybeDependOn(Directionality)?.direction ?? null,
    size,
    platform: FoundationPlatform.defaultTargetPlatform,
  });
}
/** Resolves on first image or failure; listener/image cleanup runs at post-frame or owner shutdown. */
export function precacheImage(
  provider: ImageProvider,
  context: BuildContext,
  {
    size = null,
    onError = null,
  }: { readonly size?: Size | null; readonly onError?: ImageErrorListener | null } = {},
): Promise<void> {
  const config = createLocalImageConfiguration(context, { size }),
    scheduler = tickerScheduler(context),
    stream = provider.resolve(config),
    pending = new Set<ImageInfo>(),
    hooks: Disposable[] = [];
  let stopped = false,
    resolve!: () => void;
  const completion = new Promise<void>((done) => (resolve = done));
  let listener: ImageStreamListener;
  const cleanup = () => {
    if (stopped) return;
    stopped = true;
    resolve();
    const errors: unknown[] = [];
    for (const action of [
      () => {
        if (!stream.completer?.debugDisposed) stream.removeListener(listener);
      },
      ...[...pending].map((info) => () => info.dispose()),
      ...hooks.map((hook) => () => hook.dispose()),
    ])
      try {
        action();
      } catch (error) {
        errors.push(error);
      }
    pending.clear();
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, 'Precache retirement failed');
  };
  listener = new ImageStreamListener(
    (info) => {
      if (stopped) {
        info.dispose();
        return;
      }
      pending.add(info);
      resolve();
      scheduler.addPostFrameCallback(cleanup, { debugLabel: 'precacheImage.removeListener' });
    },
    {
      onError: (error, stack) => {
        cleanup();
        if (onError) onError(error, stack);
        else
          FlutterError.reportError(
            new FlutterErrorDetails({
              exception: error,
              stack,
              library: 'image resource service',
              context: new ErrorDescription('image failed to precache'),
              silent: true,
            }),
          );
      },
    },
  );
  hooks.push(scheduler.observeDispose(cleanup));
  if (config.images) hooks.push(config.images.addCloseListener(cleanup));
  try {
    stream.addListener(listener);
  } catch (error) {
    cleanup();
    throw error;
  }
  return completion;
}
export type ImageFrameBuilder = (
  context: BuildContext,
  child: Widget,
  frame: number | null,
  wasSynchronouslyLoaded: boolean,
) => Widget;
export type ImageLoadingBuilder = (
  context: BuildContext,
  child: Widget,
  loadingProgress: ImageChunkEvent | null,
) => Widget;
export type ImageErrorWidgetBuilder = (
  context: BuildContext,
  error: unknown,
  stackTrace: string | null,
) => Widget;
export interface ImageOptions extends Omit<
  RawImageOptions,
  'image' | 'debugImageLabel' | 'scale' | 'invertColors'
> {
  readonly frameBuilder?: ImageFrameBuilder | null;
  readonly loadingBuilder?: ImageLoadingBuilder | null;
  readonly errorBuilder?: ImageErrorWidgetBuilder | null;
  readonly semanticLabel?: string | null;
  readonly excludeFromSemantics?: boolean;
  readonly gaplessPlayback?: boolean;
}
export interface ImageCacheSizeOptions {
  readonly cacheWidth?: number | null;
  readonly cacheHeight?: number | null;
  readonly useLogicalCacheSize?: boolean;
}
export interface AssetImageOptions extends ImageOptions, ImageCacheSizeOptions {
  readonly bundle?: AssetBundle | null;
  readonly package?: string | null;
  readonly scale?: number | null;
}
export interface NetworkImageOptions extends ImageOptions, ImageCacheSizeOptions {
  readonly scale?: number;
  readonly headers?: Readonly<Record<string, string>> | null;
  readonly webHtmlElementStrategy?: WebHtmlElementStrategy;
}
export interface MemoryImageOptions extends ImageOptions, ImageCacheSizeOptions {
  readonly scale?: number;
}
export class Image extends StatefulWidget {
  readonly options: ImageOptions;
  constructor(
    readonly image: ImageProvider,
    options: ImageOptions = {},
  ) {
    super(options.key ?? null);
    this.options = Object.freeze({ ...options });
  }
  static asset(
    name: string,
    {
      bundle = null,
      package: packageName = null,
      scale = null,
      cacheWidth = null,
      cacheHeight = null,
      useLogicalCacheSize = false,
      ...options
    }: AssetImageOptions = {},
  ): Image {
    return new Image(
      ResizeImage.resizeIfNeeded(
        cacheWidth,
        cacheHeight,
        scale === null
          ? new AssetImage(name, { bundle, package: packageName })
          : new ExactAssetImage(name, { bundle, package: packageName, scale }),
        { useLogicalSize: useLogicalCacheSize },
      ),
      options,
    );
  }
  static network(
    url: string,
    {
      scale = 1,
      headers = null,
      cacheWidth = null,
      cacheHeight = null,
      useLogicalCacheSize = false,
      webHtmlElementStrategy = 'never',
      ...options
    }: NetworkImageOptions = {},
  ): Image {
    return new Image(
      ResizeImage.resizeIfNeeded(
        cacheWidth,
        cacheHeight,
        new NetworkImage(url, { scale, headers, webHtmlElementStrategy }),
        { useLogicalSize: useLogicalCacheSize },
      ),
      options,
    );
  }
  /** Native local files use absolute file: URIs; browser callers use MemoryImage. */
  static file(
    uri: string,
    {
      scale = 1,
      cacheWidth = null,
      cacheHeight = null,
      useLogicalCacheSize = false,
      ...options
    }: ImageOptions & ImageCacheSizeOptions & { readonly scale?: number } = {},
  ): Image {
    return new Image(
      ResizeImage.resizeIfNeeded(cacheWidth, cacheHeight, new FileImage(uri, { scale }), {
        useLogicalSize: useLogicalCacheSize,
      }),
      options,
    );
  }
  static memory(
    bytes: Uint8Array,
    {
      scale = 1,
      cacheWidth = null,
      cacheHeight = null,
      useLogicalCacheSize = false,
      ...options
    }: MemoryImageOptions = {},
  ): Image {
    return new Image(
      ResizeImage.resizeIfNeeded(cacheWidth, cacheHeight, new MemoryImage(bytes, { scale }), {
        useLogicalSize: useLogicalCacheSize,
      }),
      options,
    );
  }
  get frameBuilder(): ImageFrameBuilder | null {
    return this.options.frameBuilder ?? null;
  }
  get loadingBuilder(): ImageLoadingBuilder | null {
    return this.options.loadingBuilder ?? null;
  }
  get errorBuilder(): ImageErrorWidgetBuilder | null {
    return this.options.errorBuilder ?? null;
  }
  get width(): number | null {
    return this.options.width ?? null;
  }
  get height(): number | null {
    return this.options.height ?? null;
  }
  get semanticLabel(): string | null {
    return this.options.semanticLabel ?? null;
  }
  get excludeFromSemantics(): boolean {
    return this.options.excludeFromSemantics ?? false;
  }
  get gaplessPlayback(): boolean {
    return this.options.gaplessPlayback ?? false;
  }
  get color() {
    return this.options.color ?? null;
  }
  get opacity() {
    return this.options.opacity ?? null;
  }
  get colorBlendMode() {
    return this.options.colorBlendMode ?? null;
  }
  get fit() {
    return this.options.fit ?? null;
  }
  get alignment() {
    return this.options.alignment ?? Alignment.center;
  }
  get repeat() {
    return this.options.repeat ?? 'noRepeat';
  }
  get centerSlice() {
    return this.options.centerSlice ?? null;
  }
  get matchTextDirection() {
    return this.options.matchTextDirection ?? false;
  }
  get filterQuality() {
    return this.options.filterQuality ?? 'medium';
  }
  get isAntiAlias() {
    return this.options.isAntiAlias ?? false;
  }
  createState(): State {
    return new _ImageState();
  }
}
class _ImageState extends State<Image> {
  private static nextSemanticsId = 0;
  private readonly semanticsId = 'image-widget-' + ++_ImageState.nextSemanticsId;
  private stream: ImageStream | null = null;
  private info: ImageInfo | null = null;
  private progress: ImageChunkEvent | null = null;
  private listening = false;
  private invert = false;
  private frameNumber: number | null = null;
  private wasSynchronouslyLoaded = false;
  private scrollContext!: DisposableBuildContext;
  private lastException: unknown = null;
  private lastStack: string | null = null;
  private handle: ImageStreamCompleterHandle | null = null;
  private paused = false;
  private closed = false;
  private schedulerStopped = false;
  private tickerEnabled = true;
  private disableAnimations = false;
  private listener: ImageStreamListener | null = null;
  private generation = 0;
  private scheduler!: FrameScheduler;
  private hooks: Disposable[] = [];
  private deferred = new Set<ImageInfo>();
  override initState(): void {
    super.initState();
    this.scrollContext = new DisposableBuildContext(this);
    this.scheduler = tickerScheduler(this.context);
    this.hooks.push(
      this.scheduler.observeVisibility(() => {
        if (!this.closed) {
          this.updatePause();
          if (this.paused && this.frameNumber !== null) this.stopListening(true);
          else this.listenToStream();
        }
      }),
      this.scheduler.observeDispose(() => {
        this.schedulerStopped = true;
        this.stopListening();
        this.handle?.dispose();
        this.handle = null;
        this.replaceImage(null);
        this.flushDeferred();
      }),
    );
  }
  override didChangeDependencies(): void {
    super.didChangeDependencies();
    const media = this.context.maybeDependOn(MediaQuery)?.data;
    this.invert = media?.invertColors ?? false;
    this.disableAnimations = media?.disableAnimations ?? false;
    this.tickerEnabled = TickerMode.of(this.context);
    this.resolveImage();
    this.updatePause();
    if (this.paused && this.frameNumber !== null) this.stopListening(true);
    else this.listenToStream();
  }
  private updatePause(): void {
    this.paused = !this.tickerEnabled || this.disableAnimations || !this.scheduler.visible;
  }
  override didUpdateWidget(old: Image): void {
    super.didUpdateWidget(old);
    if (
      this.listening &&
      ((old.loadingBuilder === null) !== (this.widget.loadingBuilder === null) ||
        (old.errorBuilder === null) !== (this.widget.errorBuilder === null))
    ) {
      const oldListener = this.getListener();
      this.generation++;
      this.listener = null;
      const next = this.getListener();
      this.stream!.addListener(next);
      if (!this.stream!.completer?.debugDisposed) this.stream!.removeListener(oldListener);
    }
    if (!valueEquals(old.image, this.widget.image)) {
      this.resolveImage();
      this.listenToStream();
    }
  }
  private resolveImage(): void {
    if (this.closed || this.schedulerStopped) return;
    const provider = new ScrollAwareImageProvider(this.scrollContext, this.widget.image),
      configuration = createLocalImageConfiguration(this.context, {
        size:
          this.widget.width !== null && this.widget.height !== null
            ? new Size(this.widget.width, this.widget.height)
            : null,
      });
    this.updateSourceStream(provider.resolve(configuration));
  }
  private getListener(): ImageStreamListener {
    if (this.listener) return this.listener;
    this.lastException = null;
    this.lastStack = null;
    const generation = this.generation,
      suppress = this.widget.errorBuilder !== null,
      live = () => !this.closed && !this.schedulerStopped && generation === this.generation;
    this.listener = new ImageStreamListener(
      (info, sync) => {
        if (!live()) {
          info.dispose();
          return;
        }
        this.handleImageFrame(info, sync);
      },
      {
        onChunk:
          this.widget.loadingBuilder === null
            ? null
            : (event) => {
                if (live())
                  this.setState(() => {
                    this.progress = event;
                    this.lastException = null;
                    this.lastStack = null;
                  });
              },
        onError:
          suppress || FoundationBuildMode.debug
            ? (error, stack) => {
                if (live())
                  this.setState(() => {
                    this.lastException = error;
                    this.lastStack = stack;
                  });
                if (!suppress) throw error;
              }
            : null,
        reportErrors: !suppress,
      },
    );
    return this.listener;
  }
  private handleImageFrame(info: ImageInfo, synchronous: boolean): void {
    this.setState(() => {
      this.replaceImage(info);
      this.progress = null;
      this.lastException = null;
      this.lastStack = null;
      this.frameNumber = this.frameNumber === null ? 0 : this.frameNumber + 1;
      this.wasSynchronouslyLoaded = this.wasSynchronouslyLoaded || synchronous;
    });
    if (this.paused) this.stopListening(true);
  }
  private replaceImage(info: ImageInfo | null): void {
    const previous = this.info;
    this.info = info;
    if (previous) {
      if (this.closed || this.schedulerStopped || this.scheduler.disposed) previous.dispose();
      else {
        this.deferred.add(previous);
        this.scheduler.addPostFrameCallback(
          () => {
            if (this.deferred.delete(previous)) previous.dispose();
          },
          { debugLabel: 'Image.disposeOldInfo' },
        );
      }
    }
  }
  private flushDeferred(): void {
    const values = [...this.deferred];
    this.deferred.clear();
    const errors: unknown[] = [];
    for (const info of values)
      try {
        info.dispose();
      } catch (error) {
        errors.push(error);
      }
    if (errors.length) throw new AggregateError(errors, 'Image deferred retirement failed');
  }
  private updateSourceStream(next: ImageStream): void {
    if (this.stream?.key === next.key) return;
    const wasListening = this.listening;
    if (wasListening) this.stream!.removeListener(this.getListener());
    this.generation++;
    this.listener = null;
    if (!this.widget.gaplessPlayback) this.replaceImage(null);
    this.progress = null;
    this.frameNumber = null;
    this.wasSynchronouslyLoaded = false;
    this.stream = next;
    if (wasListening) this.stream.addListener(this.getListener());
  }
  private listenToStream(): void {
    if (this.listening || !this.stream || this.closed || this.schedulerStopped) return;
    const oldHandle = this.handle;
    this.handle = null;
    this.listening = true;
    try {
      this.stream.addListener(this.getListener());
    } finally {
      oldHandle?.dispose();
    }
  }
  private stopListening(keepStreamAlive = false): void {
    if (!this.listening || !this.stream) return;
    if (
      keepStreamAlive &&
      this.handle === null &&
      this.stream.completer &&
      !this.stream.completer.debugDisposed
    )
      this.handle = this.stream.completer.keepAlive();
    if (this.widget.errorBuilder !== null && !this.stream.completer?.debugDisposed)
      this.stream.completer?.addEphemeralErrorListener(() => {});
    this.listening = false;
    if (!this.stream.completer?.debugDisposed) this.stream.removeListener(this.getListener());
  }
  override dispose(): void {
    if (this.closed) return;
    this.closed = true;
    this.scrollContext.dispose();
    const errors: unknown[] = [];
    for (const action of [
      () => this.stopListening(),
      () => this.handle?.dispose(),
      () => this.replaceImage(null),
      () => this.flushDeferred(),
      ...this.hooks.map((hook) => () => hook.dispose()),
      () => super.dispose(),
    ])
      try {
        action();
      } catch (error) {
        errors.push(error);
      }
    this.hooks = [];
    this.handle = null;
    this.stream = null;
    this.listener = null;
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, 'Image State disposal failed');
  }
  build(context: BuildContext): Widget {
    if (this.lastException !== null) {
      if (this.widget.errorBuilder)
        return this.widget.errorBuilder(context, this.lastException, this.lastStack);
      if (FoundationBuildMode.debug) return new ErrorWidget(this.lastException);
    }
    let result: Widget = new RawImage({
      ...this.widget.options,
      key: null,
      image: this.info?.image ?? null,
      debugImageLabel: this.info?.debugLabel ?? null,
      scale: this.info?.scale ?? 1,
      invertColors: this.invert,
    });
    if (!this.widget.excludeFromSemantics)
      result = new Semantics(result, {
        id: this.semanticsId,
        role: 'image',
        name: this.widget.semanticLabel ?? '',
        enabled: true,
        focusable: false,
      });
    if (this.widget.frameBuilder)
      result = this.widget.frameBuilder(
        context,
        result,
        this.frameNumber,
        this.wasSynchronouslyLoaded,
      );
    if (this.widget.loadingBuilder)
      result = this.widget.loadingBuilder(context, result, this.progress);
    return result;
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    for (const [name, value] of [
      ['stream', this.stream],
      ['pixels', this.info],
      ['loadingProgress', this.progress],
      ['frameNumber', this.frameNumber],
      ['wasSynchronouslyLoaded', this.wasSynchronouslyLoaded],
    ] as const)
      properties.add(new DiagnosticsProperty(name, value));
  }
}
