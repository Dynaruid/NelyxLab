// SPDX-License-Identifier: BSD-3-Clause
// oxlint-disable-next-line no-unused-vars -- The Rust page-load handler calls this function.
async function setNelyxHostTitle(title) {
  try {
    const { core, window: windows } = window.__TAURI__;
    const { version, os } = await core.invoke('host_info');
    await windows.getCurrentWindow().setTitle(`${title} ${version} (${os})`);
  } catch (error) {
    console.error('Nelyx Tauri host_info failed', error);
  }
}
