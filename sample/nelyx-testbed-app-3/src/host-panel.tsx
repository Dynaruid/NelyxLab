// SPDX-License-Identifier: BSD-3-Clause
import { useRef, useState, type CSSProperties } from 'react';
import { WebViewPanel } from './webview-panel.tsx';
import { TexturePanel } from './texture-panel.tsx';
import type { HostPlacement } from './host-slot.ts';

const cssColor = (argb: number) => `#${(argb & 0xffffff).toString(16).padStart(6, '0')}`;

export function HostPanel({ placement }: { readonly placement: HostPlacement }) {
  const { page, visible, left, top, width, height } = placement;
  const style = {
    left,
    top,
    width,
    height,
    visibility: visible ? 'visible' : 'hidden',
    colorScheme: placement.dark ? 'dark' : 'light',
    '--surface': cssColor(placement.surface),
    '--container': cssColor(placement.container),
    '--text': cssColor(placement.onSurface),
    '--primary': cssColor(placement.primary),
    '--on-primary': cssColor(placement.onPrimary),
    '--outline': cssColor(placement.outline),
  } as CSSProperties;
  return (
    <section className="host-panel" style={style} inert={!visible}>
      {page === 'platform' && <PlatformViews />}
      {page === 'webview' && <WebViewPanel />}
      {page === 'texture' && <TexturePanel />}
    </section>
  );
}

const overlapCases = [
  'Host controls',
  'Partial cover',
  'Full cover',
  'Restore controls',
  'Foreground behind controls',
  'Interleaved layers',
  'Translucent cover',
  'Pointer pass-through',
  'Reverse order',
  'Move editor',
];

function PlatformViews() {
  const [overlap, setOverlap] = useState(0);
  const [controls, setControls] = useState(true);
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <h1>Platform views</h1>
      <p>Test pointer routing, focus and overlap with the host’s button and text editor.</p>
      <div className="host-actions">
        <button onClick={() => setOverlap((index) => (index + 1) % overlapCases.length)}>
          Next overlap case
        </button>
        <button onClick={() => setControls((mounted) => !mounted)}>
          {controls ? 'Dispose controls' : 'Create controls'}
        </button>
        <button onClick={() => dialog.current?.showModal()}>Open modal</button>
      </div>
      <p aria-live="polite">{overlapCases[overlap]}</p>
      <div className={`platform-stage platform-stage-${overlap}`}>
        {controls && <PlatformControls />}
        {controls && ![0, 3, 9].includes(overlap) && (
          <div className="platform-cover">Foreground layer</div>
        )}
      </div>
      <label className="host-field">
        Focus and IME test
        <input placeholder="Type here after using the editor" />
      </label>
      <dialog ref={dialog} className="host-dialog">
        <h2>Platform view modal</h2>
        <p>Close the modal to return to the controls.</p>
        <form method="dialog">
          <button autoFocus>Close</button>
        </form>
      </dialog>
    </>
  );
}

function PlatformControls() {
  const [count, setCount] = useState(0);
  return (
    <>
      <button className="platform-button" onClick={() => setCount((value) => value + 1)}>
        Host button · {count}
      </button>
      <label className="host-field platform-editor">
        Host editor
        <textarea rows={3} defaultValue="Edit text in the host control." />
      </label>
    </>
  );
}
