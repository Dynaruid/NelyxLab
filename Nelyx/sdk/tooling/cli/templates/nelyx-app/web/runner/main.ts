import { setWebReloadHandler } from '@nelyx/metro/web-refresh';
import {
  registerApplication,
  webBackend,
  closeAllWebApplications,
} from '@nelyx/sdk/platforms/web/application';
import { App } from './App.tsx';
import { configure } from './configuration.ts';
import application from '../../package.json' with { type: 'json' };
import { defineConfig, defineAssetManifest } from '@nelyx/sdk/runtime/config';
import assetConfig from './app-config.json' with { type: 'json' };
const manifest = defineAssetManifest(assetConfig.assets);
const config = defineConfig(application.nelyx);
setWebReloadHandler(closeAllWebApplications);
const setup = async () => {
  const root = document.getElementById('app')!,
    canvasKitManifest = await (await fetch('./runtime/native-manifest.json')).json();
  configure({
    manifest,
    assetsRoot: new URL('./', location.href),
    canvasKitRoot: new URL('./runtime/', location.href),
    canvasKitManifest,
    ...(new URL(location.href).searchParams.has('profile')
      ? { profile: new URL(location.href).searchParams.get('profile')! }
      : {}),
  });
  const Strict = () =>
    webBackend().react.createElement(
      webBackend().react.StrictMode,
      null,
      webBackend().react.createElement(App),
    );
  registerApplication(config.name, Strict, root);
};
void setup().catch((error) => {
  document.body.dataset.error = String(error);
  console.error(error);
});
