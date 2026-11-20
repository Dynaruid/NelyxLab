// SPDX-License-Identifier: BSD-3-Clause
import './style.css';
import { startPwa } from '@nelyx/vite/client';
import { App } from 'virtual:nelyx-component';
import { configure } from './configuration.ts';
import application from '../../package.json' with { type: 'json' };
import assetConfig from './app-config.json' with { type: 'json' };

startPwa({ config: application.nelyx, assets: assetConfig.assets, component: App, configure });
