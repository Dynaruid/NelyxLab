void (async () => {
  const { core, window: windows } = window.__TAURI__;
  const { version, os } = await core.invoke('host_info');
  await windows.getCurrentWindow().setTitle(`Nelyx Demo · Tauri ${version} (${os})`);
})().catch((error) => console.error('Nelyx Tauri host_info failed', error));
