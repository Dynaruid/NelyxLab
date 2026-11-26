// SPDX-License-Identifier: BSD-3-Clause
const counter = document.querySelector('#counter');
let value = 0;
counter.addEventListener('click', () => {
  value++;
  counter.textContent = `Count: ${value}`;
});

window.addEventListener('message', (event) => {
  if (
    event.source === parent &&
    event.origin === window.origin &&
    event.data?.kind === 'testbed/read-title'
  ) {
    parent.postMessage(
      { kind: 'testbed/title', title: document.title },
      window.origin === 'null' ? '*' : window.origin,
    );
  }
});
