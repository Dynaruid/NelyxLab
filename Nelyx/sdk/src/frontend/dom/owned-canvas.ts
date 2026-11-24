// SPDX-License-Identifier: BSD-3-Clause
export function replaceOwnedCanvas(previous: HTMLCanvasElement): HTMLCanvasElement {
  if (!previous.isConnected) throw new Error('Web display canvas owner has closed');
  const canvas = previous.cloneNode(false) as HTMLCanvasElement;
  delete canvas.dataset.nelyxRenderPath;
  delete canvas.dataset.nelyxFrameReady;
  previous.replaceWith(canvas);
  return canvas;
}
