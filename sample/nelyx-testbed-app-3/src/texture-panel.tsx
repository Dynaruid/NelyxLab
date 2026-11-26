// SPDX-License-Identifier: BSD-3-Clause
import { useEffect, useRef, useState } from 'react';

const clipUrl = new URL('../assets/texture-pattern.mp4', import.meta.url).href;
const sources = [
  ['canvas', 'Canvas'],
  ['video', 'Video'],
  ['camera', 'Camera'],
  ['bitmap', 'ImageBitmap'],
  ['frame', 'VideoFrame'],
  ['codec', 'WebCodecs'],
] as const;
type Source = (typeof sources)[number][0];
const producerWidth = 320;
const producerHeight = 180;

function supported(source: Source) {
  switch (source) {
    case 'camera':
      return typeof navigator.mediaDevices?.getUserMedia === 'function';
    case 'bitmap':
      return typeof createImageBitmap === 'function';
    case 'frame':
      return typeof VideoFrame === 'function';
    case 'codec':
      return typeof VideoEncoder === 'function' && typeof VideoDecoder === 'function';
    default:
      return true;
  }
}

function paintPattern(context: CanvasRenderingContext2D, time: number) {
  const phase = time / 24;
  const gradient = context.createLinearGradient(0, 0, producerWidth, producerHeight);
  gradient.addColorStop(0, `hsl(${(phase + 235) % 360} 58% 27%)`);
  gradient.addColorStop(1, `hsl(${(phase + 285) % 360} 62% 45%)`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, producerWidth, producerHeight);
  for (let i = 0; i < 6; i++) {
    const angle = phase / 16 + (i * Math.PI) / 3;
    const x = producerWidth / 2 + Math.cos(angle) * 88;
    const y = producerHeight / 2 + Math.sin(angle) * 58;
    context.fillStyle = `hsl(${(phase + i * 35) % 360} 85% 75% / .8)`;
    context.beginPath();
    context.arc(x, y, 12 + i * 2, 0, 2 * Math.PI);
    context.fill();
  }
  context.fillStyle = '#fff';
  context.font = '12px system-ui';
  context.fillText(`Frame ${Math.floor(time / 42)}`, 12, producerHeight - 12);
}

export function TexturePanel() {
  const display = useRef<HTMLCanvasElement>(null);
  const media = useRef<HTMLVideoElement | null>(null);
  const control = useRef({ frozen: false, paused: false, update: 0 });
  const [source, setSource] = useState<Source>('canvas');
  const [revision, setRevision] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [large, setLarge] = useState(false);
  const [status, setStatus] = useState('Preparing source');
  const label = sources.find(([key]) => key === source)![1];

  useEffect(() => {
    control.current.frozen = frozen;
  }, [frozen]);
  useEffect(() => {
    control.current.paused = paused;
    const video = media.current;
    if (paused) video?.pause();
    else if (video)
      void video.play().catch(() => {
        if (media.current === video) setStatus('Video playback could not resume');
      });
  }, [paused]);

  useEffect(() => {
    const canvas = display.current!;
    const output = canvas.getContext('2d');
    if (!output) {
      setStatus('Canvas rendering is unavailable');
      return;
    }
    if (stopped) {
      output.clearRect(0, 0, canvas.width, canvas.height);
      setStatus('Source stopped');
      return;
    }

    const producer = document.createElement('canvas');
    producer.width = producerWidth;
    producer.height = producerHeight;
    const painter = producer.getContext('2d');
    if (!painter) {
      setStatus('Canvas rendering is unavailable');
      return;
    }

    let alive = true;
    let frame = 0;
    let stream: MediaStream | undefined;
    let video: HTMLVideoElement | undefined;
    let encoder: VideoEncoder | undefined;
    let decoder: VideoDecoder | undefined;
    let failed = false;
    let bitmapping = false;
    let previous = 0;
    let clock = 0;
    let seenUpdate = -1;
    let frameCount = 0;

    const stopProducer = () => {
      cancelAnimationFrame(frame);
      if (media.current === video) media.current = null;
      if (video) {
        video.pause();
        video.srcObject = null;
        video.removeAttribute('src');
        video.load();
      }
      stream?.getTracks().forEach((track) => track.stop());
      if (encoder && encoder.state !== 'closed') encoder.close();
      if (decoder && decoder.state !== 'closed') decoder.close();
    };
    const report = (error: unknown) => {
      if (!alive || failed) return;
      failed = true;
      stopProducer();
      setStatus(error instanceof Error ? error.message : 'The source could not produce frames');
    };
    const present = (image: CanvasImageSource, force = false) => {
      if (alive && (force || !control.current.frozen))
        output.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    const draw = (time: number) => {
      const { frozen, paused, update } = control.current;
      const force = update !== seenUpdate;
      if (!force && time - previous < 40) return;
      if (!paused) clock += Math.min(80, time - (previous || time));
      previous = time;

      if (video) {
        if (video.readyState < 2) return;
        painter.drawImage(video, 0, 0, producerWidth, producerHeight);
      } else {
        paintPattern(painter, clock);
      }
      if (frozen && !force) return;

      if (source === 'bitmap') {
        if (bitmapping) return;
        bitmapping = true;
        void createImageBitmap(producer)
          .then((bitmap) => {
            try {
              present(bitmap, force);
            } finally {
              bitmap.close();
            }
          })
          .catch(report)
          .finally(() => {
            bitmapping = false;
          });
      } else if (source === 'frame' || source === 'codec') {
        if (encoder && (encoder.encodeQueueSize > 2 || (decoder?.decodeQueueSize ?? 0) > 2)) return;
        const image = new VideoFrame(producer, { timestamp: Math.round(time * 1000) });
        try {
          if (encoder) encoder.encode(image, { keyFrame: frameCount++ % 48 === 0 });
          else present(image, force);
        } finally {
          image.close();
        }
      } else {
        present(producer, force);
      }
      seenUpdate = update;
    };
    const nextFrame = (time: number) => {
      if (!alive || failed) return;
      try {
        draw(time);
        frame = requestAnimationFrame(nextFrame);
      } catch (error) {
        report(error);
      }
    };

    const start = async () => {
      setStatus(`Preparing ${label}`);
      if (source === 'video' || source === 'camera') {
        video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.loop = true;
        if (source === 'camera') {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          if (!alive) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }
          video.srcObject = stream;
        } else {
          video.src = clipUrl;
        }
        media.current = video;
        await video.play();
        if (control.current.paused) video.pause();
      } else if (source === 'codec') {
        const config = {
          codec: 'vp8',
          width: producerWidth,
          height: producerHeight,
          latencyMode: 'realtime',
        } as const;
        if (!(await VideoEncoder.isConfigSupported(config)).supported)
          throw new Error('VP8 encoding is unavailable');
        if (!alive) return;
        let lastUpdate = -1;
        decoder = new VideoDecoder({
          error: report,
          output(image) {
            const update = control.current.update;
            try {
              present(image, lastUpdate !== update);
            } finally {
              image.close();
            }
            lastUpdate = update;
          },
        });
        decoder.configure({
          codec: config.codec,
          codedWidth: producerWidth,
          codedHeight: producerHeight,
        });
        encoder = new VideoEncoder({
          error: report,
          output: (chunk) => {
            if (alive) decoder!.decode(chunk);
          },
        });
        encoder.configure(config);
      }
      if (alive) {
        setStatus(`${label} source ready`);
        frame = requestAnimationFrame(nextFrame);
      }
    };
    void start().catch(report);

    return () => {
      alive = false;
      stopProducer();
    };
  }, [source, label, revision, stopped]);

  const recreate = () => {
    setStopped(false);
    setFrozen(false);
    setPaused(false);
    setRevision((value) => value + 1);
  };

  return (
    <>
      <h1>Texture</h1>
      <p>Freeze holds the displayed frame while the source keeps running.</p>
      <div className="host-actions" aria-label="Texture sources">
        {sources.map(([key, name]) => (
          <button
            key={key}
            disabled={!supported(key)}
            aria-pressed={!stopped && source === key}
            onClick={() => {
              setSource(key);
              recreate();
            }}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="host-actions" aria-label="Texture controls">
        <button disabled={stopped} onClick={() => setFrozen((value) => !value)}>
          {frozen ? 'Resume' : 'Freeze'}
        </button>
        <button onClick={recreate}>Recreate</button>
        <button disabled={stopped} onClick={() => setStopped(true)}>
          Stop
        </button>
        <button
          onClick={() => {
            setLarge((value) => !value);
            control.current.update++;
          }}
        >
          Resize
        </button>
        <button
          disabled={stopped}
          onClick={() => {
            control.current.update++;
          }}
        >
          Update
        </button>
        <button disabled={stopped} onClick={() => setPaused((value) => !value)}>
          {paused ? 'Play source' : 'Pause source'}
        </button>
        <button
          disabled={stopped || source !== 'video'}
          onClick={() => {
            const video = media.current;
            if (!video || !Number.isFinite(video.duration)) return;
            video.currentTime = (video.currentTime + 1) % video.duration;
            control.current.update++;
          }}
        >
          Seek +1s
        </button>
      </div>
      <p role="status">{status}</p>
      <canvas
        ref={display}
        className="texture-preview"
        width={large ? 640 : 440}
        height={large ? 360 : 248}
        aria-label="Texture preview"
      />
    </>
  );
}
