// SPDX-License-Identifier: BSD-3-Clause
import { imageLimits } from '@nelyx/core/hosting/images';

type ImageSize = { readonly width: number; readonly height: number };
export type BrowserWebP = ImageSize & { readonly legacyProfile?: Uint8Array };

// The 456-byte sRGB profile published by Google Inc. in 2016. Chromium 109
// can return packed RGB without reporting the color space on VideoFrame.
const compactSrgbProfileSha256 = '12afb4d9953adee0607d347daee5b78b18d6b3cab2d572b88970703f5edb37bc';

let rgbaCopySupported: boolean | undefined;

function supportsRgbaCopy(): boolean {
  if (rgbaCopySupported !== undefined) return rgbaCopySupported;
  let frame: VideoFrame | undefined;
  try {
    // Older bindings silently ignore unknown dictionary members, even when
    // ImageDecoder and VideoFrame exist. Probe before starting a real decode.
    frame = new VideoFrame(new Uint8Array(4), {
      format: 'RGBA',
      timestamp: 0,
      codedWidth: 1,
      codedHeight: 1,
    });
    let readsFormat = false;
    let readsColorSpace = false;
    const size = frame.allocationSize({
      get format(): VideoPixelFormat {
        readsFormat = true;
        return 'RGBA';
      },
      get colorSpace(): PredefinedColorSpace {
        readsColorSpace = true;
        return 'srgb';
      },
    });
    rgbaCopySupported = readsFormat && readsColorSpace && size === 4;
  } catch {
    rgbaCopySupported = false;
  } finally {
    frame?.close();
  }
  return rgbaCopySupported;
}

/** Admit one opaque VP8 frame, with an optional ICC profile. Other WebP
 * features use the CanvasKit codec. Bound the decoded size before enqueueing. */
export function browserWebPSize(bytes: Uint8Array): BrowserWebP | null {
  if (typeof ImageDecoder !== 'function' || bytes.length < 30) return null;
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u32 = (at: number) => data.getUint32(at, true);
  if (
    u32(0) !== 0x46464952 || // RIFF
    u32(4) + 8 !== bytes.length ||
    u32(8) !== 0x50424557 // WEBP
  )
    return null;

  let offset = 12;
  let canvas: ImageSize | undefined;
  let profile: Uint8Array | undefined;
  if (u32(offset) === 0x58385056) {
    // VP8X
    const features = u32(20);
    if (u32(16) !== 10 || (features !== 0 && features !== 0x20)) return null;
    canvas = {
      width: (u32(24) & 0xffffff) + 1,
      height: (u32(26) >>> 8) + 1,
    };
    offset = 30;
    if (features === 0x20) {
      if (offset + 8 > bytes.length || u32(offset) !== 0x50434349) return null; // ICCP
      const length = u32(offset + 4);
      profile = bytes.subarray(offset + 8, offset + 8 + length);
      offset += 8 + length + (length % 2);
    }
  }
  if (offset + 18 > bytes.length || u32(offset) !== 0x20385056) return null; // VP8 + space
  const length = u32(offset + 4);
  if (
    length < 10 ||
    offset + 8 + length + (length % 2) !== bytes.length ||
    (bytes[offset + 8]! & 1) !== 0 ||
    u32(offset + 10) >>> 8 !== 0x2a019d
  )
    return null;
  const width = data.getUint16(offset + 14, true);
  const height = data.getUint16(offset + 16, true);
  const pixels = width * height;
  if (
    (canvas && (canvas.width !== width || canvas.height !== height)) ||
    Math.max(width, height) > imageLimits.dimension ||
    pixels > imageLimits.pixels ||
    pixels < 512 * 512
  )
    return null;
  if (supportsRgbaCopy()) return { width, height };
  return profile?.byteLength === 456 && globalThis.crypto?.subtle
    ? { width, height, legacyProfile: profile }
    : null;
}

export async function decodeBrowserWebP(
  bytes: Uint8Array,
  { width, height, legacyProfile }: BrowserWebP,
): Promise<Uint8Array<ArrayBuffer> | null> {
  let decoder: ImageDecoder | undefined;
  let frame: VideoFrame | undefined;
  try {
    if (legacyProfile) {
      const hash = new Uint8Array(
        await crypto.subtle.digest('SHA-256', new Uint8Array(legacyProfile)),
      );
      const hex = Array.from(hash, (byte) => byte.toString(16).padStart(2, '0')).join('');
      if (hex !== compactSrgbProfileSha256) return null;
    }
    decoder = new ImageDecoder({ type: 'image/webp', data: bytes });
    const result = await decoder.decode();
    frame = result.image;
    if (
      !result.complete ||
      decoder.tracks.selectedTrack?.frameCount !== 1 ||
      frame.visibleRect?.width !== width ||
      frame.visibleRect.height !== height ||
      frame.displayWidth !== width ||
      frame.displayHeight !== height
    )
      return null;
    const layout = [{ offset: 0, stride: width * 4 }];
    const format = frame.format;
    if (
      legacyProfile &&
      format !== 'RGBA' &&
      format !== 'RGBX' &&
      format !== 'BGRA' &&
      format !== 'BGRX'
    )
      return null;
    const pixels = new Uint8Array(width * height * 4);
    if (!legacyProfile) {
      await frame.copyTo(pixels, { layout, format: 'RGBA', colorSpace: 'srgb' });
    } else {
      await frame.copyTo(pixels, { layout });
      if (format === 'BGRA' || format === 'BGRX') {
        for (let at = 0; at < pixels.length; at += 4) {
          const blue = pixels[at]!;
          pixels[at] = pixels[at + 2]!;
          pixels[at + 2] = blue;
          pixels[at + 3] = 255;
        }
      } else if (format === 'RGBX') {
        for (let at = 3; at < pixels.length; at += 4) pixels[at] = 255;
      }
    }
    return pixels;
  } catch {
    // WebCodecs image type and RGB copy support vary across browser versions.
    return null;
  } finally {
    frame?.close();
    decoder?.close();
  }
}
