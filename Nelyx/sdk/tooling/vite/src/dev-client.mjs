// SPDX-License-Identifier: BSD-3-Clause
const key = Symbol.for('nelyx.frontend.reload');
const lifetime = (window[key] ??= {});

if (import.meta.hot) {
  import.meta.hot.on('nelyx:reload', () => {
    if (lifetime.reloading) return;
    lifetime.reloading = true;
    void Promise.resolve()
      .then(() => lifetime.close?.())
      .then(() => location.reload())
      .catch((error) => {
        document.body.dataset.error = String(error);
        const alert = document.createElement('pre');
        alert.setAttribute('role', 'alert');
        alert.textContent = String(error);
        document.body.prepend(alert);
        console.error(error);
      });
  });
}
