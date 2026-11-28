// SPDX-License-Identifier: BSD-3-Clause
const counter = document.querySelector('#frame-counter');
let clicks = 0;
counter.addEventListener('click', () => {
  counter.textContent = 'Frame clicks: ' + ++clicks;
});
parent.postMessage(
  { kind: 'testbed/platform-frame-ready' },
  window.origin === 'null' ? '*' : window.origin,
);
