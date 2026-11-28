// SPDX-License-Identifier: BSD-3-Clause
use std::ptr::NonNull;

use objc2::{rc::autoreleasepool, rc::Retained, runtime::ProtocolObject, MainThreadMarker};
use objc2_core_foundation::CGSize;
use objc2_core_graphics::{kCGColorSpaceSRGB, CGColorSpace};
use objc2_metal::{
    MTLBlitCommandEncoder, MTLCommandBuffer, MTLCommandEncoder, MTLCommandQueue,
    MTLCreateSystemDefaultDevice, MTLDevice, MTLDrawable, MTLOrigin, MTLPixelFormat,
    MTLResourceOptions, MTLSize, MTLTexture,
};
use objc2_quartz_core::{CAMetalDrawable, CAMetalLayer};

use crate::{ColorType, ForegroundFrame};

/// The transparent foreground uses the same premultiplied Skia pixels as the other hosts.
/// The host owns the view hierarchy and supplies a layer already attached to its view.
pub struct MetalForeground {
    layer: Retained<CAMetalLayer>,
    device: Retained<ProtocolObject<dyn MTLDevice>>,
    queue: Retained<ProtocolObject<dyn MTLCommandQueue>>,
    upload: Vec<u8>,
    _main_thread: MainThreadMarker,
}

impl MetalForeground {
    pub fn new(
        layer: Retained<CAMetalLayer>,
        main_thread: MainThreadMarker,
    ) -> Result<Self, String> {
        let device = MTLCreateSystemDefaultDevice().ok_or("Metal is unavailable")?;
        let queue = device
            .newCommandQueue()
            .ok_or("Metal command queue is unavailable")?;
        let srgb = CGColorSpace::with_name(Some(unsafe { kCGColorSpaceSRGB }))
            .ok_or("The Metal foreground could not create an sRGB color space")?;
        layer.setDevice(Some(&device));
        layer.setPixelFormat(MTLPixelFormat::BGRA8Unorm);
        layer.setFramebufferOnly(false);
        layer.setOpaque(false);
        layer.setColorspace(Some(&srgb));
        Ok(Self {
            layer,
            device,
            queue,
            upload: Vec::new(),
            _main_thread: main_thread,
        })
    }

    pub fn present(
        &mut self,
        frame: &ForegroundFrame,
        origin: (i32, i32),
        size: (i32, i32),
        scale: f64,
    ) -> Result<(), String> {
        let mut surface = frame
            .rasterize_as(ColorType::BGRA8888, origin, size)
            .map_err(|error| format!("Skia foreground raster failed: {error:?}"))?;
        let pixels = surface
            .peek_pixels()
            .ok_or("Skia foreground pixels are unavailable")?;
        let bytes = pixels
            .bytes()
            .ok_or("Skia foreground pixels are unavailable")?;
        let (width, height) = (size.0 as usize, size.1 as usize);
        let row = width * 4;
        let stride = row.next_multiple_of(256);
        self.upload.resize(stride * height, 0);
        for (source, destination) in bytes
            .chunks(pixels.row_bytes())
            .zip(self.upload.chunks_exact_mut(stride))
        {
            destination[..row].copy_from_slice(&source[..row]);
        }
        let drawable_size = CGSize::new(width as f64, height as f64);
        if self.layer.contentsScale() != scale {
            self.layer.setContentsScale(scale);
        }
        if self.layer.drawableSize() != drawable_size {
            self.layer.setDrawableSize(drawable_size);
        }
        autoreleasepool(|_| {
            // The device copies the staging bytes before returning the buffer.
            let buffer = unsafe {
                self.device.newBufferWithBytes_length_options(
                    NonNull::from(self.upload.as_mut_slice()).cast(),
                    self.upload.len(),
                    MTLResourceOptions::StorageModeShared,
                )
            }
            .ok_or("The Metal foreground could not allocate its upload buffer")?;
            let drawable = self
                .layer
                .nextDrawable()
                .ok_or("The Metal foreground has no drawable")?;
            let texture = drawable.texture();
            if (texture.width(), texture.height()) != (width, height) {
                return Err("The Metal foreground drawable changed size".into());
            }
            let command = self
                .queue
                .commandBuffer()
                .ok_or("The Metal foreground has no command buffer")?;
            let blit = command
                .blitCommandEncoder()
                .ok_or("The Metal foreground has no blit encoder")?;
            // The retained command buffer holds both resources through completion.
            unsafe {
                blit.copyFromBuffer_sourceOffset_sourceBytesPerRow_sourceBytesPerImage_sourceSize_toTexture_destinationSlice_destinationLevel_destinationOrigin(
                    &buffer, 0, stride, stride * height, MTLSize { width, height, depth: 1 },
                    &texture, 0, 0, MTLOrigin { x: 0, y: 0, z: 0 },
                );
            }
            blit.endEncoding();
            command.presentDrawable(ProtocolObject::<dyn MTLDrawable>::from_ref(&*drawable));
            command.commit();
            Ok(())
        })
    }
}
