// SPDX-License-Identifier: BSD-3-Clause
import './style.css';
import { startPwa } from '@nelyx/vite/client';
import { App } from 'virtual:nelyx-component';
import { connectAndroidSafeArea } from './android-safe-area.ts';
import { configure } from './configuration.ts';
import application from '../../package.json' with { type: 'json' };
import assetConfig from './app-config.json' with { type: 'json' };

const safeArea = connectAndroidSafeArea();
startPwa({
  config: application.nelyx,
  assets: assetConfig.assets,
  component: App,
  configure: (options) => configure(safeArea ? { ...options, safeArea } : options),
});
