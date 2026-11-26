// SPDX-License-Identifier: BSD-3-Clause
import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from 'react';
import { getFrontendHost } from '@nelyx/sdk/frontend/dom/environment';
import localScript from './webview-document.js?url&no-inline';

const localDocument = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Nelyx WebView sample</title>
<style>
  :root { color-scheme: light dark; font: 16px system-ui; }
  body { margin: 0; padding: 24px; color: CanvasText; background: Canvas; }
  section { max-width: 580px; border: 1px solid GrayText; border-radius: 12px; padding: 16px; }
  label { display: grid; gap: 8px; }
  input, button { font: inherit; padding: 8px 12px; }
  button { margin-top: 12px; }
  .pulse { margin-top: 16px; height: 64px; border-radius: 8px;
    background: linear-gradient(90deg,#695399,#a15281,#4c6791,#695399);
    background-size: 250% 100%; animation: pulse 4s linear infinite; }
  @keyframes pulse { to { background-position: 250% 50%; } }
  @media (prefers-reduced-motion: reduce) { .pulse { animation: none; } }
</style>
<body>
  <h1>Interactive local HTML</h1>
  <section>
    <label>WebView text input<input value="Nelyx WebView input"></label>
    <button type="button" id="counter">Count: 0</button>
    <div class="pulse" aria-label="Animated block"></div>
  </section>
  <script defer src="${new URL(localScript, document.baseURI).href}"></script>
</body>
</html>`;

export function WebViewPanel() {
  const frame = useRef<HTMLIFrameElement>(null);
  const [pages, setPages] = useState<(string | null)[]>([null]);
  const [index, setIndex] = useState(0);
  const url = pages[index]!;
  const [address, setAddress] = useState('');
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState('Loading local page');
  const [result, setResult] = useState('');
  const [showPanel, setShowPanel] = useState(false);
  const allowRemoteFrame = getFrontendHost().target === 'web';

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (
        url === null &&
        event.source === frame.current?.contentWindow &&
        event.origin === window.origin &&
        event.data?.kind === 'testbed/title' &&
        typeof event.data.title === 'string'
      )
        setResult(event.data.title);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [url]);

  const load = (next: string | null) => {
    setAddress(next ?? '');
    setResult('');
    setStatus(next === null ? 'Loading local page' : 'Requesting external page');
    setRevision((current) => current + 1);
  };
  const navigate = (next: string | null) => {
    if (next !== url) {
      setPages([...pages.slice(0, index + 1), next]);
      setIndex(index + 1);
    }
    load(next);
  };
  const move = (next: number) => {
    setIndex(next);
    load(pages[next]!);
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const entered = address.trim();
    if (!entered) {
      navigate(null);
      return;
    }
    try {
      const parsed = new URL(/^[a-z][a-z\d+.-]*:/i.test(entered) ? entered : `https://${entered}`);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')
        throw new Error('Unsupported protocol');
      navigate(parsed.href);
    } catch {
      setStatus('Enter an HTTP or HTTPS address.');
    }
  };

  return (
    <>
      <h1>WebView</h1>
      <div className="host-actions">
        <button onClick={() => move(index - 1)} disabled={index === 0}>
          Back
        </button>
        <button onClick={() => move(index + 1)} disabled={index === pages.length - 1}>
          Forward
        </button>
        <button onClick={() => load(url)}>Reload</button>
        <button onClick={() => navigate(null)}>Local sample</button>
        <button
          disabled={url !== null}
          onClick={() =>
            frame.current?.contentWindow?.postMessage(
              { kind: 'testbed/read-title' },
              window.origin === 'null' ? '*' : window.origin,
            )
          }
        >
          Read title with JS
        </button>
        <button onClick={() => setShowPanel((shown) => !shown)}>
          {showPanel ? 'Hide panel' : 'Show panel'}
        </button>
      </div>
      {allowRemoteFrame && (
        <form className="host-actions webview-address" onSubmit={submit}>
          <label className="host-field">
            Address
            <input
              value={address}
              placeholder="https://example.com"
              onChange={(event) => setAddress(event.target.value)}
            />
          </label>
          <button type="submit">Go</button>
        </form>
      )}
      <p role="status">
        {status}
        {result && ` · JavaScript result: ${result}`}
      </p>
      <div className="webview-stage">
        {url === null ? (
          <iframe
            key={revision}
            ref={frame}
            title="Local WebView sample"
            srcDoc={localDocument}
            onLoad={() => setStatus('Local page loaded')}
          />
        ) : (
          <iframe
            key={revision}
            ref={frame}
            title="External WebView page"
            src={url}
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            {...{ credentialless: '' }}
            onLoad={() =>
              setStatus('External page requested. The site controls whether it can be embedded.')
            }
          />
        )}
        {showPanel && <FloatingPanel />}
      </div>
    </>
  );
}

function FloatingPanel() {
  const [blur, setBlur] = useState(10);
  const [opacity, setOpacity] = useState(65);
  const [tint, setTint] = useState('var(--surface)');
  const [position, setPosition] = useState({ x: 14, y: 14 });
  const start = useRef<{ x: number; y: number } | null>(null);
  const dragStart = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = { x: event.clientX - position.x, y: event.clientY - position.y };
  };
  const drag = (event: PointerEvent<HTMLElement>) => {
    if (!start.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const panel = event.currentTarget.parentElement!;
    const stage = panel.parentElement!;
    setPosition({
      x: Math.max(
        0,
        Math.min(event.clientX - start.current.x, stage.clientWidth - panel.offsetWidth),
      ),
      y: Math.max(
        0,
        Math.min(event.clientY - start.current.y, stage.clientHeight - panel.offsetHeight),
      ),
    });
  };
  return (
    <div
      className="webview-floating"
      style={{
        left: `clamp(0px, ${position.x}px, 100% - min(15rem, 88%))`,
        top: position.y,
        backdropFilter: `blur(${blur}px)`,
        backgroundColor: `color-mix(in srgb, ${tint} ${opacity}%, transparent)`,
      }}
    >
      <header
        onPointerDown={dragStart}
        onPointerMove={drag}
        onLostPointerCapture={() => {
          start.current = null;
        }}
      >
        Floating panel
      </header>
      <label className="host-field">
        Blur · {blur}px
        <input
          type="range"
          min={0}
          max={16}
          value={blur}
          onChange={(event) => setBlur(event.target.valueAsNumber)}
        />
      </label>
      <label className="host-field">
        Tint · {opacity}%
        <input
          type="range"
          min={0}
          max={100}
          value={opacity}
          onChange={(event) => setOpacity(event.target.valueAsNumber)}
        />
      </label>
      <label className="host-field">
        Tint color
        <select value={tint} onChange={(event) => setTint(event.target.value)}>
          <option value="var(--surface)">Theme</option>
          <option value="#ffffff">White</option>
          <option value="#a6c7ff">Blue</option>
        </select>
      </label>
    </div>
  );
}
