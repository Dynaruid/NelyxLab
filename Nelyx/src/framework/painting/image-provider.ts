// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Selected source providers and owner-scoped resolution; no browser/OS imports.
import { FoundationPlatform } from '../../foundation/platform.ts';
import { FlutterError } from '../../foundation/flutter-error.ts';
import { FlutterErrorDetails } from '../../foundation/assertions.ts';
import { ErrorDescription } from '../../foundation/diagnostics.ts';
import type { Disposable } from '../../foundation/disposable.ts';
import { invariant, exceptionStack } from '../../foundation/errors.ts';
import { AssetBundle, CachingAssetBundle } from '../../services/asset-bundle.ts';
import { AssetManifest, assetManifestWebBytes } from '../../services/asset-manifest.ts';
import type { AssetMetadata } from '../../services/asset-manifest.ts';
import { ImageConfiguration } from './image-configuration.ts';
import { ImageCache } from './image-cache.ts';
import type { ImageCacheStatus } from './image-cache.ts';
import {
  ImageStream,
  ImageStreamCompleter,
  MultiFrameImageStreamCompleter,
  ImageChunkEvent,
} from './image-stream.ts';
import type { ImageErrorListener } from './image-stream.ts';
import type { Codec } from '../../ui/codec.ts';
import type { ImageService, ImageDecodeOptions, ImageReadRequest } from '../../hosting/images.ts';
import { fileImageUri } from '../../hosting/images.ts';
import { hashValues, valueEquals } from './value-equality.ts';
const caches = new WeakMap<ImageService, ImageCache>(),
  bundles = new WeakMap<ImageService, AssetBundle>();
class _ServiceAssetBundle extends CachingAssetBundle {
  constructor(private readonly images: ImageService) {
    super();
  }
  load(key: string): Promise<Uint8Array> {
    const manifest = this.images.assetManifestBytes;
    if (manifest && (key === 'AssetManifest.bin' || key === 'AssetManifest.bin.json'))
      return Promise.resolve(key.endsWith('.json') ? assetManifestWebBytes(manifest) : manifest);
    return this.images.loadAsset(key);
  }
}
export function imageCacheFor(images: ImageService): ImageCache {
  let cache = caches.get(images);
  if (!cache) {
    cache = new ImageCache((callback) => {
      if (images.isClosed) callback();
      else images.scheduleFrame(callback);
    });
    caches.set(images, cache);
    images.addCloseListener(() => cache!.dispose());
  }
  return cache;
}
export function imageAssetBundleFor(images: ImageService): AssetBundle {
  let bundle = bundles.get(images);
  if (!bundle) {
    bundle = new _ServiceAssetBundle(images);
    bundles.set(images, bundle);
    images.addCloseListener(() => bundle!.clear());
  }
  return bundle;
}
export interface ImageDecoderCallback {
  (bytes: Uint8Array, options?: ImageDecodeOptions): Promise<Codec>;
  readonly owner: ImageService;
}
function service(configuration: ImageConfiguration): ImageService {
  invariant(
    configuration.images !== null && !configuration.images.isClosed,
    'missing-image-service',
    "Image resolution requires this app owner's ImageService",
  );
  return configuration.images;
}
class _ErrorImageStreamCompleter extends ImageStreamCompleter {}
export abstract class ImageProvider<K = unknown> {
  abstract obtainKey(configuration: ImageConfiguration): K | Promise<K>;
  abstract loadImage(key: K, decode: ImageDecoderCallback): ImageStreamCompleter;
  createStream(_configuration: ImageConfiguration): ImageStream {
    return new ImageStream();
  }
  resolve(configuration: ImageConfiguration): ImageStream {
    service(configuration);
    const stream = this.createStream(configuration);
    let handled = false;
    const handleError: ImageErrorListener = (exception, stack) => {
      if (handled) return;
      handled = true;
      if (configuration.images?.isClosed) return;
      if (stream.completer === null) {
        const completer = new _ErrorImageStreamCompleter();
        stream.setCompleter(completer);
        completer.reportError({ exception, stack, silent: true });
      }
    };
    try {
      const key = this.obtainKey(configuration);
      if (key instanceof Promise)
        void key
          .then((value) => {
            if (!configuration.images?.isClosed)
              this.resolveStreamForKey(configuration, stream, value, handleError);
          })
          .catch((error) => handleError(error, exceptionStack(error)));
      else this.resolveStreamForKey(configuration, stream, key, handleError);
    } catch (error) {
      handleError(error, exceptionStack(error));
    }
    return stream;
  }
  resolveStreamForKey(
    configuration: ImageConfiguration,
    stream: ImageStream,
    key: K,
    handleError: ImageErrorListener,
  ): void {
    const owner = service(configuration),
      cache = imageCacheFor(owner),
      decode: ImageDecoderCallback = Object.assign(
        (bytes: Uint8Array, options: ImageDecodeOptions = {}) =>
          owner.instantiateImageCodec(bytes, options),
        { owner },
      );
    const completer = cache.putIfAbsent(
      key,
      () => {
        const value = stream.completer ?? this.loadImage(key, decode);
        value.addEphemeralErrorListener((error) => {
          if (!owner.isClosed) owner.scheduleFrame(() => cache.evict(key));
          throw error;
        });
        return value;
      },
      { onError: handleError },
    );
    if (stream.completer === null && completer) stream.setCompleter(completer);
  }
  async obtainCacheStatus(
    configuration: ImageConfiguration,
    { handleError = null }: { readonly handleError?: ImageErrorListener | null } = {},
  ): Promise<ImageCacheStatus | null> {
    try {
      return imageCacheFor(service(configuration)).statusForKey(
        await this.obtainKey(configuration),
      );
    } catch (error) {
      if (handleError) {
        handleError(error, exceptionStack(error));
        return null;
      }
      throw error;
    }
  }
  async evict({
    cache = null,
    configuration = ImageConfiguration.empty,
  }: {
    readonly cache?: ImageCache | null;
    readonly configuration?: ImageConfiguration;
  } = {}): Promise<boolean> {
    return (cache ?? imageCacheFor(service(configuration))).evict(
      await this.obtainKey(configuration),
    );
  }
}
function completer(
  codec: Promise<Codec>,
  scale: number,
  label: string,
  decode: ImageDecoderCallback,
  request?: ImageReadRequest,
): ImageStreamCompleter {
  let input = request,
    progress: Disposable | null = null;
  const release = () => {
    progress?.dispose();
    progress = null;
    input = undefined;
  };
  const value = new MultiFrameImageStreamCompleter({
    codec,
    scale,
    debugLabel: label,
    imageService: decode.owner,
    onDisposed: () => {
      const reading = input;
      release();
      reading?.cancel();
    },
  });
  if (request) {
    progress = request.addProgressListener((event) => {
      if (value.debugDisposed || decode.owner.isClosed) return;
      try {
        value.reportImageChunkEvent(new ImageChunkEvent(event));
      } catch (error) {
        FlutterError.reportError(
          new FlutterErrorDetails({
            exception: error,
            stack: exceptionStack(error),
            library: 'image resource service',
            context: new ErrorDescription('by an image chunk listener'),
          }),
        );
      }
    });
    void request.promise.then(release, release);
  }
  return value;
}
export class MemoryImage extends ImageProvider<MemoryImage> {
  constructor(
    readonly bytes: Uint8Array,
    { scale = 1 }: { readonly scale?: number } = {},
  ) {
    super();
    invariant(
      bytes instanceof Uint8Array && Number.isFinite(scale) && scale > 0,
      'invalid-memory-image',
      'MemoryImage needs bytes and a positive scale',
    );
    this.scale = scale;
  }
  readonly scale: number;
  obtainKey(_configuration: ImageConfiguration): MemoryImage {
    return this;
  }
  loadImage(key: MemoryImage, decode: ImageDecoderCallback): ImageStreamCompleter {
    return completer(decode(key.bytes), key.scale, 'MemoryImage', decode);
  }
  equals(other: unknown): boolean {
    return other instanceof MemoryImage && other.bytes === this.bytes && other.scale === this.scale;
  }
  get hashCode(): number {
    return hashValues(this.bytes, this.scale);
  }
  toString(): string {
    return `MemoryImage(${this.bytes.length} bytes, scale: ${this.scale})`;
  }
}
export type WebHtmlElementStrategy = 'never' | 'fallback' | 'prefer';
/** Nelyx native-file adapter: an absolute file URI replaces Dart's File object.
 * File changes require evict(), just as other stable provider keys do. */
export class FileImage extends ImageProvider<FileImage> {
  readonly uri: string;
  readonly scale: number;
  constructor(uri: string, { scale = 1 }: { readonly scale?: number } = {}) {
    super();
    this.uri = fileImageUri(uri);
    invariant(
      Number.isFinite(scale) && scale > 0,
      'invalid-image-scale',
      'Image scale must be positive',
    );
    this.scale = scale;
  }
  obtainKey(_configuration: ImageConfiguration): FileImage {
    return this;
  }
  loadImage(key: FileImage, decode: ImageDecoderCallback): ImageStreamCompleter {
    const request = decode.owner.loadFileRequest(key.uri);
    return completer(
      request.promise.then((bytes) => decode(bytes)),
      key.scale,
      key.uri,
      decode,
      request,
    );
  }
  equals(other: unknown): boolean {
    return other instanceof FileImage && other.uri === this.uri && other.scale === this.scale;
  }
  get hashCode(): number {
    return hashValues(this.uri, this.scale);
  }
  toString(): string {
    return `FileImage("${this.uri}", scale: ${this.scale})`;
  }
}
function imageHeadersEqual(
  a: Readonly<Record<string, string>> | null,
  b: Readonly<Record<string, string>> | null,
): boolean {
  return (
    a === b ||
    (a !== null &&
      b !== null &&
      Object.keys(a).length === Object.keys(b).length &&
      Object.keys(a).every(
        (key) => Object.prototype.hasOwnProperty.call(b, key) && a[key] === b[key],
      ))
  );
}
function imageHeadersHash(headers: Readonly<Record<string, string>> | null): number {
  return hashValues(
    headers === null
      ? null
      : Object.keys(headers)
          .sort()
          .flatMap((key) => [key, headers[key]]),
  );
}
export class NetworkImage extends ImageProvider<NetworkImage> {
  readonly scale: number;
  readonly headers: Readonly<Record<string, string>> | null;
  readonly webHtmlElementStrategy: WebHtmlElementStrategy;
  constructor(
    readonly url: string,
    {
      scale = 1,
      headers = null,
      webHtmlElementStrategy = 'never',
    }: {
      readonly scale?: number;
      readonly headers?: Readonly<Record<string, string>> | null;
      readonly webHtmlElementStrategy?: WebHtmlElementStrategy;
    } = {},
  ) {
    super();
    invariant(
      typeof url === 'string' && Number.isFinite(scale) && scale > 0,
      'invalid-network-image',
      'NetworkImage needs a URL and positive scale',
    );
    invariant(
      ['never', 'fallback', 'prefer'].includes(webHtmlElementStrategy),
      'invalid-image-html-strategy',
      'Unknown HTML image strategy',
    );
    this.scale = scale;
    this.headers = headers === null ? null : Object.freeze({ ...headers });
    this.webHtmlElementStrategy = webHtmlElementStrategy;
  }
  obtainKey(_configuration: ImageConfiguration): NetworkImage {
    return this;
  }
  loadImage(key: NetworkImage, decode: ImageDecoderCallback): ImageStreamCompleter {
    const html =
      FoundationPlatform.hostEnvironment.kind === 'web' &&
      Object.keys(key.headers ?? {}).length === 0;
    invariant(
      !html || key.webHtmlElementStrategy !== 'prefer',
      'unsupported-html-image',
      'Preferred HTML element images require the platform-view image backend',
    );
    const request = decode.owner.loadNetworkRequest(key.url, key.headers ?? {});
    let codec = request.promise.then((bytes) => decode(bytes));
    if (html && key.webHtmlElementStrategy === 'fallback')
      codec = codec.catch((error) => {
        throw new Error('HTML image fallback requires the platform-view image backend', {
          cause: error,
        });
      });
    return completer(codec, key.scale, key.url, decode, request);
  }
  equals(other: unknown): boolean {
    return (
      other instanceof NetworkImage &&
      other.constructor === this.constructor &&
      other.url === this.url &&
      other.scale === this.scale &&
      imageHeadersEqual(other.headers, this.headers) &&
      (FoundationPlatform.hostEnvironment.kind !== 'web' ||
        other.webHtmlElementStrategy === this.webHtmlElementStrategy)
    );
  }
  get hashCode(): number {
    return hashValues(
      this.url,
      this.scale,
      imageHeadersHash(this.headers),
      FoundationPlatform.hostEnvironment.kind === 'web' ? this.webHtmlElementStrategy : null,
    );
  }
  toString(): string {
    return `NetworkImage("${this.url}", scale: ${this.scale}, webHtmlElementStrategy: ${this.webHtmlElementStrategy}, headers: ${JSON.stringify(this.headers)})`;
  }
}
export class AssetBundleImageKey {
  constructor(
    readonly bundle: AssetBundle,
    readonly name: string,
    readonly scale: number,
  ) {}
  equals(other: unknown): boolean {
    return (
      other instanceof AssetBundleImageKey &&
      other.bundle === this.bundle &&
      other.name === this.name &&
      other.scale === this.scale
    );
  }
  get hashCode(): number {
    return hashValues(this.bundle, this.name, this.scale);
  }
  toString(): string {
    return `AssetBundleImageKey(bundle: ${this.bundle}, name: "${this.name}", scale: ${this.scale})`;
  }
}
export abstract class AssetBundleImageProvider extends ImageProvider<AssetBundleImageKey> {
  loadImage(key: AssetBundleImageKey, decode: ImageDecoderCallback): ImageStreamCompleter {
    return completer(
      key.bundle.load(key.name).then((bytes) => decode(bytes)),
      key.scale,
      key.name,
      decode,
    );
  }
}
export class ExactAssetImage extends AssetBundleImageProvider {
  readonly bundle: AssetBundle | null;
  readonly package: string | null;
  readonly scale: number;
  constructor(
    readonly assetName: string,
    {
      scale = 1,
      bundle = null,
      package: packageName = null,
    }: {
      readonly scale?: number;
      readonly bundle?: AssetBundle | null;
      readonly package?: string | null;
    } = {},
  ) {
    super();
    invariant(
      Number.isFinite(scale) && scale > 0,
      'invalid-image-scale',
      'Image scale must be positive',
    );
    this.scale = scale;
    this.bundle = bundle;
    this.package = packageName;
  }
  get keyName(): string {
    return this.package === null ? this.assetName : `packages/${this.package}/${this.assetName}`;
  }
  obtainKey(configuration: ImageConfiguration): AssetBundleImageKey {
    return new AssetBundleImageKey(
      this.bundle ?? configuration.bundle ?? imageAssetBundleFor(service(configuration)),
      this.keyName,
      this.scale,
    );
  }
  equals(other: unknown): boolean {
    return (
      other instanceof ExactAssetImage &&
      other.keyName === this.keyName &&
      other.bundle === this.bundle &&
      other.scale === this.scale
    );
  }
  get hashCode(): number {
    return hashValues(this.keyName, this.bundle, this.scale);
  }
}
export class AssetImage extends AssetBundleImageProvider {
  readonly bundle: AssetBundle | null;
  readonly package: string | null;
  constructor(
    readonly assetName: string,
    {
      bundle = null,
      package: packageName = null,
    }: { readonly bundle?: AssetBundle | null; readonly package?: string | null } = {},
  ) {
    super();
    this.bundle = bundle;
    this.package = packageName;
  }
  get keyName(): string {
    return this.package === null ? this.assetName : `packages/${this.package}/${this.assetName}`;
  }
  obtainKey(configuration: ImageConfiguration): AssetBundleImageKey | Promise<AssetBundleImageKey> {
    const bundle =
        this.bundle ?? configuration.bundle ?? imageAssetBundleFor(service(configuration)),
      create = (manifest: AssetManifest) => {
        const candidate = this._chooseVariant(
          this.keyName,
          configuration,
          manifest.getAssetVariants(this.keyName),
        );
        return new AssetBundleImageKey(
          bundle,
          candidate.key,
          candidate.targetDevicePixelRatio ?? 1,
        );
      },
      cached = AssetManifest.tryGetFromAssetBundle(bundle);
    return cached ? create(cached) : AssetManifest.loadFromAssetBundle(bundle).then(create);
  }
  _chooseVariant(
    key: string,
    configuration: ImageConfiguration,
    variants: readonly AssetMetadata[] | null,
  ): AssetMetadata {
    if (!variants?.length || configuration.devicePixelRatio === null)
      return { key, targetDevicePixelRatio: null, main: true };
    const value = configuration.devicePixelRatio;
    invariant(
      Number.isFinite(value) && value > 0,
      'invalid-device-pixel-ratio',
      'Image devicePixelRatio must be positive',
    );
    const candidates = new Map(variants.map((x) => [x.targetDevicePixelRatio ?? 1, x]));
    return this._findBestVariant(candidates, value);
  }
  _findBestVariant(candidates: ReadonlyMap<number, AssetMetadata>, value: number): AssetMetadata {
    const exact = candidates.get(value);
    if (exact) return exact;
    const ratios = [...candidates.keys()].sort((a, b) => a - b),
      lower = ratios.filter((x) => x < value).at(-1),
      upper = ratios.find((x) => x > value);
    if (lower === undefined) return candidates.get(upper!)!;
    if (upper === undefined) return candidates.get(lower)!;
    return candidates.get(value < 2 || value > (lower + upper) / 2 ? upper : lower)!;
  }
  equals(other: unknown): boolean {
    return (
      other instanceof AssetImage && other.keyName === this.keyName && other.bundle === this.bundle
    );
  }
  get hashCode(): number {
    return hashValues(this.keyName, this.bundle);
  }
  toString(): string {
    return `AssetImage(bundle: ${this.bundle}, name: "${this.keyName}")`;
  }
}
export type ResizeImagePolicy = 'exact' | 'fit';
export class ResizeImageKey {
  constructor(
    readonly _providerCacheKey: unknown,
    readonly _policy: ResizeImagePolicy,
    readonly _width: number | null,
    readonly _height: number | null,
    readonly _allowUpscaling: boolean,
  ) {}
  equals(other: unknown): boolean {
    return (
      other instanceof ResizeImageKey &&
      valueEquals(other._providerCacheKey, this._providerCacheKey) &&
      other._policy === this._policy &&
      other._width === this._width &&
      other._height === this._height &&
      other._allowUpscaling === this._allowUpscaling
    );
  }
  get hashCode(): number {
    return hashValues(
      this._providerCacheKey,
      this._policy,
      this._width,
      this._height,
      this._allowUpscaling,
    );
  }
}
export class ResizeImage extends ImageProvider<ResizeImageKey> {
  readonly width: number | null;
  readonly height: number | null;
  readonly policy: ResizeImagePolicy;
  readonly allowUpscaling: boolean;
  readonly useLogicalSize: boolean;
  constructor(
    readonly imageProvider: ImageProvider,
    {
      width = null,
      height = null,
      policy = 'exact',
      allowUpscaling = false,
      useLogicalSize = false,
    }: {
      readonly width?: number | null;
      readonly height?: number | null;
      readonly policy?: ResizeImagePolicy;
      readonly allowUpscaling?: boolean;
      readonly useLogicalSize?: boolean;
    } = {},
  ) {
    super();
    invariant(
      width !== null || height !== null,
      'invalid-image-resize',
      'ResizeImage needs width or height',
    );
    for (const value of [width, height])
      invariant(
        value === null || (Number.isSafeInteger(value) && value > 0),
        'invalid-image-resize',
        'Image resize dimensions must be positive',
      );
    invariant(
      policy === 'exact' || policy === 'fit',
      'invalid-image-resize',
      'Unknown resize policy',
    );
    this.width = width;
    this.height = height;
    this.policy = policy;
    this.allowUpscaling = allowUpscaling;
    this.useLogicalSize = useLogicalSize;
  }
  static resizeIfNeeded(
    width: number | null,
    height: number | null,
    provider: ImageProvider,
    { useLogicalSize = false }: { readonly useLogicalSize?: boolean } = {},
  ): ImageProvider {
    return width === null && height === null
      ? provider
      : new ResizeImage(provider, { width, height, useLogicalSize });
  }
  obtainKey(configuration: ImageConfiguration): ResizeImageKey | Promise<ResizeImageKey> {
    const dpr = this.useLogicalSize ? (configuration.devicePixelRatio ?? 1) : 1,
      key = this.imageProvider.obtainKey(configuration),
      create = (value: unknown) =>
        new ResizeImageKey(
          value,
          this.policy,
          this.width === null ? null : Math.ceil(this.width * dpr),
          this.height === null ? null : Math.ceil(this.height * dpr),
          this.allowUpscaling,
        );
    return key instanceof Promise ? key.then(create) : create(key);
  }
  loadImage(key: ResizeImageKey, decode: ImageDecoderCallback): ImageStreamCompleter {
    const resized: ImageDecoderCallback = Object.assign(
      (bytes: Uint8Array, options: ImageDecodeOptions = {}) => {
        invariant(
          options.getTargetSize == null &&
            options.targetWidth == null &&
            options.targetHeight == null,
          'nested-image-resize',
          'ResizeImage cannot compose with another resizing provider',
        );
        return decode(bytes, {
          getTargetSize: (w, h) => {
            if (key._policy === 'exact')
              return {
                width:
                  key._width === null
                    ? null
                    : key._allowUpscaling
                      ? key._width
                      : Math.min(w, key._width),
                height:
                  key._height === null
                    ? null
                    : key._allowUpscaling
                      ? key._height
                      : Math.min(h, key._height),
              };
            const ratio = w / h,
              maxW = key._width ?? w,
              maxH = key._height ?? h;
            let width = w,
              height = h;
            if (width > maxW) {
              width = maxW;
              height = Math.floor(width / ratio);
            }
            if (height > maxH) {
              height = maxH;
              width = Math.floor(height * ratio);
            }
            if (key._allowUpscaling) {
              if (key._width === null) {
                height = key._height!;
                width = Math.floor(height * ratio);
              } else if (key._height === null) {
                width = key._width;
                height = Math.floor(width / ratio);
              } else {
                width = Math.min(maxW, Math.floor(maxH * ratio));
                height = Math.min(maxH, Math.floor(maxW / ratio));
              }
            }
            return { width: Math.max(1, width), height: Math.max(1, height) };
          },
        });
      },
      { owner: decode.owner },
    );
    return this.imageProvider.loadImage(key._providerCacheKey, resized);
  }
  equals(other: unknown): boolean {
    return (
      other instanceof ResizeImage &&
      valueEquals(other.imageProvider, this.imageProvider) &&
      other.width === this.width &&
      other.height === this.height &&
      other.policy === this.policy &&
      other.allowUpscaling === this.allowUpscaling &&
      other.useLogicalSize === this.useLogicalSize
    );
  }
  get hashCode(): number {
    return hashValues(
      this.imageProvider,
      this.width,
      this.height,
      this.policy,
      this.allowUpscaling,
      this.useLogicalSize,
    );
  }
}
