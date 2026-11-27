// SPDX-License-Identifier: BSD-3-Clause
function setupRetainedViewport(physicalWidth, physicalHeight, physicalLeft) {
  if (window !== window.top) return;
  function applySize() {
    const root = document.documentElement;
    if (!root) return false;
    const scale = window.devicePixelRatio || 1;
    const width = `${physicalWidth / scale}px`;
    const height = `${physicalHeight / scale}px`;
    const left = `${physicalLeft / scale}px`;
    if (root.style.width === width && root.style.height === height && root.style.left === left)
      return false;
    root.style.position = 'relative';
    root.style.left = left;
    root.style.setProperty('--nelyx-viewport-left', left);
    root.style.width = width;
    root.style.height = height;
    return true;
  }
  Object.defineProperty(window, '__nelyxSetRetainedViewport', {
    value(width, height, left) {
      physicalWidth = width;
      physicalHeight = height;
      physicalLeft = left;
      if (applySize()) window.dispatchEvent(new Event('resize'));
    },
  });
  window.addEventListener('resize', applySize);
  if (document.documentElement) applySize();
  else document.addEventListener('DOMContentLoaded', applySize, { once: true });
}
